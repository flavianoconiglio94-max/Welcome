"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsPlatformAdmin } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/site-url";

export type NewRestaurantState = { error?: string; success?: boolean };

// Lowercase letters, numbers and single hyphens between segments — matches
// what the public booking URL /r/[slug]/book can safely contain.
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function createRestaurant(
  _prevState: NewRestaurantState,
  formData: FormData,
): Promise<NewRestaurantState> {
  // Render-time gating on the page is not a security boundary: re-check here.
  if (!(await getIsPlatformAdmin())) {
    return { error: "Non autorizzato." };
  }

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "Europe/Rome";

  if (!SLUG_RE.test(slug)) {
    return {
      error: "Slug non valido: usa solo lettere minuscole, numeri e trattini singoli.",
    };
  }
  if (!name) {
    return { error: "Il nome del ristorante è obbligatorio." };
  }
  if (!ownerEmail.includes("@")) {
    return { error: "Inserisci un'email valida per il proprietario." };
  }

  const supabase = await createClient();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .insert({ slug, name, timezone })
    .select("id")
    .single();

  if (restaurantError || !restaurant) {
    return {
      error:
        restaurantError?.code === "23505"
          ? "Esiste già un ristorante con questo slug."
          : (restaurantError?.message ?? "Errore durante la creazione."),
    };
  }

  const admin = createAdminClient();
  const siteUrl = await getRequestOrigin();

  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    ownerEmail,
    { redirectTo: `${siteUrl}/auth/callback?next=/admin` },
  );

  if (inviteError || !invite.user) {
    return {
      error: `Ristorante creato ma invito non inviato: ${
        inviteError?.message ?? "errore sconosciuto"
      }`,
    };
  }

  const { error: staffError } = await supabase.from("staff_profiles").insert({
    user_id: invite.user.id,
    restaurant_id: restaurant.id,
    role: "owner",
  });

  if (staffError) {
    return {
      error: `Ristorante creato e invito inviato, ma l'assegnazione del ruolo owner è fallita: ${staffError.message}. Assegnala manualmente su staff_profiles.`,
    };
  }

  return { success: true };
}
