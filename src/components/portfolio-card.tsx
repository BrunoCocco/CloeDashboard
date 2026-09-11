import type { PortfolioView } from "@/lib/portfolios";
import { formatMoney } from "@/lib/portfolios";

function formatPct(value: number | null) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function PortfolioCard({ portfolio }: { portfolio: PortfolioView }) {
  const isSpot = portfolio.type === "spot";
  const performanceClass = portfolio.returnPct === null
    ? "text-muted"
    : portfolio.returnPct >= 0 ? "text-emerald-300" : "text-rose-300";

  return (
    <article className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="metric-label">{isSpot ? "Cartera Spot" : "Cartera Futuros"}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{portfolio.name}</h2>
          <p className="mt-1 text-xs text-muted">
            {portfolio.mode === "real" ? "Real" : "Simulación"}
            {portfolio.informationDate ? ` · Posiciones informadas el ${portfolio.informationDate}` : " · Sin posiciones registradas"}
          </p>
        </div>
        <span className={portfolio.mode === "real" ? "badge badge-neutral" : "badge badge-warning"}>
          {portfolio.mode === "real" ? "Real" : "Prueba"}
        </span>
      </div>

      {portfolio.positions.length > 0 ? (
        <>
          <section className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3" aria-label="Totales de cartera">
            <div className="bg-panel px-5 py-4">
              <p className="metric-label">Capital base</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatMoney(portfolio.totalCost, portfolio.currency)}</p>
            </div>
            <div className="bg-panel px-5 py-4">
              <p className="metric-label">Valor actual</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatMoney(portfolio.totalValue, portfolio.currency)}</p>
            </div>
            <div className="col-span-2 bg-panel px-5 py-4 sm:col-span-1">
              <p className="metric-label">Rendimiento</p>
              <p className={`mt-2 text-lg font-semibold ${performanceClass}`}>{formatPct(portfolio.returnPct)}</p>
            </div>
          </section>

          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="metric-label">Distribución y progreso</p>
                <h3 className="mt-1 text-sm font-semibold text-white">Posiciones abiertas</h3>
              </div>
              <span className="text-xs text-muted">Precio actual vía CoinGecko</span>
            </div>

            <div className="space-y-4">
              {portfolio.positions.map((position) => (
                <div key={position.symbol}>
                  <div className="mb-2 flex items-end justify-between gap-4 text-sm">
                    <div>
                      <strong className="text-white">{position.symbol}</strong>
                      <span className="ml-2 text-xs text-muted">{position.quantity} u. · PM {position.averageEntry}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-zinc-300">{position.currentPrice}</span>
                      <span className={position.returnPct === null ? "ml-2 text-xs text-muted" : position.returnPct >= 0 ? "ml-2 text-xs text-emerald-300" : "ml-2 text-xs text-rose-300"}>
                        {formatPct(position.returnPct)}
                      </span>
                    </div>
                  </div>
                  <div className="portfolio-track" aria-label={`${position.symbol}: ${position.allocationPct.toFixed(1)}% de la cartera`}>
                    <span className="portfolio-fill" style={{ width: `${Math.max(position.allocationPct, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="p-5">
          <div className="rounded-lg border border-dashed border-border bg-surface/40 p-6 text-center">
            <p className="text-sm font-medium text-zinc-200">Sin posiciones registradas</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              {isSpot
                ? "La cartera comenzará a medir progreso cuando se cargue una posición."
                : "El operador sigue en modo de prueba. Las operaciones simuladas aparecerán aquí sin mezclarse con capital real."}
            </p>
          </div>
          {!isSpot ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-zinc-300">Backtesting del operador</span>
                <span className="font-mono text-muted">0 / 30 operaciones</span>
              </div>
              <div className="portfolio-track"><span className="portfolio-fill" style={{ width: "0%" }} /></div>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
