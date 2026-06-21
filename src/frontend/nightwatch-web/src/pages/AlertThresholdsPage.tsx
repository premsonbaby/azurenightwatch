import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import { useTenant } from '../context/TenantContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlertThreshold {
  id: number;
  tenantId: string;
  metricType: string;
  thresholdValue: number;
  alertChannel: string;
  isEnabled: boolean;
  teamsWebhookUrl: string | null;
  alertEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ThresholdBreach {
  id: number;
  thresholdId: number;
  tenantId: string;
  metricType: string;
  thresholdValue: number;
  actualValue: number;
  breachedAt: string;
  resolvedAt: string | null;
  alertTitle: string | null;
  businessImpact: string | null;
  suggestedAction: string | null;
  severity: string;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

const METRIC_OPTIONS = [
  { value: 'MonthlyCostCeiling',    label: 'Monthly Cost Ceiling',      unit: 'EUR', description: 'Alert when current-month spend exceeds this amount' },
  { value: 'MonthlyCostRunRate',    label: 'Budget Burn Rate Warning',   unit: 'EUR', description: 'Pre-breach alert when projected month-end cost will exceed this budget' },
  { value: 'SecurityScoreFloor',    label: 'Security Score Floor',       unit: '%',   description: 'Alert when Defender security score falls below this value' },
  { value: 'AdvisorScoreFloor',     label: 'Advisor Score Floor',        unit: '%',   description: 'Alert when Azure Advisor overall score falls below this value' },
  { value: 'BackupCoverageFloor',   label: 'Backup Coverage Floor',      unit: '%',   description: 'Alert when backup protection coverage falls below this percentage' },
  { value: 'GovernanceScoreFloor',  label: 'Governance Score Floor',     unit: '%',   description: 'Alert when governance compliance score falls below this value' },
  { value: 'ReliabilityScoreFloor', label: 'Reliability Score Floor',    unit: '%',   description: 'Alert when platform reliability score falls below this value' },
];

const CHANNEL_OPTIONS = [
  { value: 'Teams', label: 'Teams',         description: 'Send to a Teams webhook' },
  { value: 'Both',  label: 'Teams + Email', description: 'Teams webhook and email notification' },
];

function metricLabel(type: string) { return METRIC_OPTIONS.find(m => m.value === type)?.label ?? type; }
function metricUnit(type: string)  { return METRIC_OPTIONS.find(m => m.value === type)?.unit ?? ''; }
function isCeilingMetric(type: string) { return type === 'MonthlyCostCeiling' || type === 'MonthlyCostRunRate'; }

function severityColor(s: string) {
  return s === 'Critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
         s === 'High'     ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                            'bg-white/20 text-[#888888] border-white/30';
}

// ── Threshold form ────────────────────────────────────────────────────────────

function ThresholdForm({ tenantId, initial, onSave, onClose }: {
  tenantId: string; initial?: AlertThreshold; onSave: () => void; onClose: () => void;
}) {
  const [metricType, setMetricType]         = useState(initial?.metricType ?? 'MonthlyCostCeiling');
  const [value, setValue]                   = useState(initial?.thresholdValue?.toString() ?? '');
  const [channel, setChannel]               = useState(initial?.alertChannel ?? 'Teams');
  const [enabled, setEnabled]               = useState(initial?.isEnabled ?? true);
  const [webhookUrl, setWebhookUrl]         = useState(initial?.teamsWebhookUrl ?? '');
  const [alertEmail, setAlertEmail]         = useState(initial?.alertEmail ?? '');
  const [busy, setBusy]                     = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const unit = metricUnit(metricType);

  const handleSave = async () => {
    if (!value.trim() || isNaN(parseFloat(value))) { setError('Enter a valid numeric threshold.'); return; }
    if (channel === 'Both' && alertEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail.trim())) {
      setError('Enter a valid email address.'); return;
    }
    setBusy(true); setError(null);
    try {
      const req = {
        metricType,
        thresholdValue: parseFloat(value),
        alertChannel: channel,
        isEnabled: enabled,
        teamsWebhookUrl: webhookUrl.trim() || null,
        alertEmail: channel === 'Both' ? (alertEmail.trim() || null) : null,
      };
      if (initial) await nightWatchClient.updateAlertThreshold(tenantId, initial.id, req);
      else         await nightWatchClient.createAlertThreshold(tenantId, req);
      onSave();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-500 p-6 shadow-2xl">
        <h3 className="mb-5 text-lg font-bold text-white">{initial ? 'Edit Threshold' : 'Add Threshold'}</h3>

        <div className="space-y-4">
          {/* Metric */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-zinc-400">Metric</label>
            <select value={metricType} onChange={e => setMetricType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none">
              {METRIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-zinc-500">{METRIC_OPTIONS.find(m => m.value === metricType)?.description}</p>
          </div>

          {/* Threshold value */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-zinc-400">
              Threshold Value {unit && `(${unit})`}
            </label>
            <input type="number"
              placeholder={isCeilingMetric(metricType) ? 'e.g. 50000' : 'e.g. 70'}
              value={value} onChange={e => setValue(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none" />
          </div>

          {/* Alert channel */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-zinc-400">Alert Channel</label>
            <div className="flex gap-3">
              {CHANNEL_OPTIONS.map(c => (
                <button key={c.value} type="button" onClick={() => setChannel(c.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs transition ${channel === c.value ? 'border-white/30 bg-white/15 text-[#888888]' : 'border-white/10 bg-zinc-500 text-zinc-400 hover:border-white/10'}`}>
                  <span className="font-semibold block">{c.label}</span>
                  <span className="text-[10px] opacity-70">{c.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Teams webhook URL */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-zinc-400">
              Teams Webhook URL
              <span className="ml-1 normal-case text-zinc-500 lowercase tracking-normal">(optional — uses global setting if blank)</span>
            </label>
            <input type="url"
              placeholder="https://outlook.office.com/webhook/..."
              value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none" />
          </div>

          {/* Alert email — only when channel is Both */}
          {channel === 'Both' && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-zinc-400">
                Alert Email
                <span className="ml-1 normal-case text-zinc-500 lowercase tracking-normal">(optional)</span>
              </label>
              <input type="email"
                placeholder="ops-alerts@company.com"
                value={alertEmail} onChange={e => setAlertEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none" />
            </div>
          )}

          {/* Enabled toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setEnabled(v => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-[#c0c0c0]' : 'bg-zinc-500'}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-zinc-500 shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-zinc-300">{enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-500">Cancel</button>
          <button onClick={handleSave} disabled={busy}
            className="rounded-lg bg-[#c0c0c0] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#c0c0c0] disabled:opacity-40">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Breach card ───────────────────────────────────────────────────────────────

function BreachCard({ breach, onAcknowledge }: { breach: ThresholdBreach; onAcknowledge: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [acking, setAcking] = useState(false);
  const unit = metricUnit(breach.metricType);
  const isOpen = !breach.resolvedAt && !breach.isAcknowledged;
  const age = ((Date.now() - new Date(breach.breachedAt).getTime()) / 3600000);
  const ageStr = age < 1 ? '< 1h ago' : age < 24 ? `${Math.floor(age)}h ago` : `${Math.floor(age / 24)}d ago`;

  const handleAck = async () => {
    setAcking(true);
    try { await onAcknowledge(breach.id); } finally { setAcking(false); }
  };

  return (
    <div className={`rounded-2xl border p-4 transition ${isOpen ? 'border-amber-500/30 bg-amber-950/10' : breach.resolvedAt ? 'border-emerald-500/20 bg-zinc-500' : 'border-white/10 bg-zinc-500'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityColor(breach.severity)}`}>
              {breach.severity}
            </span>
            {breach.resolvedAt && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">Resolved</span>}
            {breach.isAcknowledged && !breach.resolvedAt && <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] text-zinc-400">Acknowledged</span>}
            <span className="text-[11px] text-zinc-500">{ageStr}</span>
          </div>
          <p className="font-semibold text-white text-sm">{breach.alertTitle ?? metricLabel(breach.metricType)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {metricLabel(breach.metricType)} · Actual: <span className="font-mono text-amber-300">{breach.actualValue.toFixed(1)}{unit === 'EUR' ? ' EUR' : '%'}</span>
            {' · '}Threshold: <span className="font-mono">{breach.thresholdValue.toFixed(1)}{unit === 'EUR' ? ' EUR' : '%'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOpen && (
            <button onClick={handleAck} disabled={acking}
              className="rounded-lg border border-white/15 bg-zinc-500 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-500 disabled:opacity-40">
              {acking ? '…' : 'Acknowledge'}
            </button>
          )}
          {(breach.businessImpact || breach.suggestedAction) && (
            <button onClick={() => setExpanded(v => !v)}
              className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-500">
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
          {breach.businessImpact && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Business Impact</p>
              <p className="text-xs text-zinc-300 leading-relaxed">{breach.businessImpact}</p>
            </div>
          )}
          {breach.suggestedAction && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Recommended Action</p>
              <p className="text-xs text-emerald-200 leading-relaxed">{breach.suggestedAction}</p>
            </div>
          )}
          {breach.isAcknowledged && breach.acknowledgedBy && (
            <p className="text-[10px] text-zinc-500">
              Acknowledged by {breach.acknowledgedBy} · {breach.acknowledgedAt ? new Date(breach.acknowledgedAt).toLocaleString() : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AlertThresholdsPage() {
  const { activeTenantId, activeTenantName, isHomeTenant } = useTenant();
  const tenantId = activeTenantId ?? 'global';
  const [thresholds, setThresholds]     = useState<AlertThreshold[]>([]);
  const [breaches, setBreaches]         = useState<ThresholdBreach[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState<AlertThreshold | undefined>(undefined);
  const [deletingId, setDeletingId]     = useState<number | null>(null);
  const [breachFilter, setBreachFilter] = useState<'all' | 'open' | 'resolved'>('open');

  const loadData = async (tid: string) => {
    setIsLoading(true);
    try {
      const [t, b] = await Promise.all([
        nightWatchClient.getAlertThresholds(tid),
        nightWatchClient.getThresholdBreaches(tid),
      ]);
      setThresholds(t as AlertThreshold[]);
      setBreaches(b as ThresholdBreach[]);
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  useEffect(() => { loadData(tenantId); }, [tenantId]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this threshold?')) return;
    setDeletingId(id);
    try { await nightWatchClient.deleteAlertThreshold(tenantId, id); await loadData(tenantId); }
    catch (e) { alert(e instanceof Error ? e.message : 'Delete failed.'); }
    setDeletingId(null);
  };

  const handleAcknowledge = async (breachId: number) => {
    try {
      await nightWatchClient.acknowledgeThresholdBreach(tenantId, breachId);
      await loadData(tenantId);
    } catch { /* ignore */ }
  };

  const openCount = breaches.filter(b => !b.resolvedAt && !b.isAcknowledged).length;

  const filteredBreaches = breaches.filter(b => {
    if (breachFilter === 'open')     return !b.resolvedAt && !b.isAcknowledged;
    if (breachFilter === 'resolved') return !!b.resolvedAt || b.isAcknowledged;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-zinc-500 p-6">
        <PageBackButton />
        <div className="mt-2 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl font-black text-white">Alert Thresholds</h2>
            <p className="mt-1 text-sm text-zinc-300">
              {isHomeTenant ? 'Home Tenant' : <span className="text-[#e0e0e0] font-medium">{activeTenantName}</span>}
              {' · '}Checked every 15 minutes
              {openCount > 0 && <span className="text-amber-400 font-semibold"> · {openCount} open breach{openCount !== 1 ? 'es' : ''}</span>}
              {' · '}7 metric types
            </p>
          </div>
          <button onClick={() => { setEditTarget(undefined); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#c0c0c0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c0c0c0]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Threshold
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Configured thresholds */}
          <section className="rounded-2xl border border-white/10 bg-zinc-500 overflow-hidden">
            <div className="border-b border-white/10 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">Configured Thresholds</h3>
            </div>
            {thresholds.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-zinc-500">No thresholds configured.</p>
                <button onClick={() => { setEditTarget(undefined); setShowForm(true); }}
                  className="mt-3 rounded-lg bg-[#c0c0c0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c0c0c0] transition">
                  Add your first threshold →
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                      <th className="px-5 py-3">Metric</th>
                      <th className="px-5 py-3">Threshold</th>
                      <th className="px-5 py-3">Channel</th>
                      <th className="px-5 py-3">Destination</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thresholds.map(t => (
                      <tr key={t.id} className="border-b border-white/10 hover:bg-zinc-500 transition">
                        <td className="px-5 py-3 font-semibold text-white">{metricLabel(t.metricType)}</td>
                        <td className="px-5 py-3 text-zinc-200 font-mono">
                          {isCeilingMetric(t.metricType) ? `> ${t.thresholdValue.toLocaleString()} EUR` : `< ${t.thresholdValue}%`}
                        </td>
                        <td className="px-5 py-3 text-zinc-400">{t.alertChannel === 'Both' ? 'Teams + Email' : 'Teams'}</td>
                        <td className="px-5 py-3">
                          <div className="space-y-0.5">
                            {t.teamsWebhookUrl
                              ? <span className="block text-xs text-[#c0c0c0] truncate max-w-[180px]" title={t.teamsWebhookUrl}>Custom webhook</span>
                              : <span className="text-xs text-zinc-500">Global webhook</span>}
                            {t.alertChannel === 'Both' && (
                              t.alertEmail
                                ? <span className="block text-xs text-[#e0e0e0] truncate max-w-[180px]" title={t.alertEmail}>{t.alertEmail}</span>
                                : <span className="text-xs text-zinc-500">Tenant contacts</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.isEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-500/20 text-zinc-400'}`}>
                            {t.isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setEditTarget(t); setShowForm(true); }}
                              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-500 transition">Edit</button>
                            <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                              className="rounded-lg border border-red-300/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                              {deletingId === t.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Alert history */}
          <section className="rounded-2xl border border-white/10 bg-zinc-500 overflow-hidden">
            <div className="border-b border-white/10 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">
                Alert History
                {openCount > 0 && (
                  <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">{openCount}</span>
                )}
              </h3>
              <div className="flex gap-1">
                {(['open', 'all', 'resolved'] as const).map(f => (
                  <button key={f} onClick={() => setBreachFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${breachFilter === f ? 'bg-zinc-500 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {filteredBreaches.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  {breachFilter === 'open' ? '✅ No open breaches — all metrics within thresholds.' : 'No breach records found.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBreaches.map(b => (
                    <BreachCard key={b.id} breach={b} onAcknowledge={handleAcknowledge} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {showForm && (
        <ThresholdForm
          tenantId={tenantId}
          initial={editTarget}
          onSave={() => { setShowForm(false); loadData(tenantId); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
