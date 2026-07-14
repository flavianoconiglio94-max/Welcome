"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDaysISO, localTimeHM } from "@/lib/tz";
import type { ServiceWindow } from "@/lib/services";
import type { DiningSection, DiningTable, Reservation } from "@/lib/types";
import { ReservationCard } from "./ReservationCard";

const GROUPS: { label: string; statuses: Reservation["status"][] }[] = [
  { label: "Non confermate", statuses: ["unconfirmed"] },
  { label: "In attesa di sedersi", statuses: ["pending_seat"] },
  { label: "Confermate", statuses: ["confirmed"] },
  { label: "Sedute", statuses: ["seated"] },
  { label: "Completate", statuses: ["completed"] },
  { label: "Cancellate / No-show", statuses: ["cancelled", "no_show"] },
];

// The whole day view is client-side: switching service or section only
// filters data already in memory (instant). Only a date change goes back to
// the server, with optimistic highlight + progress bar + dimmed list.
export function DayBook({
  date,
  today,
  services,
  slotInterval,
  sections,
  tables,
  reservations,
  timezone,
}: {
  date: string;
  today: string;
  services: ServiceWindow[];
  slotInterval: number;
  sections: DiningSection[];
  tables: DiningTable[];
  reservations: Reservation[];
  timezone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticDate, setOptimisticDate] = useOptimistic(date);
  const [serviceKey, setServiceKey] = useState("all");
  const [sectionKey, setSectionKey] = useState("all");

  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );

  function goToDate(next: string) {
    startTransition(() => {
      setOptimisticDate(next);
      router.push(`/admin?date=${next}`);
    });
  }

  const activeService = services.find((s) => s.key === serviceKey) ?? null;

  // Time slots shown inside the expanded "Confermate" group (Restoo-style):
  // every slot of the visible services, with that slot's reservations nested.
  const slots = useMemo(() => {
    const visible = activeService ? [activeService] : services;
    const out: string[] = [];
    for (const s of visible) {
      let [h, m] = s.start.split(":").map(Number);
      const [endH, endM] = s.end.split(":").map(Number);
      while (h < endH || (h === endH && m <= endM)) {
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        m += slotInterval;
        h += Math.floor(m / 60);
        m %= 60;
      }
    }
    return [...new Set(out)].sort();
  }, [services, activeService, slotInterval]);

  function slotOf(r: Reservation): string {
    const hm = localTimeHM(r.starts_at, timezone);
    // Exact slot when it exists, otherwise floor to the slot grid.
    if (slots.includes(hm)) return hm;
    const [h, m] = hm.split(":").map(Number);
    const floored = m - (m % slotInterval);
    const key = `${String(h).padStart(2, "0")}:${String(floored).padStart(2, "0")}`;
    return slots.includes(key) ? key : hm;
  }

  function newReservationAt(time: string) {
    startTransition(() => {
      router.push(`/admin/reservations/new?date=${date}&time=${time}`);
    });
  }

  const filtered = useMemo(
    () =>
      reservations.filter((r) => {
        if (activeService) {
          const hm = localTimeHM(r.starts_at, timezone);
          if (hm < activeService.start || hm > activeService.end) return false;
        }
        if (sectionKey !== "all") {
          const table = r.table_id ? tableById.get(r.table_id) : undefined;
          if (!table || table.section_id !== sectionKey) return false;
        }
        return true;
      }),
    [reservations, activeService, sectionKey, tableById, timezone],
  );

  const pill = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm transition-colors ${
      active
        ? "bg-[#0067c0] text-white"
        : "border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {isPending && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[toolbar-progress_1s_ease-in-out_infinite] bg-[#0067c0]" />
          <style>{`@keyframes toolbar-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Giorno precedente"
          onClick={() => goToDate(addDaysISO(optimisticDate, -1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
        >
          ←
        </button>
        <input
          type="date"
          value={optimisticDate}
          onChange={(e) => e.target.value && goToDate(e.target.value)}
          className={`min-w-0 flex-1 rounded border px-3 py-1.5 text-sm dark:bg-zinc-900 sm:flex-none ${
            optimisticDate === today
              ? "border-[#107c10] font-medium text-[#107c10] dark:text-[#6ccb5f]"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        />
        <button
          type="button"
          aria-label="Giorno successivo"
          onClick={() => goToDate(addDaysISO(optimisticDate, 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
        >
          →
        </button>
        {optimisticDate !== today ? (
          <button
            type="button"
            onClick={() => goToDate(today)}
            className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-sm active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
          >
            Oggi
          </button>
        ) : (
          <span
            aria-hidden
            className={`shrink-0 ${isPending ? "" : "invisible"}`}
          >
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-[#0067c0]" />
          </span>
        )}
      </div>

      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => setServiceKey("all")}
          className={pill(serviceKey === "all")}
        >
          Tutto
        </button>
        {services.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setServiceKey(s.key)}
            className={pill(serviceKey === s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sections.length > 0 && (
        <div className="flex gap-3 overflow-x-auto text-sm">
          <button
            type="button"
            onClick={() => setSectionKey("all")}
            className={
              sectionKey === "all"
                ? "font-semibold text-[#0067c0] dark:text-[#479ef5]"
                : "text-zinc-600 dark:text-zinc-400"
            }
          >
            Tutte
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSectionKey(s.id)}
              className={
                sectionKey === s.id
                  ? "whitespace-nowrap font-semibold text-[#0067c0] dark:text-[#479ef5]"
                  : "whitespace-nowrap text-zinc-600 dark:text-zinc-400"
              }
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div
        className={`flex flex-col gap-2 transition-opacity ${isPending ? "opacity-50" : ""}`}
      >
        {GROUPS.map((group) => {
          const items = filtered.filter((r) => group.statuses.includes(r.status));
          const pax = items.reduce((sum, r) => sum + r.party_size, 0);
          const withSlots = group.statuses.includes("confirmed");

          let body;
          if (withSlots && slots.length > 0) {
            const bySlot = new Map<string, Reservation[]>();
            for (const r of items) {
              const key = slotOf(r);
              bySlot.set(key, [...(bySlot.get(key) ?? []), r]);
            }
            const allKeys = [...new Set([...slots, ...bySlot.keys()])].sort();
            body = (
              <ul className="flex flex-col">
                {allKeys.map((slot) => {
                  const slotItems = bySlot.get(slot) ?? [];
                  const slotPax = slotItems.reduce((s, r) => s + r.party_size, 0);
                  return (
                    <li key={slot} className="border-t border-zinc-100 first:border-t-0 dark:border-zinc-800/60">
                      <button
                        type="button"
                        onClick={() => newReservationAt(slot)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-sm active:bg-zinc-100 dark:active:bg-zinc-800"
                      >
                        <span className="font-medium">{slot}</span>
                        <span className="flex items-center gap-3 text-zinc-500">
                          <span>
                            {slotItems.length} / {slotPax}
                          </span>
                          <span className="text-base font-semibold text-[#0067c0] dark:text-[#479ef5]">
                            +
                          </span>
                        </span>
                      </button>
                      {slotItems.length > 0 && (
                        <ul className="flex flex-col gap-2 px-2 pb-2">
                          {slotItems.map((r) => (
                            <ReservationCard
                              key={r.id}
                              reservation={r}
                              timezone={timezone}
                              tableLabel={
                                r.table_id
                                  ? (tableById.get(r.table_id)?.label ?? "?")
                                  : null
                              }
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          } else {
            body = (
              <ul className="flex flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <li className="px-2 py-1 text-sm text-zinc-500">Nessuna</li>
                ) : (
                  items.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      timezone={timezone}
                      tableLabel={
                        r.table_id ? (tableById.get(r.table_id)?.label ?? "?") : null
                      }
                    />
                  ))
                )}
              </ul>
            );
          }

          return (
            <details
              key={group.label}
              open={withSlots || items.length > 0}
              className="rounded border border-zinc-200 dark:border-zinc-800"
            >
              <summary className="flex cursor-pointer items-center justify-between rounded bg-zinc-100 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
                <span>{group.label}</span>
                <span className="text-zinc-500">
                  {items.length} / {pax}
                </span>
              </summary>
              {body}
            </details>
          );
        })}
      </div>
    </div>
  );
}
