import { AnalysisReviewArchive } from "@/components/analysis-review-archive";
import { loadReviewArchive } from "@/lib/analysis-reviews/loader";
import { Activity, ShieldAlert, TrendDown, TrendUp } from "@/components/icons";
import { MarketSummary } from "@/components/market-summary";
import { MacroPanel } from "@/components/macro-panel";
import { AssetRadar } from "@/components/asset-radar";
import { EventsPanel } from "@/components/events-panel";
import { AnalystSynthesisPanel } from "@/components/analyst-synthesis";
import { signOut } from "@/app/actions";
import Link from "next/link";
import { loadMarketContext } from "@/lib/analysis-reviews/context";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    asset?: string;
    cut?: string;
    before?: string;
    context?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) redirect("/login");

  const params = await searchParams;
  const [context, archive] = await Promise.all([
    loadMarketContext(userId, params.context),
    loadReviewArchive(userId, params),
  ]);

  const dashboard = context.status === "available" ? context.dashboard : null;
  const contextParams = new URLSearchParams();
  for (const key of ["asset", "cut", "before"] as const)
    if (typeof params[key] === "string" && params[key])
      contextParams.set(key, params[key]);
  contextParams.set("context", "1");
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col px-5 py-4 lg:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-border py-2">
          <h1 className="text-base font-semibold text-white">
            Cloe · Análisis
          </h1>
          <form action={signOut}>
            <button className="button-danger" type="submit">
              Salir
            </button>
          </form>
        </header>

        <AnalysisReviewArchive archive={archive} />
        {dashboard ? (
          <details
            open
            id="market-context"
            className="mt-4 rounded-lg border border-border p-4"
          >
            <summary className="cursor-pointer text-sm text-zinc-300">
              Contexto de mercado · {dashboard.lastUpdated}
            </summary>
            <p className="mt-3 text-xs text-muted">
              Fuentes y fechas independientes del corte técnico.
            </p>
            <section
              aria-label="Resumen del mercado"
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {dashboard.summary.map((item, index) => {
                const Icon = [Activity, ShieldAlert][index];
                return (
                  <MarketSummary
                    className="xl:col-span-2"
                    icon={<Icon />}
                    item={item}
                    key={item.label}
                  />
                );
              })}
            </section>

            <div className="mt-3">
              <AnalystSynthesisPanel analysis={dashboard.analyst} />
            </div>

            <section className="mt-3 grid flex-1 grid-cols-1 gap-3 xl:grid-cols-12">
              <div className="grid content-start gap-3 xl:col-span-8">
                <section
                  className="grid grid-cols-1 gap-3 md:grid-cols-2"
                  aria-label="Análisis técnico principal"
                >
                  {dashboard.technical.map((asset) => (
                    <article className="panel p-4" key={asset.symbol}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="asset-symbol">{asset.mark}</span>
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                              {asset.timeframe}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h2 className="text-lg font-semibold text-white">
                                {asset.symbol}
                              </h2>
                              <span className="font-mono text-sm font-semibold text-zinc-200">
                                {asset.price}
                              </span>
                              {asset.change24h !== null ? (
                                <span
                                  className={
                                    asset.change24h >= 0
                                      ? "inline-flex items-center gap-1 text-xs text-emerald-300"
                                      : "inline-flex items-center gap-1 text-xs text-rose-300"
                                  }
                                  title={`Variación diaria · ${asset.priceSource}`}
                                >
                                  {asset.change24h >= 0 ? (
                                    <TrendUp />
                                  ) : (
                                    <TrendDown />
                                  )}
                                  {Math.abs(asset.change24h).toFixed(2)}%
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <span className="badge badge-neutral">
                          {asset.bias}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-zinc-300">
                        {asset.reading}
                      </p>

                      <dl className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3 border-t border-border pt-3">
                        {asset.levels.map((level) => {
                          const isVolume = level.label
                            .toLocaleLowerCase("es")
                            .includes("volumen");

                          return (
                            <div
                              className={
                                isVolume
                                  ? "col-span-2 min-w-0 border-t border-border/70 pt-3"
                                  : "min-w-0"
                              }
                              key={level.label}
                            >
                              <dt className="metric-label">{level.label}</dt>
                              <dd
                                className={
                                  isVolume
                                    ? "mt-1 whitespace-normal break-words font-mono text-sm font-semibold leading-5 text-zinc-200"
                                    : "mt-1 font-mono text-sm font-semibold text-zinc-200"
                                }
                              >
                                {level.value}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>

                      <div className="mt-3 flex items-center justify-between rounded-md bg-surface px-3 py-2 text-xs">
                        <span className="text-muted">
                          Confirmación requerida
                        </span>
                        <span className="font-medium text-cyan-300">
                          {asset.trigger}
                        </span>
                      </div>
                    </article>
                  ))}
                </section>

                <AssetRadar assets={dashboard.assets} />
              </div>

              <aside className="grid content-start gap-3 xl:col-span-4">
                <MacroPanel metrics={dashboard.macro} />
                <EventsPanel events={dashboard.events} />
              </aside>
            </section>
          </details>
        ) : context.status === "not-requested" ? (
          <Link
            prefetch={false}
            href={`/?${contextParams}#market-context`}
            className="mt-4 rounded-lg border border-border p-4 text-sm text-zinc-300"
          >
            Contexto de mercado
          </Link>
        ) : (
          <details
            open
            id="market-context"
            className="mt-4 rounded-lg border border-border p-4"
          >
            <summary className="cursor-pointer text-sm text-muted">
              Contexto de mercado · sin actualización
            </summary>
            <p className="mt-3 text-sm">
              No se pudieron consultar estos módulos.
            </p>
          </details>
        )}
      </div>
    </main>
  );
}
