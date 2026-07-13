-- Public lookup used by the guest booking page (app/(public)/r/[restaurantSlug]/book).
-- Exposes only the columns the booking UI needs, never the raw restaurants row
-- (which also holds requires_manual_confirmation, opening_hours, etc.).
create or replace function public.get_restaurant_public(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  timezone text,
  phone text,
  address text,
  google_business_profile_url text,
  facebook_page_url text,
  instagram_handle text,
  slot_interval_minutes int,
  default_duration_minutes int,
  min_party_size int,
  max_party_size int,
  booking_lead_minutes int,
  booking_horizon_days int
)
language sql stable security definer set search_path = public as $$
  select
    id, slug, name, timezone, phone, address,
    google_business_profile_url, facebook_page_url, instagram_handle,
    slot_interval_minutes, default_duration_minutes, min_party_size, max_party_size,
    booking_lead_minutes, booking_horizon_days
  from public.restaurants
  where slug = p_slug and is_active;
$$;

grant execute on function public.get_restaurant_public(text) to anon, authenticated;
