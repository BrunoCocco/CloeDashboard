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
          ← Análisis
        </Link>
        <h1 className="sr-only">Ejemplo de análisis</h1>
        <AnalysisReviewDocument entry={btcReviewExample} />
      </div>
    </main>
  );
}
