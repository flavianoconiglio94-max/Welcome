"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RESERVATION_TRANSITIONS, type ReservationStatus } from "@/lib/types";

export type ActionResult = { error?: string };

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
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "La prenotazione è già cambiata di stato. Ricarica la pagina." };
  }

  revalidatePath("/admin");
  return {};
}
