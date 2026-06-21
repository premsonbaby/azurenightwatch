import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { useNightWatchDashboardData } from '../hooks/useNightWatchDashboardData';

interface IntelligenceDashboardPageProps {
  refreshTick: number;
}

export function IntelligenceDashboardPage({ refreshTick }: IntelligenceDashboardPageProps) {
  const { smart, isLoading, loadError, hasCoreData } = useNightWatchDashboardData(refreshTick, 'intelligence');
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !hasCoreData || !smart) {
    return state;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Correlation, technical debt, and relationship intelligence</h2>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">What Changed?</h3>
          <div className="space-y-2">
            {smart.whatChanged.map((event, index) => (
              <div key={`${event}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm text-cyan-50">{event}</div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Technical Debt</p>
              <p className="mt-2 text-2xl font-black text-white">{smart.technicalDebtScore}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Noise Reduced</p>
              <p className="mt-2 text-2xl font-black text-white">{smart.suppressedAlerts}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Maturity</p>
              <p className="mt-2 text-lg font-black text-white">{smart.environmentMaturityScore}</p>
            </div>
          </div>
        </section>

        <RelationshipGraph nodes={smart.relationshipNodes} edges={smart.relationshipEdges} title="Relationship Graph" />
      </section>

      {smart.operationalTimeline && smart.operationalTimeline.length > 0 && (
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Operational Timeline</h3>
          <div className="relative ml-4 space-y-0">
            {smart.operationalTimeline.map((event, idx) => {
              const impactColor = event.impact === 'Critical' ? 'border-red-500 bg-red-500' :
                event.impact === 'High' ? 'border-orange-500 bg-orange-500' :
                event.impact === 'Medium' ? 'border-yellow-500 bg-yellow-500' : 'border-blue-500 bg-blue-500';
              const bgColor = event.impact === 'Critical' ? 'border-red-500/30 bg-red-500/5' :
                event.impact === 'High' ? 'border-orange-500/30 bg-orange-500/5' :
                event.impact === 'Medium' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-blue-500/30 bg-blue-500/5';
              return (
                <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`z-10 mt-1 h-3 w-3 rounded-full border-2 ${impactColor}`} />
                    {idx < smart.operationalTimeline.length - 1 && <div className="mt-1 w-px flex-1 bg-white/10" />}
                  </div>
                  <article className={`flex-1 rounded-lg border p-3 text-sm ${bgColor}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{event.category}</span>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs text-slate-400">{event.changeType}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="font-medium text-white">{event.resourceName}</p>
                    <p className="mt-1 text-xs text-slate-300">{event.description}</p>
                  </article>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}