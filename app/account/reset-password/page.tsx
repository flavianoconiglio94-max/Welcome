import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
  // The recovery link (/auth/confirm?type=recovery) has already set a session
  // by the time the user lands here; without one the link was invalid/expired.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login?error=auth");
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-xl font-semibold">Imposta una nuova password</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Account: {user.email}
      </p>
      <ResetPasswordForm />
    </main>
  );
}
