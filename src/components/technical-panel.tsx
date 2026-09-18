import { TrendDown, TrendUp } from "@/components/icons";
import type { DashboardData } from "@/lib/dashboard";

export function TechnicalPanel({ assets }: { assets: DashboardData["technical"] }) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Riesgo técnico de Bitcoin y Solana">
      {assets.map((asset) => (
        <article className="panel p-4" key={asset.symbol}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="asset-symbol">{asset.mark}</span>
              <div>
                <p className="metric-label">{asset.timeframe}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="text-lg font-semibold text-white">{asset.symbol}</h2>
                  <span className="font-mono text-sm font-semibold text-zinc-200">{asset.price}</span>
                  {asset.change24h !== null ? (
                    <span className={asset.change24h >= 0 ? "inline-flex items-center gap-1 text-xs text-emerald-300" : "inline-flex items-center gap-1 text-xs text-rose-300"} title={`Variación diaria · ${asset.priceSource}`}>
                      {asset.change24h >= 0 ? <TrendUp /> : <TrendDown />}
                      {Math.abs(asset.change24h).toFixed(2)}%
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <span className="badge badge-neutral">{asset.bias}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-300">{asset.reading}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3 border-t border-border pt-3">
            {asset.levels.map((level) => {
              const isVolume = level.label.toLocaleLowerCase("es").includes("volumen");
              return (
                <div className={isVolume ? "col-span-2 min-w-0 border-t border-border/70 pt-3" : "min-w-0"} key={level.label}>
                  <dt className="metric-label">{level.label}</dt>
                  <dd className={isVolume ? "mt-1 whitespace-normal break-words font-mono text-sm font-semibold leading-5 text-zinc-200" : "mt-1 font-mono text-sm font-semibold text-zinc-200"}>{level.value}</dd>
                </div>
              );
            })}
          </dl>
          <div className="mt-3 flex items-center justify-between rounded-md bg-surface px-3 py-2 text-xs">
            <span className="text-muted">Confirmación requerida</span>
            <span className="font-medium text-cyan-300">{asset.trigger}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
