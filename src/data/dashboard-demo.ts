export type SummaryItem = { label: string; value: string; confidence: string; detail: string };
export type MacroMetric = { name: string; value: string; delta: string | null; direction: "Sin datos" | "Mixto"; source: { name: string; url: string | null } | null };
export type AssetRow = { symbol: string; structure: string; wind: string; support: string; resistance: string; status: string };
export type MarketEvent = { day: string; month: string; title: string; scope: string; impact: "Alto" | "Medio" };

export const dashboardDemo = {
  navigation: ["Resumen", "Técnico", "Fundamental", "Fechas", "Histórico"],
  summary: [
    { label: "Régimen general", value: "Neutral", confidence: "DEMO", detail: "Esperando la primera lectura consolidada" },
    { label: "Próximo evento", value: "Pendiente", confidence: "— DÍAS", detail: "Calendario todavía sin sincronizar" },
    { label: "Riesgo actual", value: "No evaluado", confidence: "DEMO", detail: "Sin operación hasta tener confirmaciones" },
  ] satisfies SummaryItem[],
  technical: [
    {
      symbol: "BTC", mark: "₿", timeframe: "Diario · 4H", bias: "Sin datos",
      reading: "Aquí aparecerá la estructura acumulativa, no solamente la lectura de las últimas diez velas.",
      trigger: "Cierre + volumen",
      levels: [{ label: "Soporte", value: "—" }, { label: "Resistencia", value: "—" }, { label: "Volumen", value: "—" }],
    },
    {
      symbol: "SOL", mark: "S", timeframe: "Diario · 4H", bias: "Sin datos",
      reading: "El técnico se completará exclusivamente con precio, gráfico y volumen; sin influencia macro.",
      trigger: "Estructura válida",
      levels: [{ label: "Soporte", value: "—" }, { label: "Resistencia", value: "—" }, { label: "Volumen", value: "—" }],
    },
  ],
  macro: [
    { name: "Liquidez neta Fed", value: "—", delta: null, direction: "Sin datos", source: null },
    { name: "Global M2", value: "—", delta: null, direction: "Sin datos", source: null },
    { name: "DXY", value: "—", delta: null, direction: "Sin datos", source: null },
    { name: "Treasury 2 años", value: "4,43%", delta: "Δ vs. anterior +0,04 pp", direction: "Mixto", source: { name: "FRED DGS2", url: "https://fred.stlouisfed.org/series/DGS2" } },
    { name: "Treasury 10 años", value: "4,83%", delta: "Δ vs. anterior +0,03 pp", direction: "Mixto", source: { name: "FRED DGS10", url: "https://fred.stlouisfed.org/series/DGS10" } },
    { name: "Stablecoins", value: "—", delta: null, direction: "Sin datos", source: null },
    { name: "Miedo y codicia", value: "69", delta: "Δ vs. anterior +3", direction: "Mixto", source: { name: "Alternative.me", url: "https://alternative.me/crypto/fear-and-greed-index/" } },
  ] satisfies MacroMetric[],
  assets: ["BTC", "SOL", "XRP", "HBAR", "XLM", "SHX", "VELO"].map((symbol) => ({
    symbol, structure: "Sin analizar", wind: "Sin cruce", support: "—", resistance: "—", status: "Pendiente",
  })) satisfies AssetRow[],
  events: [
    { day: "—", month: "—", title: "Dato macro relevante", scope: "Fed · inflación · empleo", impact: "Alto" },
    { day: "—", month: "—", title: "Evento de ecosistema", scope: "Confirmación oficial requerida", impact: "Medio" },
    { day: "—", month: "—", title: "Seguimiento regulatorio", scope: "Rumor ≠ acontecimiento", impact: "Medio" },
  ] satisfies MarketEvent[],
};
