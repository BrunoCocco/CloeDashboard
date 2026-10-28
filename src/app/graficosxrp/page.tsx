import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GraficosXrpView from "@/components/graficosxrp/view";

export const dynamic = "force-dynamic";

export default async function GraficosXrpPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) redirect("/login");
  return <GraficosXrpView />;
}
