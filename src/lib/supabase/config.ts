const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function getSupabaseConfig() {
  if (!projectUrl || !publishableKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { projectUrl, publishableKey };
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelUrl = process.env.VERCEL_URL;

  const baseUrl = configuredUrl
    ?? (vercelProductionUrl ? `https://${vercelProductionUrl}` : undefined)
    ?? (vercelUrl ? `https://${vercelUrl}` : undefined)
    ?? "http://localhost:3000";

  return baseUrl.replace(/\/$/, "");
}
