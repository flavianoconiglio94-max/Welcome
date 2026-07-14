import { cookies } from "next/headers";
import { getStaffProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_DETAIL_OPTIONS, type DetailOptions } from "@/lib/types";
import { SettingsForm } from "./SettingsForm";
import { ThemeToggle } from "./ThemeToggle";

type RestaurantSettings = {
  slug: string;
  max_covers_per_slot: number | null;
  name: string;
  phone: string | null;
  address: string | null;
  google_business_profile_url: string | null;
  facebook_page_url: string | null;
  instagram_handle: string | null;
  detail_options: Partial<DetailOptions> | null;
};

export default async function SettingsPage() {
  const staff = (await getStaffProfile())!;
  const supabase = await createClient();
  const theme = (await cookies()).get("theme")?.value;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select(
      "slug, name, phone, address, google_business_profile_url, facebook_page_url, instagram_handle, max_covers_per_slot, detail_options",
    )
    .eq("id", staff.restaurant_id)
    .single<RestaurantSettings>();

  if (!restaurant) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4">
        <p className="text-sm text-red-600 dark:text-red-400">
          Impossibile caricare le impostazioni.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4">
      <div className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <p className="text-xs text-zinc-500">Pagina di prenotazione pubblica</p>
        <p className="break-all font-mono text-xs">
          /r/{restaurant.slug}/book
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Collega questo link al pulsante &quot;Prenota&quot; su Google Business
          Profile, Facebook e Instagram.
        </p>
      </div>
      <ThemeToggle initialDark={theme === "dark"} />
      <SettingsForm
        restaurant={restaurant}
        detailOptions={{ ...DEFAULT_DETAIL_OPTIONS, ...restaurant.detail_options }}
      />
    </main>
  );
}
