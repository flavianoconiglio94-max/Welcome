"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { localTimeHM } from "@/lib/tz";
import {
  RESERVATION_TRANSITIONS,
  SOURCE_LABELS,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";
import { updateReservationStatus } from "../actions";

const QUICK_ACTIONS: Record<ReservationStatus, string> = {
  unconfirmed: "Non confermata",
  pending_seat: "In attesa",
  confirmed: "Conferma",
  seated: "Accomoda",
  completed: "Termina",
  cancelled: "Cancella",
  no_show: "No-show",
};

export function ReservationCard({
  reservation,
  timezone,
  tableLabel,
}: {
  reservation: Reservation;
  timezone: string;
  tableLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function transitionTo(to: ReservationStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateReservationStatus(
        reservation.id,
        reservation.status,
        to,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <Link href={`/admin/reservations/${reservation.id}`} className="block">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{reservation.guest_name}</p>
            <p className="text-sm">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {localTimeHM(reservation.starts_at, timezone)}
              </span>{" "}
              <span className="text-xs text-zinc-500">
                · {SOURCE_LABELS[reservation.source] ?? reservation.source}
              </span>
            </p>
          </div>
          <span className="text-lg font-semibold">{reservation.party_size}</span>
          <span className="flex h-10 w-10 items-center justify-center rounded border border-zinc-300 text-sm font-medium dark:border-zinc-700">
            {tableLabel ?? "—"}
          </span>
        </div>
        {reservation.notes && (
          <p className="mt-1 truncate text-xs text-zinc-500">
            📝 {reservation.notes}
          </p>
        )}
      </Link>

      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {RESERVATION_TRANSITIONS[reservation.status].length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RESERVATION_TRANSITIONS[reservation.status].map((to) => (
            <button
              key={to}
              type="button"
              disabled={pending}
              onClick={() => transitionTo(to)}
              className={`rounded px-2.5 py-1 text-xs disabled:opacity-50 ${
                to === "cancelled" || to === "no_show"
                  ? "border border-red-300 text-red-600 dark:border-red-900 dark:text-red-400"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {QUICK_ACTIONS[to]}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
