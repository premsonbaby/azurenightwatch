import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { nightWatchClient } from '../api/client';
import type { ResourceDeepDive } from '../types/dashboard';

interface ResourceDeepDivePageProps {
  refreshTick: number;
}

export function ResourceDeepDivePage({ refreshTick }: ResourceDeepDivePageProps) {
  const { search } = useLocation();
  const resourceId = new URLSearchParams(search).get('resourceId') ?? '';

  const [data, setData] = useState<ResourceDeepDive | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!resourceId) {
        setLoadError('resourceId query parameter is required.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await nightWatchClient.getResourceDeepDive(resourceId, refreshTick);
        setData(response);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load resource deep dive.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [refreshTick, resourceId]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) {
    return state;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">{data.resourceName}</h2>
        <p className="mt-2 text-sm text-slate-300">{data.resourceType}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3"><p className="text-xs text-slate-400">Health</p><p className="text-2xl font-black text-white">{data.healthScore.toFixed(1)}</p></div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3"><p className="text-xs text-slate-400">Risk</p><p className="text-2xl font-black text-white">{data.riskScore.toFixed(1)}</p></div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3"><p className="text-xs text-slate-400">Cost</p><p className="text-2xl font-black text-white">{data.costScore.toFixed(1)}</p></div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3"><p className="text-xs text-slate-400">Performance</p><p className="text-2xl font-black text-white">{data.performanceScore.toFixed(1)}</p></div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3"><p className="text-xs text-slate-400">Security</p><p className="text-2xl font-black text-white">{data.securityScore.toFixed(1)}</p></div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Historical Timeline</h3>
        <div className="space-y-2 text-sm text-slate-200">
          {data.changeTimeline.map((event, index) => (
            <div key={`${event.timestamp}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">
              <p className="font-semibold">{new Date(event.timestamp).toLocaleString()} · {event.category}</p>
              <p>{event.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
