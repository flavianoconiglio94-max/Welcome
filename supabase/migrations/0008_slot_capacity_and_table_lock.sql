-- Wizard prenotazione (stile Restoo):
-- * max_covers_per_slot: PAX massimi accettati per singola fascia oraria,
--   mostrato come denominatore ("3/40") nello step orario. NULL = nessun
--   limite configurato.
-- * table_locked: la prenotazione deve restare sul tavolo assegnato; lo
--   spostamento richiede una conferma esplicita dell'operatore.

alter table public.restaurants
  add column if not exists max_covers_per_slot int
  check (max_covers_per_slot is null or max_covers_per_slot > 0);

alter table public.reservations
  add column if not exists table_locked boolean not null default false;
