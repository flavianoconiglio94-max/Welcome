-- Defensive hardening, not a live fix: testing 0003_security_hardening.sql's
-- "revoke ... from public, anon" against a from-scratch local Postgres (no
-- Supabase default privileges configured) showed that if `authenticated`
-- only inherits EXECUTE through the PUBLIC grant, revoking from public would
-- also break every RLS policy that calls these helpers for logged-in users.
-- Verified via has_function_privilege() that this project's `authenticated`
-- role already has EXECUTE on all three (Supabase's project-level default
-- privileges grant it independently of PUBLIC), so there is no active bug —
-- this migration just makes the grant explicit instead of relying on that
-- default-privilege configuration surviving future project changes.
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_staff_restaurant_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
