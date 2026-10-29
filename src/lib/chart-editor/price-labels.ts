/** OCR evidence only. Matching never establishes support/resistance or a verified quote. */
export type LabelBox = { x0: number; y0: number; x1: number; y1: number };
export type PriceLabel = {
  id: string;
  origin: "ocr-label";
  method?: "sidebar" | "color-badge";
  raw: string;
  confidence: number;
  bbox: LabelBox;
  price: number | null;
  issue: string | null;
};
export type LabelScan = {
  version: 1;
  crop: LabelBox;
  labels: PriceLabel[];
  text: string;
};
export function parseLabelPrice(raw: string): {
  price: number | null;
  issue: string | null;
} {
  const s = raw.trim();
  const invalid = {
    price: null,
    issue: "No es una etiqueta de precio inequívoca.",
  };
  if (!/^\d+(?:[.,]\d+)*$/.test(s)) return invalid;
  let normalized = s;
  if (s.includes(".") && s.includes(",")) {
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const group = decimal === "." ? "," : ".";
    const parts = s.split(decimal);
    if (
      parts.length !== 2 ||
      !parts[1] ||
      !new RegExp(`^\\d{1,3}(?:\\${group}\\d{3})+$`).test(parts[0])
    )
      return invalid;
    normalized = parts[0].split(group).join("") + "." + parts[1];
  } else if (/[.,]/.test(s)) {
    const parts = s.split(/[.,]/);
    if (parts.length === 2) {
      if (parts[1].length === 3 && parts[0] !== "0" && parts[0].length <= 3)
        return {
          price: null,
          issue: "Separador ambiguo: revisá miles o decimales.",
        };
      normalized = parts.join(".");
    } else {
      if (
        !/^\d{1,3}(?:[.,]\d{3})+$/.test(s) ||
        (s.includes(".") && s.includes(","))
      )
        return invalid;
      normalized = parts.join("");
    }
  }
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? { price, issue: null } : invalid;
}
export function makePriceLabel(
  raw: string,
  confidence: number,
  bbox: LabelBox,
  id: string,
): PriceLabel {
  const parsed = parseLabelPrice(raw);
  confidence = Number.isFinite(confidence)
    ? Math.max(0, Math.min(100, confidence))
    : 0;
  return {
    id,
    origin: "ocr-label",
    raw: raw.slice(0, 100),
    confidence,
    bbox,
    price: confidence >= 65 ? parsed.price : null,
    issue:
      confidence < 65
        ? "Confianza OCR baja: corregí o revisá la lectura."
        : parsed.issue,
  };
}
export function matchPriceLabels<
  T extends { y: number; x1: number; x2: number },
>(
  lines: T[],
  labels: PriceLabel[],
  width: number,
  height: number,
): Map<number, PriceLabel> {
  const tolerance = Math.max(6, Math.min(16, height * 0.012));
  const pairs: { line: number; label: PriceLabel; distance: number }[] = [];
  lines.forEach((l, i) =>
    labels
      .filter((label) => /^\d+(?:[.,]\d+)*$/.test(label.raw.trim()))
      .forEach((label) => {
        const b = label.bbox;
        const distance = Math.abs((b.y0 + b.y1) / 2 - l.y);
        if (
          distance <= tolerance &&
          b.x0 >= l.x2 - Math.max(80, width * 0.1) &&
          b.x0 <= l.x2 + width * 0.18 &&
          b.x1 >= l.x2 - width * 0.05
        )
          pairs.push({ line: i, label, distance });
      }),
  );
  const out = new Map<number, PriceLabel>(),
    used = new Set<string>();
  for (const pair of pairs.sort((a, b) => a.distance - b.distance)) {
    if (out.has(pair.line) || used.has(pair.label.id)) continue;
    // Near ties are evidence of uncertainty, not permission to guess a label.
    if (
      pairs.some(
        (other) =>
          other !== pair &&
          ((other.line === pair.line && other.label.id !== pair.label.id) ||
            (other.line !== pair.line && other.label.id === pair.label.id)) &&
          Math.abs(other.distance - pair.distance) < 2,
      )
    )
      continue;
    out.set(pair.line, pair.label);
    used.add(pair.label.id);
  }
  return out;
}

