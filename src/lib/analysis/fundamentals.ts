import type { SymbolCode } from "./model";
export type FundamentalSource = { name: string; url: string | null };
export type FundamentalEvidence = {
  text: string;
  source: FundamentalSource | null;
  observedAt: string | null;
};
export type AssetNewsItem = {
  title: string;
  summary: string | null;
  publishedAt: string | null;
  verification: "official" | "corroborated";
  source: FundamentalSource | null;
};
export type AssetFundamental = {
  symbol: SymbolCode;
  status: "available" | "empty" | "unavailable";
  summary: string | null;
  hypothesis: string | null;
  asOf: string | null;
  cutoffOrigin: "asset" | "record" | null;
  regime: "favorable" | "neutral" | "negative" | "insufficient_data" | null;
  confidence: number | null;
  evidence: FundamentalEvidence[];
  risks: string[];
  opportunities: string[];
  sources: FundamentalSource[];
  news: AssetNewsItem[];
  newsStatus: "available" | "empty" | "unavailable";
};
export type AssetFundamentals = Record<SymbolCode, AssetFundamental>;
function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function date(value: unknown) {
  const result = text(value);
  return result && !Number.isNaN(Date.parse(result))
    ? new Date(result).toISOString()
    : null;
}
function source(value: unknown): FundamentalSource | null {
  const object = record(value);
  const name = text(object?.name);
  if (!name) return null;
  let url: string | null = null;
  if (typeof object?.url === "string") {
    try {
      const candidate = new URL(object.url);
      if (["http:", "https:"].includes(candidate.protocol))
        url = candidate.href;
    } catch {
      /* Invalid links are not rendered. */
    }
  }
  return { name, url };
}
function strings(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => (text(item) ? [text(item)!] : []))
    : [];
}
export function emptyFundamental(
  symbol: SymbolCode,
  status: "empty" | "unavailable" = "empty",
): AssetFundamental {
  return {
    symbol,
    status,
    summary: null,
    hypothesis: null,
    asOf: null,
    cutoffOrigin: null,
    regime: null,
    confidence: null,
    evidence: [],
    risks: [],
    opportunities: [],
    sources: [],
    news: [],
    newsStatus: "empty",
  };
}
// Only explicit asset-scoped blocks are admissible. Mentions of a coin in macro
// prose never become an asset analysis, nor do global confidence/regime fields.
export function parseAssetFundamental(
  symbol: SymbolCode,
  row: { as_of?: unknown; evidence?: unknown } | null,
): AssetFundamental {
  if (!row || !Array.isArray(row.evidence)) return emptyFundamental(symbol);
  const matching = row.evidence
    .map(record)
    .filter(
      (block) =>
        block?.scope === "asset" &&
        block.symbol === symbol &&
        text(block.summary),
    );
  const blocks = matching.sort(
    (a, b) =>
      (Date.parse(date(b?.as_of) ?? date(row.as_of) ?? "") || 0) -
      (Date.parse(date(a?.as_of) ?? date(row.as_of) ?? "") || 0),
  );
  const block = blocks[0];
  if (!block) return emptyFundamental(symbol);
  const assetDate = date(block.as_of),
    recordDate = date(row.as_of);
  const evidence = Array.isArray(block.evidence)
    ? block.evidence.flatMap((item) => {
        if (text(item))
          return [{ text: text(item)!, source: null, observedAt: null }];
        const object = record(item),
          content = text(object?.text);
        return content
          ? [
              {
                text: content,
                source: source(object?.source),
                observedAt: date(object?.as_of),
              },
            ]
          : [];
      })
    : [];
  const regimes = ["favorable", "neutral", "negative", "insufficient_data"];
  return {
    ...emptyFundamental(symbol),
    symbol,
    status: "available",
    summary: text(block.summary),
    hypothesis: text(block.hypothesis),
    asOf: assetDate ?? recordDate,
    cutoffOrigin: assetDate ? "asset" : recordDate ? "record" : null,
    regime:
      typeof block.regime === "string" && regimes.includes(block.regime)
        ? (block.regime as AssetFundamental["regime"])
        : null,
    confidence:
      typeof block.confidence === "number" &&
      Number.isFinite(block.confidence) &&
      block.confidence >= 0 &&
      block.confidence <= 100
        ? block.confidence
        : null,
    evidence,
    risks: strings(block.risks),
    opportunities: strings(block.opportunities),
    sources: Array.isArray(block.sources)
      ? block.sources.flatMap((item) => {
          const value = source(item);
          return value ? [value] : [];
        })
      : [],
  };
}

export function parseAssetNews(
  symbol: SymbolCode,
  values: unknown,
): AssetNewsItem[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const item = record(value),
      title = text(item?.title);
    if (
      !item ||
      !title ||
      !Array.isArray(item.affected_assets) ||
      !item.affected_assets.includes(symbol) ||
      !["official", "corroborated"].includes(String(item.verification_status))
    )
      return [];
    return [
      {
        title,
        summary: text(item.summary),
        publishedAt: date(item.published_at),
        verification: item.verification_status as AssetNewsItem["verification"],
        source: source({ name: item.source_name, url: item.source_url }),
      },
    ];
  });
}
