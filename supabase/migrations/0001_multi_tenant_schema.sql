-- Restaurant CRM: multi-tenant schema, RLS helpers and policies.
-- No customer accounts: bookings are always guest checkout (see reservations table).

create extension if not exists "btree_gist";
create extension if not exists "pgcrypto";

-- ============================================================
-- TENANTS
-- ============================================================
create table public.restaurants (
  id                           uuid primary key default gen_random_uuid(),
  slug                         text unique not null,
  name                         text not null,
  timezone                     text not null default 'Europe/Rome',
  phone                        text,
  address                      text,
  -- weekday keys "mon".."sun", each an array of [start,end] "HH:MM" ranges, e.g.
  -- {"fri": [["12:30","15:00"],["19:30","23:00"]]}. Empty/absent key = closed.
  opening_hours                jsonb not null default '{}'::jsonb,
  google_business_profile_url text,
  facebook_page_url            text,
  instagram_handle             text,
  slot_interval_minutes        int not null default 30,
  default_duration_minutes     int not null default 90,
  min_party_size               int not null default 1,
  max_party_size               int not null default 12,
  booking_lead_minutes         int not null default 60,
  booking_horizon_days         int not null default 60,
  requires_manual_confirmation boolean not null default false,
  is_active                    boolean not null default true,
  created_at                   timestamptz not null default now()
);

-- ============================================================
-- IDENTITY (no customer accounts)
-- ============================================================
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.staff_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role          text not null check (role in ('owner', 'manager', 'staff')),
  display_name  text,
  created_at    timestamptz not null default now()
);
create index staff_profiles_restaurant_id_idx on public.staff_profiles (restaurant_id);

-- ============================================================
-- FLOOR PLAN (sections + tables, no graphical editor in v1)
-- ============================================================
create table public.dining_sections (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  sort_order    int not null default 0
);
create index dining_sections_restaurant_id_idx on public.dining_sections (restaurant_id);

create table public.dining_tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  section_id    uuid references public.dining_sections(id) on delete set null,
  label         text not null,
  capacity      int not null check (capacity > 0),
  max_capacity  int,
  is_active     boolean not null default true
);
create index dining_tables_restaurant_id_idx on public.dining_tables (restaurant_id);

-- ============================================================
-- RESERVATIONS (always guest checkout, no auth.users link)
-- ============================================================
create table public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  table_id            uuid references public.dining_tables(id),
  guest_name          text not null,
  guest_email         text,
  guest_phone         text,
  party_size          int not null check (party_size > 0),
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  status              text not null default 'unconfirmed'
                        check (status in (
                          'unconfirmed', 'pending_seat', 'confirmed',
                          'seated', 'completed', 'cancelled', 'no_show'
                        )),
  source              text not null default 'web'
                        check (source in ('web', 'google', 'facebook', 'admin', 'thefork_import')),
  external_booking_id text,
  cancellation_token  uuid not null default gen_random_uuid(),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint valid_range check (ends_at > starts_at),

  -- Prevents double-booking a table while it's in an active state. NULL table_id
  -- rows (not yet assigned, e.g. TheFork imports) are ignored by the constraint,
  -- which is exactly the desired behavior.
  exclude using gist (
    restaurant_id with =,
    table_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('confirmed', 'pending_seat', 'seated'))
);
create index reservations_restaurant_starts_at_idx on public.reservations (restaurant_id, starts_at);
create index reservations_cancellation_token_idx on public.reservations (cancellation_token);

-- ============================================================
-- MINIMAL GUEST CRM (no login — matched by contact info per restaurant)
-- ============================================================
create table public.guest_directory (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  guest_email   text,
  guest_phone   text,
  notes         text,
  tags          text[] not null default '{}',
  visit_count   int not null default 0,
  created_at    timestamptz not null default now(),
  constraint guest_directory_has_contact check (guest_email is not null or guest_phone is not null)
);
create unique index guest_directory_restaurant_email_idx
  on public.guest_directory (restaurant_id, guest_email) where guest_email is not null;
create unique index guest_directory_restaurant_phone_idx
  on public.guest_directory (restaurant_id, guest_phone) where guest_phone is not null;

-- ============================================================
-- TheFork PDF import audit trail
-- ============================================================
create table public.reservation_imports (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  uploaded_by      uuid references auth.users(id),
  file_name        text,
  declared_date    date,
  declared_service text,
  imported_count   int not null default 0,
  skipped_count    int not null default 0,
  created_at       timestamptz not null default now()
);
create index reservation_imports_restaurant_id_idx on public.reservation_imports (restaurant_id);

-- ============================================================
-- RLS HELPERS
-- ============================================================
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.current_staff_restaurant_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select restaurant_id from public.staff_profiles where user_id = auth.uid();
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table public.restaurants enable row level security;
alter table public.dining_sections enable row level security;
alter table public.dining_tables enable row level security;
alter table public.reservations enable row level security;
alter table public.guest_directory enable row level security;
alter table public.reservation_imports enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.platform_admins enable row level security;

create policy "platform admins manage restaurants" on public.restaurants
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "staff read own restaurant" on public.restaurants
  for select using (id = public.current_staff_restaurant_id());
create policy "staff update own restaurant settings" on public.restaurants
  for update using (id = public.current_staff_restaurant_id())
  with check (id = public.current_staff_restaurant_id());

create policy "platform admins manage sections" on public.dining_sections
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "staff manage own sections" on public.dining_sections
  for all using (restaurant_id = public.current_staff_restaurant_id())
  with check (restaurant_id = public.current_staff_restaurant_id());

create policy "platform admins manage tables" on public.dining_tables
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "staff manage own tables" on public.dining_tables
  for all using (restaurant_id = public.current_staff_restaurant_id())
  with check (restaurant_id = public.current_staff_restaurant_id());

create policy "platform admins manage reservations" on public.reservations
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "staff manage own reservations" on public.reservations
  for all using (restaurant_id = public.current_staff_restaurant_id())
  with check (restaurant_id = public.current_staff_restaurant_id());

create policy "platform admins manage guest directory" on public.guest_directory
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "staff manage own guest directory" on public.guest_directory
  for all using (restaurant_id = public.current_staff_restaurant_id())
  with check (restaurant_id = public.current_staff_restaurant_id());

create policy "platform admins manage imports" on public.reservation_imports
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "staff manage own imports" on public.reservation_imports
  for all using (restaurant_id = public.current_staff_restaurant_id())
  with check (restaurant_id = public.current_staff_restaurant_id());

create policy "platform admins manage staff" on public.staff_profiles
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "staff read colleagues in same restaurant" on public.staff_profiles
  for select using (restaurant_id = public.current_staff_restaurant_id());

create policy "platform admins manage platform admins" on public.platform_admins
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "platform admins read own row" on public.platform_admins
  for select using (user_id = auth.uid());

-- Note: public booking pages never query these tables directly. All anonymous
-- access goes through the SECURITY DEFINER RPCs in 0002_booking_rpcs.sql.
