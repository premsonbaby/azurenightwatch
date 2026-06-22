import { useEffect, useState, useCallback } from 'react';
import { nightWatchClient } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import { useTenant } from '../context/TenantContext';
import type {
  MonthlyReview,
  ActionItem,
  CreateActionItemRequest,
  UpdateActionItemRequest,
} from '../types/dashboard';
import type { SuggestedAction } from '../api/client';

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Dismissed: 'bg-zinc-500/20 text-zinc-400 border-zinc-600/30',
};

const CATEGORY_COLORS: Record<string, string> = {
  Security: 'bg-rose-500/10 text-rose-300',
  Cost: 'bg-amber-500/10 text-amber-300',
  Performance: 'bg-emerald-500/10 text-emerald-300',
  Reliability: 'bg-white/10 text-[#e0e0e0]',
  Governance: 'bg-zinc-500/10 text-zinc-300',
  General: 'bg-white/15 text-[#c0c0c0]',
};

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-zinc-500 text-xs">—</span>;
  const color = delta > 0.5 ? 'text-emerald-400' : delta < -0.5 ? 'text-rose-400' : 'text-zinc-400';
  const sign = delta > 0 ? '+' : '';
  return <span className={`text-xs font-semibold ${color}`}>{sign}{delta.toFixed(1)}</span>;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-semibold text-white">{score.toFixed(0)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-500">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

interface AddItemModalProps {
  tenantId: string;
  month: string;
  onSaved: () => void;
  onClose: () => void;
}

