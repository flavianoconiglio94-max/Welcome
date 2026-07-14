"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDaysISO } from "@/lib/tz";
import type { DiningSection } from "@/lib/types";
import type { ServiceWindow } from "@/lib/services";

type Selection = { date: string; service: string; section: string };

// Client-side day/service/section switcher. Every tap updates the highlighted
// state instantly (useOptimistic) and shows a progress bar while the server
// re-renders the reservation list for the new selection.
export function DayToolbar({
  date,
  today,
  serviceKey,
  sectionKey,
  services,
  sections,
}: {
  date: string;
  today: string;
  serviceKey: string;
  sectionKey: string;
  services: ServiceWindow[];
  sections: DiningSection[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selection, setSelection] = useOptimistic<Selection>({
    date,
    service: serviceKey,
    section: sectionKey,
  });

  function go(next: Partial<Selection>) {
    const merged = { ...selection, ...next };
    startTransition(() => {
      setSelection(merged);
      const q = new URLSearchParams();
      q.set("date", merged.date);
      if (merged.service !== "all") q.set("service", merged.service);
      if (merged.section !== "all") q.set("section", merged.section);
      router.push(`/admin?${q.toString()}`);
    });
  }

  const pill = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm transition-colors ${
      active
        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        : "border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {isPending && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[toolbar-progress_1s_ease-in-out_infinite] bg-blue-500" />
          <style>{`@keyframes toolbar-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Giorno precedente"
          onClick={() => go({ date: addDaysISO(selection.date, -1) })}
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
        >
          ←
        </button>
        <input
          type="date"
          value={selection.date}
          onChange={(e) => e.target.value && go({ date: e.target.value })}
          className={`rounded border px-3 py-1.5 text-sm dark:bg-zinc-900 ${
            selection.date === today
              ? "border-green-600 font-medium text-green-700 dark:text-green-400"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        />
        <button
          type="button"
          aria-label="Giorno successivo"
          onClick={() => go({ date: addDaysISO(selection.date, 1) })}
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
        >
          →
        </button>
        {selection.date !== today && (
          <button
            type="button"
            onClick={() => go({ date: today })}
            className="rounded border border-zinc-300 px-2 py-1.5 text-xs active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
          >
            Oggi
          </button>
        )}
        {isPending && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500"
          />
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => go({ service: "all" })}
            className={pill(selection.service === "all")}
          >
            Tutto
          </button>
          {services.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go({ service: s.key })}
              className={pill(selection.service === s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sections.length > 0 && (
        <div className="flex gap-3 overflow-x-auto text-sm">
          <button
            type="button"
            onClick={() => go({ section: "all" })}
            className={
              selection.section === "all"
                ? "font-semibold text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-400"
            }
          >
            Tutte
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go({ section: s.id })}
              className={
                selection.section === s.id
                  ? "whitespace-nowrap font-semibold text-blue-600 dark:text-blue-400"
                  : "whitespace-nowrap text-zinc-600 dark:text-zinc-400"
              }
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
