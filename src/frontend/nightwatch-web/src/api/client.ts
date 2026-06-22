import axios from 'axios';
import { acquireApiToken, handleApiUnauthorized } from '../auth/authService';
import { resolveApiBaseUrl } from '../config/apiBaseUrl';
import type { CustomerTenant, AddTenantRequest, UpdateTenantSettingsRequest, LogAnalyticsWorkspace } from '../types/tenant';
import type {
  CostAnomalyForecastDashboard,
  CostDashboard,
  CapacityPlanningDashboard,
  DrDashboard,
  DrGovernanceSettings,
  NetworkTopologyDashboard,
  ExecutiveDashboard,
  GovernanceDashboard,
  PerformanceDashboard,
  SecurityDashboard,
  StrategicDashboard,
  ResourceDeepDive,
  SmartFeatures,
  TenantOverview,
  ExecutiveLayout,
  QuickWinsDashboard,
  TopCostlyResourcesDashboard,
  ChangesDashboard,
  TagHygieneDashboard,
  OrphanedResourcesDashboard,
  BackupHealthDashboard,
  IamReviewDashboard,
  WastageTrackerDashboard,
  NetworkPerimeterDashboard,
  NonProdUptimeDashboard,
  RiSavingsDashboard,
  AppFunctionsHealthDashboard,
  AzPolicyLensDashboard,
  DatabaseHealthDashboard,
  KeyVaultHealthDashboard,
  AksContainerHealthDashboard,
  StorageComplianceDashboard,
  ServiceHealthDashboard,
  ManagedIdentityAuditDashboard,
  AdvisorScoreDashboard,
  MessagingHealthDashboard,
  SupportTicketDashboard,
  VmssHealthDashboard,
  AlertsDashboard,
  ExpressRouteDashboard,
  VwanDashboard,
  AzureFirewallDashboard,
  AppGatewayDashboard,
  VpnGatewayDashboard,
  AggregateDashboard,
  IdentityAttackSurfaceDashboard,
  SubscriptionCostDashboard,
} from '../types/dashboard';

const resolvedApiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const api = axios.create({
  baseURL: resolvedApiBaseUrl,
  timeout: 90000,
});

let _activeTenantId: string = import.meta.env.VITE_DEFAULT_TENANT_ID ?? 'global';
export function setActiveTenantId(id: string) { _activeTenantId = id; }
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inFlightRequests = new Map<string, Promise<unknown>>();

interface ApiRequestOptions {
  canRetry?: boolean;
  useCache?: boolean;
  cacheTtlMs?: number;
  cacheBustKey?: string | number;
}

export interface OperationsSubscription {
  id: string;
  displayName: string;
}

export interface OperationsWorkspace {
  workspaceId: string;
  displayName: string;
}

export interface OperationsScope {
  subscriptionIds: string[];
  logAnalyticsWorkspaceIds: string[];
  aiTarget: string;
  aiEndpoint: string;
  aiModel: string;
  aiApiKeyConfigured: boolean;
  aiUsage?: {
    monthKey: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    lastUpdatedUtc?: string | null;
  };
  aiUsageRates?: {
    inputTokenCostPer1kUsd: number;
    outputTokenCostPer1kUsd: number;
  };
  drSettings: DrGovernanceSettings;
  updatedAtUtc: string;
}

export interface ExecutivePdfSummary {
  tenantId: string;
  generatedAtUtc: string;
  aiTarget: string;
  aiModel: string;
  summary: string;
}

export interface ExecutivePdfSummaryRequest {
  visibleWidgetKeys?: string[];
}

export interface AiTargetTestResult {
  reachable: boolean;
  fallback: boolean;
  target: string;
  model: string;
  message: string;
}

export interface AiTargetTestRequest {
  aiTarget?: string | null;
  aiEndpoint?: string | null;
  aiModel?: string | null;
  aiApiKey?: string | null;
}

export interface TeamsSettings {
  webhookUrl: string;
  dailyReportEnabled: boolean;
  dailyReportTime: string;
  timeZone: string;
  alertsEnabled: boolean;
  customerName: string;
  teamsAiSummaryEnabled: boolean;
}

