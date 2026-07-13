import { LoginForms } from "./LoginForms";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-xl font-semibold">Accesso staff ristorante</h1>
      <LoginForms
        initialError={
          error === "auth"
            ? "Il link di accesso non è valido o è scaduto. Accedi con la password o richiedi un nuovo link."
            : undefined
        }
      />
    </main>
  );
}
