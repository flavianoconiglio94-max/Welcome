import { createClient } from "@/lib/supabase/server";
import type { DiningSection, DiningTable } from "@/lib/types";
import { TablesManager } from "./TablesManager";

export default async function TablesPage() {
  const supabase = await createClient();

  const [sectionsResult, tablesResult] = await Promise.all([
    supabase
      .from("dining_sections")
      .select("id, restaurant_id, name, sort_order")
      .order("sort_order")
      .returns<DiningSection[]>(),
    supabase
      .from("dining_tables")
      .select("id, restaurant_id, section_id, label, capacity, max_capacity, is_active")
      .order("label")
      .returns<DiningTable[]>(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <TablesManager
        sections={sectionsResult.data ?? []}
        tables={tablesResult.data ?? []}
      />
    </main>
  );
}
