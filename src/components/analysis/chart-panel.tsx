"use client";
import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  bollinger,
  ema,
  quarterlyVwap,
  rsi,
  sma,
  type Point,
} from "@/lib/analysis/indicators";
import type { CandleBatch, Frame, Level } from "@/lib/analysis/model";

type Props = {
  frame: Frame;
  batch?: CandleBatch;
  daily?: CandleBatch;
  error?: string;
  levels: Level[];
  onLevel: (price: number) => void;
};
const labels = { "1W": "Semanal", "1D": "Diario", "4H": "4 horas" };
const descriptions = {
  "1W": "VWAP trimestral · HL2 · RSI14 / EMA14",
  "1D": "SMA20 · RSI14 HL2 / EMA14",
  "4H": "Bollinger 20 / 2σ",
};
export function ChartPanel({
  frame,
  batch,
  daily,
  error,
  levels,
  onLevel,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const onLevelRef = useRef(onLevel);
  useEffect(() => {
    onLevelRef.current = onLevel;
  }, [onLevel]);
  useEffect(() => {
    if (!host.current || !batch?.candles.length) return;
    const chart = createChart(host.current, {
      autoSize: true,
      height: frame === "4H" ? 265 : 325,
      layout: {
        background: { type: ColorType.Solid, color: "#0b1018" },
        textColor: "#8b98ab",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#16202c" },
        horzLines: { color: "#16202c" },
      },
      timeScale: { timeVisible: frame === "4H" },
      rightPriceScale: { borderColor: "#263445" },
    });
    chartRef.current = chart;
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185",
      priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
    });
    seriesRef.current = candles;
    candles.setData(
      batch.candles.map((bar) => ({ ...bar, time: bar.time as UTCTimestamp })),
    );
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volume
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      batch.candles.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.volume,
        color: bar.close >= bar.open ? "#34d39935" : "#fb718535",
      })),
    );
    const line = (points: Point[], color: string, pane = 0) => {
      const series = chart.addSeries(
        LineSeries,
        {
          color,
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        },
        pane,
      );
      series.setData(
        points.map((point) => ({ ...point, time: point.time as UTCTimestamp })),
      );
      return series;
    };
    if (frame === "1W" && daily)
      line(quarterlyVwap(daily.candles, batch.candles), "#ff9800");
    if (frame === "1D") line(sma(batch.candles), "#38bdf8");
    if (frame === "4H") {
      const bb = bollinger(batch.candles);
      line(bb.middle, "#38bdf8");
      line(bb.upper, "#a78bfa");
      line(bb.lower, "#a78bfa");
    }
    if (frame !== "4H") {
      const points = rsi(batch.candles);
      const rs = line(points, "#c4b5fd", 1);
      line(ema(points), "#67e8f9", 1);
      rs.createPriceLine({
        price: 50,
        color: "#ff69b4",
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "50",
      });
      chart.panes()[1]?.setHeight(75);
    }
    chart.subscribeClick((event) => {
      if (event.point && event.paneIndex === 0) {
        const price = candles.coordinateToPrice(event.point.y);
        if (price !== null && price > 0 && event.sourceEvent?.ctrlKey)
          onLevelRef.current(price);
      }
    });
    chart.timeScale().fitContent();
    return () => {
      chartRef.current = null;
      seriesRef.current = null;
      chart.remove();
    };
  }, [batch, daily, frame]);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const lines = levels.map((level) =>
      series.createPriceLine({
        price: level.price,
        color: "#fbbf24",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.label,
      }),
    );
    return () => {
      if (seriesRef.current === series)
        for (const line of lines) series.removePriceLine(line);
    };
  }, [levels, batch, daily]);
  const png = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${batch?.symbol}-${frame}-Kraken.png`;
    a.click();
  };
  return (
    <article className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-cyan-300">
            {frame}
          </span>
          <h2 className="text-sm font-semibold">{labels[frame]}</h2>
          <span className="hidden text-[11px] text-muted sm:inline">
            {descriptions[frame]}
          </span>
        </div>
        <button
          onClick={png}
          disabled={!batch || Boolean(error)}
          className="text-xs text-muted hover:text-white disabled:opacity-30"
          type="button"
        >
          ↓ PNG
        </button>
      </div>
      {error ? (
        <p role="alert" className="p-8 text-sm text-amber-200">
          {error}
        </p>
      ) : !batch ? (
        <p className="p-8 text-sm text-muted">
          Consultando velas verificables…
        </p>
      ) : (
        <div
          ref={host}
          aria-label={`Gráfico ${batch.symbol} ${labels[frame]}`}
        />
      )}
      <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-2 text-[10px] text-muted">
        <span>
          {batch
            ? `${batch.pair} · Kraken Spot · USD · ${batch.candles.length} velas · UTC`
            : "Kraken · Spot · USD"}
        </span>
        <span>
          {batch
            ? `Última vela abierta · consulta ${new Date(batch.fetchedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} Madrid`
            : "Sin datos"}
        </span>
      </div>
      {batch ? (
        <p className="px-4 pb-2 text-[10px] text-muted">
          Histórico reciente del proveedor, sin archivo completo. Última
          apertura: {new Date(batch.candles.at(-1)!.time * 1000).toISOString()}
          {batch.gaps
            ? ` · ${batch.gaps} huecos detectados: indicadores pueden ser incompletos.`
            : ""}
        </p>
      ) : null}
      {frame === "1W" && batch && !daily ? (
        <p className="px-4 pb-2 text-xs text-amber-300">
          VWAP pendiente: falta serie diaria para anclar el trimestre.
        </p>
      ) : null}
    </article>
  );
}
