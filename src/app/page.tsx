import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { signOut } from "@/app/actions";
import { loadDashboard } from "@/lib/dashboard";
import { loadMarketStrip } from "@/lib/market-prices";
import { loadPortfolios } from "@/lib/portfolios";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) redirect("/login");

  const [dashboard, marketResult, portfolioData] = await Promise.all([
    loadDashboard(userId),
    loadMarketStrip().then((market) => ({ ...market, stale: false })).catch(() => ({ quotes: [], updatedAt: null, stale: true })),
    loadPortfolios(userId),
  ]);
  const userEmail = typeof claims?.email === "string" ? claims.email : "Cuenta activa";

  return (
    <main className="dashboard-page bg-background text-foreground">
      <div className="dashboard-shell">
        <header className="dashboard-header flex items-center justify-between gap-4 border-b border-border/80">
          <div className="dashboard-brand flex items-center gap-3">
            <div className="dashboard-brand-mark grid place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 font-mono font-black tracking-[0.14em] text-cyan-300">CLOE</div>
            <p className="dashboard-brand-title font-mono font-semibold uppercase tracking-[0.18em] text-cyan-300">Market intelligence</p>
          </div>
          <form action={signOut}><button className="button-danger dashboard-signout" type="submit">Salir</button></form>
        </header>
        <DashboardWorkspace initialDashboard={dashboard} initialMarket={marketResult} initialPortfolios={portfolioData} />
        <footer className="dashboard-footer grid items-center gap-3 border-t border-border text-center font-mono text-[10px] uppercase tracking-wider text-muted sm:grid-cols-2">
          <span className="sm:text-left">DISCIPLINA + CONSTANCIA = RESULTADOS</span>
          <span className="max-w-full truncate sm:text-right" title={userEmail}>{userEmail}</span>
        </footer>
      </div>
    </main>
  );
}
