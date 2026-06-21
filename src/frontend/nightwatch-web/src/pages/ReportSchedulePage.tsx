import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import type { ReportSchedule, UpsertReportScheduleRequest } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import { useTenant } from '../context/TenantContext';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
];

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

function statusChip(status: string) {
  const cls =
    status === 'Sent'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      : 'bg-red-500/20 text-red-300 border-red-500/30';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function ReportSchedulePage() {
  const { activeTenantId, activeTenantName, isHomeTenant } = useTenant();

  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<'Monthly' | 'Weekly'>('Monthly');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [sendTime, setSendTime] = useState('09:00');
  const [timeZone, setTimeZone] = useState('UTC');
  const [recipients, setRecipients] = useState('');
  const [includeAiSummary, setIncludeAiSummary] = useState(true);

  // History
  const [history, setHistory] = useState<Awaited<ReturnType<typeof nightWatchClient.getReportHistory>>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const tenantId = isHomeTenant ? 'global' : activeTenantId;

  useEffect(() => {
    setLoading(true);
    setError(null);
    nightWatchClient.getReportSchedule(tenantId)
      .then((s) => {
        setSchedule(s);
        setEnabled(s.enabled);
        setFrequency(s.frequency);
        setDayOfMonth(s.dayOfMonth);
        setDayOfWeek(s.dayOfWeek);
        setSendTime(s.sendTime);
        setTimeZone(s.timeZone);
        setRecipients(s.recipients.join(', '));
        setIncludeAiSummary(s.includeAiSummary);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    setHistoryLoading(true);
    nightWatchClient.getReportHistory(tenantId, 20)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [tenantId]);

  const handleSave = async () => {
    const recipientList = recipients
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter(Boolean);

    if (enabled && recipientList.length === 0) {
      setError('Add at least one recipient email address before enabling the schedule.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const request: UpsertReportScheduleRequest = {
      enabled,
      frequency,
      dayOfMonth,
      dayOfWeek,
      sendTime,
      timeZone,
      recipients: recipientList,
      includeAiSummary,
    };

    try {
      const updated = await nightWatchClient.updateReportSchedule(tenantId, request);
      setSchedule(updated);
      setSuccess('Schedule saved.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (!schedule?.smtpConfigured) {
      setError('SMTP is not configured on the server. Add EmailSmtp settings to appsettings to send email reports.');
      return;
    }
    const recipientList = recipients.split(/[\n,;]+/).map((r) => r.trim()).filter(Boolean);
    if (recipientList.length === 0) {
      setError('Add at least one recipient email address first.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      // Save current recipients first so send-now uses them
      await nightWatchClient.updateReportSchedule(tenantId, {
        enabled, frequency, dayOfMonth, dayOfWeek, sendTime, timeZone,
        recipients: recipientList, includeAiSummary,
      });

      const result = await nightWatchClient.sendReportNow(tenantId);
      if (result.sent) {
        setSuccess(`Report sent to ${result.recipients} recipient(s) — ${result.fileSizeKb} KB.`);
        // Refresh history
        nightWatchClient.getReportHistory(tenantId, 20).then(setHistory).catch(() => {});
      } else {
        setError('Report send failed. Check server logs for details.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-zinc-500 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PageBackButton />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#c0c0c0]">Scheduled Reports</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white">Report Schedule</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  isHomeTenant
                    ? 'border-white/30 bg-white/15 text-[#c0c0c0]'
                    : 'border-white/30 bg-white/15 text-[#e0e0e0]'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isHomeTenant ? 'bg-red-500' : 'bg-[#c0c0c0]'}`} />
                  {activeTenantName}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {schedule && !schedule.smtpConfigured && (
              <span className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                SMTP not configured
              </span>
            )}
            <button
              type="button"
              disabled={sending || loading}
              onClick={handleSendNow}
              className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
              )}
              {sending ? 'Sending…' : 'Send Report Now'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-3">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-300 hover:text-[#e0e0e0]">✕</button>
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-zinc-500 p-6">
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">Schedule Configuration</h3>

        {loading ? (
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            Loading schedule…
          </div>
        ) : (
          <div className="space-y-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-[#c0c0c0]' : 'bg-zinc-500'} cursor-pointer`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-zinc-500 shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm font-medium text-zinc-200">
                {enabled ? 'Schedule enabled — reports will be sent automatically' : 'Schedule disabled'}
              </span>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'Monthly' | 'Weekly')}
                  className="w-full rounded-xl border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>

              {frequency === 'Monthly' ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Day of Month (1–28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full rounded-xl border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Day of Week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
                  >
                    {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Send Time</label>
                <input
                  type="time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Timezone</label>
                <select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
                >
                  {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Recipient Email Addresses <span className="text-zinc-500">(comma, semicolon, or newline separated)</span>
              </label>
              <textarea
                rows={3}
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="ops@example.com, manager@example.com"
                className="w-full rounded-xl border border-white/10 bg-zinc-500 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAiSummary}
                onChange={(e) => setIncludeAiSummary(e.target.checked)}
                className="h-4 w-4 rounded border-white/10 bg-zinc-500 accent-cyan-500"
              />
              <span className="text-sm text-zinc-300">Include AI summary in scheduled reports</span>
            </label>

            {schedule?.lastSentAt && (
              <p className="text-xs text-zinc-500">
                Last sent: {formatDate(schedule.lastSentAt)}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="flex items-center gap-2 rounded-xl bg-[#c0c0c0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c0c0c0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>}
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-500 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">Recent Send History</h3>
        {historyLoading ? (
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            Loading history…
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-zinc-500">No reports sent yet for this tenant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Sent At</th>
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Type</th>
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Recipients</th>
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500">Size</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {history.map((row) => (
                  <tr key={row.id} className="text-zinc-300">
                    <td className="py-2.5 pr-4 text-xs text-zinc-400">{formatDate(row.sentAt)}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-xs text-[#888888]">
                        {row.reportType}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs">{row.recipientCount}</td>
                    <td className="py-2.5 pr-4 text-xs text-zinc-400">{formatBytes(row.fileSizeBytes)}</td>
                    <td className="py-2.5">{statusChip(row.status)}</td>
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
