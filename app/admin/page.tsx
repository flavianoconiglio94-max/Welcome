import { redirect } from "next/navigation";
import { getCurrentUser, getStaffProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Reservation } from "@/lib/types";
import { ReservationsList } from "./ReservationsList";

const ACTIVE_STATUSES = ["unconfirmed", "pending_seat", "confirmed", "seated"];

export default async function AdminHomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  const staff = await getStaffProfile();
  if (!staff) {
    // Logged in but not linked to any restaurant: redirecting back to the
    // login form would just loop silently, so explain the actual problem.
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Account non associato</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Il tuo account ({user.email}) non è collegato a nessun ristorante.
          Chiedi al gestore della piattaforma di invitarti come staff.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  // No restaurant_id filter needed on reservations: RLS ("staff manage own
  // reservations") already confines this to the caller's restaurant.
  const [reservationsResult, restaurantResult] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, restaurant_id, table_id, guest_name, guest_email, guest_phone, party_size, starts_at, ends_at, status, source, cancellation_token, notes",
      )
      .order("starts_at", { ascending: true })
      .returns<Reservation[]>(),
    supabase
      .from("restaurants")
      .select("timezone")
      .eq("id", staff.restaurant_id)
      .single<{ timezone: string }>(),
  ]);

  const { data: reservations, error } = reservationsResult;
  const timezone = restaurantResult.data?.timezone ?? "Europe/Rome";

  const active = (reservations ?? []).filter((r) => ACTIVE_STATUSES.includes(r.status));
  const past = (reservations ?? []).filter((r) => !ACTIVE_STATUSES.includes(r.status));

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Prenotazioni</h1>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Attive
        </h2>
        <ReservationsList reservations={active} timezone={timezone} />
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Storico
          </h2>
          <ReservationsList reservations={past} timezone={timezone} />
        </section>
      )}
    </main>
  );
}
