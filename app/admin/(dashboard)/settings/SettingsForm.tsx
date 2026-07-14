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
    max_covers_per_slot: number | null;
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
        Coperti massimi per fascia oraria
        <input
          type="number"
          name="maxCovers"
          min={1}
          placeholder="Vuoto = nessun limite"
          defaultValue={restaurant.max_covers_per_slot ?? ""}
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">
          Mostrato come &quot;prenotati / massimo&quot; nella scelta orario del
          form prenotazione.
        </span>
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
        <p className="text-sm text-[#107c10] dark:text-[#6ccb5f]">
          Impostazioni salvate.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-[#0067c0] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Salvataggio..." : "Salva"}
      </button>
    </form>
  );
}
