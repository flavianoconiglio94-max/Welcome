import { redirect } from "next/navigation";
import { getIsPlatformAdmin } from "@/lib/auth/session";

export default async function PlatformHomePage() {
  if (!(await getIsPlatformAdmin())) {
    redirect("/platform/login");
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Piattaforma</h1>
      <a
        href="/platform/restaurants/new"
        className="text-sm underline underline-offset-2"
      >
        Crea nuovo ristorante
      </a>
    </main>
  );
}
