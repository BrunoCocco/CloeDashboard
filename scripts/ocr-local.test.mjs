import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(name, extra = {}) {
  const c = {
    exports: {},
    Blob,
    AbortController,
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
test("mocked OCR wrapper opts into bounding blocks and maps crop coordinates to original pixels", async () => {
  let closed = false,
    terminated = false,
    blocks = false;
  const worker = {
    setParameters: async () => {},
    terminate: async () => {
      terminated = true;
    },
    recognize: async (_image, _options, output) => {
      blocks = output.blocks;
      return {
        data: {
          text: "104.25",
          blocks: [
            {
              paragraphs: [
                {
                  lines: [
                    {
                      words: [
                        {
                          text: "104.25",
                          confidence: 96,
                          bbox: { x0: 400, y0: 190, x1: 460, y1: 210 },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(800 * 1600 * 4) }),
    }),
    toBlob: (callback) => callback(new Blob(["mock crop"])),
  };
  const mod = load("ocr", {
    createImageBitmap: async () => ({
      close: () => {
        closed = true;
      },
    }),
    document: { createElement: () => canvas },
    require: (name) =>
      name === "tesseract.js"
        ? { createWorker: async () => worker }
        : load("price-labels"),
  });
  const result = await mod.readPriceLabels(
    new Blob(["mock image"]),
    1000,
    800,
    new AbortController().signal,
  );
  assert.equal(blocks, true);
  assert.equal(result.labels[0].price, 104.25);
  assert.equal(result.labels[0].bbox.x0, 800);
  assert.equal(result.labels[0].bbox.y0, 95);
  assert.equal(closed, true);
  assert.equal(terminated, true);
});
test("cancellation during worker initialization rejects promptly and terminates late worker", async () => {
  let release,
    terminated = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const worker = {
    terminate: async () => {
      terminated = true;
    },
    recognize: async () => {
      throw Error("Recognition must not start after cancel");
    },
  };
  const mod = load("ocr", {
    require: (name) =>
      name === "tesseract.js"
        ? {
            createWorker: async () => {
              await gate;
              return worker;
            },
          }
        : load("price-labels"),
  });
  const controller = new AbortController();
  const task = mod.readCaptureText(new Blob(["mock"]), controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  await assert.rejects(task, /cancelada/);
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(terminated, true);
});
