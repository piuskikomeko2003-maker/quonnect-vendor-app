export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Loading Quonnect Vendor Portal...
        </p>
      </div>
    </div>
  );
}
