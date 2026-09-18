import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Satellite, Globe2 } from "lucide-react";
import { InputPanel } from "@/components/satquery/InputPanel";
import { AgentFlow, ArchitecturePanel, DataDoctorPanel, RegistryPanel } from "@/components/satquery/Panels";
import {
  ResultPanel,
  type ChallengeResult,
  type FollowUp,
  type Stage,
} from "@/components/satquery/ResultPanel";
import { analyzeQuery, challengeAnswer, askAboutEvidence } from "@/lib/satquery.functions";
import { computeChange, elementFromUrl, loadImage, type LoadedImage } from "@/lib/satquery/imaging";
import type { AnalysisRequest, AnalysisResult, ChangeStats } from "@/lib/satquery/agent";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BhuDrishti — SatQuery AI | Ask the Earth. Get the Insight." },
      {
        name: "description",
        content:
          "Upload satellite imagery, ask a natural-language question and get an evidence-backed answer with validation, specialist routing and an execution trace.",
      },
      { property: "og:title", content: "BhuDrishti — SatQuery AI" },
      {
        property: "og:description",
        content:
          "Natural-language querying of satellite imagery with data validation, specialist model routing and verifiable evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STAGE_LABELS = [
  "Validating imagery",
  "Understanding query",
  "Selecting specialist",
  "Running Hugging Face model",
  "Processing imagery",
  "Extracting evidence",
  "Composing answer",
];

