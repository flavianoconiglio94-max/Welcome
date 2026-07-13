"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_TRANSITIONS,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { updateReservationStatus } from "./actions";

const TRANSITION_LABELS: Record<ReservationStatus, string> = {
  unconfirmed: "Segna non confermata",
  pending_seat: "In attesa di tavolo",
  confirmed: "Conferma",
  seated: "Accomoda",
  completed: "Completa",
  cancelled: "Cancella",
  no_show: "No-show",
};

function ReservationRow({
  reservation,
  timezone,
}: {
  reservation: Reservation;
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function transitionTo(to: ReservationStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateReservationStatus(reservation.id, reservation.status, to);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{reservation.guest_name}</span>
        <span className="text-xs text-zinc-500">
          {RESERVATION_STATUS_LABELS[reservation.status]}
        </span>
      </div>
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        {formatDateTime(reservation.starts_at, timezone)} &middot;{" "}
        {reservation.party_size} persone
        {reservation.guest_phone ? ` · ${reservation.guest_phone}` : ""}
        {reservation.guest_email ? ` · ${reservation.guest_email}` : ""}
      </div>
      {reservation.notes && (
        <p className="text-sm text-zinc-500">{reservation.notes}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {RESERVATION_TRANSITIONS[reservation.status].map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => transitionTo(to)}
            className="rounded border border-zinc-300 px-2.5 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
          >
            {TRANSITION_LABELS[to]}
          </button>
        ))}
      </div>
    </li>
  );
}

export function ReservationsList({
  reservations,
  timezone,
}: {
  reservations: Reservation[];
  timezone: string;
}) {
  if (reservations.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nessuna prenotazione.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {reservations.map((reservation) => (
        <ReservationRow
          key={reservation.id}
          reservation={reservation}
          timezone={timezone}
        />
      ))}
    </ul>
  );
}
