"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/session";

export type TablesActionState = { error?: string };

export async function createSection(
  _prev: TablesActionState,
  formData: FormData,
): Promise<TablesActionState> {
  const staff = await getStaffProfile();
  if (!staff) return { error: "Non autorizzato." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Il nome della sala è obbligatorio." };

  const supabase = await createClient();
  const { error } = await supabase.from("dining_sections").insert({
    restaurant_id: staff.restaurant_id,
    name,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/tables");
  return {};
}

export async function createTable(
  _prev: TablesActionState,
  formData: FormData,
): Promise<TablesActionState> {
  const staff = await getStaffProfile();
  if (!staff) return { error: "Non autorizzato." };

  const label = String(formData.get("label") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  const sectionId = String(formData.get("sectionId") ?? "");

  if (!label) return { error: "Il numero/nome del tavolo è obbligatorio." };
  if (!Number.isFinite(capacity) || capacity < 1) {
    return { error: "Capienza non valida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dining_tables").insert({
    restaurant_id: staff.restaurant_id,
    label,
    capacity,
    section_id: sectionId || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/tables");
  return {};
}

export async function setTableActive(
  tableId: string,
  active: boolean,
): Promise<TablesActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("dining_tables")
    .update({ is_active: active })
    .eq("id", tableId);

  if (error) return { error: error.message };
  revalidatePath("/admin/tables");
  return {};
}
