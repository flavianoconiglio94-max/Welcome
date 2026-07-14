import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { getStaffProfile } from "@/lib/auth/session";
import {
  RESERVATION_STATUS_LABELS,
  type GuestDirectoryEntry,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";

type HistoryRow = Pick<
  Reservation,
  "id" | "starts_at" | "party_size" | "status" | "table_id" | "notes"
>;

export default async function ClientProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; email?: string; name?: string }>;
}) {
  const params = await searchParams;
  const staff = (await getStaffProfile())!;
  const supabase = await createClient();

  const phone = (params.phone ?? "").trim();
  const email = (params.email ?? "").trim();
  const name = (params.name ?? "").trim();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("timezone")
    .eq("id", staff.restaurant_id)
    .single<{ timezone: string }>();
  const timezone = restaurant?.timezone ?? "Europe/Rome";

  // Directory entry: match by phone/email first, then by exact name.
  const dirFilters: string[] = [];
  if (phone) dirFilters.push(`guest_phone.eq.${phone}`);
  if (email) dirFilters.push(`guest_email.eq.${email}`);
  let directory: GuestDirectoryEntry | null = null;
  if (dirFilters.length > 0) {
    const { data } = await supabase
      .from("guest_directory")
      .select(
        "id, restaurant_id, guest_name, guest_email, guest_phone, notes, tags, visit_count, created_at",
      )
      .or(dirFilters.join(","))
      .limit(1)
      .returns<GuestDirectoryEntry[]>();
    directory = data?.[0] ?? null;
  }
  if (!directory && name) {
    const { data } = await supabase
      .from("guest_directory")
      .select(
        "id, restaurant_id, guest_name, guest_email, guest_phone, notes, tags, visit_count, created_at",
      )
      .eq("guest_name", name)
      .limit(1)
      .returns<GuestDirectoryEntry[]>();
    directory = data?.[0] ?? null;
  }

  const displayName = directory?.guest_name ?? name ?? "Cliente";
  const displayPhone = directory?.guest_phone ?? (phone || null);
  const displayEmail = directory?.guest_email ?? (email || null);

  // Reservation history: match by phone/email, fallback exact name.
  const resFilters: string[] = [];
  if (displayPhone) resFilters.push(`guest_phone.eq.${displayPhone}`);
  if (displayEmail) resFilters.push(`guest_email.eq.${displayEmail}`);
  if (resFilters.length === 0 && displayName) {
    resFilters.push(`guest_name.eq.${displayName}`);
  }

  let history: HistoryRow[] = [];
  if (resFilters.length > 0) {
    const { data } = await supabase
      .from("reservations")
      .select("id, starts_at, party_size, status, table_id, notes")
      .or(resFilters.join(","))
      .order("starts_at", { ascending: false })
      .limit(100)
      .returns<HistoryRow[]>();
    history = data ?? [];
  }

  const count = (statuses: ReservationStatus[]) =>
    history.filter((r) => statuses.includes(r.status)).length;

  const stats = [
    { label: "Visite", value: count(["completed", "seated"]) },
    { label: "Prenotazioni", value: history.length },
    { label: "No-show", value: count(["no_show"]) },
    { label: "Cancellazioni", value: count(["cancelled"]) },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{displayName}</h1>
        <Link
          href="/admin"
          aria-label="Chiudi"
          className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-lg leading-none dark:border-zinc-700"
        >
          ×
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded border border-zinc-200 p-2 dark:border-zinc-800"
          >
            <p className="text-lg font-semibold text-[#0067c0] dark:text-[#479ef5]">
              {s.value}
            </p>
            <p className="text-xs text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-1 rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Dati cliente
        </p>
        {displayPhone && (
          <a
            href={`tel:${displayPhone}`}
            className="text-[#0067c0] dark:text-[#479ef5]"
          >
            {displayPhone}
          </a>
        )}
        {displayEmail && (
          <p className="text-zinc-600 dark:text-zinc-400">{displayEmail}</p>
        )}
        {directory?.notes && <p>{directory.notes}</p>}
        {directory?.tags && directory.tags.length > 0 && (
          <p className="text-xs text-zinc-500">{directory.tags.join(" · ")}</p>
        )}
        {!displayPhone && !displayEmail && (
          <p className="text-zinc-500">Nessun contatto salvato.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Storico prenotazioni
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessuna prenotazione trovata.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span>{formatDateTime(r.starts_at, timezone)}</span>
                <span className="text-zinc-500">{r.party_size} pax</span>
                <span
                  className={
                    r.status === "no_show" || r.status === "cancelled"
                      ? "text-red-600 dark:text-red-400"
                      : r.status === "completed" || r.status === "seated"
                        ? "text-[#107c10] dark:text-[#6ccb5f]"
                        : "text-zinc-500"
                  }
                >
                  {RESERVATION_STATUS_LABELS[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
