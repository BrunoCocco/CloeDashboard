import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { btcReviewExample } from "@/data/btc-review-example";
import { AnalysisReviewDocument } from "@/components/analysis-review-document";
export const dynamic = "force-dynamic";
export default async function ReviewExample() {
  const db = await createClient();
  const { data, error } = await db.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string" || !data.claims.sub)
    redirect("/login");
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-6xl">
        <Link prefetch={false} href="/" className="text-cyan-300 underline">
          ← Dashboard e histórico real
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Prueba de análisis BTC</h1>
        <p className="mt-3 text-zinc-300">
          Vista privada de ejemplo. No depende de la consulta histórica ni carga
          datos de demostración en la base.
        </p>
        <AnalysisReviewDocument entry={btcReviewExample} />
      </div>
    </main>
  );
}
