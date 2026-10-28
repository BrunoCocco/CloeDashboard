import {
  FRAMES,
  SYMBOLS,
  type Candle,
  type CandleBatch,
  type Frame,
  type SymbolCode,
} from "./model";
const intervals: Record<Frame, number> = { "1W": 10080, "1D": 1440, "4H": 240 };
export function marketRequest(symbol: string | null, frame: string | null) {
  if (
    !SYMBOLS.includes(symbol as SymbolCode) ||
    !FRAMES.includes(frame as Frame)
  )
    throw new Error("Activo o temporalidad inválida");
  const pair = `${symbol === "BTC" ? "XBT" : symbol}USD`;
  return {
    symbol: symbol as SymbolCode,
    frame: frame as Frame,
    pair,
    url: `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${intervals[frame as Frame]}`,
  };
}
export function normalizeKraken(
  payload: unknown,
  request: ReturnType<typeof marketRequest>,
  fetchedAt: string,
): CandleBatch {
  if (!payload || typeof payload !== "object")
    throw new Error("Respuesta de mercado inválida");
  const data = payload as { error?: unknown; result?: Record<string, unknown> };
  if (!Array.isArray(data.error) || data.error.length)
    throw new Error(
      "Kraken no ofrece datos de este par o ha limitado la consulta",
    );
  const rows = Object.entries(data.result ?? {}).find(
    ([key]) => key !== "last",
  )?.[1];
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error("Sin velas para este mercado");
  let lastTime = -1;
  const candles: Candle[] = rows.map((row: unknown) => {
    if (!Array.isArray(row) || row.length < 7) throw new Error("Vela inválida");
    const [time, open, high, low, close, , volume] = row.map(Number);
    if (
      ![time, open, high, low, close, volume].every(Number.isFinite) ||
      !Number.isInteger(time) ||
      time <= lastTime ||
      time <= 0 ||
      low <= 0 ||
      high < Math.max(open, close, low) ||
      low > Math.min(open, close) ||
      volume < 0
    )
      throw new Error("Serie inconsistente");
    lastTime = time;
    return { time, open, high, low, close, volume };
  });
  const gaps = candles
    .slice(1)
    .filter(
      (bar, index) =>
        bar.time - candles[index].time !== intervals[request.frame] * 60,
    ).length;
  return {
    gaps,
    symbol: request.symbol,
    frame: request.frame,
    exchange: "Kraken",
    pair: request.pair,
    currency: "USD",
    fetchedAt,
    candles,
    lastBarOpen: true,
  };
}
