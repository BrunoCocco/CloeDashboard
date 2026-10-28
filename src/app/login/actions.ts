"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/config";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@") || password.length < 8) {
    redirect(
      "/login?error=Ingresá+un+email+válido+y+una+contraseña+de+al+menos+8+caracteres.",
    );
  }

  return { email, password };
}

export async function login(formData: FormData) {
  const credentials = readCredentials(formData);
  let failure: unknown = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(credentials);
    failure = error;
  } catch (error) {
    failure = error;
  }

  if (failure) {
    redirect(`/login?error=${encodeURIComponent(authErrorMessage(failure))}`);
  }

  redirect("/");
}

export async function signUp(formData: FormData) {
  const credentials = readCredentials(formData);
  let failure: unknown = null;
  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
    });
    failure = error;
    hasSession = Boolean(data.session);
  } catch (error) {
    failure = error;
  }

  if (failure) {
    redirect(`/login?error=${encodeURIComponent(authErrorMessage(failure))}`);
  }
  if (hasSession) redirect("/");

  redirect("/login?message=Revisá+tu+correo+para+confirmar+la+cuenta.");
}
