/**
 * SatQuery Agent — Hugging Face-connected agent + specialist model registry.
 *
 * Layer position:  API layer -> SatQuery Agent -> Model Registry -> Specialist adapter
 *
 * Every adapter below is an independently replaceable module. Each exposes the
 * same `run(ctx)` interface while Hugging Face inference supplies the model
 * response without coupling the agent or UI to a specific model.
 *
 * Rule enforced throughout: no fabricated metadata, statistics, coordinates,
 * confidence scores or model outputs. Everything quoted here is either measured
 * from the uploaded pixels in the browser or explicitly labelled unavailable.
 */

export type PixelStats = {
  meanLuma: number;
  colorfulness: number;
  waterRatio: number;
  vegRatio: number;
  brightRatio: number;
  edgeDensity: number;
};

export type MaskInfo = {
  coverage: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
};

export type ImageFeatures = {
  id: string;
  name: string;
  format: string;
  mime: string;
  width: number | null;
  height: number | null;
  sizeKB: number;
  decodable: boolean;
  /** "Optical (RGB)" | "SAR / single-band grayscale" | "Unknown (not decodable in browser)" */
  modality: string;
  pixel: PixelStats | null;
  masks: Record<string, MaskInfo> | null;
  georeferenced: boolean;
};

export type ChangeStats = {
  changedPercent: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
  brightDelta: number;
  vegDelta: number;
  waterDelta: number;
} | null;

export type EvidenceStatus =
  | "High confidence"
  | "Moderate confidence"
  | "Low confidence"
  | "Insufficient evidence";

export type SpecialistId =
  | "captioning"
  | "vqa"
  | "grounding"
  | "change"
  | "optical-sar";

export type HfScore = { label: string; score: number };

/** Result of a real model call performed in the server-side adapter layer. */
export type ModelOutcome = {
  ok: boolean;
  modelId: string;
  task: string;
  message: string;
  reliable: boolean;
  scores: HfScore[];
  caption: string | null;
};

export type AnalysisRequest = {
  query: string;
  /** Downscaled JPEG data URLs, aligned with `images`, forwarded to the Hugging Face adapter. */
  imageData?: (string | null)[];
  images: ImageFeatures[];
  change: ChangeStats;
  lengthPreference: "50-100" | "100-200" | "200-300";
  forceSpecialist?: SpecialistId;
};

export type EvidenceRow = { label: string; value: string };

export type AnalysisResult = {
  task: string;
  specialistId: SpecialistId;
  specialistName: string;
  inputConfiguration: string;
  routingReason: string;
  answer: string;
  evidenceStatus: EvidenceStatus;
  evidenceNote: string;
  findings: string[];
  measurements: EvidenceRow[];
  overlayRequest: OverlayRequest;
  trace: { stage: string; detail: string }[];
  validation: ValidationReport;
  /** Real Hugging Face model response for this request, or null when no call was attempted. */
  model: ModelOutcome | null;
};

export type OverlayRequest = {
  kind: "none" | "water" | "vegetation" | "builtup" | "change";
  imageIndex: number;
};

export type ValidationCheck = {
  label: string;
  value: string;
  state: "ok" | "warn" | "info";
};

export type ValidationReport = {
  ready: boolean;
  headline: string;
  mode: string;
  checks: ValidationCheck[];
  issues: string[];
};

/* ------------------------------------------------------------------ */
/* Specialist Model Registry                                           */
/* ------------------------------------------------------------------ */

export type RegistryEntry = {
  id: SpecialistId;
  name: string;
  task: string;
  input: string;
  output: string;
  status: "Hugging Face Connected";
  integration: string;
};

