import { useEffect, useState } from 'react';
import { DashboardPicker, dashboardOptions } from '../components/DashboardPicker';
import { saveLayoutToStorage } from '../utils/layoutStorage';
import {
  nightWatchClient,
  type OperationsScope,
  type OperationsSubscription,
  type OperationsWorkspace,
  type TeamsSettings,
} from '../api/client';
import type { DrGovernanceSettings } from '../types/dashboard';
import { useTenant } from '../context/TenantContext';

interface OperationsConfigPageProps {
  onScopeUpdated: () => void;
}

const tenantId = import.meta.env.VITE_DEFAULT_TENANT_ID ?? 'tenant-a';

const defaultDrSettings: DrGovernanceSettings = {
  globalDesiredRpoMinutes: 60,
  globalDesiredRtoMinutes: 120,
  thresholds: {
    greenPercent: 90,
    amberPercent: 75,
    redPercent: 60,
    nearBreachPercent: 85,
  },
  criticalityProfiles: [
    { name: 'Tier 0 - Mission Critical', desiredRpoMinutes: 15, desiredRtoMinutes: 30 },
    { name: 'Tier 1 - Important', desiredRpoMinutes: 60, desiredRtoMinutes: 120 },
    { name: 'Tier 2 - Standard', desiredRpoMinutes: 240, desiredRtoMinutes: 480 },
  ],
  overrides: [],
};

