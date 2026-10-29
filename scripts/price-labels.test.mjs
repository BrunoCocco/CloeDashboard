import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
function load(name, extra = {}) {
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
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL(`../src/lib/captures/${name}.ts`, import.meta.url),
        "utf8",
      ),
      { compilerOptions: { module: 1, target: 9 } },
    ).outputText,
    c,
  );
  return c.exports;
}
const p = load("price-labels"),
  m = load("local-reading");
const label = (raw, y, id = "a", confidence = 95, x = 920) =>
  p.makePriceLabel(
    raw,
    confidence,
    { x0: x, y0: y - 9, x1: x + 65, y1: y + 9 },
    id,
  );
const line = (y) => ({
  y,
  x1: 10,
  x2: 915,
  pixels: 900,
  coverage: 1,
  kind: "horizontal-line",
  confidence: "candidate",
  price: null,
  source: "pixel-local",
});
const reading = () => ({
  version: 1,
  width: 1000,
  height: 800,
  calibration: null,
  candidates: [100, 300, 500].map((y, i) => ({
    ...line(y),
    id: `line-${i}`,
    decision: "pending",
    classification: "reference",
    estimatedPrice: null,
  })),
});
const scan = (labels) => ({
  version: 1,
  crop: { x0: 600, y0: 0, x1: 1000, y1: 800 },
  labels,
  text: labels.map((l) => l.raw).join("\n"),
});
test("decimal and grouping interpretation is conservative, including leading-zero decimals", () => {
  for (const [raw, expected] of [
    ["104.25", 104.25],
    ["101,50", 101.5],
    ["0.052", 0.052],
    ["0,052", 0.052],
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234,567", 1234567],
    ["1234.567", 1234.567],
  ])
    assert.equal(p.parseLabelPrice(raw).price, expected, raw);
  for (const raw of [
    "70.000",
    "70,000",
    "12:30",
    "2026-10-29",
    "10%",
    "123K",
    "1.2M",
    "0",
    "1,23,456",
  ])
    assert.equal(p.parseLabelPrice(raw).price, null, raw);
});
test("association is one-to-one, near right endpoint, and missing label stays unknown", () => {
  const matches = p.matchPriceLabels(
    [line(100), line(300), line(500)],
    [
      label("104.25", 100),
      label("101.50", 500, "b"),
      label("95.00", 700, "tick"),
      label("77.00", 300, "left", 95, 400),
    ],
    1000,
    800,
  );
  assert.equal(matches.size, 2);
  assert.equal(matches.get(0).price, 104.25);
  assert.equal(matches.has(1), false);
  assert.equal(matches.get(2).price, 101.5);
});
test("same label cannot serve two lines; near ties remain unmatched across panels", () => {
  assert.equal(
    p.matchPriceLabels([line(100), line(102)], [label("10.50", 101)], 1000, 800)
      .size,
    0,
  );
  const matches = p.matchPriceLabels(
    [line(100), line(300)],
    [label("10.50", 100), label("11.50", 300, "b")],
    1000,
    800,
  );
  assert.equal(matches.size, 2);
  assert.equal(new Set([...matches.values()].map((l) => l.id)).size, 2);
});
test("low confidence and ambiguous label retain evidence but cannot auto-confirm price", () => {
  const v = m.applyLabelScan(
    reading(),
    scan([label("104.25", 100, "low", 30), label("70.000", 300, "ambiguous")]),
  );
  assert.equal(v.candidates[0].ocrLabel.raw, "104.25");
  assert.equal(m.candidatePrice(v.candidates[0]), null);
  assert.equal(m.candidatePrice(v.candidates[1]), null);
  v.candidates[0].decision = "accepted";
  assert.throws(() => m.validateLocalReading(v, 1000, 800));
});
test("automatic reading never overwrites reviewed decisions, manual correction or original OCR", () => {
  let v = m.applyLabelScan(reading(), scan([label("104.25", 100)]));
  v.candidates[0].decision = "accepted";
  v.candidates[0].correctedPrice = 105;
  v = m.applyLabelScan(v, scan([label("999.99", 100, "retry")]));
  assert.equal(v.candidates[0].ocrLabel.raw, "104.25");
  assert.equal(v.candidates[0].correctedPrice, 105);
  assert.equal(v.candidates[0].decision, "accepted");
  assert.equal(m.candidateOrigin(v.candidates[0]), "Corrección manual");
});
test("OCR and manual calibration preserve separate prices and source evidence", () => {
  let v = m.applyLabelScan(reading(), scan([label("104.25", 100)]));
  const c = {
    region: { x1: 0, y1: 0, x2: 1000, y2: 800 },
    first: { y: 0, price: 110 },
    second: { y: 800, price: 90 },
    scale: "linear",
    panel: "Price",
  };
  v = { ...m.calibrate(v.candidates, c, 1000, 800), labelScan: v.labelScan };
  assert.equal(v.candidates[0].ocrLabel.raw, "104.25");
  assert.equal(m.candidatePrice(v.candidates[0]), 104.25);
  assert.equal(v.candidates[0].estimatedPrice, 107.5);
  assert.equal(m.candidatePrice(v.candidates[1]), 102.5);
  assert.equal(m.validateLocalReading(v, 1000, 800), v);
});
test("actual IDB reopen and JSON preserve OCR bbox, original, correction and old v1 records", async () => {
  const db = load("storage", { indexedDB: new IDBFactory(), IDBKeyRange });
  const v = m.applyLabelScan(reading(), scan([label("104.25", 100)]));
  v.candidates[0].correctedPrice = 104.5;
  v.candidates[0].decision = "accepted";
  const base = {
    version: 1,
    id: "ocr",
    ownerId: "a",
    asset: "TEST",
    createdAt: new Date().toISOString(),
    reviewed: true,
    image: new Blob(["synthetic"]),
    localReading: v,
  };
  await db.saveCapture(base);
  const saved = await db.readCapture("a", "ocr");
  assert.equal(saved.localReading.candidates[0].ocrLabel.origin, "ocr-label");
  assert.equal(saved.localReading.candidates[0].ocrLabel.bbox.y0, 91);
  assert.equal(
    JSON.parse(JSON.stringify(saved)).localReading.candidates[0].correctedPrice,
    104.5,
  );
  assert.equal(await db.readCapture("b", "ocr"), null);
  const old = { ...base, id: "old" };
  delete old.localReading;
  await db.saveCapture(old);
  assert.equal((await db.readCapture("a", "old")).localReading, undefined);
});

