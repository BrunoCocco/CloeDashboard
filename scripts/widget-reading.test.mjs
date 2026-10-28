import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
const realRequire = createRequire(import.meta.url);
function load(path, imports = {}, extra = {}) {
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
      return realRequire(name);
    },
    Date,
    Number,
    Object,
    Set,
    URL,
    DataView,
    Uint8Array,
    Request,
    Response,
    AbortSignal,
    setTimeout,
    clearTimeout,
    process: { env: {} },
    ...extra,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const schema = load("lib/captures/widget-reading.ts");
function field(
  value,
  unit = null,
  origin = value === null ? "unreadable" : "visible",
) {
  return {
    value,
    unit,
    origin,
    confidence: value === null ? null : "medium",
    rationale:
      value === null
        ? "Fuera del encuadre de prueba"
        : "Etiqueta literal en fixture de prueba",
    visibleEvidence: value === null ? null : String(value),
  };
}
function fixture() {
  return {
    schemaVersion: 1,
    panels: ["top", "middle", "bottom"].map((position) => ({
      position,
      asset: field("TEST"),
      exchange: field(null),
      pair: field("TESTUSD"),
      timeframe: field(null),
      candleReference: field(null),
      displayedPrice: field(123.45, "USD"),
      ohlc: {
        open: field(null),
        high: field(null),
        low: field(null),
        close: field(null),
      },
      volume: field(null),
      indicators: [
        {
          name: field("Custom indicator"),
          params: [{ name: "custom period", reading: field(17, "bars") }],
          values: [
            { label: "MACD fixture", reading: field(-2.5, "USD") },
            {
              label: "unsafe string fixture",
              reading: field('=HYPERLINK("bad")'),
            },
          ],
        },
      ],
      marks: [
        {
          kind: "Zona dibujada",
          geometry: "range",
          prices: [
            field(120, "USD", "estimated"),
            field(125, "USD", "estimated"),
          ],
          times: [],
          description: "Estimación de zona en fixture",
          confidence: "low",
          rationale: "Lectura aproximada del eje",
          visibleEvidence: "Rectángulo dibujado en fixture",
        },
      ],
      limitations: ["No es una cotización actual"],
    })),
    limitations: ["FIXTURE sintético para pruebas"],
  };
}
test("three panels preserve dynamic indicator parameters, negative values and estimated marks", () => {
  const result = schema.parseWidgetReading(fixture());
  assert.equal(result.panels.length, 3);
  assert.equal(result.panels[0].indicators[0].params[0].name, "custom period");
  assert.equal(result.panels[0].indicators[0].values[0].reading.value, -2.5);
  assert.equal(result.panels[0].marks[0].prices[0].origin, "estimated");
  assert.equal(result.panels[0].ohlc.close.value, null);
  assert.equal(result.panels[0].exchange.value, null);
});
test("unknowns cannot become default zero; values need evidence and confidence", () => {
  for (const mutate of [
    (reading) => (reading.panels[0].exchange.origin = "visible"),
    (reading) => (reading.panels[0].displayedPrice.visibleEvidence = null),
    (reading) => (reading.panels[0].volume.value = 0),
    (reading) => reading.panels.push(reading.panels[0]),
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => schema.parseWidgetReading(value));
  }
});
test("import always labels external reading as imported, never verified provider output", () => {
  const result = schema.importWidgetReading(JSON.stringify(fixture()));
  assert.equal(result.method, "imported");
  assert.equal(result.model, null);
  assert.throws(() =>
    schema.importWidgetReading(
      JSON.stringify({ ...fixture(), method: "vision" }),
    ),
  );
});
test("CSV flattens indicators and marks with units/types, protects formulas but preserves negative numbers", () => {
  const csv = schema.widgetReadingCsv(schema.parseWidgetReading(fixture()));
  assert.match(csv, /custom period/);
  assert.match(csv, /mark\[1\]/);
  assert.match(csv, /"-2.5","number","USD"/);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.match(csv, /"null"/);
  assert.match(csv, /estimated/);
  const value = fixture();
  value.panels[0].asset = field('TEST, "quoted"\nline');
  assert.ok(
    schema
      .widgetReadingCsv(schema.parseWidgetReading(value))
      .includes('"TEST, ""quoted""\nline"'),
  );
});
const configModule = load("lib/captures/vision-config.ts");
const enabledEnv = {
  CLOE_VISION_ENABLED: "true",
  VISION_MODEL: "fixture/model",
  AI_GATEWAY_API_KEY: "test-key-not-real",
  CLOE_VISION_USER_IDS: "allowed-user",
};
test("vision requires explicit enable, model, key and owner allowlist; ambient OIDC never suffices", () => {
  for (const env of [
    {},
    { VERCEL_OIDC_TOKEN: "test" },
    { ...enabledEnv, CLOE_VISION_ENABLED: "false" },
    { ...enabledEnv, AI_GATEWAY_API_KEY: undefined },
    { ...enabledEnv, CLOE_VISION_USER_IDS: "" },
    { ...enabledEnv, VISION_MODEL: "" },
  ])
    assert.equal(configModule.visionConfig(env), null);
  assert.equal(configModule.visionConfig(enabledEnv).model, "fixture/model");
});
function route({ userId = "allowed-user", env = {}, error = null } = {}) {
  let providerImports = 0,
    providerCalls = 0;
  const config = load(
    "lib/captures/vision-config.ts",
    {},
    { process: { env } },
  );
  const api = load("app/api/captures/vision/route.ts", {
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getClaims: async () => ({
            data: userId ? { claims: { sub: userId } } : null,
            error,
          }),
        },
      }),
    },
    "@/lib/captures/vision-config": config,
    get "@/lib/captures/vision-provider"() {
      providerImports++;
      return {
        generateWidgetReading: async () => {
          providerCalls++;
          return fixture();
        },
      };
    },
  });
  return { api, imports: () => providerImports, calls: () => providerCalls };
}
test("unconfigured endpoint returns honest status and never imports or invokes provider", async () => {
  const subject = route();
  const status = await subject.api.GET();
  assert.equal((await status.json()).status, "disabled_local_only");
  assert.equal(
    (
      await subject.api.POST(
        new Request("https://example.test/api/captures/vision", {
          method: "POST",
        }),
      )
    ).status,
    503,
  );
  assert.equal(subject.imports(), 0);
  assert.equal(subject.calls(), 0);
});
test("local-only endpoint rejects every identity even with configured provider", async () => {
  for (const [input] of [
    [{ userId: null, env: enabledEnv }, 401],
    [{ userId: "other-user", env: enabledEnv }, 403],
    [{ userId: "allowed-user", env: enabledEnv, error: { status: 503 } }, 401],
  ]) {
    const subject = route(input);
    const result = await subject.api.POST(
      new Request("https://example.test/api/captures/vision", {
        method: "POST",
      }),
    );
    assert.equal(result.status, 503);
    assert.equal(subject.imports(), 0);
    assert.equal(subject.calls(), 0);
  }
});
test("local-only rejects payloads and bounded PNG helper still rejects oversize", async () => {
  const subject = route({ env: enabledEnv });
  for (const headers of [
    {},
    { "x-cloe-vision-consent": "true", origin: "https://evil.test" },
    { "x-cloe-vision-consent": "true", "content-type": "application/json" },
  ]) {
    const result = await subject.api.POST(
      new Request("https://example.test/api/captures/vision", {
        method: "POST",
        headers,
        body: "{}",
      }),
    );
    assert.equal(result.status, 503);
  }
  const oversized = new Request("https://example.test", {
    method: "POST",
    headers: {
      "content-type": "image/png",
      "content-length": String(4 * 1024 * 1024),
    },
    body: "x",
  });
  await assert.rejects(configModule.boundedPng(oversized));
  assert.equal(subject.imports(), 0);
  assert.equal(subject.calls(), 0);
});

