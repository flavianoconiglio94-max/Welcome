import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  RESERVATION_STATUS_LABELS,
  SOURCE_LABELS,
  type DiningTable,
  type Reservation,
} from "@/lib/types";
import { ReservationActions } from "./ReservationActions";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = (await getStaffProfile())!;
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "id, restaurant_id, table_id, guest_name, guest_email, guest_phone, party_size, starts_at, ends_at, status, source, cancellation_token, notes",
    )
    .eq("id", id)
    .maybeSingle<Reservation>();

  if (!reservation) {
    notFound();
  }

  const [restaurantResult, tablesResult] = await Promise.all([
    supabase
      .from("restaurants")
      .select("timezone")
      .eq("id", staff.restaurant_id)
      .single<{ timezone: string }>(),
    supabase
      .from("dining_tables")
      .select("id, restaurant_id, section_id, label, capacity, max_capacity, is_active")
      .eq("is_active", true)
      .order("label")
      .returns<DiningTable[]>(),
  ]);

  const timezone = restaurantResult.data?.timezone ?? "Europe/Rome";
  const tables = tablesResult.data ?? [];

  // Client history: every reservation sharing the same contact info.
  let history: Reservation[] = [];
  if (reservation.guest_email || reservation.guest_phone) {
    const contactFilter = reservation.guest_email
      ? { column: "guest_email", value: reservation.guest_email }
      : { column: "guest_phone", value: reservation.guest_phone! };
    const { data } = await supabase
      .from("reservations")
      .select(
        "id, restaurant_id, table_id, guest_name, guest_email, guest_phone, party_size, starts_at, ends_at, status, source, cancellation_token, notes",
      )
      .eq(contactFilter.column, contactFilter.value)
      .neq("id", reservation.id)
      .order("starts_at", { ascending: false })
      .limit(10)
      .returns<Reservation[]>();
    history = data ?? [];
  }

  const all = [reservation, ...history];
  const stats = {
    prenotazioni: all.length,
    visite: all.filter((r) => ["seated", "completed"].includes(r.status)).length,
    cancellazioni: all.filter((r) => r.status === "cancelled").length,
    noShow: all.filter((r) => r.status === "no_show").length,
  };

  const durationMinutes = Math.round(
    (new Date(reservation.ends_at).getTime() -
      new Date(reservation.starts_at).getTime()) /
      60_000,
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{reservation.guest_name}</h1>
        <Link href="/admin" className="text-sm underline underline-offset-2">
          ← Libro visite
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Data e ora</p>
          <p className="font-medium">
            {formatDateTime(reservation.starts_at, timezone)}
          </p>
        </div>
        <div className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">PAX · Durata</p>
          <p className="font-medium">
            {reservation.party_size} persone · {Math.floor(durationMinutes / 60)}h
            {durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ""}
          </p>
        </div>
        <div className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Stato</p>
          <p className="font-medium">
            {RESERVATION_STATUS_LABELS[reservation.status]}
          </p>
        </div>
        <div className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Fonte</p>
          <p className="font-medium">
            {SOURCE_LABELS[reservation.source] ?? reservation.source}
          </p>
        </div>
      </div>

      <ReservationActions reservation={reservation} tables={tables} />

      <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Cliente
        </p>
        <p className="text-sm">
          {[reservation.guest_phone, reservation.guest_email]
            .filter(Boolean)
            .join(" · ") || "Nessun contatto"}
        </p>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <p className="text-lg font-semibold">{stats.prenotazioni}</p>
            <p className="text-xs text-zinc-500">Prenotazioni</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{stats.visite}</p>
            <p className="text-xs text-zinc-500">Visite</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{stats.cancellazioni}</p>
            <p className="text-xs text-zinc-500">Cancellazioni</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{stats.noShow}</p>
            <p className="text-xs text-zinc-500">No show</p>
          </div>
        </div>
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Storico
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span>{formatDateTime(r.starts_at, timezone)}</span>
                <span className="text-xs text-zinc-500">
                  {r.party_size} pax · {RESERVATION_STATUS_LABELS[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
