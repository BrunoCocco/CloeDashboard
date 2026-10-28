// One explicit live generation at most, using only a public synthetic fixture.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { gatewayPreflight } from "./gateway-preflight.mjs";
const require = createRequire(import.meta.url);
function loadTs(path, imports = {}) {
  const ts = require("typescript");
  const code = ts.transpileModule(readFileSync(new URL(`../src/lib/captures/${path}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require(name) { return name in imports ? imports[name] : require(name); }, Date, Number, Object, Set };
  vm.runInNewContext(code, context); return context.exports;
}
export function safeFailure(error) {
  let current = error, status = null, code = "request_failed";
  const accepted = new Set(["insufficient_funds", "customer_verification_required", "quota_for_entity_exceeded", "rate_limit_exceeded", "authentication_error"]);
  for (let i = 0; i < 5 && current && typeof current === "object"; i++, current = current.cause) {
    if (Number.isInteger(current.statusCode) && current.statusCode >= 100 && current.statusCode <= 599) status = current.statusCode;
    for (const type of [current.type, current.data?.error?.type, current.data?.error?.code]) if (accepted.has(type)) code = type;
  }
  if (code === "request_failed") code = status === 402 ? "credits_or_quota_required" : status === 403 ? "verification_or_access_required" : status === 401 ? "authentication_required" : status === 429 ? "rate_limited" : "request_failed";
  return { status: "provider_failed", httpStatus: status, reason: code };
}
export function compareReading(reading, expected) {
  const panel = reading.panels[0];
  const indicatorValues = panel.indicators.flatMap(indicator => indicator.values.map(value => ({ indicator: indicator.name.value, label: value.label, value: value.reading.value, unit: value.reading.unit, origin: value.reading.origin })));
  const prices = panel.marks.flatMap(mark => mark.prices.filter(field => typeof field.value === "number").map(field => ({ price: field.value, origin: field.origin, confidence: field.confidence })));
  const remaining = [...prices];
  const lines = expected.lines.map(line => {
    const closest = remaining.reduce((best, value) => !best || Math.abs(value.price - line.price) < Math.abs(best.price - line.price) ? value : best, null);
    if (closest) remaining.splice(remaining.indexOf(closest), 1);
    return { expectedPrice: line.price, labeled: line.labeled, recoveredPrice: closest?.price ?? null, origin: closest?.origin ?? null, absoluteError: closest ? Number(Math.abs(closest.price - line.price).toFixed(6)) : null };
  });
  return { recovered: { panelCount: reading.panels.length, asset: panel.asset.value, exchange: panel.exchange.value, pair: panel.pair.value, timeframe: panel.timeframe.value, displayedPrice: panel.displayedPrice.value, ohlc: Object.fromEntries(Object.entries(panel.ohlc).map(([key, field]) => [key, field.value])), volume: panel.volume.value, indicators: indicatorValues.slice(0, 20), marks: prices.slice(0, 15) }, comparison: { matchPolicy: "greedy_unique_nearest", lines, ohlcExact: Object.entries(expected.ohlc).every(([key, value]) => panel.ohlc[key].value === value) } };
}
export function singlePostGatewayFetch(fetchImpl, onPost) {
  let sent = false;
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.href);
    if (url.hostname !== "ai-gateway.vercel.sh") throw new Error("blocked_host");
    if ((init?.method ?? "GET").toUpperCase() === "POST") {
      if (sent) throw new Error("one_post_only");
      sent = true; onPost();
    }
    return fetchImpl(input, { ...init, redirect: "error" });
  };
}
export async function runLineRecovery({ live = false, model, env = process.env, preflight = gatewayPreflight, loadProvider, fixturePath = new URL("./fixtures/line-recovery.json", import.meta.url) } = {}) {
  const base = { event: "CLOE_LINE_RECOVERY", synthetic: true, generationAttempted: false, freeTierVerified: false };
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  if (!live) return { ...base, status: "dry_run", seed: fixture.seed, pngBytes: Buffer.from(fixture.imagePngBase64,"base64").length, model: model ?? null };
  if (!model || !/^[\w.-]+\/[\w.:-]+$/.test(model)) return { ...base, status: "model_required" };
  const credit = await preflight({ env });
  if (credit.status !== "ok") return { ...base, status: "preflight_blocked", preflightStatus: credit.status };
  if (credit.balanceUsd !== 0) return { ...base, status: "balance_requires_review", balanceUsd: credit.balanceUsd };
  let postCount = 0;
  try {
    const schema = loadTs("widget-reading");
    globalThis.AI_SDK_LOG_WARNINGS = false;
    const sdk = require("ai");
    const restrictedSdk = { ...sdk, createGateway: options => sdk.createGateway({ ...options, fetch: singlePostGatewayFetch(fetch, () => { postCount++; }) }) };
    const provider = loadProvider ? loadProvider(() => { postCount++; }) : loadTs("vision-provider", { "./widget-reading": schema, ai: restrictedSdk });
    // Only PNG bytes enter production's prompt. Ground truth stays in this runner.
    const output = await provider.generateWidgetReading(new Uint8Array(Buffer.from(fixture.imagePngBase64,"base64")), { apiKey: env.AI_GATEWAY_API_KEY, model, userIds: [] }, AbortSignal.timeout(45000));
    const reading = schema.parseWidgetReading(output);
    return { ...base, generationAttempted: postCount > 0, status: "ok", model, postCount, ...compareReading(reading, fixture.expected) };
  } catch (error) { return { ...base, generationAttempted: postCount > 0, model, postCount, ...safeFailure(error) }; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), model = args[args.indexOf("--model") + 1];
  try { const output = JSON.stringify(await runLineRecovery({ live: args.includes("--live"), model: args.includes("--model") ? model : undefined })); const key = process.env.AI_GATEWAY_API_KEY?.trim(); console.log(key ? output.split(key).join("[REDACTED]") : output); }
  catch { console.log(JSON.stringify({ event: "CLOE_LINE_RECOVERY", status: "runner_failed", generationAttempted: false })); }
  // A known diagnostic failure must not replace or break the running app.
}