export interface ReportSchedule {
  tenantId: string;
  enabled: boolean;
  frequency: 'Monthly' | 'Weekly';
  dayOfMonth: number;
  dayOfWeek: string;
  sendTime: string;
  timeZone: string;
  recipients: string[];
  includeAiSummary: boolean;
  lastSentAt: string | null;
  smtpConfigured: boolean;
}

export interface UpsertReportScheduleRequest {
  enabled: boolean;
  frequency: 'Monthly' | 'Weekly';
  dayOfMonth: number;
  dayOfWeek: string;
  sendTime: string;
  timeZone: string;
  recipients: string[];
  includeAiSummary: boolean;
}

export interface ReportSentLog {
  id: number;
  tenantId: string;
  displayName: string;
  sentAt: string;
  recipientCount: number;
  status: string;
  errorMessage: string | null;
  fileSizeBytes: number;
  reportType: string;
}

export interface MonthlyHealthSnapshot {
  tenantId: string;
  snapshotMonth: string;
  monthLabel: string;
  azureHealthScore: number;
  securityPostureScore: number;
  performanceScore: number;
  costEfficiencyScore: number;
  reliabilityScore: number;
  governanceComplianceScore: number;
  activeCriticalAlerts: number;
  backupCoveragePercent: number;
  subscriptionCount: number;
  capturedAt: string;
  azureHealthDelta: number | null;
  securityDelta: number | null;
  performanceDelta: number | null;
  costDelta: number | null;
  reliabilityDelta: number | null;
  governanceDelta: number | null;
}

export interface HealthSnapshotHistory {
  tenantId: string;
  months: MonthlyHealthSnapshot[];
  totalMonths: number;
}

// ── Environment Review types ─────────────────────────────────────────────────
export interface EnvironmentReviewSummary {
  id: number;
  tenantId: string;
  customerName: string;
  reviewDate: string;
  reviewedBy: string;
  status: string;
  overallMaturity: string | null;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewFinding {
  id: number;
  reviewId: number;
  pillar: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  evidence: string | null;
  effortEstimate: string | null;
  status: string;
  libraryRef: string | null;
  createdAt: string;
}

export interface EnvironmentReviewDetail extends EnvironmentReviewSummary {
  scope: string | null;
  executiveSummary: string | null;
  findings: ReviewFinding[];
}

export interface CreateEnvironmentReviewRequest {
  customerName: string;
  reviewDate: string;
  reviewedBy: string;
  scope?: string;
  executiveSummary?: string;
  overallMaturity?: string;
}

export interface CreateReviewFindingRequest {
  pillar: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  evidence?: string;
  effortEstimate?: string;
  libraryRef?: string;
}

export interface FindingLibraryItem {
  ref: string;
  pillar: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  effortEstimate: string | null;
}

export interface SuggestedAction {
  title: string;
  description: string;
  priority: string;
  category: string;
  targetPage: string;
}

function tenantHeader(): Record<string, string> {
  return _activeTenantId !== 'global' ? { 'X-Tenant-Id': _activeTenantId } : {};
}

async function getFromApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    canRetry = true,
    useCache = false,
    cacheTtlMs = 45_000,
    cacheBustKey,
  } = options;
  const cacheKey = `${path}::${cacheBustKey ?? 'stable'}`;

  if (useCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const request = (async () => {
  try {
    const token = await acquireApiToken();
    if (!token && canRetry) {
      // During interactive auth redirects, initial requests may be aborted before tokens settle.
      // Disable cache on internal retry to avoid returning the same in-flight promise.
      return getFromApi<T>(path, { ...options, canRetry: false, useCache: false });
    }

    // Proceed without auth header when MSAL is disabled (dev/test); backend returns 401 if needed.
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...tenantHeader() };
    const response = await api.get<T>(path, { headers });
    if (useCache) {
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        value: response.data,
      });
    }
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const shouldRetryTransient = !error.response && canRetry;
      if (shouldRetryTransient) {
        // Disable cache on internal retry to avoid waiting on the current in-flight request.
        return getFromApi<T>(path, { ...options, canRetry: false, useCache: false });
      }

      if (!error.response) {
        throw new Error(
          `Network Error while calling ${resolvedApiBaseUrl}${path}. ` +
          'Verify VITE_API_BASE_URL, API availability, and CORS settings.',
        );
      }

      if (error.response.status === 401) {
        handleApiUnauthorized();
        throw new Error('Authentication expired or invalid. Sign out and sign in again with your Azure AD organizational account.');
      }

      throw new Error(error.response?.data?.message ?? error.message ?? `Request failed for ${path}`);
    }

    throw error instanceof Error ? error : new Error(`Request failed for ${path}`);
  } finally {
    if (useCache) {
      inFlightRequests.delete(cacheKey);
    }
  }
  })();

  if (useCache) {
    inFlightRequests.set(cacheKey, request as Promise<unknown>);
  }

  return request;
}

