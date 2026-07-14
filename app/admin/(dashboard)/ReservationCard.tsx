"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { localTimeHM } from "@/lib/tz";
import { formatDateTime } from "@/lib/format";
import {
  CHANNEL_LABELS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_TRANSITIONS,
  SOURCE_LABELS,
  type DiningSection,
  type DiningTable,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";
import {
  updateReservationLock,
  updateReservationStatus,
  updateReservationTable,
} from "../actions";

function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2m-8 0h9a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReservationCard({
  reservation,
  timezone,
  tables,
  sections,
  dayReservations,
}: {
  reservation: Reservation;
  timezone: string;
  tables: DiningTable[];
  sections: DiningSection[];
  dayReservations: Reservation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const table = reservation.table_id
    ? (tables.find((t) => t.id === reservation.table_id) ?? null)
    : null;

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        setError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function transitionTo(to: ReservationStatus) {
    run(() => updateReservationStatus(reservation.id, reservation.status, to));
  }

  // Bottom bar quick links per status, Restoo-style.
  const quickActions: { label: string; onClick: () => void }[] = [];
  if (reservation.status === "unconfirmed") {
    quickActions.push({ label: "Conferma", onClick: () => transitionTo("confirmed") });
  } else if (reservation.status === "pending_seat" || reservation.status === "confirmed") {
    quickActions.push({ label: "Seduto", onClick: () => transitionTo("seated") });
  } else if (reservation.status === "seated") {
    quickActions.push({ label: "Termina", onClick: () => transitionTo("completed") });
    quickActions.push({
      label: "Torna confermato",
      onClick: () => transitionTo("confirmed"),
    });
  }

  const badges: string[] = [];
  if (reservation.high_chairs > 0) badges.push(`${reservation.high_chairs} seggiolone/i`);
  if (reservation.strollers > 0) badges.push(`${reservation.strollers} passeggino/i`);
  if (reservation.allergies) badges.push(`Allergie: ${reservation.allergies}`);
  if (reservation.special_occasion) badges.push(reservation.special_occasion);
  if (reservation.accessible_table) badges.push("Tavolo accessibile");

  return (
    <li
      className={`overflow-hidden rounded border bg-white dark:bg-zinc-950 ${
        reservation.highlighted
          ? "border-[#0067c0]"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelected(!selected)}
        onKeyDown={(e) => e.key === "Enter" && setSelected(!selected)}
        className="flex w-full cursor-pointer items-center gap-3 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{reservation.guest_name}</p>
          <p className="text-sm">
            <span className="font-semibold text-[#0067c0] dark:text-[#479ef5]">
              {localTimeHM(reservation.starts_at, timezone)}
            </span>{" "}
            <span className="text-xs text-zinc-500">
              · {SOURCE_LABELS[reservation.source] ?? reservation.source}
            </span>
          </p>
        </div>
        <span className="text-lg font-semibold">{reservation.party_size}</span>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            if (reservation.table_locked) {
              setShowUnlock(true);
            } else {
              setShowMap(true);
            }
          }}
          className={`flex h-10 w-16 shrink-0 items-center justify-center gap-1 rounded border text-sm font-medium ${
            table
              ? "border-zinc-300 dark:border-zinc-700"
              : "border-dashed border-zinc-400 text-zinc-500 dark:border-zinc-600"
          }`}
        >
          {reservation.table_locked && <LockIcon />}
          {table ? table.label : "+"}
        </button>
      </div>

      {(reservation.notes || badges.length > 0) && (
        <p className="truncate px-3 pb-2 text-xs text-zinc-500">
          {[...badges, reservation.notes].filter(Boolean).join(" · ")}
        </p>
      )}

      {error && (
        <p className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {selected && (
        <div className="flex items-stretch bg-[#0067c0] text-white">
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={pending}
              onClick={a.onClick}
              className="flex-1 px-2 py-2.5 text-sm font-medium active:bg-[#005aa8] disabled:opacity-60"
            >
              {a.label}
            </button>
          ))}
          {reservation.guest_phone ? (
            <a
              href={`tel:${reservation.guest_phone}`}
              className="flex flex-1 items-center justify-center px-2 py-2.5 text-sm font-medium active:bg-[#005aa8]"
            >
              Contattare
            </a>
          ) : (
            <span className="flex flex-1 items-center justify-center px-2 py-2.5 text-sm font-medium opacity-50">
              Contattare
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="flex-1 px-2 py-2.5 text-sm font-medium active:bg-[#005aa8]"
          >
            Dettagli
          </button>
        </div>
      )}

      {showUnlock && (
        <UnlockDialog
          reservation={reservation}
          tableLabel={table?.label ?? "?"}
          pending={pending}
          onCancel={() => setShowUnlock(false)}
          onUnlock={() =>
            run(
              () => updateReservationLock(reservation.id, false),
              () => setShowUnlock(false),
            )
          }
          timezone={timezone}
        />
      )}

      {showMap && (
        <TableMapDialog
          reservation={reservation}
          tables={tables}
          sections={sections}
          dayReservations={dayReservations}
          pending={pending}
          onCancel={() => setShowMap(false)}
          onSeat={(tableId) =>
            run(
              async () => {
                if (tableId !== reservation.table_id) {
                  const r = await updateReservationTable(reservation.id, tableId);
                  if (r.error) return r;
                }
                if (
                  RESERVATION_TRANSITIONS[reservation.status].includes("seated")
                ) {
                  return updateReservationStatus(
                    reservation.id,
                    reservation.status,
                    "seated",
                  );
                }
                return {};
              },
              () => setShowMap(false),
            )
          }
        />
      )}

      {showDetails && (
        <DetailsDialog
          reservation={reservation}
          table={table}
          timezone={timezone}
          pending={pending}
          onClose={() => setShowDetails(false)}
          onTransition={(to) => transitionTo(to)}
        />
      )}
    </li>
  );
}

// ------------------------------------------------------------ dialogs

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-white p-4 shadow-xl dark:bg-zinc-950 sm:rounded">
        {children}
      </div>
    </div>
  );
}

function MiniCard({
  reservation,
  timezone,
  tableLabel,
}: {
  reservation: Reservation;
  timezone: string;
  tableLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{reservation.guest_name}</p>
        <p className="text-sm text-zinc-500">
          {localTimeHM(reservation.starts_at, timezone)} ·{" "}
          {reservation.party_size} pax
        </p>
      </div>
      <span className="flex h-10 w-16 items-center justify-center gap-1 rounded border border-zinc-300 text-sm font-medium dark:border-zinc-700">
        <LockIcon />
        {tableLabel}
      </span>
    </div>
  );
}

function UnlockDialog({
  reservation,
  tableLabel,
  timezone,
  pending,
  onCancel,
  onUnlock,
}: {
  reservation: Reservation;
  tableLabel: string;
  timezone: string;
  pending: boolean;
  onCancel: () => void;
  onUnlock: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Non spostare</p>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-lg leading-none dark:border-zinc-700"
          >
            ×
          </button>
        </div>
        <MiniCard
          reservation={reservation}
          timezone={timezone}
          tableLabel={tableLabel}
        />
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-[#0067c0] px-4 py-3 text-sm font-medium text-white"
        >
          Annulla
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onUnlock}
          className="py-1 text-center text-sm font-medium text-zinc-700 disabled:opacity-50 dark:text-zinc-300"
        >
          Sbloccare
        </button>
      </div>
    </Overlay>
  );
}

function TableMapDialog({
  reservation,
  tables,
  sections,
  dayReservations,
  pending,
  onCancel,
  onSeat,
}: {
  reservation: Reservation;
  tables: DiningTable[];
  sections: DiningSection[];
  dayReservations: Reservation[];
  pending: boolean;
  onCancel: () => void;
  onSeat: (tableId: string | null) => void;
}) {
  const [tableId, setTableId] = useState<string | null>(reservation.table_id);

  // Tables taken by other active reservations overlapping this one.
  const start = new Date(reservation.starts_at).getTime();
  const end = new Date(reservation.ends_at).getTime();
  const occupied = new Set<string>();
  for (const r of dayReservations) {
    if (r.id === reservation.id || !r.table_id) continue;
    if (["cancelled", "no_show", "completed"].includes(r.status)) continue;
    if (new Date(r.starts_at).getTime() < end && new Date(r.ends_at).getTime() > start) {
      occupied.add(r.table_id);
    }
  }

  const rooms: { id: string | null; name: string }[] = [
    ...sections.map((s) => ({ id: s.id as string | null, name: s.name })),
    ...(tables.some((t) => !t.section_id) ? [{ id: null, name: "Senza sala" }] : []),
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
  const roomTables = tables.filter(
    (t) => t.is_active && (t.section_id ?? null) === (room?.id ?? null),
  );

  return (
    <Overlay onClose={onCancel}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">
            Tavolo per {reservation.guest_name}
          </p>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-lg leading-none dark:border-zinc-700"
          >
            ×
          </button>
        </div>

        <div className="relative min-h-56 rounded bg-slate-700 p-4">
          {roomTables.length === 0 ? (
            <p className="text-sm text-slate-300">Nessun tavolo in questa sala.</p>
          ) : (
            <div className="flex flex-wrap content-start gap-3 pb-10">
              {roomTables.map((t) => {
                const busy = occupied.has(t.id);
                const isSel = tableId === t.id;
                const size =
                  t.capacity <= 2
                    ? "h-11 w-11"
                    : t.capacity <= 4
                      ? "h-[3.25rem] w-[3.25rem]"
                      : "h-14 w-14";
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

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onSeat(tableId)}
            className="rounded bg-[#107c10] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            Seduto
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-zinc-300 px-4 py-3 text-sm font-medium dark:border-zinc-700"
          >
            Annulla
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function DetailsDialog({
  reservation,
  table,
  timezone,
  pending,
  onClose,
  onTransition,
}: {
  reservation: Reservation;
  table: DiningTable | null;
  timezone: string;
  pending: boolean;
  onClose: () => void;
  onTransition: (to: ReservationStatus) => void;
}) {
  const durationMin = Math.round(
    (new Date(reservation.ends_at).getTime() -
      new Date(reservation.starts_at).getTime()) /
      60_000,
  );

  const profileHref = `/admin/clients/profile?${new URLSearchParams({
    name: reservation.guest_name,
    ...(reservation.guest_phone ? { phone: reservation.guest_phone } : {}),
    ...(reservation.guest_email ? { email: reservation.guest_email } : {}),
  }).toString()}`;

  const cell =
    "rounded border border-zinc-200 p-2 dark:border-zinc-800";

  const extras: [string, string][] = [];
  if (reservation.high_chairs > 0) extras.push(["Seggioloni", String(reservation.high_chairs)]);
  if (reservation.strollers > 0) extras.push(["Passeggini", String(reservation.strollers)]);
  if (reservation.allergies) extras.push(["Allergie", reservation.allergies]);
  if (reservation.special_occasion) extras.push(["Occasione", reservation.special_occasion]);
  if (reservation.accessible_table) extras.push(["Tavolo accessibile", "Sì"]);
  if (reservation.channel) extras.push(["Mezzo", CHANNEL_LABELS[reservation.channel] ?? reservation.channel]);

  return (
    <Overlay onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Dettagli prenotazione</p>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-lg leading-none dark:border-zinc-700"
          >
            ×
          </button>
        </div>

        <Link
          href={profileHref}
          className="text-base font-semibold text-[#0067c0] underline underline-offset-2 dark:text-[#479ef5]"
        >
          {reservation.guest_name}
        </Link>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className={cell}>
            <p className="text-xs text-zinc-500">Data e ora</p>
            <p className="font-medium">
              {formatDateTime(reservation.starts_at, timezone)}
            </p>
          </div>
          <div className={cell}>
            <p className="text-xs text-zinc-500">PAX</p>
            <p className="font-medium">{reservation.party_size}</p>
          </div>
          <div className={cell}>
            <p className="text-xs text-zinc-500">Tavolo</p>
            <p className="flex items-center gap-1 font-medium">
              {reservation.table_locked && <LockIcon />}
              {table ? table.label : "Senza tavolo"}
            </p>
          </div>
          <div className={cell}>
            <p className="text-xs text-zinc-500">Durata</p>
            <p className="font-medium">
              {Math.floor(durationMin / 60)}h
              {durationMin % 60 ? ` ${durationMin % 60}m` : ""}
            </p>
          </div>
          <div className={cell}>
            <p className="text-xs text-zinc-500">Stato</p>
            <p className="font-medium">
              {RESERVATION_STATUS_LABELS[reservation.status]}
            </p>
          </div>
          <div className={cell}>
            <p className="text-xs text-zinc-500">Fonte</p>
            <p className="font-medium">
              {SOURCE_LABELS[reservation.source] ?? reservation.source}
            </p>
          </div>
          {extras.map(([label, value]) => (
            <div key={label} className={cell}>
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="font-medium">{value}</p>
            </div>
          ))}
        </div>

        {(reservation.guest_phone || reservation.guest_email) && (
          <div className="flex flex-col gap-1 text-sm">
            {reservation.guest_phone && (
              <a
                href={`tel:${reservation.guest_phone}`}
                className="text-[#0067c0] dark:text-[#479ef5]"
              >
                {reservation.guest_phone}
              </a>
            )}
            {reservation.guest_email && (
              <p className="text-zinc-600 dark:text-zinc-400">
                {reservation.guest_email}
              </p>
            )}
          </div>
        )}

        {reservation.notes && (
          <p className="text-sm">
            <span className="text-xs text-zinc-500">Note private: </span>
            {reservation.notes}
          </p>
        )}
        {reservation.public_notes && (
          <p className="text-sm">
            <span className="text-xs text-zinc-500">Note pubbliche: </span>
            {reservation.public_notes}
          </p>
        )}

        {RESERVATION_TRANSITIONS[reservation.status].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {RESERVATION_TRANSITIONS[reservation.status].map((to) => (
              <button
                key={to}
                type="button"
                disabled={pending}
                onClick={() => onTransition(to)}
                className={`rounded px-3 py-2 text-sm disabled:opacity-50 ${
                  to === "cancelled" || to === "no_show"
                    ? "border border-red-300 text-red-600 dark:border-red-900 dark:text-red-400"
                    : "bg-[#0067c0] text-white"
                }`}
              >
                {RESERVATION_STATUS_LABELS[to]}
              </button>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}
