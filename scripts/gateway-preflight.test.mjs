import assert from "node:assert/strict";
import test from "node:test";
import { gatewayPreflight } from "./gateway-preflight.mjs";
const secret = "fixture-secret-must-never-appear";
test("missing key does not issue any request", async () => {
  const result = await gatewayPreflight({ env: {}, fetchImpl: () => { throw new Error("must not fetch"); } });
  assert.equal(result.status, "missing_key"); assert.equal(result.generationTested, false);
});
test("only fixed GET credits endpoint receives credential and logs whitelist numeric REST fields", async () => {
  let count = 0;
  const result = await gatewayPreflight({ env: { AI_GATEWAY_API_KEY: secret }, fetchImpl: async (url, options) => {
    count++; assert.equal(url, "https://ai-gateway.vercel.sh/v1/credits"); assert.equal(options.method, "GET"); assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, `Bearer ${secret}`); assert.equal(options.body, undefined);
    return new Response(JSON.stringify({ balance: "5.125", total_used: "0.025", debug: secret }), { status: 200 });
  } });
  assert.equal(count, 1); assert.equal(result.status, "ok"); assert.equal(result.balanceUsd, 5.125); assert.equal(result.totalUsedUsd, 0.025);
  assert.equal(result.freeTierVerified, false); assert.ok(!JSON.stringify(result).includes(secret));
});
test("upstream HTTP errors and thrown exceptions cannot echo malicious bodies or secrets", async () => {
  for (const fetchImpl of [async () => new Response(secret, { status: 401 }), async () => { throw new Error(`Authorization Bearer ${secret}`); }, async () => new Response(`not JSON ${secret}`, { status: 200 })]) {
    const result = await gatewayPreflight({ env: { AI_GATEWAY_API_KEY: secret }, fetchImpl });
    assert.ok(["http_error", "request_failed"].includes(result.status)); assert.ok(!JSON.stringify(result).includes(secret));
  }
});
test("invalid amounts never appear in output and zero balance remains a valid credential response", async () => {
  for (const value of [secret, "Infinity", "1e999", "", { key: secret }]) {
    const result = await gatewayPreflight({ env: { AI_GATEWAY_API_KEY: secret }, fetchImpl: async () => new Response(JSON.stringify({ balance: value, total_used: "0" })) });
    assert.equal(result.status, "invalid_response"); assert.ok(!JSON.stringify(result).includes(secret));
  }
  const result = await gatewayPreflight({ env: { AI_GATEWAY_API_KEY: secret }, fetchImpl: async () => new Response('{"balance":"0","total_used":"0"}') });
  assert.equal(result.status, "ok"); assert.equal(result.balanceUsd, 0);
});
