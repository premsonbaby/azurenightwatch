import { useEffect, useState, useMemo } from 'react';
import { nightWatchClient } from '../api/client';
import type { ReportSentLog } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import { Link } from 'react-router-dom';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function StatusChip({ status }: { status: string }) {
  const cls = status === 'Sent'
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : 'bg-red-500/20 text-red-300 border-red-500/30';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function TypeChip({ type }: { type: string }) {
  const isScheduled = type === 'Email';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${
      isScheduled
        ? 'border-white/30 bg-white/10 text-[#888888]'
        : 'border-slate-400/30 bg-zinc-500/10 text-zinc-300'
    }`}>
      {isScheduled ? 'Scheduled' : type}
    </span>
  );
}

export function ReportHistoryPage() {
  const [history, setHistory] = useState<ReportSentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantFilter, setTenantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendSuccess, setResendSuccess] = useState<number | null>(null);

  async function resendReport(row: ReportSentLog) {
    setResendingId(row.id);
    setResendSuccess(null);
    try {
      await nightWatchClient.resendReport(row.tenantId, row.id);
      setResendSuccess(row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resend failed.');
    } finally {
      setResendingId(null);
    }
  }

  useEffect(() => {
    nightWatchClient.getAllReportHistory(200)
      .then(setHistory)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const tenants = useMemo(() => {
    const seen = new Map<string, string>();
    history.forEach(r => seen.set(r.tenantId, r.displayName || r.tenantId));
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  const displayed = useMemo(() => history.filter(r => {
    const matchesTenant = !tenantFilter || r.tenantId === tenantFilter;
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesTenant && matchesStatus;
  }), [history, tenantFilter, statusFilter]);

  const sentCount = history.filter(r => r.status === 'Sent').length;
  const failedCount = history.filter(r => r.status !== 'Sent').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-zinc-500 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PageBackButton />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#c0c0c0]">Scheduled Reports</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#e0e0e0]">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Global MSP View — All Tenants
                </span>
              </div>
              <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white">Report History</h2>
              <p className="mt-1 text-xs text-zinc-400">All report deliveries across every customer tenant, regardless of which tenant is currently selected.</p>
            </div>
          </div>
          <Link
            to="/report-schedule"
            className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-4 py-2 text-sm font-semibold text-[#888888] transition hover:bg-white/30"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            Manage Schedule
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-zinc-500 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Total Reports</p>
          <p className="mt-1 text-3xl font-black text-white">{history.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-400/20 bg-zinc-500/10 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Tenants</p>
          <p className="mt-1 text-3xl font-black text-zinc-200">{tenants.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-wider text-emerald-400">Sent</p>
          <p className="mt-1 text-3xl font-black text-emerald-300">{sentCount}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${failedCount > 0 ? 'border-red-400/20 bg-red-500/10' : 'border-white/10 bg-zinc-500'}`}>
          <p className={`text-xs uppercase tracking-wider ${failedCount > 0 ? 'text-red-400' : 'text-zinc-500'}`}>Failed</p>
          <p className={`mt-1 text-3xl font-black ${failedCount > 0 ? 'text-red-300' : 'text-zinc-400'}`}>{failedCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-zinc-500 p-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Tenant dropdown */}
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
            <select
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-zinc-500 py-2 pl-8 pr-8 text-sm text-zinc-100 focus:border-white/30 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">All Tenants ({tenants.length})</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>

          {/* Status filter */}
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            {['All', 'Sent', 'Failed'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-medium transition ${
                  statusFilter === s
                    ? 'bg-[#c0c0c0] text-white'
                    : 'bg-zinc-500 text-zinc-400 hover:bg-zinc-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <span className="ml-auto text-xs text-zinc-500">{displayed.length} of {history.length} entries</span>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            Loading report history…
          </div>
        ) : displayed.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {history.length === 0 ? 'No reports have been sent yet.' : 'No results match your filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Sent At</th>
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Tenant</th>
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Type</th>
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Recipients</th>
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Size</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {displayed.map((row) => (
                  <tr key={row.id} className="text-zinc-300 hover:bg-zinc-500 transition-colors">
                    <td className="py-3 pr-4 text-xs text-zinc-400">{formatDate(row.sentAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="text-sm font-medium text-zinc-200">{row.displayName || row.tenantId}</div>
                      {row.displayName && row.displayName !== row.tenantId && (
                        <div className="text-xs text-zinc-500 font-mono">{row.tenantId}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4"><TypeChip type={row.reportType} /></td>
                    <td className="py-3 pr-4 text-xs">{row.recipientCount}</td>
                    <td className="py-3 pr-4 text-xs text-zinc-400">{formatBytes(row.fileSizeBytes)}</td>
                    <td className="py-3 pr-4">
                      <StatusChip status={row.status} />
                      {row.errorMessage && (
                        <div className="mt-0.5 text-xs text-red-400">{row.errorMessage}</div>
                      )}
                    </td>
                    <td className="py-3">
                      {resendSuccess === row.id ? (
                        <span className="text-xs text-emerald-400">Sent ✓</span>
                      ) : (
                        <button
                          onClick={() => resendReport(row)}
                          disabled={resendingId === row.id}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 transition disabled:opacity-50"
                        >
                          {resendingId === row.id ? 'Sending…' : 'Resend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