test("configured allowed consented request cannot activate remote generation", async () => {
  const subject = route({ env: enabledEnv });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZQAAAABJRU5ErkJggg==",
    "base64",
  );
  const result = await subject.api.POST(
    new Request("https://example.test/api/captures/vision", {
      method: "POST",
      headers: {
        "content-type": "image/png",
        "x-cloe-vision-consent": "true",
        origin: "https://example.test",
      },
      body: png,
    }),
  );
  assert.equal(result.status, 503);
  assert.equal(subject.imports(), 0);
  assert.equal(subject.calls(), 0);
});

test("version-one local snapshots remain readable and new structured readings persist without a DB migration", async () => {
  const model = load("lib/captures/model.ts", {}, { crypto });
  const storage = load(
    "lib/captures/storage.ts",
    {},
    { indexedDB: new IDBFactory(), IDBKeyRange, Blob },
  );
  const base = model.buildMetadata(
    "owner",
    {
      asset: "TEST",
      exchange: "fixture",
      pair: "TESTUSD",
      timeframe: "ALL",
      title: "Old snapshot",
      notes: "Preserve old evidence",
      hypothesis: "",
      invalidation: "",
      observedAt: "",
      reviewed: true,
    },
    { method: "upload", capturedAt: null, width: 100, height: 100 },
    [],
    "",
  );
  await storage.saveCapture({ ...base, image: new Blob(["fixture image"]) });
  const newer = {
    ...base,
    id: "newer-snapshot",
    widgetReading: schema.importWidgetReading(JSON.stringify(fixture())),
    image: new Blob(["new fixture image"]),
  };
  await storage.saveCapture(newer);
  const previous = await storage.readCapture("owner", base.id);
  assert.equal(previous.widgetReading, undefined);
  assert.equal(previous.notes, "Preserve old evidence");
  const restored = await storage.readCapture("owner", newer.id);
  assert.equal(restored.widgetReading.method, "imported");
  assert.equal(restored.widgetReading.data.panels.length, 3);
  assert.equal(
    restored.widgetReading.data.panels[0].indicators[0].values[0].reading.value,
    -2.5,
  );
});