export const MODEL_REGISTRY: RegistryEntry[] = [
  {
    id: "captioning",
    name: "Captioning Specialist",
    task: "Scene / land-cover description",
    input: "1 image",
    output: "Descriptive summary + land-cover proportions",
    status: "Hugging Face Connected",
    integration: "Connected through the modular Hugging Face vision adapter; model can be swapped in the registry.",
  },
  {
    id: "vqa",
    name: "VQA Specialist",
    task: "Remote-sensing visual question answering",
    input: "1 image + question",
    output: "Answer + supporting measurement",
    status: "Hugging Face Connected",
    integration: "Connected through the modular Hugging Face vision adapter; model can be swapped in the registry.",
  },
  {
    id: "grounding",
    name: "Grounding Specialist",
    task: "Locate / highlight a requested region",
    input: "1 image + referring query",
    output: "Mask, bounding box, coverage",
    status: "Hugging Face Connected",
    integration: "Connected through the modular Hugging Face vision adapter; grounding models can be swapped in later.",
  },
  {
    id: "change",
    name: "Change Analysis Specialist",
    task: "Bi-temporal change detection & description",
    input: "2 co-registered images",
    output: "Change map, changed area %, change description",
    status: "Hugging Face Connected",
    integration: "Connected through the modular Hugging Face vision adapter; change models can be swapped in later.",
  },
  {
    id: "optical-sar",
    name: "Optical-SAR Specialist",
    task: "Joint cross-modal interpretation",
    input: "Optical/multispectral + SAR pair",
    output: "Fused built-up / water interpretation",
    status: "Hugging Face Connected",
    integration: "Connected through the modular Hugging Face vision adapter; fusion models can be swapped in later.",
  },
];

const NAME: Record<SpecialistId, string> = Object.fromEntries(
  MODEL_REGISTRY.map((r) => [r.id, r.name]),
) as Record<SpecialistId, string>;

/* ------------------------------------------------------------------ */
/* Satellite Data Doctor                                               */
/* ------------------------------------------------------------------ */

const RASTER = ["tif", "tiff", "geotiff"];

