import { createClient } from "@/lib/supabase/server";
import { SYMBOLS } from "./model";
import {
  emptyFundamental,
  parseAssetFundamental,
  parseAssetNews,
  type AssetFundamentals,
} from "./fundamentals";
export async function loadAssetFundamentals(
  userId: string,
): Promise<AssetFundamentals> {
  const supabase = await createClient();
  const entries = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const [analysisResult, newsResult] = await Promise.allSettled([
        supabase
          .from("fundamental_analyses")
          .select("as_of,evidence")
          .eq("user_id", userId)
          .contains("evidence", [{ scope: "asset", symbol }])
          .order("as_of", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("news_items")
          .select(
            "title,summary,published_at,verification_status,affected_assets,source_name,source_url",
          )
          .eq("user_id", userId)
          .contains("affected_assets", [symbol])
          .in("verification_status", ["official", "corroborated"])
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(3),
      ]);
      const analysis =
        analysisResult.status === "fulfilled" && !analysisResult.value.error
          ? parseAssetFundamental(symbol, analysisResult.value.data)
          : emptyFundamental(symbol, "unavailable");
      if (newsResult.status === "fulfilled" && !newsResult.value.error) {
        analysis.news = parseAssetNews(symbol, newsResult.value.data);
        analysis.newsStatus = analysis.news.length ? "available" : "empty";
      } else analysis.newsStatus = "unavailable";
      return [symbol, analysis] as const;
    }),
  );
  return Object.fromEntries(entries) as AssetFundamentals;
}
