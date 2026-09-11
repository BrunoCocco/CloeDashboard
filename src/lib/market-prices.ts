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
};

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
