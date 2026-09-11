export type SummaryItem = { label: string; value: string; confidence: string; detail: string };
export type MacroMetric = { name: string; value: string; direction: "Sin datos" | "Mixto" };
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
    { name: "Liquidez neta Fed", value: "—", direction: "Sin datos" },
    { name: "Global M2", value: "—", direction: "Sin datos" },
    { name: "DXY", value: "—", direction: "Sin datos" },
    { name: "Treasury 2Y / 10Y", value: "—", direction: "Sin datos" },
    { name: "Stablecoins", value: "—", direction: "Sin datos" },
    { name: "Fear & Greed", value: "—", direction: "Sin datos" },
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
