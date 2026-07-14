import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getStaffProfile } from "@/lib/auth/session";
import { AdminNav } from "./AdminNav";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  const staff = await getStaffProfile();
  if (!staff) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Account non associato</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Il tuo account ({user.email}) non è collegato a nessun ristorante.
          Chiedi al gestore della piattaforma di invitarti come staff.
        </p>
        <a href="/platform" className="text-sm underline underline-offset-2">
          Sei l&apos;amministratore della piattaforma? Vai al pannello
        </a>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", staff.restaurant_id)
    .single<{ name: string }>();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminNav restaurantName={restaurant?.name ?? "Ristorante"} />
      {children}
    </div>
  );
}
