import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
function load(path, imports = {}) {
  const source = readFileSync(
    new URL(`../src/${path}`, import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = {
    exports: {},
    require(name) {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import ${name}`);
    },
    Date,
    URL,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const model = load("lib/analysis/model.ts");
const fundamentals = load("lib/analysis/fundamentals.ts");
test("general macro mentions never become asset analysis", () => {
  const row = {
    as_of: "2026-10-28T10:00:00Z",
    confidence: 99,
    regime: "favorable",
    evidence: [
      "BTC macro mention",
      { summary: "SOL general prose" },
      { scope: "asset", symbol: "XRP", summary: "XRP only" },
    ],
  };
  assert.equal(fundamentals.parseAssetFundamental("BTC", row).status, "empty");
  assert.equal(fundamentals.parseAssetFundamental("SOL", row).status, "empty");
});
test("asset block preserves its own evidence and never inherits global regime or confidence", () => {
  const row = {
    as_of: "2026-10-28T10:00:00Z",
    confidence: 99,
    regime: "favorable",
    evidence: [
      {
        scope: "asset",
        symbol: "BTC",
        summary: "Specific BTC",
        risks: ["BTC risk"],
        sources: [{ name: "Unsafe", url: "javascript:alert(1)" }],
        evidence: [
          {
            text: "BTC fact",
            source: { name: "Official", url: "https://example.test/report" },
            as_of: "2026-10-27T00:00:00Z",
          },
        ],
      },
    ],
  };
  const asset = fundamentals.parseAssetFundamental("BTC", row);
  assert.equal(asset.summary, "Specific BTC");
  assert.equal(asset.regime, null);
  assert.equal(asset.confidence, null);
  assert.equal(asset.cutoffOrigin, "record");
  assert.equal(asset.sources[0].url, null);
  assert.equal(asset.evidence[0].source.url, "https://example.test/report");
  assert.equal(fundamentals.parseAssetFundamental("SOL", row).status, "empty");
});
test("asset cutoff and confidence are explicit and malformed optional fields stay absent", () => {
  const row = {
    as_of: "2026-10-28T10:00:00Z",
    evidence: [
      {
        scope: "asset",
        symbol: "SOL",
        summary: "SOL only",
        as_of: "2026-10-25T12:00:00Z",
        confidence: 67,
        regime: "neutral",
      },
    ],
  };
  const asset = fundamentals.parseAssetFundamental("SOL", row);
  assert.equal(asset.cutoffOrigin, "asset");
  assert.equal(asset.confidence, 67);
  assert.equal(asset.asOf, "2026-10-25T12:00:00.000Z");
  row.evidence[0].confidence = 300;
  row.evidence[0].as_of = "unknown";
  assert.equal(fundamentals.parseAssetFundamental("SOL", row).confidence, null);
  assert.equal(
    fundamentals.parseAssetFundamental("SOL", row).cutoffOrigin,
    "record",
  );
});
test("news require exact asset scope and verified status; unsafe URLs are removed", () => {
  const news = [
    {
      title: "BTC official",
      affected_assets: ["BTC"],
      verification_status: "official",
      source_name: "Primary",
      source_url: "javascript:x",
    },
    {
      title: "Unverified",
      affected_assets: ["BTC"],
      verification_status: "unverified",
    },
    {
      title: "SOL unrelated",
      affected_assets: ["SOL"],
      verification_status: "corroborated",
    },
  ];
  const result = fundamentals.parseAssetNews("BTC", news);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "BTC official");
  assert.equal(result[0].source.url, null);
});
function client(failTable = null) {
  const owner = "correct-owner";
  const rows = {
    fundamental_analyses: [
      {
        user_id: "other-owner",
        as_of: "2026-10-29",
        evidence: [
          { scope: "asset", symbol: "BTC", summary: "Private other owner" },
        ],
      },
      { user_id: owner, as_of: "2026-10-28", evidence: ["Global BTC mention"] },
      ...Array.from({ length: 120 }, (_, i) => ({
        user_id: owner,
        as_of: `2026-10-27T${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`,
        evidence: [{ scope: "asset", symbol: "SOL", summary: "Latest SOL" }],
      })),
      {
        user_id: owner,
        as_of: "2026-10-25",
        evidence: [
          { scope: "asset", symbol: "BTC", summary: "BTC older valid" },
        ],
      },
    ],
    news_items: [
      {
        user_id: owner,
        title: "BTC official",
        affected_assets: ["BTC"],
        verification_status: "official",
        published_at: "2026-10-28",
        source_name: "Source",
      },
      {
        user_id: "other-owner",
        title: "BTC private",
        affected_assets: ["BTC"],
        verification_status: "official",
        published_at: "2026-10-29",
      },
      {
        user_id: owner,
        title: "BTC rumor",
        affected_assets: ["BTC"],
        verification_status: "unverified",
        published_at: "2026-10-29",
      },
    ],
  };
  const operations = [];
  return {
    operations,
    from(table) {
      let result = [...rows[table]],
        single = false;
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          operations.push([table, "eq", key, value]);
          result = result.filter((row) => row[key] === value);
          return query;
        },
        contains(key, values) {
          operations.push([table, "contains", key, values]);
          result = result.filter((row) =>
            values.every((expected) =>
              typeof expected === "string"
                ? row[key].includes(expected)
                : row[key].some(
                    (item) =>
                      item &&
                      typeof item === "object" &&
                      Object.entries(expected).every(([k, v]) => item[k] === v),
                  ),
            ),
          );
          return query;
        },
        in(key, values) {
          result = result.filter((row) => values.includes(row[key]));
          return query;
        },
        order(key) {
          result.sort((a, b) => String(b[key]).localeCompare(String(a[key])));
          return query;
        },
        limit(count) {
          result = result.slice(0, count);
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        then(resolve) {
          return Promise.resolve({
            data: single ? (result[0] ?? null) : result,
            error:
              table === failTable ? { message: "test backend failure" } : null,
          }).then(resolve);
        },
      };
      return query;
    },
  };
}
function loader(supabase) {
  return load("lib/analysis/load-fundamentals.ts", {
    "@/lib/supabase/server": { createClient: async () => supabase },
    "./model": model,
    "./fundamentals": fundamentals,
  });
}
test("loader isolates owner and symbol before latest limit; many SOL rows cannot hide BTC", async () => {
  const supabase = client();
  const result = await loader(supabase).loadAssetFundamentals("correct-owner");
  assert.equal(result.BTC.summary, "BTC older valid");
  assert.equal(result.SOL.summary, "Latest SOL");
  assert.equal(result.XRP.status, "empty");
  assert.equal(result.BTC.news.length, 1);
  assert.equal(result.BTC.news[0].title, "BTC official");
  assert.equal(
    supabase.operations.filter(
      (operation) =>
        operation[1] === "eq" &&
        operation[2] === "user_id" &&
        operation[3] === "correct-owner",
    ).length,
    14,
  );
  for (const symbol of model.SYMBOLS)
    assert.ok(
      supabase.operations.some(
        (operation) =>
          operation[0] === "fundamental_analyses" &&
          operation[1] === "contains" &&
          operation[3][0].symbol === symbol,
      ),
    );
});
test("missing thesis and unavailable query differ; news remain usable when thesis query fails", async () => {
  const result = await loader(
    client("fundamental_analyses"),
  ).loadAssetFundamentals("correct-owner");
  assert.equal(result.BTC.status, "unavailable");
  assert.equal(result.BTC.newsStatus, "available");
  assert.equal(result.BTC.news[0].title, "BTC official");
});