async function putToApi<T>(path: string, payload: unknown): Promise<T> {
  const token = await acquireApiToken();
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...tenantHeader() };
  try {
    const response = await api.put<T>(path, payload, { headers });
    responseCache.clear();
    inFlightRequests.clear();
    return response.data;
  } catch (err) { throw extractApiError(err); }
}

function extractApiError(err: unknown): Error {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: unknown } }).response;
    if (res?.data) {
      const data = res.data;
      if (typeof data === 'string' && data.length > 0) return new Error(data);
      if (typeof data === 'object' && data !== null && 'detail' in data) return new Error(String((data as { detail: unknown }).detail));
      if (typeof data === 'object' && data !== null && 'title' in data) return new Error(String((data as { title: unknown }).title));
    }
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function postToApi<T>(path: string, payload?: unknown): Promise<T> {
  const token = await acquireApiToken();
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...tenantHeader() };
  try {
    const response = await api.post<T>(path, payload ?? {}, { headers });
    return response.data;
  } catch (err) { throw extractApiError(err); }
}

async function deleteFromApi(path: string): Promise<void> {
  const token = await acquireApiToken();
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...tenantHeader() };
  try {
    await api.delete(path, { headers });
  } catch (err) { throw extractApiError(err); }
}

export function clearCache(): void {
  responseCache.clear();
  inFlightRequests.clear();
}

