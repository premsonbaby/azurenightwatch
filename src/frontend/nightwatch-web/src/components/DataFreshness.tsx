import { useState, useEffect, useCallback } from 'react';

function useRelativeTime(date: Date | null): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!date) return;
    const update = () => {
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (seconds < 10) setLabel('just now');
      else if (seconds < 60) setLabel(`${seconds}s ago`);
      else if (seconds < 3600) setLabel(`${Math.floor(seconds / 60)}m ago`);
      else setLabel(`${Math.floor(seconds / 3600)}h ago`);
    };
    update();
    const id = setInterval(update, 15_000);
    return () => clearInterval(id);
  }, [date]);

  return label;
}

interface DataFreshnessProps {
  /** Pass the last time data was fetched — typically as a dependency of the useEffect that loads data */
  fetchedAt: Date | null;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function DataFreshness({ fetchedAt, onRefresh, isLoading = false }: DataFreshnessProps) {
  const relativeTime = useRelativeTime(fetchedAt);

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      {fetchedAt && !isLoading && (
        <span title={fetchedAt.toLocaleString()}>Updated {relativeTime}</span>
      )}
      {isLoading && <span className="text-cyan-400">Refreshing…</span>}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        title="Refresh data"
        aria-label="Refresh"
        className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-1.5 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition disabled:opacity-40"
      >
        <svg
          className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      </button>
    </div>
  );
}

/** Hook that tracks when data was last loaded and provides a reload trigger */
export function useFreshness() {
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((v) => v + 1), []);
  const markFetched = useCallback(() => setFetchedAt(new Date()), []);

  return { fetchedAt, tick, refresh, markFetched };
}
