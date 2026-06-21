interface DashboardStateProps {
  isLoading: boolean;
  loadError: string | null;
  hasCoreData: boolean;
}

export function DashboardState({ isLoading, loadError, hasCoreData }: DashboardStateProps) {
  if (isLoading && !hasCoreData) {
    return (
      <div className="rounded-xl border border-white/15 bg-slate-900/70 p-6 text-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" aria-hidden="true" />
          <div className="space-y-2">
            <div className="h-2 w-28 animate-pulse rounded bg-cyan-200/20" />
            <div className="h-2 w-20 animate-pulse rounded bg-slate-200/20" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">Live Data Unavailable</p>
        <p className="mt-2 text-sm text-rose-50/90">{loadError}</p>
      </div>
    );
  }

  if (!hasCoreData) {
    return <div className="rounded-xl border border-white/15 bg-slate-900/70 p-6 text-slate-200">No telemetry returned from the API.</div>;
  }

  return null;
}