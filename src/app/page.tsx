import Link from "next/link";
import { Activity, ShieldAlert, TrendDown, TrendUp, Wallet } from "@/components/icons";
import { MarketSummary } from "@/components/market-summary";
import { MacroPanel } from "@/components/macro-panel";
import { AssetRadar } from "@/components/asset-radar";
import { EventsPanel } from "@/components/events-panel";
import { signOut } from "@/app/actions";
import { loadDashboard } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) redirect("/login");

  const dashboard = await loadDashboard(userId);
  const userEmail = typeof claims?.email === "string" ? claims.email : "Cuenta activa";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col px-5 py-4 lg:px-8">
        <header className="mb-2 grid items-center gap-4 border-b border-border/80 pb-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 min-w-16 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 font-mono text-xs font-black tracking-[0.14em] text-cyan-300">
              CLOE
            </div>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300 sm:text-base">
              Market intelligence
            </p>
          </div>

          <div className="order-first text-center md:order-none">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">Panel privado</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">Bruno Dashboard</h1>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link className="button-secondary inline-flex items-center gap-2" href="/carteras">
              <Wallet /> Carteras
            </Link>
            <form action={signOut}>
              <button className="button-danger" type="submit">Salir</button>
            </form>
          </div>
        </header>

        <section aria-label="Resumen del mercado" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="mt-3 grid flex-1 grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="grid content-start gap-3 xl:col-span-8">
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Análisis técnico principal">
              {dashboard.technical.map((asset) => (
                <article className="panel p-4" key={asset.symbol}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="asset-symbol">{asset.mark}</span>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{asset.timeframe}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h2 className="text-lg font-semibold text-white">{asset.symbol}</h2>
                          <span className="font-mono text-sm font-semibold text-zinc-200">{asset.price}</span>
                          {asset.change24h !== null ? (
                            <span
                              className={asset.change24h >= 0 ? "inline-flex items-center gap-1 text-xs text-emerald-300" : "inline-flex items-center gap-1 text-xs text-rose-300"}
                              title={`Variación diaria · ${asset.priceSource}`}
                            >
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

                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                    {asset.levels.map((level) => (
                      <div key={level.label}>
                        <dt className="metric-label">{level.label}</dt>
                        <dd className="mt-1 font-mono text-sm font-semibold text-zinc-200">{level.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-3 flex items-center justify-between rounded-md bg-surface px-3 py-2 text-xs">
                    <span className="text-muted">Confirmación requerida</span>
                    <span className="font-medium text-cyan-300">{asset.trigger}</span>
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

        <section className={dashboard.hasData ? "mt-3 flex items-center justify-between gap-4 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2.5 text-sm text-emerald-100" : "mt-3 flex items-center justify-between gap-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-sm text-amber-100"}>
          <p>
            <strong className={dashboard.hasData ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>
              {dashboard.hasData ? "Histórico activo." : "Esperando el primer análisis."}
            </strong>{" "}
            {dashboard.hasData
              ? "La pantalla refleja los registros privados almacenados en Supabase."
              : "La conexión funciona; los paneles se completarán cuando Cloe guarde datos."}
          </p>
          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300/80 sm:block">
            Producción
          </span>
        </section>

        <footer className="mt-3 grid items-center gap-3 border-t border-border pt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr] xl:text-left">
          <span>DICIPLINA + CONSTANCIA = RESULTADOS</span>
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-end xl:justify-center">
            <span className="max-w-48 truncate" title={userEmail}>{userEmail}</span>
            <span className="inline-flex items-center gap-2">
              <span className={dashboard.hasData ? "status-dot status-dot-live" : "status-dot"} aria-hidden="true" />
              <span className={dashboard.hasData ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>
                {dashboard.hasData ? "Datos sincronizados" : "Base conectada"}
              </span>
            </span>
          </div>
          <span className="sm:col-span-2 sm:text-right xl:col-span-1">Última actualización: {dashboard.lastUpdated}</span>
        </footer>
      </div>
    </main>
  );
}
