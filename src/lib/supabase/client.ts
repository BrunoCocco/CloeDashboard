import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const { projectUrl, publishableKey } = getSupabaseConfig();
  return createBrowserClient(projectUrl, publishableKey);
}
