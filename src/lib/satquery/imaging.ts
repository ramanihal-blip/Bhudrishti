/**
 * Browser-side raster front-end.
 * Decodes the upload, measures real pixel statistics, builds class masks and
 * bi-temporal difference maps. Nothing here is simulated: if a file cannot be
 * decoded (e.g. GeoTIFF), it is reported as undecodable instead of guessed.
 */
import type { ChangeStats, ImageFeatures, MaskInfo, PixelStats } from "./agent";

export type LoadedImage = {
  file: File;
  url: string;
  features: ImageFeatures;
  overlays: Record<string, string>; // maskKind -> dataURL
  /** Downscaled JPEG data URL sent to the server-side model adapter. */
  dataUrl: string | null;
};

const GRID = 256;

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m && m[1] ? m[1] : "unknown";
}

function drawToCanvas(img: HTMLImageElement, size = GRID) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  return { canvas: c, ctx, data: ctx.getImageData(0, 0, size, size) };
}

type Classifier = (r: number, g: number, b: number) => boolean;
export type MaskKind = "water" | "vegetation" | "builtup";

const isWater: Classifier = (r, g, b) => {
  const l = (r + g + b) / 3 / 255;
  return (b > r * 1.08 && l < 0.62) || l < 0.16;
};
const isVeg: Classifier = (r, g, b) => g > r * 1.06 && g > b * 1.06;
const isBuilt: Classifier = (r, g, b) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return (r + g + b) / 3 / 255 > 0.62 && (mx - mn) / 255 < 0.16;
};

const CLASSIFIERS: Record<MaskKind, Classifier> = {
  water: isWater,
  vegetation: isVeg,
  builtup: isBuilt,
};
const MASK_KINDS: MaskKind[] = ["water", "vegetation", "builtup"];

function computeStats(data: ImageData): PixelStats {
  const d = data.data;
  const n = data.width * data.height;
  let luma = 0;
  let colorful = 0;
  let water = 0;
  let veg = 0;
  let bright = 0;
  const lumaArr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4] ?? 0;
    const g = d[i * 4 + 1] ?? 0;
    const b = d[i * 4 + 2] ?? 0;
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lumaArr[i] = l;
    luma += l;
    colorful += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (isWater(r, g, b)) water++;
    if (isVeg(r, g, b)) veg++;
    if (isBuilt(r, g, b)) bright++;
  }
  let edges = 0;
  const w = data.width;
  for (let y = 1; y < data.height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (lumaArr[i + 1] ?? 0) - (lumaArr[i - 1] ?? 0);
      const gy = (lumaArr[i + w] ?? 0) - (lumaArr[i - w] ?? 0);
      if (Math.hypot(gx, gy) > 0.18) edges++;
    }
  }
  return {
    meanLuma: luma / n,
    colorfulness: colorful / n,
    waterRatio: water / n,
    vegRatio: veg / n,
    brightRatio: bright / n,
    edgeDensity: edges / n,
  };
}

function buildMask(img: HTMLImageElement, kind: MaskKind): { info: MaskInfo; url: string } {
  const size = 512;
  const { canvas, ctx } = drawToCanvas(img, size);
  const frame = ctx.getImageData(0, 0, size, size);
  const d = frame.data;
  let count = 0;
  let minX = size;
  let minY = size;
  let maxX = 0;
  let maxY = 0;
  const test = CLASSIFIERS[kind];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const r = d[i] ?? 0;
      const g = d[i + 1] ?? 0;
      const b = d[i + 2] ?? 0;
      if (test(r, g, b)) {
        count++;
        d[i] = 255;
        d[i + 1] = 60;
        d[i + 2] = 160;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      } else {
        d[i] = r * 0.45;
        d[i + 1] = g * 0.45;
        d[i + 2] = b * 0.45;
      }
    }
  }
  ctx.putImageData(frame, 0, 0);
  const coverage = count / (size * size);
  let bbox: MaskInfo["bbox"] = null;
  if (count > size * size * 0.002 && maxX > minX) {
    bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    ctx.strokeStyle = "#5ef2d6";
    ctx.lineWidth = 3;
    ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  }
  return { info: { coverage, bbox }, url: canvas.toDataURL("image/png") };
}

export async function loadImage(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  const format = extOf(file.name);
  const base: ImageFeatures = {
    id: `${file.name}-${file.size}`,
    name: file.name,
    format,
    mime: file.type || "unknown",
    width: null,
    height: null,
    sizeKB: Math.round(file.size / 1024),
    decodable: false,
    modality: "Unknown (not decodable in browser)",
    pixel: null,
    masks: null,
    georeferenced: false,
  };

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });

  if (!img) return { file, url, features: base, overlays: {} };

  const { data } = drawToCanvas(img, GRID);
  const pixel = computeStats(data);
  const overlays: Record<string, string> = {};
  const masks: Record<string, MaskInfo> = {};
  MASK_KINDS.forEach((k) => {
    const m = buildMask(img, k);
    masks[k] = m.info;
    overlays[k] = m.url;
  });

  return {
    file,
    url,
    overlays,
    features: {
      ...base,
      width: img.naturalWidth,
      height: img.naturalHeight,
      decodable: true,
      modality: pixel.colorfulness < 0.05 ? "SAR / single-band grayscale" : "Optical (RGB)",
      pixel,
      masks,
    },
  };
}

/** Bi-temporal difference on a common resampled grid. Returns the change map too. */
export function computeChange(
  a: HTMLImageElement,
  b: HTMLImageElement,
  featA: ImageFeatures,
  featB: ImageFeatures,
): { stats: ChangeStats; url: string } {
  const size = 512;
  const ca = drawToCanvas(a, size);
  const cb = drawToCanvas(b, size);
  const da = ca.data.data;
  const db = cb.data.data;
  const out = cb.ctx.createImageData(size, size);
  const o = out.data;
  let changed = 0;
  let minX = size;
  let minY = size;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const la = (0.299 * (da[i] ?? 0) + 0.587 * (da[i + 1] ?? 0) + 0.114 * (da[i + 2] ?? 0)) / 255;
      const lb = (0.299 * (db[i] ?? 0) + 0.587 * (db[i + 1] ?? 0) + 0.114 * (db[i + 2] ?? 0)) / 255;
      if (Math.abs(la - lb) > 0.14) {
        changed++;
        o[i] = 255;
        o[i + 1] = 70;
        o[i + 2] = 90;
        o[i + 3] = 235;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      } else {
        const g = lb * 90;
        o[i] = g;
        o[i + 1] = g;
        o[i + 2] = g + 20;
        o[i + 3] = 255;
      }
    }
  }
  cb.ctx.putImageData(out, 0, 0);
  let bbox: { x: number; y: number; w: number; h: number } | null = null;
  if (changed > size * size * 0.002 && maxX > minX) {
    bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    cb.ctx.strokeStyle = "#5ef2d6";
    cb.ctx.lineWidth = 3;
    cb.ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  }
  const pa = featA.pixel;
  const pb = featB.pixel;
  return {
    url: cb.canvas.toDataURL("image/png"),
    stats: {
      changedPercent: (changed / (size * size)) * 100,
      bbox,
      brightDelta: pa && pb ? pb.brightRatio - pa.brightRatio : 0,
      vegDelta: pa && pb ? pb.vegRatio - pa.vegRatio : 0,
      waterDelta: pa && pb ? pb.waterRatio - pa.waterRatio : 0,
    },
  };
}

export function elementFromUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });
}
