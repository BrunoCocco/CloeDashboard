import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("upcoming events are filtered before the limit, preserving undated announcements", async () => {
  const now = Date.parse("2026-10-01T15:00:00Z");
  const owner = "calendar-owner";
  const events = [
    ...Array.from({ length: 20 }, (_, index) => ({ user_id: owner, title: `Past ${index}`, scheduled_at: new Date(now - (index + 1) * 86400000).toISOString(), status: "confirmed", importance: "high" })),
    { user_id: owner, title: "Employment", scheduled_at: "2026-10-02T12:30:00Z", status: "confirmed", importance: "critical" },
    { user_id: owner, title: "CPI", scheduled_at: "2026-10-14T12:30:00Z", status: "confirmed", importance: "high" },
    { user_id: owner, title: "Pending date", scheduled_at: null, status: "announced", importance: "medium" },
    { user_id: owner, title: "Cancelled", scheduled_at: "2026-10-03T12:30:00Z", status: "cancelled", importance: "high" },
    { user_id: "other-owner", title: "Private event", scheduled_at: "2026-10-02T12:30:00Z", status: "confirmed", importance: "high" },
  ];
  const operations = [];
  const supabase = {
    from(table) {
      let rows = table === "market_events" ? [...events] : [];
      let single = false;
      const query = {
        select() { return query; },
        eq(key, value) { rows = rows.filter((row) => row[key] === value); return query; },
        in(key, values) { rows = rows.filter((row) => values.includes(row[key])); return query; },
        or(filter) {
          operations.push("filter");
          assert.equal(filter, "scheduled_at.gte.2026-10-01T15:00:00.000Z,scheduled_at.is.null");
          rows = rows.filter((row) => row.scheduled_at === null || Date.parse(row.scheduled_at) >= now);
          return query;
        },
        order(key, options) {
          rows.sort((a, b) => a[key] === null ? 1 : b[key] === null ? -1 : String(a[key]).localeCompare(String(b[key])) * (options.ascending ? 1 : -1));
          return query;
        },
        limit(count) { if (table === "market_events") operations.push("limit"); rows = rows.slice(0, count); return query; },
        maybeSingle() { single = true; return query; },
        then(resolve) { return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve); },
      };
      return query;
    },
  };
  const source = readFileSync(new URL("../src/lib/dashboard.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  class FixedDate extends Date { static now() { return now; } }
  const context = { exports: {}, Date: FixedDate, Intl, Map, require: (name) => {
    if (name.endsWith("supabase/server")) return { createClient: async () => supabase };
    if (name.endsWith("market-prices")) return { loadMarketQuotes: async () => new Map() };
    if (name.endsWith("fear-greed")) return { classifyFearGreed: () => null };
    throw new Error(`Unexpected import: ${name}`);
  } };
  vm.runInNewContext(code, context);
  const result = await context.exports.loadDashboard(owner);
  assert.deepEqual(Array.from(result.events, (event) => event.title), ["Employment", "CPI", "Pending date"]);
  assert.deepEqual(operations, ["filter", "limit"]);
  assert.equal(result.events[0].day, "02");
  assert.equal(result.events[2].month, "S/F");
});
