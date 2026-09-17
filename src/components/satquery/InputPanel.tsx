import { useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Upload,
  X,
  Satellite,
  Sparkles,
  Play,
  Loader2,
  FileImage,
} from "lucide-react";
import type { LoadedImage } from "@/lib/satquery/imaging";

export const EXAMPLE_QUERIES = [
  "Describe the land-cover and major objects visible in this image.",
  "Is there a water body in this image?",
  "Highlight the water body referred to in the query.",
  "What changed between these two dates, and where did the change occur?",
  "Use the optical and SAR images together to identify built-up and water-covered regions.",
  "Has the built-up area increased, decreased, or remained unchanged?",
];

type Props = {
  query: string;
  setQuery: (v: string) => void;
  images: (LoadedImage | null)[];
  onFile: (index: number, file: File) => void;
  onClear: (index: number) => void;
  lengthPref: "100-200" | "200-300";
  setLengthPref: (v: "100-200" | "200-300") => void;
  onAnalyze: () => void;
  busy: boolean;
};

function Slot({
  index,
  image,
  onFile,
  onClear,
}: {
  index: number;
  image: LoadedImage | null;
  onFile: (i: number, f: File) => void;
  onClear: (i: number) => void;
}) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`dropzone p-3 ${over ? "dropzone-active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(index, f);
      }}
    >
      <div className="flex items-center justify-between">
        <span className="label-xs">Image {index + 1}</span>
        {image ? (
          <button className="text-muted-foreground hover:text-destructive" onClick={() => onClear(index)}>
            <X size={14} />
          </button>
        ) : null}
      </div>

      {image ? (
        <div className="mt-2 flex gap-3">
          <img
            src={image.url}
            alt={image.features.name}
            className="h-20 w-20 rounded-md border border-border object-cover"
          />
          <div className="mono min-w-0 flex-1 space-y-1 text-[0.68rem] text-muted-foreground">
            <div className="truncate text-foreground">{image.features.name}</div>
            <div>
              {image.features.width
                ? `${image.features.width} × ${image.features.height} px`
                : "dimensions unavailable"}
            </div>
            <div>
              {image.features.format.toUpperCase()} · {image.features.sizeKB} KB
            </div>
            <div className={image.features.decodable ? "chip chip-primary" : "chip chip-warn"}>
              {image.features.modality}
            </div>
          </div>
        </div>
      ) : (
        <button
          className="mt-2 flex w-full flex-col items-center gap-1 py-5 text-muted-foreground hover:text-primary"
          onClick={() => ref.current?.click()}
        >
          <Upload size={18} />
          <span className="mono text-[0.68rem]">Drop or click · GeoTIFF / TIFF / PNG / JPEG</span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept=".tif,.tiff,.png,.jpg,.jpeg,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(index, f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function InputPanel(props: Props) {
  const { query, setQuery, images, onFile, onClear, lengthPref, setLengthPref, onAnalyze, busy } = props;
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setVoiceError("Voice input is not supported by this browser. Type the query instead.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setQuery(text);
    };
    rec.onerror = () => {
      setVoiceError("Microphone unavailable or permission denied.");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setVoiceError(null);
    setListening(true);
    rec.start();
  };

  const canAnalyze = query.trim().length > 2 && images.some(Boolean) && !busy;

  return (
    <div className="panel">
      <div className="panel-head">
        <Satellite size={14} /> Query &amp; Imagery Input
      </div>
      <div className="space-y-4 p-4">
        <div>
          <span className="label-xs">Natural-language query</span>
          <div className="mt-2 flex gap-2">
            <textarea
              className="field min-h-[86px] resize-y"
              placeholder="Ask the Earth… e.g. Is there a water body in this image?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className={`btn h-[86px] w-12 shrink-0 px-0 ${listening ? "btn-accent scan-line" : ""}`}
              title="Voice query"
              onClick={toggleVoice}
            >
              {listening ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          </div>
          {listening ? <p className="mono mt-1 text-[0.66rem] text-primary">Listening… speak your query</p> : null}
          {voiceError ? <p className="mono mt-1 text-[0.66rem] text-warning">{voiceError}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Slot key={i} index={i} image={images[i] ?? null} onFile={onFile} onClear={onClear} />
          ))}
        </div>

        <div>
          <span className="label-xs">Response length</span>
          <div className="mt-2 flex gap-2">
            {(["100-200", "200-300"] as const).map((v) => (
              <button
                key={v}
                className={`btn flex-1 ${lengthPref === v ? "btn-primary" : ""}`}
                onClick={() => setLengthPref(v)}
              >
                {v} words
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label-xs flex items-center gap-1">
            <Sparkles size={12} /> Example queries
          </span>
          <div className="mt-2 grid gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="flex items-start gap-2 rounded-md border border-border bg-surface-2/40 p-2 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                <FileImage size={13} className="mt-0.5 shrink-0 text-primary" />
                {q}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary w-full py-3" disabled={!canAnalyze} onClick={onAnalyze}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {busy ? "Analyzing" : "Analyze"}
        </button>
        {!images.some(Boolean) ? (
          <p className="mono text-center text-[0.66rem] text-muted-foreground">
            Upload at least one image to enable analysis
          </p>
        ) : null}
      </div>
    </div>
  );
}
