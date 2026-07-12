-- Booking RPCs. Public booking pages never touch the tables directly — they call
-- these SECURITY DEFINER functions, which is also the layer designed to map 1:1
-- onto the Google Maps Booking API vocabulary (merchant/availability/booking) for
-- a future Reserve with Google adapter.
--
-- Two write paths with different trust levels:
--   * request_reservation — callable by anon (public booking page). Guests never
--     pick a table, a status or a source: the server re-validates opening hours,
--     lead time, horizon and party size, computes ends_at from the restaurant's
--     default duration, and auto-assigns a table.
--   * create_reservation — staff/platform-admin only. Full control (table,
--     status, source, custom duration) for the dashboard and TheFork imports.

-- ============================================================
-- AVAILABILITY
-- ============================================================
create or replace function public.get_availability(
  p_restaurant_id uuid,
  p_date date,
  p_party_size int
) returns table (slot_start timestamptz, slot_end timestamptz, tables_available int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_weekday text;
  v_range jsonb;
  v_duration interval;
  v_step interval;
  v_open timestamptz;
  v_close timestamptz;
begin
  select * into v_restaurant from public.restaurants
  where id = p_restaurant_id and is_active;

  if not found
     or p_party_size < v_restaurant.min_party_size
     or p_party_size > v_restaurant.max_party_size then
    return;
  end if;

  v_weekday := lower(to_char(p_date, 'Dy'));
  v_duration := make_interval(mins => v_restaurant.default_duration_minutes);
  v_step := make_interval(mins => v_restaurant.slot_interval_minutes);

  for v_range in
    select * from jsonb_array_elements(coalesce(v_restaurant.opening_hours -> v_weekday, '[]'::jsonb))
  loop
    v_open := (p_date + (v_range ->> 0)::time) at time zone v_restaurant.timezone;
    v_close := (p_date + (v_range ->> 1)::time) at time zone v_restaurant.timezone;

    return query
      select
        gs.slot_start,
        gs.slot_start + v_duration,
        (
          select count(*)::int
          from public.dining_tables dt
          where dt.restaurant_id = p_restaurant_id
            and dt.is_active
            and dt.capacity >= p_party_size
            and not exists (
              select 1 from public.reservations r
              where r.table_id = dt.id
                and r.status in ('confirmed', 'pending_seat', 'seated')
                and tstzrange(r.starts_at, r.ends_at) && tstzrange(gs.slot_start, gs.slot_start + v_duration)
            )
        )
      -- Last slot must END by closing time, so the series stops at close - duration.
      from generate_series(v_open, v_close - v_duration, v_step) as gs(slot_start)
      where gs.slot_start >= now() + make_interval(mins => v_restaurant.booking_lead_minutes)
        and gs.slot_start <= now() + make_interval(days => v_restaurant.booking_horizon_days);
  end loop;
end;
$$;

-- ============================================================
-- INTERNAL: table auto-assignment with insert + retry
-- ============================================================
-- Tries the smallest fitting free table first; if a concurrent booking grabs it
-- (exclusion constraint fires), moves on to the next candidate instead of
-- failing the whole call. Returns the inserted row.
-- If the restaurant has no active tables at all, capacity is not managed yet:
-- the reservation is inserted with table_id null (e.g. during onboarding).
-- If tables exist but none fits/is free, raises 'no_availability'.
create or replace function public._insert_reservation_autoassign(
  p_restaurant_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_party_size int,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_status text,
  p_source text,
  p_notes text
) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_table_id uuid;
  v_row public.reservations%rowtype;
begin
  if not exists (
    select 1 from public.dining_tables
    where restaurant_id = p_restaurant_id and is_active
  ) then
    insert into public.reservations (
      restaurant_id, table_id, guest_name, guest_email, guest_phone,
      party_size, starts_at, ends_at, status, source, notes
    ) values (
      p_restaurant_id, null, p_guest_name, p_guest_email, p_guest_phone,
      p_party_size, p_starts_at, p_ends_at, p_status, p_source, p_notes
    ) returning * into v_row;
    return v_row;
  end if;

  for v_table_id in
    select dt.id
    from public.dining_tables dt
    where dt.restaurant_id = p_restaurant_id
      and dt.is_active
      and dt.capacity >= p_party_size
      and not exists (
        select 1 from public.reservations r
        where r.table_id = dt.id
          and r.status in ('confirmed', 'pending_seat', 'seated')
          and tstzrange(r.starts_at, r.ends_at) && tstzrange(p_starts_at, p_ends_at)
      )
    order by dt.capacity asc
  loop
    begin
      insert into public.reservations (
        restaurant_id, table_id, guest_name, guest_email, guest_phone,
        party_size, starts_at, ends_at, status, source, notes
      ) values (
        p_restaurant_id, v_table_id, p_guest_name, p_guest_email, p_guest_phone,
        p_party_size, p_starts_at, p_ends_at, p_status, p_source, p_notes
      ) returning * into v_row;
      return v_row;
    exception when exclusion_violation then
      -- table was taken by a concurrent booking, try the next candidate
    end;
  end loop;

  raise exception 'no_availability' using hint = 'No table is free for this slot and party size.';
end;
$$;

-- ============================================================
-- INTERNAL: ensure a guest_directory row exists (visit_count starts at 0;
-- the reservations trigger bumps it when the guest actually shows up).
-- ============================================================
create or replace function public._upsert_guest_directory(
  p_restaurant_id uuid,
  p_guest_email text,
  p_guest_phone text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_guest_email is not null then
    insert into public.guest_directory (restaurant_id, guest_email, guest_phone)
    values (p_restaurant_id, p_guest_email, p_guest_phone)
    on conflict (restaurant_id, guest_email) where guest_email is not null
      do nothing;
  elsif p_guest_phone is not null then
    insert into public.guest_directory (restaurant_id, guest_email, guest_phone)
    values (p_restaurant_id, p_guest_email, p_guest_phone)
    on conflict (restaurant_id, guest_phone) where guest_phone is not null
      do nothing;
  end if;
end;
$$;

-- ============================================================
-- PUBLIC: guest booking (anon-callable, fully server-validated)
-- ============================================================
create or replace function public.request_reservation(
  p_restaurant_id uuid,
  p_starts_at timestamptz,
  p_party_size int,
  p_guest_name text,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_notes text default null
) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_ends_at timestamptz;
  v_local timestamp;
  v_weekday text;
  v_range jsonb;
  v_open time;
  v_close time;
  v_slot_ok boolean := false;
  v_status text;
  v_row public.reservations%rowtype;
begin
  select * into v_restaurant from public.restaurants
  where id = p_restaurant_id and is_active;

  if not found then
    raise exception 'restaurant not found or inactive';
  end if;

  if coalesce(btrim(p_guest_name), '') = '' then
    raise exception 'guest name is required';
  end if;

  -- A contact is required so the guest can receive the cancellation link.
  if p_guest_email is null and p_guest_phone is null then
    raise exception 'guest email or phone is required';
  end if;

  if p_party_size < v_restaurant.min_party_size
     or p_party_size > v_restaurant.max_party_size then
    raise exception 'party size out of range (% - %)',
      v_restaurant.min_party_size, v_restaurant.max_party_size;
  end if;

  if p_starts_at < now() + make_interval(mins => v_restaurant.booking_lead_minutes) then
    raise exception 'reservation is too soon (minimum lead time: % minutes)',
      v_restaurant.booking_lead_minutes;
  end if;

  if p_starts_at > now() + make_interval(days => v_restaurant.booking_horizon_days) then
    raise exception 'reservation is too far in the future (maximum: % days)',
      v_restaurant.booking_horizon_days;
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_restaurant.default_duration_minutes);

  -- Re-validate against opening hours: the requested time must be a valid slot
  -- (aligned to slot_interval, fully inside an open range) in the restaurant's
  -- local timezone. Never trust the client's slot computation.
  v_local := p_starts_at at time zone v_restaurant.timezone;
  v_weekday := lower(to_char(v_local::date, 'Dy'));

  for v_range in
    select * from jsonb_array_elements(coalesce(v_restaurant.opening_hours -> v_weekday, '[]'::jsonb))
  loop
    v_open := (v_range ->> 0)::time;
    v_close := (v_range ->> 1)::time;

    if v_local::time >= v_open
       and v_local::time + make_interval(mins => v_restaurant.default_duration_minutes) <= v_close
       and (extract(epoch from (v_local::time - v_open))::int
            % (v_restaurant.slot_interval_minutes * 60)) = 0 then
      v_slot_ok := true;
      exit;
    end if;
  end loop;

  if not v_slot_ok then
    raise exception 'requested time is outside opening hours or not a valid slot';
  end if;

  -- Guests never choose status: it follows the restaurant's confirmation policy.
  v_status := case when v_restaurant.requires_manual_confirmation
                   then 'unconfirmed' else 'confirmed' end;

  v_row := public._insert_reservation_autoassign(
    p_restaurant_id, p_starts_at, v_ends_at, p_party_size,
    btrim(p_guest_name), p_guest_email, p_guest_phone,
    v_status, 'web', p_notes
  );

  perform public._upsert_guest_directory(p_restaurant_id, p_guest_email, p_guest_phone);

  return v_row;
end;
$$;

-- ============================================================
-- STAFF/ADMIN: full-control reservation creation
-- ============================================================
create or replace function public.create_reservation(
  p_restaurant_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_party_size int,
  p_guest_name text,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_source text default 'admin',
  p_table_id uuid default null,
  p_status text default null,
  p_notes text default null
) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_status text;
  v_row public.reservations%rowtype;
begin
  if not (public.is_platform_admin()
          or public.current_staff_restaurant_id() = p_restaurant_id) then
    raise exception 'not authorized to create reservations for this restaurant';
  end if;

  select * into v_restaurant from public.restaurants
  where id = p_restaurant_id and is_active;

  if not found then
    raise exception 'restaurant not found or inactive';
  end if;

  v_status := coalesce(
    p_status,
    case when v_restaurant.requires_manual_confirmation then 'unconfirmed' else 'confirmed' end
  );

  if p_table_id is not null then
    if not exists (
      select 1 from public.dining_tables
      where id = p_table_id and restaurant_id = p_restaurant_id
        and is_active and capacity >= p_party_size
    ) then
      raise exception 'invalid table for this restaurant or insufficient capacity';
    end if;

    insert into public.reservations (
      restaurant_id, table_id, guest_name, guest_email, guest_phone,
      party_size, starts_at, ends_at, status, source, notes
    ) values (
      p_restaurant_id, p_table_id, p_guest_name, p_guest_email, p_guest_phone,
      p_party_size, p_starts_at, p_ends_at, v_status, p_source, p_notes
    ) returning * into v_row;
  else
    v_row := public._insert_reservation_autoassign(
      p_restaurant_id, p_starts_at, p_ends_at, p_party_size,
      p_guest_name, p_guest_email, p_guest_phone,
      v_status, p_source, p_notes
    );
  end if;

  perform public._upsert_guest_directory(p_restaurant_id, p_guest_email, p_guest_phone);

  return v_row;
end;
$$;

-- ============================================================
-- CANCELLATION (guest via token, staff/admin via session)
-- ============================================================
create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_cancellation_token uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_authorized boolean;
  v_status text;
begin
  select
    (p_cancellation_token is not null and cancellation_token = p_cancellation_token)
    or restaurant_id = public.current_staff_restaurant_id()
    or public.is_platform_admin(),
    status
  into v_authorized, v_status
  from public.reservations
  where id = p_reservation_id;

  if not found then
    raise exception 'reservation not found';
  end if;

  if not v_authorized then
    raise exception 'not authorized to cancel this reservation';
  end if;

  if v_status in ('completed', 'cancelled', 'no_show') then
    raise exception 'reservation is already in a final state (%)', v_status;
  end if;

  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id;
end;
$$;

-- ============================================================
-- GRANTS
-- ============================================================
-- Functions are executable by public by default: revoke on the sensitive ones,
-- then grant only what each role needs. The internal helpers and the staff
-- function are never callable by anon.
revoke execute on function public._insert_reservation_autoassign(uuid, timestamptz, timestamptz, int, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public._upsert_guest_directory(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_reservation(uuid, timestamptz, timestamptz, int, text, text, text, text, uuid, text, text) from public, anon;

grant execute on function public.get_availability(uuid, date, int) to anon, authenticated;
grant execute on function public.request_reservation(uuid, timestamptz, int, text, text, text, text) to anon, authenticated;
grant execute on function public.cancel_reservation(uuid, uuid) to anon, authenticated;
grant execute on function public.create_reservation(uuid, timestamptz, timestamptz, int, text, text, text, text, uuid, text, text) to authenticated;
