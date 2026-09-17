import Link from "next/link";
import { Wallet } from "@/components/icons";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { signOut } from "@/app/actions";
import { loadDashboard } from "@/lib/dashboard";
import { loadMarketStrip } from "@/lib/market-prices";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) redirect("/login");

  const [dashboard, marketResult] = await Promise.all([
    loadDashboard(userId),
    loadMarketStrip().then((market) => ({ ...market, stale: false })).catch(() => ({ quotes: [], updatedAt: null, stale: true })),
  ]);
  const userEmail = typeof claims?.email === "string" ? claims.email : "Cuenta activa";

  return (
    <main className="dashboard-page bg-background text-foreground">
      <div className="dashboard-shell">
        <header className="dashboard-header grid items-center gap-4 border-b border-border/80 md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 min-w-16 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 font-mono text-xs font-black tracking-[0.14em] text-cyan-300">CLOE</div>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300 sm:text-base">Market intelligence</p>
          </div>
          <div className="order-first text-center md:order-none"><p className="metric-label">Panel privado</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-white">Bruno Dashboard</h1></div>
          <div className="flex items-center justify-end gap-2">
            <Link className="button-secondary inline-flex items-center gap-2" href="/carteras"><Wallet /> Carteras</Link>
            <form action={signOut}><button className="button-danger" type="submit">Salir</button></form>
          </div>
        </header>
        <DashboardWorkspace initialDashboard={dashboard} initialMarket={marketResult} />
        <footer className="dashboard-footer grid items-center gap-3 border-t border-border text-center font-mono text-[10px] uppercase tracking-wider text-muted sm:grid-cols-2">
          <span className="sm:text-left">DISCIPLINA + CONSTANCIA = RESULTADOS</span>
          <span className="max-w-full truncate sm:text-right" title={userEmail}>{userEmail}</span>
        </footer>
      </div>
    </main>
  );
}
