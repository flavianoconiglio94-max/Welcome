"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site-url";

export type LoginState = { error?: string; sent?: boolean };

// Primary staff login. Password auth works on any deployment URL with no
// Supabase URL-configuration dependency — unlike magic links, whose emailed
// redirect must be in the project's Auth allow-list.
export async function loginWithPassword(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.code === "invalid_credentials"
          ? "Email o password non corretti."
          : error.message,
    };
  }

  redirect("/admin");
}

export async function requestAdminMagicLink(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Inserisci un'email valida." };
  }

  const supabase = await createClient();
  const siteUrl = await getRequestOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/admin`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { sent: true };
}
