import { validateImageLimits, validImageSignature } from "./model";
export async function normalizeImage(
  blob: Blob,
): Promise<{ image: Blob; width: number; height: number }> {
  validateImageLimits(blob.type, blob.size);
  if (
    !validImageSignature(
      new Uint8Array(await blob.slice(0, 12).arrayBuffer()),
      blob.type,
    )
  )
    throw new Error(
      "El archivo no coincide con una imagen PNG, JPEG o WebP válida.",
    );
  const bitmap = await createImageBitmap(blob);
  try {
    validateImageLimits(blob.type, blob.size, bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo procesar la imagen.");
    context.drawImage(bitmap, 0, 0);
    const image = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("No se pudo preparar la imagen.")),
        "image/png",
      ),
    );
    validateImageLimits(image.type, image.size, bitmap.width, bitmap.height);
    return { image, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
export async function screenshot(stream: MediaStream) {
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = stream;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      video.play(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "La captura no entregó una imagen. Probá cargar un archivo.",
              ),
            ),
          12000,
        );
      }),
    ]);
    clearTimeout(timer);
    if (typeof video.requestVideoFrameCallback === "function") {
      await Promise.race([
        new Promise<void>((resolve) =>
          video.requestVideoFrameCallback(() => resolve()),
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "No llegó un frame de la captura. Probá cargar una imagen.",
                ),
              ),
            10000,
          );
        }),
      ]);
    }
    validateImageLimits("image/png", 1, video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo capturar el gráfico.");
    context.drawImage(video, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("No se pudo preparar la captura.")),
        "image/png",
      ),
    );
  } finally {
    clearTimeout(timer);
    video.pause();
    video.srcObject = null;
  }
}
export function imageDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo exportar la imagen."));
    reader.readAsDataURL(blob);
  });
}
