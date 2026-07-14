"use client";

import { useActionState } from "react";
import { createRestaurant, type NewRestaurantState } from "./actions";

const initialState: NewRestaurantState = {};

export function NewRestaurantForm() {
  const [state, formAction, pending] = useActionState(
    createRestaurant,
    initialState,
  );

  if (state.success) {
    return (
      <p className="text-sm text-[#107c10] dark:text-[#6ccb5f]">
        Ristorante creato e invito inviato al proprietario.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Nome ristorante
        <input
          name="name"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Slug (usato nell&apos;URL pubblico /r/slug/book)
        <input
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="es. trattoria-da-mario"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email del proprietario
        <input
          type="email"
          name="ownerEmail"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Fuso orario
        <input
          name="timezone"
          defaultValue="Europe/Rome"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-[#0067c0] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creazione..." : "Crea ristorante e invita proprietario"}
      </button>
    </form>
  );
}
