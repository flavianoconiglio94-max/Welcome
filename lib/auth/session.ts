import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getIsPlatformAdmin() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return false;

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(data);
}

export async function getStaffProfile() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from("staff_profiles")
    .select("user_id, restaurant_id, role, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}
