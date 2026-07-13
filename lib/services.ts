import { weekdayKey } from "./tz";

export type OpeningHours = Record<string, [string, string][]>;

export type ServiceWindow = {
  key: string;
  label: string;
  start: string; // "HH:MM" local
  end: string; // "HH:MM" local
};

// Derives the day's services (Restoo's "Pranzo"/"Cena" selector) from the
// opening_hours ranges of that weekday. A range starting before 17:00 is
// labelled Pranzo, later ones Cena; single-range days just get "Servizio".
export function servicesForDate(
  openingHours: OpeningHours,
  dateStr: string,
): ServiceWindow[] {
  const ranges = openingHours[weekdayKey(dateStr)] ?? [];

  return ranges.map(([start, end], index) => {
    const startHour = Number(start.slice(0, 2));
    let label: string;
    if (ranges.length === 1) {
      label = "Servizio";
    } else {
      label = startHour < 17 ? "Pranzo" : "Cena";
    }
    return { key: String(index), label, start, end };
  });
}
