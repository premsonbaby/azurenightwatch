import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { generateHtmlReport, downloadHtmlReport } from '../utils/generateHtmlReport';
import { useNavigate } from 'react-router-dom';
import { nightWatchClient } from '../api/client';
import { loadLayoutFromStorage, saveLayoutToStorage, loadChangesTimeRangeFromStorage, saveChangesTimeRangeToStorage, loadSpendAnomalyTimeRangeFromStorage, saveSpendAnomalyTimeRangeToStorage, loadCapacityPlanningTimeRangeFromStorage, saveCapacityPlanningTimeRangeToStorage, loadWidgetWidthsFromStorage, saveWidgetWidthsToStorage } from '../utils/layoutStorage';
import { LineTrendChart } from '../components/LineTrendChart';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RelationshipGraph, type RelationshipGraphHandle } from '../components/RelationshipGraph';
import { DashboardState } from '../components/DashboardState';
import { useNightWatchDashboardData } from '../hooks/useNightWatchDashboardData';
import { useAggregateDashboard } from '../hooks/useAggregateDashboard';
import type { AdvisorScoreDashboard, AksContainerHealthDashboard, AlertsDashboard, AppFunctionsHealthDashboard, AppGatewayDashboard, AzPolicyLensDashboard, AzureFirewallDashboard, BackupHealthDashboard, CapacityPlanningDashboard, ChangesDashboard, CostAnomalyForecastDashboard, DatabaseHealthDashboard, DrDashboard, ExpressRouteDashboard, IamReviewDashboard, IdentityAttackSurfaceDashboard, KeyVaultHealthDashboard, ManagedIdentityAuditDashboard, MessagingHealthDashboard, NetworkPerimeterDashboard, NetworkTopologyDashboard, NonProdUptimeDashboard, OrphanedResourcesDashboard, RiSavingsDashboard, SecurityDashboard, ServiceHealthDashboard, StorageComplianceDashboard, SubscriptionCostDashboard, SupportTicketDashboard, TagHygieneDashboard, TopCostlyResourcesDashboard, VmssHealthDashboard, VpnGatewayDashboard, VwanDashboard, WastageTrackerDashboard } from '../types/dashboard';

const PIE_COLORS = [
  '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#8b5cf6',
  '#ec4899', '#14b8a6', '#ef4444', '#6366f1', '#84cc16',
];
// dnd-kit imports will be added below
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ExecutiveDashboardPageProps {
  refreshTick: number;
  basePath?: string;
  portalTenantId?: string;
  portalWidgetKeys?: string[];
}

interface WidgetDefinition {
  key: string;
  label: string;
  to: string;
  accent: string;
  summary: string;
}


const tenantId = import.meta.env.VITE_DEFAULT_TENANT_ID ?? 'tenant-a';

const coreWidgetDefs: Record<string, WidgetDefinition> = {
  azureHealth: { key: 'azureHealth', label: 'Azure Overall Health', to: '/', accent: 'text-cyan-200', summary: 'Composite score across Security, Reliability, Governance, and Cost.' },
  security: { key: 'security', label: 'Security Intelligence', to: '/security', accent: 'text-rose-200', summary: 'Exposure, Defender findings, and remediation priority summary.' },
  performance: { key: 'performance', label: 'Performance', to: '/performance', accent: 'text-amber-200', summary: 'Service performance trend and reliability risk overview.' },
  cost: { key: 'cost', label: 'Cost Optimization', to: '/cost', accent: 'text-emerald-200', summary: 'Spend efficiency, anomalies, and savings opportunities snapshot.' },
  governance: { key: 'governance', label: 'Governance', to: '/governance', accent: 'text-sky-200', summary: 'Policy, compliance, ownership, and drift summary.' },
  'ri-savings': { key: 'ri-savings', label: 'Savings', to: '/ri-savings', accent: 'text-emerald-200', summary: 'Open this section for detailed analytics.' },
  reliability: { key: 'reliability', label: 'Reliability', to: '/dr-recoverability', accent: 'text-indigo-200', summary: 'Reliability posture and continuity readiness at a glance.' },
  dailyCostAnalysis: { key: 'dailyCostAnalysis', label: 'Daily Cost Analysis', to: '/', accent: 'text-emerald-200', summary: 'Daily cost trend visual for quick spend direction checks.' },
  'network-topology': { key: 'network-topology', label: 'Network Topology', to: '/network-topology', accent: 'text-cyan-200', summary: 'VNet, peering, and VPN gateway topology across your Azure scope.' },
  'top-costly-resources': { key: 'top-costly-resources', label: 'Top Costly Resources', to: '/top-costly-resources', accent: 'text-amber-200', summary: 'Current month top 10 resources by Azure spend.' },
  'subscription-cost': { key: 'subscription-cost', label: 'Subscription Cost', to: '/subscription-cost', accent: 'text-amber-200', summary: 'Monthly Azure spend broken down by subscription across the last 3 months.' },
  'insight-feed': { key: 'insight-feed', label: 'Operational Intelligence', to: '/', accent: 'text-violet-200', summary: 'Live security, cost, and governance signals from your Azure environment.' },
  'security-blast-radius': { key: 'security-blast-radius', label: 'Security Blast Radius', to: '/security', accent: 'text-rose-200', summary: 'Visual map of compromise spread paths across your Azure resources.' },
  'azure-changes': { key: 'azure-changes', label: 'Azure Change Activity', to: '/azure-changes', accent: 'text-violet-200', summary: 'Live change log across all Azure resources — who changed what and when.' },
  'spend-anomaly': { key: 'spend-anomaly', label: 'Spend Anomaly & Forecast', to: '/spend-anomaly', accent: 'text-emerald-200', summary: 'Budget utilization, cost anomalies, and burn-rate forecast.' },
  'capacity-planning': { key: 'capacity-planning', label: 'Capacity Planning', to: '/capacity-planning', accent: 'text-cyan-200', summary: 'Resource runway and capacity exhaustion forecast across your Azure estate.' },
  'database-health': { key: 'database-health', label: 'Database Health', to: '/database-health', accent: 'text-blue-200', summary: 'SQL, MySQL, PostgreSQL, Cosmos DB, and Elastic Pool inventory and health.' },
  'key-vault-health': { key: 'key-vault-health', label: 'Key Vault Health', to: '/key-vault-health', accent: 'text-amber-200', summary: 'Soft-delete, purge protection, and access model posture across Key Vaults.' },
  'aks-container-health': { key: 'aks-container-health', label: 'AKS & Container Health', to: '/aks-container-health', accent: 'text-cyan-200', summary: 'Kubernetes clusters, Container Apps, and registry health across your tenant.' },
  'storage-compliance': { key: 'storage-compliance', label: 'Storage Compliance', to: '/storage-compliance', accent: 'text-emerald-200', summary: 'Public access, HTTPS, TLS, and shared key compliance for all storage accounts.' },
  'service-health': { key: 'service-health', label: 'Azure Service Health', to: '/service-health', accent: 'text-rose-200', summary: 'Active incidents, planned maintenance, and health advisories from Azure.' },
  'identity-attack-surface': { key: 'identity-attack-surface', label: 'Identity Attack Surface', to: '/identity-attack-surface', accent: 'text-red-300', summary: 'Privileged role assignments, owner/SP risk, risky sign-ins, PIM events, and Conditional Access results.' },
  'managed-identity-audit': { key: 'managed-identity-audit', label: 'Managed Identity Audit', to: '/managed-identity-audit', accent: 'text-violet-200', summary: 'User-assigned and system-assigned managed identities with federated credential tracking.' },
  'advisor-score': { key: 'advisor-score', label: 'Advisor Score', to: '/advisor-score', accent: 'text-emerald-200', summary: 'Azure Advisor overall score and per-category breakdown with improvement opportunities.' },
  'messaging-health': { key: 'messaging-health', label: 'Messaging Health', to: '/messaging-health', accent: 'text-violet-200', summary: 'Service Bus and Event Hub namespace health across your Azure subscriptions.' },
  'support-tickets': { key: 'support-tickets', label: 'Support Ticket Tracker', to: '/support-tickets', accent: 'text-rose-200', summary: 'Open Azure support tickets by severity — Critical, High, Moderate, Minimal.' },
  'vmss-health': { key: 'vmss-health', label: 'VMSS Health', to: '/vmss-health', accent: 'text-cyan-200', summary: 'Virtual Machine Scale Sets capacity, state, and upgrade policy across your tenant.' },
  'alerts': { key: 'alerts', label: 'Azure Monitor Alerts', to: '/alerts', accent: 'text-red-200', summary: 'Active Azure Monitor alert instances by severity — Critical, Error, Warning, and Info.' },
  'expressroute': { key: 'expressroute', label: 'Express Route', to: '/expressroute', accent: 'text-cyan-200', summary: 'ExpressRoute circuit inventory, provisioning state, and total bandwidth across subscriptions.' },
  'vwan': { key: 'vwan', label: 'Virtual WAN', to: '/vwan', accent: 'text-violet-200', summary: 'Virtual WAN instances, virtual hubs, and connectivity status across your Azure tenant.' },
  'azure-firewall': { key: 'azure-firewall', label: 'Azure Firewall', to: '/azure-firewall', accent: 'text-orange-300', summary: 'Firewall inventory, traffic allow/deny analysis, threat intelligence hits, permissive rule detection, and actionable security insights.' },
  'app-gateway': { key: 'app-gateway', label: 'Application Gateway', to: '/app-gateway', accent: 'text-teal-300', summary: 'Application Gateway inventory, WAF status, SSL policy, backend pool health, and 24h traffic + block trends.' },
  'vpn-gateway': { key: 'vpn-gateway', label: 'VPN Gateway', to: '/vpn-gateway', accent: 'text-indigo-300', summary: 'VPN Gateway inventory, connection health, BGP status, active-active configuration, and tunnel traffic trends.' },
};

const coreScoreWidgetKeys = new Set(['azureHealth', 'security', 'performance', 'cost', 'governance', 'reliability']);

interface WidgetHelp { what: string; how: string; }

