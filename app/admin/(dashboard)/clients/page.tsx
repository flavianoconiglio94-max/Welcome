import { createClient } from "@/lib/supabase/server";
import type { GuestDirectoryEntry } from "@/lib/types";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  // RLS scopes guest_directory to the staff member's restaurant.
  let query = supabase
    .from("guest_directory")
    .select("id, restaurant_id, guest_name, guest_email, guest_phone, notes, tags, visit_count, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const sanitized = (q ?? "").replace(/[,()%_\\]/g, " ").trim();
  if (sanitized) {
    const pattern = `%${sanitized}%`;
    query = query.or(
      `guest_name.ilike.${pattern},guest_email.ilike.${pattern},guest_phone.ilike.${pattern}`,
    );
  }

  const { data, error } = await query.returns<GuestDirectoryEntry[]>();
  const guests = data ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Cerca per nome, telefono o email..."
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Cerca
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
      )}

      {guests.length === 0 ? (
        <p className="text-sm text-zinc-500">Nessun cliente trovato.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {guests.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {g.guest_name ?? "(senza nome)"}
                </p>
                <p className="truncate text-sm text-zinc-500">
                  {[g.guest_phone, g.guest_email].filter(Boolean).join(" · ") ||
                    "Nessun contatto"}
                </p>
                {g.notes && (
                  <p className="truncate text-xs text-zinc-500">📝 {g.notes}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{g.visit_count}</p>
                <p className="text-xs text-zinc-500">visite</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
