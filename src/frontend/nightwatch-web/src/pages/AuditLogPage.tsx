import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';

interface AuditEntry {
  id: number;
  timestamp: string;
  userEmail: string;
  userId: string;
  httpMethod: string;
  path: string;
  tenantId: string | null;
  ipAddress: string | null;
  statusCode: number;
  durationMs: number;
}

interface AuditLogResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AuditEntry[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-zinc-500/20 text-zinc-300',
  POST: 'bg-white/15 text-[#c0c0c0]',
  PUT: 'bg-amber-500/20 text-amber-300',
  DELETE: 'bg-red-500/20 text-red-300',
  PATCH: 'bg-white/20 text-[#e0e0e0]',
};

function statusColor(code: number) {
  if (code < 300) return 'text-emerald-400';
  if (code < 400) return 'text-amber-400';
  return 'text-red-400';
}

export function AuditLogPage() {
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const load = async (p = page) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());
      if (userFilter) params.set('user', userFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);
      if (methodFilter) params.set('method', methodFilter);
      params.set('page', String(p));
      params.set('pageSize', String(PAGE_SIZE));
      const result = await nightWatchClient.getAuditLog(params.toString()) as AuditLogResponse;
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(1); setPage(1); }, [fromDate, toDate, userFilter, tenantFilter, methodFilter]);

  const handleExport = () => nightWatchClient.exportAuditLog(fromDate, toDate);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-zinc-500 p-6">
        <PageBackButton />
        <div className="mt-2 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl font-black text-white">Audit Log</h2>
            <p className="mt-1 text-sm text-zinc-300">Every authenticated API request — last 90 days.</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-white/10 bg-zinc-500 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-500 px-2 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-500 px-2 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">User (email or OID)</label>
            <input placeholder="Search user…" value={userFilter} onChange={e => setUserFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-500 px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Tenant ID</label>
            <input placeholder="Filter by tenant…" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-500 px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-white/20 focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Method</label>
            <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-500 px-2 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none">
              <option value="">All</option>
              {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {(fromDate || toDate || userFilter || tenantFilter || methodFilter) && (
            <div className="flex flex-col gap-1 justify-end">
              <button onClick={() => { setFromDate(''); setToDate(''); setUserFilter(''); setTenantFilter(''); setMethodFilter(''); }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition">
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-white/10 bg-zinc-500 overflow-hidden">
        {error ? (
          <div className="p-6 text-sm text-red-300">{error}</div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-transparent" />
            <span className="ml-3 text-sm text-zinc-400">Loading…</span>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">No audit entries found for the selected filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Path</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3 text-right">Status</th>
                    <th className="px-4 py-3 text-right">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(entry => (
                    <tr key={entry.id} className="border-b border-white/10 hover:bg-zinc-500 transition">
                      <td className="px-4 py-2.5 font-mono text-zinc-400 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-200 max-w-[180px] truncate" title={entry.userEmail}>
                        {entry.userEmail || entry.userId}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${METHOD_COLORS[entry.httpMethod] ?? 'bg-zinc-500/20 text-zinc-300'}`}>
                          {entry.httpMethod}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-300 max-w-[280px] truncate" title={entry.path}>
                        {entry.path}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-500 max-w-[100px] truncate" title={entry.tenantId ?? ''}>
                        {entry.tenantId ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-500">{entry.ipAddress ?? '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${statusColor(entry.statusCode)}`}>
                        {entry.statusCode}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500">{entry.durationMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
              <span className="text-xs text-zinc-500">{data.total.toLocaleString()} total entries</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); load(page - 1); }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition">← Prev</button>
                <span className="text-xs text-zinc-400">Page {page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); load(page + 1); }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition">Next →</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
