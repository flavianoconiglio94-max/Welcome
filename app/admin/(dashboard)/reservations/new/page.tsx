import { getStaffProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { localDateISO } from "@/lib/tz";
import type { OpeningHours } from "@/lib/services";
import type { DiningSection, DiningTable } from "@/lib/types";
import { Wizard } from "./Wizard";

type RestaurantConfig = {
  timezone: string;
  opening_hours: OpeningHours;
  slot_interval_minutes: number;
  default_duration_minutes: number;
  min_party_size: number;
  max_party_size: number;
  max_covers_per_slot: number | null;
};

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
      .select(
        "timezone, opening_hours, slot_interval_minutes, default_duration_minutes, min_party_size, max_party_size, max_covers_per_slot",
      )
      .eq("id", staff.restaurant_id)
      .single<RestaurantConfig>(),
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

  const config = restaurantResult.data;
  const timezone = config?.timezone ?? "Europe/Rome";
  const defaultDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : localDateISO(timezone);

  return (
    <Wizard
      defaultDate={defaultDate}
      today={localDateISO(timezone)}
      openingHours={config?.opening_hours ?? {}}
      slotInterval={config?.slot_interval_minutes ?? 30}
      defaultDuration={config?.default_duration_minutes ?? 120}
      maxCoversPerSlot={config?.max_covers_per_slot ?? null}
      timezone={timezone}
      sections={sectionsResult.data ?? []}
      tables={tablesResult.data ?? []}
    />
  );
}
