-- Booking RPCs. Public booking pages never touch the tables directly — they call
-- these SECURITY DEFINER functions, which is also the layer designed to map 1:1
-- onto the Google Maps Booking API vocabulary (merchant/availability/booking) for
-- a future Reserve with Google adapter.

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
begin
  select * into v_restaurant from public.restaurants
  where id = p_restaurant_id and is_active;

  if not found then
    return;
  end if;

  v_weekday := lower(to_char(p_date, 'Dy'));
  v_duration := make_interval(mins => v_restaurant.default_duration_minutes);
  v_step := make_interval(mins => v_restaurant.slot_interval_minutes);

  for v_range in
    select * from jsonb_array_elements(coalesce(v_restaurant.opening_hours -> v_weekday, '[]'::jsonb))
  loop
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
      from generate_series(
        ((p_date + (v_range ->> 0)::time) at time zone v_restaurant.timezone),
        ((p_date + (v_range ->> 1)::time) at time zone v_restaurant.timezone),
        v_step
      ) as gs(slot_start)
      where gs.slot_start >= now() + make_interval(mins => v_restaurant.booking_lead_minutes)
        and gs.slot_start <= now() + make_interval(days => v_restaurant.booking_horizon_days);
  end loop;
end;
$$;

create or replace function public.create_reservation(
  p_restaurant_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_party_size int,
  p_guest_name text,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_source text default 'web',
  p_table_id uuid default null,
  p_status text default null
) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_table_id uuid;
  v_status text;
  v_row public.reservations%rowtype;
begin
  select * into v_restaurant from public.restaurants
  where id = p_restaurant_id and is_active;

  if not found then
    raise exception 'restaurant not found or inactive';
  end if;

  if p_table_id is not null then
    if not exists (
      select 1 from public.dining_tables
      where id = p_table_id and restaurant_id = p_restaurant_id
        and is_active and capacity >= p_party_size
    ) then
      raise exception 'invalid table for this restaurant or insufficient capacity';
    end if;
    v_table_id := p_table_id;
  else
    -- Auto-assign the smallest fitting free table. May stay null (e.g. manual
    -- entries or TheFork imports before the table is decided) — the exclusion
    -- constraint on reservations simply ignores null table_id rows.
    select dt.id into v_table_id
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
    limit 1;
  end if;

  v_status := coalesce(
    p_status,
    case when v_restaurant.requires_manual_confirmation then 'unconfirmed' else 'confirmed' end
  );

  insert into public.reservations (
    restaurant_id, table_id, guest_name, guest_email, guest_phone,
    party_size, starts_at, ends_at, status, source
  ) values (
    p_restaurant_id, v_table_id, p_guest_name, p_guest_email, p_guest_phone,
    p_party_size, p_starts_at, p_ends_at, v_status, p_source
  ) returning * into v_row;

  if p_guest_email is not null then
    insert into public.guest_directory (restaurant_id, guest_email, guest_phone, visit_count)
    values (p_restaurant_id, p_guest_email, p_guest_phone, 1)
    on conflict (restaurant_id, guest_email) where guest_email is not null
      do update set visit_count = public.guest_directory.visit_count + 1;
  elsif p_guest_phone is not null then
    insert into public.guest_directory (restaurant_id, guest_email, guest_phone, visit_count)
    values (p_restaurant_id, p_guest_email, p_guest_phone, 1)
    on conflict (restaurant_id, guest_phone) where guest_phone is not null
      do update set visit_count = public.guest_directory.visit_count + 1;
  end if;

  return v_row;
end;
$$;

create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_cancellation_token uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_authorized boolean;
begin
  select
    (p_cancellation_token is not null and cancellation_token = p_cancellation_token)
    or restaurant_id = public.current_staff_restaurant_id()
    or public.is_platform_admin()
  into v_authorized
  from public.reservations
  where id = p_reservation_id;

  if not found then
    raise exception 'reservation not found';
  end if;

  if not v_authorized then
    raise exception 'not authorized to cancel this reservation';
  end if;

  update public.reservations
  set status = 'cancelled', updated_at = now()
  where id = p_reservation_id;
end;
$$;

grant execute on function public.get_availability(uuid, date, int) to anon, authenticated;
grant execute on function public.create_reservation(uuid, timestamptz, timestamptz, int, text, text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.cancel_reservation(uuid, uuid) to anon, authenticated;