const blankStages = (): Stage[] => STAGE_LABELS.map((label) => ({ label, state: "pending" as const }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Index() {
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<(LoadedImage | null)[]>([null, null]);
  const [lengthPref, setLengthPref] = useState<"100-200" | "200-300">("100-200");
  const [stages, setStages] = useState<Stage[]>(blankStages());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [change, setChange] = useState<ChangeStats>(null);
  const [changeMapUrl, setChangeMapUrl] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeResult | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [asking, setAsking] = useState(false);
  const requestRef = useRef<AnalysisRequest | null>(null);

  const validation = useMemo(() => result?.validation ?? null, [result]);
  const activeImages = images.filter(Boolean) as LoadedImage[];

  const overlayFor = useCallback(
    (kind: string, index: number): string | null => {
      if (kind === "none") return null;
      if (kind === "change") return changeMapUrl;
      return images[index]?.overlays[kind] ?? images[0]?.overlays[kind] ?? null;
    },
    [images, changeMapUrl],
  );

  const overlayUrl = result ? overlayFor(result.overlayRequest.kind, result.overlayRequest.imageIndex) : null;

  const onFile = async (index: number, file: File) => {
    const loaded = await loadImage(file);
    setImages((prev) => {
      const next = [...prev];
      next[index] = loaded;
      return next;
    });
    setResult(null);
    setChallenge(null);
    setFollowUps([]);
    setChangeMapUrl(null);
    setChange(null);
  };

  const onClear = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setResult(null);
    setChallenge(null);
    setFollowUps([]);
    setChangeMapUrl(null);
    setChange(null);
  };

  /** Stages advance with the run; the model stage stays "running" until the API responds. */
  const runStages = async (pending: Promise<unknown>) => {
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    for (let i = 0; i < STAGE_LABELS.length; i++) {
      setStages((prev) => prev.map((s, j) => (j === i ? { ...s, state: "running" } : s)));
      await sleep(260);
      if (STAGE_LABELS[i] === "Running Hugging Face model") {
        while (!settled) await sleep(200);
      }
      setStages((prev) => prev.map((s, j) => (j === i ? { ...s, state: "done" } : s)));
    }
  };

  const onAnalyze = async () => {
    if (!activeImages.length) return;
    setBusy(true);
    setResult(null);
    setChallenge(null);
    setFollowUps([]);
    setStages(blankStages());

    let changeStats: ChangeStats = null;
    let mapUrl: string | null = null;
    const [a, b] = images;
    if (a && b) {
      const [ea, eb] = await Promise.all([elementFromUrl(a.url), elementFromUrl(b.url)]);
      if (ea && eb) {
        const c = computeChange(ea, eb, a.features, b.features);
        changeStats = c.stats;
        mapUrl = c.url;
      }
    }
    setChange(changeStats);
    setChangeMapUrl(mapUrl);

    const request: AnalysisRequest = {
      query,
      images: activeImages.map((i) => i.features),
      imageData: activeImages.map((i) => i.dataUrl),
      change: changeStats,
      lengthPreference: lengthPref,
    };
    requestRef.current = request;

    const pending = analyzeQuery({ data: request });
    const [res] = await Promise.all([pending, runStages(pending)]);
    setResult(res);
    setBusy(false);
  };

  const onChallenge = async () => {
    if (!result || !requestRef.current) return;
    setChallenging(true);
    const res = await challengeAnswer({ data: { request: requestRef.current, primary: result } });
    setChallenge(res);
    setChallenging(false);
  };

  const onAsk = async (question: string) => {
    if (!result || !requestRef.current || !question) return;
    setAsking(true);
    const res = await askAboutEvidence({ data: { question, request: requestRef.current, primary: result } });
    setFollowUps((prev) => [
      ...prev,
      {
        question: res.question,
        specialistName: res.specialistName,
        answer: res.answer,
        measurements: res.measurements,
        evidenceStatus: res.evidenceStatus,
        overlayUrl: overlayFor(res.overlayRequest.kind, res.overlayRequest.imageIndex),
      },
    ]);
    setAsking(false);
  };

  const onDownload = () => {
    if (!result) return;
    const lines = [
      "BHUDRISHTI — SATQUERY AI · ANALYSIS REPORT",
      `Generated: ${new Date().toISOString()}`,
      "",
      `Query: ${query}`,
      `Task: ${result.task}`,
      `Specialist used: ${result.specialistName}`,
      `Input configuration: ${result.inputConfiguration}`,
      `Routing reason: ${result.routingReason}`,
      "",
      "IMAGES",
      ...activeImages.map(
        (i) =>
          `- ${i.features.name} · ${i.features.width ?? "?"}x${i.features.height ?? "?"} px · ${i.features.format.toUpperCase()} · ${i.features.sizeKB} KB · ${i.features.modality}`,
      ),
      "",
      "DATA DOCTOR",
      `${result.validation.headline} — ${result.validation.mode}`,
      ...result.validation.checks.map((c) => `- ${c.label}: ${c.value}`),
      ...result.validation.issues.map((s) => `! ${s}`),
      "",
      "ANSWER",
      result.answer,
      "",
      "MODEL",
      result.model
        ? `${result.model.ok ? "Hugging Face" : "Hugging Face (unavailable)"}: ${result.model.modelId} — ${result.model.message}`
        : "No model call was made for this result.",
      "",
      `Evidence status: ${result.evidenceStatus}`,
      result.evidenceNote,
      "",
      "MEASUREMENTS",
      ...result.measurements.map((m) => `- ${m.label}: ${m.value}`),
      "",
      "FINDINGS",
      ...result.findings.map((f) => `- ${f}`),
      "",
      "EXECUTION TRACE",
      ...result.trace.map((t, i) => `${i + 1}. ${t.stage}: ${t.detail}`),
      "",
      ...(challenge
        ? [
            "VERIFICATION (CHALLENGE)",
            challenge.headline,
            `Primary: ${challenge.primary}`,
            `Verification (${challenge.specialistUsed}): ${challenge.verification}`,
            challenge.status,
            "",
          ]
        : []),
      ...(followUps.length
        ? ["FOLLOW-UP EVIDENCE QUESTIONS", ...followUps.map((f) => `Q: ${f.question}\nA: ${f.answer}`), ""]
        : []),
      "Notice: land-cover statistics are measured from the uploaded pixels in-browser; the model section above is the verbatim response of the Hugging Face model called for this request. Nothing is fabricated when a model result is unavailable.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bhudrishti-satquery-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFlowIndex = busy ? stages.filter((s) => s.state === "done").length : result ? 8 : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface-2/40">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/60 bg-primary/10 text-primary">
            <Satellite size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              BHUDRISHTI — <span className="text-primary">SATQUERY AI</span>
            </h1>
            <p className="mono text-[0.68rem] text-muted-foreground">Ask the Earth. Get the Insight.</p>
          </div>
          <span className="chip ml-auto">
            <Globe2 size={12} /> Prototype · Smart India Hackathon
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5">
        <AgentFlow activeIndex={activeFlowIndex} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <InputPanel
              query={query}
              setQuery={setQuery}
              images={images}
              onFile={onFile}
              onClear={onClear}
              lengthPref={lengthPref}
              setLengthPref={setLengthPref}
              onAnalyze={onAnalyze}
              busy={busy}
            />
            <DataDoctorPanel report={validation} />
            <RegistryPanel active={result?.specialistId ?? null} />
            <ArchitecturePanel />
          </div>
          <ResultPanel
            stages={stages}
            busy={busy}
            result={result}
            images={images}
            overlayUrl={overlayUrl}
            changeMapUrl={changeMapUrl}
            challenge={challenge}
            challenging={challenging}
            onChallenge={onChallenge}
            followUps={followUps}
            onAsk={onAsk}
            asking={asking}
            onDownload={onDownload}
          />
        </div>
        <p className="mono pb-6 text-center text-[0.64rem] text-muted-foreground">
          Prototype adapters compute deterministic pixel statistics in-browser. No model weights are bundled and no
          metadata is fabricated. {change ? `Bi-temporal change computed: ${change.changedPercent.toFixed(2)}%.` : ""}
        </p>
      </main>
    </div>
  );
}