function AddItemModal({ tenantId, month, onSaved, onClose }: AddItemModalProps) {
  const [form, setForm] = useState<CreateActionItemRequest>({
    title: '',
    description: '',
    priority: 'Medium',
    category: 'General',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await nightWatchClient.createActionItem(tenantId, form, month);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-500 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#c0c0c0]">New Action Item</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Title *</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the action required"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none resize-none"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Additional context or steps to resolve"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">Priority</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">Category</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                <option>Security</option>
                <option>Cost</option>
                <option>Performance</option>
                <option>Reliability</option>
                <option>Governance</option>
                <option>General</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-500">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#c0c0c0] px-4 py-2 text-sm font-medium text-white hover:bg-[#c0c0c0] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ActionItemRowProps {
  item: ActionItem;
  tenantId: string;
  onUpdated: () => void;
  onDeleted: () => void;
}

function ActionItemRow({ item, tenantId, onUpdated, onDeleted }: ActionItemRowProps) {
  const [updating, setUpdating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function changeStatus(status: string) {
    setUpdating(true);
    try {
      const req: UpdateActionItemRequest = { status };
      await nightWatchClient.updateActionItem(tenantId, item.id, req);
      onUpdated();
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this action item?')) return;
    setUpdating(true);
    try {
      await nightWatchClient.deleteActionItem(tenantId, item.id);
      onDeleted();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-500 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Chip label={item.priority} cls={PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.Medium} />
            <Chip label={item.status} cls={STATUS_COLORS[item.status] ?? STATUS_COLORS.Open} />
            <span className={`rounded px-2 py-0.5 text-xs ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.General}`}>
              {item.category}
            </span>
            <span className="text-xs text-zinc-500">{item.month}</span>
          </div>
          <p className="text-sm font-medium text-white">{item.title}</p>
          {item.description && (
            <button
              type="button"
              className="mt-1 text-xs text-zinc-400 hover:text-zinc-300"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}
          {expanded && item.description && (
            <p className="mt-2 text-xs text-zinc-300 whitespace-pre-wrap">{item.description}</p>
          )}
          {item.resolvedBy && (
            <p className="mt-1 text-xs text-zinc-500">Resolved by {item.resolvedBy}</p>
          )}
          {item.resolutionNote && (
            <p className="mt-0.5 text-xs text-zinc-400 italic">"{item.resolutionNote}"</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.status === 'Open' && (
            <button
              type="button"
              disabled={updating}
              onClick={() => changeStatus('Resolved')}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Resolve
            </button>
          )}
          {item.status !== 'Open' && (
            <button
              type="button"
              disabled={updating}
              onClick={() => changeStatus('Open')}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-500 disabled:opacity-50"
            >
              Re-open
            </button>
          )}
          <button
            type="button"
            disabled={updating}
            onClick={handleDelete}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-500 hover:border-rose-500/30 hover:text-rose-400 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

interface MonthlyReviewPageProps {
  refreshTick: number;
}

export function MonthlyReviewPage({ refreshTick }: MonthlyReviewPageProps) {
  const { activeTenantId, isHomeTenant } = useTenant();
  const tenantId = activeTenantId ?? 'global';

  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionFilter, setActionFilter] = useState<'All' | 'Open' | 'Resolved'>('All');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedAction[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addingFromSuggestion, setAddingFromSuggestion] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    nightWatchClient.getMonthlyReview(tenantId)
      .then(setReview)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId, refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleDownloadPdf() {
    setIsDownloading(true);
    setDownloadMsg(null);
    try {
      await nightWatchClient.downloadMonthlyReviewPdf(tenantId, undefined, review?.tenantDisplayName);
      setDownloadMsg('PDF downloaded.');
    } catch (e) {
      setDownloadMsg(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadMsg(null), 4000);
    }
  }

  async function loadSuggestions() {
    if (suggestions !== null) { setSuggestions(null); return; }
    setLoadingSuggestions(true);
    try {
      const items = await nightWatchClient.getSuggestedActions(tenantId);
      setSuggestions(items);
    } catch {}
    setLoadingSuggestions(false);
  }

  async function addSuggestion(s: SuggestedAction) {
    if (!review) return;
    setAddingFromSuggestion(s.title);
    try {
      const req: CreateActionItemRequest = { title: s.title, description: s.description, priority: s.priority, category: s.category };
      await nightWatchClient.createActionItem(tenantId, req, review.month);
      load();
    } catch {}
    setAddingFromSuggestion(null);
  }

  const filteredItems = review?.actionItems.filter(item => {
    if (actionFilter === 'All') return true;
    return item.status === actionFilter;
  }) ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PageBackButton />
          <h1 className="text-lg font-bold text-white">Monthly Review</h1>
        </div>
        <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">Loading review…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PageBackButton />
          <h1 className="text-lg font-bold text-white">Monthly Review</h1>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      </div>
    );
  }

  if (!review) return null;

  const overallColor = review.overallScore >= 80
    ? 'text-emerald-400'
    : review.overallScore >= 60 ? 'text-amber-400' : 'text-rose-400';

  const openCount = review.actionItems.filter(i => i.status === 'Open').length;
  const resolvedCount = review.actionItems.filter(i => i.status === 'Resolved').length;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-3xl border border-white/10 bg-zinc-500 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PageBackButton />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#c0c0c0]">Reports</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <h2 className="text-2xl font-black tracking-tight text-white">Monthly Review</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  isHomeTenant ? 'border-white/30 bg-white/15 text-[#c0c0c0]' : 'border-white/30 bg-white/15 text-[#e0e0e0]'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isHomeTenant ? 'bg-red-500' : 'bg-[#c0c0c0]'}`} />
                  {review.tenantDisplayName}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">{review.monthLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {downloadMsg && <span className="text-xs text-zinc-400">{downloadMsg}</span>}
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-500 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-500 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isDownloading ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Overall score */}
          <div className="rounded-2xl border border-white/10 bg-zinc-500 p-4">
            <p className="text-xs text-zinc-400">Overall Health</p>
            <p className={`mt-1 text-3xl font-black ${overallColor}`}>{review.overallScore.toFixed(0)}</p>
            {review.overallDelta !== null && (
              <DeltaBadge delta={review.overallDelta} />
            )}
            {review.previousMonthLabel && (
              <p className="mt-1 text-[10px] text-zinc-500">vs {review.previousMonthLabel}</p>
            )}
          </div>

          {/* Improved */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-zinc-400">Areas Improved</p>
            <p className="mt-1 text-3xl font-black text-emerald-400">{review.improved.length}</p>
            {review.improved.length > 0 && (
              <p className="mt-1 text-[10px] text-emerald-500">{review.improved.map(d => d.dimension).join(', ')}</p>
            )}
          </div>

          {/* Declined */}
          <div className={`rounded-2xl border p-4 ${review.declined.length === 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
            <p className="text-xs text-zinc-400">Areas Declined</p>
            <p className={`mt-1 text-3xl font-black ${review.declined.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{review.declined.length}</p>
            {review.declined.length > 0 && (
              <p className="mt-1 text-[10px] text-rose-500">{review.declined.map(d => d.dimension).join(', ')}</p>
            )}
          </div>

          {/* Action items */}
          <div className={`rounded-2xl border p-4 ${openCount === 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
            <p className="text-xs text-zinc-400">Open Actions</p>
            <p className={`mt-1 text-3xl font-black ${openCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{openCount}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{review.resolvedThisMonth} resolved this month</p>
          </div>
        </div>

      {/* Score comparison */}
      {review.hasPreviousData ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-500 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 mb-4">
            Score Comparison — {review.previousMonthLabel} → {review.monthLabel}
          </p>
          <div className="space-y-3">
            {/* Overall row */}
            <div className="grid grid-cols-[1fr_80px_80px_80px] items-center gap-3 border-b border-white/10 pb-2">
              <span className="text-xs font-medium text-zinc-300">Overall Health</span>
              <span className="text-right text-xs text-zinc-400">{review.previousOverallScore?.toFixed(0) ?? '—'}</span>
              <span className="text-right text-sm font-bold text-white">{review.overallScore.toFixed(0)}</span>
              <div className="text-right"><DeltaBadge delta={review.overallDelta} /></div>
            </div>
            {/* Header labels */}
            <div className="grid grid-cols-[1fr_80px_80px_80px] text-[10px] text-zinc-500 uppercase tracking-wider">
              <span>Dimension</span>
              <span className="text-right">{review.previousMonthLabel?.split(' ')[0]}</span>
              <span className="text-right">{review.monthLabel.split(' ')[0]}</span>
              <span className="text-right">Change</span>
            </div>
            {review.dimensions.map(dim => {
              const trendIcon = dim.trend === 'improved' ? '▲' : dim.trend === 'declined' ? '▼' : '→';
              const trendColor = dim.trend === 'improved' ? 'text-emerald-400' : dim.trend === 'declined' ? 'text-rose-400' : 'text-zinc-500';
              return (
                <div key={dim.dimension} className="grid grid-cols-[1fr_80px_80px_80px] items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${trendColor}`}>{trendIcon}</span>
                    <span className="text-xs text-zinc-300">{dim.dimension}</span>
                  </div>
                  <span className="text-right text-xs text-zinc-400">{dim.lastMonth.toFixed(0)}</span>
                  <span className="text-right text-xs font-semibold text-white">{dim.thisMonth.toFixed(0)}</span>
                  <div className="text-right"><DeltaBadge delta={dim.delta} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-zinc-500 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 mb-3">Score Overview</p>
          <div className="space-y-3">
            <ScoreBar score={review.overallScore} label="Overall Health" />
            {review.dimensions.map(dim => (
              <ScoreBar key={dim.dimension} score={dim.thisMonth} label={dim.dimension} />
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">No previous month data — comparisons will appear after two months of snapshots.</p>
        </div>
      )}

      {/* Action items */}
      <div className="rounded-2xl border border-white/10 bg-zinc-500 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Action Items</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{openCount} open · {resolvedCount} resolved</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            {(['All', 'Open', 'Resolved'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setActionFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  actionFilter === f
                    ? 'bg-[#c0c0c0] text-white'
                    : 'border border-white/10 text-zinc-400 hover:bg-zinc-500'
                }`}
              >
                {f}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-[#c0c0c0] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#c0c0c0]"
            >
              + Add
            </button>
            <button
              type="button"
              onClick={loadSuggestions}
              disabled={loadingSuggestions}
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition disabled:opacity-50"
            >
              {loadingSuggestions ? 'Loading…' : suggestions !== null ? 'Hide Suggestions' : '✨ Suggest from Insights'}
            </button>
          </div>
        </div>

        {/* Auto-suggestions panel */}
        {suggestions !== null && suggestions.length > 0 && (
          <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="mb-3 text-xs font-semibold text-cyan-300 uppercase tracking-wide">Suggested Action Items — from live insights</p>
            <div className="space-y-2">
              {suggestions.map(s => (
                <div key={s.title} className="flex items-start gap-3 rounded-lg bg-slate-800/50 p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        s.priority === 'High' ? 'bg-red-500/20 text-red-300' : s.priority === 'Medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-600/40 text-slate-400'
                      }`}>{s.priority}</span>
                      <span className="text-[10px] text-slate-500">{s.category}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200">{s.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{s.description}</p>
                  </div>
                  <button
                    onClick={() => addSuggestion(s)}
                    disabled={addingFromSuggestion === s.title}
                    className="shrink-0 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
                  >
                    {addingFromSuggestion === s.title ? 'Adding…' : '+ Add'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {suggestions !== null && suggestions.length === 0 && (
          <div className="mb-4 rounded-xl border border-slate-500/20 bg-slate-500/5 p-3 text-xs text-slate-400">
            No active insights to suggest right now. All systems look healthy!
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-400">
            {actionFilter === 'All' ? 'No action items yet. Add one to start tracking.' : `No ${actionFilter.toLowerCase()} items.`}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => (
              <ActionItemRow
                key={item.id}
                item={item}
                tenantId={tenantId}
                onUpdated={load}
                onDeleted={load}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddItemModal
          tenantId={tenantId}
          month={review.month}
          onSaved={() => { setShowAddModal(false); load(); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