const widgetHelpContent: Record<string, WidgetHelp> = {
  azureHealth: {
    what: 'A single composite health score (0–100) that summarises the overall operational posture of your Azure environment across all five pillars.',
    how: 'Calculated as a weighted average of the Security, Performance, Cost Efficiency, Governance, and Reliability pillar scores. Each pillar is individually scored from live Azure Resource Graph, Defender for Cloud, Cost Management, and Log Analytics signals.',
  },
  security: {
    what: 'Tracks your security exposure and active threat signals — open vulnerabilities, Defender for Cloud recommendations, over-permissive NSG rules, and abandoned public IPs.',
    how: 'Score is derived from Azure Resource Graph queries counting dangerous NSG rules (any/any inbound), Defender for Cloud recommendation counts, unattached public IPs, and untagged resources. Higher counts lower the score.',
  },
  performance: {
    what: 'Reflects the performance health of your workloads — CPU saturation, memory pressure, response time trends, and alerting signal density.',
    how: 'Fetched from your configured Log Analytics workspace(s) via KQL queries measuring average CPU, memory utilisation, and error rate over the last 24 hours. If no workspace is configured, a conservative synthetic baseline is used.',
  },
  cost: {
    what: 'Measures how efficiently your Azure budget is being used — savings opportunities, reserved instance coverage, idle resources, and spend anomalies.',
    how: 'Pulled from Azure Cost Management API for current-month actuals vs. baseline. Savings opportunities are sourced from Azure Advisor Reservations recommendations. The score decreases with higher waste ratios and more open recommendations.',
  },
  governance: {
    what: 'Monitors policy compliance, naming hygiene, tagging coverage, ownership assignment, and RBAC sprawl across all subscriptions.',
    how: 'Azure Resource Graph queries count non-compliant resources, untagged resources, resources violating naming conventions, and excessive Owner role assignments. The score is a normalised aggregate of these counts relative to total resource count.',
  },
  reliability: {
    what: 'Shows your backup coverage and continuity readiness — what percentage of stateful workloads are protected and the overall reliability posture.',
    how: 'Backup coverage is calculated from Azure Recovery Services vault protected item counts vs. total discovered stateful workloads (VMs, databases, storage). The outer arc shows backup coverage, the inner arc shows the raw reliability score.',
  },
  dailyCostAnalysis: {
    what: 'A daily cost trend chart showing spend direction over the last 30 days — useful for spotting ramp-ups or anomalies at a glance.',
    how: 'Data is pulled from Azure Cost Management daily spend history for all subscriptions in scope. Each data point is the aggregated actual cost for that calendar day in EUR.',
  },
  'network-topology': {
    what: 'A visual and tabular map of your Azure network — VNets, peering relationships, VPN gateways, subnets, NSG rules, and route tables.',
    how: 'All network data is fetched via Azure Resource Graph querying microsoft.network/* resource types. Private DNS zone links are fetched from microsoft.network/privatednszones/virtualnetworklinks. No Log Analytics dependency.',
  },
  'top-costly-resources': {
    what: 'The top 10 individual Azure resources by current-month spend, giving immediate visibility into your biggest cost drivers.',
    how: 'Fetched from Azure Cost Management API, aggregated by resource ID for the current billing month. The donut chart shows the relative proportion of each resource\'s cost.',
  },
  'insight-feed': {
    what: 'A live feed of operational intelligence signals — security alerts, cost spikes, governance drift, and performance warnings — severity-ranked and categorised.',
    how: 'Signals are aggregated from Defender for Cloud findings, Cost Management anomalies, Azure Policy non-compliance events, and Log Analytics alert rules. Each signal is classified by severity (Critical → Low) and category.',
  },
  'security-blast-radius': {
    what: 'A graph showing how a compromise of one resource could propagate across your estate through RBAC relationships, network links, and managed identities.',
    how: 'Graph edges are derived from Azure Resource Graph: RBAC role assignments link identities to resources, VNet peering links networks, and managed identity bindings link services. Nodes are coloured by resource type.',
  },
  'azure-changes': {
    what: 'A live change log of every Azure resource modification in your scope — create, update, and delete operations with actor attribution.',
    how: 'Sourced from Azure Resource Graph\'s resourcechanges table. Filtered by the selected time range (Today / 2 Days / 1 Week). The stacked bar shows change volume over time; the donut shows which resource types changed most.',
  },
  'spend-anomaly': {
    what: 'Detects unusual cost spikes and shows budget burn-rate — how quickly you are consuming your budget and when it is forecast to be exhausted.',
    how: 'Actual spend is compared against a rolling statistical baseline from Azure Cost Management. Deviations above threshold are flagged as anomalies. Budget utilisation and forecast exhaustion date come from configured Azure Budget alerts.',
  },
  'capacity-planning': {
    what: 'Forecasts when your key resources will hit capacity limits based on current usage growth trends — CPU, memory, storage, and more.',
    how: 'Log Analytics KQL queries measure current utilisation and compute a linear growth trend. The "days until exhaustion" estimate extrapolates that trend to 100% utilisation. Waste estimates come from resources running well below their provisioned capacity.',
  },
  'dr-recoverability': {
    what: 'Summarises your Disaster Recovery readiness — what percentage of workloads meet their RPO/RTO targets and where the biggest gaps are.',
    how: 'RPO is calculated from the real lastRecoveryPoint timestamp fetched from Azure Recovery Services via Resource Graph. RTO is estimated from workload type and environment tier. The compliance trend is a 6-month historical view of these metrics.',
  },
  'ri-savings': {
    what: 'Highlights Reserved Instance and Savings Plan opportunities recommended by Azure Advisor to reduce on-demand spend.',
    how: 'Recommendations are pulled from Azure Advisor\'s Cost category, specifically RI and Savings Plan suggestions based on your historical usage patterns over the last 30 days.',
  },
  'tag-hygiene-compliance': {
    what: 'Shows the percentage of resources with mandatory tags (Environment + Owner) and breaks down untagged resources by type and subscription.',
    how: 'Azure Resource Graph query checks for presence of Environment and Owner tags on all resources. Results are grouped by resource type and subscription to identify tagging coverage gaps.',
  },
  'orphaned-resources': {
    what: 'Lists orphaned Azure resources — unattached disks, dangling NICs, abandoned public IPs, and unused snapshots — with estimated monthly waste.',
    how: 'Azure Resource Graph queries filter resources by their attachment state: disks with Unattached diskState, NICs with no virtualMachine link, public IPs with no ipConfiguration, and standalone snapshots.',
  },
  'backup-health': {
    what: 'Shows how many VMs are protected by Azure Backup, vault count, and protection coverage percentage.',
    how: 'VM count comes from microsoft.compute/virtualmachines Resource Graph query. Protected items are fetched from microsoft.recoveryservices/vaults/backupfabrics/protectioncontainers/protecteditems. Coverage is protected ÷ total VMs.',
  },
  'iam-review': {
    what: 'Audits your RBAC estate — total role assignments, Owner role overuse, service principal count, user assignments, and custom role sprawl.',
    how: 'Azure Resource Graph queries authorizationresources for role assignments and custom role definitions. Owner assignments are identified by the well-known Owner role definition ID. Risks are generated from thresholds on owner count and custom role count.',
  },
  'wastage-tracker': {
    what: 'Combines orphaned resources and idle VM recommendations to show total estimated monthly Azure waste with resource-level breakdown.',
    how: 'Orphaned resource data comes from the same ARG queries as the Orphaned Resources widget. Idle VM savings come from Azure Advisor Cost recommendations filtered to VMs with low utilisation signals.',
  },
  'network-perimeter': {
    what: 'Highlights your network attack surface — public IP count, dangerous NSG rules allowing internet access to management ports (RDP/SSH), and exposed resources.',
    how: 'Public IPs are queried from microsoft.network/publicipaddresses via ARG. Dangerous NSG rules are identified by matching Inbound Allow rules with internet source (*, 0.0.0.0/0, Internet) targeting any port, port 22, or port 3389.',
  },
  'nonprod-uptime-leakage': {
    what: 'Identifies non-production VMs (dev/test/UAT/staging) that are currently running, estimating the monthly cost leakage from outside-hours compute.',
    how: 'ARG queries filter VMs by name pattern (contains dev/test/uat/staging) or Environment tag. Monthly cost is estimated from VM SKU family. Running count is based on power state reported by Azure.',
  },
  'app-functions-health': {
    what: 'Shows all App Services, Function Apps, and Logic Apps across your subscriptions — running vs. stopped breakdown and app inventory.',
    how: 'Azure Resource Graph queries microsoft.web/sites for all App Service resources. Kind field is used to classify into Web Apps, Function Apps, and Logic Apps. State field shows Running or Stopped.',
  },
  'policy-radar': {
    what: 'Azure Policy compliance posture — total policy assignments, custom definitions count, non-compliant resource count, overall compliance percentage, and the top non-compliant policy assignments.',
    how: 'Assignment inventory comes from Azure Resource Graph policyresources table. Compliance counts (compliant vs non-compliant resources) are fetched from the Azure Policy Insights summarize API per subscription. Effect breakdown is derived from policy definition effect fields.',
  },
  alerts: {
    what: 'Active Azure Monitor alert instances across all subscriptions — broken down by severity (Critical/Error/Warning/Info), state (New/Acknowledged), and originating monitor service.',
    how: 'Queried from the alertsmanagementresources Azure Resource Graph table. Only non-Closed alerts are included. Severity mapping: Sev0=Critical, Sev1=Error, Sev2=Warning, Sev3=Info, Sev4=Verbose.',
  },
  expressroute: {
    what: 'ExpressRoute circuit inventory across all subscriptions — provisioning state, service provider details, peering configuration, and total committed bandwidth.',
    how: 'Queried from microsoft.network/expressroutecircuits and microsoft.network/expressroutecircuits/peerings via Azure Resource Graph. Circuit provisioning state and service provider provisioning state are both shown independently.',
  },
  vwan: {
    what: 'Virtual WAN instances and virtual hub inventory — shows connectivity status, hub routing preferences, and regional distribution across your subscriptions.',
    how: 'Queried from microsoft.network/virtualwans and microsoft.network/virtualhubs via Azure Resource Graph. Hub counts per VWAN are cross-referenced and connected hubs are identified by Succeeded provisioning state.',
  },
  'app-gateway': {
    what: 'Application Gateway inventory — SKU tier, WAF configuration (enabled/Prevention/Detection), SSL policy, backend pool/listener/routing rule counts, and 24h traffic and WAF block trends.',
    how: 'Resource inventory from microsoft.network/applicationgateways via Azure Resource Graph. Traffic and WAF metrics from Log Analytics using AzureDiagnostics (ApplicationGatewayAccessLog/FirewallLog) and AGWAccessLogs/AGWFirewallLogs tables.',
  },
  'vpn-gateway': {
    what: 'VPN Gateway inventory — SKU, generation, gateway type, BGP configuration, active-active mode, and VPN connection health with tunnel traffic trends.',
    how: 'Resource inventory from microsoft.network/virtualnetworkgateways and microsoft.network/connections via Azure Resource Graph. Tunnel traffic from Log Analytics using AzureDiagnostics (TunnelDiagnosticLog) and VNGTunnelDiagnosticLog tables.',
  },
  'identity-attack-surface': {
    what: 'Identity attack surface — Owner and SP role assignments, custom role count, guest user assignments, risky sign-in events, risky user count, PIM role activations, MFA-blocked sign-ins, and Conditional Access policy activity.',
    how: 'RBAC data from authorizationresources via Azure Resource Graph. Sign-in risk, PIM events, and Conditional Access from SigninLogs and AuditLogs tables in Log Analytics (requires Entra diagnostic settings to forward logs).',
  },
};

const DEFAULT_FULL_WIDTH_KEYS = new Set([
  'dailyCostAnalysis', 'network-topology', 'insight-feed',
  'security-blast-radius', 'azure-changes', 'spend-anomaly',
  'capacity-planning', 'dr-recoverability',
]);

function isWidgetFull(key: string, widths: Record<string, 'full' | 'half'>): boolean {
  const stored = widths[key];
  return stored !== undefined ? stored === 'full' : DEFAULT_FULL_WIDTH_KEYS.has(key);
}

const acronymWordMap: Record<string, string> = {
  api: 'API',
  apim: 'APIM',
  aks: 'AKS',
  iam: 'IAM',
  msp: 'MSP',
  rto: 'RTO',
  rpo: 'RPO',
  sql: 'SQL',
  mi: 'MI',
  roi: 'ROI',
  er: 'ER',
  iops: 'IOPS',
  db: 'DB',
};

const WIDGET_KEY_MIGRATIONS: Record<string, string> = {
  'orphaned-snapshot-backup': 'orphaned-resources',
};

function migrateWidgetKeys(keys: string[]): string[] {
  return keys.map((k) => WIDGET_KEY_MIGRATIONS[k] ?? k);
}

