export type FearGreedTone =
  | "extreme-fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme-greed"
  | "unavailable";

export function classifyFearGreed(value: unknown): {
  label: string;
  tone: FearGreedTone;
} {
  if (value === null || value === undefined || value === "") {
    return { label: "SIN DATOS", tone: "unavailable" };
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return { label: "SIN DATOS", tone: "unavailable" };
  }

  if (numeric <= 24) return { label: "MIEDO EXTREMO", tone: "extreme-fear" };
  if (numeric <= 44) return { label: "MIEDO", tone: "fear" };
  if (numeric <= 55) return { label: "NEUTRAL", tone: "neutral" };
  if (numeric <= 74) return { label: "CODICIA", tone: "greed" };
  return { label: "CODICIA EXTREMA", tone: "extreme-greed" };
}
