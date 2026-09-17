"use client";

import type { MarketStripQuote } from "@/lib/market-prices";

function formatPrice(value: number) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function Change({ label, value }: { label: string; value: number | null }) {
  const className = value === null ? "text-zinc-500" : value >= 0 ? "text-emerald-300" : "text-rose-300";
  const period = label === "24H" ? "Variación diaria" : "Variación anual";
  const text = value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  return <span aria-label={value === null ? `${period}: no disponible` : `${period}: ${text}`} className={className} title={period}>{text}</span>;
}

export function MarketStrip({ quotes, updatedAt, stale, loading }: { quotes: MarketStripQuote[]; updatedAt: string | null; stale: boolean; loading: boolean }) {
  return (
    <section className="market-strip-section border-t border-border" aria-labelledby="market-strip-title">
      <div className="market-strip-header flex flex-wrap items-end justify-between gap-2">
        <div><p className="metric-label">Precios Alt</p><h2 className="mt-1 text-base font-semibold text-white" id="market-strip-title">Mercado seguido</h2></div>
        <p className={stale ? "text-xs text-amber-300" : "text-xs text-muted"} aria-live="polite">
          {loading ? "Actualizando…" : stale ? "Sin conexión · mostrando último dato válido" : updatedAt ? `Actualizado ${new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(updatedAt))}` : "Esperando cotizaciones"}
        </p>
      </div>
      <div className="market-strip" tabIndex={0} aria-label="Cotizaciones con desplazamiento horizontal">
        {quotes.map((quote) => (
          <article className="market-quote" key={quote.symbol}>
            <div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{quote.symbol}</strong><span className="font-mono text-sm font-semibold text-zinc-100">{formatPrice(quote.usd)}</span></div>
            <div className="mt-2 flex justify-between gap-3 font-mono text-[11px]"><Change label="24H" value={quote.change24h} /><Change label="1A" value={quote.change1y} /></div>
          </article>
        ))}
        {quotes.length === 0 ? <div className="market-quote text-sm text-muted">Cotizaciones no disponibles.</div> : null}
      </div>
    </section>
  );
}
