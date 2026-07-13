// Deterministic date-time formatting in the restaurant's own timezone.
// Always pass an explicit timeZone: server components on Vercel run in UTC,
// so a bare toLocaleString() would show 18:00 for a 20:00 Rome reservation
// (and SSR/client output would differ, causing hydration mismatches).
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
