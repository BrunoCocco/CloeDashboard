import { loadDashboard } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  try {
    return Response.json(await loadDashboard(userId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: "No se pudieron actualizar los datos" }, { status: 503 });
  }
}
