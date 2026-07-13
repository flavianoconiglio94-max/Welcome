-- The guest CRM needs a display name to be usable as a "database clienti"
-- (search by name when creating a manual reservation, client list page).
-- guest_directory rows were previously matched only by email/phone.

alter table public.guest_directory add column if not exists guest_name text;

-- Backfill from the most recent reservation carrying the same contact.
update public.guest_directory gd
set guest_name = r.guest_name
from (
  select distinct on (restaurant_id, coalesce(guest_email, ''), coalesce(guest_phone, ''))
         restaurant_id, guest_email, guest_phone, guest_name
  from public.reservations
  order by restaurant_id, coalesce(guest_email, ''), coalesce(guest_phone, ''), created_at desc
) r
where gd.guest_name is null
  and gd.restaurant_id = r.restaurant_id
  and (
    (gd.guest_email is not null and gd.guest_email = r.guest_email)
    or (gd.guest_email is null and gd.guest_phone is not null and gd.guest_phone = r.guest_phone)
  );

-- Keep the name fresh: every booking updates it to the latest one used.
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

create or replace function public._upsert_guest_directory_named(
  p_restaurant_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_guest_email is not null then
    insert into public.guest_directory (restaurant_id, guest_name, guest_email, guest_phone)
    values (p_restaurant_id, p_guest_name, p_guest_email, p_guest_phone)
    on conflict (restaurant_id, guest_email) where guest_email is not null
      do update set
        guest_name = coalesce(excluded.guest_name, public.guest_directory.guest_name),
        guest_phone = coalesce(excluded.guest_phone, public.guest_directory.guest_phone);
  elsif p_guest_phone is not null then
    insert into public.guest_directory (restaurant_id, guest_name, guest_email, guest_phone)
    values (p_restaurant_id, p_guest_name, p_guest_email, p_guest_phone)
    on conflict (restaurant_id, guest_phone) where guest_phone is not null
      do update set
        guest_name = coalesce(excluded.guest_name, public.guest_directory.guest_name);
  end if;
end;
$$;

revoke execute on function public._upsert_guest_directory_named(uuid, text, text, text) from public, anon, authenticated;

-- Route the two reservation-creating RPCs through the named upsert.
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

  v_status := case when v_restaurant.requires_manual_confirmation
                   then 'unconfirmed' else 'confirmed' end;

  v_row := public._insert_reservation_autoassign(
    p_restaurant_id, p_starts_at, v_ends_at, p_party_size,
    btrim(p_guest_name), p_guest_email, p_guest_phone,
    v_status, 'web', p_notes
  );

  perform public._upsert_guest_directory_named(
    p_restaurant_id, btrim(p_guest_name), p_guest_email, p_guest_phone
  );

  return v_row;
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

  perform public._upsert_guest_directory_named(
    p_restaurant_id, p_guest_name, p_guest_email, p_guest_phone
  );

  return v_row;
end;
$$;
