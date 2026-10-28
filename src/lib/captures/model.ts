export type ReviewedLevel = {
  price: number;
  kind: "support" | "resistance" | "reference";
  label: string;
  confirmed: true;
};
export type CaptureMetadata = {
  version: 1;
  id: string;
  ownerId: string;
  createdAt: string;
  capturedAt: string | null;
  observedAt: string | null;
  asset: string;
  exchange: string;
  pair: string;
  timeframe: "1W" | "1D" | "4H" | "ALL";
  title: string;
  notes: string;
  hypothesis: string;
  invalidation: string;
  levels: ReviewedLevel[];
  ocrText: string;
  reviewed: true;
  method: "screen" | "upload";
  width: number;
  height: number;
};
export type CaptureRecord = CaptureMetadata & { image: Blob };
export type DraftMetadata = {
  asset: string;
  exchange: string;
  pair: string;
  timeframe: string;
  title: string;
  notes: string;
  hypothesis: string;
  invalidation: string;
  observedAt: string;
  reviewed: boolean;
};
export function positivePrice(value: string): number {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim()))
    throw new Error(
      "Usá un precio positivo con punto decimal y sin separadores de miles.",
    );
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0)
    throw new Error("El precio debe ser positivo y finito.");
  return price;
}
export function numericCandidates(text: string): string[] {
  // Tokens only: separators are intentionally NOT interpreted as price notation.
  return [...new Set(text.match(/\b\d+(?:[.,]\d+)*\b/g) ?? [])].slice(0, 60);
}
export function validateImageLimits(
  type: string,
  size: number,
  width?: number,
  height?: number,
) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(type))
    throw new Error("Usá una imagen PNG, JPEG o WebP.");
  if (size <= 0 || size > 12 * 1024 * 1024)
    throw new Error("La imagen debe pesar entre 1 byte y 12 MB.");
  if (
    width !== undefined &&
    height !== undefined &&
    (!Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > 8192 ||
      height > 8192 ||
      width * height > 20_000_000)
  )
    throw new Error(
      "Imagen demasiado grande: máximo 8192 px por lado y 20 megapíxeles.",
    );
}
export function validImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    );
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
function field(value: string, label: string, max: number, required = false) {
  const result = value.trim();
  if ((required && !result) || result.length > max)
    throw new Error(`${label}: completá el campo (máximo ${max} caracteres).`);
  return result;
}
export function buildMetadata(
  ownerId: string,
  draft: DraftMetadata,
  image: {
    method: "screen" | "upload";
    capturedAt: string | null;
    width: number;
    height: number;
  },
  levels: ReviewedLevel[],
  ocrText: string,
): CaptureMetadata {
  if (!ownerId) throw new Error("La sesión no identifica un propietario.");
  if (!draft.reviewed)
    throw new Error(
      "Confirmá que revisaste el activo, el mercado, la temporalidad y los niveles.",
    );
  if (!["1W", "1D", "4H", "ALL"].includes(draft.timeframe))
    throw new Error("Temporalidad inválida.");
  if (draft.observedAt && !Number.isFinite(Date.parse(draft.observedAt)))
    throw new Error("La fecha de observación no es válida.");
  const observedAt = draft.observedAt
    ? new Date(draft.observedAt).toISOString()
    : null;
  if (image.capturedAt && !Number.isFinite(Date.parse(image.capturedAt)))
    throw new Error("Fecha de captura inválida.");
  if (
    levels.length > 50 ||
    levels.some(
      (level) =>
        level.confirmed !== true ||
        !Number.isFinite(level.price) ||
        level.price <= 0 ||
        !["support", "resistance", "reference"].includes(level.kind) ||
        !level.label.trim() ||
        level.label.length > 80,
    )
  )
    throw new Error("Revisá los niveles confirmados; máximo 50.");
  validateImageLimits("image/png", 1, image.width, image.height);
  return {
    version: 1,
    id: crypto.randomUUID(),
    ownerId,
    createdAt: new Date().toISOString(),
    capturedAt: image.capturedAt,
    observedAt,
    asset: field(draft.asset, "Activo", 24, true).toUpperCase(),
    exchange: field(draft.exchange, "Exchange", 80, true),
    pair: field(draft.pair, "Par", 48, true),
    timeframe: draft.timeframe as CaptureMetadata["timeframe"],
    title: field(draft.title, "Título", 160, true),
    notes: field(draft.notes, "Notas", 30000),
    hypothesis: field(draft.hypothesis, "Hipótesis", 10000),
    invalidation: field(draft.invalidation, "Invalidación", 10000),
    levels: levels.map((level) => ({ ...level })),
    ocrText: field(ocrText, "Texto OCR", 100000),
    reviewed: true,
    method: image.method,
    width: image.width,
    height: image.height,
  };
}
