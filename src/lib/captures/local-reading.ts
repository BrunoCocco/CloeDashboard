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
};
export type LocalReading = {
  version: 1;
  summary?: string;
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
    ids.add(l.id);
    const expected = v.calibration ? estimatePrice(v.calibration, l.y) : null;
    if (
      l.estimatedPrice !== expected ||
      (l.decision === "accepted" && expected === null)
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
  const prices = accepted
    .map((l) => l.estimatedPrice)
    .filter((p): p is number => p !== null);
  return `${v.candidates.length} candidatas en ${v.calibration?.panel ?? "región sin calibrar"}; ${accepted.length} niveles clasificados por el usuario, ${v.candidates.filter((l) => l.decision === "rejected").length} descartados, ${v.candidates.filter((l) => l.decision === "pending").length} pendientes.${prices.length ? ` Rango estimado revisado: ${formatEstimatedPrice(Math.min(...prices))}–${formatEstimatedPrice(Math.max(...prices))}.` : ""} La geometría no demuestra soportes, resistencias, tendencia ni señales. No se recuperaron OHLC ni indicadores mediante este detector.`;
}
