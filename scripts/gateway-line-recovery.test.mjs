import assert from "node:assert/strict";
import test from "node:test";
import { runLineRecovery, compareReading, safeFailure, singlePostGatewayFetch } from "./gateway-line-recovery.mjs";
test("dry-run never consults credentials or attempts generation", async () => {
  const result = await runLineRecovery({ model: "google/gemini-2.5-flash-lite", preflight: () => { throw new Error("must not run"); } });
  assert.equal(result.status, "dry_run"); assert.equal(result.generationAttempted, false); assert.ok(result.pngBytes > 0);
});
test("live requires explicit model and zero credit balance before loading provider", async () => {
  assert.equal((await runLineRecovery({ live: true })).status, "model_required");
  const result = await runLineRecovery({ live: true, model: "google/gemini-2.5-flash-lite", preflight: async () => ({ status: "ok", balanceUsd: 5 }), loadProvider: () => { throw new Error("must not run"); } });
  assert.equal(result.status, "balance_requires_review"); assert.equal(result.generationAttempted, false);
});
test("known provider failure is redacted and returned without another attempt", async () => {
  let attempts = 0;
  const result = await runLineRecovery({ live: true, model: "google/gemini-2.5-flash-lite", env: { AI_GATEWAY_API_KEY: "fixture-key-secret" }, preflight: async () => ({ status: "ok", balanceUsd: 0 }), loadProvider: notify => ({ generateWidgetReading: async bytes => { attempts++; notify(); assert.equal(bytes[0], 137); throw { statusCode: 402, type: "insufficient_funds", message: "fixture-key-secret", responseBody: "never print" }; } }) });
  assert.equal(attempts, 1); assert.equal(result.reason, "insufficient_funds"); assert.equal(result.postCount, 1); assert.ok(!JSON.stringify(result).includes("fixture-key-secret"));
});
test("comparison distinguishes labeled exact levels and unlabeled estimation error", () => {
  const field = value => ({ value, unit: "USD", origin: "estimated", confidence: "low" });
  const panel = { asset: field("TEST"), exchange: field("DEMO"), pair: field("TEST/USD"), timeframe: field("4H"), displayedPrice: field(105), ohlc: { open: field(100), high: field(110), low: field(95), close: field(105) }, volume: field(1234), indicators: [], marks: [{ prices: [field(101.75)] }, { prices: [field(102.8)] }, { prices: [field(104)] }] };
  const result = compareReading({ panels: [panel] }, { ohlc: { open:100,high:110,low:95,close:105 }, lines: [{ price:101.75,labeled:true }, { price:102.75,labeled:false }, { price:104,labeled:true }] });
  assert.equal(result.comparison.lines[0].absoluteError, 0); assert.equal(result.comparison.lines[1].absoluteError, 0.05); assert.equal(result.comparison.ohlcExact, true);
  assert.equal(safeFailure({ statusCode:403, message:"secret" }).reason, "verification_or_access_required");
});

test("Gateway transport sends at most one POST and never forwards credentials to another host", async () => {
  let sent = 0, notified = 0;
  const transport = singlePostGatewayFetch(async (_url, options) => { sent++; assert.equal(options.redirect,"error"); return new Response("ok"); }, () => notified++);
  await transport("https://ai-gateway.vercel.sh/v4/ai/test",{method:"POST"});
  await assert.rejects(transport("https://ai-gateway.vercel.sh/v4/ai/test",{method:"POST"}));
  await assert.rejects(transport("https://other.example/test",{method:"GET"}));
  assert.equal(sent,1); assert.equal(notified,1);
});
