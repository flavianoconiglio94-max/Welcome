export default function DashboardLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-9 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="ml-auto h-9 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </main>
  );
}
