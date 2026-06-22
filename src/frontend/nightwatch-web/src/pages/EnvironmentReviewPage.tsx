import { useEffect, useState, useCallback } from 'react';
import { nightWatchClient } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import { useTenant } from '../context/TenantContext';
import type { EnvironmentReviewSummary, EnvironmentReviewDetail, ReviewFinding, CreateEnvironmentReviewRequest, CreateReviewFindingRequest, FindingLibraryItem } from '../api/client';

const PILLARS = ['Security', 'Identity', 'Network', 'Cost', 'Governance', 'Reliability', 'Performance', 'OperationalExcellence'] as const;
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Informational'] as const;
const EFFORTS = ['QuickWin', 'ShortTerm', 'LongTerm'] as const;
const MATURITIES = ['Initial', 'Developing', 'Defined', 'Managed', 'Optimising'] as const;

type View = 'list' | 'detail' | 'new-review' | 'library';

function severityBadge(s: string) {
  const map: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-300 border-red-500/40',
    High: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Informational: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  };
  return `border rounded px-2 py-0.5 text-[10px] font-bold uppercase ${map[s] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/40'}`;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    Draft: 'bg-slate-600/40 text-slate-300',
    InProgress: 'bg-amber-500/20 text-amber-300',
    Completed: 'bg-cyan-500/20 text-cyan-300',
    Delivered: 'bg-emerald-500/20 text-emerald-300',
  };
  return `rounded px-2 py-0.5 text-[10px] font-semibold ${map[s] ?? 'bg-slate-600/40 text-slate-300'}`;
}

function effortLabel(e: string | null | undefined) {
  if (!e) return null;
  const map: Record<string, string> = { QuickWin: 'Quick Win', ShortTerm: 'Short Term', LongTerm: 'Long Term' };
  return map[e] ?? e;
}

