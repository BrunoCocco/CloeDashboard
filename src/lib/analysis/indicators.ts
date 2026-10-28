import type { Candle } from "./model";
export type Point = { time: number; value: number };
export function sma(candles: Candle[], period = 20): Point[] {
  return candles.flatMap((candle, i) =>
    i < period - 1
      ? []
      : [
          {
            time: candle.time,
            value:
              candles
                .slice(i + 1 - period, i + 1)
                .reduce((sum, bar) => sum + bar.close, 0) / period,
          },
        ],
  );
}
export function bollinger(candles: Candle[], period = 20, multiplier = 2) {
  const middle = sma(candles, period);
  return {
    middle,
    upper: middle.map((point, i) => ({
      ...point,
      value:
        point.value +
        multiplier *
          Math.sqrt(
            candles
              .slice(i, i + period)
              .reduce((sum, bar) => sum + (bar.close - point.value) ** 2, 0) /
              period,
          ),
    })),
    lower: middle.map((point, i) => ({
      ...point,
      value:
        point.value -
        multiplier *
          Math.sqrt(
            candles
              .slice(i, i + period)
              .reduce((sum, bar) => sum + (bar.close - point.value) ** 2, 0) /
              period,
          ),
    })),
  };
}
// Wilder RSI from HL2; EMA14 is a separate smoothing line.
export function rsi(candles: Candle[], period = 14): Point[] {
  let gain = 0,
    loss = 0;
  const result: Point[] = [];
  for (let i = 1; i < candles.length; i++) {
    const change =
      (candles[i].high +
        candles[i].low -
        candles[i - 1].high -
        candles[i - 1].low) /
      2;
    if (i <= period) {
      gain += Math.max(change, 0) / period;
      loss += Math.max(-change, 0) / period;
    } else {
      gain = (gain * (period - 1) + Math.max(change, 0)) / period;
      loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
    }
    if (i >= period)
      result.push({
        time: candles[i].time,
        value:
          gain === 0 && loss === 0
            ? 50
            : loss === 0
              ? 100
              : 100 - 100 / (1 + gain / loss),
      });
  }
  return result;
}
export function ema(points: Point[], period = 14): Point[] {
  if (points.length < period) return [];
  let value =
    points.slice(0, period).reduce((sum, p) => sum + p.value, 0) / period;
  return points.slice(period - 1).map((point, index) => {
    if (index) value += (2 / (period + 1)) * (point.value - value);
    return { time: point.time, value };
  });
}
// A weekly bar may cross a quarter boundary: do not approximate quarterly anchors
// from weekly OHLC. Compute on daily HL2/volume, then sample at each weekly close.
export function quarterlyVwap(daily: Candle[], weekly: Candle[]): Point[] {
  let quarter = "",
    weighted = 0,
    volume = 0;
  let completeQuarter = false;
  const dailyPoints = daily.map((bar, index) => {
    const date = new Date(bar.time * 1000);
    const key = `${date.getUTCFullYear()}-${Math.floor(date.getUTCMonth() / 3)}`;
    if (key !== quarter) {
      quarter = key;
      weighted = 0;
      volume = 0;
      completeQuarter =
        index > 0 || (date.getUTCMonth() % 3 === 0 && date.getUTCDate() === 1);
    }
    weighted += ((bar.high + bar.low) / 2) * bar.volume;
    volume += bar.volume;
    return {
      time: bar.time,
      value: completeQuarter && volume > 0 ? weighted / volume : null,
    };
  });
  return weekly.flatMap((week) => {
    const point = dailyPoints
      .filter((p) => p.time >= week.time && p.time < week.time + 7 * 86400)
      .at(-1);
    return point?.value != null
      ? [{ time: week.time, value: point.value }]
      : [];
  });
}
