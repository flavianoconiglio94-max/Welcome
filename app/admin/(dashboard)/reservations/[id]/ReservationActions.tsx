"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RESERVATION_TRANSITIONS,
  RESERVATION_STATUS_LABELS,
  type DiningTable,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";
import {
  updateReservationLock,
  updateReservationNotes,
  updateReservationStatus,
  updateReservationTable,
} from "../../../actions";

export function ReservationActions({
  reservation,
  tables,
}: {
  reservation: Reservation;
  tables: DiningTable[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    setNotesSaved(false);
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      {RESERVATION_TRANSITIONS[reservation.status].length > 0 && (
        <div className="flex flex-wrap gap-2">
          {RESERVATION_TRANSITIONS[reservation.status].map((to: ReservationStatus) => (
            <button
              key={to}
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => updateReservationStatus(reservation.id, reservation.status, to))
              }
              className={`rounded px-3 py-2 text-sm disabled:opacity-50 ${
                to === "cancelled" || to === "no_show"
                  ? "border border-red-300 text-red-600 dark:border-red-900 dark:text-red-400"
                  : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              }`}
            >
              {RESERVATION_STATUS_LABELS[to]}
            </button>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Tavolo {reservation.table_locked && "🔒 (bloccato)"}
        <select
          value={reservation.table_id ?? ""}
          disabled={pending}
          onChange={(e) => {
            // Moving a locked reservation requires an explicit confirmation.
            if (
              reservation.table_locked &&
              !window.confirm(
                "Questa prenotazione è bloccata sul tavolo assegnato. Confermi lo spostamento?",
              )
            ) {
              e.target.value = reservation.table_id ?? "";
              return;
            }
            run(() => updateReservationTable(reservation.id, e.target.value || null));
          }}
          className={inputClass}
        >
          <option value="">Nessun tavolo</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} · {t.capacity} posti
            </option>
          ))}
        </select>
      </label>

      {reservation.table_id && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => updateReservationLock(reservation.id, !reservation.table_locked))
          }
          className={`self-start rounded px-3 py-1.5 text-sm disabled:opacity-50 ${
            reservation.table_locked
              ? "bg-amber-500 font-medium text-white"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          {reservation.table_locked ? "🔒 Sblocca tavolo" : "🔓 Blocca tavolo"}
        </button>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Note private
        <textarea
          value={notes}
          rows={2}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || notes === (reservation.notes ?? "")}
          onClick={() =>
            run(async () => {
              const result = await updateReservationNotes(reservation.id, notes);
              if (!result.error) setNotesSaved(true);
              return result;
            })
          }
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Salva note
        </button>
        {notesSaved && (
          <span className="text-xs text-green-700 dark:text-green-400">
            Salvate
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </section>
  );
}
