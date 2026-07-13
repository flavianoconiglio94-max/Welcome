"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/session";
import { utcFromZoned } from "@/lib/tz";
import {
  RESERVATION_TRANSITIONS,
  type GuestDirectoryEntry,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";

export type ActionResult = { error?: string };

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function updateReservationStatus(
  reservationId: string,
  from: ReservationStatus,
  to: ReservationStatus,
): Promise<ActionResult> {
  if (!RESERVATION_TRANSITIONS[from]?.includes(to)) {
    return { error: "Transizione di stato non valida." };
  }

  const supabase = await createClient();

  // .eq("status", from) makes this an optimistic-concurrency update: if
  // someone else already changed the status, this silently affects 0 rows
  // instead of clobbering a state change made from another tab/staff member.
  // RLS ("staff manage own reservations") independently confines this to the
  // caller's own restaurant regardless of what reservationId is passed in.
  const { error, data } = await supabase
    .from("reservations")
    .update({ status: to })
    .eq("id", reservationId)
    .eq("status", from)
    .select("id");

  if (error) {
    return { error: mapDbError(error) };
  }
  if (!data || data.length === 0) {
    return { error: "La prenotazione è già cambiata di stato. Ricarica la pagina." };
  }

  revalidatePath("/admin");
  return {};
}

export async function updateReservationTable(
  reservationId: string,
  tableId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, data } = await supabase
    .from("reservations")
    .update({ table_id: tableId })
    .eq("id", reservationId)
    .select("id");

  if (error) {
    return { error: mapDbError(error) };
  }
  if (!data || data.length === 0) {
    return { error: "Prenotazione non trovata." };
  }

  revalidatePath("/admin");
  return {};
}

export async function updateReservationNotes(
  reservationId: string,
  notes: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ notes: notes.trim() || null })
    .eq("id", reservationId);

  if (error) {
    return { error: mapDbError(error) };
  }

  revalidatePath("/admin");
  return {};
}

export type CreateReservationState = { error?: string };

export async function createManualReservation(
  _prev: CreateReservationState,
  formData: FormData,
): Promise<CreateReservationState> {
  const staff = await getStaffProfile();
  if (!staff) {
    return { error: "Non autorizzato." };
  }

  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("duration") ?? 120);
  const partySize = Number(formData.get("partySize") ?? 0);
  const tableId = String(formData.get("tableId") ?? "");
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestEmail = String(formData.get("guestEmail") ?? "").trim();
  const guestPhone = String(formData.get("guestPhone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: "Data o ora non valide." };
  }
  if (!guestName) {
    return { error: "Il nome del cliente è obbligatorio." };
  }
  if (!Number.isFinite(partySize) || partySize < 1) {
    return { error: "Numero di persone non valido." };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
    return { error: "Durata non valida." };
  }

  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("timezone")
    .eq("id", staff.restaurant_id)
    .single<{ timezone: string }>();

  const timezone = restaurant?.timezone ?? "Europe/Rome";
  const startsAt = utcFromZoned(date, time, timezone);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const { error } = await supabase
    .rpc("create_reservation", {
      p_restaurant_id: staff.restaurant_id,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_party_size: partySize,
      p_guest_name: guestName,
      p_guest_email: guestEmail || null,
      p_guest_phone: guestPhone || null,
      p_source: "admin",
      p_table_id: tableId || null,
      p_status: "confirmed",
      p_notes: notes || null,
    })
    .single<Reservation>();

  if (error) {
    return { error: mapDbError(error) };
  }

  revalidatePath("/admin");
  redirect(`/admin?date=${date}`);
}

export async function searchGuests(query: string): Promise<GuestDirectoryEntry[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const supabase = await createClient();
  // RLS scopes guest_directory to the caller's restaurant. Commas and parens
  // are PostgREST or() syntax, so they are stripped from the search text.
  const sanitized = trimmed.replace(/[,()%_\\]/g, " ").trim();
  if (!sanitized) {
    return [];
  }
  const pattern = `%${sanitized}%`;
  const { data } = await supabase
    .from("guest_directory")
    .select("id, restaurant_id, guest_name, guest_email, guest_phone, notes, tags, visit_count, created_at")
    .or(`guest_name.ilike.${pattern},guest_email.ilike.${pattern},guest_phone.ilike.${pattern}`)
    .limit(8)
    .returns<GuestDirectoryEntry[]>();

  return data ?? [];
}

function mapDbError(error: { code?: string; message: string }): string {
  if (error.code === "23P01") {
    return "Il tavolo è già occupato in quell'orario.";
  }
  if (error.message.includes("no_availability")) {
    return "Nessun tavolo libero per quell'orario e numero di persone.";
  }
  return error.message;
}
