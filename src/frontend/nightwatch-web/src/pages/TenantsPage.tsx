import { useEffect, useRef, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import type { CustomerTenant } from '../types/tenant';

export function TenantsPage() {
  const [tenants, setTenants] = useState<CustomerTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addTenantId, setAddTenantId] = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [consentTenantName, setConsentTenantName] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings panel state
  const [settingsTenantId, setSettingsTenantId] = useState<string | null>(null);
  const [settingsLaw, setSettingsLaw] = useState('');
  const [settingsBudget, setSettingsBudget] = useState('');
  const [settingsWebhook, setSettingsWebhook] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await nightWatchClient.getCustomerTenants();
      setTenants(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!addTenantId.trim() || !addDisplayName.trim()) return;
    setAddBusy(true);
    setAddError(null);
    try {
      await nightWatchClient.addCustomerTenant({ tenantId: addTenantId.trim(), displayName: addDisplayName.trim() });
      setAddTenantId('');
      setAddDisplayName('');
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add tenant.');
    } finally {
      setAddBusy(false);
    }
  };

  const handleVerify = async (tenantId: string) => {
    setVerifyingId(tenantId);
    try {
      await nightWatchClient.verifyCustomerTenant(tenantId);
      await load();
    } catch (e) {
      alert(`Verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRemove = async (tenantId: string, name: string) => {
    if (!confirm(`Remove tenant "${name}"? This cannot be undone.`)) return;
    setRemovingId(tenantId);
    try {
      await nightWatchClient.deleteCustomerTenant(tenantId);
      await load();
    } catch (e) {
      alert(`Remove failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setRemovingId(null);
    }
  };

  const openSettings = (tenant: CustomerTenant) => {
    setSettingsTenantId(tenant.tenantId);
    setSettingsLaw(tenant.logAnalyticsWorkspaceId ?? '');
    setSettingsBudget(tenant.monthlyBudgetLimit?.toString() ?? '');
    setSettingsWebhook('');
    setSettingsError(null);
  };

  const handleSaveSettings = async () => {
    if (!settingsTenantId) return;
    setSettingsBusy(true);
    setSettingsError(null);
    try {
      await nightWatchClient.updateCustomerTenantSettings(settingsTenantId, {
        logAnalyticsWorkspaceId: settingsLaw.trim() || null,
        monthlyBudgetLimit: settingsBudget ? parseFloat(settingsBudget) : null,
        teamsWebhookUrl: settingsWebhook.trim() || null,
      });
      setSettingsTenantId(null);
      await load();
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed to save settings.');
    } finally {
      setSettingsBusy(false);
    }
  };

  const handleGetConsentUrl = async (tenantId: string, displayName: string) => {
    try {
      const result = await nightWatchClient.getConsentUrl(tenantId);
      setConsentTenantName(displayName);
      setConsentUrl(result.consentUrl);
      setCopied(false);
    } catch (e) {
      alert(`Could not generate consent URL: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleCopy = () => {
    if (!consentUrl) return;
    navigator.clipboard.writeText(consentUrl).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <span className="ml-3 text-sm">Loading tenants…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Customer Tenants</h2>
        <p className="mt-2 text-sm text-slate-300">
          Manage the Azure tenants NightWatch monitors. Each tenant requires a one-time admin consent
          before data can be pulled.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {/* Add tenant */}
      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Add Tenant</h3>
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 min-w-[200px] rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            placeholder="Azure Tenant ID (GUID)"
            value={addTenantId}
            onChange={(e) => setAddTenantId(e.target.value)}
          />
          <input
            className="flex-1 min-w-[200px] rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            placeholder="Display Name (e.g. Contoso Ltd)"
            value={addDisplayName}
            onChange={(e) => setAddDisplayName(e.target.value)}
          />
          <button
            onClick={handleAdd}
            disabled={addBusy || !addTenantId.trim() || !addDisplayName.trim()}
            className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
          >
            {addBusy ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p className="mt-2 text-xs text-red-400">{addError}</p>}
      </section>

      {/* Tenant list */}
      {tenants.length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-12 text-center">
          <p className="text-slate-400 text-sm">No customer tenants registered yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <div key={tenant.tenantId} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{tenant.displayName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tenant.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'}`}>
                      {tenant.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {tenant.hasTeamsWebhook && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">Teams</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 font-mono">{tenant.tenantId}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
                    {tenant.lastVerifiedAt
                      ? <span>Verified: <span className="text-slate-300">{new Date(tenant.lastVerifiedAt).toLocaleDateString()}</span></span>
                      : <span className="text-amber-400">Not yet verified</span>}
                    {tenant.logAnalyticsWorkspaceId && (
                      <span>LAW: <span className="text-slate-300">{tenant.logAnalyticsWorkspaceId}</span></span>
                    )}
                    {tenant.monthlyBudgetLimit != null && (
                      <span>Budget: <span className="text-slate-300">EUR {tenant.monthlyBudgetLimit.toLocaleString()}/mo</span></span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleGetConsentUrl(tenant.tenantId, tenant.displayName)}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 transition hover:bg-cyan-500/20"
                  >
                    Admin Consent
                  </button>
                  <button
                    onClick={() => handleVerify(tenant.tenantId)}
                    disabled={verifyingId === tenant.tenantId}
                    className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    {verifyingId === tenant.tenantId ? 'Verifying…' : 'Verify'}
                  </button>
                  <button
                    onClick={() => openSettings(tenant)}
                    className="rounded-lg border border-white/15 bg-slate-700/30 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700/50"
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => handleRemove(tenant.tenantId, tenant.displayName)}
                    disabled={removingId === tenant.tenantId}
                    className="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
                  >
                    {removingId === tenant.tenantId ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consent URL modal */}
      {consentUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Admin Consent URL</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Share this link with the Azure Global Admin at <span className="font-semibold text-slate-200">{consentTenantName}</span>. They need to open it and approve the consent request.
                </p>
              </div>
              <button onClick={() => setConsentUrl(null)} className="shrink-0 text-slate-500 hover:text-slate-200" aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3">
              <p className="break-all font-mono text-xs text-cyan-300 leading-relaxed">{consentUrl}</p>
            </div>

            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">Required RBAC Assignments — Root Management Group</p>
              <p className="mb-2 text-xs text-slate-400">The customer admin performing these steps needs the <span className="font-semibold text-amber-200">Owner</span> or <span className="font-semibold text-amber-200">User Access Administrator</span> role on the Root Management Group, and must be a <span className="font-semibold text-amber-200">Global Administrator</span> in Azure AD (for the consent step).</p>
              <p className="mb-3 text-xs text-slate-400">Assign the following roles to the <span className="font-semibold text-slate-200">NightWatch MSP</span> service principal at the <span className="font-semibold text-slate-200">Root Management Group</span> level (IAM → Add role assignment):</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="pb-1.5 pr-4">Role</th>
                    <th className="pb-1.5 pr-4">Type</th>
                    <th className="pb-1.5">Scope</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {[
                    { role: 'Reader', type: 'Built-in' },
                    { role: 'Security Reader', type: 'Built-in' },
                    { role: 'Cost Management Reader', type: 'Built-in' },
                    { role: 'Log Analytics Reader', type: 'Built-in' },
                  ].map(({ role, type }) => (
                    <tr key={role} className="border-b border-white/5">
                      <td className="py-1.5 pr-4 font-medium text-white">{role}</td>
                      <td className="py-1.5 pr-4 text-slate-400">{type}</td>
                      <td className="py-1.5 font-mono text-slate-400">Root Management Group</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setConsentUrl(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition ${copied ? 'bg-emerald-600 text-white' : 'bg-cyan-600 text-white hover:bg-cyan-500'}`}
              >
                {copied ? (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {settingsTenantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-white">Tenant Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-slate-400">Log Analytics Workspace ID</label>
                <input
                  className="w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={settingsLaw}
                  onChange={(e) => setSettingsLaw(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-slate-400">Monthly Budget Limit (EUR)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  placeholder="e.g. 50000"
                  value={settingsBudget}
                  onChange={(e) => setSettingsBudget(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.12em] text-slate-400">Teams Webhook URL</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  placeholder="Leave blank to keep existing"
                  value={settingsWebhook}
                  onChange={(e) => setSettingsWebhook(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-slate-500">Treated as a secret — never displayed after saving.</p>
              </div>
            </div>
            {settingsError && <p className="mt-3 text-xs text-red-400">{settingsError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setSettingsTenantId(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={settingsBusy}
                className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40"
              >
                {settingsBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
