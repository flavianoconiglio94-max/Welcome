-- Lets a guest look up their own reservation on the manage/cancel page using
-- the id + cancellation_token from their confirmation link. Anyone without a
-- valid token combination gets "not found" — no enumeration of other bookings.
create or replace function public.get_reservation_for_management(
  p_reservation_id uuid,
  p_cancellation_token uuid
) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_row public.reservations%rowtype;
begin
  select * into v_row from public.reservations
  where id = p_reservation_id and cancellation_token = p_cancellation_token;

  if not found then
    raise exception 'reservation not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.get_reservation_for_management(uuid, uuid) to anon, authenticated;