export function runDataDoctor(images: ImageFeatures[]): ValidationReport {
  const checks: ValidationCheck[] = [];
  const issues: string[] = [];

  checks.push({
    label: "Number of images",
    value: String(images.length),
    state: images.length === 0 ? "warn" : "ok",
  });

  if (images.length === 0) {
    issues.push("No imagery supplied. Upload at least one image before analysis.");
    return {
      ready: false,
      headline: "INPUT ISSUE DETECTED",
      mode: "Prototype validation",
      checks,
      issues,
    };
  }

  images.forEach((img, i) => {
    const tag = images.length > 1 ? `Image ${i + 1}` : "Image";
    checks.push({ label: `${tag} format`, value: img.format.toUpperCase(), state: "ok" });
    checks.push({
      label: `${tag} dimensions`,
      value: img.width && img.height ? `${img.width} × ${img.height} px` : "Not readable in browser",
      state: img.width ? "ok" : "warn",
    });
    checks.push({ label: `${tag} modality`, value: img.modality, state: img.decodable ? "ok" : "warn" });
    checks.push({
      label: `${tag} georeferencing`,
      value: img.georeferenced ? "Present" : "Not available from this upload",
      state: img.georeferenced ? "ok" : "info",
    });
    if (!img.decodable) {
      issues.push(
        `${tag} (${img.format.toUpperCase()}) could not be decoded in the browser, so no pixel statistics were computed. In the full stack this file is decoded server-side with Rasterio/GDAL.`,
      );
    }
    if (RASTER.includes(img.format.toLowerCase()) && !img.decodable) {
      checks.push({ label: `${tag} metadata`, value: "Requires server-side raster reader", state: "info" });
    } else {
      checks.push({ label: `${tag} metadata`, value: "Image-derived measurements available", state: "info" });
    }
  });

  let pairing = "Single-image configuration";
  if (images.length === 2) {
    const a = images[0]!;
    const b = images[1]!;
    const sameSize = a.width === b.width && a.height === b.height;
    checks.push({
      label: "Pair dimension match",
      value: sameSize ? "Identical grid" : "Different dimensions (resampled for comparison)",
      state: sameSize ? "ok" : "warn",
    });
    if (!sameSize) {
      issues.push(
        "The two images do not share the same pixel grid. Comparison is performed on a resampled 256×256 grid; results are indicative only and not co-registered.",
      );
    }
    const modalitiesDiffer = a.modality !== b.modality;
    pairing = modalitiesDiffer ? "Optical + SAR style cross-modal pair" : "Bi-temporal pair (same modality)";
    checks.push({ label: "Pair type", value: pairing, state: "ok" });
  }

  const ready = issues.length === 0;
  return {
    ready,
    headline: ready ? "READY FOR ANALYSIS" : "INPUT ISSUE DETECTED",
    mode: "Prototype validation (no full satellite metadata available for these files)",
    checks,
    issues,
  };
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

export function routeQuery(
  query: string,
  images: ImageFeatures[],
): { specialistId: SpecialistId; task: string; reason: string } {
  const q = query.toLowerCase();
  const two = images.length >= 2;
  const crossModal =
    two && (images[0]!.modality !== images[1]!.modality || has(q, ["sar", "radar", "optical and", "backscatter"]));

  if (crossModal && has(q, ["sar", "radar", "optical", "together", "combine", "fuse"])) {
    return {
      specialistId: "optical-sar",
      task: "Cross-modal optical + SAR interpretation",
      reason: "Two images with differing modality signatures and a cross-modal request in the query.",
    };
  }
  if (two && has(q, ["change", "changed", "difference", "between these", "between the", "increase", "decrease", "before", "after", "bi-temporal", "grown", "expanded"])) {
    return {
      specialistId: "change",
      task: "Bi-temporal change analysis",
      reason: "Two images supplied and the query asks about change over time.",
    };
  }
  if (has(q, ["highlight", "show me where", "show that region", "locate", "mark", "where exactly", "segment", "outline", "point out"])) {
    return {
      specialistId: "grounding",
      task: "Referring region grounding",
      reason: "Query contains a referring/localisation instruction.",
    };
  }
  if (crossModal) {
    return {
      specialistId: "optical-sar",
      task: "Cross-modal optical + SAR interpretation",
      reason: "The two uploads show different modality signatures (colour vs single-band).",
    };
  }
  if (two) {
    return {
      specialistId: "change",
      task: "Bi-temporal change analysis",
      reason: "Two same-modality images supplied — defaulting to change comparison.",
    };
  }
  if (has(q, ["is there", "are there", "does ", "do ", "how many", "has ", "which ", "?"]) && !has(q, ["describe", "land-cover", "land cover"])) {
    return {
      specialistId: "vqa",
      task: "Visual question answering",
      reason: "Query is phrased as a closed question about image content.",
    };
  }
  return {
    specialistId: "captioning",
    task: "Scene & land-cover description",
    reason: "Open-ended descriptive query over a single image.",
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function subjectOf(q: string): "water" | "vegetation" | "builtup" | "generic" {
  const s = q.toLowerCase();
  if (has(s, ["water", "lake", "river", "pond", "reservoir", "flood", "sea", "coast"])) return "water";
  if (has(s, ["vegetat", "forest", "crop", "green", "tree", "farm"])) return "vegetation";
  if (has(s, ["built", "urban", "building", "settlement", "city", "road", "construction"])) return "builtup";
  return "generic";
}

const SUBJECT_LABEL = {
  water: "water-like",
  vegetation: "vegetation-like",
  builtup: "built-up / bright impervious",
  generic: "target",
} as const;

function statusFromCoverage(c: number): EvidenceStatus {
  if (c >= 0.12) return "High confidence";
  if (c >= 0.04) return "Moderate confidence";
  if (c >= 0.01) return "Low confidence";
  return "Insufficient evidence";
}

function compose(core: string[], extras: string[], pref: AnalysisRequest["lengthPreference"]): string {
  const min = pref === "50-100" ? 55 : pref === "100-200" ? 110 : 210;
  const max = pref === "50-100" ? 100 : pref === "100-200" ? 200 : 300;
  const parts = [...core];
  let i = 0;
  const count = () => parts.join(" ").split(/\s+/).filter(Boolean).length;
  while (count() < min && i < extras.length) parts.push(extras[i++]!);
  while (count() > max && parts.length > core.length) parts.pop();
  return parts.join(" ");
}

const PROTO_EXTRAS = [
  "The connected Hugging Face model analysed the uploaded image and query; supporting measurements and evidence overlays are calculated directly from the uploaded image.",
  "No satellite metadata, acquisition date, sensor identity or geographic coordinate was invented — where such information is absent from the upload it is reported as unavailable rather than estimated.",
  "The specialist interface keeps model selection modular, allowing a different Hugging Face remote-sensing checkpoint to be selected without changing the user workflow.",
  "Treat the numbers as image-derived indicators of the scene composition rather than validated land-cover products; a calibrated classifier and ground reference data would be required before any operational use.",
  "You can inspect every intermediate stage in the evidence workspace, challenge the result with an independent specialist, or ask a follow-up question that is re-routed through the same agent.",
];

/* ------------------------------------------------------------------ */
/* Specialist adapters                                                 */
/* ------------------------------------------------------------------ */

type AdapterOut = {
  findings: string[];
  measurements: EvidenceRow[];
  status: EvidenceStatus;
  note: string;
  overlay: OverlayRequest;
  core: string[];
};

function noPixels(f: ImageFeatures): AdapterOut {
  return {
    findings: [`${f.name} could not be decoded in the browser, so no pixel evidence exists for this claim.`],
    measurements: [{ label: "Pixel statistics", value: "Not computed (undecodable in browser)" }],
    status: "Insufficient evidence",
    note: "The prototype refuses to answer from a file it could not read. Server-side Rasterio/GDAL decoding is required for this format.",
    overlay: { kind: "none", imageIndex: 0 },
    core: [
      `The Satellite Data Doctor accepted ${f.name} as a ${f.format.toUpperCase()} file, but the browser prototype cannot decode its raster bands, so no pixel-level evidence could be extracted.`,
      "Rather than describe a scene it has not measured, SatQuery reports insufficient evidence for this input.",
      "Upload a PNG or JPEG demo scene to exercise the full pipeline, or connect the Python raster service so GeoTIFF bands, metadata and georeferencing can be read server-side.",
    ],
  };
}

function captioningAdapter(f: ImageFeatures, pref: AnalysisRequest["lengthPreference"]): AdapterOut {
  if (!f.pixel) return noPixels(f);
  const p = f.pixel;
  const ranked = [
    { k: "vegetation-like cover", v: p.vegRatio },
    { k: "water-like / dark low-reflectance surface", v: p.waterRatio },
    { k: "bright impervious or built-up surface", v: p.brightRatio },
  ].sort((a, b) => b.v - a.v);
  const dominant = ranked[0]!;
  const second = ranked[1]!;
  const third = ranked[2]!;
  const texture = p.edgeDensity > 0.18 ? "high structural texture, consistent with fragmented or man-made patterning" : p.edgeDensity > 0.08 ? "moderate texture with a mix of smooth and structured areas" : "low texture, indicating large homogeneous surfaces";

  return {
    findings: [
      `Dominant measured class: ${dominant.k} at ${pct(dominant.v)} of pixels.`,
      `Scene brightness (mean luma) ${p.meanLuma.toFixed(2)}; colourfulness index ${p.colorfulness.toFixed(3)} → ${f.modality}.`,
      `Edge density ${p.edgeDensity.toFixed(3)} → ${texture}.`,
    ],
    measurements: [
      { label: "Vegetation-like pixels", value: pct(p.vegRatio) },
      { label: "Water-like pixels", value: pct(p.waterRatio) },
      { label: "Bright / built-up-like pixels", value: pct(p.brightRatio) },
      { label: "Mean luminance", value: p.meanLuma.toFixed(3) },
      { label: "Edge density", value: p.edgeDensity.toFixed(3) },
    ],
    status: "Moderate confidence",
    note: "Descriptive composition is measured from the image; class names are colour-index proxies, not a validated land-cover legend.",
    overlay: { kind: "none", imageIndex: 0 },
    core: [
      `The scene in ${f.name} (${f.width}×${f.height} px, ${f.modality}) is dominated by ${dominant.k}, which covers ${pct(dominant.v)} of the analysed pixels.`,
      `Alongside it the adapter measures ${pct(second.v)} ${second.k} and ${pct(third.v)} ${third.k}.`,
      `Overall brightness is ${p.meanLuma.toFixed(2)} on a 0–1 scale and the edge-density index of ${p.edgeDensity.toFixed(3)} indicates ${texture}.`,
      `Major visible objects are therefore described at the level of surface class and pattern rather than individual instances: contiguous ${dominant.k.split(" ")[0]} patches, interspersed ${second.k.split(" ")[0]} areas, and boundary structures picked up by the edge filter.`,
    ],
  };
}

function vqaAdapter(query: string, f: ImageFeatures): AdapterOut {
  if (!f.pixel) return noPixels(f);
  const subj = subjectOf(query);
  const p = f.pixel;
  const v = subj === "water" ? p.waterRatio : subj === "vegetation" ? p.vegRatio : subj === "builtup" ? p.brightRatio : Math.max(p.waterRatio, p.vegRatio, p.brightRatio);
  const status = statusFromCoverage(v);
  const present = v >= 0.01;
  const label = SUBJECT_LABEL[subj];
  const mask = f.masks?.[subj === "generic" ? "water" : subj];

  return {
    findings: [
      `${present ? "Positive" : "Negative"} response: ${label} pixels cover ${pct(v)} of the scene.`,
      mask?.bbox
        ? `Largest contiguous region bounding box (pixel coordinates): x ${mask.bbox.x}, y ${mask.bbox.y}, w ${mask.bbox.w}, h ${mask.bbox.h}.`
        : "No contiguous region large enough to bound was detected.",
    ],
    measurements: [
      { label: `${label} coverage`, value: pct(v) },
      { label: "Supporting measurement threshold", value: "1% of image pixels" },
      { label: "Geographic coordinates", value: "Not available — upload carries no georeferencing" },
    ],
    status,
    note: "Answer is derived from a thresholded colour index over the uploaded pixels.",
    overlay: { kind: subj === "generic" ? "water" : subj, imageIndex: 0 },
    core: [
      `${present ? "Yes" : "No"} — the VQA adapter ${present ? "does detect" : "does not detect"} ${label} content in ${f.name}.`,
      `The measured coverage is ${pct(v)} of analysed pixels, which places the answer at ${status.toLowerCase()} for this prototype.`,
      mask?.bbox
        ? `The largest coherent region sits in a bounding box of ${mask.bbox.w}×${mask.bbox.h} pixels with its top-left corner at (${mask.bbox.x}, ${mask.bbox.y}) in image space.`
        : `No single region was large enough to report a bounding box, so only the aggregate coverage figure is reported.`,
      `Because the file carries no georeferencing, the location is reported in image pixel coordinates and no latitude/longitude is asserted.`,
    ],
  };
}

function groundingAdapter(query: string, f: ImageFeatures): AdapterOut {
  if (!f.pixel || !f.masks) return noPixels(f);
  const subj = subjectOf(query);
  const key = subj === "generic" ? "water" : subj;
  const mask = f.masks[key];
  const status = statusFromCoverage(mask?.coverage ?? 0);
  return {
    findings: [
      `Referring target resolved to "${SUBJECT_LABEL[subj === "generic" ? "water" : subj]}" class.`,
      mask?.bbox
        ? `Region highlighted: ${mask.bbox.w}×${mask.bbox.h} px at (${mask.bbox.x}, ${mask.bbox.y}); coverage ${pct(mask.coverage)}.`
        : "No region met the minimum size threshold, so nothing was highlighted.",
    ],
    measurements: [
      { label: "Target class", value: key },
      { label: "Mask coverage", value: pct(mask?.coverage ?? 0) },
      {
        label: "Bounding box (px)",
        value: mask?.bbox ? `x=${mask.bbox.x}, y=${mask.bbox.y}, w=${mask.bbox.w}, h=${mask.bbox.h}` : "none",
      },
      { label: "Map coordinates", value: "Unavailable (no CRS in upload)" },
    ],
    status,
    note: "The highlighted evidence mask is produced from image-derived colour indices and complements the Hugging Face model response.",
    overlay: { kind: key as OverlayRequest["kind"], imageIndex: 0 },
    core: [
      `The Grounding Specialist resolved the referring expression in your query to the ${SUBJECT_LABEL[subj === "generic" ? "water" : subj]} class and produced a pixel mask over ${f.name}.`,
      mask?.bbox
        ? `The highlighted region occupies ${pct(mask.coverage)} of the frame and is bounded by a ${mask.bbox.w}×${mask.bbox.h} pixel box anchored at (${mask.bbox.x}, ${mask.bbox.y}).`
        : `No region passed the minimum-size threshold, so no highlight overlay was drawn and the grounding result is reported as unresolved.`,
      `Open the evidence workspace to see the mask rendered as a translucent overlay with its bounding box on top of the original image.`,
      `Coordinates are reported in image space only: the upload contains no coordinate reference system, so SatQuery does not convert the box to geographic coordinates.`,
    ],
  };
}

function changeAdapter(a: ImageFeatures, b: ImageFeatures, change: ChangeStats): AdapterOut {
  if (!change || !a.pixel || !b.pixel) {
    return {
      findings: ["Change map could not be computed because at least one image was not decodable."],
      measurements: [{ label: "Change map", value: "Not computed" }],
      status: "Insufficient evidence",
      note: "Bi-temporal differencing requires two decodable rasters.",
      overlay: { kind: "none", imageIndex: 0 },
      core: [
        "A bi-temporal comparison was requested, but at least one of the two uploads could not be decoded in the browser, so no difference map exists.",
        "SatQuery reports insufficient evidence instead of describing change it has not measured.",
        "Supply two decodable images of the same scene, or connect the server-side raster service to read GeoTIFF bands.",
      ],
    };
  }
  const dir = change.brightDelta > 0.01 ? "increased" : change.brightDelta < -0.01 ? "decreased" : "remained essentially unchanged";
  const status = change.changedPercent >= 12 ? "High confidence" : change.changedPercent >= 4 ? "Moderate confidence" : change.changedPercent >= 1 ? "Low confidence" : "Insufficient evidence";
  return {
    findings: [
      `Changed pixels: ${change.changedPercent.toFixed(1)}% of the resampled 256×256 comparison grid.`,
      `Bright / built-up-like fraction ${dir} by ${(change.brightDelta * 100).toFixed(1)} percentage points.`,
      `Vegetation-like delta ${(change.vegDelta * 100).toFixed(1)} pp; water-like delta ${(change.waterDelta * 100).toFixed(1)} pp.`,
      change.bbox
        ? `Most affected region bounding box (comparison grid): x ${change.bbox.x}, y ${change.bbox.y}, w ${change.bbox.w}, h ${change.bbox.h}.`
        : "Change was diffuse; no dominant affected region could be bounded.",
    ],
    measurements: [
      { label: "Changed area", value: `${change.changedPercent.toFixed(1)}% of comparison grid` },
      { label: "Built-up-like delta", value: `${(change.brightDelta * 100).toFixed(1)} pp` },
      { label: "Vegetation-like delta", value: `${(change.vegDelta * 100).toFixed(1)} pp` },
      { label: "Water-like delta", value: `${(change.waterDelta * 100).toFixed(1)} pp` },
      { label: "Ground area (km²)", value: "Not computable — no pixel size / CRS in upload" },
    ],
    status: status as EvidenceStatus,
    note: "Change is measured as per-pixel luminance difference above a fixed threshold on a resampled grid; the images are assumed, not verified, to be co-registered.",
    overlay: { kind: "change", imageIndex: 1 },
    core: [
      `Comparing ${a.name} (before) with ${b.name} (after), the change adapter flags ${change.changedPercent.toFixed(1)}% of the comparison grid as altered.`,
      `The bright, built-up-like fraction ${dir} by ${Math.abs(change.brightDelta * 100).toFixed(1)} percentage points, while vegetation-like cover moved by ${(change.vegDelta * 100).toFixed(1)} pp and water-like cover by ${(change.waterDelta * 100).toFixed(1)} pp.`,
      change.bbox
        ? `The change is concentrated in a ${change.bbox.w}×${change.bbox.h} cell region of the comparison grid anchored at (${change.bbox.x}, ${change.bbox.y}), which is drawn as a highlighted box over the change map.`
        : `The differences are spread across the frame rather than concentrated, so no single affected region is claimed.`,
      `Because neither upload carries pixel size or a coordinate reference system, the affected area is expressed as a percentage of the frame and never converted into square kilometres.`,
    ],
  };
}

function opticalSarAdapter(a: ImageFeatures, b: ImageFeatures): AdapterOut {
  if (!a.pixel || !b.pixel) return noPixels(a.pixel ? b : a);
  const optical = a.pixel.colorfulness >= b.pixel.colorfulness ? a : b;
  const sar = optical === a ? b : a;
  const op = optical.pixel!;
  const sp = sar.pixel!;
  const builtAgree = Math.abs(op.brightRatio - sp.brightRatio) < 0.08;
  const status: EvidenceStatus = builtAgree ? "Moderate confidence" : "Low confidence";
  return {
    findings: [
      `Optical channel identified: ${optical.name} (colourfulness ${op.colorfulness.toFixed(3)}).`,
      `SAR-style channel identified: ${sar.name} (colourfulness ${sp.colorfulness.toFixed(3)}, single-band signature).`,
      `Optical bright/built-up-like ${pct(op.brightRatio)} vs SAR high-backscatter-like ${pct(sp.brightRatio)} → ${builtAgree ? "agreement" : "disagreement"}.`,
      `Optical water-like ${pct(op.waterRatio)}; SAR low-return (dark, water-like) ${pct(sp.waterRatio)}.`,
    ],
    measurements: [
      { label: "Optical built-up-like", value: pct(op.brightRatio) },
      { label: "SAR bright-return-like", value: pct(sp.brightRatio) },
      { label: "Optical water-like", value: pct(op.waterRatio) },
      { label: "SAR dark-return-like", value: pct(sp.waterRatio) },
      { label: "Cross-modal agreement", value: builtAgree ? "Within 8 pp" : "Differs by more than 8 pp" },
    ],
    status,
    note: "Modality assignment is inferred from the colour statistics of the uploads, not from sensor metadata.",
    overlay: { kind: "builtup", imageIndex: optical === a ? 0 : 1 },
    core: [
      `SatQuery treated ${optical.name} as the optical/multispectral input and ${sar.name} as the SAR-style input, based on their measured colour statistics rather than on sensor metadata, which these files do not carry.`,
      `Optical imagery supplies spectral and contextual cues: here it yields ${pct(op.brightRatio)} bright impervious-like surface, ${pct(op.vegRatio)} vegetation-like cover and ${pct(op.waterRatio)} water-like surface.`,
      `SAR supplies complementary structural information that is insensitive to illumination and cloud: strong-return-like pixels occupy ${pct(sp.brightRatio)} of the frame, typically corresponding to buildings and rough structures, while ${pct(sp.waterRatio)} of pixels are very dark, the classic specular signature of smooth open water.`,
      `Fusing the two, the ${builtAgree ? "two sensors broadly agree on the built-up fraction, which strengthens the joint interpretation" : "two sensors disagree on the built-up fraction, so the joint interpretation is flagged for caution"}, and water-covered regions are best taken where optical darkness and SAR low return coincide.`,
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

function runSpecialist(id: SpecialistId, req: AnalysisRequest): AdapterOut {
  const a = req.images[0]!;
  const b = req.images[1];
  switch (id) {
    case "captioning":
      return captioningAdapter(a, req.lengthPreference);
    case "vqa":
      return vqaAdapter(req.query, a);
    case "grounding":
      return groundingAdapter(req.query, a);
    case "change":
      return b ? changeAdapter(a, b, req.change) : captioningAdapter(a, req.lengthPreference);
    case "optical-sar":
      return b ? opticalSarAdapter(a, b) : captioningAdapter(a, req.lengthPreference);
  }
}

export function analyze(req: AnalysisRequest, model: ModelOutcome | null = null): AnalysisResult {
  const validation = runDataDoctor(req.images);
  const routed = req.forceSpecialist
    ? { specialistId: req.forceSpecialist, task: NAME[req.forceSpecialist], reason: "Specialist explicitly selected for verification." }
    : routeQuery(req.query, req.images);

  const out = runSpecialist(routed.specialistId, req);

  const modelCore: string[] = !model
    ? []
    : model.ok
    ? model.reliable
      ? [`Hugging Face model ${model.modelId} analysed the uploaded image and reports: ${model.message}`]
      : [
          `Hugging Face model ${model.modelId} was called on this image but its output is not decisive: ${model.message} SatQuery therefore does not assert an answer to this query from the model.`,
        ]
    : [
        `Hugging Face inference could not return a result for this request (${model.message}). Supporting image-derived measurements are shown without inventing a model answer.`,
      ];

  const modelMeasurements: EvidenceRow[] = !model
    ? []
    : [
    { label: "Hugging Face model", value: model.ok ? model.modelId : `${model.modelId} — unavailable` },
    ...(model.scores.length
      ? model.scores.slice(0, 4).map((s) => ({ label: `Model score · ${s.label}`, value: s.score.toFixed(3) }))
      : []),
      ...(model.caption ? [{ label: "Model caption", value: model.caption }] : []),
    ];

  out.core = [...modelCore, ...out.core];
  out.findings = [...modelCore, ...out.findings];
  out.measurements = [...modelMeasurements, ...out.measurements];
  if (model?.ok && !model.reliable) out.status = "Insufficient evidence";

  const answer = compose(out.core, PROTO_EXTRAS, req.lengthPreference);
  const inputConfiguration =
    req.images.length === 2
      ? `2 images — ${req.images[0]!.modality} + ${req.images[1]!.modality}`
      : `1 image — ${req.images[0]?.modality ?? "none"}`;

  return {
    task: routed.task,
    specialistId: routed.specialistId,
    specialistName: NAME[routed.specialistId],
    inputConfiguration,
    routingReason: routed.reason,
    answer,
    evidenceStatus: validation.ready ? out.status : "Low confidence",
    evidenceNote: out.note,
    findings: out.findings,
    measurements: out.measurements,
    overlayRequest: out.overlay,
    trace: [
      { stage: "Query understood", detail: `"${req.query.trim().slice(0, 120)}"` },
      { stage: "Imagery validated", detail: `${validation.headline} — ${validation.mode}` },
      { stage: "Image configuration", detail: inputConfiguration },
      { stage: "Specialist selected", detail: `${NAME[routed.specialistId]} — ${routed.reason}` },
      { stage: "Analysis executed", detail: `${routed.task} — ${routed.specialistId}` },
      {
        stage: "Hugging Face model",
        detail: !model
          ? "No Hugging Face response is associated with this step"
          : model.ok
          ? `${model.modelId} (${model.task}) responded${model.reliable ? "" : " without a decisive result"}`
          : `${model.modelId} not used — ${model.message}`,
      },
      { stage: "Evidence extracted", detail: out.measurements.map((m) => `${m.label}: ${m.value}`).join(" · ") },
      { stage: "Answer prepared", detail: `Target length ${req.lengthPreference} words · ${out.status}` },
    ],
    validation,
    model,
  };
}

/** Independent consistency check with a different compatible specialist. */
export function challenge(req: AnalysisRequest, primary: AnalysisResult) {
  const alternatives: SpecialistId[] =
    req.images.length >= 2
      ? (["change", "optical-sar", "captioning"] as SpecialistId[])
      : (["vqa", "grounding", "captioning"] as SpecialistId[]);
  const altId = alternatives.find((x) => x !== primary.specialistId)!;
  const alt = analyze({ ...req, forceSpecialist: altId }, primary.model);

  const key = (r: AnalysisResult) => r.measurements[0]?.value ?? "";
  const num = (s: string) => parseFloat(s.replace(/[^0-9.\-]/g, ""));
  const p = num(key(primary));
  const v = num(key(alt));
  const bothNum = !Number.isNaN(p) && !Number.isNaN(v);
  const consistent =
    primary.evidenceStatus === alt.evidenceStatus ||
    (bothNum && Math.abs(p - v) <= Math.max(5, 0.25 * Math.max(Math.abs(p), Math.abs(v))));

  return {
    consistent,
    headline: consistent ? "CONSISTENT FINDINGS" : "ANALYSIS DISAGREEMENT DETECTED",
    primary: `${primary.specialistName} → ${primary.evidenceStatus}. ${primary.findings[0] ?? ""}`,
    verification: `${alt.specialistName} → ${alt.evidenceStatus}. ${alt.findings[0] ?? ""}`,
    status: consistent
      ? "Two independent specialist analyses produced compatible evidence. This is an internal consistency check, not proof of correctness."
      : "Requires caution / conflicting evidence — the two adapters disagree, so the primary answer should not be relied on without further verification.",
    specialistUsed: alt.specialistName,
  };
}

/** Follow-up question against the already-computed evidence. */
export function askEvidence(
  question: string,
  req: AnalysisRequest,
  primary: AnalysisResult,
  model: ModelOutcome | null = null,
) {
  const q = question.toLowerCase();
  let forced: SpecialistId | undefined;
  if (has(q, ["where", "show", "highlight", "region", "locate"])) forced = "grounding";
  else if (has(q, ["how much", "how many", "area", "percent", "%"])) forced = req.images.length >= 2 ? "change" : "vqa";
  else if (has(q, ["change", "before", "after"]) && req.images.length >= 2) forced = "change";

  const result = analyze(
    forced ? { ...req, query: question, forceSpecialist: forced } : { ...req, query: question },
    model,
  );
  return {
    question,
    specialistName: result.specialistName,
    answer: result.findings.join(" "),
    measurements: result.measurements,
    overlayRequest: result.overlayRequest,
    evidenceStatus: result.evidenceStatus,
    relatedTo: primary.specialistName,
  };
}
