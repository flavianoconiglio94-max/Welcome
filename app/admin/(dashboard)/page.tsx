import Link from "next/link";
import { getStaffProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { servicesForDate, type OpeningHours } from "@/lib/services";
import { addDaysISO, localDateISO, localTimeHM, utcFromZoned } from "@/lib/tz";
import type { DiningSection, DiningTable, Reservation } from "@/lib/types";
import { DatePicker } from "./DatePicker";
import { ReservationCard } from "./ReservationCard";

type Restaurant = { timezone: string; opening_hours: OpeningHours };

const GROUPS: { label: string; statuses: Reservation["status"][] }[] = [
  { label: "Non confermate", statuses: ["unconfirmed"] },
  { label: "In attesa di sedersi", statuses: ["pending_seat"] },
  { label: "Confermate", statuses: ["confirmed"] },
  { label: "Sedute", statuses: ["seated"] },
  { label: "Completate", statuses: ["completed"] },
  { label: "Cancellate / No-show", statuses: ["cancelled", "no_show"] },
];

export default async function LibroVisitePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; service?: string; section?: string }>;
}) {
  const params = await searchParams;
  const staff = (await getStaffProfile())!;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("timezone, opening_hours")
    .eq("id", staff.restaurant_id)
    .single<Restaurant>();

  const timezone = restaurant?.timezone ?? "Europe/Rome";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : localDateISO(timezone);

  const dayStart = utcFromZoned(date, "00:00", timezone);
  const dayEnd = utcFromZoned(addDaysISO(date, 1), "00:00", timezone);

  const [reservationsResult, sectionsResult, tablesResult] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, restaurant_id, table_id, guest_name, guest_email, guest_phone, party_size, starts_at, ends_at, status, source, cancellation_token, notes",
      )
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at", { ascending: true })
      .returns<Reservation[]>(),
    supabase
      .from("dining_sections")
      .select("id, restaurant_id, name, sort_order")
      .order("sort_order")
      .returns<DiningSection[]>(),
    supabase
      .from("dining_tables")
      .select("id, restaurant_id, section_id, label, capacity, max_capacity, is_active")
      .returns<DiningTable[]>(),
  ]);

  const sections = sectionsResult.data ?? [];
  const tables = tablesResult.data ?? [];
  const tableById = new Map(tables.map((t) => [t.id, t]));

  const services = servicesForDate(restaurant?.opening_hours ?? {}, date);
  const serviceKey = params.service ?? "all";
  const activeService = services.find((s) => s.key === serviceKey) ?? null;

  const sectionKey = params.section ?? "all";

  const filtered = (reservationsResult.data ?? []).filter((r) => {
    if (activeService) {
      const hm = localTimeHM(r.starts_at, timezone);
      if (hm < activeService.start || hm > activeService.end) return false;
    }
    if (sectionKey !== "all") {
      const table = r.table_id ? tableById.get(r.table_id) : undefined;
      if (!table || table.section_id !== sectionKey) return false;
    }
    return true;
  });

  const buildUrl = (next: { date?: string; service?: string; section?: string }) => {
    const q = new URLSearchParams();
    q.set("date", next.date ?? date);
    const svc = next.service ?? serviceKey;
    if (svc !== "all") q.set("service", svc);
    const sec = next.section ?? sectionKey;
    if (sec !== "all") q.set("section", sec);
    return `/admin?${q.toString()}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={buildUrl({ date: addDaysISO(date, -1) })}
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 dark:border-zinc-700"
          aria-label="Giorno precedente"
        >
          ←
        </Link>
        <DatePicker date={date} today={localDateISO(timezone)} />
        <Link
          href={buildUrl({ date: addDaysISO(date, 1) })}
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 dark:border-zinc-700"
          aria-label="Giorno successivo"
        >
          →
        </Link>
        <div className="ml-auto flex gap-1">
          <Link
            href={buildUrl({ service: "all" })}
            className={`rounded px-3 py-1.5 text-sm ${serviceKey === "all" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
          >
            Tutto
          </Link>
          {services.map((s) => (
            <Link
              key={s.key}
              href={buildUrl({ service: s.key })}
              className={`rounded px-3 py-1.5 text-sm ${serviceKey === s.key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {sections.length > 0 && (
        <div className="flex gap-3 overflow-x-auto text-sm">
          <Link
            href={buildUrl({ section: "all" })}
            className={
              sectionKey === "all"
                ? "font-semibold text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-400"
            }
          >
            Tutte
          </Link>
          {sections.map((s) => (
            <Link
              key={s.id}
              href={buildUrl({ section: s.id })}
              className={
                sectionKey === s.id
                  ? "whitespace-nowrap font-semibold text-blue-600 dark:text-blue-400"
                  : "whitespace-nowrap text-zinc-600 dark:text-zinc-400"
              }
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      {reservationsResult.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {reservationsResult.error.message}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {GROUPS.map((group) => {
          const items = filtered.filter((r) => group.statuses.includes(r.status));
          const pax = items.reduce((sum, r) => sum + r.party_size, 0);
          return (
            <details
              key={group.label}
              open={items.length > 0}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800"
            >
              <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
                <span>{group.label}</span>
                <span className="text-zinc-500">
                  {items.length} / {pax}
                </span>
              </summary>
              <ul className="flex flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <li className="px-2 py-1 text-sm text-zinc-500">Nessuna</li>
                ) : (
                  items.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      timezone={timezone}
                      tableLabel={
                        r.table_id ? (tableById.get(r.table_id)?.label ?? "?") : null
                      }
                    />
                  ))
                )}
              </ul>
            </details>
          );
        })}
      </div>
    </main>
  );
}
