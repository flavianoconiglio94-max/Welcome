"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site-url";

export type LoginState = { error?: string; sent?: boolean };

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
