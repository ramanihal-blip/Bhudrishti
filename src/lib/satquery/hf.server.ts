/**
 * Hugging Face inference adapter layer (server only).
 *
 * This is the swap-in point of the Model Registry: each specialist maps to a
 * Hugging Face model entry below, and adding/replacing a remote-sensing model
 * means editing only this table. Nothing here fabricates a result — if the
 * call fails, is unauthorised, still loading, or the model is not confident
 * enough, that is reported verbatim to the agent.
 */
import type { SpecialistId } from "./agent";

export type HfTask = "image-classification-zeroshot" | "image-to-text";

export type HfModelEntry = {
  id: string;
  task: HfTask;
  /** Candidate labels for zero-shot models. */
  labels?: { label: string; prompt: string }[];
};

const LANDCOVER_LABELS = [
  { label: "Water / flooding", prompt: "a satellite image showing a large water body or flooded land" },
  { label: "Vegetation / forest", prompt: "a satellite image showing dense vegetation, forest or trees" },
  { label: "Cropland / farmland", prompt: "a satellite image showing agricultural fields or farmland" },
  { label: "Built-up / urban", prompt: "a satellite image showing buildings, roads and urban development" },
  { label: "Barren / bare soil", prompt: "a satellite image showing barren land, bare soil, sand or desert" },
  { label: "Cloud / haze", prompt: "a satellite image mostly covered by clouds or haze" },
];

/** Registry: specialist -> Hugging Face model. Replace any entry to plug in a different model. */
export const HF_MODELS: Record<SpecialistId, HfModelEntry> = {
  captioning: { id: "Salesforce/blip-image-captioning-large", task: "image-to-text" },
  vqa: { id: "openai/clip-vit-large-patch14", task: "image-classification-zeroshot", labels: LANDCOVER_LABELS },
  grounding: { id: "openai/clip-vit-large-patch14", task: "image-classification-zeroshot", labels: LANDCOVER_LABELS },
  change: { id: "openai/clip-vit-large-patch14", task: "image-classification-zeroshot", labels: LANDCOVER_LABELS },
  "optical-sar": {
    id: "openai/clip-vit-large-patch14",
    task: "image-classification-zeroshot",
    labels: LANDCOVER_LABELS,
  },
};

export type HfScore = { label: string; score: number };

export type ModelOutcome = {
  ok: boolean;
  modelId: string;
  task: HfTask;
  /** Plain-language model response, or the reason there is none. */
  message: string;
  /** True only when the model output is decisive enough to answer the query. */
  reliable: boolean;
  scores: HfScore[];
  caption: string | null;
};

const ENDPOINT = "https://router.huggingface.co/hf-inference/models";

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; base64: string } {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, base64 };
}

function fail(entry: HfModelEntry, message: string): ModelOutcome {
  return { ok: false, modelId: entry.id, task: entry.task, message, reliable: false, scores: [], caption: null };
}

async function callHf(entry: HfModelEntry, token: string, dataUrl: string): Promise<unknown> {
  const { bytes, base64 } = dataUrlToBytes(dataUrl);
  const url = `${ENDPOINT}/${entry.id}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const res =
    entry.task === "image-to-text"
      ? await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "image/jpeg" }, body: bytes })
      : await fetch(url, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: base64,
            parameters: { candidate_labels: (entry.labels ?? []).map((l) => l.prompt) },
          }),
        });

  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`Hugging Face returned ${res.status}. ${text}`);
  }
  return res.json();
}

/** Runs the Hugging Face model mapped to this specialist. Never invents an answer. */
export async function runHuggingFace(
  specialistId: SpecialistId,
  query: string,
  dataUrl: string | null | undefined,
): Promise<ModelOutcome> {
  const entry = HF_MODELS[specialistId];
  const token = process.env["HUGGINGFACE_API_TOKEN"];

  if (!token) return fail(entry, "Hugging Face token is not configured on the server, so no model was called.");
  if (!dataUrl) return fail(entry, "No decodable image pixels were available to send to the model.");

  let raw: unknown;
  try {
    raw = await callHf(entry, token, dataUrl);
  } catch (e) {
    return fail(entry, e instanceof Error ? e.message : "The Hugging Face request failed.");
  }

  if (entry.task === "image-to-text") {
    const arr = Array.isArray(raw) ? (raw as { generated_text?: string }[]) : [];
    const caption = arr[0]?.generated_text?.trim() ?? null;
    if (!caption) return fail(entry, "The captioning model returned no text for this image.");
    return {
      ok: true,
      modelId: entry.id,
      task: entry.task,
      message: caption,
      reliable: true,
      scores: [],
      caption,
    };
  }

  const arr = Array.isArray(raw) ? (raw as { label?: string; score?: number }[]) : [];
  const byPrompt = new Map((entry.labels ?? []).map((l) => [l.prompt, l.label]));
  const scores: HfScore[] = arr
    .map((r) => ({ label: byPrompt.get(r.label ?? "") ?? r.label ?? "unknown", score: Number(r.score ?? 0) }))
    .sort((a, b) => b.score - a.score);

  if (!scores.length) return fail(entry, "The classification model returned no usable scores for this image.");

  const top = scores[0]!;
  const second = scores[1]?.score ?? 0;
  const reliable = top.score >= 0.35 && top.score - second >= 0.08;
  const asked = queryFocus(query);
  const askedScore = asked ? scores.find((s) => s.label.toLowerCase().includes(asked))?.score ?? null : null;

  const message = reliable
    ? `${entry.id} classifies this scene as “${top.label}” (score ${top.score.toFixed(2)}).` +
      (askedScore !== null ? ` Score for the class asked about: ${askedScore.toFixed(2)}.` : "")
    : `${entry.id} could not separate the land-cover classes confidently for this image (top class “${top.label}” at ${top.score.toFixed(2)}), so it cannot reliably answer this query.`;

  return { ok: true, modelId: entry.id, task: entry.task, message, reliable, scores, caption: null };
}

function queryFocus(query: string): string | null {
  const q = query.toLowerCase();
  if (/(water|flood|lake|river|sea|coast)/.test(q)) return "water";
  if (/(vegetat|forest|tree|green|crop|farm)/.test(q)) return "vegetation";
  if (/(built|urban|building|city|settlement|road)/.test(q)) return "built";
  return null;
}
