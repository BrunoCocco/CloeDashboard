import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
function load(name, extra = {}) {
  const code = ts.transpileModule(
    readFileSync(
      new URL(`../src/lib/captures/${name}.ts`, import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const c = {
    exports: {},
    Blob,
    crypto,
    setTimeout,
    clearTimeout,
    require: (name) => {
      if (name === "./price-labels") return load("price-labels");
      throw Error(name);
    },
    ...extra,
  };
  vm.runInNewContext(code, c);
  return c.exports;
}
const m = load("local-reading"),
  detector = load("local-lines");
const line = {
  y: 50,
  x1: 10,
  x2: 90,
  pixels: 80,
  coverage: 1,
  kind: "horizontal-line",
  confidence: "candidate",
  price: null,
  source: "pixel-local",
};
const calibration = {
  region: { x1: 0, y1: 0, x2: 100, y2: 100 },
  scale: "linear",
  first: { y: 10, price: 200 },
  second: { y: 90, price: 100 },
  panel: "Precio BTC",
};
test("linear and logarithmic calibration use explicit anchors; outside ROI is unknown", () => {
  assert.equal(m.estimatePrice(calibration, 50), 150);
  assert.match(m.formatEstimatedPrice(101.79347826086956), /≈ 101,793/);
  assert.equal(m.estimatePrice(calibration, 50), 150);
  assert.equal(m.estimatePrice(calibration, 101), null);
  assert.ok(
    Math.abs(
      m.estimatePrice({ ...calibration, scale: "log" }, 50) - Math.sqrt(20000),
    ) < 1e-10,
  );
});
test("invalid, reversed, coincident or non-positive anchors and invalid bounds reject", () => {
  for (const change of [
    { first: { y: 10, price: 0 } },
    { second: { y: 10, price: 100 } },
    { first: { y: 10, price: 80 } },
    { region: { x1: -1, y1: 0, x2: 100, y2: 100 } },
    { scale: "auto" },
  ])
    assert.throws(() =>
      m.validateCalibration({ ...calibration, ...change }, 100, 100),
    );
});
test("ROI excludes other panels and recalibration removes prior confirmations", () => {
  const v = m.calibrate([line, { ...line, y: 150 }], calibration, 100, 200);
  assert.equal(v.candidates.length, 1);
  assert.equal(v.candidates[0].estimatedPrice, 150);
  v.candidates[0].decision = "accepted";
  const next = m.calibrate(
    [line],
    { ...calibration, second: { y: 90, price: 120 } },
    100,
    200,
  );
  assert.equal(next.candidates[0].decision, "pending");
  assert.equal(next.candidates[0].estimatedPrice, 160);
  assert.throws(() =>
    m.validateLocalReading(
      { ...v, candidates: [{ ...v.candidates[0], estimatedPrice: 999 }] },
      100,
      200,
    ),
  );
  assert.throws(() => m.validateLocalReading(v, 101, 200));
});
test("orphan calibration, out-of-region lines and nonfinite detector fields reject", () => {
  const v = m.calibrate([line], calibration, 100, 100);
  for (const candidate of [
    { ...v.candidates[0], y: 101, estimatedPrice: null },
    { ...v.candidates[0], pixels: NaN },
    { ...v.candidates[0], coverage: Infinity },
  ])
    assert.throws(() =>
      m.validateLocalReading({ ...v, candidates: [candidate] }, 100, 100),
    );
  assert.throws(() =>
    m.validateLocalReading({ ...v, calibration: null }, 100, 100),
  );
});
test("uncalibrated candidates persist geometry without prices or accepted levels", () => {
  const v = {
    version: 1,
    width: 100,
    height: 100,
    calibration: null,
    candidates: [
      {
        ...line,
        id: "line-0",
        decision: "pending",
        classification: "reference",
        estimatedPrice: null,
      },
    ],
  };
  assert.equal(m.validateLocalReading(v, 100, 100), v);
  assert.match(m.localSummary(v), /región sin calibrar/);
  assert.throws(() =>
    m.validateLocalReading(
      { ...v, candidates: [{ ...v.candidates[0], decision: "accepted" }] },
      100,
      100,
    ),
  );
});
test("2-6px bright horizontal strokes detected once; scattered candle bodies do not become long lines", () => {
  for (const thickness of [2, 3, 6]) {
    const width = 200,
      height = 100,
      data = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    for (let y = 40; y < 40 + thickness; y++)
      for (let x = 20; x < 180; x++) {
        const k = (y * width + x) * 4;
        data[k] = 255;
        data[k + 1] = 170;
      }
    const found = detector.detectHorizontalLines({ data, width, height });
    assert.equal(found.length, 1, `thickness ${thickness}`);
    assert.ok(Math.abs(found[0].y - 40) < 7);
  }
  const data = new Uint8ClampedArray(200 * 100 * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (let x = 20; x < 180; x += 20)
    for (let dx = 0; dx < 4; dx++)
      for (let y = 30; y < 60; y++) {
        data[(y * 200 + x + dx) * 4] = 240;
      }
  assert.equal(
    detector.detectHorizontalLines({ data, width: 200, height: 100 }).length,
    0,
  );
});
test("optional local reading survives IDB reopen/export, owner isolation and old records", async () => {
  const indexedDB = new IDBFactory();
  const db = load("storage", { indexedDB, IDBKeyRange });
  const local = m.calibrate([line], calibration, 100, 100);
  local.candidates[0].decision = "accepted";
  const record = {
    version: 1,
    id: "cut1",
    ownerId: "alice",
    createdAt: new Date().toISOString(),
    asset: "BTC",
    reviewed: true,
    width: 100,
    height: 100,
    image: new Blob(["fixture"], { type: "image/png" }),
    localReading: local,
  };
  await db.saveCapture(record);
  const reloaded = await db.readCapture("alice", "cut1");
  assert.equal(reloaded.localReading.candidates[0].decision, "accepted");
  assert.equal(
    JSON.parse(JSON.stringify(reloaded)).localReading.candidates[0]
      .estimatedPrice,
    150,
  );
  assert.equal(await db.readCapture("bob", "cut1"), null);
  const old = { ...record, id: "old" };
  delete old.localReading;
  await db.saveCapture(old);
  assert.equal((await db.readCapture("alice", "old")).localReading, undefined);
  assert.match(m.localSummary(local), /1 niveles clasificados/);
});
test("remote endpoint remains a hard disabled route with no provider import", () => {
  const route = readFileSync(
    new URL("../src/app/api/captures/vision/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /disabled_local_only/);
  assert.match(route, /status: 503/);
  assert.doesNotMatch(route, /^import /m);
});
