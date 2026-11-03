import { loadMarketContext } from "@/lib/analysis-reviews/context";
import { MacroPanel } from "@/components/macro-panel";
import { EventsPanel } from "@/components/events-panel";
import { AnalystSynthesisPanel } from "@/components/analyst-synthesis";

export async function MarketContextPanel({ userId }: { userId: string }) {
  const context = await loadMarketContext(userId, "1");
  if (context.status !== "available")
    return (
      <section id="market-context" className="panel mt-8 p-6">
        <h2 className="text-xl font-semibold">Mercado y liquidez</h2>
        <p className="mt-3 text-sm text-amber-200" role="status">
          No se pudo consultar el contexto de mercado. El análisis técnico de
          arriba conserva su propio corte.
        </p>
      </section>
    );
  const dashboard = context.dashboard;
  return (
    <section
      id="market-context"
      className="mt-10 scroll-mt-6"
      aria-labelledby="market-context-heading"
    >
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="metric-label text-cyan-300">
            CONTEXTO INDEPENDIENTE DEL GRÁFICO
          </p>
          <h2
            id="market-context-heading"
            className="mt-2 text-2xl font-semibold text-white"
          >
            Mercado, liquidez y sentimiento
          </h2>
        </div>
        <p className="text-xs text-zinc-400">
          Última revisión guardada · {dashboard.lastUpdated}
        </p>
      </header>
      <div className="mb-5">
        <AnalystSynthesisPanel analysis={dashboard.analyst} />
      </div>
      <MacroPanel metrics={dashboard.macro} />
      <div className="mt-5">
        <EventsPanel events={dashboard.events} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Cada indicador conserva su fecha de observación. Abrir la página no
        ejecuta un nuevo análisis ni actualiza automáticamente las fuentes.
      </p>
    </section>
  );
}
