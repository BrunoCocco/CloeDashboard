import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { ArrowLeft } from "@/components/icons";
import { PortfolioCard } from "@/components/portfolio-card";
import { loadPortfolios } from "@/lib/portfolios";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) redirect("/login");

  const portfolios = await loadPortfolios(userId);
  const userEmail = typeof claims?.email === "string" ? claims.email : "Cuenta activa";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 py-4 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-4">
            <div className="grid size-11 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 font-mono text-sm font-black tracking-[0.16em] text-cyan-300">BD</div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-cyan-300">Área privada</p>
              <h1 className="text-xl font-semibold tracking-tight text-white">Carteras</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link className="button-secondary inline-flex items-center gap-2" href="/">
              <ArrowLeft /> Volver al dashboard
            </Link>
            <div className="hidden text-right sm:block">
              <p className="max-w-44 truncate font-mono text-[10px] uppercase tracking-wider text-muted">{userEmail}</p>
              <p className="text-xs font-medium text-emerald-300">Sesión privada</p>
            </div>
            <form action={signOut}><button className="button-ghost" type="submit">Salir</button></form>
          </div>
        </header>

        <section className="my-5">
          <p className="metric-label">Seguimiento separado</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Spot y Futuros</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Capital real, simulación y resultados se mantienen independientes.</p>
        </section>

        <section className="grid content-start gap-4 xl:grid-cols-2" aria-label="Carteras privadas">
          {portfolios.map((portfolio) => <PortfolioCard key={portfolio.id} portfolio={portfolio} />)}
        </section>

        <footer className="mt-auto pt-6 text-center font-mono text-[10px] uppercase tracking-wider text-muted">
          Información privada · no incluida en el dashboard principal
        </footer>
      </div>
    </main>
  );
}
