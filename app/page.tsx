export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Restaurant CRM</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Gestionale prenotazioni multi-ristorante. Ogni ristorante cliente ha
        la propria pagina di prenotazione pubblica su{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
          /r/[slug]/book
        </code>
        .
      </p>
    </main>
  );
}