export function validatePriceLabel(
  label: PriceLabel,
  width: number,
  height: number,
): void {
  const b = label.bbox;
  if (
    label.origin !== "ocr-label" ||
    typeof label.id !== "string" ||
    !label.id ||
    label.id.length > 160 ||
    typeof label.raw !== "string" ||
    label.raw.length > 100 ||
    !Number.isFinite(label.confidence) ||
    label.confidence < 0 ||
    label.confidence > 100 ||
    ![b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) ||
    b.x0 < 0 ||
    b.y0 < 0 ||
    b.x1 > width ||
    b.y1 > height ||
    b.x0 >= b.x1 ||
    b.y0 >= b.y1 ||
    label.price !==
      (label.confidence >= 65 ? parseLabelPrice(label.raw).price : null) ||
    !(
      label.issue === null ||
      (typeof label.issue === "string" && label.issue.length <= 300)
    )
  )
    throw new Error("Evidencia OCR inválida.");
}

/** Colored tag at a line endpoint, not a price guessed from the line itself. */
export function findBadgeRegions(
  frame: { data: Uint8ClampedArray; width: number; height: number },
  lines: { x2: number; y: number }[],
  scaleX = 1,
  scaleY = 1,
): LabelBox[] {
  const { data, width, height } = frame,
    boxes: LabelBox[] = [];
  const pixel = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  for (const line of lines) {
    const y = Math.round(line.y),
      end = Math.round(line.x2),
      sampleX = Math.max(
        0,
        Math.min(width - 1, end - Math.max(2, Math.round(5 * scaleX))),
      );
    if (y < 0 || y >= height || end >= width - 15) continue;
    const reference = [
      y,
      Math.min(height - 1, y + Math.max(1, Math.round(scaleY))),
      Math.max(0, y - Math.max(1, Math.round(scaleY))),
    ]
      .map((yy) => pixel(sampleX, yy))
      .sort(
        (a, b) =>
          Math.max(...b) - Math.min(...b) - (Math.max(...a) - Math.min(...a)),
      )[0];
    if (Math.max(...reference) - Math.min(...reference) < 50) continue;
    let x0 = width,
      y0 = height,
      x1 = -1,
      y1 = -1;
    for (
      let yy = Math.max(0, y - Math.round(32 * scaleY));
      yy < Math.min(height, y + Math.round(33 * scaleY));
      yy++
    )
      for (
        let xx = Math.max(0, end + Math.round(2 * scaleX));
        xx < width;
        xx++
      ) {
        const rgb = pixel(xx, yy);
        if (Math.max(...rgb.map((v, i) => Math.abs(v - reference[i]))) < 55) {
          x0 = Math.min(x0, xx);
          x1 = Math.max(x1, xx);
          y0 = Math.min(y0, yy);
          y1 = Math.max(y1, yy);
        }
      }
    if (
      x1 - x0 < 35 * scaleX ||
      y1 - y0 < 12 * scaleY ||
      x1 < end + 40 * scaleX
    )
      continue;
    if (!boxes.some((b) => Math.abs(b.y0 - y0) < 5 * scaleY))
      boxes.push({ x0, y0, x1: x1 + 1, y1: y1 + 1 });
  }
  return boxes.slice(0, 30);
}

/** Same token and position: prefer the clearer OCR pass, retaining its evidence. */
export function mergeLabelEvidence(
  labels: PriceLabel[],
  label: PriceLabel,
): void {
  const index = labels.findIndex(
    (old) =>
      old.raw === label.raw &&
      Math.abs(old.bbox.y0 - label.bbox.y0) < 4 &&
      Math.abs(old.bbox.x0 - label.bbox.x0) < 8,
  );
  if (index < 0) labels.push(label);
  else if (label.confidence > labels[index].confidence) labels[index] = label;
}
