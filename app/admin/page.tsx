import { redirect } from "next/navigation";
import { getStaffProfile } from "@/lib/auth/session";

export default async function AdminHomePage() {
  const staff = await getStaffProfile();

  if (!staff) {
    redirect("/admin/login");
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Accesso come {staff.role}. La gestione prenotazioni arriva a breve.
      </p>
    </main>
  );
}
