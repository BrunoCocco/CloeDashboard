import { createClient } from "@/lib/supabase/server";
import { loadMarketQuotes } from "@/lib/market-prices";
import { classifyFearGreed, type FearGreedTone } from "@/lib/fear-greed";

export type SummaryItem = {
  label: string;
  value: string;
  confidence: string;
  detail: string;
};

export type MacroMetric = {
  name: string;
  value: string;
  delta: string | null;
  observedAt: string | null;
  direction: "Sube" | "Baja" | "Estable" | "Mixto" | "Sin datos";
  tone: FearGreedTone | null;
  source: { name: string; url: string | null } | null;
};

export type AssetRow = {
  symbol: string;
  structure: string;
  wind: string;
  support: string;
  resistance: string;
  status: string;
};

export type MarketEvent = {
  day: string;
  month: string;
  title: string;
  impact: "Alto" | "Medio" | "Bajo";
};

type JsonRecord = Record<string, unknown>;

const interpretationKeys = [
  "summary",
  "reading",
  "interpretation",
  "impact",
  "conclusion",
  "analysis",
  "assessment",
  "outlook",
  "text",
  "message",
] as const;

const nonInterpretationKeys = new Set([
  "title",
  "name",
  "date",
  "scheduled_at",
  "importance",
  "status",
  "source",
  "url",
]);

const trackedSymbols = ["BTC", "SOL", "XRP", "HBAR", "XLM", "SHX", "VELO"];

const regimeLabels: Record<string, string> = {
  favorable: "Favorable",
  neutral: "Neutral",
  negative: "Negativo",
  insufficient_data: "Sin datos",
};

const regimeDetails: Record<string, string> = {
  favorable: "Condiciones generales favorables según la última lectura disponible.",
  neutral: "Condiciones mixtas, sin una dirección general dominante.",
  negative: "Condiciones generales adversas según la última lectura disponible.",
  insufficient_data: "Esperando una lectura informativa consolidada.",
};

const riskDetails: Record<string, string> = {
  high: "Entorno de elevada incertidumbre y volatilidad.",
  medium: "Entorno con riesgos relevantes que requieren seguimiento.",
  low: "Entorno de riesgo contenido según la última síntesis.",
  unknown: "Todavía no hay una evaluación consolidada del riesgo.",
};

const biasLabels: Record<string, string> = {
  bullish: "Alcista",
  neutral: "Neutral",
  bearish: "Bajista",
  insufficient_data: "Sin datos",
};

const directionLabels: Record<string, MacroMetric["direction"]> = {
  rising: "Sube",
  falling: "Baja",
  flat: "Estable",
  mixed: "Mixto",
  unknown: "Sin datos",
};

const macroDefinitions = [
  { key: "net_fed_liquidity", name: "Liquidez neta de la Fed" },
  { key: "global_m2", name: "Global M2" },
  { key: "dxy", name: "DXY" },
  { key: "treasury_2y", name: "Treasury 2 años" },
  { key: "treasury_10y", name: "Treasury 10 años" },
  { key: "stablecoin_market_cap", name: "Stablecoins" },
  { key: "fear_greed", name: "Miedo y codicia" },
] as const;

function firstJsonValue(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  const first = value[0];

  if (typeof first === "string" || typeof first === "number") return String(first);
  if (first && typeof first === "object") {
    const record = first as JsonRecord;
    const level = record.price ?? record.value ?? record.level;
    if (typeof level === "string" || typeof level === "number") return String(level);
  }

  return "—";
}

function formatMetric(value: unknown, unit: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  const formatted = Number.isFinite(numeric)
    ? new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(numeric)
    : String(value);
  return typeof unit === "string" && unit ? `${formatted} ${unit}` : formatted;
}

