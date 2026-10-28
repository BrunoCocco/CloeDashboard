"use client";

import { useEffect, useState } from "react";

const COINS = {
  BTC: "bitcoin",
  SOL: "solana",
  XRP: "ripple",
  HBAR: "hedera-hashgraph",
  XLM: "stellar",
  VELO: "velo",
  SHX: "stronghold-token",
};
type Quote = {
  symbol: string;
  price: number | null;
  change24h: number | null;
  change1y: number | null;
};
type CoinResponse = {
  id: string;
  current_price?: number | null;
  price_change_percentage_24h?: number | null;
  price_change_percentage_1y_in_currency?: number | null;
};
const STORAGE_KEY = "graficoxrp-market-strip";
const REFRESH_MS = 5 * 60 * 1000;

function savedQuotes(): Quote[] {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function formatPrice(value: number | null) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function Change({ period, value }: { period: string; value: number | null }) {
  const text =
    typeof value === "number"
      ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
      : "—";
  const className =
    typeof value !== "number"
      ? "unavailable"
      : value >= 0
        ? "positive"
        : "negative";
  return (
    <span
      aria-label={`${period}: ${text}`}
      className={className}
      title={period}
    >
      {text}
    </span>
  );
}

export default function MarketStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (symbol: string) => void;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const ids = Object.values(COINS).join(",");
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1y`,
        );
        if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
        const data = (await response.json()) as CoinResponse[];
        const byId = new Map(data.map((coin) => [coin.id, coin]));
        const next = Object.entries(COINS).map(([symbol, id]) => {
          const coin = byId.get(id);
          return {
            symbol,
            price: coin?.current_price ?? null,
            change24h: coin?.price_change_percentage_24h ?? null,
            change1y: coin?.price_change_percentage_1y_in_currency ?? null,
          };
        });
        if (!active) return;
        setQuotes(next);
        setStale(false);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        if (active) setStale(true);
      }
    }
    queueMicrotask(() => {
      if (active) setQuotes(savedQuotes());
    });
    refresh();
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const display =
    quotes.length > 0
      ? quotes
      : Object.keys(COINS).map((symbol) => ({
          symbol,
          price: null,
          change24h: null,
          change1y: null,
        }));
  return (
    <footer className="market-strip" aria-label="Precios de activos seguidos">
      {display.map((quote) => (
        <button
          type="button"
          className={`market-quote${selected === quote.symbol ? " selected" : ""}`}
          key={quote.symbol}
          onClick={() => onSelect(quote.symbol)}
          aria-pressed={selected === quote.symbol}
          aria-label={`Ver gráficos de ${quote.symbol}`}
        >
          <div className="quote-heading">
            <strong>{quote.symbol}</strong>
            <span>{formatPrice(quote.price)}</span>
          </div>
          <div className="quote-changes">
            <Change period="Variación diaria" value={quote.change24h} />
            <Change period="Variación anual" value={quote.change1y} />
          </div>
        </button>
      ))}
      <span className="sr-only" aria-live="polite">
        {stale
          ? "Sin conexión: se conserva el último dato válido"
          : "Cotizaciones actualizadas"}
      </span>
    </footer>
  );
}
