import { redirect } from "next/navigation";
import { getIsPlatformAdmin } from "@/lib/auth/session";
import { NewRestaurantForm } from "./NewRestaurantForm";

export default async function NewRestaurantPage() {
  if (!(await getIsPlatformAdmin())) {
    redirect("/platform/login");
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Nuovo ristorante
      </h1>
      <NewRestaurantForm />
    </main>
  );
}
