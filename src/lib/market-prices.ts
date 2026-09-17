export type MarketQuote = {
  symbol: string;
  usd: number | null;
  eur: number | null;
  change24h: number | null;
  updatedAt: string | null;
};

type CoinGeckoQuote = {
  usd?: number;
  eur?: number;
  usd_24h_change?: number;
  last_updated_at?: number;
};

const coinIds: Record<string, string> = {
  BTC: "bitcoin",
  SOL: "solana",
  XRP: "ripple",
  HBAR: "hedera-hashgraph",
  XLM: "stellar",
  VELO: "velo",
  SHX: "stronghold-token",
};

export const marketStripSymbols = ["BTC", "SOL", "XRP", "HBAR", "XLM", "VELO", "SHX"] as const;
export type MarketStripSymbol = (typeof marketStripSymbols)[number];

export type MarketStripQuote = {
  symbol: MarketStripSymbol;
  usd: number;
  change24h: number | null;
  change1y: number | null;
  marketCap: number | null;
};

type CoinGeckoMarket = {
  id?: string;
  current_price?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_1y_in_currency?: number;
  market_cap?: number;
};

export async function loadMarketStrip(): Promise<{ quotes: MarketStripQuote[]; updatedAt: string }> {
  const ids = marketStripSymbols.map((symbol) => coinIds[symbol]).join(",");
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids,
    price_change_percentage: "1y",
    precision: "full",
  });
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(6_000),
  });

  if (!response.ok) throw new Error(`CoinGecko respondió ${response.status}`);
  const payload = (await response.json()) as CoinGeckoMarket[];
  const byId = new Map(payload.map((quote) => [quote.id, quote]));
  const quotes = marketStripSymbols.flatMap((symbol) => {
    const quote = byId.get(coinIds[symbol]);
    if (!quote || typeof quote.current_price !== "number") return [];
    return [{
      symbol,
      usd: quote.current_price,
      change24h: typeof quote.price_change_percentage_24h === "number" ? quote.price_change_percentage_24h : null,
      change1y: typeof quote.price_change_percentage_1y_in_currency === "number" ? quote.price_change_percentage_1y_in_currency : null,
      marketCap: typeof quote.market_cap === "number" ? quote.market_cap : null,
    }];
  });

  if (quotes.length === 0) throw new Error("CoinGecko no devolvió cotizaciones válidas");
  return { quotes, updatedAt: new Date().toISOString() };
}

export async function loadMarketQuotes(symbols: string[]) {
  const requested = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))]
    .filter((symbol) => coinIds[symbol]);

  if (requested.length === 0) return new Map<string, MarketQuote>();

  const ids = requested.map((symbol) => coinIds[symbol]);
  const params = new URLSearchParams({
    ids: ids.join(","),
    vs_currencies: "usd,eur",
    include_24hr_change: "true",
    include_last_updated_at: "true",
    precision: "full",
  });

  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4_000),
    });

    if (!response.ok) return new Map<string, MarketQuote>();

    const payload = (await response.json()) as Record<string, CoinGeckoQuote>;
    return new Map(requested.map((symbol) => {
      const quote = payload[coinIds[symbol]] ?? {};
      return [symbol, {
        symbol,
        usd: typeof quote.usd === "number" ? quote.usd : null,
        eur: typeof quote.eur === "number" ? quote.eur : null,
        change24h: typeof quote.usd_24h_change === "number" ? quote.usd_24h_change : null,
        updatedAt: typeof quote.last_updated_at === "number"
          ? new Date(quote.last_updated_at * 1_000).toISOString()
          : null,
      }];
    }));
  } catch {
    return new Map<string, MarketQuote>();
  }
}
