import { useEffect, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { useTenant } from '../context/TenantContext';
import type { HealthSnapshotHistory, MonthlyHealthSnapshot } from '../types/dashboard';

interface ScoreHistoryPageProps {
  refreshTick: number;
}

const SCORE_LINES = [
  { key: 'azureHealthScore',          label: 'Overall Health',  color: '#c0c0c0' },
  { key: 'securityPostureScore',       label: 'Security',        color: '#f43f5e' },
  { key: 'costEfficiencyScore',        label: 'Cost Efficiency', color: '#f59e0b' },
  { key: 'performanceScore',           label: 'Performance',     color: '#10b981' },
  { key: 'reliabilityScore',           label: 'Reliability',     color: '#888888' },
  { key: 'governanceComplianceScore',  label: 'Governance',      color: '#3a5870' },
] as const;

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-500 text-xs">—</span>;
  const isUp = value > 0;
  const isFlat = value === 0;
  const color = isFlat ? 'text-zinc-400' : isUp ? 'text-emerald-400' : 'text-rose-400';
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {isFlat ? '±0' : `${isUp ? '+' : ''}${value.toFixed(1)}`}
    </span>
  );
}

function scoreAnnotation(label: string, _score: number, delta: number | null): string | null {
  if (delta === null || Math.abs(delta) < 1) return null;
  const dir = delta > 0 ? 'improved' : 'declined';
  const amt = Math.abs(delta).toFixed(1);
  const tips: Record<string, { up: string; down: string }> = {
    Security: {
      up: `Security posture ${dir} by ${amt}pts — likely from resolved Defender alerts or improved MFA coverage.`,
      down: `Security declined ${amt}pts — check for new Defender recommendations, MFA gaps, or new privileged role assignments.`,
    },
    'Cost Efficiency': {
      up: `Cost efficiency ${dir} by ${amt}pts — Reserved Instances, orphan clean-up, or budget adherence improvements.`,
      down: `Cost declined ${amt}pts — review budget vs actual spend, new orphaned resources, or missing RI commitments.`,
    },
    Performance: {
      up: `Performance ${dir} by ${amt}pts — possibly from right-sizing, auto-scale tuning, or reduced high-CPU incidents.`,
      down: `Performance declined ${amt}pts — check for VMs at sustained high CPU, storage IOPS pressure, or slow database queries.`,
    },
    Reliability: {
      up: `Reliability ${dir} by ${amt}pts — backup coverage improved or availability zone adoption increased.`,
      down: `Reliability declined ${amt}pts — check backup coverage gaps, single-region deployments, or recent outage events.`,
    },
    Governance: {
      up: `Governance ${dir} by ${amt}pts — tagging compliance improved or new Azure Policy assignments are taking effect.`,
      down: `Governance declined ${amt}pts — check for non-compliant resources, missing tags, or new unmanaged subscriptions.`,
    },
    'Overall Health': {
      up: `Overall score ${dir} by ${amt}pts across all pillars.`,
      down: `Overall score declined ${amt}pts — review individual pillar scores below to identify the root cause.`,
    },
  };
  const entry = tips[label];
  if (!entry) return null;
  return delta > 0 ? entry.up : entry.down;
}

