import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";
import { authErrorMessage, isAuthServiceUnavailable } from "./auth-errors";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { projectUrl, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(projectUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  let hasIdentity = false;
  let verificationFailure: unknown = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    hasIdentity =
      !error &&
      typeof data?.claims?.sub === "string" &&
      data.claims.sub.length > 0;
    if (error && isAuthServiceUnavailable(error)) verificationFailure = error;
  } catch (error) {
    // A network failure must never grant access or break the public login page.
    verificationFailure = error;
  }
  const isPublicRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!hasIdentity && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (verificationFailure)
      loginUrl.searchParams.set("error", authErrorMessage(verificationFailure));
    return NextResponse.redirect(loginUrl);
  }

  if (hasIdentity && request.nextUrl.pathname.startsWith("/login")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
