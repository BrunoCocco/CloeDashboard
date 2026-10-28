import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
function load(name, imports = {}) {
  const source = readFileSync(
    new URL(`../src/lib/analysis/${name}.ts`, import.meta.url),
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
    require: (path) => {
      if (!(path in imports)) throw new Error(path);
      return imports[path];
    },
    Date,
    Number,
    Object,
    Set,
    JSON,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const model = load("model");
const indicators = load("indicators");
const kraken = load("kraken", { "./model": model });
const bar = (time, price, volume = 1) => ({
  time,
  open: price,
  high: price,
  low: price,
  close: price,
  volume,
});
test("workspace roundtrip preserves isolated notes and levels across seven assets", () => {
  const workspace = model.emptyWorkspace();
  workspace.assets.BTC.note = "Hipótesis original";
  workspace.assets.BTC.levels.push({ id: "one", price: 100, label: "Soporte" });
  workspace.selected = "SOL";
  const restored = model.parseWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.equal(restored.assets.BTC.note, "Hipótesis original");
  assert.equal(restored.assets.SOL.note, "");
  assert.equal(restored.assets.BTC.levels[0].price, 100);
});
test("import rejects unsupported versions, malformed ownership slots and invalid levels", () => {
  for (const mutate of [
    (w) => (w.version = 2),
    (w) => delete w.assets.SOL,
    (w) => (w.assets.BTC.levels = [{ id: "a", price: -10, label: "Bad" }]),
    (w) => (w.assets.BTC.note = "x".repeat(50001)),
  ]) {
    const workspace = model.emptyWorkspace();
    mutate(workspace);
    assert.throws(() => model.parseWorkspace(workspace));
  }
});
test("SMA and population Bollinger match independent two-point example", () => {
  const candles = [bar(1, 2), bar(2, 4), bar(3, 6)];
  assert.equal(indicators.sma(candles, 2)[0].value, 3);
  const bb = indicators.bollinger(candles, 2, 2);
  assert.equal(bb.upper[0].value, 5);
  assert.equal(bb.lower[0].value, 1);
});
test("RSI handles flat, rising, falling and warm-up without invented values", () => {
  const flat = Array.from({ length: 20 }, (_, i) => bar(i + 1, 10));
  const rising = flat.map((b, i) => bar(b.time, i + 1));
  const falling = flat.map((b, i) => bar(b.time, 25 - i));
  assert.equal(indicators.rsi(flat)[0].time, 15);
  assert.equal(indicators.rsi(flat)[0].value, 50);
  assert.equal(indicators.rsi(rising)[0].value, 100);
  assert.equal(indicators.rsi(falling)[0].value, 0);
  assert.equal(indicators.ema(indicators.rsi(flat)).length, 0);
});
test("quarterly VWAP resets exactly at quarter and does not approximate from weekly HL2", () => {
  const t = (text) => Date.parse(text) / 1000;
  const daily = [
    bar(t("2026-03-31"), 100, 10),
    bar(t("2026-04-01"), 10, 1),
    bar(t("2026-04-02"), 20, 3),
  ];
  const weekly = [bar(t("2026-03-30"), 999)];
  const result = indicators.quarterlyVwap(daily, weekly);
  assert.equal(result[0].value, 17.5);
  assert.equal(
    indicators.quarterlyVwap(
      [bar(t("2026-04-15"), 100)],
      [bar(t("2026-04-13"), 1)],
    ).length,
    0,
  );
});
test("market whitelist prevents arbitrary upstream targets", () => {
  assert.throws(() => kraken.marketRequest("https://internal", "1D"));
  assert.throws(() => kraken.marketRequest("BTC", "1m"));
  assert.equal(kraken.marketRequest("BTC", "4H").pair, "XBTUSD");
});
test("Kraken adapter validates OHLC, ordering and records discontinuities", () => {
  const request = kraken.marketRequest("BTC", "1D");
  const row = (time) => [time, "10", "12", "8", "11", "10", "2", 1];
  const normalized = kraken.normalizeKraken(
    { error: [], result: { XXBTZUSD: [row(86400), row(3 * 86400)], last: 1 } },
    request,
    "2026-10-28T00:00:00Z",
  );
  assert.equal(normalized.gaps, 1);
  assert.equal(normalized.candles[0].volume, 2);
  assert.equal(normalized.lastBarOpen, true);
  assert.throws(() =>
    kraken.normalizeKraken(
      { error: ["EQuery:Unknown asset pair"] },
      request,
      "",
    ),
  );
  assert.throws(() =>
    kraken.normalizeKraken(
      { error: [], result: { pair: [row(86400), row(86400)] } },
      request,
      "",
    ),
  );
  assert.throws(() =>
    kraken.normalizeKraken(
      { error: [], result: { pair: [[86400, 10, 9, 8, 11, 0, 1]] } },
      request,
      "",
    ),
  );
});
