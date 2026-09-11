import { createClient } from "@/lib/supabase/server";
import { loadMarketQuotes } from "@/lib/market-prices";

export type SummaryItem = {
  label: string;
  value: string;
  confidence: string;
  detail: string;
};

export type MacroMetric = {
  name: string;
  value: string;
  direction: "Sube" | "Baja" | "Mixto" | "Sin datos";
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
  scope: string;
  impact: "Alto" | "Medio" | "Bajo";
};

type JsonRecord = Record<string, unknown>;

const trackedSymbols = ["BTC", "SOL", "XRP", "HBAR", "XLM", "SHX", "VELO"];

const regimeLabels: Record<string, string> = {
  favorable: "Favorable",
  neutral: "Neutral",
  negative: "Negativo",
  insufficient_data: "Sin datos",
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
  flat: "Mixto",
  mixed: "Mixto",
  unknown: "Sin datos",
};

const macroDefinitions = [
  { key: "net_fed_liquidity", name: "Liquidez neta Fed" },
  { key: "global_m2", name: "Global M2" },
  { key: "dxy", name: "DXY" },
  { key: "treasury_2y_10y", name: "Treasury 2Y / 10Y" },
  { key: "stablecoin_supply", name: "Stablecoins" },
  { key: "fear_greed", name: "Fear & Greed" },
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

  const [assetsResult, technicalResult, macroResult, fundamentalResult, eventsResult, synthesisResult, marketQuotes] = await Promise.all([
    supabase.from("assets").select("id, symbol, name, is_active").eq("user_id", userId).eq("is_active", true),
    supabase.from("technical_analyses").select("asset_id, timeframe, as_of, bias, structure, volume_reading, support_levels, resistance_levels, confirmation, source_snapshot").eq("user_id", userId).order("as_of", { ascending: false }).limit(100),
    supabase.from("macro_observations").select("metric_key, observed_at, value, unit, direction").eq("user_id", userId).order("observed_at", { ascending: false }).limit(100),
    supabase.from("fundamental_analyses").select("as_of, regime, summary, confidence").eq("user_id", userId).order("as_of", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("market_events").select("scheduled_at, title, category, status, importance, affected_assets").eq("user_id", userId).in("status", ["announced", "confirmed"]).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(12),
    supabase.from("daily_syntheses").select("analysis_date, general_regime, risk_level, conclusion, operator_action, information_cutoff").eq("user_id", userId).order("analysis_date", { ascending: false }).limit(1).maybeSingle(),
    loadMarketQuotes(["BTC", "SOL"]),
  ]);

  const failed = [assetsResult, technicalResult, macroResult, fundamentalResult, eventsResult, synthesisResult]
    .find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const assets = assetsResult.data ?? [];
  const technicalRows = technicalResult.data ?? [];
  const macroRows = macroResult.data ?? [];
  const eventRows = eventsResult.data ?? [];
  const synthesis = synthesisResult.data;
  const fundamental = fundamentalResult.data;

  const symbolByAssetId = new Map(assets.map((asset) => [asset.id, asset.symbol.toUpperCase()]));
  const latestTechnical = new Map<string, (typeof technicalRows)[number]>();

  technicalRows.forEach((analysis) => {
    const symbol = symbolByAssetId.get(analysis.asset_id);
    if (symbol && !latestTechnical.has(symbol)) latestTechnical.set(symbol, analysis);
  });

  const latestMacro = new Map<string, (typeof macroRows)[number]>();
  macroRows.forEach((observation) => {
    if (!latestMacro.has(observation.metric_key)) latestMacro.set(observation.metric_key, observation);
  });

  const now = Date.now();
  const upcomingEvents = eventRows.filter((event) => {
    if (!event.scheduled_at) return true;
    return new Date(event.scheduled_at).getTime() >= now;
  });

  const eventView: MarketEvent[] = upcomingEvents.slice(0, 5).map((event) => {
    const date = event.scheduled_at ? new Date(event.scheduled_at) : null;
    const affected = Array.isArray(event.affected_assets) && event.affected_assets.length > 0
      ? event.affected_assets.join(" · ")
      : event.category;

    return {
      day: date ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", timeZone: "Europe/Madrid" }).format(date) : "—",
      month: date ? new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "Europe/Madrid" }).format(date).replace(".", "") : "S/F",
      title: event.title,
      scope: affected,
      impact: event.importance === "critical" || event.importance === "high" ? "Alto" : event.importance === "medium" ? "Medio" : "Bajo",
    };
  });

  const nextEvent = upcomingEvents.find((event) => event.scheduled_at);
  const regime = synthesis?.general_regime ?? fundamental?.regime ?? "insufficient_data";
  const hasData = technicalRows.length + macroRows.length + eventRows.length + (synthesis ? 1 : 0) + (fundamental ? 1 : 0) > 0;

  const summary: SummaryItem[] = [
    {
      label: "Régimen general",
      value: regimeLabels[regime] ?? "Sin datos",
      confidence: fundamental?.confidence !== null && fundamental?.confidence !== undefined ? `${fundamental.confidence}%` : "—",
      detail: synthesis?.conclusion ?? fundamental?.summary ?? "Esperando la primera lectura consolidada",
    },
    {
      label: "Próximo evento",
      value: nextEvent?.title ?? "Pendiente",
      confidence: nextEvent?.scheduled_at ? formatDate(nextEvent.scheduled_at)?.split(",")[0] ?? "—" : "—",
      detail: nextEvent?.category ?? "Calendario todavía sin registros",
    },
    {
      label: "Riesgo actual",
      value: synthesis?.risk_level === "high" ? "Alto" : synthesis?.risk_level === "medium" ? "Medio" : synthesis?.risk_level === "low" ? "Bajo" : "No evaluado",
      confidence: synthesis?.operator_action === "no_operation" ? "SIN OPERACIÓN" : "SEÑAL",
      detail: synthesis ? `Operador: ${synthesis.operator_action.replaceAll("_", " ")}` : "Sin operación hasta tener confirmaciones",
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
    const observation = latestMacro.get(definition.key);
    return {
      name: definition.name,
      value: formatMetric(observation?.value, observation?.unit),
      direction: observation ? directionLabels[observation.direction ?? "unknown"] ?? "Sin datos" : "Sin datos",
    };
  });

  const updateCandidates = [
    synthesis?.information_cutoff,
    fundamental?.as_of,
    technicalRows[0]?.as_of,
    macroRows[0]?.observed_at,
  ].filter((value): value is string => Boolean(value));
  const latestUpdate = updateCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    summary,
    technical,
    macro,
    assets: assetView,
    events: eventView,
    hasData,
    lastUpdated: formatDate(latestUpdate) ?? "Sin actualizaciones",
  };
}
