"use client";

import { useEffect, useRef, useState } from "react";
import { ChartEditor } from "./chart-editor";
import styles from "./bitcoin-weekly-chart.module.css";

const chartUrl = "https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT&interval=W";

export function BitcoinWeeklyChart({ userId }: { userId: string }) {
  const screenRef = useRef<HTMLElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");

  useEffect(() => {
    const host = widgetRef.current;
    if (!host) return;

    // Isolate the embed's DOM from React and clean it up on Strict Mode remounts.
    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.cssText = "height:100%;width:100%";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.cssText = "height:100%;width:100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: "BINANCE:BTCUSDT",
      interval: "W",
      timezone: "Europe/Madrid",
      theme: "dark",
      style: "1",
      locale: "es",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_volume: false,
      withdateranges: true,
      save_image: true,
      calendar: false,
      details: false,
      hotlist: false,
      support_host: "https://www.tradingview.com",
    });
    script.onerror = () => setLoadFailed(true);
    container.appendChild(script);
    host.appendChild(container);

    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === screenRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      script.onerror = null;
      container.remove();
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (screenRef.current?.requestFullscreen) {
        await screenRef.current.requestFullscreen();
      } else {
        setFullscreenError("Este navegador no permite ocultar sus barras. El gráfico ya ocupa toda la vista.");
      }
    } catch {
      setFullscreenError("No se pudo activar la pantalla completa. El gráfico sigue ocupando toda la vista.");
    }
  }

  return (
    <main ref={screenRef} className={styles.screen} aria-label="Gráfico de Bitcoin semanal">
      <div className={styles.chart}>
        <div ref={widgetRef} style={{ position: "absolute", inset: 0 }} />
        <ChartEditor key={userId} userId={userId} />
      </div>
      {loadFailed ? (
        <p role="alert" className={styles.notice}>
          No se pudo cargar TradingView. <a href={chartUrl} target="_blank" rel="noopener noreferrer">Abrir Bitcoin semanal</a>
        </p>
      ) : null}
      {fullscreenError ? <p role="status" className={styles.notice}>{fullscreenError}</p> : null}
      <footer className={styles.footer}>
        <a href="https://www.tradingview.com/symbols/BTCUSDT/?exchange=BINANCE" target="_blank" rel="noopener nofollow noreferrer">
          BTCUSDT por TradingView
        </a>
        <button type="button" onClick={toggleFullscreen} aria-pressed={isFullscreen}>
          {isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        </button>
      </footer>
    </main>
  );
}
