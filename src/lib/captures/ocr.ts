import type { Worker } from "tesseract.js";
import {
  makePriceLabel,
  findBadgeRegions,
  mergeLabelEvidence,
  type LabelScan,
  type PriceLabel,
} from "./price-labels";
async function recognizeLocal(
  image: Blob,
  signal: AbortSignal,
  positional = false,
  extras: Blob[] = [],
) {
  let worker: Worker | null = null;
  let finished = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let rejectCancelled: ((reason: Error) => void) | undefined;
  const cancel = () => {
    rejectCancelled?.(new Error("Lectura OCR cancelada."));
  };
  const cancelled = new Promise<never>((_, reject) => {
    rejectCancelled = reject;
    timeout = setTimeout(
      () =>
        reject(
          new Error(
            "La lectura superó 90 segundos. Podés continuar con revisión manual.",
          ),
        ),
      90000,
    );
    signal.addEventListener("abort", cancel, { once: true });
  });
  const work = async () => {
    const { createWorker } = await import("tesseract.js");
    if (signal.aborted || finished) throw new Error("Lectura OCR cancelada.");
    const created = await createWorker("eng", 1, {
      workerPath:
        "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0",
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
    });
    if (signal.aborted || finished) {
      await created.terminate();
      throw new Error("Lectura OCR cancelada.");
    }
    worker = created;
    if (positional)
      await created.setParameters({
        tessedit_pageseg_mode: "11" as import("tesseract.js").PSM,
      });
    const primary = (
      await created.recognize(image, {}, { text: true, blocks: positional })
    ).data;
    const extra = [];
    if (extras.length)
      await created.setParameters({
        tessedit_pageseg_mode: "7" as import("tesseract.js").PSM,
      });
    for (const blob of extras) {
      if (signal.aborted || finished) throw new Error("Lectura OCR cancelada.");
      extra.push(
        (await created.recognize(blob, {}, { text: true, blocks: true })).data,
      );
    }
    return { primary, extra };
  };
  try {
    if (signal.aborted) throw new Error("Lectura OCR cancelada.");
    return await Promise.race([work(), cancelled]);
  } finally {
    finished = true;
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    if (worker) {
      void (worker as Worker).terminate().catch(() => {});
    }
  }
}

export async function readCaptureText(
  image: Blob,
  signal: AbortSignal,
): Promise<string> {
  return (await recognizeLocal(image, signal)).primary.text.slice(0, 100000);
}
/** Only model/worker assets are downloaded. Image pixels never leave this browser. */
export async function readPriceLabels(
  image: Blob,
  width: number,
  height: number,
  signal: AbortSignal,
  lines: { x2: number; y: number }[] = [],
): Promise<LabelScan> {
  const bitmap = await createImageBitmap(image);
  const left = Math.floor(width * 0.6),
    cropWidth = width - left;
  const scale = Math.min(2, 1600 / cropWidth, 4000 / height);
  const outWidth = Math.round(cropWidth * scale),
    outHeight = Math.round(height * scale);
  let blob: Blob;
  const badges: { blob: Blob; x0: number; y0: number; pad: number }[] = [];
  const toBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No se pudo preparar el eje.")),
        "image/png",
      ),
    );
  try {
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas OCR no disponible.");
    context.drawImage(
      bitmap,
      left,
      0,
      cropWidth,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    blob = await toBlob(canvas);
    const sx = outWidth / cropWidth,
      sy = outHeight / height;
    const frame = context.getImageData(0, 0, outWidth, outHeight);
    for (const box of findBadgeRegions(
      { data: frame.data, width: outWidth, height: outHeight },
      lines.map((l) => ({ x2: (l.x2 - left) * sx, y: l.y * sy })),
      sx,
      sy,
    )) {
      box.x0 += Math.round(2 * sx);
      box.x1 -= Math.round(2 * sx);
      box.y0 += Math.round(2 * sy);
      box.y1 -= Math.round(2 * sy);
      const pad = 12,
        bw = box.x1 - box.x0,
        bh = box.y1 - box.y0;
      const badge = document.createElement("canvas");
      badge.width = bw + pad * 2;
      badge.height = bh + pad * 2;
      const ctx = badge.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, badge.width, badge.height);
      const pixels = ctx.createImageData(bw, bh);
      const ref =
        (Math.min(outHeight - 1, box.y0 + 3) * outWidth +
          Math.floor((box.x0 + box.x1) / 2)) *
        4;
      const bg = [frame.data[ref], frame.data[ref + 1], frame.data[ref + 2]];
      for (let yy = 0; yy < bh; yy++)
        for (let xx = 0; xx < bw; xx++) {
          const source = ((box.y0 + yy) * outWidth + box.x0 + xx) * 4,
            target = (yy * bw + xx) * 4;
          const diff = Math.max(
            ...bg.map((value, ch) => Math.abs(frame.data[source + ch] - value)),
          );
          const value = diff > 65 ? 0 : 255;
          pixels.data[target] =
            pixels.data[target + 1] =
            pixels.data[target + 2] =
              value;
          pixels.data[target + 3] = 255;
        }
      ctx.putImageData(pixels, pad, pad);
      badges.push({ blob: await toBlob(badge), x0: box.x0, y0: box.y0, pad });
    }
  } finally {
    bitmap.close();
  }
  if (signal.aborted) throw new Error("Lectura cancelada.");
  const result = await recognizeLocal(
    blob,
    signal,
    true,
    badges.map((b) => b.blob),
  );
  const data = result.primary;
  const labels: PriceLabel[] = [];
  for (const block of data.blocks ?? [])
    for (const paragraph of block.paragraphs)
      for (const line of paragraph.lines)
        for (const word of line.words) {
          if (labels.length >= 300) break;
          const b = word.bbox;
          labels.push(
            makePriceLabel(
              word.text,
              word.confidence,
              {
                x0: left + (b.x0 * cropWidth) / outWidth,
                y0: (b.y0 * height) / outHeight,
                x1: Math.min(width, left + (b.x1 * cropWidth) / outWidth),
                y1: Math.min(height, (b.y1 * height) / outHeight),
              },
              `ocr-${labels.length}`,
            ),
          );
        }
  result.extra.forEach((page, index) => {
    const badge = badges[index];
    for (const block of page.blocks ?? [])
      for (const paragraph of block.paragraphs)
        for (const line of paragraph.lines)
          for (const word of line.words) {
            if (labels.length >= 300) break;
            const b = word.bbox;
            const label = makePriceLabel(
              word.text,
              word.confidence,
              {
                x0: Math.max(
                  left,
                  left + ((badge.x0 + b.x0 - badge.pad) * cropWidth) / outWidth,
                ),
                y0: Math.max(
                  0,
                  ((badge.y0 + b.y0 - badge.pad) * height) / outHeight,
                ),
                x1: Math.min(
                  width,
                  left + ((badge.x0 + b.x1 - badge.pad) * cropWidth) / outWidth,
                ),
                y1: Math.min(
                  height,
                  ((badge.y0 + b.y1 - badge.pad) * height) / outHeight,
                ),
              },
              `ocr-${labels.length}`,
            );
            mergeLabelEvidence(labels, { ...label, method: "color-badge" });
          }
  });
  return {
    version: 1,
    crop: { x0: left, y0: 0, x1: width, y1: height },
    labels,
    text: [data.text, ...result.extra.map((page) => page.text)]
      .join("\n")
      .slice(0, 30000),
  };
}
