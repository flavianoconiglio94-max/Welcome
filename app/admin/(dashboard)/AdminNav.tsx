"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "../actions";

const LINKS = [
  { href: "/admin", label: "Libro visite" },
  { href: "/admin/clients", label: "Clienti" },
  { href: "/admin/tables", label: "Sale e tavoli" },
  { href: "/admin/settings", label: "Impostazioni" },
];

// Carries the day currently shown in the libro visite into the wizard, and
// shows a spinner while the wizard page loads.
function NewReservationButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          const date = searchParams.get("date");
          router.push(
            date
              ? `/admin/reservations/new?date=${date}`
              : "/admin/reservations/new",
          );
        })
      }
      className="ml-auto flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70 dark:bg-white dark:text-zinc-900"
    >
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900"
        />
      )}
      + Prenotazione
    </button>
  );
}

export function AdminNav({ restaurantName }: { restaurantName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 text-lg dark:border-zinc-700"
        >
          ☰
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{restaurantName}</p>
          <p className="text-xs text-zinc-500">
            {LINKS.find((l) => l.href === pathname)?.label ?? "Gestionale"}
          </p>
        </div>
        <Suspense
          fallback={
            <span className="ml-auto rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
              + Prenotazione
            </span>
          }
        >
          <NewReservationButton />
        </Suspense>
      </div>

      {open && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-1 bg-white p-4 shadow-xl dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{restaurantName}</p>
              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 dark:border-zinc-700"
              >
                ×
              </button>
            </div>
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded px-3 py-2 text-sm ${
                  pathname === link.href
                    ? "bg-zinc-100 font-medium dark:bg-zinc-800"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <form action={signOut} className="mt-auto">
              <button
                type="submit"
                className="w-full rounded px-3 py-2 text-left text-sm text-red-600 dark:text-red-400"
              >
                Esci
              </button>
            </form>
          </nav>
        </div>
      )}
    </header>
  );
}
