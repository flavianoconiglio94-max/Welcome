// Timezone helpers for working with a restaurant's local calendar day.
// No timezone library is installed, so UTC conversion uses the standard
// two-pass Intl offset probe (exact except during the 02:00-03:00 DST jump,
// when restaurants are closed anyway).

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export function localDateISO(timeZone: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayKey(dateStr: string): WeekdayKey {
  return WEEKDAY_KEYS[new Date(`${dateStr}T12:00:00Z`).getUTCDay()];
}

function offsetAt(utcInstant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcInstant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - utcInstant.getTime();
}

/** UTC instant corresponding to `dateStr timeStr` on the restaurant's wall clock. */
export function utcFromZoned(dateStr: string, timeStr: string, timeZone: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  const firstGuess = new Date(naive.getTime() - offsetAt(naive, timeZone));
  // Second pass handles the case where the first guess crosses a DST boundary.
  return new Date(naive.getTime() - offsetAt(firstGuess, timeZone));
}

/** "HH:MM" wall-clock time of an ISO instant in the given timezone. */
export function localTimeHM(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
