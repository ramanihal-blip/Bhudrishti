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

export type LengthPreference = "50-100" | "100-200" | "200-300";

const LENGTH_RULES: Record<LengthPreference, string> = {
  "50-100":
    "Write 50-100 words. Give the direct answer plus the single strongest piece of visual evidence. No preamble, no lists.",
  "100-200":
    "Write 100-200 words. Give the direct answer, two or three specific visual observations that support it, and a short note on how certain you are.",
  "200-300":
    "Write 200-300 words. Give the direct answer, then explain your reasoning step by step, describe several distinct visual cues (colour, texture, pattern, shape, spatial arrangement, relative extent, location within the frame), note anything that limits certainty, and close with an explicit confidence judgement.",
};

const MAX_TOKENS: Record<LengthPreference, number> = {
  "50-100": 220,
  "100-200": 420,
  "200-300": 700,
};

/** Question-type cues so different questions get different analytical framing. */
const FOCUS_RULES: { test: RegExp; focus: string }[] = [
  {
    test: /\b(land ?cover|land ?use|features? (are )?visible|what (do you |can you )?see|describe)\b/i,
    focus:
      "Focus on identifying and separating land-cover classes: vegetation, water bodies, built-up/urban fabric, bare land or soil, agricultural or cropland parcels. Say roughly where each sits in the frame and how dominant it is.",
  },
  {
    test: /\b(urban (expansion|growth|development)|build|construct|settlement|suitab|infrastructure)\b/i,
    focus:
      "Focus on development suitability: terrain and slope, how much open or undeveloped land exists, environmental constraints such as water bodies or wetlands, apparent accessibility (roads, existing corridors), and the pattern of existing development.",
  },
  {
    test: /\b(risk|hazard|flood|erosion|deforest|landslide|slope|drought|degrad|damage|pollut)\b/i,
    focus:
      "Focus on visible environmental risk indicators: standing or encroaching water and flooding, bare eroded surfaces or gullying, cleared or thinning forest, unstable or steep slopes, dry or stressed vegetation, and water-related stress. State which risks are visible and which cannot be judged from the image.",
  },
  {
    test: /\b(vegetat|forest|canopy|green|crop|ndvi|biomass|density)\b/i,
    focus:
      "Focus on vegetation: how much of the frame is vegetated, how the vegetation is distributed (continuous, patchy, linear, field parcels), apparent density and vigour differences, and where the sparsest and densest areas lie.",
  },
  {
    test: /\b(water|lake|river|pond|reservoir|coast|wetland)\b/i,
    focus:
      "Focus on water: presence, extent, shape and edges of any water body, turbidity or colour differences, and whether boundaries look natural or engineered.",
  },
  {
    test: /\b(chang|before|after|difference|increas|decreas|compare)\b/i,
    focus:
      "Focus on change: what appears different, where in the frame it occurs, the likely nature of the change (clearing, construction, inundation, regrowth), and its approximate extent relative to the scene.",
  },
  {
    test: /\b(highlight|where exactly|locate|show (me )?(the|that)|which part|bounding)\b/i,
    focus:
      "Focus on location: describe precisely where the requested feature sits using frame-relative terms (upper-left, centre, along the southern edge), its shape and its approximate share of the image.",
  },
];

function buildSystem(query: string, length: LengthPreference): string {
  const focus =
    FOCUS_RULES.find((r) => r.test.test(query))?.focus ??
    "Focus tightly on exactly what the question asks. Do not drift into a general description of the scene.";

  return [
    "You are a remote-sensing image analyst.",
    "ANSWER THE USER'S QUESTION FIRST. The image is evidence for that question, not the subject of a caption.",
    "Never produce a generic scene caption and never reuse stock phrasing between analyses.",
    focus,
    "Structure: (1) a direct answer to the question in the first sentence, (2) the specific visual evidence you based it on, (3) why that evidence supports your conclusion, (4) your confidence and any limitation.",
    "Only state what is visible in the supplied image. Never invent coordinates, dates, sensors, area figures or statistics.",
    "If the image genuinely cannot answer the question, reply starting with 'CANNOT DETERMINE:' followed by the reason.",
    LENGTH_RULES[length],
  ].join(" ");
}

/** Registry: specialist -> Hugging Face model. Replace any entry to swap the model. */
export const HF_MODELS: Record<SpecialistId, HfModelEntry> = {
  captioning: { id: "google/gemma-3-4b-it", task: "vision-chat" },
  vqa: { id: "google/gemma-3-4b-it", task: "vision-chat" },
  grounding: { id: "google/gemma-3-4b-it", task: "vision-chat" },
  change: { id: "google/gemma-3-4b-it", task: "vision-chat" },
  "optical-sar": { id: "google/gemma-3-4b-it", task: "vision-chat" },
};

const CHAT_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const HF_INFERENCE = "https://router.huggingface.co/hf-inference/models";

function fail(entry: HfModelEntry, message: string): ModelOutcome {
  return { ok: false, modelId: entry.id, task: entry.task, message, reliable: false, scores: [], caption: null };
}

async function visionChat(
  entry: HfModelEntry,
  token: string,
  dataUrl: string,
  query: string,
  length: LengthPreference,
) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: entry.id,
      messages: [
        { role: "system", content: entry.system ?? buildSystem(query, length) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Question: ${query}\n\nAnswer this exact question using the image below. ${LENGTH_RULES[length]}`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: MAX_TOKENS[length],
      temperature: 0.65,
      top_p: 0.9,
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
  lengthPreference: LengthPreference = "100-200",
): Promise<ModelOutcome> {
  const entry = HF_MODELS[specialistId];
  const token = process.env["HUGGINGFACE_API_TOKEN"];

  if (!token) return fail(entry, "Hugging Face token is not configured on the server, so no model was called.");
  if (!dataUrl) return fail(entry, "No decodable image pixels were available to send to the model.");

  try {
    if (entry.task === "vision-chat") {
      const text = await visionChat(
        entry,
        token,
        dataUrl,
        query.trim() || "Describe the land cover in this image.",
        lengthPreference,
      );
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
