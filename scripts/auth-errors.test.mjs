import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
function load(path, imports = {}) {
  const code = ts.transpileModule(
    readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const context = {
    exports: {},
    require: (name) => {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import ${name}`);
    },
    Boolean,
    String,
    encodeURIComponent,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const messages = load("lib/supabase/auth-errors.ts");
const outageText = /servicio de acceso no está disponible/;
test("503, SDK retryable and network failures never blame credentials", () => {
  for (const error of [
    { status: 503, message: "upstream connect error" },
    { name: "AuthRetryableFetchError", status: 0 },
    new TypeError("fetch failed"),
    { name: "TimeoutError" },
  ]) {
    assert.match(messages.authErrorMessage(error), outageText);
    assert.doesNotMatch(messages.authErrorMessage(error), /contraseña no/);
  }
});
test("rate limits, invalid credentials and confirmation have distinct safe messages", () => {
  assert.match(
    messages.authErrorMessage({ status: 429 }),
    /límite de intentos/,
  );
  assert.match(
    messages.authErrorMessage({ code: "invalid_credentials" }),
    /contraseña no son correctos/,
  );
  assert.match(
    messages.authErrorMessage({ code: "email_not_confirmed" }),
    /Confirmá tu email/,
  );
  assert.doesNotMatch(
    messages.authErrorMessage({ message: "secret internal detail" }),
    /secret internal detail/,
  );
});
function credentials() {
  const form = new FormData();
  form.set("email", "EXAMPLE@example.com");
  form.set("password", "test-input-not-real-password");
  return form;
}
function actions(auth) {
  return load("app/login/actions.ts", {
    "next/navigation": {
      redirect: (location) => {
        const error = new Error("redirect");
        error.location = location;
        throw error;
      },
    },
    "@/lib/supabase/server": { createClient: async () => ({ auth }) },
    "@/lib/supabase/config": { getSiteUrl: () => "https://example.test" },
    "@/lib/supabase/auth-errors": messages,
  });
}
function redirectedTo(matcher) {
  return (error) => {
    assert.match(decodeURIComponent(error.location ?? ""), matcher);
    return true;
  };
}
test("login catches thrown service failure and maps returned 503", async () => {
  for (const auth of [
    {
      signInWithPassword: async () => {
        throw new TypeError("fetch failed");
      },
    },
    { signInWithPassword: async () => ({ error: { status: 503 } }) },
  ]) {
    await assert.rejects(
      actions(auth).login(credentials()),
      redirectedTo(outageText),
    );
  }
});
test("successful login preserves redirect and submits original credentials to Supabase", async () => {
  let received;
  const auth = {
    signInWithPassword: async (value) => {
      received = value;
      return { error: null };
    },
  };
  await assert.rejects(
    actions(auth).login(credentials()),
    (error) => error.location === "/",
  );
  assert.equal(received.email, "example@example.com");
  assert.equal(received.password, "test-input-not-real-password");
});
test("signup catches outage without issuing confirmation or redirecting as authenticated", async () => {
  await assert.rejects(
    actions({
      signUp: async () => {
        throw { status: 503 };
      },
    }).signUp(credentials()),
    redirectedTo(outageText),
  );
});
function proxy(auth) {
  const response = (kind) => ({
    kind,
    cookies: { set() {} },
    headers: { set() {} },
  });
  return load("lib/supabase/proxy.ts", {
    "@supabase/ssr": { createServerClient: () => ({ auth }) },
    "next/server": {
      NextResponse: {
        next: () => response("next"),
        redirect: (url) => ({ ...response("redirect"), url }),
      },
    },
    "./config": {
      getSupabaseConfig: () => ({
        projectUrl: "https://example.test",
        publishableKey: "test",
      }),
    },
    "./auth-errors": messages,
  });
}
function request(path) {
  const nextUrl = new URL(`https://example.test${path}`);
  nextUrl.clone = () => new URL(nextUrl);
  return { nextUrl, cookies: { getAll: () => [], set() {} } };
}
test("proxy network failure keeps login public and fails closed for protected content", async () => {
  const session = proxy({
    getClaims: async () => {
      throw new TypeError("fetch failed");
    },
  });
  assert.equal((await session.updateSession(request("/login"))).kind, "next");
  const protectedResult = await session.updateSession(request("/analisis"));
  assert.equal(protectedResult.kind, "redirect");
  assert.equal(protectedResult.url.pathname, "/login");
  assert.match(protectedResult.url.searchParams.get("error"), outageText);
});
test("proxy accepts only verified identity and keeps anonymous private routes blocked", async () => {
  const anonymous = proxy({
    getClaims: async () => ({ data: null, error: null }),
  });
  assert.equal((await anonymous.updateSession(request("/"))).kind, "redirect");
  const invalid = proxy({
    getClaims: async () => ({ data: { claims: {} }, error: null }),
  });
  assert.equal((await invalid.updateSession(request("/"))).kind, "redirect");
  const valid = proxy({
    getClaims: async () => ({
      data: { claims: { sub: "verified-user" } },
      error: null,
    }),
  });
  assert.equal((await valid.updateSession(request("/analisis"))).kind, "next");
});

test("claims accompanied by verification error never grant access", async () => {
  const session = proxy({
    getClaims: async () => ({
      data: { claims: { sub: "untrusted" } },
      error: { status: 503 },
    }),
  });
  assert.equal(
    (await session.updateSession(request("/analisis"))).kind,
    "redirect",
  );
  assert.match(
    messages.authErrorMessage({ status: 429, name: "AuthRetryableFetchError" }),
    /límite de intentos/,
  );
});
