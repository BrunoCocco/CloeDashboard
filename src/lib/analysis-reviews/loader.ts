import { createClient } from "@/lib/supabase/server";
import {
  isDate,
  isTimestamp,
  isUuid,
  parseReviewSnapshot,
  REVIEW_ASSETS,
  type ReviewArchive,
  type ReviewAsset,
  type ReviewSummary,
  type ReviewEntry,
} from "./model";
type Client = Awaited<ReturnType<typeof createClient>>;
type Cursor = { date: string; created: string; id: string };
export function encodeReviewCursor(item: ReviewSummary): string {
  return Buffer.from(
    JSON.stringify({
      date: item.analysisDate,
      created: item.createdAt,
      id: item.id,
    }),
  ).toString("base64url");
}
export function decodeReviewCursor(value: string): Cursor {
  if (value.length > 500 || !/^[A-Za-z0-9_-]+$/.test(value))
    throw Error("Cursor inválido");
  const x = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (!isDate(x.date) || !isTimestamp(x.created) || !isUuid(x.id))
    throw Error("Cursor inválido");
  return x;
}
export function parseReviewSummary(row: unknown): ReviewSummary {
  if (!row || typeof row !== "object") throw Error("Registro inválido");
  const x = row as Record<string, unknown>;
  if (
    !isUuid(x.id) ||
    !isDate(x.analysis_date) ||
    !isTimestamp(x.created_at) ||
    !REVIEW_ASSETS.includes(x.asset_symbol as ReviewAsset) ||
    (x.observed_at !== null && !isTimestamp(x.observed_at)) ||
    (x.revision_of !== null && !isUuid(x.revision_of))
  )
    throw Error("Registro no compatible");
  return {
    id: x.id,
    analysisDate: x.analysis_date,
    createdAt: x.created_at,
    observedAt: x.observed_at as string | null,
    asset: x.asset_symbol as ReviewAsset,
    revisionOf: x.revision_of as string | null,
  };
}
export async function loadReviewArchive(
  userId: string,
  options: { asset?: string; cut?: string; before?: string } = {},
  getClient: () => Promise<Client> = createClient,
): Promise<ReviewArchive> {
  const state: ReviewArchive = {
    status: "empty",
    items: [],
    selected: null,
    nextCursor: null,
    asset: null,
    message: null,
  };
  let cursor: Cursor | null = null;
  try {
    if (!userId) throw Error("Sin propietario");
    if (options.asset) {
      if (!REVIEW_ASSETS.includes(options.asset as ReviewAsset))
        throw Error("Activo inválido");
      state.asset = options.asset as ReviewAsset;
    }
    if (options.cut && !isUuid(options.cut)) throw Error("Corte inválido");
    if (options.before) cursor = decodeReviewCursor(options.before);
  } catch {
    return {
      ...state,
      status: "invalid",
      message:
        "El filtro o corte solicitado no es válido. Volvé al último análisis.",
    };
  }
  try {
    const db = await getClient();
    let query = db
      .from("analysis_review_snapshots")
      .select(
        "id,asset_symbol,analysis_date,observed_at,created_at,revision_of",
      )
      .eq("user_id", userId);
    if (state.asset) query = query.eq("asset_symbol", state.asset);
    if (cursor)
      query = query.or(
        `analysis_date.lt.${cursor.date},and(analysis_date.eq.${cursor.date},created_at.lt.${cursor.created}),and(analysis_date.eq.${cursor.date},created_at.eq.${cursor.created},id.lt.${cursor.id})`,
      );
    const result = await query
      .order("analysis_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(21);
    if (result.error) throw Error("Consulta no disponible");
    const rows = (result.data ?? []).map(parseReviewSummary);
    state.items = rows.slice(0, 20);
    state.nextCursor =
      rows.length > 20 ? encodeReviewCursor(state.items[19]) : null;
    const selectedId = options.cut ?? state.items[0]?.id;
    if (!selectedId) return state;
    let detail = db
      .from("analysis_review_snapshots")
      .select(
        "id,asset_symbol,analysis_date,observed_at,created_at,revision_of,snapshot",
      )
      .eq("user_id", userId)
      .eq("id", selectedId);
    if (state.asset) detail = detail.eq("asset_symbol", state.asset);
    const selected = await detail.maybeSingle();
    if (selected.error) throw Error("Corte no disponible");
    if (!selected.data)
      return {
        ...state,
        status: "invalid",
        message: "El corte no está disponible para este usuario y filtro.",
      };
    const summary = parseReviewSummary(selected.data),
      snapshot = parseReviewSnapshot(selected.data.snapshot);
    if (
      snapshot.analysisDate !== summary.analysisDate ||
      snapshot.asset.symbol !== summary.asset ||
      snapshot.source.observedAt !== summary.observedAt
    )
      throw Error("Corte incoherente");
    const entry: ReviewEntry = {
      ...summary,
      snapshot,
      example: false,
      isLatest: !options.before && selectedId === state.items[0]?.id,
    };
    return { ...state, status: "ready", selected: entry };
  } catch {
    return {
      ...state,
      status: "unavailable",
      selected: null,
      message:
        "No se pudo consultar el archivo de análisis. Sin actualización: no se sustituye por un ejemplo. La tabla o sus permisos pueden estar pendientes de habilitación.",
    };
  }
}
