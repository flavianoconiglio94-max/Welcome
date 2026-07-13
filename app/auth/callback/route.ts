import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared magic-link callback for /admin/login and /platform/login. The
// "next" query param (set by each login form's emailRedirectTo) decides
// where to land after exchanging the code, and where to bounce back to on
// failure so the user can retry from the right login page.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only same-site paths: a "/" prefix without "//" rules out absolute and
  // protocol-relative URLs, so the link can't be turned into an open redirect.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const fallbackLogin = next.startsWith("/admin") ? "/admin/login" : "/platform/login";
  return NextResponse.redirect(`${origin}${fallbackLogin}?error=auth`);
}
