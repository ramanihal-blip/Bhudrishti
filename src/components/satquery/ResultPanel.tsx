import { useState } from "react";
import {
  Activity,
  BadgeCheck,
  Download,
  Layers,
  MessageCircleQuestion,
  ScanSearch,
  ShieldQuestion,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import type { AnalysisResult, EvidenceStatus } from "@/lib/satquery/agent";
import type { LoadedImage } from "@/lib/satquery/imaging";

export type Stage = { label: string; state: "pending" | "running" | "done" };

export type ChallengeResult = {
  consistent: boolean;
  headline: string;
  primary: string;
  verification: string;
  status: string;
  specialistUsed: string;
};

export type FollowUp = {
  question: string;
  specialistName: string;
  answer: string;
  measurements: { label: string; value: string }[];
  evidenceStatus: EvidenceStatus;
  overlayUrl?: string | null;
};

type Props = {
  stages: Stage[];
  busy: boolean;
  result: AnalysisResult | null;
  images: (LoadedImage | null)[];
  overlayUrl: string | null;
  changeMapUrl: string | null;
  challenge: ChallengeResult | null;
  challenging: boolean;
  onChallenge: () => void;
  followUps: FollowUp[];
  onAsk: (q: string) => void;
  asking: boolean;
  onDownload: () => void;
};

const statusChip = (s: EvidenceStatus) =>
  s === "High confidence"
    ? "chip chip-ok"
    : s === "Moderate confidence"
      ? "chip chip-primary"
      : s === "Low confidence"
        ? "chip chip-warn"
        : "chip chip-warn";

const cleanFollowUpAnswer = (answer: string) => {
  const withoutPrefix = answer.replace(/^Hugging Face model .*? reports:\s*/i, "");
  const sentences = withoutPrefix
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/hugging face|specialist|adapter|model id|inference|routing/i.test(sentence));
  return sentences.join(" ") || "This evidence does not provide a reliable answer to that question.";
};

