export const SYMBOLS = [
  "BTC",
  "SOL",
  "XRP",
  "HBAR",
  "XLM",
  "VELO",
  "SHX",
] as const;
export type SymbolCode = (typeof SYMBOLS)[number];
export const FRAMES = ["1W", "1D", "4H"] as const;
export type Frame = (typeof FRAMES)[number];
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type CandleBatch = {
  symbol: SymbolCode;
  frame: Frame;
  exchange: "Kraken";
  pair: string;
  currency: "USD";
  fetchedAt: string;
  candles: Candle[];
  lastBarOpen: boolean;
  gaps: number;
};
export type Level = { id: string; price: number; label: string };
export type AssetWorkspace = { note: string; levels: Level[] };
export type Workspace = {
  version: 1;
  selected: SymbolCode;
  assets: Record<SymbolCode, AssetWorkspace>;
  updatedAt: string | null;
};
export function emptyWorkspace(): Workspace {
  return {
    version: 1,
    selected: "BTC",
    assets: Object.fromEntries(
      SYMBOLS.map((symbol) => [symbol, { note: "", levels: [] }]),
    ) as unknown as Workspace["assets"],
    updatedAt: null,
  };
}
export function parseWorkspace(value: unknown): Workspace {
  if (!value || typeof value !== "object") throw new Error("Archivo inválido");
  const root = value as Record<string, unknown>;
  if (
    root.version !== 1 ||
    !SYMBOLS.includes(root.selected as SymbolCode) ||
    !root.assets ||
    typeof root.assets !== "object"
  )
    throw new Error("Formato o versión no compatible");
  const result = emptyWorkspace();
  result.selected = root.selected as SymbolCode;
  for (const symbol of SYMBOLS) {
    const asset = (root.assets as Record<string, unknown>)[symbol] as
      | Record<string, unknown>
      | undefined;
    if (
      !asset ||
      typeof asset.note !== "string" ||
      asset.note.length > 50000 ||
      !Array.isArray(asset.levels) ||
      asset.levels.length > 100
    )
      throw new Error(`Datos inválidos para ${symbol}`);
    const ids = new Set<string>();
    result.assets[symbol] = {
      note: asset.note,
      levels: asset.levels.map((item: unknown) => {
        if (!item || typeof item !== "object")
          throw new Error("Nivel inválido");
        const level = item as Record<string, unknown>;
        if (
          typeof level.id !== "string" ||
          level.id.length > 100 ||
          ids.has(level.id) ||
          typeof level.label !== "string" ||
          level.label.length > 80 ||
          typeof level.price !== "number" ||
          !Number.isFinite(level.price) ||
          level.price <= 0
        )
          throw new Error("Nivel inválido");
        ids.add(level.id);
        return { id: level.id, label: level.label, price: level.price };
      }),
    };
  }
  if (
    root.updatedAt !== null &&
    (typeof root.updatedAt !== "string" ||
      Number.isNaN(Date.parse(root.updatedAt)))
  )
    throw new Error("Fecha inválida");
  result.updatedAt = root.updatedAt as string | null;
  return result;
}
