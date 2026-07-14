"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/session";

export type SettingsState = { error?: string; saved?: boolean };

export async function updateRestaurantSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const staff = await getStaffProfile();
  if (!staff) return { error: "Non autorizzato." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Il nome è obbligatorio." };

  const clean = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const maxCoversRaw = String(formData.get("maxCovers") ?? "").trim();
  const maxCovers = maxCoversRaw ? Number(maxCoversRaw) : null;
  if (maxCovers !== null && (!Number.isInteger(maxCovers) || maxCovers < 1)) {
    return { error: "Coperti massimi per fascia: inserisci un numero intero positivo o lascia vuoto." };
  }

  const supabase = await createClient();
  // RLS allows this update only for owner/manager roles.
  const { error, data } = await supabase
    .from("restaurants")
    .update({
      name,
      phone: clean("phone"),
      address: clean("address"),
      google_business_profile_url: clean("gbp"),
      facebook_page_url: clean("facebook"),
      instagram_handle: clean("instagram"),
      max_covers_per_slot: maxCovers,
    })
    .eq("id", staff.restaurant_id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return {
      error:
        "Modifica non consentita: solo il proprietario o il manager possono cambiare le impostazioni.",
    };
  }

  revalidatePath("/admin/settings");
  return { saved: true };
}
