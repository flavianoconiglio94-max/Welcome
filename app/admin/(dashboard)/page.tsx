import { getStaffProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { servicesForDate, type OpeningHours } from "@/lib/services";
import { addDaysISO, localDateISO, utcFromZoned } from "@/lib/tz";
import { RESERVATION_COLUMNS, type DiningSection, type DiningTable, type Reservation } from "@/lib/types";
import { DayBook } from "./DayBook";

type Restaurant = {
  timezone: string;
  opening_hours: OpeningHours;
  slot_interval_minutes: number;
};

export default async function LibroVisitePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const staff = (await getStaffProfile())!;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("timezone, opening_hours, slot_interval_minutes")
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
      .select(RESERVATION_COLUMNS)
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      {reservationsResult.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {reservationsResult.error.message}
        </p>
      )}
      <DayBook
        date={date}
        today={localDateISO(timezone)}
        services={servicesForDate(restaurant?.opening_hours ?? {}, date)}
        slotInterval={restaurant?.slot_interval_minutes ?? 30}
        sections={sectionsResult.data ?? []}
        tables={tablesResult.data ?? []}
        reservations={reservationsResult.data ?? []}
        timezone={timezone}
      />
    </main>
  );
}