function numericMetric(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMacroValue(key: string, value: unknown, unit: unknown) {
  const numeric = numericMetric(value);
  if (numeric === null) return "—";

  if (key === "treasury_2y" || key === "treasury_10y") {
    return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)}%`;
  }

  if (key === "fear_greed") {
    return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(numeric);
  }

  return formatMetric(value, unit);
}

function dailyChange(key: string, current: unknown, previous: unknown) {
  if (!["treasury_2y", "treasury_10y", "fear_greed"].includes(key)) return null;

  const currentValue = numericMetric(current);
  const previousValue = numericMetric(previous);
  if (currentValue === null || previousValue === null) return null;

  const change = currentValue - previousValue;
  const digits = key === "fear_greed" ? 0 : 2;
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "always",
  }).format(change);
  const suffix = key === "fear_greed" ? "" : " pp";
  return `Δ vs. anterior ${formatted}${suffix}`;
}

function directionFromValues(current: unknown, previous: unknown, fallback: MacroMetric["direction"]) {
  const currentValue = numericMetric(current);
  const previousValue = numericMetric(previous);
  if (currentValue === null || previousValue === null) return fallback;
  const difference = currentValue - previousValue;
  if (difference > 1e-9) return "Sube";
  if (difference < -1e-9) return "Baja";
  return "Estable";
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function formatObservationDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function normalizePanelText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function compactPanelText(value: string) {
  const normalized = normalizePanelText(value);
  const maxLength = 680;
  if (normalized.length <= maxLength) return normalized;

  const boundary = normalized.lastIndexOf(" ", maxLength);
  return `${normalized.slice(0, boundary > 0 ? boundary : maxLength).trimEnd()}…`;
}

/**
 * Cloe guarda las síntesis con estructuras JSON que pueden evolucionar. Esta
 * lectura prioriza los campos semánticos conocidos y solo recurre a texto
 * genérico cuando no parece ser un dato de calendario ni un título de evento.
 */
function interpretationFrom(value: unknown, depth = 0): string | null {
  if (depth > 4 || value === null || value === undefined) return null;

  if (typeof value === "string") {
    const text = compactPanelText(value);
    return text || null;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => interpretationFrom(item, depth + 1))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? compactPanelText(items.join(" ")) : null;
  }

  if (typeof value !== "object") return null;

  const record = value as JsonRecord;
  for (const key of interpretationKeys) {
    const text = interpretationFrom(record[key], depth + 1);
    if (text) return text;
  }

  for (const [key, candidate] of Object.entries(record)) {
    if (nonInterpretationKeys.has(key.toLowerCase())) continue;
    const text = interpretationFrom(candidate, depth + 1);
    if (text) return text;
  }

  return null;
}

function numberFromRecord(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as JsonRecord)[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function formatUsd(value: number | null) {
  if (value === null) return "Precio no disponible";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export async function loadDashboard(userId: string) {
  const supabase = await createClient();
  const macroRequests = macroDefinitions.map((definition) =>
    supabase
      .from("macro_observations")
      .select("metric_key, observed_at, value, unit, direction, source_name, source_url")
      .eq("user_id", userId)
      .eq("metric_key", definition.key)
      .order("observed_at", { ascending: false })
      .limit(2)
  );

  const [assetsResult, technicalResult, macroResults, fundamentalResult, eventsResult, synthesisResult, marketQuotes] = await Promise.all([
    supabase.from("assets").select("id, symbol, name, is_active").eq("user_id", userId).eq("is_active", true),
    supabase.from("technical_analyses").select("asset_id, timeframe, as_of, bias, structure, volume_reading, support_levels, resistance_levels, confirmation, source_snapshot").eq("user_id", userId).order("as_of", { ascending: false }).limit(100),
    Promise.all(macroRequests),
    supabase.from("fundamental_analyses").select("as_of, regime, summary, confidence").eq("user_id", userId).order("as_of", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("market_events").select("scheduled_at, title, status, importance").eq("user_id", userId).in("status", ["announced", "confirmed"]).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(12),
    supabase.from("daily_syntheses").select("analysis_date, general_regime, risk_level, information_cutoff, fundamental_result, dates_result, conclusion").eq("user_id", userId).order("analysis_date", { ascending: false }).limit(1).maybeSingle(),
    loadMarketQuotes(["BTC", "SOL"]),
  ]);

  const failed = [assetsResult, technicalResult, ...macroResults, fundamentalResult, eventsResult, synthesisResult]
    .find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const assets = assetsResult.data ?? [];
  const technicalRows = technicalResult.data ?? [];
  const macroRows = macroResults.flatMap((result) => result.data ?? []);
  const eventRows = eventsResult.data ?? [];
  const synthesis = synthesisResult.data;
  const fundamental = fundamentalResult.data;

  const symbolByAssetId = new Map(assets.map((asset) => [asset.id, asset.symbol.toUpperCase()]));
  const latestTechnical = new Map<string, (typeof technicalRows)[number]>();

  technicalRows.forEach((analysis) => {
    const symbol = symbolByAssetId.get(analysis.asset_id);
    if (symbol && !latestTechnical.has(symbol)) latestTechnical.set(symbol, analysis);
  });

  const macroHistory = new Map<string, (typeof macroRows)[number][]>();
  macroRows.forEach((observation) => {
    const history = macroHistory.get(observation.metric_key) ?? [];
    history.push(observation);
    macroHistory.set(observation.metric_key, history);
  });

  const now = Date.now();
  const upcomingEvents = eventRows.filter((event) => {
    if (!event.scheduled_at) return true;
    return new Date(event.scheduled_at).getTime() >= now;
  });

  const eventView: MarketEvent[] = upcomingEvents.slice(0, 5).map((event) => {
    const date = event.scheduled_at ? new Date(event.scheduled_at) : null;
    return {
      day: date ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", timeZone: "Europe/Madrid" }).format(date) : "—",
      month: date ? new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "Europe/Madrid" }).format(date).replace(".", "") : "S/F",
      title: event.title,
      impact: event.importance === "critical" || event.importance === "high" ? "Alto" : event.importance === "medium" ? "Medio" : "Bajo",
    };
  });

  const regime = synthesis?.general_regime ?? fundamental?.regime ?? "insufficient_data";
  const hasData = technicalRows.length + macroRows.length + eventRows.length + (synthesis ? 1 : 0) + (fundamental ? 1 : 0) > 0;

  const summary: SummaryItem[] = [
    {
      label: "Régimen general",
      value: regimeLabels[regime] ?? "Sin datos",
      confidence: fundamental?.confidence !== null && fundamental?.confidence !== undefined ? `${fundamental.confidence}%` : "—",
      detail: fundamental?.summary ?? regimeDetails[regime] ?? regimeDetails.insufficient_data,
    },
    {
      label: "Riesgo actual",
      value: synthesis?.risk_level === "high" ? "Alto" : synthesis?.risk_level === "medium" ? "Medio" : synthesis?.risk_level === "low" ? "Bajo" : "No evaluado",
      confidence: "RIESGO DE MERCADO",
      detail: riskDetails[synthesis?.risk_level ?? "unknown"] ?? riskDetails.unknown,
    },
  ];

  const technical = ["BTC", "SOL"].map((symbol) => {
    const analysis = latestTechnical.get(symbol);
    const liveQuote = marketQuotes.get(symbol);
    const storedPrice = numberFromRecord(analysis?.source_snapshot, "price_usd");
    const storedChange = numberFromRecord(analysis?.source_snapshot, "day_change_pct");
    const price = liveQuote?.usd ?? storedPrice;
    const change24h = liveQuote?.change24h ?? storedChange;
    return {
      symbol,
      mark: symbol === "BTC" ? "₿" : "S",
      price: formatUsd(price),
      change24h,
      priceSource: liveQuote?.usd !== null && liveQuote?.usd !== undefined ? "CoinGecko" : "Último corte",
      timeframe: analysis ? analysis.timeframe.toUpperCase() : "Diario · 4H",
      bias: analysis ? biasLabels[analysis.bias] ?? analysis.bias : "Sin datos",
      reading: analysis?.structure ?? "Todavía no hay análisis técnico acumulado para este activo.",
      trigger: analysis?.confirmation ?? "Pendiente",
      levels: [
        { label: "Soporte", value: firstJsonValue(analysis?.support_levels) },
        { label: "Resistencia", value: firstJsonValue(analysis?.resistance_levels) },
        { label: "Volumen", value: analysis?.volume_reading ?? "—" },
      ],
    };
  });

  const assetView: AssetRow[] = trackedSymbols.map((symbol) => {
    const analysis = latestTechnical.get(symbol);
    return {
      symbol,
      structure: analysis?.structure ?? "Sin analizar",
      wind: analysis ? biasLabels[analysis.bias] ?? analysis.bias : "Sin cruce",
      support: firstJsonValue(analysis?.support_levels),
      resistance: firstJsonValue(analysis?.resistance_levels),
      status: analysis ? "Actualizado" : "Pendiente",
    };
  });

  const macro: MacroMetric[] = macroDefinitions.map((definition) => {
    const history = macroHistory.get(definition.key) ?? [];
    const observation = history[0];
    const previous = history[1];
    const fearGreedState = definition.key === "fear_greed"
      ? classifyFearGreed(observation?.value)
      : null;
    const fallbackDirection = observation
      ? directionLabels[observation.direction ?? "unknown"] ?? "Sin datos"
      : "Sin datos";
    return {
      name: fearGreedState?.label ?? definition.name,
      value: formatMacroValue(definition.key, observation?.value, observation?.unit),
      delta: dailyChange(definition.key, observation?.value, previous?.value),
      observedAt: formatObservationDate(observation?.observed_at),
      direction: directionFromValues(observation?.value, previous?.value, fallbackDirection),
      tone: fearGreedState?.tone ?? null,
      source: observation
        ? { name: observation.source_name, url: observation.source_url }
        : null,
    };
  });

  // Fundamental y Fechas se mantienen independientes: la conclusión global de
  // Cloe se carga para conservar la síntesis completa, pero no se reutiliza en
  // ninguno de los dos paneles modulares.
  const macroInterpretation = interpretationFrom(synthesis?.fundamental_result)
    ?? (typeof fundamental?.summary === "string" && normalizePanelText(fundamental.summary)
      ? compactPanelText(fundamental.summary)
      : null)
    ?? "Información insuficiente: todavía no hay una interpretación fundamental consolidada para este corte.";
  const datesInterpretation = interpretationFrom(synthesis?.dates_result)
    ?? "Información insuficiente: hay fechas registradas, pero todavía no hay una interpretación de su posible impacto.";

  const updateCandidates = [
    synthesis?.information_cutoff,
    fundamental?.as_of,
    technicalRows[0]?.as_of,
    ...macroRows.map((row) => row.observed_at),
  ].filter((value): value is string => Boolean(value));
  const latestUpdate = updateCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    summary,
    technical,
    macro,
    macroInterpretation,
    assets: assetView,
    events: eventView,
    datesInterpretation,
    hasData,
    lastUpdated: formatDate(latestUpdate) ?? "Sin actualizaciones",
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
