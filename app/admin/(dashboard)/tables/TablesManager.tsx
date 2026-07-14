"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DiningSection, DiningTable } from "@/lib/types";
import {
  createSection,
  createTable,
  setTableActive,
  type TablesActionState,
} from "./actions";

const initialState: TablesActionState = {};

export function TablesManager({
  sections,
  tables,
}: {
  sections: DiningSection[];
  tables: DiningTable[];
}) {
  const router = useRouter();
  const [sectionState, sectionAction, sectionPending] = useActionState(
    createSection,
    initialState,
  );
  const [tableState, tableAction, tablePending] = useActionState(
    createTable,
    initialState,
  );
  const [togglePending, startToggle] = useTransition();

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  const groups: { section: DiningSection | null; items: DiningTable[] }[] = [
    ...sections.map((section) => ({
      section: section as DiningSection | null,
      items: tables.filter((t) => t.section_id === section.id),
    })),
    { section: null, items: tables.filter((t) => !t.section_id) },
  ].filter((g) => g.section !== null || g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.section?.id ?? "none"} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {group.section?.name ?? "Senza sala"}
          </h2>
          {group.items.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessun tavolo.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.items.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                    t.is_active
                      ? "border-zinc-200 dark:border-zinc-800"
                      : "border-dashed border-zinc-300 opacity-50 dark:border-zinc-700"
                  }`}
                >
                  <span>
                    <span className="font-semibold">{t.label}</span>{" "}
                    <span className="text-zinc-500">· {t.capacity} posti</span>
                  </span>
                  <button
                    type="button"
                    disabled={togglePending}
                    onClick={() =>
                      startToggle(async () => {
                        await setTableActive(t.id, !t.is_active);
                        router.refresh();
                      })
                    }
                    className="text-xs text-zinc-500 underline underline-offset-2"
                  >
                    {t.is_active ? "Disattiva" : "Riattiva"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Aggiungi tavolo</h2>
        <form action={tableAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Numero / nome
            <input name="label" required className={`${inputClass} w-28`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Posti
            <input
              type="number"
              name="capacity"
              required
              min={1}
              defaultValue={2}
              className={`${inputClass} w-20`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sala
            <select name="sectionId" defaultValue="" className={inputClass}>
              <option value="">Nessuna</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={tablePending}
            className="rounded bg-[#0067c0] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Aggiungi
          </button>
        </form>
        {tableState.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {tableState.error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Aggiungi sala</h2>
        <form action={sectionAction} className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Nome (es. Interno Pizzeria)
            <input name="name" required className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={sectionPending}
            className="rounded bg-[#0067c0] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Aggiungi
          </button>
        </form>
        {sectionState.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {sectionState.error}
          </p>
        )}
      </section>
    </div>
  );
}
