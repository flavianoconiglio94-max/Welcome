"use client";

import { useActionState } from "react";
import { updatePassword, type ResetState } from "./actions";

const initialState: ResetState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="password"
        name="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Nuova password (min. 8 caratteri)"
        className={inputClass}
      />
      <input
        type="password"
        name="confirm"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Ripeti la nuova password"
        className={inputClass}
      />
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {pending ? "Salvataggio..." : "Salva nuova password"}
      </button>
    </form>
  );
}
