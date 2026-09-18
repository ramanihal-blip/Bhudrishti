/**
 * Hugging Face inference adapter layer (server only).
 *
 * This is the swap-in point of the Model Registry: each specialist maps to one
 * Hugging Face model entry below, so plugging in a different (e.g. remote-sensing
 * fine-tuned) model means editing only this table. Nothing here fabricates a
 * result: failures, unsupported models and non-committal model answers are
 * reported verbatim to the agent.
 */
import type { ModelOutcome, SpecialistId } from "./agent";

/**
 * vision-chat      -> Inference Providers chat completions (image + question in, text out)
 * image-classification -> hf-inference classification pipeline (image in, labelled scores out)
 */
export type HfTask = "vision-chat" | "image-classification";

export type HfModelEntry = {
  id: string;
  task: HfTask;
  /** Task framing sent with the user's query for vision-chat models. */
  system?: string;
};

const RS_SYSTEM =
  "You are a remote-sensing image analyst. Answer only from what is visible in the supplied satellite/aerial image. " +
  "Be concrete about land cover (water, flooding, vegetation, cropland, built-up area, bare soil, cloud). " +
  "If the image is too ambiguous, low quality or does not contain the information asked for, reply starting with " +
  "'CANNOT DETERMINE:' followed by the reason. Never invent coordinates, dates, sensors or statistics. Answer in 2-4 sentences.";

/** Registry: specialist -> Hugging Face model. Replace any entry to swap the model. */
export const HF_MODELS: Record<SpecialistId, HfModelEntry> = {
  captioning: { id: "google/gemma-3-4b-it", task: "vision-chat", system: RS_SYSTEM },
  vqa: { id: "google/gemma-3-4b-it", task: "vision-chat", system: RS_SYSTEM },
  grounding: { id: "google/gemma-3-4b-it", task: "vision-chat", system: RS_SYSTEM },
  change: { id: "google/gemma-3-4b-it", task: "vision-chat", system: RS_SYSTEM },
  "optical-sar": { id: "google/gemma-3-4b-it", task: "vision-chat", system: RS_SYSTEM },
};

const CHAT_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const HF_INFERENCE = "https://router.huggingface.co/hf-inference/models";

function fail(entry: HfModelEntry, message: string): ModelOutcome {
  return { ok: false, modelId: entry.id, task: entry.task, message, reliable: false, scores: [], caption: null };
}

async function visionChat(entry: HfModelEntry, token: string, dataUrl: string, query: string) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: entry.id,
      messages: [
        { role: "system", content: entry.system ?? RS_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: query },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 320,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`Hugging Face returned ${res.status}. ${(await res.text()).slice(0, 240)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function classify(entry: HfModelEntry, token: string, dataUrl: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const res = await fetch(`${HF_INFERENCE}/${entry.id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: base64 }),
  });
  if (!res.ok) throw new Error(`Hugging Face returned ${res.status}. ${(await res.text()).slice(0, 240)}`);
  const arr = (await res.json()) as { label?: string; score?: number }[];
  return (Array.isArray(arr) ? arr : [])
    .map((r) => ({ label: r.label ?? "unknown", score: Number(r.score ?? 0) }))
    .sort((a, b) => b.score - a.score);
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

  try {
    if (entry.task === "vision-chat") {
      const text = await visionChat(entry, token, dataUrl, query.trim() || "Describe the land cover in this image.");
      if (!text) return fail(entry, "The model returned an empty response for this image.");
      const declined = /^cannot determine/i.test(text) || /\b(cannot|unable to) determine\b/i.test(text);
      return {
        ok: true,
        modelId: entry.id,
        task: entry.task,
        message: text,
        reliable: !declined,
        scores: [],
        caption: text,
      };
    }

    const scores = await classify(entry, token, dataUrl);
    if (!scores.length) return fail(entry, "The classification model returned no usable scores for this image.");
    const top = scores[0]!;
    const reliable = top.score >= 0.35;
    return {
      ok: true,
      modelId: entry.id,
      task: entry.task,
      message: reliable
        ? `${entry.id} classifies this scene as “${top.label}” (score ${top.score.toFixed(2)}).`
        : `${entry.id} produced no confident class for this image (top “${top.label}” at ${top.score.toFixed(2)}), so it cannot reliably answer this query.`,
      reliable,
      scores: scores.slice(0, 5),
      caption: null,
    };
  } catch (e) {
    return fail(entry, e instanceof Error ? e.message : "The Hugging Face request failed.");
  }
}
