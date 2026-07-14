-- Optional reservation details (Restoo-style) and per-restaurant toggles
-- for which of them the staff wants to see in the wizard.

alter table public.reservations
  add column if not exists highlighted boolean not null default false,
  add column if not exists high_chairs integer not null default 0 check (high_chairs >= 0),
  add column if not exists strollers integer not null default 0 check (strollers >= 0),
  add column if not exists allergies text,
  add column if not exists special_occasion text,
  add column if not exists accessible_table boolean not null default false,
  add column if not exists public_notes text,
  add column if not exists channel text;

alter table public.restaurants
  add column if not exists detail_options jsonb not null default
    '{"high_chairs": true, "strollers": true, "allergies": true, "special_occasion": true, "accessible_table": true, "public_notes": true}'::jsonb;