function ScoreCard({ snap }: { snap: MonthlyHealthSnapshot }) {
  const rows = [
    { label: 'Overall Health',  score: snap.azureHealthScore,         delta: snap.azureHealthDelta },
    { label: 'Security',        score: snap.securityPostureScore,      delta: snap.securityDelta },
    { label: 'Cost Efficiency', score: snap.costEfficiencyScore,       delta: snap.costDelta },
    { label: 'Performance',     score: snap.performanceScore,          delta: snap.performanceDelta },
    { label: 'Reliability',     score: snap.reliabilityScore,          delta: snap.reliabilityDelta },
    { label: 'Governance',      score: snap.governanceComplianceScore, delta: snap.governanceDelta },
  ];

  const notableChanges = rows.filter(r => r.delta !== null && Math.abs(r.delta) >= 3);

  const overallColor =
    snap.azureHealthScore >= 80 ? 'border-emerald-500/30 bg-emerald-500/8' :
    snap.azureHealthScore >= 60 ? 'border-amber-500/30 bg-amber-500/8' :
    'border-rose-500/30 bg-rose-500/8';

  return (
    <div className={`rounded-2xl border p-4 ${overallColor}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">{snap.monthLabel}</p>
      <p className="mt-1 text-3xl font-black text-white">{snap.azureHealthScore.toFixed(0)}</p>
      <p className="text-[11px] text-zinc-400">Overall Health Score</p>
      <div className="mt-3 space-y-1.5">
        {rows.slice(1).map(r => (
          <div key={r.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-400">{r.label}</span>
            <div className="flex items-center gap-2">
              <DeltaBadge value={r.delta ?? null} />
              <span className="w-8 text-right font-semibold text-zinc-200">{r.score.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
      {notableChanges.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
          {notableChanges.map(r => {
            const note = scoreAnnotation(r.label, r.score, r.delta);
            if (!note) return null;
            const isDown = (r.delta ?? 0) < 0;
            return (
              <p key={r.label} className={`text-[10px] leading-relaxed ${isDown ? 'text-rose-300/80' : 'text-emerald-300/80'}`}>
                {isDown ? '↓ ' : '↑ '}{note}
              </p>
            );
          })}
        </div>
      )}
      {snap.subscriptionCount > 0 && (
        <p className="mt-3 text-[10px] text-zinc-500">{snap.subscriptionCount} subscription{snap.subscriptionCount !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

export function ScoreHistoryPage({ refreshTick }: ScoreHistoryPageProps) {
  const { activeTenantName, isHomeTenant } = useTenant();
  const [data, setData] = useState<HealthSnapshotHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(prev => prev || data === null);
    setLoadError(null);
    nightWatchClient.getHealthSnapshotHistory(months, refreshTick)
      .then(res => { if (isMounted) { setData(res); setIsLoading(false); } })
      .catch(err => { if (isMounted) { setLoadError(err instanceof Error ? err.message : 'Unable to load score history.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [months, refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  const handleCapture = async () => {
    setIsCapturing(true);
    setCaptureMsg(null);
    try {
      await nightWatchClient.captureHealthSnapshot();
      setCaptureMsg('Snapshot captured. Refresh to see updated data.');
    } catch {
      setCaptureMsg('Capture failed.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Chart data — oldest first
  const chartData = [...data.months].reverse().map(m => ({
    month: m.monthLabel,
    overall: m.azureHealthScore,
    security: m.securityPostureScore,
    cost: m.costEfficiencyScore,
    performance: m.performanceScore,
    reliability: m.reliabilityScore,
    governance: m.governanceComplianceScore,
  }));

  const isEmpty = data.months.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-zinc-500 p-6 shadow-2xl">
        <PageBackButton />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-black text-white">Health Score History</h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            isHomeTenant
              ? 'border-white/30 bg-white/15 text-[#c0c0c0]'
              : 'border-white/30 bg-white/15 text-[#e0e0e0]'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isHomeTenant ? 'bg-red-500' : 'bg-[#c0c0c0]'}`} />
            {activeTenantName}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-300">
          Monthly health score trends across all six dimensions — security, cost, performance, reliability, governance, and overall health.
          Scores are captured automatically every 6 hours and updated in-month on each run.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {[3, 6, 12].map(n => (
              <button
                key={n}
                onClick={() => setMonths(n)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${months === n ? 'bg-[#c0c0c0] text-white' : 'border border-white/10 text-zinc-300 hover:border-white/30'}`}
              >
                {n}M
              </button>
            ))}
          </div>
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-xs font-semibold text-[#e0e0e0] transition hover:bg-white/30 disabled:opacity-50"
          >
            {isCapturing ? 'Capturing…' : 'Capture Now'}
          </button>
          {captureMsg && <p className="text-xs text-zinc-400">{captureMsg}</p>}
        </div>
      </section>

      {isEmpty ? (
        <section className="rounded-2xl border border-white/10 bg-zinc-500 p-8 text-center">
          <p className="text-2xl">📊</p>
          <p className="mt-3 text-base font-semibold text-zinc-200">No snapshots yet</p>
          <p className="mt-2 text-sm text-zinc-400">
            Snapshots are captured automatically every 6 hours. Use "Capture Now" to record the first one immediately.
          </p>
        </section>
      ) : (
        <>
          {/* Trend chart */}
          <section className="rounded-2xl border border-white/10 bg-zinc-500 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-200">Score Trends</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="month" tick={{ fill: '#5a5a5a', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#5a5a5a', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#242424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f0f0f0', fontSize: 12 }}
                    formatter={(v: unknown, name: unknown) => [`${(v as number).toFixed(1)}`, String(name)]}
                  />
                  <Legend formatter={v => <span className="text-xs text-zinc-300">{v}</span>} />
                  {SCORE_LINES.map(l => (
                    <Line
                      key={l.key}
                      type="monotone"
                      dataKey={l.key === 'azureHealthScore' ? 'overall' : l.key === 'securityPostureScore' ? 'security' : l.key === 'costEfficiencyScore' ? 'cost' : l.key === 'performanceScore' ? 'performance' : l.key === 'reliabilityScore' ? 'reliability' : 'governance'}
                      name={l.label}
                      stroke={l.color}
                      strokeWidth={l.key === 'azureHealthScore' ? 2.5 : 1.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Monthly cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {data.months.map((snap) => (
              <ScoreCard key={snap.snapshotMonth} snap={snap} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
