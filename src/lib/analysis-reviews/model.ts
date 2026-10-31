export const REVIEW_ASSETS = [
  "BTC",
  "SOL",
  "XRP",
  "HBAR",
  "XLM",
  "VELO",
  "SHX",
] as const;
export type ReviewAsset = (typeof REVIEW_ASSETS)[number];
export type ReviewSnapshot = {
  version: 1;
  standardVersion: "1.0";
  title: string;
  analysisDate: string;
  asset: {
    symbol: ReviewAsset;
    pair: string;
    exchange: string;
    market: "spot" | "derivative" | "unknown";
    unit: string;
  };
  source: {
    kind: "capture-transcription" | "verified-series";
    description: string;
    captureTime: string | null;
    captureTimeBasis: "filename-derived" | "verified" | "unknown";
    observedAt: string | null;
    sha256: string | null;
  };
  facts: {
    id: string;
    timeframe: "1W" | "1D" | "4H" | "1H" | "unknown";
    label: string;
    value: number | string | null;
    unit: string | null;
    origin: "visible" | "estimated" | "unknown";
    configuration: string | null;
  }[];
  interpretation: string[];
  hypotheses: {
    statement: string;
    evidenceIds: string[];
    confirmation: string[];
    invalidation: string[];
  }[];
  scenarios: {
    name: string;
    reading: string;
    confirmation: string[];
    invalidation: string[];
  }[];
  limitations: string[];
  bibliography: { consulted: string[]; conceptual: string[] };
};
export type ReviewEntry = {
  id: string;
  analysisDate: string;
  observedAt: string | null;
  createdAt: string | null;
  asset: ReviewAsset;
  revisionOf: string | null;
  snapshot: ReviewSnapshot;
  example: boolean;
  isLatest?: boolean;
};
export type ReviewSummary = Omit<ReviewEntry, "snapshot" | "example">;
export type ReviewArchive = {
  status: "ready" | "empty" | "unavailable" | "invalid";
  items: ReviewSummary[];
  selected: ReviewEntry | null;
  nextCursor: string | null;
  asset: ReviewAsset | null;
  message: string | null;
};
function object(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw Error("Objeto inválido");
  return x as Record<string, unknown>;
}
function text(x: unknown, max = 6000): asserts x is string {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw Error("Texto inválido");
}
function texts(x: unknown, max = 30): asserts x is string[] {
  if (!Array.isArray(x) || x.length > max) throw Error("Lista inválida");
  for (const item of x) text(item);
}
export function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  );
}
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function parseReviewSnapshot(input: unknown): ReviewSnapshot {
  const v = object(input);
  if (v.version !== 1 || v.standardVersion !== "1.0" || !isDate(v.analysisDate))
    throw Error("Versión o fecha no compatible");
  text(v.title, 180);
  const asset = object(v.asset);
  if (
    !REVIEW_ASSETS.includes(asset.symbol as ReviewAsset) ||
    !["spot", "derivative", "unknown"].includes(String(asset.market))
  )
    throw Error("Activo inválido");
  for (const key of ["pair", "exchange", "unit"]) text(asset[key], 80);
  const source = object(v.source);
  if (
    !["capture-transcription", "verified-series"].includes(
      String(source.kind),
    ) ||
    !["filename-derived", "verified", "unknown"].includes(
      String(source.captureTimeBasis),
    )
  )
    throw Error("Fuente inválida");
  text(source.description);
  for (const key of ["captureTime", "observedAt"])
    if (source[key] !== null && !isTimestamp(source[key]))
      throw Error("Fecha fuente inválida");
  if (
    source.captureTimeBasis === "filename-derived" &&
    source.observedAt !== null &&
    source.observedAt === source.captureTime
  )
    throw Error("El nombre de archivo no verifica hora de mercado");
  if (
    source.sha256 !== null &&
    (typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256))
  )
    throw Error("Hash inválido");
  if (!Array.isArray(v.facts) || v.facts.length > 100)
    throw Error("Datos inválidos");
  const ids = new Set<string>();
  for (const raw of v.facts) {
    const f = object(raw);
    text(f.id, 80);
    if (ids.has(f.id)) throw Error("Dato duplicado");
    ids.add(f.id);
    text(f.label, 180);
    if (
      !["1W", "1D", "4H", "1H", "unknown"].includes(String(f.timeframe)) ||
      !["visible", "estimated", "unknown"].includes(String(f.origin))
    )
      throw Error("Origen inválido");
    if (
      !(
        f.value === null ||
        (typeof f.value === "number" && Number.isFinite(f.value)) ||
        (typeof f.value === "string" && f.value.length <= 1000)
      )
    )
      throw Error("Valor inválido");
    if ((f.value === null) !== (f.origin === "unknown"))
      throw Error("Dato desconocido debe ser nulo");
    for (const key of ["unit", "configuration"])
      if (f[key] !== null) text(f[key], 500);
  }
  texts(v.interpretation);
  texts(v.limitations);
  for (const key of ["hypotheses", "scenarios"]) {
    if (!Array.isArray(v[key]) || (v[key] as unknown[]).length > 12)
      throw Error("Escenarios inválidos");
    for (const raw of v[key] as unknown[]) {
      const item = object(raw);
      texts(item.confirmation);
      texts(item.invalidation);
      if (key === "hypotheses") {
        text(item.statement);
        texts(item.evidenceIds);
        for (const id of item.evidenceIds as string[])
          if (!ids.has(id))
            throw Error("Hipótesis sin evidencia identificable");
      } else {
        text(item.name, 120);
        text(item.reading);
      }
    }
  }
  const bibliography = object(v.bibliography);
  texts(bibliography.consulted);
  texts(bibliography.conceptual);
  return input as ReviewSnapshot;
}
