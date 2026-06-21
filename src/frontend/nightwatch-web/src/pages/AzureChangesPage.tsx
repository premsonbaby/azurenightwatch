import { useEffect, useMemo, useState } from 'react';
import { nightWatchClient } from '../api/client';
import type { ChangeEvent, ChangesDashboard } from '../types/dashboard';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { ChevronDown, ChevronRight, Clock, User, Monitor, Tag } from 'lucide-react';
import { PageBackButton } from '../components/PageBackButton';

interface AzureChangesPageProps {
  refreshTick: number;
}

const CHANGE_COLORS: Record<string, string> = {
  Create: '#10b981',
  Update: '#f59e0b',
  Delete: '#ef4444',
};

const TIME_RANGES = [
  { key: 'today', label: 'Today' },
  { key: '2days', label: 'Last 2 Days' },
  { key: '1week', label: 'Last 7 Days' },
] as const;

type TimeRange = typeof TIME_RANGES[number]['key'];

function ChangeBadge({ type }: { type: string }) {
  const color = CHANGE_COLORS[type] ?? '#94a3b8';
  return (
    <span
      className="inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {type}
    </span>
  );
}

function ChangeRow({ event }: { event: ChangeEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasProps = event.propertyChanges.length > 0;

  return (
    <div className="rounded-lg border border-white/8 bg-slate-900/60 overflow-hidden">
      <button
        type="button"
        onClick={() => hasProps && setExpanded((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasProps ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'}`}
      >
        <ChangeBadge type={event.changeType} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{event.resourceName}</p>
          <p className="text-[11px] text-slate-500 truncate">{event.resourceType} · {event.resourceGroup}</p>
        </div>

        <div className="hidden md:flex items-center gap-1 shrink-0 text-[11px] text-slate-400">
          <User size={11} className="text-slate-500" />
          <span className="max-w-[160px] truncate">{event.changedBy || '—'}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 shrink-0 text-[11px] text-slate-400">
          <Monitor size={11} className="text-slate-500" />
          <span>{event.clientType || '—'}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[11px] text-slate-400">
          <Clock size={11} className="text-slate-500" />
          <span>{new Date(event.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {hasProps && (
          <span className="shrink-0 text-slate-500">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </button>

      {expanded && hasProps && (
        <div className="border-t border-white/8 px-4 py-3 bg-slate-950/60">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Property Changes ({event.propertyChanges.length})
          </p>
          <div className="space-y-2">
            {event.propertyChanges.map((pc, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-2 rounded bg-white/5 px-3 py-2 text-xs">
                <span className="font-mono text-slate-400 truncate" title={pc.propertyPath}>
                  <Tag size={10} className="inline mr-1 text-slate-500" />{pc.propertyPath}
                </span>
                <span className="text-red-300/80 truncate font-mono" title={pc.oldValue ?? ''}>
                  {pc.oldValue ?? <span className="italic text-slate-600">null</span>}
                </span>
                <span className="text-emerald-300/80 truncate font-mono" title={pc.newValue ?? ''}>
                  {pc.newValue ?? <span className="italic text-slate-600">null</span>}
                </span>
              </div>
            ))}
          </div>
          {event.correlationId && (
            <p className="mt-2 text-[10px] text-slate-600 font-mono">Correlation: {event.correlationId}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AzureChangesPage({ refreshTick }: AzureChangesPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [data, setData] = useState<ChangesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('All');
  const [filterBy, setFilterBy] = useState<string>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    nightWatchClient.getChangesDashboard(timeRange, refreshTick)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [timeRange, refreshTick]);

  // Bar chart — activity by day
  const barData = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, { date: string; Create: number; Update: number; Delete: number }> = {};
    for (const c of data.changes) {
      const day = new Date(c.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!counts[day]) counts[day] = { date: day, Create: 0, Update: 0, Delete: 0 };
      counts[day][c.changeType as 'Create' | 'Update' | 'Delete']++;
    }
    return Object.values(counts).reverse();
  }, [data]);

  // Pie chart — by resource type
  const pieData = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    for (const c of data.changes) {
      counts[c.resourceType] = (counts[c.resourceType] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  const PIE_COLORS = ['#06b6d4','#f59e0b','#10b981','#f97316','#8b5cf6','#ec4899','#14b8a6','#ef4444'];

  // Filtered list
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.changes.filter((c) => {
      if (filterType !== 'All' && c.changeType !== filterType) return false;
      if (filterBy !== 'All' && c.changedBy !== filterBy) return false;
      if (search && !c.resourceName.toLowerCase().includes(search.toLowerCase()) &&
          !c.changedBy.toLowerCase().includes(search.toLowerCase()) &&
          !c.resourceType.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, filterType, filterBy, search]);

  const changedByOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.changes.map((c) => c.changedBy).filter(Boolean)));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-violet-950/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <PageBackButton />
            <h2 className="mt-1 text-2xl font-black text-white">Azure Change Activity</h2>
            <p className="mt-1 text-sm text-slate-400">Every create, update and delete across your Azure environment — who did it, when, and what changed.</p>
          </div>
          {/* Time range selector */}
          <div className="flex rounded-xl border border-white/10 bg-slate-900/70 p-1 gap-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setTimeRange(r.key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${timeRange === r.key ? 'bg-violet-500/30 text-violet-200' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Changes', value: data.totalCount, color: 'text-slate-100', border: 'border-white/10' },
              { label: 'Created', value: data.createCount, color: 'text-emerald-300', border: 'border-emerald-500/25' },
              { label: 'Updated', value: data.updateCount, color: 'text-amber-300', border: 'border-amber-500/25' },
              { label: 'Deleted', value: data.deleteCount, color: 'text-red-300', border: 'border-red-500/25' },
            ].map((k) => (
              <div key={k.label} className={`rounded-xl border ${k.border} bg-slate-900/70 p-4 text-center`}>
                <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          {data.totalCount > 0 && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {/* Activity over time */}
              <div className="col-span-2 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Change Activity Over Time</p>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} barSize={16} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Create" stackId="a" fill="#10b981" name="Created" />
                      <Bar dataKey="Update" stackId="a" fill="#f59e0b" name="Updated" />
                      <Bar dataKey="Delete" stackId="a" fill="#ef4444" name="Deleted" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* By resource type */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">By Resource Type</p>
                <div className="flex gap-3 items-center">
                  <div className="h-[150px] w-[150px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius="38%" outerRadius="68%" paddingAngle={2} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0.2)" />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {pieData.slice(0, 6).map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-[11px]">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 truncate text-slate-300">{d.name}</span>
                        <span className="shrink-0 font-semibold text-slate-400">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top changed-by */}
          {data.topChangedBy.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Top Performers</p>
              <div className="flex flex-wrap gap-2">
                {data.topChangedBy.map((who) => {
                  const count = data.changes.filter((c) => c.changedBy === who).length;
                  return (
                    <div key={who} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/30 text-[10px] font-bold text-violet-300">
                        {(who[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-200">{who}</span>
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters + change list */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Change Log</p>
              <input
                type="text"
                placeholder="Search resource, user, type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-400/50 w-48"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              >
                <option>All</option>
                <option>Create</option>
                <option>Update</option>
                <option>Delete</option>
              </select>
              {changedByOptions.length > 0 && (
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:outline-none max-w-[200px] truncate"
                >
                  <option value="All">All Users</option>
                  {changedByOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
              <span className="ml-auto text-xs text-slate-500">{filtered.length} results</span>
            </div>

            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No changes match your filters.</p>
            ) : (
              <>
                {/* Column headers */}
                <div className="hidden md:grid grid-cols-[80px_1fr_180px_120px_130px_16px] gap-3 px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  <span>Type</span><span>Resource</span><span>Changed By</span><span>Client</span><span>Time</span><span />
                </div>
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                  {filtered.map((c) => <ChangeRow key={c.id} event={c} />)}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="flex h-48 items-center justify-center text-sm text-slate-400">
          Could not load change history. Azure Resource Graph change data may not be available for this scope.
        </div>
      )}
    </div>
  );
}
