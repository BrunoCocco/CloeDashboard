import { createClient } from "@/lib/supabase/server";
import { marketRequest, normalizeKraken } from "@/lib/analysis/kraken";
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || typeof data?.claims?.sub !== "string")
      return Response.json({ error: "Sesión requerida" }, { status: 401 });
  } catch {
    return Response.json(
      { error: "No se pudo verificar la sesión" },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  let market: ReturnType<typeof marketRequest>;
  try {
    market = marketRequest(
      url.searchParams.get("symbol"),
      url.searchParams.get("frame"),
    );
  } catch {
    return Response.json(
      { error: "Activo o temporalidad inválida" },
      { status: 400 },
    );
  }
  try {
    const response = await fetch(market.url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Mercado no disponible");
    // Date header identifies retrieval of the upstream response, also on cache hits.
    const fetchedAt = new Date(
      response.headers.get("date") ?? Date.now(),
    ).toISOString();
    return Response.json(
      normalizeKraken(await response.json(), market, fetchedAt),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "No se pudo verificar la serie de Kraken. Reintentá más tarde; no se muestran velas inventadas.",
      },
      { status: 502 },
    );
  }
}
