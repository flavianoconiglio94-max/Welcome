"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CancelButton({
  reservationId,
  token,
}: {
  reservationId: string;
  token: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("cancel_reservation", {
      p_reservation_id: reservationId,
      p_cancellation_token: token,
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="self-start rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600 dark:border-red-400 dark:text-red-400"
      >
        Cancella prenotazione
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Confermi di voler cancellare la prenotazione?</p>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Cancellazione..." : "Sì, cancella"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
