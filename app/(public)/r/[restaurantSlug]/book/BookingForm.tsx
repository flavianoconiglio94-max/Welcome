"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AvailabilitySlot, Reservation, RestaurantPublic } from "@/lib/types";

function todayInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatSlot(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function BookingForm({ restaurant }: { restaurant: RestaurantPublic }) {
  const supabase = useMemo(() => createClient(), []);
  const minDate = useMemo(() => todayInTimezone(restaurant.timezone), [restaurant.timezone]);

  const [date, setDate] = useState(minDate);
  const [partySize, setPartySize] = useState(
    Math.min(2, restaurant.max_party_size) || restaurant.min_party_size,
  );
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);

  async function searchAvailability() {
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);
    setSlots(null);

    const { data, error } = await supabase.rpc("get_availability", {
      p_restaurant_id: restaurant.id,
      p_date: date,
      p_party_size: partySize,
    });

    setLoadingSlots(false);

    if (error) {
      setSlotsError(error.message);
      return;
    }

    const available = ((data as AvailabilitySlot[]) ?? []).filter(
      (slot) => slot.tables_available > 0,
    );
    setSlots(available);
  }

  async function submitBooking() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase
      .rpc("request_reservation", {
        p_restaurant_id: restaurant.id,
        p_starts_at: selectedSlot.slot_start,
        p_party_size: partySize,
        p_guest_name: guestName,
        p_guest_email: guestEmail || null,
        p_guest_phone: guestPhone || null,
        p_notes: notes || null,
      })
      .single<Reservation>();

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    setConfirmed(data);
  }

  if (confirmed) {
    const manageUrl = `/r/${restaurant.slug}/book/confirm/${confirmed.id}?token=${confirmed.cancellation_token}`;
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Prenotazione registrata</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {confirmed.status === "confirmed"
            ? "La tua prenotazione è confermata."
            : "La tua prenotazione è in attesa di conferma da parte del ristorante."}
        </p>
        <p className="text-sm">
          {formatSlot(confirmed.starts_at, restaurant.timezone)} &middot;{" "}
          {confirmed.party_size} persone
        </p>
        <a
          href={manageUrl}
          className="text-sm underline underline-offset-2"
        >
          Gestisci o cancella la prenotazione
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Data
          <input
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Persone
          <select
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {Array.from(
              { length: restaurant.max_party_size - restaurant.min_party_size + 1 },
              (_, i) => restaurant.min_party_size + i,
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={searchAvailability}
          disabled={loadingSlots}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {loadingSlots ? "Ricerca..." : "Cerca disponibilità"}
        </button>
      </div>

      {slotsError && (
        <p className="text-sm text-red-600 dark:text-red-400">{slotsError}</p>
      )}

      {slots && slots.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nessun orario disponibile per questa data e numero di persone.
        </p>
      )}

      {slots && slots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => (
            <button
              key={slot.slot_start}
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={`rounded border px-3 py-1.5 text-sm ${
                selectedSlot?.slot_start === slot.slot_start
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {formatSlot(slot.slot_start, restaurant.timezone)}
            </button>
          ))}
        </div>
      )}

      {selectedSlot && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitBooking();
          }}
          className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        >
          <p className="text-sm font-medium">
            {formatSlot(selectedSlot.slot_start, restaurant.timezone)} &middot;{" "}
            {partySize} persone
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Nome e cognome
            <input
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Telefono
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Inserisci almeno email o telefono: serve per il link di gestione
            della prenotazione.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Note (opzionale)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              rows={2}
            />
          </label>

          {submitError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || (!guestEmail && !guestPhone)}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {submitting ? "Invio..." : "Prenota"}
          </button>
        </form>
      )}
    </div>
  );
}