export function EnvironmentReviewPage() {
  const { activeTenantId } = useTenant();
  const [view, setView] = useState<View>('list');
  const [reviews, setReviews] = useState<EnvironmentReviewSummary[]>([]);
  const [activeReview, setActiveReview] = useState<EnvironmentReviewDetail | null>(null);
  const [library, setLibrary] = useState<FindingLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New review form
  const [newReview, setNewReview] = useState<CreateEnvironmentReviewRequest>({
    customerName: '', reviewDate: new Date().toISOString().slice(0, 10), reviewedBy: '',
    scope: '', executiveSummary: '', overallMaturity: '',
  });

  // New finding form
  const [showFindingForm, setShowFindingForm] = useState(false);
  const [newFinding, setNewFinding] = useState<CreateReviewFindingRequest>({
    pillar: 'Security', severity: 'High', title: '', description: '', recommendation: '',
    evidence: '', effortEstimate: 'ShortTerm',
  });

  // Library filter
  const [libFilter, setLibFilter] = useState('');
  const [libPillar, setLibPillar] = useState('');

  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await nightWatchClient.getEnvironmentReviews(activeTenantId);
      setReviews(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  async function openReview(id: number) {
    setIsLoading(true);
    try {
      const detail = await nightWatchClient.getEnvironmentReview(activeTenantId, id);
      setActiveReview(detail);
      setView('detail');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load review.');
    } finally {
      setIsLoading(false);
    }
  }

  async function createReview() {
    if (!newReview.customerName || !newReview.reviewedBy) return;
    setIsSaving(true);
    try {
      const created = await nightWatchClient.createEnvironmentReview(activeTenantId, newReview);
      setActiveReview(created);
      setView('detail');
      await loadReviews();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create review.');
    } finally {
      setIsSaving(false);
    }
  }

  async function addFinding() {
    if (!activeReview || !newFinding.title) return;
    setIsSaving(true);
    try {
      const finding = await nightWatchClient.addReviewFinding(activeTenantId, activeReview.id, newFinding);
      if (finding) {
        setActiveReview(prev => prev ? { ...prev, findings: [...prev.findings, finding] } : prev);
      }
      setShowFindingForm(false);
      setNewFinding({ pillar: 'Security', severity: 'High', title: '', description: '', recommendation: '', evidence: '', effortEstimate: 'ShortTerm' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add finding.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteFinding(findingId: number) {
    if (!activeReview) return;
    try {
      await nightWatchClient.deleteReviewFinding(activeTenantId, activeReview.id, findingId);
      setActiveReview(prev => prev ? { ...prev, findings: prev.findings.filter(f => f.id !== findingId) } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete finding.');
    }
  }

  async function updateStatus(status: string) {
    if (!activeReview) return;
    try {
      const updated = await nightWatchClient.updateEnvironmentReview(activeTenantId, activeReview.id, { status });
      setActiveReview(updated);
      setReviews(prev => prev.map(r => r.id === updated.id ? { ...r, status: updated.status } : r));
    } catch {}
  }

  async function downloadPdf() {
    if (!activeReview) return;
    setIsPdfLoading(true);
    try {
      await nightWatchClient.downloadEnvironmentReviewPdf(activeTenantId, activeReview.id, activeReview.customerName);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF generation failed.');
    } finally {
      setIsPdfLoading(false);
    }
  }

  async function loadLibrary() {
    if (library.length > 0) { setView('library'); return; }
    try {
      const items = await nightWatchClient.getFindingLibrary();
      setLibrary(items);
    } catch {}
    setView('library');
  }

  async function addFromLibrary(item: FindingLibraryItem) {
    if (!activeReview) return;
    const req: CreateReviewFindingRequest = {
      pillar: item.pillar, severity: item.severity, title: item.title,
      description: item.description, recommendation: item.recommendation,
      effortEstimate: item.effortEstimate ?? undefined, libraryRef: item.ref,
    };
    setIsSaving(true);
    try {
      const finding = await nightWatchClient.addReviewFinding(activeTenantId, activeReview.id, req);
      if (finding) {
        setActiveReview(prev => prev ? { ...prev, findings: [...prev.findings, finding] } : prev);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add finding from library.');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
        <PageBackButton />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">CSP Tools</p>
            <h2 className="mt-1 text-2xl font-black text-white">Azure Environment Reviews</h2>
            <p className="mt-1 text-sm text-slate-400">Structured customer environment assessments with findings, recommendations, and branded PDF reports</p>
          </div>
          <div className="flex gap-2">
            {view === 'detail' && activeReview && (
              <>
                <button onClick={() => loadLibrary()} className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-xs text-indigo-200 hover:bg-indigo-500/30 transition">
                  + From Library
                </button>
                <button onClick={downloadPdf} disabled={isPdfLoading} className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs text-cyan-200 hover:bg-cyan-500/30 transition disabled:opacity-50">
                  {isPdfLoading ? 'Generating…' : 'Export PDF'}
                </button>
                <button onClick={() => setView('list')} className="rounded-xl border border-white/10 bg-slate-700/30 px-4 py-2 text-xs text-slate-300 hover:bg-slate-700/50 transition">
                  All Reviews
                </button>
              </>
            )}
            {view !== 'new-review' && view !== 'detail' && (
              <button onClick={() => setView('new-review')} className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs text-emerald-200 hover:bg-emerald-500/30 transition">
                + New Review
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* ── LIST VIEW ───────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-8 text-center text-sm text-slate-400">Loading reviews…</div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-12 text-center">
              <p className="text-slate-400">No environment reviews yet.</p>
              <button onClick={() => setView('new-review')} className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-5 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30 transition">
                Create your first review
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => (
                <button key={r.id} onClick={() => openReview(r.id)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-800/40 p-5 text-left hover:border-cyan-500/40 hover:bg-slate-700/40 transition">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={statusBadge(r.status)}>{r.status}</span>
                        {r.overallMaturity && <span className="text-[10px] text-slate-400">Maturity: {r.overallMaturity}</span>}
                      </div>
                      <p className="mt-1 text-sm font-bold text-white">{r.customerName}</p>
                      <p className="text-xs text-slate-400">{r.reviewDate} · Reviewed by {r.reviewedBy}</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {r.criticalCount > 0 && <span className="text-red-400">{r.criticalCount} Critical</span>}
                      {r.highCount > 0 && <span className="text-orange-400">{r.highCount} High</span>}
                      <span className="text-slate-400">{r.findingCount} findings total</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── NEW REVIEW FORM ─────────────────────────────────────────────────── */}
      {view === 'new-review' && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-6">
          <h3 className="mb-5 text-sm font-bold text-white">New Environment Review</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {([
              ['customerName', 'Customer Name', 'text', 'e.g. Contoso Ltd'],
              ['reviewDate', 'Review Date', 'date', ''],
              ['reviewedBy', 'Reviewed By (email/name)', 'text', 'e.g. john@msp.com'],
              ['overallMaturity', 'Overall Maturity (optional)', 'select', ''],
            ] as const).map(([field, label, type, ph]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                {type === 'select' ? (
                  <select
                    value={newReview[field as keyof CreateEnvironmentReviewRequest] ?? ''}
                    onChange={e => setNewReview(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-slate-700/50 px-3 py-2 text-sm text-white focus:border-cyan-500/60 focus:outline-none"
                  >
                    <option value="">Not assessed</option>
                    {MATURITIES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type={type}
                    value={newReview[field as keyof CreateEnvironmentReviewRequest] ?? ''}
                    onChange={e => setNewReview(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={ph}
                    className="w-full rounded-xl border border-white/10 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-400 mb-1">Review Scope (optional)</label>
            <textarea
              value={newReview.scope ?? ''}
              onChange={e => setNewReview(prev => ({ ...prev, scope: e.target.value }))}
              rows={3}
              placeholder="Describe what subscriptions, resource groups, or services are in scope for this review..."
              className="w-full rounded-xl border border-white/10 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none resize-none"
            />
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-400 mb-1">Executive Summary (optional)</label>
            <textarea
              value={newReview.executiveSummary ?? ''}
              onChange={e => setNewReview(prev => ({ ...prev, executiveSummary: e.target.value }))}
              rows={4}
              placeholder="High-level summary for the customer's management team..."
              className="w-full rounded-xl border border-white/10 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none resize-none"
            />
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={createReview}
              disabled={!newReview.customerName || !newReview.reviewedBy || isSaving}
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-5 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30 transition disabled:opacity-50"
            >
              {isSaving ? 'Creating…' : 'Create Review'}
            </button>
            <button onClick={() => setView('list')} className="rounded-xl border border-white/10 bg-slate-700/30 px-5 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── DETAIL VIEW ─────────────────────────────────────────────────────── */}
      {view === 'detail' && activeReview && (
        <div className="space-y-5">
          {/* Review header */}
          <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={statusBadge(activeReview.status)}>{activeReview.status}</span>
                  {activeReview.overallMaturity && <span className="text-xs text-slate-400">Maturity: <span className="text-white">{activeReview.overallMaturity}</span></span>}
                </div>
                <h3 className="mt-1 text-lg font-black text-white">{activeReview.customerName}</h3>
                <p className="text-xs text-slate-400">{activeReview.reviewDate} · Reviewed by {activeReview.reviewedBy}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['Draft', 'InProgress', 'Completed', 'Delivered'] as const).map(s => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className={`rounded-lg border px-3 py-1 text-[11px] font-medium transition ${activeReview.status === s ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200' : 'border-white/10 text-slate-400 hover:bg-slate-700/40'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {activeReview.executiveSummary && (
              <div className="mt-4 rounded-xl bg-slate-700/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Executive Summary</p>
                <p className="mt-1 text-sm text-slate-300 leading-relaxed">{activeReview.executiveSummary}</p>
              </div>
            )}
            {activeReview.scope && (
              <div className="mt-3 rounded-xl bg-slate-700/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Scope</p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{activeReview.scope}</p>
              </div>
            )}
          </div>

          {/* Findings summary */}
          {activeReview.findings.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {SEVERITIES.map(sev => {
                const count = activeReview.findings.filter(f => f.severity === sev).length;
                return (
                  <div key={sev} className="rounded-2xl border border-white/10 bg-slate-800/40 p-3 text-center">
                    <p className="text-[10px] text-slate-400">{sev}</p>
                    <p className="mt-1 text-2xl font-black text-white">{count}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Findings list */}
          <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Findings ({activeReview.findings.length})</h3>
              <button
                onClick={() => setShowFindingForm(!showFindingForm)}
                className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/30 transition"
              >
                + Add Finding
              </button>
            </div>

            {/* Add finding form */}
            {showFindingForm && (
              <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="mb-3 text-xs font-semibold text-cyan-300">New Finding</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Pillar</label>
                    <select value={newFinding.pillar} onChange={e => setNewFinding(p => ({ ...p, pillar: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60">
                      {PILLARS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Severity</label>
                    <select value={newFinding.severity} onChange={e => setNewFinding(p => ({ ...p, severity: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60">
                      {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Effort</label>
                    <select value={newFinding.effortEstimate ?? ''} onChange={e => setNewFinding(p => ({ ...p, effortEstimate: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60">
                      <option value="">Not specified</option>
                      {EFFORTS.map(e => <option key={e} value={e}>{effortLabel(e)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <input value={newFinding.title} onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))}
                    placeholder="Finding title *"
                    className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60" />
                </div>
                <div className="mt-2">
                  <textarea value={newFinding.description} onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))}
                    rows={2} placeholder="Describe the finding..."
                    className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 resize-none" />
                </div>
                <div className="mt-2">
                  <textarea value={newFinding.recommendation} onChange={e => setNewFinding(p => ({ ...p, recommendation: e.target.value }))}
                    rows={2} placeholder="Recommendation / remediation steps..."
                    className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 resize-none" />
                </div>
                <div className="mt-2">
                  <input value={newFinding.evidence ?? ''} onChange={e => setNewFinding(p => ({ ...p, evidence: e.target.value }))}
                    placeholder="Evidence (resource names, IDs, etc.) — optional"
                    className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60" />
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={addFinding} disabled={!newFinding.title || isSaving}
                    className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/30 transition disabled:opacity-50">
                    {isSaving ? 'Adding…' : 'Add Finding'}
                  </button>
                  <button onClick={() => setShowFindingForm(false)} className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-slate-400 hover:bg-slate-700/40 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Findings grouped by pillar */}
            {activeReview.findings.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No findings yet. Add findings manually or use the Finding Library.</p>
            ) : (
              <div className="space-y-4">
                {PILLARS.filter(p => activeReview.findings.some(f => f.pillar === p)).map(pillar => (
                  <div key={pillar}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{pillar}</p>
                    <div className="space-y-2">
                      {activeReview.findings.filter(f => f.pillar === pillar).map((finding: ReviewFinding) => (
                        <FindingCard key={finding.id} finding={finding} onDelete={() => deleteFinding(finding.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LIBRARY VIEW ─────────────────────────────────────────────────────── */}
      {view === 'library' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Finding Library</h3>
              <button onClick={() => setView('detail')} className="rounded-xl border border-white/10 bg-slate-700/30 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 transition">
                Back to Review
              </button>
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
              <input value={libFilter} onChange={e => setLibFilter(e.target.value)} placeholder="Search findings…"
                className="flex-1 rounded-xl border border-white/10 bg-slate-700/50 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60" />
              <select value={libPillar} onChange={e => setLibPillar(e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-700/50 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/60">
                <option value="">All Pillars</option>
                {PILLARS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-3">
            {library
              .filter(item => (!libPillar || item.pillar === libPillar) && (!libFilter || item.title.toLowerCase().includes(libFilter.toLowerCase()) || item.description.toLowerCase().includes(libFilter.toLowerCase())))
              .map(item => (
                <div key={item.ref} className="rounded-2xl border border-white/10 bg-slate-800/40 p-4">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={severityBadge(item.severity)}>{item.severity}</span>
                        <span className="text-[10px] bg-slate-600/40 text-slate-300 rounded px-2 py-0.5">{item.pillar}</span>
                        {item.effortEstimate && <span className="text-[10px] text-slate-500">{effortLabel(item.effortEstimate)}</span>}
                        <span className="text-[10px] font-mono text-slate-600">{item.ref}</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">{item.description}</p>
                    </div>
                    <button
                      onClick={() => addFromLibrary(item)}
                      disabled={isSaving}
                      className="shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/30 transition disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding, onDelete }: { finding: ReviewFinding; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  function severityBadge(s: string) {
    const map: Record<string, string> = {
      Critical: 'bg-red-500/20 text-red-300 border-red-500/40',
      High: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      Informational: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    };
    return `border rounded px-2 py-0.5 text-[10px] font-bold uppercase ${map[s] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/40'}`;
  }

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <span className={severityBadge(finding.severity)}>{finding.severity}</span>
        <span className="flex-1 text-sm font-medium text-slate-200">{finding.title}</span>
        {finding.effortEstimate && <span className="text-[10px] text-slate-500 shrink-0">{finding.effortEstimate}</span>}
        <svg className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
          {finding.description && <p className="text-xs text-slate-400 leading-relaxed">{finding.description}</p>}
          {finding.evidence && (
            <div className="rounded-lg bg-slate-800/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Evidence</p>
              <p className="mt-1 text-xs text-slate-400">{finding.evidence}</p>
            </div>
          )}
          {finding.recommendation && (
            <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">Recommendation</p>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">{finding.recommendation}</p>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-300 transition">Remove finding</button>
          </div>
        </div>
      )}
    </div>
  );
}
