"use client";

import { useActionState, useState } from "react";
import {
  loginWithPassword,
  requestPlatformMagicLink,
  type LoginState,
} from "./actions";

const initialState: LoginState = {};

export function LoginForms({ initialError }: { initialError?: string }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    loginWithPassword,
    initialState,
  );
  const [linkState, linkAction, linkPending] = useActionState(
    requestPlatformMagicLink,
    initialState,
  );
  const [showMagicLink, setShowMagicLink] = useState(false);

  if (linkState.sent) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <h2 className="font-semibold">Controlla la tua email</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ti abbiamo inviato un link di accesso.
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
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {(passwordState.error || initialError) && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {passwordState.error ?? initialError}
          </p>
        )}
        <button
          type="submit"
          disabled={passwordPending}
          className="rounded bg-[#0067c0] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {passwordPending ? "Accesso..." : "Accedi"}
        </button>
      </form>

      {!showMagicLink ? (
        <button
          type="button"
          onClick={() => setShowMagicLink(true)}
          className="text-sm text-zinc-500 underline underline-offset-2"
        >
          Oppure ricevi un link di accesso via email
        </button>
      ) : (
        <form
          action={linkAction}
          className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        >
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="email@esempio.com"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {linkState.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {linkState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={linkPending}
            className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            {linkPending ? "Invio..." : "Invia link di accesso"}
          </button>
        </form>
      )}
    </div>
  );
}
