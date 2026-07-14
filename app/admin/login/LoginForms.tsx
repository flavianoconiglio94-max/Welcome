"use client";

import { useActionState, useState } from "react";
import {
  loginWithPassword,
  requestAdminMagicLink,
  requestPasswordReset,
  type LoginState,
} from "./actions";

const initialState: LoginState = {};

export function LoginForms({ initialError }: { initialError?: string }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    loginWithPassword,
    initialState,
  );
  const [linkState, linkAction, linkPending] = useActionState(
    requestAdminMagicLink,
    initialState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    initialState,
  );
  const [secondary, setSecondary] = useState<"none" | "magic" | "reset">("none");

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  if (linkState.sent || resetState.sent) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <h2 className="font-semibold">Controlla la tua email</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {resetState.sent
            ? "Ti abbiamo inviato un link per reimpostare la password."
            : "Ti abbiamo inviato un link di accesso."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={passwordAction} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="email@esempio.com"
          className={inputClass}
        />
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className={inputClass}
        />
        {(passwordState.error || initialError) && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {passwordState.error ?? initialError}
          </p>
        )}
        <button
          type="submit"
          disabled={passwordPending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {passwordPending ? "Accesso..." : "Accedi"}
        </button>
      </form>

      <div className="flex flex-col gap-2 text-center">
        <button
          type="button"
          onClick={() => setSecondary(secondary === "reset" ? "none" : "reset")}
          className="text-sm text-zinc-500 underline underline-offset-2"
        >
          Password dimenticata?
        </button>
        <button
          type="button"
          onClick={() => setSecondary(secondary === "magic" ? "none" : "magic")}
          className="text-sm text-zinc-500 underline underline-offset-2"
        >
          Oppure ricevi un link di accesso via email
        </button>
      </div>

      {secondary !== "none" && (
        <form
          action={secondary === "magic" ? linkAction : resetAction}
          className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        >
          <p className="text-sm font-medium">
            {secondary === "magic"
              ? "Link di accesso via email"
              : "Reimposta la password"}
          </p>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="email@esempio.com"
            className={inputClass}
          />
          {(secondary === "magic" ? linkState.error : resetState.error) && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {secondary === "magic" ? linkState.error : resetState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={secondary === "magic" ? linkPending : resetPending}
            className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            {secondary === "magic"
              ? linkPending
                ? "Invio..."
                : "Invia link di accesso"
              : resetPending
                ? "Invio..."
                : "Invia link di reset"}
          </button>
        </form>
      )}
    </div>
  );
}
