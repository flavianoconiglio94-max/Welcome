"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site-url";

export type LoginState = { error?: string; sent?: boolean };

// Primary platform-admin login. See app/admin/login/actions.ts for why
// password auth is preferred over magic links here.
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

  redirect("/platform");
}

export async function requestPlatformMagicLink(
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
      emailRedirectTo: `${siteUrl}/auth/callback?next=/platform`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { sent: true };
}