export function ResultPanel(props: Props) {
  const {
    stages,
    busy,
    result,
    images,
    overlayUrl,
    changeMapUrl,
    challenge,
    challenging,
    onChallenge,
    followUps,
    onAsk,
    asking,
    onDownload,
  } = props;
  const [tab, setTab] = useState<"answer" | "evidence">("answer");
  const [showEvidence, setShowEvidence] = useState(false);
  const [followUpText, setFollowUpText] = useState("");

  const img1 = images[0] ?? null;
  const img2 = images[1] ?? null;
  const isPair = Boolean(img1 && img2);
  const isChange = result?.specialistId === "change";
  const isOpticalSar = result?.specialistId === "optical-sar";
  const currentStage = stages.find((stage) => stage.state === "running")?.label;
  const visibleMeasurements = result?.measurements.filter((m) => !/model|caption|score/i.test(m.label)) ?? [];
  const displayedAnswer = result?.model?.ok && result.model.reliable
    ? result.model.message
    : result?.model
      ? "The analysis could not produce a reliable answer for this image. Please try again with a clearer image or a more specific question."
      : result?.answer;

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-head">
          <Activity size={14} /> Analysis Status
          {busy ? <span className="chip chip-primary ml-auto">Analyzing</span> : null}
          {!busy && result ? <span className="chip chip-ok ml-auto">Complete</span> : null}
        </div>
        <div className="flex items-center gap-3 p-4 text-sm">
          {busy ? <Loader2 size={18} className="animate-spin text-primary" /> : <CheckCircle2 size={18} className={result ? "text-success" : "text-muted-foreground"} />}
          <span className={busy || result ? "text-foreground" : "text-muted-foreground"}>
            {busy ? currentStage ?? "Analyzing your satellite imagery…" : result ? "Analysis complete." : "Ready when you are."}
          </span>
        </div>
      </div>

      {!result ? (
        <div className="panel p-8 text-center">
          <ScanSearch size={28} className="mx-auto text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Upload imagery, enter or speak a question, then press Analyze to receive a clear answer with supporting evidence.
          </p>
        </div>
      ) : (
        <>
          {/* tabs */}
          <div className="flex gap-2">
            {(
              [
                ["answer", "Answer", BadgeCheck],
                ["evidence", "Evidence", Layers],
              ] as const
            ).map(([k, label, Icon]) => (
              <button key={k} className={`btn flex-1 ${tab === k ? "btn-primary" : ""}`} onClick={() => setTab(k)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {tab === "answer" ? (
            <div className="panel">
              <div className="panel-head">
                <BadgeCheck size={14} /> Final Answer
                <span className={`${statusChip(result.evidenceStatus)} ml-auto`}>{result.evidenceStatus}</span>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-[0.95rem] leading-relaxed">{displayedAnswer}</p>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Would you like to see the evidence?</span>
                  <button
                    className="btn"
                    onClick={() => {
                      setShowEvidence(true);
                      setTab("evidence");
                    }}
                  >
                    <Layers size={14} /> Show evidence
                  </button>
                  <button className="btn btn-accent" onClick={onChallenge} disabled={challenging}>
                    {challenging ? <Loader2 size={14} className="animate-spin" /> : <ShieldQuestion size={14} />}
                    Challenge my answer
                  </button>
                  <button className="btn" onClick={onDownload}>
                    <Download size={14} /> Download analysis report
                  </button>
                </div>

                {challenge ? (
                  <div
                    className={`rounded-md border p-3 ${
                      challenge.consistent ? "border-success/50 bg-success/10" : "border-warning/50 bg-warning/10"
                    }`}
                  >
                    <div className={`chip ${challenge.consistent ? "chip-ok" : "chip-warn"}`}>
                      {challenge.consistent ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {challenge.consistent ? "✓ " : "⚠ "}
                      {challenge.headline}
                    </div>
                     <p className="mt-2 text-sm text-foreground/85">
                       {challenge.consistent
                         ? "A second analysis found compatible evidence. This is a consistency check, not a guarantee of correctness."
                         : "A second analysis found conflicting evidence. Please treat this result with caution."}
                     </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "evidence" ? (
            <div className="space-y-4">
              {!showEvidence ? (
                <div className="panel p-6 text-center">
                  <p className="text-sm text-muted-foreground">Would you like to see the evidence?</p>
                  <button className="btn btn-primary mt-3" onClick={() => setShowEvidence(true)}>
                    <Layers size={14} /> Show evidence
                  </button>
                </div>
              ) : (
                <>
                  <div className="panel">
                    <div className="panel-head">
                       <Layers size={14} /> Visual Evidence
                    </div>
                    <div className="grid gap-3 p-3 md:grid-cols-2">
                      {isPair && (isChange || isOpticalSar) ? (
                        <>
                          <Figure
                            title={isChange ? "BEFORE" : "OPTICAL IMAGE"}
                            src={img1?.url ?? null}
                            caption={img1?.features.name ?? ""}
                          />
                          <Figure
                            title={isChange ? "AFTER" : "SAR IMAGE"}
                            src={img2?.url ?? null}
                            caption={img2?.features.name ?? ""}
                          />
                          <Figure
                            title={isChange ? "CHANGE EVIDENCE" : "COMBINED ANALYSIS"}
                            src={isChange ? changeMapUrl : overlayUrl}
                            caption={
                              isChange
                                ? "Highlighted changes and the most affected area"
                                : "Highlighted areas relevant to the analysis"
                            }
                          />
                          <div className="rounded-md border border-border bg-surface-2/40 p-3">
                            <span className="label-xs">Measured values</span>
                            <dl className="mono mt-2 space-y-1 text-[0.7rem]">
                              {visibleMeasurements.map((m) => (
                                <div key={m.label} className="flex justify-between gap-2">
                                  <dt className="text-muted-foreground">{m.label}</dt>
                                  <dd>{m.value}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </>
                      ) : (
                        <>
                          <Figure title="ORIGINAL IMAGE" src={img1?.url ?? null} caption={img1?.features.name ?? ""} />
                          <Figure
                            title="PROCESSED / HIGHLIGHTED REGION"
                            src={overlayUrl}
                            caption={
                              overlayUrl
                                ? "Highlighted area relevant to your question"
                                : "No visual highlight is available for this result"
                            }
                          />
                          <div className="rounded-md border border-border bg-surface-2/40 p-3 md:col-span-2">
                            <span className="label-xs">Measured values</span>
                            <dl className="mono mt-2 grid gap-1 text-[0.7rem] sm:grid-cols-2">
                              {visibleMeasurements.map((m) => (
                                <div key={m.label} className="flex justify-between gap-2">
                                  <dt className="text-muted-foreground">{m.label}</dt>
                                  <dd>{m.value}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <MessageCircleQuestion size={14} /> Ask the Evidence
                    </div>
                    <div className="space-y-3 p-3">
                      <div className="flex gap-2">
                        <input
                          className="field"
                          placeholder="Ask about this evidence…"
                          value={followUpText}
                          onChange={(e) => setFollowUpText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && followUpText.trim()) {
                              onAsk(followUpText.trim());
                              setFollowUpText("");
                            }
                          }}
                        />
                        <button
                          className="btn btn-primary"
                          disabled={asking || !followUpText.trim()}
                          onClick={() => {
                            onAsk(followUpText.trim());
                            setFollowUpText("");
                          }}
                        >
                          {asking ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                          Ask
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {["Where exactly?", "How much area changed?", "Show that region."].map((s) => (
                          <button key={s} className="chip hover:border-primary" onClick={() => setFollowUpText(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                      {followUps.map((f, i) => (
                        <div key={`${f.question}-${i}`} className="rounded-md border border-border bg-surface-2/40 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{f.question}</span>
                            <span className={statusChip(f.evidenceStatus)}>{f.evidenceStatus}</span>
                          </div>
                           <p className="mt-1.5 text-sm text-foreground/85">{cleanFollowUpAnswer(f.answer)}</p>
                          {f.overlayUrl ? (
                            <img
                              src={f.overlayUrl}
                              alt="Follow-up evidence overlay"
                              className="mt-2 w-full max-w-xs rounded-md border border-border"
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

        </>
      )}
    </div>
  );
}

function Figure({ title, src, caption }: { title: string; src: string | null; caption: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/40 p-2">
      <div className="label-xs mb-1.5">{title}</div>
      {src ? (
        <img src={src} alt={title} className="aspect-square w-full rounded-md border border-border object-cover" />
      ) : (
        <div className="mono flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border text-[0.68rem] text-muted-foreground">
          not available
        </div>
      )}
      <p className="mono mt-1 text-[0.64rem] text-muted-foreground">{caption}</p>
    </div>
  );
}
