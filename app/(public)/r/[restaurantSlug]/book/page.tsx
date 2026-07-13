import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RestaurantPublic } from "@/lib/types";
import { BookingForm } from "./BookingForm";

export default async function BookPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_restaurant_public", { p_slug: restaurantSlug })
    .maybeSingle<RestaurantPublic>();

  if (error || !data) {
    // TEMPORARY diagnostic log — remove once the preview 404 is root-caused.
    console.error("get_restaurant_public failed", { restaurantSlug, error });
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Prenota un tavolo
        </p>
      </div>
      <BookingForm restaurant={data} />
    </main>
  );
}
