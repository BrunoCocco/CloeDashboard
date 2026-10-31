import { loadDashboard } from "@/lib/dashboard";
type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
export type MarketContext =
  | { status: "not-requested" }
  | { status: "unavailable" }
  | { status: "available"; dashboard: Dashboard };
/** A closed context must not trigger macro, quote or legacy-analysis requests. */
export async function loadMarketContext(
  userId: string,
  requested: unknown,
  getDashboard: typeof loadDashboard = loadDashboard,
): Promise<MarketContext> {
  if (requested !== "1") return { status: "not-requested" };
  try {
    return { status: "available", dashboard: await getDashboard(userId) };
  } catch {
    return { status: "unavailable" };
  }
}
