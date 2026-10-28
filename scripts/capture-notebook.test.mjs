import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
function load(name, extra = {}) {
  const source = readFileSync(
    new URL(`../src/lib/captures/${name}.ts`, import.meta.url),
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
    Blob,
    crypto,
    Date,
    Number,
    Set,
    setTimeout,
    clearTimeout,
    ...extra,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const model = load("model");
const draft = () => ({
  asset: "BTC",
  exchange: "Kraken",
  pair: "BTCUSD",
  timeframe: "1D",
  title: "Original hypothesis",
  notes: "Original observation",
  hypothesis: "Test hypothesis",
  invalidation: "Test invalidation",
  observedAt: "",
  reviewed: true,
});
const metadata = (owner) =>
  model.buildMetadata(
    owner,
    draft(),
    { method: "upload", capturedAt: null, width: 100, height: 100 },
    [],
    "",
  );
const store = () =>
  load("storage", { indexedDB: new IDBFactory(), IDBKeyRange });
test("OCR candidates preserve ambiguous separators and cannot silently create levels", () => {
  const tokens = Array.from(
    model.numericCandidates("BTC 70.000 and 70,000 plus 2026 repeated 70.000"),
  );
  assert.deepEqual(tokens, ["70.000", "70,000", "2026"]);
  assert.throws(() => model.positivePrice("70,000"));
  assert.throws(() => model.positivePrice("0"));
  assert.throws(() => model.positivePrice("Infinity"));
  assert.equal(model.positivePrice("12.34"), 12.34);
});
test("metadata requires explicit review, valid dates and manually confirmed positive levels", () => {
  const image = { method: "upload", capturedAt: null, width: 100, height: 100 };
  assert.throws(() =>
    model.buildMetadata(
      "owner",
      { ...draft(), reviewed: false },
      image,
      [],
      "",
    ),
  );
  assert.throws(() =>
    model.buildMetadata(
      "owner",
      { ...draft(), observedAt: "invalid" },
      image,
      [],
      "",
    ),
  );
  assert.throws(() =>
    model.buildMetadata(
      "owner",
      draft(),
      image,
      [{ price: 10, kind: "support", label: "Support", confirmed: false }],
      "",
    ),
  );
  const result = model.buildMetadata(
    "owner",
    draft(),
    image,
    [{ price: 12.5, kind: "support", label: "Support", confirmed: true }],
    "12.5 raw OCR",
  );
  assert.equal(result.observedAt, null);
  assert.equal(result.capturedAt, null);
  assert.equal(result.ownerId, "owner");
  assert.equal(result.levels.length, 1);
  assert.notEqual(result.id, metadata("owner").id);
});
test("image validation rejects wrong formats, excessive size/dimensions and false signatures", () => {
  assert.throws(() => model.validateImageLimits("image/svg+xml", 100));
  assert.throws(() => model.validateImageLimits("image/png", 13 * 1024 * 1024));
  assert.throws(() => model.validateImageLimits("image/png", 10, 9000, 100));
  assert.throws(() => model.validateImageLimits("image/png", 10, 7000, 7000));
  assert.equal(
    model.validImageSignature(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
    true,
  );
  assert.equal(
    model.validImageSignature(new Uint8Array([1, 2, 3]), "image/png"),
    false,
  );
});
test("IndexedDB reload preserves blob+metadata and isolates user/asset histories", async () => {
  const db = store(),
    first = {
      ...metadata("owner-a"),
      image: new Blob(["image-one"], { type: "image/png" }),
    };
  const other = {
    ...metadata("owner-b"),
    id: first.id,
    image: new Blob(["private-other-owner"], { type: "image/png" }),
  };
  const sol = {
    ...metadata("owner-a"),
    asset: "SOL",
    image: new Blob(["image-sol"], { type: "image/png" }),
  };
  await db.saveCapture(first);
  await db.saveCapture(other);
  await db.saveCapture(sol);
  assert.equal((await db.listCaptures("owner-a", "BTC")).length, 1);
  assert.equal((await db.listCaptures("owner-a")).length, 2);
  assert.equal((await db.listCaptures("owner-b")).length, 1);
  const restored = await db.readCapture("owner-a", first.id);
  assert.equal(restored.notes, "Original observation");
  assert.equal(await restored.image.text(), "image-one");
  assert.equal(await db.readCapture("unrelated-owner", first.id), null);
});
test("duplicate snapshot aborts both stores and never overwrites prior evidence", async () => {
  const db = store(),
    original = { ...metadata("owner"), image: new Blob(["original"]) };
  await db.saveCapture(original);
  await assert.rejects(
    db.saveCapture({
      ...original,
      title: "Rewritten",
      image: new Blob(["replacement"]),
    }),
  );
  const restored = await db.readCapture("owner", original.id);
  assert.equal(restored.title, "Original hypothesis");
  assert.equal(await restored.image.text(), "original");
  assert.equal((await db.listCaptures("owner")).length, 1);
});
