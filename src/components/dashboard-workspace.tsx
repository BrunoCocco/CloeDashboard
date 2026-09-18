"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ShieldAlert } from "@/components/icons";
import { MarketSummary } from "@/components/market-summary";
import { TechnicalPanel } from "@/components/technical-panel";
import { AssetRadar } from "@/components/asset-radar";
import { MacroPanel } from "@/components/macro-panel";
import { EventsPanel } from "@/components/events-panel";
import { InterpretationPanel } from "@/components/interpretation-panel";
import { PortfolioCard } from "@/components/portfolio-card";
import { TradingViewCharts } from "@/components/tradingview-charts";
import { MarketStrip } from "@/components/market-strip";
import type { DashboardData } from "@/lib/dashboard";
import type { MarketStripQuote } from "@/lib/market-prices";
import type { PortfoliosPageData } from "@/lib/portfolios";

const DASHBOARD_REFRESH_MS = 60 * 60 * 1_000;
const MARKET_REFRESH_MS = 5 * 60 * 1_000;
type Tab = "general" | "radar" | "macro" | "fechas" | "carteras";

const tabs: { id: Tab; label: string }[] = [
  { id: "general", label: "General" }, { id: "radar", label: "Radar" },
  { id: "macro", label: "Macro" }, { id: "fechas", label: "Fechas" }, { id: "carteras", label: "Carteras" },
];

export function DashboardWorkspace({ initialDashboard, initialMarket, initialPortfolios }: { initialDashboard: DashboardData; initialMarket: { quotes: MarketStripQuote[]; updatedAt: string | null; stale: boolean }; initialPortfolios: PortfoliosPageData }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [dashboardStale, setDashboardStale] = useState(false);
  const [market, setMarket] = useState({ quotes: initialMarket.quotes, updatedAt: initialMarket.updatedAt });
  const [marketStale, setMarketStale] = useState(initialMarket.stale);
  const [marketLoading, setMarketLoading] = useState(false);

  const refreshDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Dashboard no disponible");
      setDashboard(await response.json() as DashboardData);
      setDashboardStale(false);
    } catch { setDashboardStale(true); }
  }, []);

  const refreshMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const response = await fetch("/api/market-strip", { cache: "no-store" });
      if (!response.ok) throw new Error("Mercado no disponible");
      setMarket(await response.json() as { quotes: MarketStripQuote[]; updatedAt: string });
      setMarketStale(false);
    } catch { setMarketStale(true); }
    finally { setMarketLoading(false); }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(refreshDashboard, DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refreshDashboard]);
  useEffect(() => {
    const interval = window.setInterval(refreshMarket, MARKET_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refreshMarket]);

  return <div className="dashboard-workspace">
    <section className="dashboard-content" aria-label="Panel de mercado de Cloe">
      <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-border bg-panel p-1" role="tablist" aria-label="Secciones del dashboard">
        {tabs.map((tab) => <button aria-controls={`panel-${tab.id}`} aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "dashboard-tab dashboard-tab-active" : "dashboard-tab"} id={`tab-${tab.id}`} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </div>
      <div className={activeTab === "carteras" ? "dashboard-tab-panel dashboard-tab-panel-scroll" : "dashboard-tab-panel"} id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "general" ? <div className="grid gap-3">
          <section aria-label="Resumen del mercado" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dashboard.summary.map((item, index) => { const Icon = [Activity, ShieldAlert][index] ?? Activity; return <MarketSummary icon={<Icon />} item={item} key={item.label} />; })}
          </section>
          <TechnicalPanel assets={dashboard.technical} />
        </div> : null}
        {activeTab === "radar" ? <div className="dashboard-radar-container"><AssetRadar assets={dashboard.assets} /></div> : null}
        {activeTab === "macro" ? (
          <div className="dashboard-insight-layout">
            <MacroPanel metrics={dashboard.macro} />
            <InterpretationPanel eyebrow="Síntesis diaria" title="Lectura de Cloe" text={dashboard.macroInterpretation} />
          </div>
        ) : null}
        {activeTab === "fechas" ? (
          <div className="dashboard-insight-layout">
            <EventsPanel events={dashboard.events} />
            <InterpretationPanel eyebrow="Síntesis diaria" title="Impacto de próximas fechas" text={dashboard.datesInterpretation} />
          </div>
        ) : null}
        {activeTab === "carteras" ? (
          <section className="portfolio-tab-grid grid content-start gap-3 md:grid-cols-2" aria-label="Carteras privadas">
            {initialPortfolios.portfolios.map((portfolio) => (
              <PortfolioCard key={portfolio.id} operator={initialPortfolios.operator} portfolio={portfolio} />
            ))}
          </section>
        ) : null}
      </div>
      <p className={`dashboard-update-status ${dashboardStale ? "text-amber-300" : "text-muted"}`} aria-live="polite">
        {dashboardStale ? "Actualización fallida · se conserva el último dato válido" : `Actualización automática cada hora · corte ${dashboard.lastUpdated}`}
      </p>
    </section>
    <TradingViewCharts />
    <MarketStrip loading={marketLoading} quotes={market.quotes} stale={marketStale} updatedAt={market.updatedAt} />
  </div>;
}
