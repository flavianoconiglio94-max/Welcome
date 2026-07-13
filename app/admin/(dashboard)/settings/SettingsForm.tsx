"use client";

import { useActionState } from "react";
import { updateRestaurantSettings, type SettingsState } from "./actions";

const initialState: SettingsState = {};

export function SettingsForm({
  restaurant,
}: {
  restaurant: {
    name: string;
    phone: string | null;
    address: string | null;
    google_business_profile_url: string | null;
    facebook_page_url: string | null;
    instagram_handle: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateRestaurantSettings,
    initialState,
  );

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Nome commerciale
        <input name="name" required defaultValue={restaurant.name} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Telefono per prenotazioni
        <input type="tel" name="phone" defaultValue={restaurant.phone ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Indirizzo
        <input name="address" defaultValue={restaurant.address ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Link Google Business Profile
        <input
          type="url"
          name="gbp"
          placeholder="https://..."
          defaultValue={restaurant.google_business_profile_url ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Pagina Facebook
        <input
          type="url"
          name="facebook"
          placeholder="https://..."
          defaultValue={restaurant.facebook_page_url ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Instagram (handle)
        <input
          name="instagram"
          placeholder="@ristorante"
          defaultValue={restaurant.instagram_handle ?? ""}
          className={inputClass}
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state.saved && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Impostazioni salvate.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {pending ? "Salvataggio..." : "Salva"}
      </button>
    </form>
  );
}
