import { AnalysisReviewArchive } from "@/components/analysis-review-archive";
import { loadReviewArchive } from "@/lib/analysis-reviews/loader";
import { Suspense } from "react";
import { MarketContextPanel } from "@/components/market-context-panel";
import { signOut } from "@/app/actions";
import Link from "next/link";
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
  const archive = await loadReviewArchive(userId, params);

  const selectedIndex = archive.items.findIndex(
    (item) => item.id === archive.selected?.id,
  );
  const priorItem =
    selectedIndex >= 0
      ? archive.items
          .slice(selectedIndex + 1)
          .find((item) => item.asset === archive.selected?.asset)
      : null;
  const previous = priorItem
    ? (
        await loadReviewArchive(userId, {
          asset: priorItem.asset,
          cut: priorItem.id,
        })
      ).selected
    : null;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 py-4 lg:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-border py-2">
          <h1 className="text-base font-semibold text-white">Cloe ✦</h1>
          <nav
            className="flex gap-5 text-sm text-zinc-300"
            aria-label="Navegación"
          >
            <Link href="/">Análisis</Link>
            <a href="#review-history">Histórico</a>
            <a href="#market-context">Mercado</a>
          </nav>
          <form action={signOut}>
            <button className="button-danger" type="submit">
              Salir
            </button>
          </form>
        </header>

        <AnalysisReviewArchive archive={archive} previous={previous} />
        <Suspense
          fallback={
            <section
              id="market-context"
              className="panel mt-10 p-6"
              role="status"
            >
              Cargando mercado, liquidez y sentimiento…
            </section>
          }
        >
          <MarketContextPanel userId={userId} />
        </Suspense>
      </div>
    </main>
  );
}
