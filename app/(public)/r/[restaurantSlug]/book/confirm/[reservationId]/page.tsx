import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Reservation } from "@/lib/types";
import { CancelButton } from "./CancelButton";

const STATUS_LABELS: Record<Reservation["status"], string> = {
  unconfirmed: "In attesa di conferma",
  pending_seat: "In attesa di essere accomodati",
  confirmed: "Confermata",
  seated: "Accomodati",
  completed: "Completata",
  cancelled: "Cancellata",
  no_show: "No-show",
};

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantSlug: string; reservationId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reservationId } = await params;
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_reservation_for_management", {
      p_reservation_id: reservationId,
      p_cancellation_token: token,
    })
    .single<Reservation>();

  if (error || !data) {
    notFound();
  }

  const isFinal = ["completed", "cancelled", "no_show"].includes(data.status);

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        La tua prenotazione
      </h1>
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm">
          <span className="font-medium">Stato:</span>{" "}
          {STATUS_LABELS[data.status]}
        </p>
        <p className="text-sm">
          <span className="font-medium">Data e ora:</span>{" "}
          {new Date(data.starts_at).toLocaleString("it-IT")}
        </p>
        <p className="text-sm">
          <span className="font-medium">Persone:</span> {data.party_size}
        </p>
        <p className="text-sm">
          <span className="font-medium">Nome:</span> {data.guest_name}
        </p>
      </div>

      {!isFinal && (
        <CancelButton reservationId={data.id} token={token} />
      )}
    </main>
  );
}
