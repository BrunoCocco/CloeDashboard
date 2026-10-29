import {
  matchPriceLabels,
  validatePriceLabel,
  type PriceLabel,
  type LabelScan,
} from "./price-labels";
import type { LocalLine } from "./local-lines";
export type Region = { x1: number; y1: number; x2: number; y2: number };
export type Calibration = {
  region: Region;
  scale: "linear" | "log";
  first: { y: number; price: number };
  second: { y: number; price: number };
  panel: string;
};
export type LocalCandidate = LocalLine & {
  id: string;
  decision: "pending" | "rejected" | "accepted";
  classification: "support" | "resistance" | "reference";
  estimatedPrice: number | null;
  ocrLabel?: PriceLabel;
  correctedPrice?: number;
};
export type LocalReading = {
  version: 1;
  summary?: string;
  labelScan?: LabelScan;
  width: number;
  height: number;
  calibration: Calibration | null;
  candidates: LocalCandidate[];
};
export function validateCalibration(
  c: Calibration,
  width: number,
  height: number,
) {
  const r = c.region;
  if (
    ![
      r.x1,
      r.y1,
      r.x2,
      r.y2,
      c.first.y,
      c.second.y,
      c.first.price,
      c.second.price,
    ].every(Number.isFinite) ||
    r.x1 < 0 ||
    r.y1 < 0 ||
    r.x2 > width ||
    r.y2 > height ||
    r.x2 - r.x1 < 8 ||
    r.y2 - r.y1 < 8 ||
    !["linear", "log"].includes(c.scale) ||
    !c.panel.trim() ||
    c.panel.length > 80 ||
    c.first.y < r.y1 ||
    c.first.y > r.y2 ||
    c.second.y < r.y1 ||
    c.second.y > r.y2 ||
    Math.abs(c.first.y - c.second.y) < 2 ||
    c.first.price <= 0 ||
    c.second.price <= 0 ||
    c.first.price === c.second.price ||
    (c.first.price - c.second.price) * (c.first.y - c.second.y) >= 0
  )
    throw new Error(
      "Revisá región, puntos y precios: el precio superior debe ser mayor, con dos alturas distintas.",
    );
}
export function estimatePrice(c: Calibration, y: number): number | null {
  if (y < c.region.y1 || y > c.region.y2) return null;
  const t = (y - c.first.y) / (c.second.y - c.first.y);
  const p =
    c.scale === "log"
      ? Math.exp(
          Math.log(c.first.price) +
            t * (Math.log(c.second.price) - Math.log(c.first.price)),
        )
      : c.first.price + t * (c.second.price - c.first.price);
  return Number.isFinite(p) && p > 0 ? p : null;
}
export function calibrate(
  lines: LocalLine[],
  c: Calibration,
  width: number,
  height: number,
): LocalReading {
  validateCalibration(c, width, height);
  const r = c.region;
  return {
    version: 1,
    width,
    height,
    calibration: c,
    candidates: lines
      .filter((l) => l.y >= r.y1 && l.y <= r.y2 && l.x1 < r.x2 && l.x2 > r.x1)
      .map((l, i) => ({
        ...l,
        x1: Math.max(r.x1, l.x1),
        x2: Math.min(r.x2, l.x2),
        id: `line-${i}`,
        decision: "pending",
        classification: "reference",
        estimatedPrice: estimatePrice(c, l.y),
      })),
  };
}
export function candidatePrice(l: LocalCandidate): number | null {
  return l.correctedPrice ?? l.ocrLabel?.price ?? l.estimatedPrice;
}
export function candidateOrigin(l: LocalCandidate): string {
  return l.correctedPrice !== undefined
    ? "Corrección manual"
    : l.ocrLabel?.price !== null && l.ocrLabel?.price !== undefined
      ? "Etiqueta OCR (revisar)"
      : l.estimatedPrice !== null
        ? "Estimación por eje"
        : "Sin precio legible";
}
export function applyLabelScan(v: LocalReading, scan: LabelScan): LocalReading {
  const reserved = v.candidates.flatMap((l) =>
    l.ocrLabel ? [l.ocrLabel] : [],
  );
  const available = scan.labels.filter(
    (label) =>
      !reserved.some(
        (old) =>
          old.raw === label.raw &&
          Math.abs(old.bbox.y0 - label.bbox.y0) < 4 &&
          Math.abs(old.bbox.x0 - label.bbox.x0) < 4,
      ),
  );
  const matches = matchPriceLabels(v.candidates, available, v.width, v.height);
  return {
    ...v,
    summary: undefined,
    labelScan: scan,
    candidates: v.candidates.map((l, i) => {
      // Explicit retry cannot overwrite an existing reading, correction or confirmed decision.
      if (
        l.ocrLabel ||
        l.correctedPrice !== undefined ||
        l.decision !== "pending"
      )
        return l;
      const label = matches.get(i);
      return label ? { ...l, ocrLabel: label } : l;
    }),
  };
}
export function validateLocalReading(
  v: LocalReading,
  width: number,
  height: number,
): LocalReading {
  if (
    v.version !== 1 ||
    v.width !== width ||
    v.height !== height ||
    !Array.isArray(v.candidates) ||
    v.candidates.length > 100 ||
    (v.summary !== undefined &&
      (typeof v.summary !== "string" || v.summary.length > 10000))
  )
    throw new Error("Lectura local incompatible con la imagen.");
  if (v.labelScan) {
    const scan = v.labelScan,
      b = scan.crop;
    if (
      scan.version !== 1 ||
      !Array.isArray(scan.labels) ||
      scan.labels.length > 300 ||
      typeof scan.text !== "string" ||
      scan.text.length > 30000 ||
      ![b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) ||
      b.x0 < 0 ||
      b.y0 < 0 ||
      b.x1 > width ||
      b.y1 > height ||
      b.x0 >= b.x1 ||
      b.y0 >= b.y1
    )
      throw new Error("Escaneo OCR inválido.");
    const ids = new Set<string>();
    for (const label of scan.labels) {
      validatePriceLabel(label, width, height);
      if (ids.has(label.id)) throw new Error("Etiqueta OCR duplicada.");
      ids.add(label.id);
    }
  }
  if (v.calibration === undefined)
    throw new Error("Candidatas sin calibración de su panel.");
  if (v.calibration) validateCalibration(v.calibration, width, height);
  const ids = new Set<string>();
  for (const l of v.candidates) {
    if (
      !l.id ||
      ids.has(l.id) ||
      !Number.isFinite(l.y) ||
      !Number.isFinite(l.x1) ||
      !Number.isFinite(l.x2) ||
      l.y < 0 ||
      l.y > height ||
      l.x1 < 0 ||
      l.x2 > width ||
      l.x1 >= l.x2 ||
      !["pending", "rejected", "accepted"].includes(l.decision) ||
      !["support", "resistance", "reference"].includes(l.classification) ||
      l.source !== "pixel-local" ||
      l.kind !== "horizontal-line" ||
      l.confidence !== "candidate" ||
      !Number.isFinite(l.pixels) ||
      l.pixels <= 0 ||
      !Number.isFinite(l.coverage) ||
      l.coverage < 0 ||
      l.coverage > 1 ||
      l.price !== null
    )
      throw new Error("Candidata local inválida.");
    if (
      l.correctedPrice !== undefined &&
      (!Number.isFinite(l.correctedPrice) || l.correctedPrice <= 0)
    )
      throw new Error("Corrección de precio inválida.");
    if (l.ocrLabel) {
      validatePriceLabel(l.ocrLabel, width, height);
      if (!matchPriceLabels([l], [l.ocrLabel], width, height).has(0))
        throw new Error("Etiqueta fuera de la línea asociada.");
    }
    ids.add(l.id);
    const expected = v.calibration ? estimatePrice(v.calibration, l.y) : null;
    if (
      l.estimatedPrice !== expected ||
      (l.decision === "accepted" && candidatePrice(l) === null)
    )
      throw new Error("El nivel no coincide con su calibración.");
    if (
      v.calibration &&
      (l.x1 < v.calibration.region.x1 ||
        l.x2 > v.calibration.region.x2 ||
        l.y < v.calibration.region.y1 ||
        l.y > v.calibration.region.y2)
    )
      throw new Error("Candidata fuera del panel.");
  }
  return v;
}
/** Display precision is intentionally limited; raw estimatedPrice remains unchanged. */
export function formatEstimatedPrice(price: number): string {
  return `≈ ${new Intl.NumberFormat("es-AR", { maximumSignificantDigits: 6 }).format(price)}`;
}
export function localSummary(v: LocalReading): string {
  const accepted = v.candidates.filter((l) => l.decision === "accepted");
  const readPrices = accepted
    .filter(
      (l) =>
        l.correctedPrice !== undefined ||
        (l.ocrLabel?.price !== null && l.ocrLabel?.price !== undefined),
    )
    .map(candidatePrice)
    .filter((p): p is number => p !== null);
  const estimated = accepted
    .filter(
      (l) =>
        l.correctedPrice === undefined &&
        (l.ocrLabel?.price === null || l.ocrLabel === undefined),
    )
    .map((l) => l.estimatedPrice)
    .filter((p): p is number => p !== null);
  const range = readPrices.length
    ? ` Rango OCR/corregido revisado: ${Math.min(...readPrices)}–${Math.max(...readPrices)}.`
    : "";
  const estimateRange = estimated.length
    ? ` Rango estimado por eje: ${formatEstimatedPrice(Math.min(...estimated))}–${formatEstimatedPrice(Math.max(...estimated))}.`
    : "";
  return `${v.candidates.filter((l) => l.ocrLabel?.price !== null && l.ocrLabel?.price !== undefined).length} etiquetas OCR legibles; ${v.candidates.filter((l) => l.correctedPrice !== undefined).length} correcciones manuales. ${v.candidates.length} candidatas en ${v.calibration?.panel ?? "región sin calibrar"}; ${accepted.length} niveles clasificados por el usuario, ${v.candidates.filter((l) => l.decision === "rejected").length} descartados, ${v.candidates.filter((l) => l.decision === "pending").length} pendientes.${range}${estimateRange} Las etiquetas leídas requieren revisión y no equivalen a cotizaciones verificadas. La geometría no demuestra soportes, resistencias, tendencia ni señales. No se recuperaron OHLC ni indicadores mediante este detector.`;
}
