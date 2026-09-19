import { Boxes, CircuitBoard, Stethoscope, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { MODEL_REGISTRY, type SpecialistId, type ValidationReport } from "@/lib/satquery/agent";

const ARCH_FLOW = [
  "Query",
  "SatQuery Agent",
  "Satellite Data Doctor",
  "Task + Modality Detection",
  "Specialist Model Selection",
  "Remote-Sensing Analysis",
  "Evidence",
  "Answer + Confidence",
  "Optional Verification",
];

export function AgentFlow({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <CircuitBoard size={14} /> Agent Pipeline
      </div>
      <div className="flex flex-wrap gap-1.5 p-3">
        {ARCH_FLOW.map((n, i) => (
          <div key={n} className="flex items-center gap-1.5">
            <div className={`flow-node ${i <= activeIndex ? "flow-node-active" : ""}`}>{n}</div>
            {i < ARCH_FLOW.length - 1 ? <span className="mono text-xs text-muted-foreground">→</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RegistryPanel({ active }: { active: SpecialistId | null }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <Boxes size={14} /> Specialist Model Registry
      </div>
      <div className="space-y-2 p-3">
        {MODEL_REGISTRY.map((m) => (
          <div
            key={m.id}
            className={`rounded-md border p-2.5 transition ${
              active === m.id ? "border-primary bg-primary/10" : "border-border bg-surface-2/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{m.name}</span>
              <span className={`chip ${active === m.id ? "chip-primary" : ""}`}>{m.status}</span>
            </div>
            <dl className="mono mt-1.5 grid grid-cols-[72px_1fr] gap-x-2 gap-y-0.5 text-[0.66rem] text-muted-foreground">
              <dt>Task</dt>
              <dd className="text-foreground/80">{m.task}</dd>
              <dt>Input</dt>
              <dd className="text-foreground/80">{m.input}</dd>
              <dt>Output</dt>
              <dd className="text-foreground/80">{m.output}</dd>
              <dt>Swap-in</dt>
              <dd>{m.integration}</dd>
            </dl>
          </div>
        ))}
        <p className="mono text-[0.64rem] leading-relaxed text-muted-foreground">
          Each specialist uses the connected Hugging Face inference service through an independently replaceable
          adapter behind one shared interface.
        </p>
      </div>
    </div>
  );
}

export function DataDoctorPanel({ report }: { report: ValidationReport | null }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <Stethoscope size={14} /> Satellite Data Doctor
      </div>
      <div className="p-3">
        {!report ? (
          <p className="mono text-[0.7rem] text-muted-foreground">
            Awaiting imagery. Validation runs before any specialist is invoked.
          </p>
        ) : (
          <>
            <div className={`chip ${report.ready ? "chip-ok" : "chip-warn"} mb-2`}>
              {report.ready ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {report.ready ? "✓ " : "⚠ "}
              {report.headline}
            </div>
            <p className="mono mb-2 text-[0.64rem] text-muted-foreground">{report.mode}</p>
            <div className="space-y-1">
              {report.checks.map((c, i) => (
                <div key={`${c.label}-${i}`} className="mono flex justify-between gap-2 text-[0.68rem]">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span
                    className={
                      c.state === "ok" ? "text-success" : c.state === "warn" ? "text-warning" : "text-foreground/70"
                    }
                  >
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
            {report.issues.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {report.issues.map((s) => (
                  <li key={s} className="mono flex gap-1.5 text-[0.66rem] text-warning">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

const STACK = [
  "React (this UI)",
  "API layer — server functions (FastAPI-equivalent)",
  "SatQuery Agent",
  "Model Registry",
  "Specialist Models",
  "Raster / Geospatial Processing",
  "Evidence + Verification",
];

const FUTURE = [
  "PyTorch",
  "Hugging Face Transformers",
  "Whisper",
  "Rasterio",
  "GDAL",
  "GeoPandas",
  "OpenCV",
  "Leaflet",
];

export function ArchitecturePanel() {
  return (
    <div className="panel">
      <div className="panel-head">
        <CircuitBoard size={14} /> Technical Architecture
      </div>
      <div className="p-3">
        <div className="space-y-1">
          {STACK.map((s, i) => (
            <div key={s}>
              <div className="flow-node text-left">{s}</div>
              {i < STACK.length - 1 ? <div className="mono pl-3 text-[0.6rem] text-muted-foreground">↓</div> : null}
            </div>
          ))}
        </div>
        <p className="label-xs mt-3">Analysis stack &amp; integration points</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FUTURE.map((f) => (
            <span key={f} className="chip">
              {f}
            </span>
          ))}
        </div>
        <p className="mono mt-2 text-[0.64rem] leading-relaxed text-muted-foreground">
          Hugging Face inference is active and receives the uploaded image with the user&apos;s query. Image-derived
          measurements and evidence overlays complement the model response; other listed tools remain modular
          integration points.
        </p>
      </div>
    </div>
  );
}
