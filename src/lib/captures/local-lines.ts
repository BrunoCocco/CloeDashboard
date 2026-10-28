/** Local, zero-network pixel candidate detector. A candidate is never a confirmed support/resistance. */
export type LocalLine = {
  y: number; x1: number; x2: number; pixels: number; coverage: number;
  kind: "horizontal-line"; confidence: "candidate"; price: null; source: "pixel-local";
};
export type RgbaFrame = { data: Uint8ClampedArray; width: number; height: number };
export function detectHorizontalLines({data,width,height}: RgbaFrame, options: {
  minFraction?: number; maxGap?: number; minContrast?: number; ignoreEdges?: number
} = {}): LocalLine[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 ||
      data.length !== width * height * 4) throw new Error("Invalid RGBA image");
  const { minFraction = 0.36, maxGap = 6, minContrast = 60, ignoreEdges = 0.07 } = options;
  const left = Math.floor(width * ignoreEdges), right = Math.ceil(width * (1 - ignoreEdges));
  const minRun = Math.ceil((right - left) * minFraction);
  const hits: { y: number; x1: number; x2: number; pixels: number; coverage: number }[] = [];
  const lum = (i: number) => (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  for (let y = 1; y < height - 1; y++) {
    let run = 0, gap = 0, from = -1, end = -1;
    const row: typeof hits = [];
    const push = () => {
      if (run >= minRun) row.push({ y, x1: from, x2: end, pixels: run, coverage: run / (end - from + 1) });
    };
    for (let x = left; x < right; x++) {
      const k = (y * width + x) * 4, up = k - width * 4, down = k + width * 4;
      const contrast = Math.min(Math.abs(lum(k) - lum(up)), Math.abs(lum(k) - lum(down)));
      const vivid = Math.max(data[k], data[k+1], data[k+2]) - Math.min(data[k], data[k+1], data[k+2]);
      const matched = data[k+3] > 200 && (contrast >= minContrast || (vivid > 95 && contrast > 25));
      if (matched) { if (from < 0) from = x; end = x; run++; gap = 0; }
      else if (from >= 0) { gap++; if (gap > maxGap) { push(); from = -1; run = 0; gap = 0; } }
    }
    if (from >= 0) push();
    hits.push(...row);
  }
  hits.sort((a,b) => b.pixels-a.pixels);
  const distinct: typeof hits = [];
  for (const hit of hits) if (!distinct.some(prev => Math.abs(prev.y-hit.y)<=2 &&
    Math.abs(prev.x1-hit.x1)<10 && Math.abs(prev.x2-hit.x2)<10)) distinct.push(hit);
  return distinct.sort((a,b) => a.y-b.y).slice(0,100).map(hit => ({
    ...hit, kind: "horizontal-line" as const, confidence: "candidate" as const,
    price: null, source: "pixel-local" as const
  }));
}
/** Browser-only reading of a screenshot. It NEVER transmits image pixels. */
export async function detectLocalLinesFromBlob(blob: Blob): Promise<LocalLine[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(8, Math.round(bitmap.width * scale));
    canvas.height = Math.max(8, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas local no disponible.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const {data,width,height} = ctx.getImageData(0,0,canvas.width,canvas.height);
    return detectHorizontalLines({data,width,height}).map(line=>({
      ...line, y: Math.round(line.y / scale), x1: Math.round(line.x1 / scale),
      x2: Math.round(line.x2 / scale)
    }));
  } finally { bitmap.close(); }
}
