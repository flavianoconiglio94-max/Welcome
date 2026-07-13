"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createManualReservation,
  searchGuests,
  type CreateReservationState,
} from "../../../actions";
import type { DiningSection, DiningTable, GuestDirectoryEntry } from "@/lib/types";

const initialState: CreateReservationState = {};

const DURATIONS = [
  { minutes: 60, label: "1 h" },
  { minutes: 90, label: "1 h 30 m" },
  { minutes: 120, label: "2 h" },
  { minutes: 150, label: "2 h 30 m" },
  { minutes: 180, label: "3 h" },
];

export function NewReservationForm({
  defaultDate,
  defaultDuration,
  sections,
  tables,
}: {
  defaultDate: string;
  defaultDuration: number;
  sections: DiningSection[];
  tables: DiningTable[];
}) {
  const [state, formAction, pending] = useActionState(
    createManualReservation,
    initialState,
  );

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [suggestions, setSuggestions] = useState<GuestDirectoryEntry[]>([]);
  const [searching, startSearch] = useTransition();

  function onNameChange(value: string) {
    setGuestName(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    startSearch(async () => {
      setSuggestions(await searchGuests(value));
    });
  }

  function pickGuest(guest: GuestDirectoryEntry) {
    setGuestName(guest.guest_name ?? "");
    setGuestEmail(guest.guest_email ?? "");
    setGuestPhone(guest.guest_phone ?? "");
    setSuggestions([]);
  }

  const sectionName = (id: string | null) =>
    sections.find((s) => s.id === id)?.name;

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Data
          <input type="date" name="date" required defaultValue={defaultDate} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ora
          <input type="time" name="time" required defaultValue="20:00" step={900} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Persone
          <input type="number" name="partySize" required min={1} max={99} defaultValue={2} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Durata
          <select name="duration" defaultValue={defaultDuration} className={inputClass}>
            {DURATIONS.map((d) => (
              <option key={d.minutes} value={d.minutes}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Tavolo
        <select name="tableId" defaultValue="" className={inputClass}>
          <option value="">Assegna automaticamente</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} · {t.capacity} posti
              {sectionName(t.section_id) ? ` · ${sectionName(t.section_id)}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Cliente
        </p>
        <div className="relative flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm">
            Nome e cognome
            <input
              name="guestName"
              required
              value={guestName}
              onChange={(e) => onNameChange(e.target.value)}
              autoComplete="off"
              placeholder="Cerca o inserisci un nuovo cliente..."
              className={inputClass}
            />
          </label>
          {(suggestions.length > 0 || searching) && (
            <ul className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded border border-zinc-200 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {suggestions.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => pickGuest(g)}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="font-medium">
                      {g.guest_name ?? "(senza nome)"}{" "}
                      <span className="font-normal text-zinc-500">
                        · {g.visit_count} visite
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      {[g.guest_phone, g.guest_email].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
              {searching && (
                <li className="px-3 py-2 text-xs text-zinc-500">Ricerca...</li>
              )}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Telefono
            <input
              type="tel"
              name="guestPhone"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              name="guestEmail"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Note private
          <textarea name="notes" rows={2} className={inputClass} />
        </label>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Salvataggio..." : "Salva · Confermata"}
      </button>
    </form>
  );
}
