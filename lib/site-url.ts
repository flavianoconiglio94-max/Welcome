import { headers } from "next/headers";

/**
 * Origin of the current request, derived from the forwarded headers Vercel
 * sets on every deployment. Used to build auth redirect links (magic link,
 * owner invite) so they always point back to the deployment that served the
 * request — production, preview or localhost — instead of depending on a
 * NEXT_PUBLIC_SITE_URL env var that is easy to leave stale.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto =
    headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
