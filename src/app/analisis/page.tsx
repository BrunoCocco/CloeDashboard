import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/dashboard";
import { AnalysisWorkspace } from "@/components/analysis/workspace";
import { MacroPanel } from "@/components/macro-panel";
import { EventsPanel } from "@/components/events-panel";
import { AnalystSynthesisPanel } from "@/components/analyst-synthesis";
export const dynamic = "force-dynamic";
export default async function AnalysisPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) redirect("/login");
  let dashboard: Awaited<ReturnType<typeof loadDashboard>> | null = null;
  try {
    dashboard = await loadDashboard(userId);
  } catch {
    /* Charts remain usable if analytical storage is unavailable. */
  }
  return (
    <main className="mx-auto max-w-[1920px] px-4 py-5 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <Link
          href="/"
          className="font-mono text-sm font-bold tracking-widest text-cyan-300"
        >
          CLOE <span className="font-normal text-muted">/ ANALISTA</span>
        </Link>
        <nav className="flex gap-2" aria-label="Secciones">
          <Link href="/" className="nav-item">
            Dashboard
          </Link>
          <Link
            href="/analisis"
            className="nav-item nav-item-active"
            aria-current="page"
          >
            Espacio de análisis
          </Link>
        </nav>
      </header>
      <AnalysisWorkspace
        userId={userId}
        context={{
          available: Boolean(dashboard?.hasData),
          cutoff: dashboard?.lastUpdated ?? "Sin corte verificable",
          summary: dashboard?.analyst.conclusion ?? null,
        }}
      />
      <section
        className="mt-8 border-t border-border pt-6"
        aria-label="Contexto del dashboard"
      >
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">
          Contexto independiente del gráfico
        </p>
        <h2 className="mb-4 mt-2 text-lg font-semibold">
          La información de tu Dashboard, en el mismo lugar.
        </h2>
        {dashboard ? (
          <>
            <p className="mb-3 text-xs text-muted">
              Último corte disponible: {dashboard.lastUpdated}. No implica que
              el análisis se haya actualizado hoy.
            </p>
            <AnalystSynthesisPanel analysis={dashboard.analyst} />
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <MacroPanel metrics={dashboard.macro} />
              <EventsPanel events={dashboard.events} />
            </div>
          </>
        ) : (
          <div className="panel p-5 text-sm text-amber-200">
            No se pudo recuperar el contexto privado del Dashboard. Los gráficos
            y tus notas locales funcionan de forma independiente. No se
            sustituyó el contexto por datos de demostración.
          </div>
        )}
      </section>
    </main>
  );
}
