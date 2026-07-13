"use client";

import { useActionState } from "react";
import { requestPlatformMagicLink, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function PlatformLoginPage() {
  const [state, formAction, pending] = useActionState(
    requestPlatformMagicLink,
    initialState,
  );

  if (state.sent) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-3 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Controlla la tua email</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ti abbiamo inviato un link di accesso.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-xl font-semibold">Accesso amministrazione piattaforma</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="email@esempio.com"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "Invio..." : "Invia link di accesso"}
        </button>
      </form>
    </main>
  );
}
