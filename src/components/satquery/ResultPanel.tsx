import { useState } from "react";
import {
  Activity,
  BadgeCheck,
  Download,
  Layers,
  ListTree,
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

const WHY_FLOW = [
  "Input validated",
  "Query classified",
  "Specialist selected",
  "Image processed",
  "Evidence extracted",
  "Answer generated",
];

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
  const [tab, setTab] = useState<"answer" | "evidence" | "trace">("answer");
  const [showEvidence, setShowEvidence] = useState(false);
  const [followUpText, setFollowUpText] = useState("");

  const img1 = images[0] ?? null;
  const img2 = images[1] ?? null;
  const isPair = Boolean(img1 && img2);
  const isChange = result?.specialistId === "change";
  const isOpticalSar = result?.specialistId === "optical-sar";

  return (
    <div className="space-y-4">
      {/* Agent status */}
      <div className="panel">
        <div className="panel-head">
          <Activity size={14} /> Agent Status
          {busy ? <span className="chip chip-primary ml-auto">Running</span> : null}
          {!busy && result ? <span className="chip chip-ok ml-auto">Complete</span> : null}
        </div>
        <div className="grid gap-1.5 p-3 sm:grid-cols-2">
          {stages.map((s) => (
            <div key={s.label} className="mono flex items-center gap-2 text-[0.72rem]">
              {s.state === "done" ? (
                <CheckCircle2 size={13} className="text-success" />
              ) : s.state === "running" ? (
                <Loader2 size={13} className="animate-spin text-primary" />
              ) : (
                <span className="h-[13px] w-[13px] rounded-full border border-border" />
              )}
              <span className={s.state === "pending" ? "text-muted-foreground" : "text-foreground"}>{s.label}</span>
              {s.state === "done" ? <span className="text-success">✓</span> : null}
            </div>
          ))}
        </div>
      </div>

      {!result ? (
        <div className="panel p-8 text-center">
          <ScanSearch size={28} className="mx-auto text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Upload imagery, enter or speak a query, then press ANALYZE. The agent will validate the input, route it to a
            specialist and return an evidence-backed answer.
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
                ["trace", "Execution trace", ListTree],
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
                <div className="grid gap-2 sm:grid-cols-3">
                  <Meta label="Selected task" value={result.task} />
                  <Meta label="Specialist used" value={result.specialistName} />
                  <Meta label="Input configuration" value={result.inputConfiguration} />
                </div>
                <p className="text-[0.95rem] leading-relaxed">{result.answer}</p>
                <p className="mono rounded-md border border-border bg-surface-2/40 p-2 text-[0.66rem] text-muted-foreground">
                  {result.evidenceNote}
                </p>

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
                    <dl className="mono mt-2 space-y-1 text-[0.7rem]">
                      <div>
                        <dt className="text-muted-foreground">Primary analysis:</dt>
                        <dd>{challenge.primary}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Verification analysis ({challenge.specialistUsed}):
                        </dt>
                        <dd>{challenge.verification}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status:</dt>
                        <dd>{challenge.status}</dd>
                      </div>
                    </dl>
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
                      <Layers size={14} /> Evidence Workspace
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
                                ? "Red = pixels above the difference threshold; teal box = most affected region"
                                : "Highlighted structural / built-up candidate pixels from the optical channel"
                            }
                          />
                          <div className="rounded-md border border-border bg-surface-2/40 p-3">
                            <span className="label-xs">Measured values</span>
                            <dl className="mono mt-2 space-y-1 text-[0.7rem]">
                              {result.measurements.map((m) => (
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
                                ? "Magenta = classified target pixels; teal box = bounding box of the region"
                                : "No overlay applicable for this task"
                            }
                          />
                          <div className="rounded-md border border-border bg-surface-2/40 p-3 md:col-span-2">
                            <span className="label-xs">Measured values</span>
                            <dl className="mono mt-2 grid gap-1 text-[0.7rem] sm:grid-cols-2">
                              {result.measurements.map((m) => (
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
                    <div className="panel-head">Why did SatQuery say this?</div>
                    <div className="flex flex-wrap items-center gap-1.5 p-3">
                      {WHY_FLOW.map((w, i) => (
                        <div key={w} className="flex items-center gap-1.5">
                          <span className="flow-node flow-node-active">{w}</span>
                          {i < WHY_FLOW.length - 1 ? <ArrowRight size={12} className="text-muted-foreground" /> : null}
                        </div>
                      ))}
                      <p className="mono mt-2 w-full text-[0.66rem] text-muted-foreground">
                        Observable workflow summary of the stages that actually executed — not hidden model reasoning.
                      </p>
                      <ul className="mt-1 w-full space-y-1">
                        {result.findings.map((f) => (
                          <li key={f} className="mono text-[0.7rem] text-foreground/85">
                            • {f}
                          </li>
                        ))}
                      </ul>
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
                            <span className="chip chip-primary">{f.specialistName}</span>
                            <span className={statusChip(f.evidenceStatus)}>{f.evidenceStatus}</span>
                          </div>
                          <p className="mono mt-1.5 text-[0.72rem] text-foreground/85">{f.answer}</p>
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

          {tab === "trace" ? (
            <div className="panel">
              <div className="panel-head">
                <ListTree size={14} /> Execution Trace
              </div>
              <ol className="space-y-2 p-4">
                {result.trace.map((t, i) => (
                  <li key={t.stage} className="flex gap-3">
                    <span className="mono mt-0.5 h-5 w-5 shrink-0 rounded-full border border-primary text-center text-[0.65rem] leading-[1.15rem] text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="mono text-xs uppercase tracking-wider text-primary">{t.stage}</div>
                      <div className="mono text-[0.72rem] text-muted-foreground">{t.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/40 p-2">
      <div className="label-xs">{label}</div>
      <div className="mono mt-0.5 text-[0.72rem]">{value}</div>
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
