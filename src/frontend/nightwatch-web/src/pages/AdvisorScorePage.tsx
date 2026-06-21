import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { AdvisorScoreDashboard } from '../types/dashboard';

interface AdvisorScorePageProps { refreshTick: number; }

const CATEGORY_COLORS: Record<string, string> = {
  Cost: '#10b981',
  Security: '#f43f5e',
  Reliability: '#06b6d4',
  OperationalExcellence: '#8b5cf6',
  Performance: '#f59e0b',
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function scoreRing(score: number) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e';
  return { circumference, offset, color };
}

export function AdvisorScorePage({ refreshTick }: AdvisorScorePageProps) {
  const [data, setData] = useState<AdvisorScoreDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getAdvisorScoreDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const ring = scoreRing(data.overallScore);
  const chartData = data.categoryScores.map((c) => ({
    name: c.category.replace('OperationalExcellence', 'Ops Excellence'),
    score: Math.round(c.score),
    potential: c.potentialScoreIncrease,
    color: CATEGORY_COLORS[c.category] ?? '#64748b',
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Azure Advisor Score</h2>
        <p className="mt-2 text-sm text-slate-300">Overall and per-category Advisor scores with potential improvement opportunities</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          Overall score {Math.round(data.overallScore)} · {data.categoryScores.length} categories analyzed
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 flex flex-col items-center justify-center lg:col-span-1">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="54" fill="none" stroke="#334155" strokeWidth="10" />
            <circle cx="70" cy="70" r="54" fill="none" stroke={ring.color} strokeWidth="10"
              strokeDasharray={ring.circumference} strokeDashoffset={ring.offset}
              strokeLinecap="round" transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            <text x="70" y="68" textAnchor="middle" fill="white" fontSize="26" fontWeight="900">{Math.round(data.overallScore)}</text>
            <text x="70" y="86" textAnchor="middle" fill="#94a3b8" fontSize="10">/ 100</text>
          </svg>
          <p className={`mt-2 text-lg font-bold ${scoreColor(data.overallScore)}`}>
            {data.overallScore >= 80 ? 'Excellent' : data.overallScore >= 60 ? 'Good' : data.overallScore >= 40 ? 'Fair' : 'Poor'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Overall Advisor Score</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Score by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(val, name) => [name === 'score' ? `${val}` : `+${val}`, name === 'score' ? 'Score' : 'Potential Increase']} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {chartData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.categoryScores.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.categoryScores.map((cat) => (
            <div key={cat.category} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{cat.category.replace('OperationalExcellence', 'Ops Excellence')}</span>
                <span className={`text-xl font-black ${scoreColor(cat.score)}`}>{Math.round(cat.score)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-700">
                <div className="h-2 rounded-full transition-all" style={{ width: `${cat.score}%`, backgroundColor: CATEGORY_COLORS[cat.category] ?? '#64748b' }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>{cat.impactedResourceCount} impacted resources</span>
                {cat.potentialScoreIncrease > 0 && <span className="text-emerald-400">+{cat.potentialScoreIncrease} potential</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
