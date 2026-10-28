export function visionConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const model = env.VISION_MODEL?.trim(),
    apiKey = env.AI_GATEWAY_API_KEY?.trim();
  const userIds =
    env.CLOE_VISION_USER_IDS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  if (
    env.CLOE_VISION_ENABLED !== "true" ||
    !model ||
    !/^[\w.-]+\/[\w.:-]+$/.test(model) ||
    !apiKey ||
    !userIds.length ||
    userIds.length > 100
  )
    return null;
  // An ambient Vercel OIDC token never enables requests by itself.
  return { model, apiKey, userIds };
}
export const MAX_VISION_BYTES = 3 * 1024 * 1024;
export async function boundedPng(request: Request): Promise<Uint8Array> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "image/png")
    throw new Error("png_required");
  if (Number(request.headers.get("content-length")) > MAX_VISION_BYTES)
    throw new Error("image_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("png_required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_VISION_BYTES) throw new Error("image_too_large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 33 ||
    !signature.every((n, i) => bytes[i] === n) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  )
    throw new Error("invalid_png");
  const view = new DataView(bytes.buffer);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (
    !width ||
    !height ||
    width > 8192 ||
    height > 8192 ||
    width * height > 20_000_000
  )
    throw new Error("invalid_dimensions");
  return bytes;
}
