// Read-only, fixed-host credential check. Never generates content or prints secrets.
import { pathToFileURL } from "node:url";
const ENDPOINT = "https://ai-gateway.vercel.sh/v1/credits";
function amount(value) {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
export async function gatewayPreflight({ env = process.env, fetchImpl = fetch } = {}) {
  const base = { event: "CLOE_GATEWAY_PREFLIGHT", generationTested: false, freeTierVerified: false };
  const key = env.AI_GATEWAY_API_KEY?.trim();
  if (!key) return { ...base, status: "missing_key" };
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    const httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { ...base, status: "http_error", httpStatus };
    }
    // REST schema: { balance: string, total_used: string }; never echo the body.
    const data = await response.json();
    const balanceUsd = amount(data?.balance), totalUsedUsd = amount(data?.total_used);
    if (balanceUsd === null || totalUsedUsd === null) return { ...base, status: "invalid_response", httpStatus };
    return { ...base, status: "ok", httpStatus, balanceUsd, totalUsedUsd };
  } catch {
    // Error messages/headers may contain credentials: only emit a fixed status.
    return { ...base, status: "request_failed" };
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await gatewayPreflight();
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "ok" ? 0 : 1;
}
