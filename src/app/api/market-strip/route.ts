import { loadMarketStrip } from "@/lib/market-prices";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (typeof data?.claims?.sub !== "string") {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return Response.json(await loadMarketStrip(), {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json({ error: "Cotizaciones temporalmente no disponibles" }, { status: 503 });
  }
}
