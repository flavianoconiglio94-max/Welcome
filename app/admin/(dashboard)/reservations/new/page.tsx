import { getStaffProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { localDateISO } from "@/lib/tz";
import type { DiningSection, DiningTable } from "@/lib/types";
import { NewReservationForm } from "./NewReservationForm";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const staff = (await getStaffProfile())!;
  const supabase = await createClient();

  const [restaurantResult, sectionsResult, tablesResult] = await Promise.all([
    supabase
      .from("restaurants")
      .select("timezone, default_duration_minutes")
      .eq("id", staff.restaurant_id)
      .single<{ timezone: string; default_duration_minutes: number }>(),
    supabase
      .from("dining_sections")
      .select("id, restaurant_id, name, sort_order")
      .order("sort_order")
      .returns<DiningSection[]>(),
    supabase
      .from("dining_tables")
      .select("id, restaurant_id, section_id, label, capacity, max_capacity, is_active")
      .eq("is_active", true)
      .order("label")
      .returns<DiningTable[]>(),
  ]);

  const timezone = restaurantResult.data?.timezone ?? "Europe/Rome";
  const defaultDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : localDateISO(timezone);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4">
      <h1 className="text-xl font-semibold">Nuova prenotazione</h1>
      <NewReservationForm
        defaultDate={defaultDate}
        defaultDuration={restaurantResult.data?.default_duration_minutes ?? 120}
        sections={sectionsResult.data ?? []}
        tables={tablesResult.data ?? []}
      />
    </main>
  );
}