function buildTitleFromKey(key: string): string {
  if (key === 'dr-recoverability') {
    return 'Disaster Recoverability';
  }

  if (key === 'app-functions-health') {
    return 'App Service Health';
  }

  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (acronymWordMap[lower]) {
        return acronymWordMap[lower];
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

  return words.join(' ');
}

function getDynamicRoute(key: string): string {
  if (key.startsWith('/')) {
    return key;
  }

  if (key === 'app-functions-health') {
    return '/app-service-health';
  }

  return `/${key}`;
}

function getWidgetDefinition(key: string): WidgetDefinition {
  const fromCore = coreWidgetDefs[key];
  if (fromCore) {
    return fromCore;
  }

  return {
    key,
    label: buildTitleFromKey(key),
    to: getDynamicRoute(key),
    accent: 'text-slate-200',
    summary: 'Open this section for detailed analytics.',
  };
}

const getWidgetValue = (dashboard: NonNullable<ReturnType<typeof useNightWatchDashboardData>['executive']>, widget: WidgetDefinition) => {
  switch (widget.key) {
    case 'security':
      return `${dashboard.securityPostureScore}%`;
    case 'performance':
      return `${dashboard.performanceScore}%`;
    case 'cost':
      return `${dashboard.costEfficiencyScore}%`;
    case 'governance':
      return `${dashboard.governanceComplianceScore}%`;
    case 'reliability':
      return `${dashboard.reliabilityScore}%`;
    case 'azureHealth':
      return `${dashboard.azureHealthScore}%`;
    case 'dailyCostAnalysis':
      return 'Chart Widget';
    case 'network-topology':
      return 'Diagram Widget';
    case 'top-costly-resources':
      return 'Chart Widget';
    case 'insight-feed':
      return 'Feed Widget';
    case 'security-blast-radius':
      return 'Diagram Widget';
    case 'kpi-scorecards':
      return 'Scorecard Widget';
    default:
      return 'Section Summary';
  }
};

// ── Severity colours ─────────────────────────────────────────────────────────
const CRITICAL_RE = /critical|breach|expos|vulnerab|immediately|high.risk|failed|failure|comprom/i;
const WARNING_RE  = /warning|elevated|degraded|increas|risk|missing|untagged|orphan|idle|waste|leak|no.backup|unprotect|danger|alert|recommend/i;
const GOOD_RE     = /healthy|compliant|protected|secured|good|optimal|no.issue|all.*pass|coverage.*100|fully/i;

function segmentSeverity(text: string): 'critical' | 'warning' | 'good' | 'info' {
  if (CRITICAL_RE.test(text)) return 'critical';
  if (WARNING_RE.test(text))  return 'warning';
  if (GOOD_RE.test(text))     return 'good';
  return 'info';
}

const SEVERITY_STYLES = {
  critical: { dot: '#f43f5e', color: '#fda4af' },
  warning:  { dot: '#f59e0b', color: '#fcd34d' },
  good:     { dot: '#10b981', color: '#6ee7b7' },
  info:     { dot: '#06b6d4', color: '#a5f3fc' },
} as const;

interface TickerSegment { text: string; severity: 'critical' | 'warning' | 'good' | 'info'; }

function SummaryTicker({ text }: { text: string }) {
  const segments: TickerSegment[] = text
    .split(/(?<=[.!])\s+/)
    .map(s => s.replace(/\.$/, '').trim())
    .filter(s => s.length > 8)
    .map(s => ({ text: s, severity: segmentSeverity(s) }));

  if (segments.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...segments, ...segments];
  const durationSecs = Math.max(30, segments.length * 8);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/70 py-0">
      <style>{`
        @keyframes nw-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .nw-ticker-track {
          display: flex;
          width: max-content;
          animation: nw-ticker ${durationSecs}s linear infinite;
        }
        .nw-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="flex items-stretch">
        {/* Label pill — stays fixed */}
        <div className="shrink-0 flex items-center gap-2 border-r border-slate-700/60 bg-slate-800/80 px-4 z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300 whitespace-nowrap">Live Summary</p>
        </div>

        {/* Scrolling track */}
        <div className="overflow-hidden flex-1">
          <div className="nw-ticker-track">
            {items.map((seg, i) => {
              const { dot, color } = SEVERITY_STYLES[seg.severity];
              return (
                <span key={i} className="flex items-center gap-2 px-6 py-3 whitespace-nowrap text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot, boxShadow: `0 0 5px ${dot}` }} />
                  <span style={{ color }}>{seg.text}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExecutiveDashboardPage({ refreshTick }: ExecutiveDashboardPageProps) {
  const { executive, isLoading, loadError, hasCoreData } = useNightWatchDashboardData(refreshTick, 'executive');
  const { data: aggregateData } = useAggregateDashboard(refreshTick);
  const navigate = useNavigate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [customWidgetKeys, setCustomWidgetKeys] = useState<string[]>([]);
  const [isLayoutLoading, setIsLayoutLoading] = useState(true);
  const [layoutStatus, setLayoutStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const networkTopoGraphRef = useRef<RelationshipGraphHandle>(null);
  const blastRadiusGraphRef = useRef<RelationshipGraphHandle>(null);
  const [networkTopology, setNetworkTopology] = useState<NetworkTopologyDashboard | null>(null);
  const [drData, setDrData] = useState<DrDashboard | null>(null);
  const [topCostlyResources, setTopCostlyResources] = useState<TopCostlyResourcesDashboard | null>(null);
  const [subscriptionCostData, setSubscriptionCostData] = useState<SubscriptionCostDashboard | null>(null);
  const [securityData, setSecurityData] = useState<SecurityDashboard | null>(null);
  const [changesData, setChangesData] = useState<ChangesDashboard | null>(null);
  const [changesTimeRange, setChangesTimeRange] = useState<'today' | '2days' | '1week'>(
    () => loadChangesTimeRangeFromStorage() ?? 'today',
  );
  const [spendAnomalyData, setSpendAnomalyData] = useState<CostAnomalyForecastDashboard | null>(null);
  const [spendAnomalyTimeRange, setSpendAnomalyTimeRange] = useState<'7d' | '30d' | '90d'>(
    () => loadSpendAnomalyTimeRangeFromStorage() ?? '30d',
  );
  const [capacityData, setCapacityData] = useState<CapacityPlanningDashboard | null>(null);
  const [capacityTimeRange, setCapacityTimeRange] = useState<'7d' | '30d' | '90d'>(
    () => loadCapacityPlanningTimeRangeFromStorage() ?? '30d',
  );
  const [widgetWidths, setWidgetWidths] = useState<Record<string, 'full' | 'half'>>(
    () => loadWidgetWidthsFromStorage(),
  );
  const [openHelpKey, setOpenHelpKey] = useState<string | null>(null);
  const [tagHygieneData, setTagHygieneData] = useState<TagHygieneDashboard | null>(null);
  const [orphanedData, setOrphanedData] = useState<OrphanedResourcesDashboard | null>(null);
  const [backupHealthData, setBackupHealthData] = useState<BackupHealthDashboard | null>(null);
  const [iamData, setIamData] = useState<IamReviewDashboard | null>(null);
  const [wastageData, setWastageData] = useState<WastageTrackerDashboard | null>(null);
  const [networkPerimeterData, setNetworkPerimeterData] = useState<NetworkPerimeterDashboard | null>(null);
  const [nonProdUptimeData, setNonProdUptimeData] = useState<NonProdUptimeDashboard | null>(null);
  const [riSavingsData, setRiSavingsData] = useState<RiSavingsDashboard | null>(null);
  const [appFunctionsData, setAppFunctionsData] = useState<AppFunctionsHealthDashboard | null>(null);
  const [azPolicyLensData, setAzPolicyLensData] = useState<AzPolicyLensDashboard | null>(null);
  const [databaseHealthData, setDatabaseHealthData] = useState<DatabaseHealthDashboard | null>(null);
  const [keyVaultHealthData, setKeyVaultHealthData] = useState<KeyVaultHealthDashboard | null>(null);
  const [aksContainerHealthData, setAksContainerHealthData] = useState<AksContainerHealthDashboard | null>(null);
  const [storageComplianceData, setStorageComplianceData] = useState<StorageComplianceDashboard | null>(null);
  const [serviceHealthData, setServiceHealthData] = useState<ServiceHealthDashboard | null>(null);
  const [managedIdentityData, setManagedIdentityData] = useState<ManagedIdentityAuditDashboard | null>(null);
  const [advisorScoreData, setAdvisorScoreData] = useState<AdvisorScoreDashboard | null>(null);
  const [messagingHealthData, setMessagingHealthData] = useState<MessagingHealthDashboard | null>(null);
  const [supportTicketData, setSupportTicketData] = useState<SupportTicketDashboard | null>(null);
  const [vmssHealthData, setVmssHealthData] = useState<VmssHealthDashboard | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsDashboard | null>(null);
  const [expressRouteData, setExpressRouteData] = useState<ExpressRouteDashboard | null>(null);
  const [vwanData, setVwanData] = useState<VwanDashboard | null>(null);
  const [azureFirewallData, setAzureFirewallData] = useState<AzureFirewallDashboard | null>(null);
  const [appGatewayData, setAppGatewayData] = useState<AppGatewayDashboard | null>(null);
  const [vpnGatewayData, setVpnGatewayData] = useState<VpnGatewayDashboard | null>(null);
  const [identityAttackSurfaceData, setIdentityAttackSurfaceData] = useState<IdentityAttackSurfaceDashboard | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Restore from localStorage immediately — no spinner needed
    const cached = loadLayoutFromStorage();
    if (cached && cached.length > 0) {
      setCustomWidgetKeys(cached);
      setIsLayoutLoading(false);
    }

    const loadLayout = async () => {
      try {
        const response = await nightWatchClient.getExecutiveLayout(tenantId);
        if (!isMounted) return;
        const serverKeys = Array.from(new Set(migrateWidgetKeys(response.widgetKeys)));
        // Server is the authoritative source; sync back to localStorage
        if (serverKeys.length > 0) {
          setCustomWidgetKeys(serverKeys);
          saveLayoutToStorage(serverKeys);
        }
        setLayoutError(null);
      } catch (error) {
        // Server unavailable — localStorage restore above keeps the UI functional
        if (isMounted && !cached) {
          setLayoutError(error instanceof Error ? error.message : 'Could not load custom dashboard layout.');
        }
      } finally {
        if (isMounted) {
          setIsLayoutLoading(false);
        }
      }
    };

    void loadLayout();

    return () => {
      isMounted = false;
    };
  }, []);

  // Single effect maps aggregate payload to existing state variables
  useEffect(() => {
    if (!aggregateData) return;
    setNetworkTopology(aggregateData.networkTopology);
    setDrData(aggregateData.dr);
    setTopCostlyResources(aggregateData.topCostlyResources);
    setSecurityData(aggregateData.security);
    setTagHygieneData(aggregateData.tagHygiene);
    setOrphanedData(aggregateData.orphanedResources);
    setBackupHealthData(aggregateData.backupHealth);
    setIamData(aggregateData.iamReview);
    setWastageData(aggregateData.wastageTracker);
    setNetworkPerimeterData(aggregateData.networkPerimeter);
    setNonProdUptimeData(aggregateData.nonProdUptime);
    setRiSavingsData(aggregateData.riSavings);
    setAppFunctionsData(aggregateData.appFunctionsHealth);
    setAzPolicyLensData(aggregateData.azPolicyLens);
    setDatabaseHealthData(aggregateData.databaseHealth);
    setKeyVaultHealthData(aggregateData.keyVaultHealth);
    setAksContainerHealthData(aggregateData.aksContainerHealth);
    setStorageComplianceData(aggregateData.storageCompliance);
    setServiceHealthData(aggregateData.serviceHealth);
    setManagedIdentityData(aggregateData.managedIdentityAudit);
    setAdvisorScoreData(aggregateData.advisorScore);
    setMessagingHealthData(aggregateData.messagingHealth);
    setSupportTicketData(aggregateData.supportTickets);
    setVmssHealthData(aggregateData.vmssHealth);
    setAlertsData(aggregateData.alerts);
    setExpressRouteData(aggregateData.expressRoute);
    setVwanData(aggregateData.vwan);
    setAzureFirewallData(aggregateData.azureFirewall);
    setAppGatewayData(aggregateData.appGateway);
    setVpnGatewayData(aggregateData.vpnGateway);
    setIdentityAttackSurfaceData(aggregateData.identityAttackSurface);
  }, [aggregateData]);

  useEffect(() => {
    if (!customWidgetKeys.includes('subscription-cost')) return;
    let isMounted = true;
    nightWatchClient.getSubscriptionCostDashboard(3, refreshTick)
      .then((res) => { if (isMounted) setSubscriptionCostData(res); })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [customWidgetKeys, refreshTick]);

  useEffect(() => {
    if (!customWidgetKeys.includes('azure-changes')) {
      return;
    }

    let isMounted = true;
    setChangesData(null);

    void nightWatchClient.getChangesDashboard(changesTimeRange, refreshTick).then((data) => {
      if (isMounted) setChangesData(data);
    }).catch(() => {});

    return () => { isMounted = false; };
  }, [customWidgetKeys, changesTimeRange, refreshTick]);

  useEffect(() => {
    if (!customWidgetKeys.includes('spend-anomaly')) {
      return;
    }

    let isMounted = true;
    setSpendAnomalyData(null);

    void nightWatchClient.getCostAnomalyForecastDashboard(spendAnomalyTimeRange, refreshTick).then((data) => {
      if (isMounted) setSpendAnomalyData(data);
    }).catch(() => {});

    return () => { isMounted = false; };
  }, [customWidgetKeys, spendAnomalyTimeRange, refreshTick]);

  useEffect(() => {
    if (!customWidgetKeys.includes('capacity-planning')) {
      return;
    }

    let isMounted = true;
    setCapacityData(null);

    void nightWatchClient.getCapacityPlanningDashboard(capacityTimeRange, refreshTick).then((data) => {
      if (isMounted) setCapacityData(data);
    }).catch(() => {});

    return () => { isMounted = false; };
  }, [customWidgetKeys, capacityTimeRange, refreshTick]);

  useEffect(() => {
    let isMounted = true;

    const loadWidgetInsights = async () => {
      if (!executive) {
        return;
      }

      const insightKeys = customWidgetKeys.filter((key) => !coreScoreWidgetKeys.has(key));
      if (insightKeys.length === 0) {
        return;
      }

      // Removed unused nextEntries and widgetInsights logic

      if (!isMounted) {
        return;
      }

      // setWidgetInsights removed
    };

    void loadWidgetInsights();

    return () => {
      isMounted = false;
    };
  }, [customWidgetKeys, refreshTick, executive]);

  const handleHeaderPdfExport = async (aiEnabled: boolean) => {
    if (!executive) {
      return;
    }

    const visibleWidgetKeys = (customWidgetKeys.length > 0 ? customWidgetKeys : Object.keys(coreWidgetDefs))
      .map((key) => key.trim())
      .filter((key) => key.length > 0);

    const { default: jsPDF } = await import('jspdf');
    const aiSummary = aiEnabled
      ? await nightWatchClient.generateExecutivePdfSummary(tenantId, { visibleWidgetKeys }).catch(() => ({
          tenantId,
          generatedAtUtc: new Date().toISOString(),
          aiTarget: 'fallback',
          aiModel: '',
          summary: executive.executiveSummary,
        }))
      : {
          tenantId,
          generatedAtUtc: new Date().toISOString(),
          aiTarget: 'disabled',
          aiModel: '',
          summary: executive.executiveSummary,
        };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Cover page with simple NightWatch mark and formal report framing.
    doc.setFillColor(7, 36, 68);
    doc.rect(0, 0, pageWidth, 58, 'F');
    doc.setFillColor(14, 116, 144);
    doc.rect(0, 58, pageWidth, 2, 'F');

    doc.setFillColor(12, 74, 110);
    doc.roundedRect(16, 16, 16, 16, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('NW', 20.8, 26.2);

    doc.setFontSize(23);
    doc.text('Azure NightWatch', 38, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Executive Operations Report', 38, 31);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Official Leadership Brief', 16, 76);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Tenant: ${aiSummary.tenantId}`, 16, 88);
    doc.text(`Generated: ${new Date(aiSummary.generatedAtUtc).toLocaleString()}`, 16, 95);
    doc.text(`AI Target: ${aiSummary.aiTarget || 'none'}${aiSummary.aiModel ? ` (${aiSummary.aiModel})` : ''}`, 16, 102);
    doc.text(`Visible Home Widgets Included: ${visibleWidgetKeys.join(', ') || 'default-home'}`, 16, 109, { maxWidth: pageWidth - 32 });

    doc.setFont('helvetica', 'bold');
    doc.text('Executive KPIs', 16, 124);
    doc.setFont('helvetica', 'normal');
    doc.text(`Azure Health: ${executive.azureHealthScore}%`, 16, 134);
    doc.text(`Security: ${executive.securityPostureScore}%`, 16, 141);
    doc.text(`Performance: ${executive.performanceScore}%`, 16, 148);
    doc.text(`Cost Efficiency: ${executive.costEfficiencyScore}%`, 16, 155);
    doc.text(`Reliability: ${executive.reliabilityScore}%`, 16, 162);
    doc.text(`Governance: ${executive.governanceComplianceScore}%`, 16, 169);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Confidential - Azure NightWatch Operations Intelligence', 16, pageHeight - 10);

    doc.addPage();
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AI Executive Narrative', 16, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const paragraphs = aiSummary.summary.split(/\r?\n/);
    let y = 32;
    const maxY = pageHeight - 16;

    for (const paragraph of paragraphs) {
      const text = paragraph.trim().length > 0 ? paragraph : ' ';
      const lines = doc.splitTextToSize(text, 178);

      for (const line of lines) {
        if (y > maxY) {
          doc.addPage();
          y = 20;
        }

        doc.text(line, 16, y);
        y += 6;
      }

      y += 2;
    }

    doc.save('azure-night-watch-full-report.pdf');
  };

  useEffect(() => {
    const handlePdfExport = (e: Event) => {
      const aiEnabled = (e as CustomEvent<{ aiEnabled: boolean }>).detail?.aiEnabled ?? false;
      void handleHeaderPdfExport(aiEnabled);
    };

    window.addEventListener('nightwatch:export-pdf', handlePdfExport);

    return () => {
      window.removeEventListener('nightwatch:export-pdf', handlePdfExport);
    };
  }, [executive, customWidgetKeys]);

  const handleHtmlExport = useCallback(() => {
    const html = generateHtmlReport({
      tenantId,
      activeWidgetKeys: customWidgetKeys,
      executive,
      security: securityData,
      cost: null,
      governance: null,
      performance: null,
      alerts: alertsData,
      expressroute: expressRouteData,
      vwan: vwanData,
      'azure-firewall': azureFirewallData,
      'app-gateway': appGatewayData,
      'vpn-gateway': vpnGatewayData,
      backupHealth: backupHealthData,
      databaseHealth: databaseHealthData,
      keyVaultHealth: keyVaultHealthData,
      aksContainerHealth: aksContainerHealthData,
      storageCompliance: storageComplianceData,
      serviceHealth: serviceHealthData,
      managedIdentityAudit: managedIdentityData,
      advisorScore: advisorScoreData,
      messagingHealth: messagingHealthData,
      vmssHealth: vmssHealthData,
      wastageTracker: wastageData,
      networkPerimeter: networkPerimeterData,
      tagHygiene: tagHygieneData,
      orphanedResources: orphanedData,
      topCostlyResources: topCostlyResources,
      azureChanges: changesData,
      spendAnomaly: spendAnomalyData,
      capacityPlanning: capacityData,
      drRecoverability: drData,
      riSavings: riSavingsData,
      iamReview: iamData,
      nonProdUptime: nonProdUptimeData,
      appFunctionsHealth: appFunctionsData,
      policyRadar: azPolicyLensData,
      supportTickets: supportTicketData,
      networkTopology: networkTopology,
    });
    downloadHtmlReport(html, tenantId);
  }, [
    customWidgetKeys, executive, securityData, alertsData, expressRouteData, vwanData, azureFirewallData, appGatewayData, vpnGatewayData,
    backupHealthData, databaseHealthData, keyVaultHealthData, aksContainerHealthData,
    storageComplianceData, serviceHealthData, managedIdentityData, advisorScoreData,
    messagingHealthData, vmssHealthData, wastageData, networkPerimeterData,
    tagHygieneData, orphanedData, topCostlyResources,
    changesData, spendAnomalyData, capacityData, drData, riSavingsData,
    iamData, nonProdUptimeData, appFunctionsData, azPolicyLensData,
    supportTicketData, networkTopology,
  ]);

  useEffect(() => {
    const handler = () => handleHtmlExport();
    window.addEventListener('nightwatch:export-html', handler);
    return () => window.removeEventListener('nightwatch:export-html', handler);
  }, [handleHtmlExport]);

  useEffect(() => {
    if (!openHelpKey) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenHelpKey(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openHelpKey]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !hasCoreData || !executive) {
    return state;
  }

  const dashboard = executive;

  const customWidgets = customWidgetKeys.reduce<Array<WidgetDefinition & { value: string }>>((acc, key) => {
    const def = getWidgetDefinition(key);
    acc.push({ ...def, value: getWidgetValue(dashboard, def) });
    return acc;
  }, []);

  const persistLayout = async (nextKeys: string[]) => {
    // Write to localStorage immediately so the order survives a page refresh
    // even before the server confirms the save.
    saveLayoutToStorage(nextKeys);
    setLayoutStatus('saving');
    setLayoutError(null);

    try {
      const response = await nightWatchClient.updateExecutiveLayout(nextKeys, tenantId);
      setCustomWidgetKeys(response.widgetKeys);
      saveLayoutToStorage(response.widgetKeys);
      setLayoutStatus('saved');
    } catch (error) {
      setLayoutStatus('error');
      setLayoutError(error instanceof Error ? error.message : 'Could not save custom dashboard layout.');
    }
  };

  const removeWidget = (widgetKey: string) => {
    const nextKeys = customWidgetKeys.filter((key) => key !== widgetKey);
    setCustomWidgetKeys(nextKeys);
    void persistLayout(nextKeys);
  };

  const toggleWidgetWidth = (widgetKey: string) => {
    const next = { ...widgetWidths, [widgetKey]: isWidgetFull(widgetKey, widgetWidths) ? 'half' as const : 'full' as const };
    setWidgetWidths(next);
    saveWidgetWidthsToStorage(next);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = customWidgetKeys.indexOf(activeId);
    const newIndex = customWidgetKeys.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const nextKeys = arrayMove(customWidgetKeys, oldIndex, newIndex);
    setCustomWidgetKeys(nextKeys);
    void persistLayout(nextKeys);
  }

  return (
    <div className="space-y-6">
      {dashboard.executiveSummary && (
        <SummaryTicker text={dashboard.executiveSummary} />
      )}

      <section className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-cyan-950/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">My Dashboard</p>
          </div>
          <p className="text-xs text-slate-300">
            {isLayoutLoading ? 'Loading your layout...' : layoutStatus === 'saving' ? 'Saving layout...' : layoutStatus === 'saved' ? 'Layout saved' : ''}
          </p>
        </div>

        {layoutError ? <p className="mt-3 text-sm text-rose-300">{layoutError}</p> : null}

        <div className="mt-4">
          {customWidgets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-cyan-300/40 bg-slate-950/60 p-6 text-sm text-slate-300">
              No widgets selected. Go to Settings to pick your dashboard widgets.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={customWidgetKeys} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {customWidgets.map((item) => (
                    <SortableWidget
                      key={item.key}
                      id={item.key}
                      className={isWidgetFull(item.key, widgetWidths) ? 'md:col-span-2 xl:col-span-3' : undefined}
                    >
                      <div
                        className="cursor-pointer rounded-2xl border border-cyan-300/30 bg-slate-900/80 p-4 transition hover:border-cyan-300/60"
                        onClick={() => {
                          if (item.to !== '/') {
                            navigate(item.to);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <WidgetDragHandle label={item.label} />
                          {/* Info button */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenHelpKey(openHelpKey === item.key ? null : item.key);
                            }}
                            aria-label={`About ${item.label}`}
                            title="What is this widget?"
                            className={`rounded border p-1 transition ${openHelpKey === item.key ? 'border-sky-400/60 bg-sky-500/20 text-sky-300' : 'border-slate-600/50 text-slate-400 hover:border-sky-400/50 hover:text-sky-300'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                              <circle cx="8" cy="8" r="6.5" />
                              <path d="M8 7v5" />
                              <circle cx="8" cy="4.5" r="0.5" fill="currentColor" stroke="none" />
                            </svg>
                          </button>
                          {/* Resize button */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleWidgetWidth(item.key);
                            }}
                            aria-label={isWidgetFull(item.key, widgetWidths) ? `Shrink ${item.label} to half width` : `Expand ${item.label} to full width`}
                            title={isWidgetFull(item.key, widgetWidths) ? 'Half width' : 'Full width'}
                            className="rounded border border-slate-600/50 p-1 text-slate-400 transition hover:border-cyan-400/50 hover:text-cyan-300"
                          >
                            {isWidgetFull(item.key, widgetWidths) ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                                <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
                              </svg>
                            )}
                          </button>
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeWidget(item.key);
                            }}
                            aria-label={`Remove ${item.label} widget`}
                            title={`Remove ${item.label}`}
                            className="rounded border border-rose-300/40 p-1 text-rose-200 transition hover:bg-rose-500/20"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3 w-3"
                              aria-hidden="true"
                            >
                              <path d="M18 6 6 18" />
                              <path d="m6 6 12 12" />
                            </svg>
                          </button>
                        </div>

                        {item.key === 'top-costly-resources' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {topCostlyResources && topCostlyResources.resources.length > 0 ? (
                              <div className="flex flex-col gap-3">
                                <div className="h-[180px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={topCostlyResources.resources.map(r => ({ name: r.resourceName, value: r.monthlyCostEur }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="35%"
                                        outerRadius="65%"
                                        paddingAngle={2}
                                        dataKey="value"
                                      >
                                        {topCostlyResources.resources.map((_, i) => (
                                          <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        formatter={(value) => [`€${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Cost']}
                                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="space-y-1">
                                  {topCostlyResources.resources.slice(0, 5).map((r, i) => (
                                    <div key={r.resourceId} className="flex items-center gap-2 text-xs">
                                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                      <span className="flex-1 truncate text-slate-200">{r.resourceName}</span>
                                      <span className="shrink-0 font-semibold text-cyan-200">€{r.monthlyCostEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  ))}
                                  <p className="pt-1 text-[11px] text-slate-400">Total: €{topCostlyResources.totalCostEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-[180px] items-center justify-center text-sm text-slate-400">Loading cost data...</div>
                            )}
                          </div>
                        ) : item.key === 'subscription-cost' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {subscriptionCostData && subscriptionCostData.monthlyBreakdown.length > 0 && subscriptionCostData.totalCostEur > 0 ? (
                              <div className="space-y-2">
                                <div className="h-[140px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={subscriptionCostData.monthlyBreakdown.map(m => ({ month: m.monthLabel.slice(0, 3), total: m.totalCostEur }))} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `€${(v/1000).toFixed(0)}k` : `€${v.toFixed(0)}`} />
                                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [`€${(v as number).toFixed(2)}`, 'Total']} />
                                      <Bar dataKey="total" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="space-y-1">
                                  {subscriptionCostData.subscriptionSummaries.slice(0, 4).map((s, i) => (
                                    <div key={s.subscriptionId} className="flex items-center gap-2 text-xs">
                                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                      <span className="flex-1 truncate text-slate-200">{s.subscriptionName}</span>
                                      <span className="shrink-0 font-semibold text-amber-300">€{s.avgMonthlyCostEur.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-[180px] items-center justify-center text-sm text-slate-400">Loading subscription cost data...</div>
                            )}
                          </div>
                        ) : item.key === 'network-topology' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {networkTopology ? (
                              <RelationshipGraph
                                ref={networkTopoGraphRef}
                                title=""
                                nodes={networkTopology.nodes}
                                edges={networkTopology.edges}
                                heightClassName="h-[400px]"
                                downloadFileName="network-topology"
                              />
                            ) : (
                              <div className="flex h-[400px] items-center justify-center text-sm text-slate-400">Loading network topology...</div>
                            )}
                          </div>
                        ) : item.key === 'dailyCostAnalysis' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            <LineTrendChart data={dashboard.dailyTrend} title="" chartType="line" />
                          </div>
                        ) : item.key === 'insight-feed' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            <IntelligenceWidget refreshTick={refreshTick} />
                          </div>
                        ) : item.key === 'security-blast-radius' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {securityData ? (
                              <RelationshipGraph
                                ref={blastRadiusGraphRef}
                                title=""
                                nodes={securityData.blastRadiusNodes}
                                edges={securityData.blastRadiusEdges}
                                heightClassName="h-[400px]"
                                downloadFileName="blast-radius"
                              />
                            ) : (
                              <div className="flex h-[400px] items-center justify-center text-sm text-slate-400">Loading blast radius...</div>
                            )}
                          </div>
                        ) : coreScoreWidgetKeys.has(item.key) ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            <ScoreCardWidget widgetKey={item.key} dashboard={dashboard} />
                          </div>
                        ) : item.key === 'azure-changes' ? (
                          <ChangesWidget
                            data={changesData}
                            timeRange={changesTimeRange}
                            onTimeRangeChange={(r) => { setChangesTimeRange(r); saveChangesTimeRangeToStorage(r); }}
                          />
                        ) : item.key === 'spend-anomaly' ? (
                          <SpendAnomalyWidget
                            data={spendAnomalyData}
                            timeRange={spendAnomalyTimeRange}
                            onTimeRangeChange={(r) => { setSpendAnomalyTimeRange(r); saveSpendAnomalyTimeRangeToStorage(r); }}
                          />
                        ) : item.key === 'capacity-planning' ? (
                          <CapacityPlanningWidget
                            data={capacityData}
                            timeRange={capacityTimeRange}
                            onTimeRangeChange={(r) => { setCapacityTimeRange(r); saveCapacityPlanningTimeRangeToStorage(r); }}
                          />
                        ) : item.key === 'dr-recoverability' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            <DrRecoverabilityWidget data={drData} />
                          </div>
                        ) : item.key === 'tag-hygiene-compliance' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {tagHygieneData ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-400">Tag Coverage</span>
                                  <span className={`text-lg font-bold ${tagHygieneData.coveragePercent >= 80 ? 'text-emerald-300' : tagHygieneData.coveragePercent >= 60 ? 'text-amber-300' : 'text-rose-300'}`}>{tagHygieneData.coveragePercent.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                                  <div className={`h-2 rounded-full ${tagHygieneData.coveragePercent >= 80 ? 'bg-emerald-400' : tagHygieneData.coveragePercent >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${tagHygieneData.coveragePercent}%` }} />
                                </div>
                                <p className="text-xs text-slate-400">{tagHygieneData.untaggedResources.toLocaleString()} untagged of {tagHygieneData.totalResources.toLocaleString()} resources</p>
                                <div className="space-y-1">
                                  {tagHygieneData.topUntaggedTypes.slice(0, 5).map((t) => (
                                    <div key={t.resourceType} className="flex items-center justify-between text-xs">
                                      <span className="truncate text-slate-300">{t.shortType}</span>
                                      <span className="ml-2 shrink-0 font-semibold text-amber-300">{t.untaggedCount}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading tag hygiene...</div>}
                          </div>
                        ) : item.key === 'orphaned-resources' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {orphanedData ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Orphaned Disks', value: orphanedData.orphanedDisks, color: 'text-rose-300' },
                                    { label: 'Orphaned NICs', value: orphanedData.orphanedNics, color: 'text-amber-300' },
                                    { label: 'Abandoned PIPs', value: orphanedData.orphanedPublicIps, color: 'text-orange-300' },
                                    { label: 'Old Snapshots', value: orphanedData.orphanedSnapshots, color: 'text-slate-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-center text-xs text-rose-300">Est. waste: €{orphanedData.estimatedMonthlyWasteEur.toFixed(2)}/mo</p>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading orphaned resources...</div>}
                          </div>
                        ) : item.key === 'backup-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {backupHealthData ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-400">Protection Coverage</span>
                                  <span className={`text-lg font-bold ${backupHealthData.protectionCoveragePercent >= 90 ? 'text-emerald-300' : backupHealthData.protectionCoveragePercent >= 70 ? 'text-amber-300' : 'text-rose-300'}`}>{backupHealthData.protectionCoveragePercent.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${backupHealthData.protectionCoveragePercent}%` }} />
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                  <div><p className="font-bold text-emerald-300">{backupHealthData.totalProtectedItems}</p><p className="text-slate-400">Protected</p></div>
                                  <div><p className="font-bold text-rose-300">{backupHealthData.unprotectedVms}</p><p className="text-slate-400">Unprotected</p></div>
                                  <div><p className="font-bold text-cyan-300">{backupHealthData.backupVaultCount}</p><p className="text-slate-400">Vaults</p></div>
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading backup health...</div>}
                          </div>
                        ) : item.key === 'iam-review' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {iamData ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Total Assignments', value: iamData.totalRoleAssignments, color: 'text-cyan-300' },
                                    { label: 'Owner Assignments', value: iamData.ownerAssignments, color: iamData.ownerAssignments > 3 ? 'text-rose-300' : 'text-emerald-300' },
                                    { label: 'Service Principals', value: iamData.servicePrincipalAssignments, color: 'text-amber-300' },
                                    { label: 'Custom Roles', value: iamData.customRoleCount, color: iamData.customRoleCount > 10 ? 'text-amber-300' : 'text-slate-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {iamData.risks.length > 0 && (
                                  <div className="space-y-1">
                                    {iamData.risks.map((r) => (
                                      <p key={r.title} className="rounded border border-amber-500/20 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-300">⚠ {r.title}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading IAM review...</div>}
                          </div>
                        ) : item.key === 'wastage-tracker' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {wastageData ? (
                              <div className="space-y-3">
                                {/* KPI row */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-lg border border-rose-500/25 bg-rose-950/20 p-2 text-center">
                                    <p className="text-lg font-bold text-rose-300">€{wastageData.totalEstimatedMonthlyWasteEur.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                    <p className="text-[10px] text-slate-400">Monthly Waste</p>
                                  </div>
                                  <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-2 text-center">
                                    <p className="text-lg font-bold text-amber-300">{wastageData.totalWastedResources}</p>
                                    <p className="text-[10px] text-slate-400">Resources</p>
                                  </div>
                                </div>
                                {/* Mini category donut + legend */}
                                {(() => {
                                  const COLORS: Record<string, string> = { 'Underutilized VM': '#f43f5e', 'Stopped VM': '#fb923c', 'Unattached Disk': '#f59e0b', 'Orphaned NIC': '#8b5cf6', 'Abandoned Public IP': '#06b6d4', 'Orphaned Snapshot': '#64748b', 'Other': '#475569' };
                                  const cats: Record<string, number> = {};
                                  for (const w of wastageData.wastageItems) cats[w.category] = (cats[w.category] ?? 0) + w.estimatedMonthlyWasteEur;
                                  const pieData = Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="h-[90px] w-[90px] shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius="35%" outerRadius="65%" paddingAngle={2} dataKey="value">
                                              {pieData.map((e) => <Cell key={e.name} fill={COLORS[e.name] ?? '#475569'} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#e2e8f0', fontSize: 10 }} formatter={(v) => [`€${Number(v).toFixed(2)}`, 'Waste']} />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      </div>
                                      <div className="flex-1 space-y-1">
                                        {pieData.slice(0, 5).map((e) => (
                                          <div key={e.name} className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COLORS[e.name] ?? '#475569' }} />
                                              <span className="truncate text-slate-300">{e.name}</span>
                                            </div>
                                            <span className="ml-1 shrink-0 font-semibold text-rose-300">€{e.value.toFixed(0)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading wastage data...</div>}
                          </div>
                        ) : item.key === 'network-perimeter' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {networkPerimeterData ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Public IPs', value: networkPerimeterData.totalPublicIps, color: 'text-cyan-300' },
                                    { label: 'Unprotected PIPs', value: networkPerimeterData.unprotectedPublicIps, color: networkPerimeterData.unprotectedPublicIps > 0 ? 'text-amber-300' : 'text-emerald-300' },
                                    { label: 'Open Mgmt Ports', value: networkPerimeterData.openManagementPortResources, color: networkPerimeterData.openManagementPortResources > 0 ? 'text-rose-300' : 'text-emerald-300' },
                                    { label: 'Dangerous NSG Rules', value: networkPerimeterData.dangerousNsgRuleCount, color: networkPerimeterData.dangerousNsgRuleCount > 0 ? 'text-rose-300' : 'text-emerald-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {networkPerimeterData.exposedResources.length > 0 && (
                                  <div className="space-y-1">
                                    {networkPerimeterData.exposedResources.slice(0, 3).map((r, i) => (
                                      <p key={`exposed-${i}`} className="rounded border border-rose-500/20 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-300">⚠ {r.resourceName} — {r.exposureType}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading perimeter data...</div>}
                          </div>
                        ) : item.key === 'nonprod-uptime-leakage' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {nonProdUptimeData ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-400">Monthly Leakage</span>
                                  <span className={`text-lg font-bold ${nonProdUptimeData.estimatedMonthlyLeakageEur > 500 ? 'text-rose-300' : nonProdUptimeData.estimatedMonthlyLeakageEur > 100 ? 'text-amber-300' : 'text-emerald-300'}`}>€{nonProdUptimeData.estimatedMonthlyLeakageEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                  <div><p className="font-bold text-amber-300">{nonProdUptimeData.nonProdVmCount}</p><p className="text-slate-400">Non-Prod VMs</p></div>
                                  <div><p className="font-bold text-rose-300">{nonProdUptimeData.runningNonProdVmCount}</p><p className="text-slate-400">Currently Running</p></div>
                                </div>
                                <div className="space-y-1">
                                  {nonProdUptimeData.runningVms.slice(0, 4).map((vm) => (
                                    <div key={vm.resourceId} className="flex items-center justify-between text-xs">
                                      <span className="truncate text-slate-300">{vm.resourceName}</span>
                                      <span className="ml-2 shrink-0 rounded bg-amber-500/15 px-1 text-[10px] text-amber-300">{vm.environment}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading non-prod uptime data...</div>}
                          </div>
                        ) : item.key === 'ri-savings' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {riSavingsData ? (
                              riSavingsData.recommendationCount === 0 ? (
                                <div className="space-y-3">
                                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-4 text-center">
                                    <p className="text-2xl font-bold text-emerald-300">€0</p>
                                    <p className="mt-1 text-xs text-slate-400">No cost savings recommendations from Azure Advisor</p>
                                  </div>
                                  <p className="text-[10px] text-slate-500">Azure Advisor generates recommendations based on 30-day usage patterns. Check back after your resources have been running for a full billing cycle.</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-2 text-center">
                                      <p className="text-lg font-bold text-emerald-300">€{riSavingsData.totalEstimatedAnnualSavingsEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <p className="text-[10px] text-slate-400">Annual Potential</p>
                                    </div>
                                    <div className="rounded-lg border border-teal-500/20 bg-teal-950/10 p-2 text-center">
                                      <p className="text-lg font-bold text-teal-300">€{riSavingsData.totalEstimatedMonthlySavingsEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <p className="text-[10px] text-slate-400">Monthly Potential</p>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-slate-500">{riSavingsData.recommendationCount} Azure Advisor recommendation{riSavingsData.recommendationCount !== 1 ? 's' : ''} · figures from Advisor, verify against billing</p>
                                  <div className="space-y-1.5">
                                    {riSavingsData.recommendations.slice(0, 4).map((r, i) => (
                                      <div key={`ri-${i}`} className="flex items-center justify-between rounded-lg border border-white/8 bg-slate-900/50 px-2.5 py-1.5 text-xs">
                                        <div className="min-w-0">
                                          <span className="font-medium text-slate-200 leading-tight">{r.recommendationType}</span>
                                          {r.term && <span className="ml-1.5 text-slate-500">{r.term}</span>}
                                          {r.impact && (
                                            <span className={`ml-1.5 rounded px-1 text-[10px] font-semibold ${r.impact.toLowerCase() === 'high' ? 'bg-rose-500/20 text-rose-300' : r.impact.toLowerCase() === 'medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700/40 text-slate-400'}`}>
                                              {r.impact}
                                            </span>
                                          )}
                                        </div>
                                        <span className="ml-2 shrink-0 font-semibold text-emerald-300">€{r.estimatedAnnualSavingsEur.toFixed(0)}/yr</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading savings data...</div>}
                          </div>
                        ) : item.key === 'app-functions-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {appFunctionsData ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Total Apps', value: appFunctionsData.totalApps, color: 'text-cyan-300' },
                                    { label: 'Running', value: appFunctionsData.runningApps, color: 'text-emerald-300' },
                                    { label: 'Stopped', value: appFunctionsData.stoppedApps, color: appFunctionsData.stoppedApps > 0 ? 'text-amber-300' : 'text-slate-300' },
                                    { label: 'Function Apps', value: appFunctionsData.functionAppCount, color: 'text-violet-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-1">
                                  {appFunctionsData.apps.filter((a) => a.state !== 'Running').slice(0, 3).map((a) => (
                                    <p key={a.resourceId} className="rounded border border-amber-500/20 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-300">⚠ {a.name} — {a.state}</p>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading app health...</div>}
                          </div>
                        ) : item.key === 'policy-radar' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {azPolicyLensData ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Assignments', value: azPolicyLensData.totalAssignments, color: 'text-cyan-300' },
                                    { label: 'Custom Defs', value: azPolicyLensData.customDefinitions, color: 'text-violet-300' },
                                    { label: 'Non-Compliant', value: azPolicyLensData.totalNonCompliantResources, color: azPolicyLensData.totalNonCompliantResources > 0 ? 'text-rose-300' : 'text-slate-300' },
                                    { label: 'Compliance %', value: `${azPolicyLensData.overallCompliancePercent.toFixed(1)}%`, color: azPolicyLensData.overallCompliancePercent >= 90 ? 'text-emerald-300' : azPolicyLensData.overallCompliancePercent >= 70 ? 'text-amber-300' : 'text-rose-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-1">
                                  {azPolicyLensData.topNonCompliantAssignments.slice(0, 3).map((a) => (
                                    <p key={a.assignmentId} className="truncate rounded border border-rose-500/20 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-300">
                                      {a.displayName || 'Unnamed'} — {a.nonCompliantResources} non-compliant
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading policy data...</div>}
                          </div>
                        ) : item.key === 'database-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {databaseHealthData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Total', value: databaseHealthData.totalDatabases, color: 'text-cyan-300' },
                                    { label: 'Running', value: databaseHealthData.runningDatabases, color: 'text-emerald-300' },
                                    { label: 'SQL', value: databaseHealthData.sqlCount, color: 'text-blue-300' },
                                    { label: 'Cosmos', value: databaseHealthData.cosmosDbCount, color: 'text-violet-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading database data...</div>}
                          </div>
                        ) : item.key === 'key-vault-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {keyVaultHealthData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Total Vaults', value: keyVaultHealthData.totalVaults, color: 'text-cyan-300' },
                                    { label: 'RBAC Model', value: keyVaultHealthData.rbacModelCount, color: 'text-emerald-300' },
                                    { label: 'Soft Del Off', value: keyVaultHealthData.softDeleteDisabledCount, color: keyVaultHealthData.softDeleteDisabledCount > 0 ? 'text-red-300' : 'text-slate-400' },
                                    { label: 'Purge Prot Off', value: keyVaultHealthData.purgeProtectionDisabledCount, color: keyVaultHealthData.purgeProtectionDisabledCount > 0 ? 'text-amber-300' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading vault data...</div>}
                          </div>
                        ) : item.key === 'aks-container-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {aksContainerHealthData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Clusters', value: aksContainerHealthData.totalClusters, color: 'text-cyan-300' },
                                    { label: 'Running', value: aksContainerHealthData.runningClusters, color: 'text-emerald-300' },
                                    { label: 'Container Apps', value: aksContainerHealthData.totalContainerApps, color: 'text-violet-300' },
                                    { label: 'Registries', value: aksContainerHealthData.totalRegistries, color: 'text-amber-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading AKS data...</div>}
                          </div>
                        ) : item.key === 'storage-compliance' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {storageComplianceData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Accounts', value: storageComplianceData.totalStorageAccounts, color: 'text-cyan-300' },
                                    { label: 'Compliant', value: storageComplianceData.fullyCompliantCount, color: 'text-emerald-300' },
                                    { label: 'Public Access', value: storageComplianceData.publicAccessCount, color: storageComplianceData.publicAccessCount > 0 ? 'text-red-300' : 'text-slate-400' },
                                    { label: 'Weak TLS', value: storageComplianceData.weakTlsCount, color: storageComplianceData.weakTlsCount > 0 ? 'text-amber-300' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading storage data...</div>}
                          </div>
                        ) : item.key === 'service-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {serviceHealthData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Incidents', value: serviceHealthData.activeIncidents, color: serviceHealthData.activeIncidents > 0 ? 'text-red-300' : 'text-emerald-300' },
                                    { label: 'Maintenance', value: serviceHealthData.plannedMaintenance, color: 'text-amber-300' },
                                    { label: 'Advisories', value: serviceHealthData.healthAdvisories, color: 'text-cyan-300' },
                                    { label: 'Security Adv', value: serviceHealthData.securityAdvisories, color: serviceHealthData.securityAdvisories > 0 ? 'text-rose-300' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading service health...</div>}
                          </div>
                        ) : item.key === 'managed-identity-audit' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {managedIdentityData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'User-Assigned', value: managedIdentityData.totalUserAssigned, color: 'text-violet-300' },
                                    { label: 'System-Assigned', value: managedIdentityData.totalSystemAssigned, color: 'text-emerald-300' },
                                    { label: 'With Fed Creds', value: managedIdentityData.userAssignedIdentities.filter((i) => i.federatedCredentialCount > 0).length, color: 'text-amber-300' },
                                    { label: 'Total', value: managedIdentityData.totalUserAssigned + managedIdentityData.totalSystemAssigned, color: 'text-cyan-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading identity data...</div>}
                          </div>
                        ) : item.key === 'advisor-score' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {advisorScoreData ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-center gap-3">
                                  <p className={`text-5xl font-black ${advisorScoreData.overallScore >= 80 ? 'text-emerald-400' : advisorScoreData.overallScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(advisorScoreData.overallScore)}</p>
                                  <div>
                                    <p className="text-xs text-slate-400">/ 100</p>
                                    <p className={`text-xs font-medium ${advisorScoreData.overallScore >= 80 ? 'text-emerald-400' : advisorScoreData.overallScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                      {advisorScoreData.overallScore >= 80 ? 'Excellent' : advisorScoreData.overallScore >= 60 ? 'Good' : 'Fair'}
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {advisorScoreData.categoryScores.slice(0, 3).map((c) => (
                                    <div key={c.category} className="flex items-center gap-2">
                                      <span className="w-20 shrink-0 text-[10px] text-slate-400 truncate">{c.category}</span>
                                      <div className="flex-1 h-1.5 rounded-full bg-slate-700">
                                        <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${c.score}%` }} />
                                      </div>
                                      <span className="text-[10px] text-slate-300 w-6 text-right">{Math.round(c.score)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading advisor data...</div>}
                          </div>
                        ) : item.key === 'messaging-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {messagingHealthData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Service Bus', value: messagingHealthData.totalServiceBusNamespaces, color: 'text-cyan-300' },
                                    { label: 'Event Hubs', value: messagingHealthData.totalEventHubNamespaces, color: 'text-violet-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-center">
                                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading messaging data...</div>}
                          </div>
                        ) : item.key === 'support-tickets' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {supportTicketData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Open', value: supportTicketData.totalOpenTickets, color: 'text-cyan-300' },
                                    { label: 'Critical', value: supportTicketData.criticalCount, color: supportTicketData.criticalCount > 0 ? 'text-red-300' : 'text-slate-400' },
                                    { label: 'High', value: supportTicketData.highCount, color: supportTicketData.highCount > 0 ? 'text-orange-300' : 'text-slate-400' },
                                    { label: 'Moderate', value: supportTicketData.moderatCount, color: 'text-amber-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading ticket data...</div>}
                          </div>
                        ) : item.key === 'vmss-health' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {vmssHealthData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Scale Sets', value: vmssHealthData.totalScaleSets, color: 'text-cyan-300' },
                                    { label: 'Running', value: vmssHealthData.runningCount, color: 'text-emerald-300' },
                                    { label: 'Failed', value: vmssHealthData.failedCount, color: vmssHealthData.failedCount > 0 ? 'text-red-300' : 'text-slate-400' },
                                    { label: 'Instances', value: vmssHealthData.totalInstances, color: 'text-violet-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading VMSS data...</div>}
                          </div>
                        ) : item.key === 'alerts' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {alertsData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Total Active', value: alertsData.totalActive, color: alertsData.totalActive > 0 ? 'text-red-300' : 'text-emerald-300' },
                                    { label: 'Critical', value: alertsData.sev0Count, color: alertsData.sev0Count > 0 ? 'text-red-400' : 'text-slate-400' },
                                    { label: 'Error', value: alertsData.sev1Count, color: alertsData.sev1Count > 0 ? 'text-orange-400' : 'text-slate-400' },
                                    { label: 'Warning', value: alertsData.sev2Count, color: alertsData.sev2Count > 0 ? 'text-amber-400' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {alertsData.totalActive === 0 && (
                                  <p className="text-center text-xs text-emerald-400">✅ No active alerts</p>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading alerts...</div>}
                          </div>
                        ) : item.key === 'expressroute' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {expressRouteData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Circuits', value: expressRouteData.totalCircuits, color: 'text-cyan-300' },
                                    { label: 'Provisioned', value: expressRouteData.provisionedCount, color: 'text-emerald-300' },
                                    { label: 'Not Provisioned', value: expressRouteData.notProvisionedCount, color: expressRouteData.notProvisionedCount > 0 ? 'text-red-300' : 'text-slate-400' },
                                    { label: 'Bandwidth', value: `${(expressRouteData.totalBandwidthMbps / 1000).toFixed(1)}G`, color: 'text-amber-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {expressRouteData.totalCircuits === 0 && (
                                  <p className="text-center text-xs text-slate-400">No ExpressRoute circuits found</p>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading Express Route data...</div>}
                          </div>
                        ) : item.key === 'azure-firewall' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {azureFirewallData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Firewalls', value: azureFirewallData.totalFirewalls, color: 'text-orange-300' },
                                    { label: 'Healthy', value: azureFirewallData.healthyCount, color: 'text-emerald-300' },
                                    { label: 'Blocked 24h', value: azureFirewallData.totalBlockedLast24h > 999 ? `${(azureFirewallData.totalBlockedLast24h / 1000).toFixed(1)}K` : String(azureFirewallData.totalBlockedLast24h), color: azureFirewallData.totalBlockedLast24h > 0 ? 'text-red-300' : 'text-slate-400' },
                                    { label: 'Threat Hits', value: azureFirewallData.threatIntelHits, color: azureFirewallData.threatIntelHits > 0 ? 'text-red-300' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {azureFirewallData.insights.filter(i => i.severity === 'High').length > 0 && (
                                  <p className="text-center text-xs text-red-400">{azureFirewallData.insights.filter(i => i.severity === 'High').length} critical insight{azureFirewallData.insights.filter(i => i.severity === 'High').length !== 1 ? 's' : ''} — view details</p>
                                )}
                                {azureFirewallData.totalFirewalls === 0 && (
                                  <p className="text-center text-xs text-slate-400">No Azure Firewalls found</p>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading firewall data...</div>}
                          </div>
                        ) : item.key === 'vwan' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {vwanData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Virtual WANs', value: vwanData.totalVwans, color: 'text-violet-300' },
                                    { label: 'Total Hubs', value: vwanData.totalHubs, color: 'text-cyan-300' },
                                    { label: 'Connected', value: vwanData.connectedHubs, color: 'text-emerald-300' },
                                    { label: 'Disconnected', value: vwanData.totalHubs - vwanData.connectedHubs, color: (vwanData.totalHubs - vwanData.connectedHubs) > 0 ? 'text-red-300' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {vwanData.totalVwans === 0 && (
                                  <p className="text-center text-xs text-slate-400">No Virtual WAN resources found</p>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading VWAN data...</div>}
                          </div>
                        ) : item.key === 'app-gateway' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {appGatewayData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Gateways', value: appGatewayData.totalGateways, color: 'text-teal-300' },
                                    { label: 'WAF Enabled', value: appGatewayData.wafEnabledCount, color: 'text-emerald-300' },
                                    { label: 'Requests 24h', value: appGatewayData.totalRequests24h > 9999 ? `${(appGatewayData.totalRequests24h / 1000).toFixed(1)}K` : String(appGatewayData.totalRequests24h), color: 'text-cyan-300' },
                                    { label: 'Blocked 24h', value: appGatewayData.totalBlocked24h > 9999 ? `${(appGatewayData.totalBlocked24h / 1000).toFixed(1)}K` : String(appGatewayData.totalBlocked24h), color: appGatewayData.totalBlocked24h > 0 ? 'text-red-300' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {appGatewayData.totalGateways === 0 && (
                                  <p className="text-center text-xs text-slate-400">No Application Gateways found</p>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading App Gateway data...</div>}
                          </div>
                        ) : item.key === 'vpn-gateway' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {vpnGatewayData ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { label: 'Gateways', value: vpnGatewayData.totalGateways, color: 'text-indigo-300' },
                                    { label: 'Connections', value: vpnGatewayData.totalConnections, color: 'text-cyan-300' },
                                    { label: 'Connected', value: vpnGatewayData.connectedTunnels, color: 'text-emerald-300' },
                                    { label: 'Degraded', value: vpnGatewayData.degradedCount, color: vpnGatewayData.degradedCount > 0 ? 'text-red-300' : 'text-slate-400' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                                {vpnGatewayData.totalGateways === 0 && (
                                  <p className="text-center text-xs text-slate-400">No VPN Gateways found</p>
                                )}
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading VPN Gateway data...</div>}
                          </div>
                        ) : item.key === 'identity-attack-surface' ? (
                          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                            {identityAttackSurfaceData ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] uppercase tracking-widest text-slate-400">Risk Score</span>
                                  <span className={`text-2xl font-black ${identityAttackSurfaceData.identityRiskScore >= 70 ? 'text-red-400' : identityAttackSurfaceData.identityRiskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {identityAttackSurfaceData.identityRiskScore}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${identityAttackSurfaceData.identityRiskScore >= 70 ? 'bg-red-500' : identityAttackSurfaceData.identityRiskScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${identityAttackSurfaceData.identityRiskScore}%` }}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                  {[
                                    { label: 'Owner Roles', value: identityAttackSurfaceData.ownerAssignments, color: identityAttackSurfaceData.ownerAssignments > 5 ? 'text-red-300' : 'text-slate-300' },
                                    { label: 'SP Owners', value: identityAttackSurfaceData.servicePrincipalOwnerCount, color: identityAttackSurfaceData.servicePrincipalOwnerCount > 0 ? 'text-orange-300' : 'text-slate-300' },
                                    { label: 'Risky Sign-ins', value: identityAttackSurfaceData.riskySignInCount, color: identityAttackSurfaceData.riskySignInCount > 0 ? 'text-amber-300' : 'text-slate-300' },
                                    { label: 'Findings', value: identityAttackSurfaceData.findings.length, color: 'text-slate-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                      <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">Loading identity data...</div>}
                          </div>
                        ) : (
                          <>
                            <p className="mt-2 text-sm text-slate-200">{item.summary}</p>
                            <p className="mt-1 text-xs text-slate-400">{item.value}</p>
                          </>
                        )}
                        {item.to !== '/' && (
                          <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-700/40 pt-2.5" onClick={(e) => e.stopPropagation()}>
                            {(item.key === 'network-topology' || item.key === 'security-blast-radius') && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.key === 'network-topology') networkTopoGraphRef.current?.downloadPng();
                                  else blastRadiusGraphRef.current?.downloadPng();
                                }}
                                className="flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Download PNG
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(item.to)}
                              className="text-xs font-semibold text-cyan-400 transition hover:text-cyan-200"
                            >
                              View Details →
                            </button>
                          </div>
                        )}
                      </div>
                    </SortableWidget>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </section>

      {/* Widget help overlay */}
      {openHelpKey && (() => {
        const activeWidget = customWidgets.find((w) => w.key === openHelpKey);
        if (!activeWidget) return null;
        const help = widgetHelpContent[openHelpKey] ?? { what: activeWidget.summary, how: 'Data is fetched from your configured Azure subscriptions.' };
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setOpenHelpKey(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
            {/* Modal card */}
            <div
              className="relative w-full max-w-md rounded-2xl border border-sky-400/30 bg-slate-900 shadow-2xl shadow-sky-900/40"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-sky-300" aria-hidden="true">
                      <circle cx="8" cy="8" r="6.5" />
                      <path d="M8 7v5" />
                      <circle cx="8" cy="4.5" r="0.5" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-white">{activeWidget.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenHelpKey(null)}
                  aria-label="Close"
                  className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-white/20 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5">
                    <path d="M12 4 4 12M4 4l8 8" />
                  </svg>
                </button>
              </div>
              {/* Body */}
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-sky-400/15 bg-sky-500/8 p-4">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400">What is this widget?</p>
                  <p className="text-sm leading-relaxed text-slate-200">{help.what}</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/4 p-4">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">How is the data calculated / fetched?</p>
                  <p className="text-sm leading-relaxed text-slate-400">{help.how}</p>
                </div>
              </div>
              <div className="border-t border-white/8 px-5 py-3">
                <p className="text-[10px] text-slate-600">Press Esc or click outside to close</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const RESOURCE_TYPE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#fb923c', '#a78bfa'];

function ChangesWidget({
  data,
  timeRange,
  onTimeRangeChange,
}: {
  data: ChangesDashboard | null;
  timeRange: 'today' | '2days' | '1week';
  onTimeRangeChange: (r: 'today' | '2days' | '1week') => void;
}) {
  const ranges: { key: 'today' | '2days' | '1week'; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '2days', label: '2 Days' },
    { key: '1week', label: '1 Week' },
  ];

  const barData = React.useMemo(() => {
    if (!data) return [];
    const counts: Record<string, { date: string; Create: number; Update: number; Delete: number }> = {};
    for (const c of data.changes) {
      const day = new Date(c.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!counts[day]) counts[day] = { date: day, Create: 0, Update: 0, Delete: 0 };
      const k = c.changeType as 'Create' | 'Update' | 'Delete';
      counts[day][k] = (counts[day][k] ?? 0) + 1;
    }
    return Object.values(counts).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  }, [data]);

  const resourceTypePieData = React.useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    for (const c of data.changes) {
      const shortType = c.resourceType.split('/').pop() ?? c.resourceType;
      counts[shortType] = (counts[shortType] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  const radialData = React.useMemo(() => {
    if (!data || data.totalCount === 0) return [];
    return [
      { name: 'Created', value: Math.round((data.createCount / data.totalCount) * 100), fill: '#10b981' },
      { name: 'Updated', value: Math.round((data.updateCount / data.totalCount) * 100), fill: '#f59e0b' },
      { name: 'Deleted', value: Math.round((data.deleteCount / data.totalCount) * 100), fill: '#ef4444' },
    ];
  }, [data]);

  return (
    <div className="mt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Time range + total */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-800/60 p-0.5">
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); onTimeRangeChange(r.key); }}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${timeRange === r.key ? 'bg-violet-500/30 text-violet-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {data && (
          <span className="text-sm font-bold text-white">{data.totalCount} <span className="text-xs font-normal text-slate-400">total changes</span></span>
        )}
      </div>

      {!data ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
        </div>
      ) : data.totalCount === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">No changes in this period</div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Created', count: data.createCount, color: '#10b981', bg: 'from-emerald-500/15 to-emerald-900/10', border: 'border-emerald-500/25' },
              { label: 'Updated', count: data.updateCount, color: '#f59e0b', bg: 'from-amber-500/15 to-amber-900/10', border: 'border-amber-500/25' },
              { label: 'Deleted', count: data.deleteCount, color: '#ef4444', bg: 'from-red-500/15 to-red-900/10', border: 'border-red-500/25' },
            ].map((k) => (
              <div key={k.label} className={`rounded-xl border ${k.border} bg-gradient-to-br ${k.bg} p-3 text-center`}>
                <p className="text-2xl font-black" style={{ color: k.color }}>{k.count}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Charts row: stacked bar + donut side by side */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {/* Stacked bar - activity over time */}
            <div className="md:col-span-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Activity Over Time</p>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barSize={18} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#e2e8f0' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="Create" stackId="a" fill="#10b981" />
                    <Bar dataKey="Update" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Delete" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Resource type donut */}
            <div className="md:col-span-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">By Resource Type</p>
              <div className="flex items-center gap-2">
                <div className="h-[160px] w-[120px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={resourceTypePieData} cx="50%" cy="50%" innerRadius="38%" outerRadius="68%" paddingAngle={2} dataKey="value">
                        {resourceTypePieData.map((_, i) => (
                          <Cell key={i} fill={RESOURCE_TYPE_COLORS[i % RESOURCE_TYPE_COLORS.length]} stroke="rgba(0,0,0,0.3)" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  {resourceTypePieData.slice(0, 5).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: RESOURCE_TYPE_COLORS[i % RESOURCE_TYPE_COLORS.length] }} />
                      <span className="flex-1 truncate text-slate-300">{d.name}</span>
                      <span className="tabular-nums text-slate-500">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Radial breakdown + top changers row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Radial change-type breakdown */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Change Mix</p>
              <div className="flex items-center gap-3">
                <div className="h-[110px] w-[110px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%" cy="50%"
                      innerRadius="30%" outerRadius="90%"
                      barSize={10}
                      data={radialData}
                      startAngle={90} endAngle={-270}
                    >
                      <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Tooltip
                        formatter={(v) => [`${v}%`]}
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 11 }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {radialData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.fill }} />
                      <span className="text-xs text-slate-300">{d.name}</span>
                      <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: d.fill }}>{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top change makers */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top Change Makers</p>
              <div className="space-y-1.5">
                {data.topChangedBy.slice(0, 4).map((who, idx) => {
                  const count = data.changes.filter((c) => c.changedBy === who).length;
                  const pct = data.totalCount > 0 ? Math.round((count / data.totalCount) * 100) : 0;
                  return (
                    <div key={who} className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-slate-900"
                        style={{ background: RESOURCE_TYPE_COLORS[idx % RESOURCE_TYPE_COLORS.length] }}
                      >
                        {(who[0] ?? '?').toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[10px]">
                          <span className="truncate text-slate-200">{who}</span>
                          <span className="ml-1 shrink-0 tabular-nums text-slate-400">{count}</span>
                        </div>
                        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: RESOURCE_TYPE_COLORS[idx % RESOURCE_TYPE_COLORS.length] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {data.topChangedBy.length === 0 && <p className="text-xs text-slate-500">No actor data</p>}
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}

// ─── Operational Intelligence visual widget ──────────────────────────────────

import type { Insight } from '../types/insight';
import { SeverityLevel } from '../types/insight';

const SEV_META = [
  { sev: SeverityLevel.Critical, label: 'Critical', fill: '#ef4444', bg: 'from-red-500/20 to-red-900/10', border: 'border-red-500/30' },
  { sev: SeverityLevel.High,     label: 'High',     fill: '#f97316', bg: 'from-orange-500/20 to-orange-900/10', border: 'border-orange-500/30' },
  { sev: SeverityLevel.Medium,   label: 'Medium',   fill: '#eab308', bg: 'from-yellow-500/20 to-yellow-900/10', border: 'border-yellow-500/30' },
  { sev: SeverityLevel.Low,      label: 'Low',      fill: '#3b82f6', bg: 'from-blue-500/20 to-blue-900/10', border: 'border-blue-500/30' },
];

const CAT_COLORS: Record<string, string> = {
  Security:    '#f43f5e',
  Cost:        '#10b981',
  Performance: '#f59e0b',
  Governance:  '#60a5fa',
  General:     '#94a3b8',
};

function getHealthBand(insights: Insight[]): { label: string; color: string; bg: string; border: string; dot: string } {
  if (insights.some((i) => i.severity === SeverityLevel.Critical))
    return { label: 'Critical Alert', color: 'text-red-300', bg: 'from-red-900/40 to-red-950/20', border: 'border-red-500/30', dot: 'bg-red-400 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]' };
  if (insights.some((i) => i.severity === SeverityLevel.High))
    return { label: 'Warning', color: 'text-orange-300', bg: 'from-orange-900/40 to-orange-950/20', border: 'border-orange-500/30', dot: 'bg-orange-400 shadow-[0_0_8px_2px_rgba(249,115,22,0.6)]' };
  if (insights.some((i) => i.severity === SeverityLevel.Medium))
    return { label: 'Advisory', color: 'text-yellow-300', bg: 'from-yellow-900/30 to-yellow-950/10', border: 'border-yellow-500/25', dot: 'bg-yellow-400 shadow-[0_0_8px_2px_rgba(234,179,8,0.5)]' };
  if (insights.length > 0)
    return { label: 'Informational', color: 'text-blue-300', bg: 'from-blue-900/30 to-blue-950/10', border: 'border-blue-500/25', dot: 'bg-blue-400 shadow-[0_0_6px_2px_rgba(59,130,246,0.4)]' };
  return { label: 'All Clear', color: 'text-emerald-300', bg: 'from-emerald-900/30 to-emerald-950/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]' };
}

function IntelligenceWidget({ refreshTick }: { refreshTick: number }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    nightWatchClient.getIntelligenceFeed(refreshTick)
      .then((data) => { if (!cancelled) { setInsights(Array.isArray(data) ? (data as Insight[]) : []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTick]);

  const sevCounts = React.useMemo(
    () => SEV_META.map((m) => ({ ...m, count: insights.filter((i) => i.severity === m.sev).length })),
    [insights],
  );
  const donutData = sevCounts.filter((d) => d.count > 0);

  const catData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of insights) counts[i.category] = (counts[i.category] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [insights]);

  const topSignals = React.useMemo(
    () => [...insights].sort((a, b) => {
      const ai = SEV_META.findIndex((m) => m.sev === a.severity);
      const bi = SEV_META.findIndex((m) => m.sev === b.severity);
      return ai - bi;
    }).slice(0, 5),
    [insights],
  );

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    );
  }

  const health = getHealthBand(insights);
  const maxCat = Math.max(1, ...catData.map((d) => d.value));

  return (
    <div className="space-y-4">
      {/* Health status banner */}
      <div className={`flex items-center gap-3 rounded-xl border bg-gradient-to-r ${health.bg} ${health.border} px-4 py-3`}>
        <span className={`h-3 w-3 shrink-0 rounded-full ${health.dot}`} />
        <div className="flex-1">
          <p className={`text-base font-black ${health.color}`}>{health.label}</p>
          <p className="text-[11px] text-slate-400">{insights.length} active signal{insights.length !== 1 ? 's' : ''} across your Azure environment</p>
        </div>
        <p className={`text-3xl font-black tabular-nums ${health.color}`}>{insights.length}</p>
      </div>

      {insights.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-emerald-300">No active signals — environment looks healthy.</div>
      ) : (
        <>
          {/* KPI severity strip */}
          <div className="grid grid-cols-4 gap-2">
            {sevCounts.map((m) => (
              <div key={m.label} className={`rounded-xl border ${m.border} bg-gradient-to-br ${m.bg} p-2 text-center`}>
                <p className="text-2xl font-black tabular-nums" style={{ color: m.fill }}>{m.count}</p>
                <p className="text-[9px] uppercase tracking-wider text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Charts: donut + category bars */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Severity donut */}
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Severity Mix</p>
              <div className="flex items-center gap-3">
                <div className="h-[130px] w-[130px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={2} dataKey="count">
                        {donutData.map((d, i) => (
                          <Cell key={i} fill={d.fill} stroke="rgba(0,0,0,0.3)" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, _n, p) => [`${v}`, p.payload.label]}
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {sevCounts.filter((m) => m.count > 0).map((m) => (
                    <div key={m.label} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.fill }} />
                      <span className="text-slate-300">{m.label}</span>
                      <span className="ml-auto tabular-nums font-semibold" style={{ color: m.fill }}>{m.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category horizontal bars */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">By Category</p>
              <div className="space-y-2">
                {catData.map((d) => (
                  <div key={d.name}>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-300">{d.name}</span>
                      <span className="tabular-nums font-semibold" style={{ color: CAT_COLORS[d.name] ?? '#94a3b8' }}>{d.value}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((d.value / maxCat) * 100)}%`, background: CAT_COLORS[d.name] ?? '#94a3b8' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top signals — compact visual rows */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top Signals</p>
            <div className="space-y-1.5">
              {topSignals.map((sig) => {
                const meta = SEV_META.find((m) => m.sev === sig.severity)!;
                const catColor = CAT_COLORS[sig.category] ?? '#94a3b8';
                return (
                  <div
                    key={sig.id}
                    className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2"
                    style={{ borderLeftColor: meta.fill, borderLeftWidth: 3 }}
                  >
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: `${meta.fill}22`, color: meta.fill }}
                    >
                      {meta.label}
                    </span>
                    <span className="flex-1 truncate text-xs text-slate-200">{sig.title}</span>
                    <span className="shrink-0 text-[10px] font-semibold" style={{ color: catColor }}>{sig.category}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// ─── Score Gauge ─────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 85 ? '#06b6d4' : s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444';
}
function scoreBand(s: number) {
  return s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 40 ? 'Needs Work' : 'Critical';
}

function ScoreGauge({ score, size = 130 }: { score: number; size?: number }) {
  const cx = size / 2;
  const cy = size * 0.54;
  const r = size * 0.35;
  const tw = size * 0.077;
  const START = 225;
  const TOTAL = 270;
  const clamped = Math.max(0, Math.min(100, score));
  const fillEnd = START + (clamped / 100) * TOTAL;
  const trackEnd = START + TOTAL;

  function polar(deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arc(s: number, e: number) {
    if (e - s < 0.01) return '';
    const p1 = polar(s), p2 = polar(e);
    const la = e - s > 180 ? 1 : 0;
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${la} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const color = scoreColor(score);
  const h = size * 0.82;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="overflow-visible">
      <path d={arc(START, trackEnd)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={tw} strokeLinecap="round" />
      {clamped > 0 && (
        <path d={arc(START, fillEnd)} fill="none" stroke={color} strokeWidth={tw} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}70)` }}
        />
      )}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={r * 0.65} fontWeight="900" fontFamily="system-ui,sans-serif">
        {score}
      </text>
      <text x={cx} y={cy + r * 0.43} textAnchor="middle" dominantBaseline="middle"
        fill="rgba(148,163,184,0.55)" fontSize={r * 0.29} fontFamily="system-ui,sans-serif">
        / 100
      </text>
    </svg>
  );
}

import type { ExecutiveDashboard } from '../types/dashboard';

function DrRecoverabilityWidget({ data }: { data: DrDashboard | null }) {
  if (!data) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">Loading DR data...</div>;
  }

  const compliant    = data.workloadAssessments.filter((w) => w.complianceStatus === 'Compliant').length;
  const partial      = data.workloadAssessments.filter((w) => w.complianceStatus === 'Partial').length;
  const nonCompliant = data.workloadAssessments.filter((w) => w.complianceStatus === 'Non-Compliant').length;
  const total        = data.totalWorkloadsAssessed;

  const trendData = data.complianceTrend.map((p) => ({
    month: new Date(p.timestamp).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    rpo: Math.round(p.rpoCompliancePercent),
    rto: Math.round(p.rtoCompliancePercent),
    readiness: Math.round(p.drReadinessScore),
  }));

  const typeCounts: Record<string, number> = {};
  for (const w of data.workloadAssessments) {
    typeCounts[w.workloadType] = (typeCounts[w.workloadType] ?? 0) + 1;
  }
  const typeColors: Record<string, string> = {
    database: '#818cf8', app: '#38bdf8', storage: '#fb923c', container: '#4ade80', other: '#94a3b8',
  };
  const donutData = Object.entries(typeCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: typeColors[name] ?? '#94a3b8',
  }));

  return (
    <div className="space-y-3">
      {/* Chart 1: Compliance breakdown bar */}
      <div>
        <div className="mb-1.5 flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />Compliant <span className="font-bold text-emerald-300">{compliant}</span></span>
          <span className="flex items-center gap-1 text-slate-400"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Partial <span className="font-bold text-amber-300">{partial}</span></span>
          <span className="flex items-center gap-1 text-slate-400"><span className="h-2 w-2 rounded-full bg-rose-400 inline-block" />Non-Compliant <span className="font-bold text-rose-300">{nonCompliant}</span></span>
          <span className="ml-auto text-slate-500">{total} workloads</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full gap-0.5">
          {compliant    > 0 && <div className="h-full bg-emerald-400" style={{ width: `${(compliant    / total) * 100}%` }} />}
          {partial      > 0 && <div className="h-full bg-amber-400"   style={{ width: `${(partial      / total) * 100}%` }} />}
          {nonCompliant > 0 && <div className="h-full bg-rose-400"    style={{ width: `${(nonCompliant / total) * 100}%` }} />}
        </div>
      </div>

      {/* Charts 2 + 3: Trend + Donut side by side */}
      <div className="grid grid-cols-3 gap-3">
        {/* Chart 2: Compliance trend */}
        <div className="col-span-2">
          <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-500">6-Month Compliance Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="wRpo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} /><stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="wRto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} /><stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="wRdy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(val: unknown, name: unknown) => [`${val}%`, String(name)]}
              />
              <Area type="monotone" dataKey="rpo"      name="RPO"      stroke="#818cf8" strokeWidth={1.5} fill="url(#wRpo)" dot={false} />
              <Area type="monotone" dataKey="rto"      name="RTO"      stroke="#38bdf8" strokeWidth={1.5} fill="url(#wRto)" dot={false} />
              <Area type="monotone" dataKey="readiness" name="Readiness" stroke="#34d399" strokeWidth={1.5} fill="url(#wRdy)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-1 flex gap-3 text-[9px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-indigo-400 inline-block" />RPO</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-sky-400 inline-block" />RTO</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-emerald-400 inline-block" />Readiness</span>
          </div>
        </div>

        {/* Chart 3: Workload type donut */}
        <div>
          <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-500">Workload Types</p>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius="45%" outerRadius="78%" dataKey="value" paddingAngle={2} isAnimationActive>
                {donutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                formatter={(val: unknown, name: unknown) => [`${val}`, String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-0.5 mt-1">
            {donutData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-[9px]">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: entry.color }} />
                <span className="flex-1 text-slate-400 truncate">{entry.name}</span>
                <span className="font-bold tabular-nums" style={{ color: entry.color }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCardWidget({ widgetKey, dashboard }: { widgetKey: string; dashboard: ExecutiveDashboard }) {
  const scoreMap: Record<string, number> = {
    azureHealth: dashboard.azureHealthScore,
    security: dashboard.securityPostureScore,
    performance: dashboard.performanceScore,
    cost: dashboard.costEfficiencyScore,
    governance: dashboard.governanceComplianceScore,
    reliability: dashboard.reliabilityScore,
  };

  const score = scoreMap[widgetKey] ?? 0;
  const color = scoreColor(score);
  const band = scoreBand(score);
  const isSynthetic = dashboard.dataStatus !== 'Live';

  const sparkData = dashboard.dailyTrend.slice(-7).map((d) => ({ v: d.value }));
  const prevScore = sparkData.length >= 2 ? sparkData[sparkData.length - 2].v : score;
  const delta = score - prevScore;

  const riskCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const cell of dashboard.subscriptionRiskHeatmap) {
    riskCounts[cell.riskLevel] = (riskCounts[cell.riskLevel] ?? 0) + 1;
  }

  const riskMeta = [
    { lvl: 'Critical', color: '#ef4444' },
    { lvl: 'High',     color: '#f97316' },
    { lvl: 'Medium',   color: '#eab308' },
    { lvl: 'Low',      color: '#3b82f6' },
  ];

  return (
    <div className="space-y-3">
      {isSynthetic && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[10px] font-medium text-amber-300">Estimated — no subscriptions configured</span>
        </div>
      )}
      {/* Gauge row */}
      <div className="flex items-center gap-3">
        <ScoreGauge score={score} size={130} />
        <div className="flex-1 space-y-2">
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
          >
            {band}
          </span>
          {delta !== 0 && (
            <p className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)} pts vs prev
            </p>
          )}
          {delta === 0 && <p className="text-xs text-slate-500">→ Stable</p>}
        </div>
      </div>

      {/* Sparkline */}
      {sparkData.length > 2 && (
        <div>
          <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Recent Trend</p>
          <div className="h-[36px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id={`sg-${widgetKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                  fill={`url(#sg-${widgetKey})`} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── azureHealth: all 5 sub-score bars ── */}
      {widgetKey === 'azureHealth' && (
        <div className="space-y-1.5">
          {[
            { label: 'Security',    val: dashboard.securityPostureScore,    c: '#f43f5e' },
            { label: 'Performance', val: dashboard.performanceScore,        c: '#f59e0b' },
            { label: 'Cost',        val: dashboard.costEfficiencyScore,     c: '#10b981' },
            { label: 'Governance',  val: dashboard.governanceComplianceScore, c: '#60a5fa' },
            { label: 'Reliability', val: dashboard.reliabilityScore,        c: '#a78bfa' },
          ].map((sub) => (
            <div key={sub.label}>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-slate-400">{sub.label}</span>
                <span style={{ color: sub.c }} className="font-semibold tabular-nums">{sub.val}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${sub.val}%`, background: sub.c }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── security / governance: subscription risk heatmap ── */}
      {(widgetKey === 'security' || widgetKey === 'governance') && (
        <div>
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Subscription Risk</p>
          <div className="space-y-1">
            {riskMeta.filter((m) => riskCounts[m.lvl] > 0).map((m) => (
              <div key={m.lvl} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} />
                <span className="flex-1 text-xs text-slate-300">{m.lvl}</span>
                <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((riskCounts[m.lvl] / Math.max(1, dashboard.subscriptionRiskHeatmap.length)) * 100)}%`, background: m.color }} />
                </div>
                <span className="w-5 text-right text-xs font-semibold tabular-nums" style={{ color: m.color }}>{riskCounts[m.lvl]}</span>
              </div>
            ))}
            {dashboard.subscriptionRiskHeatmap.length === 0 && (
              <p className="text-xs text-slate-500">No subscription data</p>
            )}
          </div>
        </div>
      )}

      {/* ── reliability: dual-arc radial chart (reliability score + backup coverage) ── */}
      {widgetKey === 'reliability' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-[90px] h-[90px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%" cy="50%"
                  innerRadius="28%" outerRadius="100%"
                  startAngle={220} endAngle={-40}
                  data={[
                    { name: 'Backup Coverage', value: dashboard.backupCoveragePercent, fill: '#6366f1' },
                    { name: 'Reliability',      value: score,                           fill: color },
                  ]}
                  barSize={9}
                >
                  <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.04)' }} isAnimationActive />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-slate-400">Reliability</span>
                <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color }}>{score.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                <span className="text-[10px] text-slate-400">Backup Coverage</span>
                <span className="ml-auto text-[10px] font-bold tabular-nums text-indigo-300">{dashboard.backupCoveragePercent.toFixed(0)}%</span>
              </div>
              <p className="text-[9px] text-slate-500 pt-0.5">{dashboard.protectedWorkloads}/{dashboard.totalStatefulWorkloads} workloads protected</p>
            </div>
          </div>
          {(riskCounts['Critical'] ?? 0) + (riskCounts['High'] ?? 0) > 0 && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-rose-300">High-risk subscriptions</span>
              <span className="text-sm font-black text-rose-300">{(riskCounts['Critical'] ?? 0) + (riskCounts['High'] ?? 0)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── performance: delta callout (only if no sparkline covered it) ── */}
      {widgetKey === 'performance' && (
        <div className={`rounded-xl border px-3 py-2 text-center ${delta > 0 ? 'border-emerald-500/20 bg-emerald-500/8' : delta < 0 ? 'border-rose-500/20 bg-rose-500/8' : 'border-white/10 bg-white/5'}`}>
          <p className={`text-lg font-black tabular-nums ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-400'}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(0)} pts
          </p>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">vs previous period</p>
        </div>
      )}
    </div>
  );
}

// Drag handle context — lets only the grip icon trigger drag, not the whole card.
const DragHandleContext = createContext<React.HTMLAttributes<HTMLElement>>({});

function SortableWidget({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <DragHandleContext.Provider value={listeners ?? {}}>
      <div ref={setNodeRef} style={style} className={className} {...attributes}>
        {children}
      </div>
    </DragHandleContext.Provider>
  );
}

function WidgetDragHandle({ label }: { label: string }) {
  const handleProps = useContext(DragHandleContext);
  return (
    <div
      {...handleProps}
      className="flex flex-1 cursor-grab select-none touch-none items-center gap-2 active:cursor-grabbing"
      title="Drag to reorder"
    >
      <div className="shrink-0 rounded p-0.5 text-slate-600 hover:text-slate-400" aria-hidden="true">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
          <circle cx="5" cy="3" r="1.2"/><circle cx="11" cy="3" r="1.2"/>
          <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
          <circle cx="5" cy="13" r="1.2"/><circle cx="11" cy="13" r="1.2"/>
        </svg>
      </div>
      <p className="text-lg font-semibold text-white">{label}</p>
    </div>
  );
}

// ─── Spend Anomaly & Forecast Widget ─────────────────────────────────────────

const ANOMALY_SEV_META: Record<string, { color: string; bg: string; border: string }> = {
  Critical: { color: '#ef4444', bg: 'from-red-500/20 to-red-900/10',    border: 'border-red-500/30' },
  High:     { color: '#f97316', bg: 'from-orange-500/20 to-orange-900/10', border: 'border-orange-500/30' },
  Medium:   { color: '#eab308', bg: 'from-yellow-500/20 to-yellow-900/10', border: 'border-yellow-500/25' },
  Low:      { color: '#3b82f6', bg: 'from-blue-500/20 to-blue-900/10',  border: 'border-blue-500/25' },
};

function SpendAnomalyWidget({
  data,
  timeRange,
  onTimeRangeChange,
}: {
  data: CostAnomalyForecastDashboard | null;
  timeRange: '7d' | '30d' | '90d';
  onTimeRangeChange: (r: '7d' | '30d' | '90d') => void;
}) {
  const ranges: { key: '7d' | '30d' | '90d'; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
  ];

  const trendData = React.useMemo(() => {
    if (!data) return [];
    return data.trend.map((p) => ({
      ts: new Date(p.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      actual: Math.round(p.actualCost),
      baseline: Math.round(p.baselineCost),
      anomaly: p.isAnomaly ? Math.round(p.actualCost) : null,
    }));
  }, [data]);

  const topAnomalies = React.useMemo(() => {
    if (!data) return [];
    return [...data.anomalies]
      .sort((a, b) => b.deviationPercent - a.deviationPercent)
      .slice(0, 3);
  }, [data]);

  const budgetUtil = data?.budgetForecast.budgetUtilizationPercent ?? 0;
  const budgetColor = budgetUtil >= 90 ? '#ef4444' : budgetUtil >= 70 ? '#f59e0b' : '#10b981';

  return (
    <div className="mt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Time range tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-800/60 p-0.5">
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); onTimeRangeChange(r.key); }}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${timeRange === r.key ? 'bg-emerald-500/30 text-emerald-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {data && <span className="text-xs text-slate-400">{data.anomalies.length} anomal{data.anomalies.length !== 1 ? 'ies' : 'y'} detected</span>}
      </div>

      {!data ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Anomalies', value: String(data.anomalies.length), color: data.anomalies.length > 0 ? '#f97316' : '#10b981' },
              { label: 'Worst Dev.', value: `${data.anomalies.length > 0 ? Math.max(...data.anomalies.map((a) => a.deviationPercent)).toFixed(0) : '0'}%`, color: '#ef4444' },
              { label: 'Budget Used', value: `${budgetUtil.toFixed(0)}%`, color: budgetColor },
              { label: 'Days Left', value: data.budgetForecast.daysToBudgetExhaustion > 999 ? '∞' : String(Math.round(data.budgetForecast.daysToBudgetExhaustion)), color: data.budgetForecast.daysToBudgetExhaustion < 7 ? '#ef4444' : data.budgetForecast.daysToBudgetExhaustion < 30 ? '#f59e0b' : '#10b981' },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-xl font-black tabular-nums" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[9px] uppercase tracking-wider text-slate-400">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Budget utilization bar */}
          <div>
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="text-slate-400">Budget Utilization</span>
              <span className="font-semibold tabular-nums" style={{ color: budgetColor }}>{budgetUtil.toFixed(1)}% of €{data.budgetForecast.budgetLimit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, budgetUtil)}%`, background: budgetColor, boxShadow: `0 0 8px ${budgetColor}60` }}
              />
            </div>
          </div>

          {/* Cost trend: actual vs baseline */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actual vs Baseline Cost</p>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="ts" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v as number / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v, name) => [`€${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, name === 'actual' ? 'Actual' : 'Baseline']}
                  />
                  <Area type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} fill="url(#spendActual)" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top anomalies */}
          {topAnomalies.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top Anomalies</p>
              <div className="space-y-1.5">
                {topAnomalies.map((a, idx) => {
                  const meta = ANOMALY_SEV_META[a.severity] ?? ANOMALY_SEV_META['Medium'];
                  return (
                    <div key={idx} className={`flex items-start gap-2 rounded-lg border ${meta.border} bg-gradient-to-r ${meta.bg} px-3 py-2`}>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ background: `${meta.color}22`, color: meta.color }}>{a.severity}</span>
                      <span className="flex-1 text-xs text-slate-200 truncate">{a.insight}</span>
                      <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: meta.color }}>+{a.deviationPercent.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

// ─── Capacity Planning Widget ─────────────────────────────────────────────────

const URGENCY_META: Record<string, { color: string; bg: string; border: string }> = {
  Critical: { color: '#ef4444', bg: 'from-red-500/20 to-red-900/10',    border: 'border-red-500/30' },
  High:     { color: '#f97316', bg: 'from-orange-500/20 to-orange-900/10', border: 'border-orange-500/30' },
  Medium:   { color: '#eab308', bg: 'from-yellow-500/20 to-yellow-900/10', border: 'border-yellow-500/25' },
  Low:      { color: '#3b82f6', bg: 'from-blue-500/20 to-blue-900/10',  border: 'border-blue-500/25' },
};

function CapacityPlanningWidget({
  data,
  timeRange,
  onTimeRangeChange,
}: {
  data: CapacityPlanningDashboard | null;
  timeRange: '7d' | '30d' | '90d';
  onTimeRangeChange: (r: '7d' | '30d' | '90d') => void;
}) {
  const ranges: { key: '7d' | '30d' | '90d'; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
  ];

  const urgencyCounts = React.useMemo(() => {
    if (!data) return { Critical: 0, High: 0, Medium: 0, Low: 0 };
    const c: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of data.runwayForecast) {
      c[r.urgencyLevel] = (c[r.urgencyLevel] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const criticalItems = React.useMemo(() => {
    if (!data) return [];
    return [...data.runwayForecast]
      .sort((a, b) => a.daysUntilExhaustion - b.daysUntilExhaustion)
      .slice(0, 6);
  }, [data]);

  const topWasteResources = React.useMemo(() => {
    if (!data) return [];
    return [...data.resources]
      .sort((a, b) => b.estimatedMonthlyWaste - a.estimatedMonthlyWaste)
      .slice(0, 4);
  }, [data]);

  const totalWaste = data?.resources.reduce((s, r) => s + r.estimatedMonthlyWaste, 0) ?? 0;

  return (
    <div className="mt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Time range tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-800/60 p-0.5">
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); onTimeRangeChange(r.key); }}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${timeRange === r.key ? 'bg-cyan-500/30 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {data && <span className="text-xs text-slate-400">{data.runwayForecast.length} resource{data.runwayForecast.length !== 1 ? 's' : ''} tracked</span>}
      </div>

      {!data ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Urgency KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {(['Critical', 'High', 'Medium', 'Low'] as const).map((lvl) => {
              const meta = URGENCY_META[lvl];
              return (
                <div key={lvl} className={`rounded-xl border ${meta.border} bg-gradient-to-br ${meta.bg} p-3 text-center`}>
                  <p className="text-2xl font-black tabular-nums" style={{ color: meta.color }}>{urgencyCounts[lvl]}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">{lvl}</p>
                </div>
              );
            })}
          </div>

          {/* Runway countdown cards */}
          {criticalItems.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resource Runway</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {criticalItems.map((item, idx) => {
                  const meta = URGENCY_META[item.urgencyLevel] ?? URGENCY_META['Low'];
                  const pct = Math.min(100, item.currentUsagePercent);
                  return (
                    <div key={idx} className={`flex items-center gap-3 rounded-xl border ${meta.border} bg-gradient-to-r ${meta.bg} px-3 py-2.5`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="truncate font-semibold text-slate-200">{item.resourceName}</span>
                          <span className="shrink-0 ml-1 font-bold tabular-nums" style={{ color: meta.color }}>{item.daysUntilExhaustion}d</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                          </div>
                          <span className="text-[9px] tabular-nums text-slate-400">{pct.toFixed(0)}%</span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5">{item.metric}</p>
                      </div>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: `${meta.color}22`, color: meta.color }}>{item.urgencyLevel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly waste callout */}
          {totalWaste > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-amber-900/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Estimated Monthly Waste</p>
                  <p className="text-xl font-black text-amber-300">€{totalWaste.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="space-y-1">
                  {topWasteResources.map((r) => (
                    <div key={r.resourceName} className="flex items-center gap-2 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="truncate max-w-[120px] text-slate-300">{r.resourceName}</span>
                      <span className="ml-auto tabular-nums text-amber-300 font-semibold">€{r.estimatedMonthlyWaste.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}
