"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Light is the app default; dark is a per-device choice stored in a cookie
// read by the root layout.
export function ThemeToggle({ initialDark }: { initialDark: boolean }) {
  const router = useRouter();
  const [dark, setDark] = useState(initialDark);
  const [pending, startTransition] = useTransition();

  function apply(next: boolean) {
    setDark(next);
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.classList.toggle("dark", next);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center justify-between rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div>
        <p className="text-sm font-medium">Tema scuro</p>
        <p className="text-xs text-zinc-500">
          Vale solo per questo dispositivo. Di default il tema è chiaro.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        disabled={pending}
        onClick={() => apply(!dark)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          dark ? "bg-[#0067c0]" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            dark ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