export function OperationsConfigPage({ onScopeUpdated }: OperationsConfigPageProps) {
  const { activeTenantName, activeTenantId, isHomeTenant } = useTenant();
  const [subscriptions, setSubscriptions] = useState<OperationsSubscription[]>([]);
  const [workspaces, setWorkspaces] = useState<OperationsWorkspace[]>([]);
  const [, setScope] = useState<OperationsScope | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState('');
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [aiTarget, setAiTarget] = useState('none');
  const [aiEndpoint, setAiEndpoint] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiApiKeyConfigured, setAiApiKeyConfigured] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiSaveMessage, setAiSaveMessage] = useState<string | null>(null);
  const [aiUsageMonthKey, setAiUsageMonthKey] = useState('');
  const [aiUsageTotalTokens, setAiUsageTotalTokens] = useState(0);
  const [aiUsageEstimatedCostUsd, setAiUsageEstimatedCostUsd] = useState(0);
  const [aiInputRatePer1kUsd, setAiInputRatePer1kUsd] = useState(0);
  const [aiOutputRatePer1kUsd, setAiOutputRatePer1kUsd] = useState(0);
  const [dashboardKeys, setDashboardKeys] = useState<string[]>([]);
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
  const [dashboardSaveMessage, setDashboardSaveMessage] = useState<string | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestMessage, setAiTestMessage] = useState<string | null>(null);
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [drSettings, setDrSettings] = useState<DrGovernanceSettings>(defaultDrSettings);
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(
    () => localStorage.getItem('nightwatch:ai-summary-enabled') === 'true',
  );
  const [isOwner, setIsOwner] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPromptDefault, setAiPromptDefault] = useState('');
  const [aiPromptIsCustom, setAiPromptIsCustom] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [promptSaveMessage, setPromptSaveMessage] = useState<string | null>(null);
  const [teamsSettings, setTeamsSettings] = useState<TeamsSettings>({
    webhookUrl: '',
    dailyReportEnabled: false,
    dailyReportTime: '09:00',
    timeZone: 'UTC',
    alertsEnabled: false,
    customerName: '',
    teamsAiSummaryEnabled: false,
  });
  const [isSavingDr, setIsSavingDr] = useState(false);
  const [drSaveMessage, setDrSaveMessage] = useState<string | null>(null);
  const [isSavingTeams, setIsSavingTeams] = useState(false);
  const [isTestingTeams, setIsTestingTeams] = useState(false);
  const [teamsSaveMessage, setTeamsSaveMessage] = useState<string | null>(null);
  const [teamsTestMessage, setTeamsTestMessage] = useState<string | null>(null);
  const [teamsTestStatus, setTeamsTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportSendMessage, setReportSendMessage] = useState<string | null>(null);

  useEffect(() => {
    setSuccessMessage(null);
    setDrSaveMessage(null);
    setTeamsSaveMessage(null);
    setTeamsTestMessage(null);
    setReportSendMessage(null);
    setError(null);

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [currentScope, discoveredSubscriptions, executiveLayout, discoveredWorkspaces, accessLevel, promptData, teamsData] = await Promise.all([
          nightWatchClient.getOperationsScope(),
          nightWatchClient.getOperationsSubscriptions(),
          nightWatchClient.getExecutiveLayout(tenantId),
          nightWatchClient.getOperationsWorkspaces(),
          nightWatchClient.getAccessLevel(),
          nightWatchClient.getAiBriefingPrompt(),
          nightWatchClient.getTeamsSettings().catch(() => null),
        ]);
        // Reset tenant-specific state on reload so stale values don't bleed across tenant switches
        setSelectedSubscription('');
        setSelectedWorkspaceIds([]);
        setTeamsSettings({ webhookUrl: '', dailyReportEnabled: false, dailyReportTime: '09:00', timeZone: 'UTC', alertsEnabled: false, customerName: '', teamsAiSummaryEnabled: false });
        setIsOwner(accessLevel.isOwner);

        setScope(currentScope);
        setSubscriptions(discoveredSubscriptions);
        setWorkspaces(discoveredWorkspaces);

        const currentSubscription = currentScope.subscriptionIds[0] ?? '';
        const currentAiTarget = currentScope.aiTarget ?? 'none';
        const currentAiEndpoint = currentScope.aiEndpoint ?? '';
        const currentAiModel = currentScope.aiModel ?? '';

        setSelectedSubscription(currentSubscription);
        setSelectedWorkspaceIds(currentScope.logAnalyticsWorkspaceIds ?? []);
        setAiTarget(currentAiTarget);
        setAiEndpoint(currentAiEndpoint);
        setAiModel(currentAiModel);
        setAiApiKeyConfigured(Boolean(currentScope.aiApiKeyConfigured));
        setAiUsageMonthKey(currentScope.aiUsage?.monthKey ?? '');
        setAiUsageTotalTokens(currentScope.aiUsage?.totalTokens ?? 0);
        setAiUsageEstimatedCostUsd(currentScope.aiUsage?.estimatedCostUsd ?? 0);
        setAiInputRatePer1kUsd(currentScope.aiUsageRates?.inputTokenCostPer1kUsd ?? 0);
        setAiOutputRatePer1kUsd(currentScope.aiUsageRates?.outputTokenCostPer1kUsd ?? 0);
        setDrSettings(currentScope.drSettings ?? defaultDrSettings);
        const validKeys = new Set(dashboardOptions.map((d) => d.key));
        setDashboardKeys((executiveLayout.widgetKeys ?? []).filter((k) => validKeys.has(k)));
        setAiPrompt(promptData.prompt);
        setAiPromptDefault(promptData.defaultPrompt);
        setAiPromptIsCustom(promptData.isCustom);
        if (teamsData) setTeamsSettings(teamsData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load operations configuration.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeTenantId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await nightWatchClient.updateOperationsScopeWithAi({
        subscriptionId: selectedSubscription || null,
        logAnalyticsWorkspaceIds: selectedWorkspaceIds.length > 0 ? selectedWorkspaceIds : null,
        aiTarget,
        aiEndpoint,
        aiModel,
        aiApiKey: aiApiKey || null,
        drSettings,
      });

      setScope(updated);
      setAiApiKeyConfigured(Boolean(updated.aiApiKeyConfigured || aiApiKey));
      setAiApiKey('');
      setSuccessMessage(isHomeTenant ? 'Telemetry data scope saved.' : `Scope saved for ${activeTenantName}.`);
      onScopeUpdated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save operations configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAiTarget = async () => {
    setIsSavingAi(true);
    setAiSaveMessage(null);
    setError(null);

    try {
      const updated = await nightWatchClient.updateOperationsScopeWithAi({
        subscriptionId: selectedSubscription || null,
        logAnalyticsWorkspaceIds: selectedWorkspaceIds.length > 0 ? selectedWorkspaceIds : null,
        aiTarget,
        aiEndpoint,
        aiModel,
        aiApiKey: aiApiKey || null,
        drSettings,
      });

      setScope(updated);
      setAiApiKeyConfigured(Boolean(updated.aiApiKeyConfigured || aiApiKey));
      setAiUsageMonthKey(updated.aiUsage?.monthKey ?? aiUsageMonthKey);
      setAiUsageTotalTokens(updated.aiUsage?.totalTokens ?? aiUsageTotalTokens);
      setAiUsageEstimatedCostUsd(updated.aiUsage?.estimatedCostUsd ?? aiUsageEstimatedCostUsd);
      setAiInputRatePer1kUsd(updated.aiUsageRates?.inputTokenCostPer1kUsd ?? aiInputRatePer1kUsd);
      setAiOutputRatePer1kUsd(updated.aiUsageRates?.outputTokenCostPer1kUsd ?? aiOutputRatePer1kUsd);
      setAiApiKey('');
      setAiSaveMessage('AI target saved.');
      onScopeUpdated();
    } catch (saveError) {
      setAiSaveMessage(saveError instanceof Error ? saveError.message : 'Failed to save AI target.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleDashboardSelectionChange = async (nextKeys: string[]) => {
    setDashboardKeys(nextKeys);
    setDashboardSaveMessage(null);
    setIsSavingDashboard(true);
    saveLayoutToStorage(nextKeys);

    try {
      await nightWatchClient.updateExecutiveLayout(nextKeys, tenantId);
      setDashboardSaveMessage('Dashboard selection saved.');
      onScopeUpdated();
    } catch (saveError) {
      setDashboardSaveMessage(saveError instanceof Error ? saveError.message : 'Failed to save dashboard selection.');
    } finally {
      setIsSavingDashboard(false);
    }
  };

  const handleTestAi = async () => {
    setIsTestingAi(true);
    setAiTestMessage(null);
    setAiTestStatus('idle');

    try {
      const result = await nightWatchClient.testAiTarget({
        aiTarget,
        aiEndpoint,
        aiModel,
        aiApiKey: aiApiKey || null,
      });

      const latestScope = await nightWatchClient.getOperationsScope();
      setAiUsageMonthKey(latestScope.aiUsage?.monthKey ?? aiUsageMonthKey);
      setAiUsageTotalTokens(latestScope.aiUsage?.totalTokens ?? aiUsageTotalTokens);
      setAiUsageEstimatedCostUsd(latestScope.aiUsage?.estimatedCostUsd ?? aiUsageEstimatedCostUsd);
      setAiInputRatePer1kUsd(latestScope.aiUsageRates?.inputTokenCostPer1kUsd ?? aiInputRatePer1kUsd);
      setAiOutputRatePer1kUsd(latestScope.aiUsageRates?.outputTokenCostPer1kUsd ?? aiOutputRatePer1kUsd);

      setAiTestMessage(result.message);
      setAiTestStatus(result.reachable ? 'success' : 'warning');
    } catch (testError) {
      setAiTestMessage(testError instanceof Error ? testError.message : 'Failed to test AI target.');
      setAiTestStatus('error');
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    setPromptSaveMessage(null);
    try {
      await nightWatchClient.updateAiBriefingPrompt(aiPrompt);
      setAiPromptIsCustom(true);
      setPromptSaveMessage('Prompt saved. New reports will use this prompt.');
    } catch {
      setPromptSaveMessage('Failed to save prompt.');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleResetPrompt = async () => {
    setIsSavingPrompt(true);
    setPromptSaveMessage(null);
    try {
      const result = await nightWatchClient.resetAiBriefingPrompt();
      setAiPrompt(result.prompt);
      setAiPromptIsCustom(false);
      setPromptSaveMessage('Prompt reset to default.');
    } catch {
      setPromptSaveMessage('Failed to reset prompt.');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleResetLastSent = async () => {
    try {
      await nightWatchClient.resetTeamsLastSent();
      setTeamsSaveMessage('Last sent reset. Auto-trigger will fire next time the scheduled time passes.');
    } catch {
      setTeamsSaveMessage('Failed to reset.');
    }
  };

  const handleSendReportNow = async () => {
    setIsSendingReport(true);
    setReportSendMessage(null);
    try {
      await nightWatchClient.sendTeamsReportNow();
      setReportSendMessage('Report sent to Teams.');
    } catch {
      setReportSendMessage('Failed to send report.');
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleSaveDr = async () => {
    setIsSavingDr(true);
    setDrSaveMessage(null);
    setError(null);
    try {
      await nightWatchClient.updateOperationsScopeWithAi({
        subscriptionId: selectedSubscription || null,
        logAnalyticsWorkspaceIds: selectedWorkspaceIds.length > 0 ? selectedWorkspaceIds : null,
        aiTarget,
        aiEndpoint,
        aiModel,
        aiApiKey: aiApiKey || null,
        drSettings,
      });
      setDrSaveMessage(isHomeTenant ? 'DR settings saved.' : `DR settings saved for ${activeTenantName}.`);
    } catch (saveError) {
      setDrSaveMessage(saveError instanceof Error ? saveError.message : 'Failed to save DR settings.');
    } finally {
      setIsSavingDr(false);
    }
  };

  const handleSaveTeams = async () => {
    setIsSavingTeams(true);
    setTeamsSaveMessage(null);
    try {
      await nightWatchClient.saveTeamsSettings(teamsSettings);
      setTeamsSaveMessage(isHomeTenant ? 'Teams settings saved.' : `Teams settings saved for ${activeTenantName}.`);
    } catch {
      setTeamsSaveMessage('Failed to save Teams settings.');
    } finally {
      setIsSavingTeams(false);
    }
  };

  const handleTestTeams = async () => {
    setIsTestingTeams(true);
    setTeamsTestMessage(null);
    setTeamsTestStatus('idle');
    try {
      const result = await nightWatchClient.sendTeamsTestNotification(teamsSettings.webhookUrl || undefined);
      setTeamsTestMessage(result.success ? 'Test message sent successfully.' : 'Webhook returned an error. Check the URL.');
      setTeamsTestStatus(result.success ? 'success' : 'error');
    } catch {
      setTeamsTestMessage('Failed to send test notification.');
      setTeamsTestStatus('error');
    } finally {
      setIsTestingTeams(false);
    }
  };

  const canSave = !isLoading && !isSaving && isOwner;

  return (
    <div className="space-y-6">
      {!isLoading && !isOwner && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>These settings are read-only. Only platform Owners can make changes.</span>
        </div>
      )}

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-100">Telemetry Data Scope</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${
            isHomeTenant
              ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
              : 'border-violet-400/30 bg-violet-500/10 text-violet-300'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isHomeTenant ? 'bg-cyan-400' : 'bg-violet-400'}`} />
            {isHomeTenant ? 'Home Tenant' : activeTenantName}
          </span>
        </div>
        <p className="mt-2 mb-4 max-w-3xl text-sm text-slate-300">
          {isHomeTenant
            ? 'Select which Azure subscription and Log Analytics workspaces NightWatch should use for live dashboard telemetry. Multiple workspaces are queried in parallel and their results aggregated. This configuration applies immediately.'
            : `Configure the subscription and Log Analytics workspaces for the ${activeTenantName} tenant. These settings are saved independently per tenant and take effect immediately when this tenant is active.`}
        </p>

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading configuration...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Subscription</span>
              <select
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedSubscription}
                disabled={!isOwner}
                onChange={(event) => {
                  setSelectedSubscription(event.target.value);
                }}
              >
                <option value="">All discovered subscriptions</option>
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>{subscription.displayName}</option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Log Analytics Workspaces</span>
              <div className="relative">
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-left text-sm text-slate-100 flex items-center justify-between disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!isOwner}
                  onClick={() => isOwner && setWorkspaceDropdownOpen((prev) => !prev)}
                >
                  <span>
                    {selectedWorkspaceIds.length === 0
                      ? 'Use default configured workspace(s)'
                      : `${selectedWorkspaceIds.length} workspace${selectedWorkspaceIds.length === 1 ? '' : 's'} selected`}
                  </span>
                  <span className="ml-2 text-slate-400">{workspaceDropdownOpen ? '▲' : '▼'}</span>
                </button>

                {workspaceDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/15 bg-slate-900 shadow-xl max-h-56 overflow-y-auto">
                    {workspaces.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400">No workspaces discovered. Ensure a subscription is configured.</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-400 hover:text-cyan-300 border-b border-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!isOwner}
                          onClick={() => setSelectedWorkspaceIds([])}
                        >
                          Clear selection (use defaults)
                        </button>
                        {workspaces.map((ws) => {
                          const checked = selectedWorkspaceIds.includes(ws.workspaceId);
                          return (
                            <label
                              key={ws.workspaceId}
                              className={`flex items-center gap-2 px-3 py-2 hover:bg-white/5 ${isOwner ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                            >
                              <input
                                type="checkbox"
                                className="accent-cyan-400"
                                checked={checked}
                                disabled={!isOwner}
                                onChange={() => {
                                  if (!isOwner) return;
                                  setSelectedWorkspaceIds((prev) =>
                                    checked
                                      ? prev.filter((id) => id !== ws.workspaceId)
                                      : [...prev, ws.workspaceId]
                                  );
                                }}
                              />
                              <span className="text-sm text-slate-100 truncate">{ws.displayName}</span>
                            </label>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
              {selectedWorkspaceIds.length > 0 && (
                <p className="text-xs text-cyan-300">
                  {selectedWorkspaceIds.length} workspace{selectedWorkspaceIds.length === 1 ? '' : 's'} will be queried in parallel.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => { void handleSave(); }}
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Scope'}
          </button>
          {successMessage && <p className="text-sm text-emerald-300">{successMessage}</p>}
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>

      {/* ── DR Governance Defaults (tenant-specific) ── */}
      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-100">DR Governance Defaults</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${
            isHomeTenant
              ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
              : 'border-violet-400/30 bg-violet-500/10 text-violet-300'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isHomeTenant ? 'bg-cyan-400' : 'bg-violet-400'}`} />
            {isHomeTenant ? 'Home Tenant' : activeTenantName}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Configure default DR objectives used by the recoverability dashboard for RPO/RTO compliance and workload criticality.
          {!isHomeTenant && <span className="ml-1 text-violet-300">Settings are scoped to <span className="font-semibold">{activeTenantName}</span>.</span>}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Global RPO (minutes)</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={drSettings.globalDesiredRpoMinutes}
              disabled={!isOwner}
              onChange={(event) => setDrSettings((current) => ({
                ...current,
                globalDesiredRpoMinutes: Number(event.target.value || 0),
              }))}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Global RTO (minutes)</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={drSettings.globalDesiredRtoMinutes}
              disabled={!isOwner}
              onChange={(event) => setDrSettings((current) => ({
                ...current,
                globalDesiredRtoMinutes: Number(event.target.value || 0),
              }))}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Threshold Green (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={drSettings.thresholds.greenPercent}
              disabled={!isOwner}
              onChange={(event) => setDrSettings((current) => ({
                ...current,
                thresholds: { ...current.thresholds, greenPercent: Number(event.target.value || 0) },
              }))}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Threshold Amber (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={drSettings.thresholds.amberPercent}
              disabled={!isOwner}
              onChange={(event) => setDrSettings((current) => ({
                ...current,
                thresholds: { ...current.thresholds, amberPercent: Number(event.target.value || 0) },
              }))}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Threshold Red (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={drSettings.thresholds.redPercent}
              disabled={!isOwner}
              onChange={(event) => setDrSettings((current) => ({
                ...current,
                thresholds: { ...current.thresholds, redPercent: Number(event.target.value || 0) },
              }))}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Near Breach (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={drSettings.thresholds.nearBreachPercent}
              disabled={!isOwner}
              onChange={(event) => setDrSettings((current) => ({
                ...current,
                thresholds: { ...current.thresholds, nearBreachPercent: Number(event.target.value || 0) },
              }))}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={isSavingDr || !isOwner}
            onClick={() => { void handleSaveDr(); }}
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingDr ? 'Saving...' : 'Save DR Settings'}
          </button>
          {drSaveMessage && <p className={`text-sm ${drSaveMessage.startsWith('Failed') ? 'text-rose-300' : 'text-emerald-300'}`}>{drSaveMessage}</p>}
        </div>
      </section>

      {/* ── Teams Notifications ── */}
      <section className="rounded-2xl border border-purple-500/20 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-300">Teams Notifications</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${
            isHomeTenant
              ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
              : 'border-violet-400/30 bg-violet-500/10 text-violet-300'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isHomeTenant ? 'bg-cyan-400' : 'bg-violet-400'}`} />
            {isHomeTenant ? 'Home Tenant' : activeTenantName}
          </span>
        </div>
        <p className="mt-2 mb-4 text-sm text-slate-300">
          Send a daily summary report and critical security alerts to a Microsoft Teams channel via an Incoming Webhook.
          The webhook URL is your shared secret — keep it private.
          {!isHomeTenant && <span className="ml-1 text-violet-300">Settings are scoped to <span className="font-semibold">{activeTenantName}</span>.</span>}
        </p>

        <div className="space-y-4">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Incoming Webhook URL</span>
            <input
              type="password"
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={teamsSettings.webhookUrl}
              disabled={!isOwner}
              onChange={(e) => setTeamsSettings((s) => ({ ...s, webhookUrl: e.target.value }))}
              placeholder={teamsSettings.webhookUrl ? 'Configured (paste new URL to rotate)' : 'Paste webhook URL here'}
            />
            <p className="text-xs text-slate-500">Treat this like a password — it grants anyone the ability to post to your channel.</p>
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Customer / Environment Name</span>
            <input
              type="text"
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={teamsSettings.customerName}
              disabled={!isOwner}
              onChange={(e) => setTeamsSettings((s) => ({ ...s, customerName: e.target.value }))}
              placeholder="e.g. Contoso, Acme Prod, Client A"
            />
            <p className="text-xs text-slate-500">Included in every Teams message so you can identify which environment sent it when multiple tenants post to the same channel.</p>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Daily Report Time (HH:mm)</span>
              <input
                type="time"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                value={teamsSettings.dailyReportTime}
                disabled={!isOwner}
                onChange={(e) => setTeamsSettings((s) => ({ ...s, dailyReportTime: e.target.value }))}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Time Zone</span>
              <select
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                value={teamsSettings.timeZone}
                disabled={!isOwner}
                onChange={(e) => setTeamsSettings((s) => ({ ...s, timeZone: e.target.value }))}
              >
                <option value="UTC">UTC — Coordinated Universal Time</option>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT / BST)</option>
                  <option value="Europe/Dublin">Dublin (GMT / IST)</option>
                  <option value="Europe/Paris">Paris / Berlin / Amsterdam (CET / CEST)</option>
                  <option value="Europe/Helsinki">Helsinki / Kyiv (EET / EEST)</option>
                  <option value="Europe/Istanbul">Istanbul (TRT)</option>
                  <option value="Europe/Moscow">Moscow (MSK)</option>
                </optgroup>
                <optgroup label="Middle East &amp; Africa">
                  <option value="Asia/Dubai">Dubai / Abu Dhabi (GST)</option>
                  <option value="Asia/Riyadh">Riyadh (AST)</option>
                  <option value="Africa/Johannesburg">Johannesburg (SAST)</option>
                  <option value="Africa/Cairo">Cairo (EET)</option>
                </optgroup>
                <optgroup label="Asia &amp; Pacific">
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Asia/Dhaka">Bangladesh (BST)</option>
                  <option value="Asia/Bangkok">Bangkok / Jakarta (ICT / WIB)</option>
                  <option value="Asia/Singapore">Singapore / Kuala Lumpur (SGT / MYT)</option>
                  <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                  <option value="Asia/Shanghai">China (CST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Seoul">Seoul (KST)</option>
                  <option value="Australia/Perth">Perth (AWST)</option>
                  <option value="Australia/Sydney">Sydney / Melbourne (AEST / AEDT)</option>
                  <option value="Pacific/Auckland">Auckland (NZST / NZDT)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="America/New_York">New York / Miami (ET)</option>
                  <option value="America/Chicago">Chicago / Dallas (CT)</option>
                  <option value="America/Denver">Denver / Phoenix (MT)</option>
                  <option value="America/Los_Angeles">Los Angeles / Seattle (PT)</option>
                  <option value="America/Anchorage">Anchorage (AKT)</option>
                  <option value="Pacific/Honolulu">Honolulu (HST)</option>
                  <option value="America/Toronto">Toronto (ET)</option>
                  <option value="America/Vancouver">Vancouver (PT)</option>
                  <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                  <option value="America/Argentina/Buenos_Aires">Buenos Aires (ART)</option>
                  <option value="America/Mexico_City">Mexico City (CST / CDT)</option>
                </optgroup>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className={`flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 ${isOwner ? 'cursor-pointer hover:border-purple-400/30' : 'cursor-not-allowed opacity-60'}`}>
              <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${teamsSettings.dailyReportEnabled ? 'bg-purple-500' : 'bg-slate-600'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${teamsSettings.dailyReportEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={teamsSettings.dailyReportEnabled}
                disabled={!isOwner}
                onChange={(e) => setTeamsSettings((s) => ({ ...s, dailyReportEnabled: e.target.checked }))}
              />
              <span className="text-sm text-slate-100">Enable daily report</span>
            </label>

            <label className={`flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 ${isOwner ? 'cursor-pointer hover:border-purple-400/30' : 'cursor-not-allowed opacity-60'}`}>
              <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${teamsSettings.alertsEnabled ? 'bg-rose-500' : 'bg-slate-600'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${teamsSettings.alertsEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={teamsSettings.alertsEnabled}
                disabled={!isOwner}
                onChange={(e) => setTeamsSettings((s) => ({ ...s, alertsEnabled: e.target.checked }))}
              />
              <span className="text-sm text-slate-100">Enable critical alerts</span>
            </label>

            <label className={`flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 ${isOwner ? 'cursor-pointer hover:border-cyan-400/30' : 'cursor-not-allowed opacity-60'}`}>
              <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${teamsSettings.teamsAiSummaryEnabled ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${teamsSettings.teamsAiSummaryEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={teamsSettings.teamsAiSummaryEnabled}
                disabled={!isOwner}
                onChange={(e) => setTeamsSettings((s) => ({ ...s, teamsAiSummaryEnabled: e.target.checked }))}
              />
              <div>
                <p className="text-sm text-slate-100">Include AI summary in report</p>
                <p className="text-xs text-slate-400">Requires AI target to be configured in AI settings above</p>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isTestingTeams || !teamsSettings.webhookUrl}
            onClick={() => { void handleTestTeams(); }}
            className="rounded-xl border border-purple-400/40 bg-purple-500/20 px-4 py-2 text-sm font-semibold text-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTestingTeams ? 'Sending...' : 'Send Test Message'}
          </button>
          <button
            type="button"
            disabled={isSendingReport || !teamsSettings.webhookUrl}
            onClick={() => { void handleSendReportNow(); }}
            className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSendingReport ? 'Sending...' : 'Send Report Now'}
          </button>
          <button
            type="button"
            disabled={isSavingTeams || !isOwner}
            onClick={() => { void handleSaveTeams(); }}
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingTeams ? 'Saving...' : 'Save Teams Settings'}
          </button>
          <button
            type="button"
            disabled={!isOwner}
            onClick={() => { void handleResetLastSent(); }}
            className="rounded-xl border border-slate-500/40 bg-slate-700/40 px-4 py-2 text-sm font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            title="Clear the last sent timestamp so the auto-trigger can fire again today"
          >
            Reset Last Sent
          </button>
          {teamsTestMessage && (
            <p className={`text-sm ${teamsTestStatus === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {teamsTestMessage}
            </p>
          )}
          {reportSendMessage && (
            <p className={`text-sm ${reportSendMessage.startsWith('Failed') ? 'text-rose-300' : 'text-emerald-300'}`}>
              {reportSendMessage}
            </p>
          )}
        </div>
        {teamsSaveMessage && (
          <p className={`mt-2 text-sm ${teamsSaveMessage.startsWith('Failed') ? 'text-rose-300' : 'text-emerald-300'}`}>
            {teamsSaveMessage}
          </p>
        )}
      </section>

      {/* ── AI Settings (global) ── */}
      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-100">AI Summary Target</h3>
        <p className="mt-2 text-sm text-slate-300">
          Configure the model endpoint used by the Executive PDF export. The API sends full dashboard payload to this target for summary generation.
        </p>

        <label className={`mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 transition ${isOwner ? 'cursor-pointer hover:border-cyan-400/30' : 'cursor-not-allowed opacity-60'}`}>
          <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${aiSummaryEnabled ? 'bg-cyan-500' : 'bg-slate-600'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${aiSummaryEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <input
            type="checkbox"
            className="sr-only"
            checked={aiSummaryEnabled}
            disabled={!isOwner}
            onChange={(e) => {
              if (!isOwner) return;
              setAiSummaryEnabled(e.target.checked);
              localStorage.setItem('nightwatch:ai-summary-enabled', String(e.target.checked));
            }}
          />
          <div>
            <p className="text-sm font-medium text-slate-100">Enable AI Summary in Reports</p>
            <p className="text-xs text-slate-400">When enabled, both the PDF and HTML report exports will call the configured AI endpoint to generate an executive summary and action plan. Disable to export without an AI call.</p>
          </div>
        </label>
        <p className="mt-2 text-xs text-cyan-200">
          AI usage this month ({aiUsageMonthKey || 'current month'}): ~${aiUsageEstimatedCostUsd.toFixed(4)} estimated, {aiUsageTotalTokens.toLocaleString()} tokens. Resets every month.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Rate card: input ${aiInputRatePer1kUsd.toFixed(4)} / 1K tokens, output ${aiOutputRatePer1kUsd.toFixed(4)} / 1K tokens.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Target</span>
            <select
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={aiTarget}
              disabled={!isOwner}
              onChange={(event) => setAiTarget(event.target.value)}
            >
              <option value="none">None (fallback summary)</option>
              <option value="azure-openai">Azure OpenAI / Foundry</option>
              <option value="openai">OpenAI-compatible endpoint</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Model / Deployment</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={aiModel}
              disabled={!isOwner}
              onChange={(event) => setAiModel(event.target.value)}
              placeholder="gpt-4o-mini or deployment name"
              type="text"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Endpoint</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={aiEndpoint}
              disabled={!isOwner}
              onChange={(event) => setAiEndpoint(event.target.value)}
              placeholder="https://your-resource.openai.azure.com or https://api.openai.com"
              type="text"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">API Key</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={aiApiKey}
              disabled={!isOwner}
              onChange={(event) => setAiApiKey(event.target.value)}
              placeholder={aiApiKeyConfigured ? 'Configured (enter new key to rotate)' : 'Enter API key'}
              type="password"
            />
            <p className="text-xs text-slate-400">
              Key status: <span className="text-cyan-200">{aiApiKeyConfigured ? 'configured' : 'not configured'}</span>
            </p>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={isTestingAi || !isOwner}
            onClick={() => { void handleTestAi(); }}
            className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTestingAi ? 'Testing...' : 'Test AI Connection'}
          </button>
          <button
            type="button"
            disabled={isSavingAi || !isOwner}
            onClick={() => { void handleSaveAiTarget(); }}
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingAi ? 'Saving...' : 'Save AI Target'}
          </button>
          {aiTestMessage ? (
            <p className={`whitespace-pre-line text-sm ${aiTestStatus === 'success' ? 'text-emerald-300' : aiTestStatus === 'warning' ? 'text-amber-300' : aiTestStatus === 'error' ? 'text-rose-300' : 'text-slate-300'}`}>
              {aiTestMessage}
            </p>
          ) : null}
        </div>
        {aiSaveMessage ? <p className="mt-2 text-sm text-cyan-200">{aiSaveMessage}</p> : null}
      </section>

      {/* ── AI Report Prompt Editor ── */}
      <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-5">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Report AI Prompt</h3>
            {aiPromptIsCustom && (
              <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Custom
              </span>
            )}
          </div>
          {isOwner && aiPromptIsCustom && (
            <button
              type="button"
              disabled={isSavingPrompt}
              onClick={() => { void handleResetPrompt(); }}
              className="shrink-0 rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Reset to Default
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-slate-400">
          This prompt is sent to the AI when generating HTML or PDF reports. Edit it to customise the tone, structure, or focus of the executive briefing and action plan.
          The separator <code className="rounded bg-slate-800 px-1 font-mono text-xs text-cyan-300">---ACTION PLAN---</code> must remain in the prompt so the report can split the narrative from the action plan boxes.
        </p>
        <textarea
          rows={14}
          disabled={!isOwner}
          value={aiPrompt}
          onChange={(e) => { setAiPrompt(e.target.value); setPromptSaveMessage(null); }}
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-xs leading-relaxed text-slate-200 focus:border-cyan-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          spellCheck={false}
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {isSavingPrompt
              ? 'Saving...'
              : promptSaveMessage
                ? <span className={promptSaveMessage.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}>{promptSaveMessage}</span>
                : aiPromptIsCustom
                  ? 'You are using a custom prompt.'
                  : 'Using the default prompt.'}
          </p>
          {isOwner && (
            <button
              type="button"
              disabled={isSavingPrompt || aiPrompt === (aiPromptIsCustom ? aiPrompt : aiPromptDefault)}
              onClick={() => { void handleSavePrompt(); }}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save Prompt
            </button>
          )}
        </div>
        {isOwner && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">Show default prompt for reference</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/8 bg-slate-900/60 p-3 font-mono text-[11px] leading-relaxed text-slate-500">{aiPromptDefault}</pre>
          </details>
        )}
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-100 mb-2">My Dashboard Selection</h3>
        <p className="mb-3 text-sm text-slate-300">
          Select dashboard widgets using the multi-select list below. Selection is auto-saved per user and shown in My Dashboard.
        </p>
        <DashboardPicker value={dashboardKeys} onChange={(next) => { void handleDashboardSelectionChange(next); }} />
        <p className="mt-2 text-xs text-slate-400">
          {isSavingDashboard ? 'Saving selection...' : dashboardSaveMessage ?? 'Changes save automatically when you check/uncheck dashboards.'}
        </p>
      </section>

    </div>
  );
}
