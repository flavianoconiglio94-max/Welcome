"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DatePickerInner({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(next: string) {
    const q = new URLSearchParams(searchParams.toString());
    q.set("date", next);
    router.push(`/admin?${q.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go(e.target.value)}
        className={`rounded border px-3 py-1.5 text-sm dark:bg-zinc-900 ${
          date === today
            ? "border-green-600 font-medium text-green-700 dark:text-green-400"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      />
      {date !== today && (
        <button
          type="button"
          onClick={() => go(today)}
          className="rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700"
        >
          Oggi
        </button>
      )}
    </div>
  );
}

export function DatePicker(props: { date: string; today: string }) {
  return (
    <Suspense fallback={null}>
      <DatePickerInner {...props} />
    </Suspense>
  );
}
