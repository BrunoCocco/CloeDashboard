import { createClient } from "@/lib/supabase/server";
import { boundedPng, visionConfig } from "@/lib/captures/vision-config";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
async function authorized() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    return !error &&
      typeof data?.claims?.sub === "string" &&
      data.claims.sub.length > 0
      ? data.claims.sub
      : null;
  } catch {
    return null;
  }
}
export async function GET() {
  const userId = await authorized();
  if (!userId)
    return Response.json(
      { error: "Sesión requerida" },
      { status: 401, headers },
    );
  const config = visionConfig();
  const allowed = Boolean(config?.userIds.includes(userId));
  return Response.json(
    {
      configured: allowed,
      status: !config ? "not_configured" : allowed ? "ready" : "not_authorized",
      model: allowed ? config!.model : null,
      provider: allowed ? "Vercel AI Gateway" : null,
    },
    { headers },
  );
}
export async function POST(request: Request) {
  const userId = await authorized();
  if (!userId)
    return Response.json(
      { error: "Sesión requerida" },
      { status: 401, headers },
    );
  const config = visionConfig();
  if (!config)
    return Response.json(
      {
        error:
          "Visión completa no habilitada: falta autorización y configuración del proveedor.",
      },
      { status: 503, headers },
    );
  if (!config.userIds.includes(userId))
    return Response.json(
      { error: "Tu usuario no está autorizado para el piloto de visión." },
      { status: 403, headers },
    );
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json(
      { error: "Origen no autorizado" },
      { status: 403, headers },
    );
  if (request.headers.get("x-cloe-vision-consent") !== "true")
    return Response.json(
      { error: "Confirmá el envío de esta imagen al proveedor." },
      { status: 400, headers },
    );
  let bytes: Uint8Array;
  try {
    bytes = await boundedPng(request);
  } catch {
    return Response.json(
      {
        error:
          "La lectura admite sólo PNG de hasta 3 MB y dimensiones válidas. No admite URLs.",
      },
      { status: 400, headers },
    );
  }
  try {
    const { generateWidgetReading } = await import(
      "@/lib/captures/vision-provider"
    );
    const data = await generateWidgetReading(
      bytes,
      config,
      AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    );
    return Response.json(
      {
        data,
        method: "vision",
        processedAt: new Date().toISOString(),
        model: config.model,
      },
      { headers },
    );
  } catch {
    return Response.json(
      {
        error:
          "No se pudo obtener una lectura visual válida. No se generaron datos de reemplazo; revisá manualmente o importá una lectura.",
      },
      { status: 502, headers },
    );
  }
}
