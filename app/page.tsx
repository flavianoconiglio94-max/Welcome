import { redirect } from "next/navigation";

// The root of the app is not a public page: guests book on /r/[slug]/book and
// staff work in /admin. Supabase's email-link fallback also dumps auth tokens
// here when its redirect allow-list doesn't match, so forward those to the
// verifier instead of losing them on a placeholder page.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const forward = new URLSearchParams();
  for (const key of ["code", "token_hash", "type", "next"]) {
    const value = params[key];
    if (typeof value === "string" && value) {
      forward.set(key, value);
    }
  }

  if (forward.has("code") || forward.has("token_hash")) {
    redirect(`/auth/confirm?${forward.toString()}`);
  }

  redirect("/admin/login");
}
