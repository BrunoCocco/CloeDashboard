import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(file, imports = {}) {
  const c = {
    exports: {},
    Buffer,
    URLSearchParams,
    require: (name) => {
      if (name in imports) return imports[name];
      throw Error(name);
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      { compilerOptions: { module: 1, target: 9 } },
    ).outputText,
    c,
  );
  return c.exports;
}
const model = load("src/lib/analysis-reviews/model.ts");
const example = load("src/data/btc-review-example.ts", {
  "@/lib/analysis-reviews/model": model,
}).btcReviewExample;
const loader = load("src/lib/analysis-reviews/loader.ts", {
  "@/lib/supabase/server": {},
  "./model": model,
});
const id = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const row = (i, date = "2026-10-30") => ({
  id: id(i),
  user_id: "owner",
  analysis_date: date,
  created_at: `${date}T16:00:00.123456Z`,
  observed_at: null,
  asset_symbol: "BTC",
  revision_of: null,
  snapshot: example.snapshot,
});
function database(rows, { error = false } = {}) {
  const calls = [];
  const client = {
    from(table) {
      const trace = { table, filters: [], orders: [], limit: null, or: null };
      calls.push(trace);
      let single = false;
      const q = {
        select(columns) {
          trace.columns = columns;
          return q;
        },
        eq(k, v) {
          trace.filters.push([k, v]);
          return q;
        },
        or(value) {
          trace.or = value;
          return q;
        },
        order(k, v) {
          trace.orders.push([k, v]);
          return q;
        },
        limit(n) {
          trace.limit = n;
          return q;
        },
        maybeSingle() {
          single = true;
          return Promise.resolve(result());
        },
        then(resolve, reject) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      function result() {
        let found = rows.filter((r) =>
          trace.filters.every(([k, v]) => r[k] === v),
        );
        if (!single)
          found = found
            .sort(
              (a, b) =>
                b.analysis_date.localeCompare(a.analysis_date) ||
                b.created_at.localeCompare(a.created_at) ||
                b.id.localeCompare(a.id),
            )
            .slice(0, trace.limit ?? 100);
        return {
          data: single ? (found[0] ?? null) : found,
          error: error ? { message: "private detail must not leak" } : null,
        };
      }
      return q;
    },
  };
  return { client, calls };
}
test("BTC example keeps source time unverified, Year VWAP and nonforecast projection, not live DB", () => {
  const derivative = structuredClone(example.snapshot);
  derivative.asset.market = "derivative";
  assert.equal(
    model.parseReviewSnapshot(derivative).asset.market,
    "derivative",
  );
  assert.equal(example.createdAt, null);
  assert.equal(example.example, true);
  assert.equal(example.snapshot.source.observedAt, null);
  assert.equal(example.snapshot.source.captureTimeBasis, "filename-derived");
  assert.match(
    example.snapshot.facts.find((x) => x.id === "w-vwap").configuration,
    /Year/,
  );
  assert.equal(
    example.snapshot.facts.find((x) => x.id === "volume").value,
    null,
  );
  assert.match(
    example.snapshot.facts.find((x) => x.id === "projection").configuration,
    /no pronóstico/,
  );
});
test("parser rejects invented evidence refs, unsupported version and treating filename as market time", () => {
  for (const mutate of [
    (x) => (x.version = 2),
    (x) => (x.source.observedAt = x.source.captureTime),
    (x) => (x.hypotheses[0].evidenceIds = ["nonexistent"]),
    (x) => (x.facts[0].value = NaN),
    (x) => (x.analysisDate = "2026-02-30"),
  ]) {
    const x = structuredClone(example.snapshot);
    mutate(x);
    assert.throws(() => model.parseReviewSnapshot(x));
  }
});
test("latest means day then real registration; owner and asset scope on list AND detail", async () => {
  const rows = [row(1, "2026-10-29"), row(2), { ...row(3), user_id: "other" }];
  const db = database(rows);
  const out = await loader.loadReviewArchive(
    "owner",
    { asset: "BTC" },
    async () => db.client,
  );
  assert.equal(out.status, "ready");
  assert.equal(out.selected.id, id(2));
  assert.equal(out.selected.isLatest, true);
  for (const call of db.calls) {
    assert.ok(call.filters.some(([k, v]) => k === "user_id" && v === "owner"));
    assert.ok(
      call.filters.some(([k, v]) => k === "asset_symbol" && v === "BTC"),
    );
  }
  assert.equal(db.calls[0].limit, 21);
  assert.deepEqual(
    db.calls[0].orders.map((x) => x[0]),
    ["analysis_date", "created_at", "id"],
  );
  assert.equal(out.selected.observedAt, null);
});
test("historical explicit selection cannot read another owner and is labelled separately", async () => {
  const db = database([
    row(1, "2026-10-29"),
    row(2),
    { ...row(3), user_id: "other" },
  ]);
  let out = await loader.loadReviewArchive(
    "owner",
    { cut: id(1) },
    async () => db.client,
  );
  assert.equal(out.status, "unavailable"); // row1 intentionally mismatches snapshot day: no fabricated fallback
  const matching = { ...row(1), created_at: "2026-10-30T15:00:00Z" };
  out = await loader.loadReviewArchive(
    "owner",
    { cut: id(1) },
    async () => database([matching, row(2)]).client,
  );
  assert.equal(out.selected.isLatest, false);
  out = await loader.loadReviewArchive(
    "owner",
    { cut: id(3) },
    async () => db.client,
  );
  assert.equal(out.status, "invalid");
  assert.equal(out.selected, null);
});
test("keyset cursor preserves microseconds and validates every component before query", async () => {
  const rows = Array.from({ length: 22 }, (_, i) => row(i + 1));
  const db = database(rows);
  const out = await loader.loadReviewArchive(
    "owner",
    {},
    async () => db.client,
  );
  assert.equal(out.items.length, 20);
  const cursor = loader.decodeReviewCursor(out.nextCursor);
  assert.equal(cursor.created, "2026-10-30T16:00:00.123456Z");
  await loader.loadReviewArchive(
    "owner",
    { before: out.nextCursor },
    async () => db.client,
  );
  assert.match(db.calls[2].or, /created_at.lt.2026-10-30T16:00:00.123456Z/);
  assert.match(db.calls[2].or, /id.lt./);
  const bad = Buffer.from(
    JSON.stringify({ ...cursor, id: "injected,or" }),
  ).toString("base64url");
  assert.throws(() => loader.decodeReviewCursor(bad));
  const untouched = database(rows);
  assert.equal(
    (
      await loader.loadReviewArchive(
        "owner",
        { before: bad },
        async () => untouched.client,
      )
    ).status,
    "invalid",
  );
  assert.equal(untouched.calls.length, 0);
});
test("empty, unavailable and invalid cuts remain distinct without demo substitution", async () => {
  let out = await loader.loadReviewArchive(
    "owner",
    {},
    async () => database([]).client,
  );
  assert.equal(out.status, "empty");
  assert.equal(out.selected, null);
  out = await loader.loadReviewArchive(
    "owner",
    {},
    async () => database([], { error: true }).client,
  );
  assert.equal(out.status, "unavailable");
  assert.doesNotMatch(out.message, /private detail/);
  assert.equal(out.selected, null);
});

test("compact view export preserves every stored fact, scenario requirement and historical identity", () => {
  const { reviewExport } = load("src/lib/analysis-reviews/export.ts");
  const entry = {
    ...example,
    id: id(9),
    example: false,
    isLatest: false,
    revisionOf: id(8),
    createdAt: "2026-10-30T17:14:00.827296Z",
  };
  const out = JSON.parse(JSON.stringify(reviewExport(entry)));
  assert.equal(out.example, false);
  assert.equal(out.record.id, id(9));
  assert.equal(out.record.revisionOf, id(8));
  assert.equal(out.record.createdAt, entry.createdAt);
  assert.deepEqual(out.snapshot, JSON.parse(JSON.stringify(entry.snapshot)));
  assert.equal(out.snapshot.facts.length, 15);
  assert.ok(
    out.snapshot.scenarios.every(
      (s) => s.confirmation.length && s.invalidation.length,
    ),
  );
  assert.equal(out.snapshot.source.observedAt, null);
});

test("market context performs no legacy request by default and loads only on explicit request", async () => {
  const { loadMarketContext } = load("src/lib/analysis-reviews/context.ts", {
    "@/lib/dashboard": {
      loadDashboard: () => {
        throw Error("Unexpected default call");
      },
    },
  });
  let calls = 0;
  const get = async (user) => {
    calls++;
    assert.equal(user, "owner");
    return { marker: "legacy" };
  };
  for (const flag of [undefined, null, "0", "yes", 1, []])
    assert.equal(
      (await loadMarketContext("owner", flag, get)).status,
      "not-requested",
    );
  assert.equal(calls, 0);
  const result = await loadMarketContext("owner", "1", get);
  assert.equal(result.status, "available");
  assert.equal(result.dashboard.marker, "legacy");
  assert.equal(calls, 1);
  assert.equal(
    (
      await loadMarketContext("owner", "1", async () => {
        throw Error("private service failure");
      })
    ).status,
    "unavailable",
  );
});
