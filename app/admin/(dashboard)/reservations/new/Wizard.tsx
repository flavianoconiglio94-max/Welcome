"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  createManualReservation,
  getDayLoad,
  searchGuests,
  type CreateReservationState,
  type DayLoadEntry,
} from "../../../actions";
import { servicesForDate, type OpeningHours } from "@/lib/services";
import { localTimeHM, utcFromZoned } from "@/lib/tz";
import type { DiningSection, DiningTable, GuestDirectoryEntry } from "@/lib/types";

const STEPS = ["Data", "PAX", "Ora", "Tavolo", "Dettagli"] as const;

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
const WEEKDAYS = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

const initialState: CreateReservationState = {};

export function Wizard({
  defaultDate,
  defaultTime,
  today,
  openingHours,
  slotInterval,
  defaultDuration,
  maxCoversPerSlot,
  timezone,
  sections,
  tables,
}: {
  defaultDate: string;
  defaultTime: string | null;
  today: string;
  openingHours: OpeningHours;
  slotInterval: number;
  defaultDuration: number;
  maxCoversPerSlot: number | null;
  timezone: string;
  sections: DiningSection[];
  tables: DiningTable[];
}) {
  // When the libro visite opens the wizard from a time-slot row, date and
  // time are already chosen: start directly from the PAX step.
  const [step, setStep] = useState(defaultTime ? 1 : 0);
  const [date, setDate] = useState(defaultDate);
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [time, setTime] = useState<string | null>(defaultTime);
  const [duration, setDuration] = useState(defaultDuration);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableLocked, setTableLocked] = useState(false);
  const [manualTable, setManualTable] = useState(false);

  const [dayLoad, setDayLoad] = useState<DayLoadEntry[]>([]);
  const [loadPending, startLoad] = useTransition();

  useEffect(() => {
    startLoad(async () => {
      setDayLoad(await getDayLoad(date));
    });
  }, [date]);

  const pax = adults + children;
  const services = useMemo(
    () => servicesForDate(openingHours, date),
    [openingHours, date],
  );
  const [serviceKey, setServiceKey] = useState<string | null>(null);
  const activeService =
    services.find((s) => s.key === serviceKey) ?? services[0] ?? null;

  // ---- derived: per-slot booked covers and table occupancy at chosen time
  const bookedBySlot = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of dayLoad) {
      const hm = localTimeHM(r.starts_at, timezone);
      map.set(hm, (map.get(hm) ?? 0) + r.party_size);
    }
    return map;
  }, [dayLoad, timezone]);

  const occupiedTableIds = useMemo(() => {
    if (!time) return new Set<string>();
    const start = utcFromZoned(date, time, timezone).getTime();
    const end = start + duration * 60_000;
    const busy = new Set<string>();
    for (const r of dayLoad) {
      if (!r.table_id) continue;
      const rStart = new Date(r.starts_at).getTime();
      const rEnd = new Date(r.ends_at).getTime();
      if (rStart < end && rEnd > start) busy.add(r.table_id);
    }
    return busy;
  }, [dayLoad, date, time, timezone, duration]);

  const freeTablesAt = (timeStr: string, forPax = pax) => {
    const start = utcFromZoned(date, timeStr, timezone).getTime();
    const end = start + duration * 60_000;
    const busy = new Set<string>();
    for (const r of dayLoad) {
      if (!r.table_id) continue;
      if (new Date(r.starts_at).getTime() < end && new Date(r.ends_at).getTime() > start) {
        busy.add(r.table_id);
      }
    }
    return tables
      .filter((t) => !busy.has(t.id) && t.capacity >= Math.max(forPax, 1))
      .sort((a, b) => a.capacity - b.capacity);
  };

  const freeTables = useMemo(
    () =>
      tables
        .filter((t) => !occupiedTableIds.has(t.id) && t.capacity >= Math.max(pax, 1))
        .sort((a, b) => a.capacity - b.capacity),
    [tables, occupiedTableIds, pax],
  );

  const chipValue = (index: number): string | null => {
    switch (index) {
      case 0:
        return date ? formatShortDate(date) : null;
      case 1:
        return pax > 0 ? `${pax}` : null;
      case 2:
        return time;
      case 3:
        return step > 3
          ? (tableId ? (tables.find((t) => t.id === tableId)?.label ?? "?") : "—")
          : null;
      default:
        return null;
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((label, i) => {
          const value = chipValue(i);
          const reachable = i < step;
          return (
            <button
              key={label}
              type="button"
              disabled={!reachable && i !== step}
              onClick={() => reachable && setStep(i)}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium ${
                i === step
                  ? "bg-[#0067c0] text-white"
                  : reachable
                    ? "border border-zinc-300 dark:border-zinc-700"
                    : "border border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
              }`}
            >
              {value ?? label}
            </button>
          );
        })}
        {loadPending && (
          <span
            aria-hidden
            className="ml-auto h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-[#0067c0]"
          />
        )}
      </div>

      {step === 0 && (
        <CalendarStep
          date={date}
          today={today}
          onPick={(d) => {
            setDate(d);
            setTime(null);
            setTableId(null);
            setManualTable(false);
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <PaxStep
          adults={adults}
          childrenCount={children}
          setAdults={setAdults}
          setChildren={setChildren}
          onDone={(a, c) => {
            setAdults(a);
            setChildren(c);
            setManualTable(false);
            if (time) {
              // Time already chosen (slot row or edit from summary):
              // re-run the table pre-assignment and skip to the floor map.
              setTableId(freeTablesAt(time, a + c)[0]?.id ?? null);
              setStep(3);
            } else {
              setTableId(null);
              setStep(2);
            }
          }}
        />
      )}

      {step === 2 && (
        <TimeStep
          services={services}
          activeKey={activeService?.key ?? null}
          setServiceKey={setServiceKey}
          slotInterval={slotInterval}
          bookedBySlot={bookedBySlot}
          maxCovers={maxCoversPerSlot}
          pax={pax}
          onPick={(t) => {
            setTime(t);
            // Pre-assign the smallest fitting free table for the chosen time.
            setTableId(freeTablesAt(t)[0]?.id ?? null);
            setManualTable(false);
            setStep(3);
          }}
        />
      )}

      {step === 3 && (
        <TableStep
          sections={sections}
          tables={tables}
          occupied={occupiedTableIds}
          suggested={freeTables}
          tableId={tableId}
          setTableId={setTableId}
          manualTable={manualTable}
          setManualTable={setManualTable}
          tableLocked={tableLocked}
          setTableLocked={setTableLocked}
          onConfirm={() => setStep(4)}
        />
      )}

      {step === 4 && time && (
        <DetailsStep
          date={date}
          time={time}
          adults={adults}
          childrenCount={children}
          duration={duration}
          setDuration={setDuration}
          table={tables.find((t) => t.id === tableId) ?? null}
          tableLocked={tableLocked}
          goToStep={setStep}
        />
      )}
    </main>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

// ---------------------------------------------------------------- step 1
function CalendarStep({
  date,
  today,
  onPick,
}: {
  date: string;
  today: string;
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState(date.slice(0, 7)); // YYYY-MM

  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1];
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7; // Monday-first

  const cells: (string | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `${month}-${day}`;
    }),
  ];

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, monthIndex + delta, 1));
    setMonth(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-medium capitalize">
          {MONTHS[monthIndex]} {year}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
            aria-label="Mese precedente"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
            aria-label="Mese successivo"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) =>
          d === null ? (
            <span key={`blank-${i}`} />
          ) : (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={`flex h-11 items-center justify-center rounded text-sm ${
                d === date
                  ? "bg-[#0067c0] font-semibold text-white"
                  : d === today
                    ? "border border-[#107c10] font-medium text-[#107c10] dark:text-[#6ccb5f]"
                    : "active:bg-zinc-200 dark:active:bg-zinc-800"
              }`}
            >
              {Number(d.slice(8, 10))}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={() => onPick(today)}
        className="rounded bg-[#107c10] px-4 py-2.5 text-sm font-medium text-white"
      >
        Oggi
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- step 2
function PaxStep({
  adults,
  childrenCount,
  setAdults,
  setChildren,
  onDone,
}: {
  adults: number;
  childrenCount: number;
  setAdults: (n: number) => void;
  setChildren: (n: number) => void;
  onDone: (adults: number, children: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center font-medium">Adulti</p>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onDone(n, 0)}
            className="rounded border border-zinc-300 py-3 text-sm active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
          >
            {n} {n === 1 ? "adulto" : "adulti"}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <Stepper label="Adulti" value={adults} onChange={setAdults} />
        <Stepper label="Bambini" value={childrenCount} onChange={setChildren} />
      </div>

      <button
        type="button"
        disabled={adults + childrenCount < 1}
        onClick={() => onDone(adults, childrenCount)}
        className="rounded bg-[#0067c0] px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        Continua
      </button>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700">
      <div className="flex flex-col">
        <span className="text-xs text-zinc-500">{label}</span>
        {editing ? (
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            min={0}
            max={99}
            defaultValue={value}
            onBlur={(e) => {
              onChange(Math.max(0, Math.min(99, Number(e.target.value) || 0)));
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-14 rounded border border-zinc-300 px-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left text-base font-semibold"
          >
            {value}
          </button>
        )}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label={`Meno ${label}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 text-lg active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Più ${label}`}
          onClick={() => onChange(Math.min(99, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded border border-zinc-300 text-lg active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- step 3
function TimeStep({
  services,
  activeKey,
  setServiceKey,
  slotInterval,
  bookedBySlot,
  maxCovers,
  pax,
  onPick,
}: {
  services: ReturnType<typeof servicesForDate>;
  activeKey: string | null;
  setServiceKey: (k: string) => void;
  slotInterval: number;
  bookedBySlot: Map<string, number>;
  maxCovers: number | null;
  pax: number;
  onPick: (time: string) => void;
}) {
  const active = services.find((s) => s.key === activeKey) ?? services[0] ?? null;

  const slots = useMemo(() => {
    if (!active) return [];
    const out: string[] = [];
    let [h, m] = active.start.split(":").map(Number);
    const [endH, endM] = active.end.split(":").map(Number);
    while (h < endH || (h === endH && m <= endM)) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      m += slotInterval;
      h += Math.floor(m / 60);
      m %= 60;
    }
    return out;
  }, [active, slotInterval]);

  if (services.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nessun servizio configurato per questo giorno (controlla gli orari di
        apertura del ristorante).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center gap-2">
        {services.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setServiceKey(s.key)}
            className={`rounded px-4 py-1.5 text-sm ${
              active?.key === s.key
                ? "bg-[#0067c0] font-medium text-white"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {slots.map((t) => {
          const booked = bookedBySlot.get(t) ?? 0;
          const full = maxCovers !== null && booked + pax > maxCovers;
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className={`flex w-full items-center justify-between rounded border px-4 py-3 text-sm active:bg-zinc-200 dark:active:bg-zinc-800 ${
                  full
                    ? "border-red-300 dark:border-red-900"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <span className="font-medium">{t}</span>
                <span className={full ? "text-red-600 dark:text-red-400" : "text-zinc-500"}>
                  {booked} / {maxCovers ?? "∞"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- step 4
function TableStep({
  sections,
  tables,
  occupied,
  suggested,
  tableId,
  setTableId,
  manualTable,
  setManualTable,
  tableLocked,
  setTableLocked,
  onConfirm,
}: {
  sections: DiningSection[];
  tables: DiningTable[];
  occupied: Set<string>;
  suggested: DiningTable[];
  tableId: string | null;
  setTableId: (id: string | null) => void;
  manualTable: boolean;
  setManualTable: (v: boolean) => void;
  tableLocked: boolean;
  setTableLocked: (v: boolean) => void;
  onConfirm: () => void;
}) {
  const rooms: { id: string | null; name: string }[] = [
    ...sections.map((s) => ({ id: s.id as string | null, name: s.name })),
    ...(tables.some((t) => !t.section_id)
      ? [{ id: null, name: "Senza sala" }]
      : []),
  ];
  const [roomIndex, setRoomIndex] = useState(() => {
    if (tableId) {
      const t = tables.find((x) => x.id === tableId);
      const idx = rooms.findIndex((r) => r.id === (t?.section_id ?? null));
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const room = rooms[roomIndex] ?? null;
  const roomTables = tables.filter((t) => (t.section_id ?? null) === (room?.id ?? null));

  const selected = tableId ? tables.find((t) => t.id === tableId) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative min-h-64 rounded bg-slate-700 p-4">
        {rooms.length === 0 || roomTables.length === 0 ? (
          <p className="text-sm text-slate-300">
            Nessun tavolo in questa sala. Configura sale e tavoli dalle
            impostazioni.
          </p>
        ) : (
          <div className="flex flex-wrap content-start gap-3 pb-10">
            {roomTables.map((t) => {
              const busy = occupied.has(t.id);
              const isSel = tableId === t.id;
              const size =
                t.capacity <= 2 ? "h-11 w-11" : t.capacity <= 4 ? "h-[3.25rem] w-[3.25rem]" : "h-14 w-14";
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setTableId(isSel ? null : t.id)}
                  className={`${size} flex flex-col items-center justify-center rounded text-xs font-semibold shadow ${
                    isSel
                      ? "bg-[#0067c0] text-white ring-2 ring-[#6ccb5f]"
                      : busy
                        ? "bg-slate-500 text-slate-300 opacity-50"
                        : "bg-white text-slate-800"
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="text-[10px] font-normal opacity-70">
                    {t.capacity}p
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {rooms.length > 0 && (
          <button
            type="button"
            onClick={() => setRoomIndex((roomIndex + 1) % rooms.length)}
            className="absolute bottom-3 right-3 rounded bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white"
          >
            {room?.name}
            {rooms.length > 1 ? " · cambia" : ""}
          </button>
        )}
      </div>

      {!manualTable ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setTableId(null);
              setTableLocked(false);
              setManualTable(true);
            }}
            className="rounded border border-zinc-300 px-3 py-2.5 text-sm active:bg-zinc-200 dark:border-zinc-700 dark:active:bg-zinc-800"
          >
            Togliere tavoli
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => setTableLocked(!tableLocked)}
            className={`rounded px-3 py-2.5 text-sm disabled:opacity-40 ${
              tableLocked
                ? "bg-[#0067c0] font-medium text-white"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {tableLocked ? "Tavolo bloccato" : "Blocca tavolo"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Tavoli consigliati per questa prenotazione
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nessun tavolo libero adatto: puoi salvare senza tavolo.
              </p>
            ) : (
              suggested.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTableId(tableId === t.id ? null : t.id)}
                  className={`rounded border px-3 py-2 text-sm ${
                    tableId === t.id
                      ? "border-[#0067c0] bg-[#0067c0] text-white"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {t.label} · {t.capacity}p
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onConfirm}
        className="rounded bg-[#0067c0] px-4 py-3 text-sm font-medium text-white"
      >
        {selected ? `Conferma · Tavolo ${selected.label}` : "Senza tavolo"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- step 5
const DURATIONS = Array.from({ length: 15 }, (_, i) => (i + 2) * 15); // 30..240

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function DetailsStep({
  date,
  time,
  adults,
  childrenCount,
  duration,
  setDuration,
  table,
  tableLocked,
  goToStep,
}: {
  date: string;
  time: string;
  adults: number;
  childrenCount: number;
  duration: number;
  setDuration: (n: number) => void;
  table: DiningTable | null;
  tableLocked: boolean;
  goToStep: (n: number) => void;
}) {
  const [state, formAction, pending] = useActionState(
    createManualReservation,
    initialState,
  );

  const [query, setQuery] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [suggestions, setSuggestions] = useState<GuestDirectoryEntry[]>([]);
  const [picked, setPicked] = useState(false);
  const [searching, startSearch] = useTransition();

  // Progressive disclosure: typing digits fills the phone and asks for the
  // name; typing letters fills the name and asks for the phone.
  const queryIsPhone = /^[\d+\s]+$/.test(query.trim()) && query.trim() !== "";

  function onQueryChange(value: string) {
    setQuery(value);
    setPicked(false);
    if (/^[\d+\s]+$/.test(value.trim()) && value.trim() !== "") {
      setGuestPhone(value.trim());
      setGuestName("");
    } else {
      setGuestName(value.trim());
      setGuestPhone("");
    }
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    startSearch(async () => {
      setSuggestions(await searchGuests(value));
    });
  }

  function pickGuest(g: GuestDirectoryEntry) {
    setGuestName(g.guest_name ?? "");
    setGuestEmail(g.guest_email ?? "");
    setGuestPhone(g.guest_phone ?? "");
    setQuery(g.guest_name ?? g.guest_phone ?? "");
    setSuggestions([]);
    setPicked(true);
  }

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  const pax = adults + childrenCount;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="children" value={childrenCount} />
      <input type="hidden" name="duration" value={duration} />
      <input type="hidden" name="tableId" value={table?.id ?? ""} />
      <input type="hidden" name="tableLocked" value={tableLocked && table ? "1" : ""} />
      <input type="hidden" name="guestName" value={guestName} />
      <input type="hidden" name="guestPhone" value={guestPhone} />
      <input type="hidden" name="guestEmail" value={guestEmail} />

      <div className="grid grid-cols-2 gap-2 text-sm">
        <SummaryCell label="Data" value={formatShortDate(date)} onClick={() => goToStep(0)} />
        <SummaryCell
          label="PAX"
          value={`${pax}${childrenCount > 0 ? ` (${childrenCount} bambini)` : ""}`}
          onClick={() => goToStep(1)}
        />
        <SummaryCell label="Ora" value={time} onClick={() => goToStep(2)} />
        <SummaryCell
          label="Tavolo"
          value={table ? `${table.label}${tableLocked ? " · Bloccato" : ""}` : "Senza tavolo"}
          onClick={() => goToStep(3)}
        />
        <div className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Durata</p>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-transparent font-medium text-[#0067c0] outline-none dark:text-[#479ef5]"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-sm">
          Cliente
          <input
            required={!guestName}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoComplete="off"
            placeholder="Cerca..."
            className={inputClass}
          />
        </label>
        {suggestions.length > 0 && !picked && (
          <ul className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded border border-zinc-200 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {suggestions.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => pickGuest(g)}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">
                    {g.guest_name ?? "(senza nome)"}{" "}
                    <span className="font-normal text-zinc-500">
                      · {g.visit_count} visite
                    </span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {[g.guest_phone, g.guest_email].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && (
          <p className="text-xs text-zinc-500">Ricerca in corso...</p>
        )}
        {!picked && query.trim().length >= 3 && suggestions.length === 0 && !searching && (
          <p className="text-xs text-zinc-500">
            Nessun cliente trovato: compila i campi per salvarne uno nuovo.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {(picked || queryIsPhone) && (
          <label className="flex flex-col gap-1 text-sm">
            Nome e cognome
            <input
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        {(picked || (!queryIsPhone && query.trim() !== "")) && (
          <label className="flex flex-col gap-1 text-sm">
            Telefono
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        {(picked || query.trim() !== "") && (
          <label className="flex flex-col gap-1 text-sm">
            Email (facoltativa)
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Note private
          <textarea name="notes" rows={2} className={inputClass} />
        </label>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded bg-[#107c10] px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {pending ? "Salvataggio..." : "Salva"}
      </button>
    </form>
  );
}

function SummaryCell({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-zinc-200 p-2 text-left active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-800"
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium text-[#0067c0] dark:text-[#479ef5]">{value}</p>
    </button>
  );
}
