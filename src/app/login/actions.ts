"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/config";

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@") || password.length < 8) {
    redirect("/login?error=Ingresá+un+email+válido+y+una+contraseña+de+al+menos+8+caracteres.");
  }

  return { email, password };
}

function authError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "El email o la contraseña no son correctos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirmá tu email antes de entrar.";
  }
  if (normalized.includes("user already registered")) {
    return "Ese email ya tiene una cuenta. Probá iniciar sesión.";
  }

  return "No se pudo completar la autenticación. Intentá nuevamente.";
}

export async function login(formData: FormData) {
  const credentials = readCredentials(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(authError(error.message))}`);
  }

  redirect("/");
}

export async function signUp(formData: FormData) {
  const credentials = readCredentials(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(authError(error.message))}`);
  }

  if (data.session) {
    redirect("/");
  }

  redirect("/login?message=Revisá+tu+correo+para+confirmar+la+cuenta.");
}
