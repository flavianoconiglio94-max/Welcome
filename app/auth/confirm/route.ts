import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Token-hash verification endpoint for emailed links (magic link, password
// recovery, invites). The email templates in Supabase link straight here with
// the production domain hardcoded, so — unlike the default ConfirmationURL
// flow — nothing depends on the project's Site URL or redirect allow-list:
// the app verifies the token itself and sets the session cookies.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Same-site paths only, so the link can't become an open redirect.
  const rawNext = searchParams.get("next");
  const explicitNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const defaultNext = type === "recovery" ? "/account/reset-password" : "/admin";
  const next = explicitNext ?? defaultNext;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    // Default-template flow: GoTrue's /verify already validated the email
    // token and redirected here with a PKCE code to exchange. When the link
    // fell back to the Site URL, the code arrives with no next/type context:
    // a recent recovery_sent_at on the user tells us it was a password reset.
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let target = next;
      if (!explicitNext && !type) {
        const sentAt = data.session?.user?.recovery_sent_at;
        if (sentAt && Date.now() - new Date(sentAt).getTime() < 15 * 60_000) {
          target = "/account/reset-password";
        }
      }
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  const fallbackLogin = next.startsWith("/platform")
    ? "/platform/login"
    : "/admin/login";
  return NextResponse.redirect(`${origin}${fallbackLogin}?error=auth`);
}
