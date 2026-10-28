// Zero-cost local mode: reject all remote vision calls, including direct HTTP calls.
// Deliberately does not import or invoke any provider, gateway, or model.
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { configured: false, status: "disabled_local_only", provider: null, model: null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST() {
  return Response.json(
    { error: "Visión remota desactivada. Usá el detector geométrico local del cuaderno." },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