export const nightWatchClient = {
  clearServerCache: () =>
    postToApi<void>('/api/cache/clear'),
  getExecutiveDashboard: (cacheBustKey?: string | number) =>
    getFromApi<ExecutiveDashboard>(`/api/dashboard/executive/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getNetworkTopologyDashboard: (cacheBustKey?: string | number) =>
    getFromApi<NetworkTopologyDashboard>(`/api/dashboard/executive/network-topology/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getExecutiveLayout: (requestedTenantId = _activeTenantId) =>
    getFromApi<ExecutiveLayout>(`/api/dashboard/executive-layout/${encodeURIComponent(requestedTenantId)}`),
  updateExecutiveLayout: (widgetKeys: string[], requestedTenantId = _activeTenantId) =>
    putToApi<ExecutiveLayout>(`/api/dashboard/executive-layout/${encodeURIComponent(requestedTenantId)}`, { widgetKeys }),
  getSecurityDashboard: (cacheBustKey?: string | number) =>
    getFromApi<SecurityDashboard>(`/api/dashboard/security/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getPerformanceDashboard: (cacheBustKey?: string | number) =>
    getFromApi<PerformanceDashboard>(`/api/dashboard/performance/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getCostDashboard: (cacheBustKey?: string | number) =>
    getFromApi<CostDashboard>(`/api/dashboard/cost/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getGovernanceDashboard: (cacheBustKey?: string | number) =>
    getFromApi<GovernanceDashboard>(`/api/dashboard/governance/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getSmartFeatures: (cacheBustKey?: string | number) =>
    getFromApi<SmartFeatures>(`/api/dashboard/smart/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAzureTenantOverview: (cacheBustKey?: string | number) =>
    getFromApi<TenantOverview[]>('/api/tenants/azure-overview', { useCache: true, cacheBustKey }),
  getCustomerTenants: () =>
    getFromApi<CustomerTenant[]>('/api/tenants'),
  addCustomerTenant: (request: AddTenantRequest) =>
    postToApi<CustomerTenant>('/api/tenants', request),
  deleteCustomerTenant: (tenantId: string) =>
    deleteFromApi(`/api/tenants/${encodeURIComponent(tenantId)}`),
  verifyCustomerTenant: (tenantId: string) =>
    postToApi<{ verified: boolean }>(`/api/tenants/${encodeURIComponent(tenantId)}/verify`, {}),
  updateCustomerTenantSettings: (tenantId: string, request: UpdateTenantSettingsRequest) =>
    putToApi<CustomerTenant>(`/api/tenants/${encodeURIComponent(tenantId)}/settings`, request),
  getCustomerTenantWorkspaces: (tenantId: string) =>
    getFromApi<LogAnalyticsWorkspace[]>(`/api/tenants/${encodeURIComponent(tenantId)}/workspaces`),
  getConsentUrl: (tenantId: string) =>
    getFromApi<{ consentUrl: string }>(`/api/admin/consent-url?tenantId=${encodeURIComponent(tenantId)}`),
  getStrategicDashboard: (dashboardKey: string, cacheBustKey?: string | number) =>
    getFromApi<StrategicDashboard>(`/api/dashboard/strategic/${dashboardKey}/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getResourceDeepDive: (resourceId: string, cacheBustKey?: string | number) =>
    getFromApi<ResourceDeepDive>(`/api/resources/deep-dive/${_activeTenantId}?resourceId=${encodeURIComponent(resourceId)}`, { useCache: true, cacheBustKey, cacheTtlMs: 30_000 }),
  getCapacityPlanningDashboard: (timeRange: string, cacheBustKey?: string | number) =>
    getFromApi<CapacityPlanningDashboard>(`/api/dashboard/capacity-planning/${_activeTenantId}?timeRange=${encodeURIComponent(timeRange)}`, { useCache: true, cacheBustKey }),
  getCostAnomalyForecastDashboard: (timeRange: string, cacheBustKey?: string | number) =>
    getFromApi<CostAnomalyForecastDashboard>(`/api/dashboard/cost-anomaly-forecast/${_activeTenantId}?timeRange=${encodeURIComponent(timeRange)}`, { useCache: true, cacheBustKey }),
  getDrDashboard: (cacheBustKey?: string | number) =>
    getFromApi<DrDashboard>(`/api/dashboard/dr/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getTopCostlyResourcesDashboard: (cacheBustKey?: string | number) =>
    getFromApi<TopCostlyResourcesDashboard>(`/api/dashboard/top-costly-resources/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getSubscriptionCostDashboard: (months: number, cacheBustKey?: string | number) =>
    getFromApi<SubscriptionCostDashboard>(`/api/dashboard/subscription-cost/${_activeTenantId}?months=${months}`, { useCache: true, cacheBustKey }),
  getOperationsScope: () =>
    getFromApi<OperationsScope>('/api/operations-config'),
  updateOperationsScope: (payload: { subscriptionId?: string | null; logAnalyticsWorkspaceIds?: string[] | null }) =>
    putToApi<OperationsScope>('/api/operations-config', {
      subscriptionId: payload.subscriptionId ?? null,
      logAnalyticsWorkspaceIds: payload.logAnalyticsWorkspaceIds ?? null,
      aiTarget: null,
      aiEndpoint: null,
      aiModel: null,
      aiApiKey: null,
      drSettings: null,
    }),
  updateOperationsScopeWithAi: (payload: {
    subscriptionId?: string | null;
    logAnalyticsWorkspaceIds?: string[] | null;
    aiTarget?: string | null;
    aiEndpoint?: string | null;
    aiModel?: string | null;
    aiApiKey?: string | null;
    drSettings?: DrGovernanceSettings | null;
  }) =>
    putToApi<OperationsScope>('/api/operations-config', {
      subscriptionId: payload.subscriptionId ?? null,
      logAnalyticsWorkspaceIds: payload.logAnalyticsWorkspaceIds ?? null,
      aiTarget: payload.aiTarget ?? null,
      aiEndpoint: payload.aiEndpoint ?? null,
      aiModel: payload.aiModel ?? null,
      aiApiKey: payload.aiApiKey ?? null,
      drSettings: payload.drSettings ?? null,
    }),
  getOperationsSubscriptions: () =>
    getFromApi<OperationsSubscription[]>('/api/operations-config/subscriptions'),
  getOperationsWorkspaces: () =>
    getFromApi<OperationsWorkspace[]>('/api/operations-config/workspaces'),
  testAiTarget: (payload?: AiTargetTestRequest) =>
    postToApi<AiTargetTestResult>('/api/operations-config/ai/test', {
      aiTarget: payload?.aiTarget ?? null,
      aiEndpoint: payload?.aiEndpoint ?? null,
      aiModel: payload?.aiModel ?? null,
      aiApiKey: payload?.aiApiKey ?? null,
    }),
  generateExecutivePdfSummary: (requestedTenantId = _activeTenantId, payload?: ExecutivePdfSummaryRequest) =>
    postToApi<ExecutivePdfSummary>(`/api/dashboard/export/executive/${encodeURIComponent(requestedTenantId)}/pdf-summary`, payload ?? {}),
  generateConsolidatedPdfSummary: (requestedTenantId = _activeTenantId) =>
    postToApi<ExecutivePdfSummary>(`/api/dashboard/export/consolidated/${encodeURIComponent(requestedTenantId)}/pdf-summary`),
  getQuickWinsDashboard: (cacheBustKey?: string | number) =>
    getFromApi<QuickWinsDashboard>(`/api/dashboard/quick-wins/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getIntelligenceFeed: (cacheBustKey?: string | number) =>
    getFromApi<unknown[]>('/api/intelligence/feed', { useCache: true, cacheTtlMs: 30_000, cacheBustKey }),
  getChangesDashboard: (timeRange: string, cacheBustKey?: string | number) =>
    getFromApi<ChangesDashboard>(`/api/dashboard/changes/${_activeTenantId}?timeRange=${encodeURIComponent(timeRange)}`, { useCache: true, cacheTtlMs: 30_000, cacheBustKey }),
  getTagHygieneDashboard: (cacheBustKey?: string | number) =>
    getFromApi<TagHygieneDashboard>(`/api/dashboard/tag-hygiene-compliance/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getOrphanedResourcesDashboard: (cacheBustKey?: string | number) =>
    getFromApi<OrphanedResourcesDashboard>(`/api/dashboard/orphaned-resources/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getBackupHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<BackupHealthDashboard>(`/api/dashboard/backup-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getIamReviewDashboard: (cacheBustKey?: string | number) =>
    getFromApi<IamReviewDashboard>(`/api/dashboard/iam-review/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getWastageTrackerDashboard: (cacheBustKey?: string | number) =>
    getFromApi<WastageTrackerDashboard>(`/api/dashboard/wastage-tracker/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getNetworkPerimeterDashboard: (cacheBustKey?: string | number) =>
    getFromApi<NetworkPerimeterDashboard>(`/api/dashboard/network-perimeter/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getNonProdUptimeDashboard: (cacheBustKey?: string | number) =>
    getFromApi<NonProdUptimeDashboard>(`/api/dashboard/nonprod-uptime-leakage/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getRiSavingsDashboard: (cacheBustKey?: string | number) =>
    getFromApi<RiSavingsDashboard>(`/api/dashboard/ri-savings/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAppFunctionsHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AppFunctionsHealthDashboard>(`/api/dashboard/app-functions-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAzPolicyLensDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AzPolicyLensDashboard>(`/api/dashboard/policy-radar/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getDatabaseHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<DatabaseHealthDashboard>(`/api/dashboard/database-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getKeyVaultHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<KeyVaultHealthDashboard>(`/api/dashboard/key-vault-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAksContainerHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AksContainerHealthDashboard>(`/api/dashboard/aks-container-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getStorageComplianceDashboard: (cacheBustKey?: string | number) =>
    getFromApi<StorageComplianceDashboard>(`/api/dashboard/storage-compliance/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getServiceHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<ServiceHealthDashboard>(`/api/dashboard/service-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getManagedIdentityAuditDashboard: (cacheBustKey?: string | number) =>
    getFromApi<ManagedIdentityAuditDashboard>(`/api/dashboard/managed-identity-audit/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAdvisorScoreDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AdvisorScoreDashboard>(`/api/dashboard/advisor-score/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getMessagingHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<MessagingHealthDashboard>(`/api/dashboard/messaging-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getSupportTicketDashboard: (cacheBustKey?: string | number) =>
    getFromApi<SupportTicketDashboard>(`/api/dashboard/support-tickets/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getVmssHealthDashboard: (cacheBustKey?: string | number) =>
    getFromApi<VmssHealthDashboard>(`/api/dashboard/vmss-health/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAlertsDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AlertsDashboard>(`/api/dashboard/alerts/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getExpressRouteDashboard: (cacheBustKey?: string | number) =>
    getFromApi<ExpressRouteDashboard>(`/api/dashboard/expressroute/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getVwanDashboard: (cacheBustKey?: string | number) =>
    getFromApi<VwanDashboard>(`/api/dashboard/vwan/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAzureFirewallDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AzureFirewallDashboard>(`/api/dashboard/azure-firewall/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAppGatewayDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AppGatewayDashboard>(`/api/dashboard/app-gateway/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getVpnGatewayDashboard: (cacheBustKey?: string | number) =>
    getFromApi<VpnGatewayDashboard>(`/api/dashboard/vpn-gateway/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getIdentityAttackSurfaceDashboard: (cacheBustKey?: string | number) =>
    getFromApi<IdentityAttackSurfaceDashboard>(`/api/dashboard/identity-attack-surface/${_activeTenantId}`, { useCache: true, cacheBustKey }),
  getAggregateDashboard: (cacheBustKey?: string | number) =>
    getFromApi<AggregateDashboard>(`/api/dashboard/aggregate/${_activeTenantId}`, { useCache: true, cacheTtlMs: 900_000, cacheBustKey }),
  getAccessLevel: () =>
    getFromApi<{ isOwner: boolean; canEdit: boolean }>('/api/operations-config/access-level')
      .catch(() => ({ isOwner: false, canEdit: false })),
  getAiBriefingPrompt: () =>
    getFromApi<{ prompt: string; isCustom: boolean; defaultPrompt: string }>('/api/operations-config/ai-prompt'),
  updateAiBriefingPrompt: (prompt: string) =>
    putToApi<{ saved: boolean }>('/api/operations-config/ai-prompt', { prompt }),
  resetAiBriefingPrompt: async (): Promise<{ prompt: string }> => {
    const token = await acquireApiToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${resolvedApiBaseUrl}/api/operations-config/ai-prompt`, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
    return res.json() as Promise<{ prompt: string }>;
  },
  downloadHtmlReport: async (requestedTenantId = _activeTenantId, aiEnabled = false): Promise<void> => {
    const token = await acquireApiToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(
      `${resolvedApiBaseUrl}/api/reports/${encodeURIComponent(requestedTenantId)}/html?aiEnabled=${aiEnabled}`,
      { headers },
    );
    if (!res.ok) throw new Error(`HTML report failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nightwatch-report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  },
  downloadPdfReport: async (requestedTenantId = _activeTenantId, aiEnabled = false): Promise<void> => {
    const token = await acquireApiToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(
      `${resolvedApiBaseUrl}/api/reports/${encodeURIComponent(requestedTenantId)}/pdf?aiEnabled=${aiEnabled}`,
      { headers, signal: AbortSignal.timeout(300_000) },
    );
    if (!res.ok) throw new Error(`PDF report failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nightwatch-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
  getTeamsSettings: () =>
    getFromApi<TeamsSettings>('/api/notifications/teams'),
  saveTeamsSettings: (settings: TeamsSettings) =>
    putToApi<{ success: boolean }>('/api/notifications/teams', settings),
  sendTeamsTestNotification: (webhookUrl?: string) =>
    postToApi<{ success: boolean }>('/api/notifications/teams/test', { webhookUrl: webhookUrl ?? null }),
  sendTeamsReportNow: () =>
    postToApi<{ success: boolean }>('/api/notifications/teams/send-report', {}),
  resetTeamsLastSent: () =>
    postToApi<{ success: boolean }>('/api/notifications/teams/reset-last-sent', {}),

  // Report schedule
  getReportSchedule: (tenantId = _activeTenantId) =>
    getFromApi<ReportSchedule>(`/api/report-schedule/${encodeURIComponent(tenantId)}`),
  updateReportSchedule: (tenantId = _activeTenantId, request: UpsertReportScheduleRequest) =>
    putToApi<ReportSchedule>(`/api/report-schedule/${encodeURIComponent(tenantId)}`, request),
  getReportHistory: (tenantId = _activeTenantId, limit = 50) =>
    getFromApi<ReportSentLog[]>(`/api/report-schedule/${encodeURIComponent(tenantId)}/history?limit=${limit}`),
  getAllReportHistory: (limit = 100) =>
    getFromApi<ReportSentLog[]>(`/api/report-schedule/history/all?limit=${limit}`),
  sendReportNow: (tenantId = _activeTenantId) =>
    postToApi<{ sent: boolean; recipients: number; fileSizeKb: number; sentAt: string }>(`/api/report-schedule/${encodeURIComponent(tenantId)}/send-now`, {}),

  // Health snapshots
  getHealthSnapshotHistory: (months = 12, cacheBustKey?: string | number) =>
    getFromApi<HealthSnapshotHistory>(`/api/health-snapshots/${encodeURIComponent(_activeTenantId)}?months=${months}`, { useCache: true, cacheBustKey }),
  captureHealthSnapshot: () =>
    postToApi<{ captured: boolean; tenantId: string; month: string }>(`/api/health-snapshots/${encodeURIComponent(_activeTenantId)}/capture`, {}),

  // Monthly review
  getMonthlyReview: (tenantId = _activeTenantId, month?: string) =>
    getFromApi<import('../types/dashboard').MonthlyReview>(`/api/monthly-review/${encodeURIComponent(tenantId)}${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  createActionItem: (tenantId = _activeTenantId, request: import('../types/dashboard').CreateActionItemRequest, month?: string) =>
    postToApi<import('../types/dashboard').ActionItem>(`/api/monthly-review/${encodeURIComponent(tenantId)}/action-items${month ? `?month=${encodeURIComponent(month)}` : ''}`, request),
  updateActionItem: (tenantId = _activeTenantId, id: number, request: import('../types/dashboard').UpdateActionItemRequest) =>
    putToApi<import('../types/dashboard').ActionItem>(`/api/monthly-review/${encodeURIComponent(tenantId)}/action-items/${id}`, request),
  deleteActionItem: (tenantId = _activeTenantId, id: number) =>
    deleteFromApi(`/api/monthly-review/${encodeURIComponent(tenantId)}/action-items/${id}`),
  // Alert thresholds
  getAlertThresholds: (tenantId = _activeTenantId) =>
    getFromApi<unknown[]>(`/api/alert-thresholds/${encodeURIComponent(tenantId)}`),
  createAlertThreshold: (tenantId = _activeTenantId, request: Record<string, unknown>) =>
    postToApi<unknown>(`/api/alert-thresholds/${encodeURIComponent(tenantId)}`, request),
  updateAlertThreshold: (tenantId = _activeTenantId, id: number, request: Record<string, unknown>) =>
    putToApi<unknown>(`/api/alert-thresholds/${encodeURIComponent(tenantId)}/${id}`, request),
  deleteAlertThreshold: (tenantId = _activeTenantId, id: number) =>
    deleteFromApi(`/api/alert-thresholds/${encodeURIComponent(tenantId)}/${id}`),
  getThresholdBreaches: (tenantId = _activeTenantId) =>
    getFromApi<unknown[]>(`/api/alert-thresholds/${encodeURIComponent(tenantId)}/breaches`),
  acknowledgeThresholdBreach: (tenantId = _activeTenantId, breachId: number) =>
    postToApi<{ acknowledged: boolean }>(`/api/alert-thresholds/${encodeURIComponent(tenantId)}/breaches/${breachId}/acknowledge`, {}),
  getAlertDigest: () =>
    getFromApi<import('../types/dashboard').AlertDigest>('/api/alert-thresholds/digest'),

  // Audit log
  getAuditLog: (queryString = '') =>
    getFromApi<unknown>(`/api/audit-log${queryString ? `?${queryString}` : ''}`),
  exportAuditLog: async (fromDate?: string, toDate?: string): Promise<void> => {
    const token = await acquireApiToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const params = new URLSearchParams();
    if (fromDate) params.set('from', new Date(fromDate).toISOString());
    if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());
    const qs = params.toString();
    const res = await fetch(`${resolvedApiBaseUrl}/api/audit-log/export${qs ? `?${qs}` : ''}`, { headers });
    if (!res.ok) throw new Error(`Audit log export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nightwatch-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Report history — resend
  resendReport: (tenantId = _activeTenantId, logId: number) =>
    postToApi<{ sent: boolean; recipients: number; fileSizeKb: number; sentAt: string }>(
      `/api/report-schedule/${encodeURIComponent(tenantId)}/resend/${logId}`, {}),

  // Monthly review — suggested actions from insights
  getSuggestedActions: (tenantId = _activeTenantId) =>
    getFromApi<SuggestedAction[]>(`/api/monthly-review/${encodeURIComponent(tenantId)}/suggested-actions`),

  // Environment review
  getEnvironmentReviews: (tenantId = _activeTenantId) =>
    getFromApi<EnvironmentReviewSummary[]>(`/api/environment-review/${encodeURIComponent(tenantId)}`),
  getEnvironmentReview: (tenantId = _activeTenantId, id: number) =>
    getFromApi<EnvironmentReviewDetail>(`/api/environment-review/${encodeURIComponent(tenantId)}/${id}`),
  createEnvironmentReview: (tenantId = _activeTenantId, req: CreateEnvironmentReviewRequest) =>
    postToApi<EnvironmentReviewDetail>(`/api/environment-review/${encodeURIComponent(tenantId)}`, req),
  updateEnvironmentReview: (tenantId = _activeTenantId, id: number, req: Partial<CreateEnvironmentReviewRequest & { status: string }>) =>
    putToApi<EnvironmentReviewDetail>(`/api/environment-review/${encodeURIComponent(tenantId)}/${id}`, req),
  deleteEnvironmentReview: (tenantId = _activeTenantId, id: number) =>
    deleteFromApi(`/api/environment-review/${encodeURIComponent(tenantId)}/${id}`),
  addReviewFinding: (tenantId = _activeTenantId, reviewId: number, req: CreateReviewFindingRequest) =>
    postToApi<ReviewFinding>(`/api/environment-review/${encodeURIComponent(tenantId)}/${reviewId}/findings`, req),
  updateReviewFinding: (tenantId = _activeTenantId, reviewId: number, findingId: number, req: Partial<CreateReviewFindingRequest & { status: string }>) =>
    putToApi<ReviewFinding>(`/api/environment-review/${encodeURIComponent(tenantId)}/${reviewId}/findings/${findingId}`, req),
  deleteReviewFinding: (tenantId = _activeTenantId, reviewId: number, findingId: number) =>
    deleteFromApi(`/api/environment-review/${encodeURIComponent(tenantId)}/${reviewId}/findings/${findingId}`),
  getFindingLibrary: () =>
    getFromApi<FindingLibraryItem[]>('/api/environment-review/library'),
  downloadEnvironmentReviewPdf: async (tenantId = _activeTenantId, reviewId: number, customerName: string): Promise<void> => {
    const token = await acquireApiToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${resolvedApiBaseUrl}/api/environment-review/${encodeURIComponent(tenantId)}/${reviewId}/pdf`, { headers });
    if (!res.ok) throw new Error(`Environment review PDF failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NightWatch-EnvironmentReview-${customerName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadMonthlyReviewPdf: async (tenantId = _activeTenantId, month?: string, _displayName?: string): Promise<void> => {
    const token = await acquireApiToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const params = month ? `?month=${encodeURIComponent(month)}` : '';
    const res = await fetch(`${resolvedApiBaseUrl}/api/monthly-review/${encodeURIComponent(tenantId)}/generate-pdf${params}`, { headers });
    if (!res.ok) throw new Error(`Monthly review PDF failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NightWatch-MonthlyReview-${tenantId}-${month ?? new Date().toISOString().slice(0, 7)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