test("badge bounds follow image color beyond endpoint; unlabeled line creates no badge", () => {
  const width = 240,
    height = 160,
    data = new Uint8ClampedArray(width * height * 4);
  const paint = (x0, y0, x1, y1, color) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        data.set([...color, 255], i);
      }
  };
  paint(10, 39, 170, 42, [50, 180, 250]);
  paint(180, 25, 239, 57, [50, 180, 250]);
  paint(10, 119, 170, 122, [180, 80, 250]);
  const boxes = p.findBadgeRegions({ data, width, height }, [
    { x2: 170, y: 39 },
    { x2: 170, y: 119 },
  ]);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].x0, 180);
  assert.equal(boxes[0].y0, 25);
});
test("colored stroke stays connected across brighter candle bodies", () => {
  const width = 400,
    height = 160,
    data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const set = (x, y, rgb) => {
    const i = (y * width + x) * 4;
    data.set([...rgb, 255], i);
  };
  for (let x = 30; x < 370; x += 45)
    for (let xx = x; xx < x + 15; xx++)
      for (let y = 40; y < 100; y++) set(xx, y, [74, 222, 128]);
  for (let y = 69; y <= 71; y++)
    for (let x = 15; x < 385; x++) set(x, y, [167, 139, 250]);
  const found = load("local-lines").detectHorizontalLines({
    data,
    width,
    height,
  });
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0].y - 70) < 3);
});

test("clearer duplicate OCR pass replaces low-confidence copy without creating a competing label", () => {
  const labels = [label("104.25", 100, "low", 30)];
  p.mergeLabelEvidence(labels, label("104.25", 100, "badge", 96));
  assert.equal(labels.length, 1);
  assert.equal(labels[0].price, 104.25);
  assert.equal(labels[0].confidence, 96);
  const v = m.applyLabelScan(reading(), scan(labels));
  v.candidates[0].decision = "accepted";
  assert.match(m.localSummary(v), /etiquetas OCR legibles/);
  assert.doesNotMatch(m.localSummary(v), /pendiente de comprobación/);
});
