-- Address Supabase security advisor findings:
-- 1. Trigger functions must not be callable via the REST RPC endpoint.
-- 2. set_updated_at had a mutable search_path.
-- The anon-executable warnings on get_availability / request_reservation /
-- cancel_reservation are intentional: they ARE the public booking API.

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.bump_guest_visit_count() from public, anon, authenticated;
revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.current_staff_restaurant_id() from public, anon;
revoke execute on function public.current_staff_role() from public, anon;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
