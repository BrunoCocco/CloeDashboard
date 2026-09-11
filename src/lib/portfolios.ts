import { loadMarketQuotes } from "@/lib/market-prices";
import { createClient } from "@/lib/supabase/server";

export type PortfolioPosition = {
  symbol: string;
  quantity: string;
  averageEntry: string;
  currentPrice: string;
  cost: number;
  marketValue: number | null;
  returnPct: number | null;
  allocationPct: number;
};

export type PortfolioView = {
  id: number;
  name: string;
  type: "spot" | "futures";
  mode: "real" | "simulation";
  currency: string;
  informationDate: string | null;
  positions: PortfolioPosition[];
  totalCost: number;
  totalValue: number | null;
  returnPct: number | null;
};

export type OperatorStatus = {
  label: string;
  analysisDate: string | null;
};

export type PortfoliosPageData = {
  portfolios: PortfolioView[];
  operator: OperatorStatus;
};

function formatOperatorAction(value: string | null | undefined) {
  if (!value) return "SIN REGISTRO";

  const normalized = value.trim().toLowerCase();
  if (normalized === "no_operation") return "SIN OPERACIÓN";
  if (normalized.includes("long") || normalized.includes("buy")) return "POSIBLE LARGO";
  if (normalized.includes("watch") || normalized.includes("monitor")) return "EN VIGILANCIA";
  if (normalized.includes("wait")) return "EN ESPERA";
  return "ESTADO EN REVISIÓN";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return "Sin cotización";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 6 }).format(value);
}

export async function loadPortfolios(userId: string) {
  const supabase = await createClient();
  const [accountsResult, positionsResult, operatorResult] = await Promise.all([
    supabase
      .from("portfolio_accounts")
      .select("id, name, account_type, mode, base_currency, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("account_type"),
    supabase
      .from("portfolio_positions")
      .select("portfolio_account_id, symbol, quantity, average_entry, information_date, status")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("symbol"),
    supabase
      .from("daily_syntheses")
      .select("analysis_date, operator_action")
      .eq("user_id", userId)
      .order("analysis_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const failed = [accountsResult, positionsResult, operatorResult].find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const accounts = accountsResult.data ?? [];
  const rows = positionsResult.data ?? [];
  const quotes = await loadMarketQuotes(rows.map((row) => row.symbol));

  const portfolios = accounts.map((account): PortfolioView => {
    const accountRows = rows.filter((row) => row.portfolio_account_id === account.id);
    const raw = accountRows.map((row) => {
      const quantity = Number(row.quantity);
      const averageEntry = Number(row.average_entry);
      const price = account.base_currency === "EUR"
        ? quotes.get(row.symbol)?.eur ?? null
        : quotes.get(row.symbol)?.usd ?? null;
      const cost = quantity * averageEntry;
      const marketValue = price === null ? null : quantity * price;
      const returnPct = marketValue === null || cost === 0 ? null : ((marketValue - cost) / cost) * 100;

      return { row, quantity, averageEntry, price, cost, marketValue, returnPct };
    });

    const totalCost = raw.reduce((sum, position) => sum + position.cost, 0);
    const hasAllPrices = raw.length > 0 && raw.every((position) => position.marketValue !== null);
    const totalValue = hasAllPrices
      ? raw.reduce((sum, position) => sum + (position.marketValue ?? 0), 0)
      : null;
    const returnPct = totalValue === null || totalCost === 0 ? null : ((totalValue - totalCost) / totalCost) * 100;

    return {
      id: account.id,
      name: account.name,
      type: account.account_type,
      mode: account.mode,
      currency: account.base_currency,
      informationDate: accountRows
        .map((row) => row.information_date)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
      positions: raw.map((position) => ({
        symbol: position.row.symbol,
        quantity: formatQuantity(position.quantity),
        averageEntry: formatMoney(position.averageEntry, account.base_currency),
        currentPrice: formatMoney(position.price, account.base_currency),
        cost: position.cost,
        marketValue: position.marketValue,
        returnPct: position.returnPct,
        allocationPct: totalValue && position.marketValue !== null
          ? (position.marketValue / totalValue) * 100
          : totalCost > 0 ? (position.cost / totalCost) * 100 : 0,
      })),
      totalCost,
      totalValue,
      returnPct,
    };
  });

  return {
    portfolios,
    operator: {
      label: formatOperatorAction(operatorResult.data?.operator_action),
      analysisDate: operatorResult.data?.analysis_date ?? null,
    },
  } satisfies PortfoliosPageData;
}

export { formatMoney };
