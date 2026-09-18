"use client";

import { memo, useEffect, useRef, useState } from "react";

const SCRIPT_URL = "https://s3.tradingview.com/tv.js";

type TradingViewWidget = new (options: Record<string, unknown>) => unknown;
declare global {
  interface Window {
    TradingView?: { widget: TradingViewWidget };
    __cloeTradingViewMounts?: number;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTradingView() {
  if (window.TradingView) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => window.TradingView ? resolve() : reject(new Error("TradingView no quedó disponible"));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("No se pudo cargar TradingView")), { once: true });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);
    }
  });
  return scriptPromise;
}

const TradingViewChart = memo(function TradingViewChart({ id, symbol, interval, title }: { id: string; symbol: string; interval: "D" | "M"; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadTradingView().then(() => {
      if (!active || !containerRef.current || !window.TradingView) return;
      containerRef.current.replaceChildren();
      new window.TradingView.widget({
        container_id: id,
        symbol,
        interval,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "es",
        toolbar_bg: "#131722",
        enable_publishing: false,
        hide_side_toolbar: false,
        hide_top_toolbar: false,
        allow_symbol_change: true,
        save_image: false,
        autosize: true,
      });
      window.__cloeTradingViewMounts = (window.__cloeTradingViewMounts ?? 0) + 1;
    }).catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [id, interval, symbol]);

  return (
    <section className="chart-panel" aria-label={title} data-chart-id={id}>
      {failed ? <p className="grid h-full place-items-center text-sm text-rose-300">No se pudo cargar TradingView.</p> : <div className="h-full min-h-0 w-full" id={id} ref={containerRef} />}
    </section>
  );
});

export const TradingViewCharts = memo(function TradingViewCharts() {
  return (
    <section className="tradingview-workspace" aria-labelledby="charts-title">
      <div className="charts-header flex items-end justify-between gap-4">
        <div><p className="metric-label">Espacio de trabajo</p><h2 className="mt-1 text-lg font-semibold text-white" id="charts-title">Gráficos interactivos</h2></div>
        <span className="hidden text-xs text-muted sm:block">Dibujos e indicadores se conservan durante la sesión</span>
      </div>
      <div className="charts-grid">
        <TradingViewChart id="tradingview_btc_monthly" interval="M" symbol="BINANCE:BTCUSD" title="Bitcoin · Mensual" />
        <TradingViewChart id="tradingview_btc_daily" interval="D" symbol="BINANCE:BTCUSD" title="Bitcoin · Diario" />
        <TradingViewChart id="tradingview_sol_monthly" interval="M" symbol="BINANCE:SOLUSD" title="Solana · Mensual" />
      </div>
    </section>
  );
});
