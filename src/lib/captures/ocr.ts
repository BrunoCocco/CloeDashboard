import type { Worker } from "tesseract.js";
export async function readCaptureText(
  image: Blob,
  signal: AbortSignal,
): Promise<string> {
  let worker: Worker | null = null;
  let finished = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let rejectCancelled: ((reason: Error) => void) | undefined;
  const cancel = () => {
    rejectCancelled?.(new Error("Lectura OCR cancelada."));
  };
  const cancelled = new Promise<never>((_, reject) => {
    rejectCancelled = reject;
    timeout = setTimeout(
      () =>
        reject(
          new Error(
            "La lectura superó 90 segundos. Podés continuar con revisión manual.",
          ),
        ),
      90000,
    );
    signal.addEventListener("abort", cancel, { once: true });
  });
  const work = async () => {
    const { createWorker } = await import("tesseract.js");
    if (signal.aborted || finished) throw new Error("Lectura OCR cancelada.");
    const created = await createWorker("eng", 1, {
      workerPath:
        "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0",
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
    });
    if (signal.aborted || finished) {
      await created.terminate();
      throw new Error("Lectura OCR cancelada.");
    }
    worker = created;
    const result = await created.recognize(image);
    return result.data.text.slice(0, 100000);
  };
  try {
    if (signal.aborted) throw new Error("Lectura OCR cancelada.");
    return await Promise.race([work(), cancelled]);
  } finally {
    finished = true;
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    if (worker) {
      void (worker as Worker).terminate().catch(() => {});
    }
  }
}
