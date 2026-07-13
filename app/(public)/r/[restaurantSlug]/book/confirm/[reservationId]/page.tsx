import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  RESERVATION_STATUS_LABELS,
  type Reservation,
  type RestaurantPublic,
} from "@/lib/types";
import { CancelButton } from "./CancelButton";

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantSlug: string; reservationId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { restaurantSlug, reservationId } = await params;
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  const supabase = await createClient();
  const [reservationResult, restaurantResult] = await Promise.all([
    supabase
      .rpc("get_reservation_for_management", {
        p_reservation_id: reservationId,
        p_cancellation_token: token,
      })
      .single<Reservation>(),
    supabase
      .rpc("get_restaurant_public", { p_slug: restaurantSlug })
      .maybeSingle<RestaurantPublic>(),
  ]);

  const reservation = reservationResult.data;
  const restaurant = restaurantResult.data;

  if (
    reservationResult.error ||
    !reservation ||
    !restaurant ||
    reservation.restaurant_id !== restaurant.id
  ) {
    notFound();
  }

  const isFinal = ["completed", "cancelled", "no_show"].includes(reservation.status);

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        La tua prenotazione
      </h1>
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm">
          <span className="font-medium">Ristorante:</span> {restaurant.name}
        </p>
        <p className="text-sm">
          <span className="font-medium">Stato:</span>{" "}
          {RESERVATION_STATUS_LABELS[reservation.status]}
        </p>
        <p className="text-sm">
          <span className="font-medium">Data e ora:</span>{" "}
          {formatDateTime(reservation.starts_at, restaurant.timezone)}
        </p>
        <p className="text-sm">
          <span className="font-medium">Persone:</span> {reservation.party_size}
        </p>
        <p className="text-sm">
          <span className="font-medium">Nome:</span> {reservation.guest_name}
        </p>
      </div>

      {!isFinal && (
        <CancelButton reservationId={reservation.id} token={token} />
      )}
    </main>
  );
}
