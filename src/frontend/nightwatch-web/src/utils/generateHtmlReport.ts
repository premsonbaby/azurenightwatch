// Generates a self-contained HTML report from NightWatch dashboard data.
// Chart.js is loaded from CDN so the file stays small.

import type {
  ExecutiveDashboard, SecurityDashboard,
  AlertsDashboard, ExpressRouteDashboard, VwanDashboard,
  BackupHealthDashboard, DatabaseHealthDashboard, KeyVaultHealthDashboard,
  AksContainerHealthDashboard, StorageComplianceDashboard, ServiceHealthDashboard,
  ManagedIdentityAuditDashboard, AdvisorScoreDashboard, MessagingHealthDashboard,
  VmssHealthDashboard, WastageTrackerDashboard, NetworkPerimeterDashboard,
  TagHygieneDashboard, OrphanedResourcesDashboard, TopCostlyResourcesDashboard,
  ChangesDashboard, CostAnomalyForecastDashboard, CapacityPlanningDashboard,
  DrDashboard, RiSavingsDashboard, IamReviewDashboard, NonProdUptimeDashboard,
  AppFunctionsHealthDashboard, AzPolicyLensDashboard, SupportTicketDashboard,
  NetworkTopologyDashboard, AzureFirewallDashboard,
  AppGatewayDashboard, VpnGatewayDashboard,
} from '../types/dashboard';

export interface ReportData {
  tenantId: string;
  activeWidgetKeys: string[];
  executive?: ExecutiveDashboard | null;
  security?: SecurityDashboard | null;
  cost?: null;
  governance?: null;
  performance?: null;
  alerts?: AlertsDashboard | null;
  expressroute?: ExpressRouteDashboard | null;
  vwan?: VwanDashboard | null;
  backupHealth?: BackupHealthDashboard | null;
  databaseHealth?: DatabaseHealthDashboard | null;
  keyVaultHealth?: KeyVaultHealthDashboard | null;
  aksContainerHealth?: AksContainerHealthDashboard | null;
  storageCompliance?: StorageComplianceDashboard | null;
  serviceHealth?: ServiceHealthDashboard | null;
  managedIdentityAudit?: ManagedIdentityAuditDashboard | null;
  advisorScore?: AdvisorScoreDashboard | null;
  messagingHealth?: MessagingHealthDashboard | null;
  vmssHealth?: VmssHealthDashboard | null;
  wastageTracker?: WastageTrackerDashboard | null;
  networkPerimeter?: NetworkPerimeterDashboard | null;
  tagHygiene?: TagHygieneDashboard | null;
  orphanedResources?: OrphanedResourcesDashboard | null;
  topCostlyResources?: TopCostlyResourcesDashboard | null;
  azureChanges?: ChangesDashboard | null;
  spendAnomaly?: CostAnomalyForecastDashboard | null;
  capacityPlanning?: CapacityPlanningDashboard | null;
  drRecoverability?: DrDashboard | null;
  riSavings?: RiSavingsDashboard | null;
  iamReview?: IamReviewDashboard | null;
  nonProdUptime?: NonProdUptimeDashboard | null;
  appFunctionsHealth?: AppFunctionsHealthDashboard | null;
  policyRadar?: AzPolicyLensDashboard | null;
  supportTickets?: SupportTicketDashboard | null;
  networkTopology?: NetworkTopologyDashboard | null;
  'azure-firewall'?: AzureFirewallDashboard | null;
  'app-gateway'?: AppGatewayDashboard | null;
  'vpn-gateway'?: VpnGatewayDashboard | null;
}

interface RenderedSection {
  id: string;
  label: string;
  html: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (n: number, decimals = 1): string => n.toFixed(decimals);

const bool = (v: boolean): string =>
  v ? '<span class="badge badge-ok">Yes</span>' : '<span class="badge badge-bad">No</span>';

const riskBadge = (r: string): string => {
  const cls = r === 'Critical' ? 'badge-crit' : r === 'High' ? 'badge-high' : r === 'Medium' ? 'badge-med' : 'badge-low';
  return `<span class="badge ${cls}">${esc(r)}</span>`;
};

const kpi = (label: string, value: string | number, color = '#22d3ee'): string => `
  <div class="kpi">
    <div class="kpi-val" style="color:${color}">${esc(value)}</div>
    <div class="kpi-lbl">${esc(label)}</div>
  </div>`;

const scoreColor = (s: number) => s >= 75 ? '#34d399' : s >= 50 ? '#f59e0b' : '#ef4444';

const table = (headers: string[], rows: string[][]): string => `
  <div class="tbl-wrap">
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;

const section = (id: string, title: string, icon: string, body: string): string => `
  <section id="${id}">
    <div class="sec-header" onclick="toggle('${id}')">
      <span class="sec-title"><span class="sec-icon">${icon}</span>${esc(title)}</span>
      <span class="chevron" id="chv-${id}">▼</span>
    </div>
    <div class="sec-body" id="body-${id}">${body}</div>
  </section>`;

let chartIdx = 0;
const chartId = () => `chart-${++chartIdx}`;

const barChart = (id: string, labels: string[], values: number[], color = '#22d3ee', label = 'Count'): string =>
  `<div class="chart-wrap"><canvas id="${id}"></canvas></div>
   <script>new Chart(document.getElementById('${id}'),{type:'bar',data:{labels:${JSON.stringify(labels)},datasets:[{label:${JSON.stringify(label)},data:${JSON.stringify(values)},backgroundColor:'${color}',borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}})</script>`;

const doughnut = (id: string, labels: string[], values: number[], colors: string[]): string =>
  `<div class="chart-wrap"><canvas id="${id}"></canvas></div>
   <script>new Chart(document.getElementById('${id}'),{type:'doughnut',data:{labels:${JSON.stringify(labels)},datasets:[{data:${JSON.stringify(values)},backgroundColor:${JSON.stringify(colors)},borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{color:'#94a3b8'}}}}})</script>`;

const lineChart = (id: string, labels: string[], values: number[], color = '#22d3ee', label = ''): string =>
  `<div class="chart-wrap"><canvas id="${id}"></canvas></div>
   <script>new Chart(document.getElementById('${id}'),{type:'line',data:{labels:${JSON.stringify(labels)},datasets:[{label:${JSON.stringify(label)},data:${JSON.stringify(values)},borderColor:'${color}',backgroundColor:'${color}22',fill:true,tension:0.4,pointRadius:2}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}})</script>`;

const gaugeHtml = (label: string, value: number): string => {
  const pct = Math.min(100, Math.max(0, value));
  const color = scoreColor(value);
  const angle = (pct / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const x = 60 + 50 * Math.cos(Math.PI - rad);
  const y = 60 - 50 * Math.sin(Math.PI - rad);
  return `
  <div class="gauge-wrap">
    <svg viewBox="0 0 120 70" width="140" height="82">
      <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#1e293b" stroke-width="12" stroke-linecap="round"/>
      <path d="M10,60 A50,50 0 0,1 ${x.toFixed(1)},${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
      <text x="60" y="55" text-anchor="middle" fill="${color}" font-size="16" font-weight="bold">${Math.round(value)}</text>
    </svg>
    <div class="gauge-lbl">${esc(label)}</div>
  </div>`;
};

// ─── per-widget section builders ─────────────────────────────────────────────

function buildExecutive(d: ExecutiveDashboard, sec?: SecurityDashboard | null): string {
  const gaugeRows: [string, number][] = [
    ['Overall', d.azureHealthScore],
    ['Security', d.securityPostureScore],
    ['Performance', d.performanceScore],
    ['Cost', d.costEfficiencyScore],
    ['Governance', d.governanceComplianceScore],
    ['Reliability', d.reliabilityScore],
  ];
  const gaugesHtml = `<div class="gauges">${gaugeRows.map(([label, val]) => gaugeHtml(label, val)).join('')}</div>`;

  const trendPoints = d.dailyTrend ?? [];
  const trend = trendPoints.length > 0
    ? lineChart(chartId(), trendPoints.map((p) => p.name), trendPoints.map((p) => p.value), '#22d3ee', 'Score Trend')
    : '';

  const heatmap = (d.subscriptionRiskHeatmap ?? []).slice(0, 30);
  const heatmapTable = heatmap.length > 0
    ? table(
        ['Subscription', 'Risk Level', 'Est. Impact (€)'],
        heatmap.map((h) => [esc(h.subscriptionName), riskBadge(h.riskLevel), `€${fmt(h.impactEstimateEur, 0)}`]),
      )
    : '';

  const summary = d.executiveSummary ? `<div class="exec-summary">${esc(d.executiveSummary)}</div>` : '';

  const kpis = `<div class="kpis">
    ${kpi('Backup Coverage', `${fmt(d.backupCoveragePercent)}%`, d.backupCoveragePercent < 80 ? '#ef4444' : '#34d399')}
    ${kpi('Protected Workloads', d.protectedWorkloads, '#34d399')}
    ${kpi('Total Workloads', d.totalStatefulWorkloads)}
  </div>`;

  const exposedHtml = sec && (sec.exposedResources ?? []).length > 0
    ? `<h3>Security Exposure</h3>${table(
        ['Resource', 'Category', 'Risk', 'Description'],
        (sec.exposedResources ?? []).slice(0, 20).map((r) => [
          esc(r.resourceName), esc(r.category), riskBadge(r.riskLevel), esc(r.description),
        ]),
      )}`
    : '';

  return gaugesHtml + kpis + summary
    + (trend ? `<h3>Score Trend (30 Days)</h3>${trend}` : '')
    + (heatmapTable ? `<h3>Subscription Risk Heatmap</h3>${heatmapTable}` : '')
    + exposedHtml;
}

function buildAlerts(d: AlertsDashboard): string {
  const alertPie = doughnut(
    chartId(),
    ['Sev0 Critical', 'Sev1 Error', 'Sev2 Warning', 'Sev3 Info', 'Sev4 Verbose'],
    [d.sev0Count, d.sev1Count, d.sev2Count, d.sev3Count, d.sev4Count],
    ['#ef4444', '#f97316', '#f59e0b', '#22d3ee', '#64748b'],
  );
  const topServices = (d.byService ?? []).slice(0, 8);
  const svcChart = topServices.length > 0
    ? barChart(chartId(), topServices.map((s) => s.serviceName), topServices.map((s) => s.count), '#a78bfa', 'Alerts')
    : '';
  const rows = (d.alerts ?? []).slice(0, 50).map((a) => [
    esc(a.severity), esc(a.name), esc(a.alertState), esc(a.monitorService),
    esc(a.subscriptionName), new Date(a.firedDateTime).toLocaleString(),
  ]);
  return `<div class="kpis">
    ${kpi('Total Active', d.totalActive, d.totalActive > 0 ? '#ef4444' : '#34d399')}
    ${kpi('Critical (Sev0)', d.sev0Count, d.sev0Count > 0 ? '#ef4444' : '#64748b')}
    ${kpi('Error (Sev1)', d.sev1Count, d.sev1Count > 0 ? '#f97316' : '#64748b')}
    ${kpi('Warning (Sev2)', d.sev2Count, d.sev2Count > 0 ? '#f59e0b' : '#64748b')}
    ${kpi('New', d.newCount)}
    ${kpi('Acknowledged', d.acknowledgedCount)}
  </div>
  <div class="charts-row">
    <div><h3>Severity Breakdown</h3>${alertPie}</div>
    ${svcChart ? `<div><h3>Top Monitor Services</h3>${svcChart}</div>` : ''}
  </div>
  ${rows.length > 0 ? `<h3>Active Alerts (top 50)</h3>${table(['Severity', 'Name', 'State', 'Service', 'Subscription', 'Fired'], rows)}` : ''}`;
}

function buildExpressRoute(d: ExpressRouteDashboard): string {
  const circuitRows = d.circuits.map((c) => [
    esc(c.name), esc(c.subscriptionName), esc(c.location),
    esc(c.serviceProvider), esc(c.peeringLocation),
    `${c.bandwidthMbps} Mbps`, esc(c.circuitProvisioningState),
    esc(c.serviceProviderProvisioningState), esc(c.tier),
  ]);
  const peeringRows = (d.peerings ?? []).map((p) => [
    esc(p.circuitName), esc(p.peeringType), esc(p.state),
    esc(p.primaryPrefix || '—'), esc(p.secondaryPrefix || '—'),
  ]);
  const provChart = doughnut(chartId(),
    ['Provisioned', 'Not Provisioned'],
    [d.provisionedCount, d.notProvisionedCount],
    ['#34d399', '#ef4444']);
  return `<div class="kpis">
    ${kpi('Total Circuits', d.totalCircuits)}
    ${kpi('Provisioned', d.provisionedCount, '#34d399')}
    ${kpi('Not Provisioned', d.notProvisionedCount, d.notProvisionedCount > 0 ? '#ef4444' : '#64748b')}
    ${kpi('Total Bandwidth', `${(d.totalBandwidthMbps / 1000).toFixed(1)} Gbps`, '#22d3ee')}
  </div>
  <div class="charts-row">
    <div><h3>Provisioning Status</h3>${provChart}</div>
  </div>
  ${circuitRows.length > 0 ? `<h3>Circuits</h3>${table(['Name', 'Subscription', 'Location', 'Provider', 'Peering Location', 'Bandwidth', 'Circuit State', 'SP State', 'Tier'], circuitRows)}` : '<p class="empty">No circuits found.</p>'}
  ${peeringRows.length > 0 ? `<h3>BGP Peerings</h3>${table(['Circuit', 'Peering Type', 'State', 'Primary Prefix', 'Secondary Prefix'], peeringRows)}` : ''}`;
}

function buildVwan(d: VwanDashboard): string {
  const hubRows = d.hubs.map((h) => [
    esc(h.name), esc(h.subscriptionName), esc(h.location),
    esc(h.addressPrefix || '—'), esc(h.hubRoutingPreference || 'Default'), esc(h.provisioningState),
  ]);
  const vwanRows = (d.vwans ?? []).map((v) => [
    esc(v.name), esc(v.subscriptionName), esc(v.location),
    esc(v.vwanType), String(v.hubCount), esc(v.provisioningState),
  ]);
  const locationCounts = d.hubs.reduce<Record<string, number>>((acc, h) => {
    acc[h.location] = (acc[h.location] ?? 0) + 1; return acc;
  }, {});
  const locEntries = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const regionChart = locEntries.length > 0
    ? barChart(chartId(), locEntries.map(([l]) => l), locEntries.map(([, c]) => c), '#a78bfa', 'Hubs')
    : '';
  return `<div class="kpis">
    ${kpi('Virtual WANs', d.totalVwans, '#a78bfa')}
    ${kpi('Total Hubs', d.totalHubs, '#f59e0b')}
    ${kpi('Connected Hubs', d.connectedHubs, '#34d399')}
    ${kpi('Disconnected', d.totalHubs - d.connectedHubs, (d.totalHubs - d.connectedHubs) > 0 ? '#ef4444' : '#64748b')}
  </div>
  ${regionChart ? `<h3>Hubs by Region</h3>${regionChart}` : ''}
  ${vwanRows.length > 0 ? `<h3>Virtual WAN Instances</h3>${table(['Name', 'Subscription', 'Location', 'Type', 'Hubs', 'State'], vwanRows)}` : ''}
  ${hubRows.length > 0 ? `<h3>Virtual Hubs</h3>${table(['Name', 'Subscription', 'Location', 'Address Prefix', 'Routing Preference', 'State'], hubRows)}` : '<p class="empty">No hubs found.</p>'}`;
}

function buildBackupHealth(d: BackupHealthDashboard): string {
  const unprotected = d.totalVms - d.totalProtectedItems;
  const pie = doughnut(chartId(),
    ['Protected', 'Unprotected VMs'],
    [d.totalProtectedItems, d.unprotectedVms],
    ['#34d399', '#ef4444']);
  const typesList = (d.unprotectedResourceTypes ?? []).length > 0
    ? `<h3>Unprotected Resource Types</h3><ul class="bullet-list">${(d.unprotectedResourceTypes ?? []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';
  return `<div class="kpis">
    ${kpi('Protected Items', d.totalProtectedItems, '#34d399')}
    ${kpi('Total VMs', d.totalVms)}
    ${kpi('Unprotected VMs', d.unprotectedVms, d.unprotectedVms > 0 ? '#ef4444' : '#64748b')}
    ${kpi('Coverage', `${fmt(d.protectionCoveragePercent)}%`, d.protectionCoveragePercent < 80 ? '#f59e0b' : '#34d399')}
    ${kpi('Backup Vaults', d.backupVaultCount)}
    ${kpi('At Risk', unprotected, unprotected > 0 ? '#f59e0b' : '#64748b')}
  </div>
  <h3>Protection Coverage</h3>${pie}
  ${typesList}`;
}

function buildDatabaseHealth(d: DatabaseHealthDashboard): string {
  const engineChart = barChart(chartId(),
    ['SQL', 'MySQL', 'PostgreSQL', 'Cosmos DB', 'Elastic Pool'],
    [d.sqlCount, d.mySqlCount, d.postgreSqlCount, d.cosmosDbCount, d.elasticPoolCount],
    '#22d3ee', 'Count');
  const rows = (d.databases ?? []).slice(0, 50).map((db) => [
    esc(db.name), esc(db.dbEngine), esc(db.subscriptionName),
    esc(db.location), esc(db.tier ?? '—'), esc(db.sku ?? '—'), esc(db.status),
  ]);
  return `<div class="kpis">
    ${kpi('Total DBs', d.totalDatabases)}
    ${kpi('Running', d.runningDatabases, '#34d399')}
    ${kpi('Stopped', d.stoppedDatabases, d.stoppedDatabases > 0 ? '#f59e0b' : '#64748b')}
    ${kpi('SQL Server', d.sqlCount)}
    ${kpi('MySQL', d.mySqlCount)}
    ${kpi('PostgreSQL', d.postgreSqlCount)}
    ${kpi('Cosmos DB', d.cosmosDbCount)}
    ${kpi('Elastic Pools', d.elasticPoolCount)}
  </div>
  <h3>Engine Breakdown</h3>${engineChart}
  ${rows.length > 0 ? `<h3>Database Inventory</h3>${table(['Name', 'Engine', 'Subscription', 'Location', 'Tier', 'SKU', 'Status'], rows)}` : ''}`;
}

function buildKeyVaultHealth(d: KeyVaultHealthDashboard): string {
  const softDeleteEnabled = d.totalVaults - d.softDeleteDisabledCount;
  const purgeEnabled = d.totalVaults - d.purgeProtectionDisabledCount;
  const pie = doughnut(chartId(),
    ['Soft Delete On', 'Soft Delete Off'],
    [softDeleteEnabled, d.softDeleteDisabledCount],
    ['#34d399', '#ef4444']);
  const vaultRows = (d.vaults ?? []).map((v) => [
    esc(v.name), esc(v.subscriptionName), esc(v.location),
    bool(v.softDeleteEnabled), bool(v.purgeProtectionEnabled),
    esc(v.accessModel), esc(v.sku),
  ]);
  return `<div class="kpis">
    ${kpi('Total Vaults', d.totalVaults)}
    ${kpi('Soft Delete Enabled', softDeleteEnabled, softDeleteEnabled < d.totalVaults ? '#f59e0b' : '#34d399')}
    ${kpi('Purge Protected', purgeEnabled, purgeEnabled < d.totalVaults ? '#f59e0b' : '#34d399')}
    ${kpi('RBAC Auth', d.rbacModelCount, '#22d3ee')}
    ${kpi('Access Policy Auth', d.accessPolicyModelCount)}
    ${kpi('Soft Delete Missing', d.softDeleteDisabledCount, d.softDeleteDisabledCount > 0 ? '#ef4444' : '#64748b')}
  </div>
  <h3>Soft Delete Coverage</h3>${pie}
  ${vaultRows.length > 0 ? `<h3>Vault Inventory</h3>${table(['Name', 'Subscription', 'Location', 'Soft Delete', 'Purge Protected', 'Access Model', 'SKU'], vaultRows)}` : ''}`;
}

function buildAksHealth(d: AksContainerHealthDashboard): string {
  const totalNodes = d.clusters.reduce((s, c) => s + c.nodeCount, 0);
  const clusterRows = (d.clusters ?? []).slice(0, 30).map((c) => [
    esc(c.name), esc(c.subscriptionName), esc(c.location),
    esc(c.kubernetesVersion), String(c.nodeCount), esc(c.sku || '—'), esc(c.provisioningState),
  ]);
  const appRows = (d.containerApps ?? []).slice(0, 30).map((a) => [
    esc(a.name), esc(a.subscriptionName), esc(a.location), esc(a.provisioningState),
  ]);
  const regRows = (d.registries ?? []).slice(0, 20).map((r) => [
    esc(r.name), esc(r.subscriptionName), esc(r.location),
    esc(r.sku), bool(!r.adminUserEnabled),
  ]);
  return `<div class="kpis">
    ${kpi('AKS Clusters', d.totalClusters)}
    ${kpi('Running', d.runningClusters, '#34d399')}
    ${kpi('Stopped', d.stoppedClusters, d.stoppedClusters > 0 ? '#f59e0b' : '#64748b')}
    ${kpi('Total Nodes', totalNodes, '#a78bfa')}
    ${kpi('Container Apps', d.totalContainerApps, '#22d3ee')}
    ${kpi('Registries', d.totalRegistries)}
  </div>
  ${clusterRows.length > 0 ? `<h3>AKS Clusters</h3>${table(['Name', 'Subscription', 'Location', 'K8s Version', 'Nodes', 'SKU', 'State'], clusterRows)}` : ''}
  ${appRows.length > 0 ? `<h3>Container Apps</h3>${table(['Name', 'Subscription', 'Location', 'State'], appRows)}` : ''}
  ${regRows.length > 0 ? `<h3>Container Registries</h3>${table(['Name', 'Subscription', 'Location', 'SKU', 'Admin Disabled'], regRows)}` : ''}`;
}

function buildStorageCompliance(d: StorageComplianceDashboard): string {
  const pie = doughnut(chartId(),
    ['Fully Compliant', 'Public Access', 'HTTPS Violation', 'Weak TLS', 'Shared Key'],
    [d.fullyCompliantCount, d.publicAccessCount, d.httpOnlyViolationCount, d.weakTlsCount, d.sharedKeyAllowedCount],
    ['#34d399', '#ef4444', '#f97316', '#f59e0b', '#a78bfa']);
  const acctRows = (d.storageAccounts ?? []).slice(0, 50).map((a) => [
    esc(a.name), esc(a.subscriptionName), esc(a.location),
    bool(!a.publicBlobAccessEnabled), bool(a.httpsOnly), esc(a.minTlsVersion),
  ]);
  return `<div class="kpis">
    ${kpi('Total Accounts', d.totalStorageAccounts)}
    ${kpi('Fully Compliant', d.fullyCompliantCount, '#34d399')}
    ${kpi('Public Access', d.publicAccessCount, d.publicAccessCount > 0 ? '#ef4444' : '#34d399')}
    ${kpi('HTTPS Violations', d.httpOnlyViolationCount, d.httpOnlyViolationCount > 0 ? '#f59e0b' : '#34d399')}
    ${kpi('Weak TLS', d.weakTlsCount, d.weakTlsCount > 0 ? '#f59e0b' : '#34d399')}
    ${kpi('Shared Key Allowed', d.sharedKeyAllowedCount, d.sharedKeyAllowedCount > 0 ? '#f59e0b' : '#34d399')}
  </div>
  <h3>Compliance Breakdown</h3>${pie}
  ${acctRows.length > 0 ? `<h3>Storage Account Inventory</h3>${table(['Name', 'Subscription', 'Location', 'No Public Blob', 'HTTPS Only', 'Min TLS'], acctRows)}` : ''}`;
}

function buildServiceHealth(d: ServiceHealthDashboard): string {
  const rows = (d.events ?? []).slice(0, 30).map((e) => [
    esc(e.title), esc(e.eventType), esc(e.status),
    esc(e.impactedService ?? '—'), esc(e.subscriptionName ?? '—'),
    e.startTime ? new Date(e.startTime).toLocaleString() : '—',
  ]);
  return `<div class="kpis">
    ${kpi('Active Incidents', d.activeIncidents, d.activeIncidents > 0 ? '#ef4444' : '#34d399')}
    ${kpi('Planned Maintenance', d.plannedMaintenance, '#f59e0b')}
    ${kpi('Health Advisories', d.healthAdvisories)}
    ${kpi('Security Advisories', d.securityAdvisories)}
  </div>
  ${rows.length > 0 ? `<h3>Health Events</h3>${table(['Title', 'Type', 'Status', 'Service', 'Subscription', 'Start Time'], rows)}` : '<p class="empty">No active health events.</p>'}`;
}

function buildManagedIdentity(d: ManagedIdentityAuditDashboard): string {
  const totalFedCreds = d.userAssignedIdentities.reduce((s, i) => s + i.federatedCredentialCount, 0);
  const pie = doughnut(chartId(),
    ['User-Assigned', 'System-Assigned'],
    [d.totalUserAssigned, d.totalSystemAssigned],
    ['#22d3ee', '#a78bfa']);
  const idRows = (d.userAssignedIdentities ?? []).slice(0, 50).map((i) => [
    esc(i.name), esc(i.subscriptionName), esc(i.location),
    esc(i.identityType), String(i.federatedCredentialCount),
  ]);
  return `<div class="kpis">
    ${kpi('Total Identities', d.totalUserAssigned + d.totalSystemAssigned)}
    ${kpi('User-Assigned', d.totalUserAssigned, '#22d3ee')}
    ${kpi('System-Assigned', d.totalSystemAssigned, '#a78bfa')}
    ${kpi('Federated Creds', totalFedCreds, totalFedCreds > 0 ? '#f59e0b' : '#64748b')}
  </div>
  <h3>Identity Type Split</h3>${pie}
  ${idRows.length > 0 ? `<h3>User-Assigned Identities</h3>${table(['Name', 'Subscription', 'Location', 'Type', 'Federated Creds'], idRows)}` : ''}`;
}

function buildAdvisorScore(d: AdvisorScoreDashboard): string {
  const cats = d.categoryScores ?? [];
  const catChart = cats.length > 0
    ? barChart(chartId(), cats.map((c) => c.category), cats.map((c) => c.score), '#34d399', 'Score (%)')
    : '';
  const catRows = cats.map((c) => [
    esc(c.category),
    `<span style="color:${scoreColor(c.score)}">${fmt(c.score)}%</span>`,
    String(c.impactedResourceCount),
    `+${fmt(c.potentialScoreIncrease)}%`,
  ]);
  return `<div class="kpis">
    ${kpi('Overall Score', `${fmt(d.overallScore)}%`, scoreColor(d.overallScore))}
    ${kpi('Categories', cats.length)}
    ${cats.map((c) => kpi(c.category, `${fmt(c.score)}%`, scoreColor(c.score))).join('')}
  </div>
  ${catChart ? `<h3>Category Scores</h3>${catChart}` : ''}
  ${catRows.length > 0 ? `<h3>Category Details</h3>${table(['Category', 'Score', 'Impacted Resources', 'Potential Gain'], catRows)}` : ''}`;
}

function buildMessagingHealth(d: MessagingHealthDashboard): string {
  const sbRows = (d.serviceBusNamespaces ?? []).slice(0, 30).map((n) => [
    esc(n.name), esc(n.subscriptionName), esc(n.location), esc(n.sku), esc(n.status),
  ]);
  const ehRows = (d.eventHubNamespaces ?? []).slice(0, 30).map((n) => [
    esc(n.name), esc(n.subscriptionName), esc(n.location), esc(n.sku), String(n.throughputUnits),
  ]);
  const pie = doughnut(chartId(),
    ['Service Bus', 'Event Hub'],
    [d.totalServiceBusNamespaces, d.totalEventHubNamespaces],
    ['#22d3ee', '#a78bfa']);
  return `<div class="kpis">
    ${kpi('Service Bus NS', d.totalServiceBusNamespaces, '#22d3ee')}
    ${kpi('Event Hub NS', d.totalEventHubNamespaces, '#a78bfa')}
    ${kpi('Total Namespaces', d.totalServiceBusNamespaces + d.totalEventHubNamespaces)}
  </div>
  <h3>Namespace Split</h3>${pie}
  ${sbRows.length > 0 ? `<h3>Service Bus Namespaces</h3>${table(['Name', 'Subscription', 'Location', 'SKU', 'Status'], sbRows)}` : ''}
  ${ehRows.length > 0 ? `<h3>Event Hub Namespaces</h3>${table(['Name', 'Subscription', 'Location', 'SKU', 'Throughput Units'], ehRows)}` : ''}`;
}

function buildVmss(d: VmssHealthDashboard): string {
  const rows = (d.scaleSets ?? []).slice(0, 30).map((s) => [
    esc(s.name), esc(s.subscriptionName), esc(s.location),
    esc(s.sku), String(s.capacity), esc(s.provisioningState), esc(s.upgradePolicy),
  ]);
  return `<div class="kpis">
    ${kpi('Scale Sets', d.totalScaleSets)}
    ${kpi('Running', d.runningCount, '#34d399')}
    ${kpi('Failed', d.failedCount, d.failedCount > 0 ? '#ef4444' : '#64748b')}
    ${kpi('Total Instances', d.totalInstances, '#22d3ee')}
  </div>
  ${rows.length > 0 ? `<h3>Scale Set Inventory</h3>${table(['Name', 'Subscription', 'Location', 'SKU', 'Capacity', 'State', 'Upgrade Policy'], rows)}` : ''}`;
}

function buildWastage(d: WastageTrackerDashboard): string {
  const catTotals = (d.wastageItems ?? []).reduce<Record<string, number>>((acc, w) => {
    acc[w.category] = (acc[w.category] ?? 0) + w.estimatedMonthlyWasteEur; return acc;
  }, {});
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const catChart = catEntries.length > 0
    ? barChart(chartId(), catEntries.map(([c]) => c), catEntries.map(([, v]) => v), '#f59e0b', 'Monthly Waste (€)')
    : '';
  const rows = (d.wastageItems ?? []).slice(0, 50).map((w) => [
    esc(w.category), esc(w.resourceName), esc(w.subscriptionName),
    esc(w.reason), `€${fmt(w.estimatedMonthlyWasteEur, 0)}`,
  ]);
  return `<div class="kpis">
    ${kpi('Estimated Waste/mo', `€${fmt(d.totalEstimatedMonthlyWasteEur, 0)}`, '#f59e0b')}
    ${kpi('Wasted Resources', d.totalWastedResources, '#ef4444')}
  </div>
  ${catChart ? `<h3>Waste by Category</h3>${catChart}` : ''}
  ${rows.length > 0 ? `<h3>Wastage Detail</h3>${table(['Category', 'Resource', 'Subscription', 'Reason', 'Monthly Waste'], rows)}` : ''}`;
}

function buildNetworkPerimeter(d: NetworkPerimeterDashboard): string {
  const pie = doughnut(chartId(),
    ['Protected', 'Unprotected IPs'],
    [d.totalPublicIps - d.unprotectedPublicIps, d.unprotectedPublicIps],
    ['#34d399', '#ef4444']);
  const expRows = (d.exposedResources ?? []).slice(0, 50).map((r) => [
    esc(r.resourceName), esc(r.resourceType), esc(r.subscriptionName),
    esc(r.exposureType), riskBadge(r.riskLevel),
  ]);
  return `<div class="kpis">
    ${kpi('Public IPs', d.totalPublicIps)}
    ${kpi('Unprotected IPs', d.unprotectedPublicIps, d.unprotectedPublicIps > 0 ? '#ef4444' : '#34d399')}
    ${kpi('Dangerous NSG Rules', d.dangerousNsgRuleCount, d.dangerousNsgRuleCount > 0 ? '#ef4444' : '#34d399')}
    ${kpi('Exposed Resources', d.exposedResources.length, d.exposedResources.length > 0 ? '#f59e0b' : '#34d399')}
    ${kpi('Open Mgmt Ports', d.openManagementPortResources, d.openManagementPortResources > 0 ? '#ef4444' : '#34d399')}
  </div>
  <h3>Public IP Protection</h3>${pie}
  ${expRows.length > 0 ? `<h3>Exposed Resources</h3>${table(['Resource', 'Type', 'Subscription', 'Exposure Type', 'Risk Level'], expRows)}` : ''}`;
}

function buildTagHygiene(d: TagHygieneDashboard): string {
  const tagged = d.totalResources - d.untaggedResources;
  const pie = doughnut(chartId(),
    ['Tagged', 'Untagged'],
    [tagged, d.untaggedResources],
    ['#34d399', '#ef4444']);
  const typeRows = (d.topUntaggedTypes ?? []).slice(0, 15).map((t) => [
    esc(t.shortType || t.resourceType),
    String(t.untaggedCount),
    String(t.totalCount),
    `${fmt((t.untaggedCount / Math.max(1, t.totalCount)) * 100)}%`,
  ]);
  const subRows = (d.subscriptionBreakdown ?? []).slice(0, 20).map((s) => [
    esc(s.subscriptionName),
    String(s.untaggedCount),
    String(s.totalCount),
    `<span style="color:${s.coveragePercent < 80 ? '#ef4444' : '#34d399'}">${fmt(s.coveragePercent)}%</span>`,
  ]);
  return `<div class="kpis">
    ${kpi('Total Resources', d.totalResources)}
    ${kpi('Coverage', `${fmt(d.coveragePercent)}%`, d.coveragePercent < 80 ? '#f59e0b' : '#34d399')}
    ${kpi('Untagged', d.untaggedResources, d.untaggedResources > 0 ? '#ef4444' : '#64748b')}
    ${kpi('Tagged', tagged, '#34d399')}
  </div>
  <h3>Tagging Coverage</h3>${pie}
  ${typeRows.length > 0 ? `<h3>Top Untagged Resource Types</h3>${table(['Resource Type', 'Untagged', 'Total', 'Untagged %'], typeRows)}` : ''}
  ${subRows.length > 0 ? `<h3>Subscription Coverage</h3>${table(['Subscription', 'Untagged', 'Total', 'Coverage'], subRows)}` : ''}`;
}

function buildOrphaned(d: OrphanedResourcesDashboard): string {
  const pie = doughnut(chartId(),
    ['Disks', 'NICs', 'Public IPs', 'Snapshots', 'Other'],
    [
      d.orphanedDisks, d.orphanedNics, d.orphanedPublicIps, d.orphanedSnapshots,
      Math.max(0, d.totalOrphanedResources - d.orphanedDisks - d.orphanedNics - d.orphanedPublicIps - d.orphanedSnapshots),
    ],
    ['#ef4444', '#f97316', '#f59e0b', '#a78bfa', '#64748b']);
  const resRows = (d.resources ?? []).slice(0, 50).map((r) => [
    esc(r.name), esc(r.resourceType), esc(r.category),
    esc(r.subscriptionName), `€${fmt(r.estimatedMonthlyWasteEur, 0)}`,
  ]);
  return `<div class="kpis">
    ${kpi('Total Orphaned', d.totalOrphanedResources, '#ef4444')}
    ${kpi('Orphaned Disks', d.orphanedDisks, '#f97316')}
    ${kpi('Orphaned NICs', d.orphanedNics, '#f59e0b')}
    ${kpi('Public IPs', d.orphanedPublicIps, '#a78bfa')}
    ${kpi('Snapshots', d.orphanedSnapshots)}
    ${kpi('Est. Monthly Waste', `€${fmt(d.estimatedMonthlyWasteEur, 0)}`, '#f59e0b')}
  </div>
  <h3>Breakdown by Type</h3>${pie}
  ${resRows.length > 0 ? `<h3>Orphaned Resources</h3>${table(['Name', 'Type', 'Category', 'Subscription', 'Monthly Waste'], resRows)}` : ''}`;
}

function buildTopCostly(d: TopCostlyResourcesDashboard): string {
  const rows = (d.resources ?? []).slice(0, 20).map((r) => [
    esc(r.resourceName), esc(r.resourceType), esc(r.subscriptionName),
    `€${fmt(r.monthlyCostEur, 0)}`,
  ]);
  const pie = (d.resources ?? []).length > 0
    ? doughnut(chartId(),
        (d.resources ?? []).slice(0, 8).map((r) => r.resourceName.slice(0, 20)),
        (d.resources ?? []).slice(0, 8).map((r) => r.monthlyCostEur),
        ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#ef4444', '#f97316', '#6366f1', '#14b8a6'])
    : '';
  return `<div class="kpis">
    ${kpi('Total Cost (Month)', `€${fmt(d.totalCostEur, 0)}`, '#f59e0b')}
    ${kpi('Resources Tracked', (d.resources ?? []).length)}
  </div>
  ${pie ? `<h3>Top Resources by Spend</h3>${pie}` : ''}
  ${rows.length > 0 ? `<h3>Top Costly Resources</h3>${table(['Resource', 'Type', 'Subscription', 'Current Month'], rows)}` : ''}`;
}

function buildAzureChanges(d: ChangesDashboard): string {
  const pie = doughnut(chartId(),
    ['Create', 'Update', 'Delete'],
    [d.createCount, d.updateCount, d.deleteCount],
    ['#34d399', '#22d3ee', '#ef4444']);
  const rows = (d.changes ?? []).slice(0, 50).map((c) => [
    esc(c.changeType), esc(c.resourceName), esc(c.resourceType),
    esc(c.resourceGroup), esc(c.changedBy),
    new Date(c.timestamp).toLocaleString(),
  ]);
  return `<div class="kpis">
    ${kpi('Total Changes', d.totalCount)}
    ${kpi('Creates', d.createCount, '#34d399')}
    ${kpi('Updates', d.updateCount, '#22d3ee')}
    ${kpi('Deletes', d.deleteCount, d.deleteCount > 0 ? '#ef4444' : '#64748b')}
  </div>
  <h3>Change Type Breakdown</h3>${pie}
  ${rows.length > 0 ? `<h3>Recent Changes</h3>${table(['Type', 'Resource', 'Resource Type', 'Resource Group', 'Changed By', 'Time'], rows)}` : '<p class="empty">No changes found in this time range.</p>'}`;
}

function buildSpendAnomaly(d: CostAnomalyForecastDashboard): string {
  const bf = d.budgetForecast;
  const anomalyRows = (d.anomalies ?? []).slice(0, 20).map((a) => [
    new Date(a.timestamp).toLocaleDateString(),
    `€${fmt(a.actualCost, 0)}`, `€${fmt(a.baselineCost, 0)}`,
    `${fmt(a.deviationPercent)}%`, esc(a.severity), esc(a.insight),
  ]);
  return `<div class="kpis">
    ${bf ? kpi('Daily Burn Rate', `€${fmt(bf.dailyBurnRate, 0)}`, '#f59e0b') : ''}
    ${bf ? kpi('Projected Month End', `€${fmt(bf.projectedMonthEndCost, 0)}`, '#f97316') : ''}
    ${bf ? kpi('Budget Limit', `€${fmt(bf.budgetLimit, 0)}`) : ''}
    ${bf ? kpi('Budget Used', `${fmt(bf.budgetUtilizationPercent)}%`, bf.budgetUtilizationPercent > 90 ? '#ef4444' : bf.budgetUtilizationPercent > 70 ? '#f59e0b' : '#34d399') : ''}
    ${bf ? kpi('Days to Exhaustion', bf.daysToBudgetExhaustion > 0 ? bf.daysToBudgetExhaustion : '∞', bf.daysToBudgetExhaustion > 0 && bf.daysToBudgetExhaustion < 7 ? '#ef4444' : '#34d399') : ''}
    ${kpi('Anomalies Detected', (d.anomalies ?? []).length, (d.anomalies ?? []).length > 0 ? '#f59e0b' : '#34d399')}
  </div>
  ${anomalyRows.length > 0 ? `<h3>Cost Anomalies</h3>${table(['Date', 'Actual Cost', 'Baseline', 'Deviation', 'Severity', 'Insight'], anomalyRows)}` : '<p class="empty">No anomalies detected.</p>'}`;
}

function buildCapacityPlanning(d: CapacityPlanningDashboard): string {
  const runway = (d.runwayForecast ?? []).slice(0, 20);
  const critical = runway.filter((r) => r.urgencyLevel === 'Critical').length;
  const runwayRows = runway.map((r) => [
    esc(r.resourceName), esc(r.resourceType), esc(r.metric),
    `${fmt(r.currentUsagePercent)}%`,
    r.daysUntilExhaustion <= 0 ? '<span class="badge badge-ok">Healthy</span>' : r.daysUntilExhaustion < 30 ? `<span class="badge badge-crit">${r.daysUntilExhaustion}d</span>` : `<span class="badge badge-med">${r.daysUntilExhaustion}d</span>`,
    esc(r.urgencyLevel),
  ]);
  const resourceRows = (d.resources ?? []).slice(0, 20).map((r) => [
    esc(r.resourceName), esc(r.subscription),
    `${fmt(r.cpuCurrent)}%`, `${fmt(r.memoryCurrent)}%`, `${fmt(r.diskCurrent)}%`,
    r.estimatedHeadroomDays > 0 ? `${r.estimatedHeadroomDays}d` : '—', esc(r.status),
  ]);
  return `<div class="kpis">
    ${kpi('Resources Assessed', (d.resources ?? []).length)}
    ${kpi('Critical Runway', critical, critical > 0 ? '#ef4444' : '#34d399')}
    ${kpi('Runway Items', runway.length)}
  </div>
  ${runwayRows.length > 0 ? `<h3>Capacity Runway Forecast</h3>${table(['Resource', 'Type', 'Metric', 'Current Usage', 'Days Left', 'Urgency'], runwayRows)}` : ''}
  ${resourceRows.length > 0 ? `<h3>Resource Capacity Detail</h3>${table(['Resource', 'Subscription', 'CPU', 'Memory', 'Disk', 'Headroom', 'Status'], resourceRows)}` : ''}`;
}

function buildDrRecoverability(d: DrDashboard): string {
  const pie = doughnut(chartId(),
    ['Meeting RPO', 'Failing RPO'],
    [d.workloadsMeetingRpo, d.totalWorkloadsAssessed - d.workloadsMeetingRpo],
    ['#34d399', '#ef4444']);
  const failingRows = (d.topFailingWorkloads ?? []).slice(0, 20).map((w) => [
    esc(w.workloadName), esc(w.subscriptionName), esc(w.criticality),
    esc(w.complianceStatus), esc(w.gapSummary),
  ]);
  return `<div class="kpis">
    ${kpi('DR Readiness Score', `${fmt(d.drReadinessScore)}%`, scoreColor(d.drReadinessScore))}
    ${kpi('RPO Compliance', `${fmt(d.rpoCompliancePercent)}%`, scoreColor(d.rpoCompliancePercent))}
    ${kpi('RTO Compliance', `${fmt(d.rtoCompliancePercent)}%`, scoreColor(d.rtoCompliancePercent))}
    ${kpi('Protected Workloads', d.totalProtectedWorkloads, '#34d399')}
    ${kpi('Unprotected', d.totalUnprotectedWorkloads, d.totalUnprotectedWorkloads > 0 ? '#ef4444' : '#64748b')}
  </div>
  <h3>RPO Compliance</h3>${pie}
  ${failingRows.length > 0 ? `<h3>Top Failing Workloads</h3>${table(['Workload', 'Subscription', 'Criticality', 'Status', 'Gap'], failingRows)}` : ''}`;
}

function buildRiSavings(d: RiSavingsDashboard): string {
  const rows = (d.recommendations ?? []).slice(0, 30).map((r) => [
    esc(r.resourceType), esc(r.recommendationType), esc(r.term), esc(r.scope),
    `€${fmt(r.estimatedMonthlySavingsEur, 0)}/mo`, `€${fmt(r.estimatedAnnualSavingsEur, 0)}/yr`, esc(r.impact),
  ]);
  return `<div class="kpis">
    ${kpi('Annual Savings Opportunity', `€${fmt(d.totalEstimatedAnnualSavingsEur, 0)}`, '#34d399')}
    ${kpi('Monthly Savings', `€${fmt(d.totalEstimatedMonthlySavingsEur, 0)}`, '#22d3ee')}
    ${kpi('Recommendations', d.recommendationCount, '#f59e0b')}
  </div>
  ${rows.length > 0 ? `<h3>Savings Recommendations</h3>${table(['Resource Type', 'Type', 'Term', 'Scope', 'Monthly Saving', 'Annual Saving', 'Impact'], rows)}` : '<p class="empty">No savings recommendations found.</p>'}`;
}

function buildIamReview(d: IamReviewDashboard): string {
  const pie = doughnut(chartId(),
    ['Users', 'Service Principals', 'Owners'],
    [d.userAssignments, d.servicePrincipalAssignments, d.ownerAssignments],
    ['#22d3ee', '#a78bfa', '#ef4444']);
  const riskRows = (d.risks ?? []).map((r) => [
    esc(r.title), riskBadge(r.riskLevel), String(r.count), esc(r.recommendation),
  ]);
  const subRows = (d.subscriptionBreakdown ?? []).slice(0, 20).map((s) => [
    esc(s.subscriptionName), String(s.totalAssignments), String(s.ownerAssignments),
    `<span style="color:${s.ownerAssignments > 5 ? '#ef4444' : '#34d399'}">${fmt((s.ownerAssignments / Math.max(1, s.totalAssignments)) * 100)}%</span>`,
  ]);
  return `<div class="kpis">
    ${kpi('Total Assignments', d.totalRoleAssignments)}
    ${kpi('Owner Assignments', d.ownerAssignments, d.ownerAssignments > 10 ? '#ef4444' : '#34d399')}
    ${kpi('Service Principals', d.servicePrincipalAssignments, '#a78bfa')}
    ${kpi('User Assignments', d.userAssignments, '#22d3ee')}
    ${kpi('Custom Roles', d.customRoleCount, '#f59e0b')}
  </div>
  <h3>Assignment Split</h3>${pie}
  ${riskRows.length > 0 ? `<h3>IAM Risks</h3>${table(['Risk', 'Level', 'Count', 'Recommendation'], riskRows)}` : ''}
  ${subRows.length > 0 ? `<h3>Per-Subscription Breakdown</h3>${table(['Subscription', 'Total Assignments', 'Owner Count', 'Owner %'], subRows)}` : ''}`;
}

function buildNonProdUptime(d: NonProdUptimeDashboard): string {
  const rows = (d.runningVms ?? []).slice(0, 40).map((v) => [
    esc(v.resourceName), esc(v.subscriptionName), esc(v.environment),
    esc(v.vmSize), `€${fmt(v.estimatedMonthlyCostEur, 0)}`,
  ]);
  return `<div class="kpis">
    ${kpi('Non-Prod VMs', d.nonProdVmCount)}
    ${kpi('Currently Running', d.runningNonProdVmCount, d.runningNonProdVmCount > 0 ? '#f59e0b' : '#34d399')}
    ${kpi('Monthly Leakage', `€${fmt(d.estimatedMonthlyLeakageEur, 0)}`, '#ef4444')}
  </div>
  ${rows.length > 0 ? `<h3>Running Non-Production VMs</h3>${table(['Name', 'Subscription', 'Environment', 'VM Size', 'Est. Monthly Cost'], rows)}` : '<p class="empty">No running non-production VMs found.</p>'}`;
}

function buildAppFunctionsHealth(d: AppFunctionsHealthDashboard): string {
  const pie = doughnut(chartId(),
    ['Web Apps', 'Function Apps', 'Logic Apps'],
    [d.webAppCount, d.functionAppCount, d.logicAppCount],
    ['#22d3ee', '#a78bfa', '#f59e0b']);
  const rows = (d.apps ?? []).slice(0, 50).map((a) => [
    esc(a.name), esc(a.kind), esc(a.subscriptionName), esc(a.location),
    esc(a.sku || '—'), esc(a.state),
  ]);
  return `<div class="kpis">
    ${kpi('Total Apps', d.totalApps)}
    ${kpi('Running', d.runningApps, '#34d399')}
    ${kpi('Stopped', d.stoppedApps, d.stoppedApps > 0 ? '#f59e0b' : '#64748b')}
    ${kpi('Function Apps', d.functionAppCount, '#a78bfa')}
    ${kpi('Web Apps', d.webAppCount, '#22d3ee')}
    ${kpi('Logic Apps', d.logicAppCount, '#f59e0b')}
  </div>
  <h3>App Type Split</h3>${pie}
  ${rows.length > 0 ? `<h3>App Inventory</h3>${table(['Name', 'Kind', 'Subscription', 'Location', 'SKU', 'State'], rows)}` : ''}`;
}

function buildPolicyRadar(d: AzPolicyLensDashboard): string {
  const assignRows = (d.topNonCompliantAssignments ?? []).slice(0, 20).map((a) => [
    esc(a.displayName), esc(a.subscriptionName), esc(a.effect),
    String(a.nonCompliantResources), String(a.subscriptionsImpacted),
  ]);
  const subRows = (d.subscriptionCompliance ?? []).slice(0, 20).map((s) => [
    esc(s.subscriptionName),
    `<span style="color:${s.compliancePercent < 80 ? '#ef4444' : '#34d399'}">${fmt(s.compliancePercent)}%</span>`,
    String(s.nonCompliantResources), String(s.compliantResources),
  ]);
  const pie = d.effectBreakdown && d.effectBreakdown.length > 0
    ? doughnut(chartId(),
        d.effectBreakdown.map((e) => e.effect),
        d.effectBreakdown.map((e) => e.count),
        ['#22d3ee', '#a78bfa', '#f59e0b', '#34d399', '#ef4444'])
    : '';
  return `<div class="kpis">
    ${kpi('Overall Compliance', `${fmt(d.overallCompliancePercent)}%`, scoreColor(d.overallCompliancePercent))}
    ${kpi('Total Assignments', d.totalAssignments)}
    ${kpi('Non-Compliant Resources', d.totalNonCompliantResources, d.totalNonCompliantResources > 0 ? '#ef4444' : '#34d399')}
    ${kpi('Compliant Resources', d.totalCompliantResources, '#34d399')}
    ${kpi('Custom Definitions', d.customDefinitions)}
    ${kpi('Exemptions', d.totalExemptions)}
  </div>
  ${pie ? `<h3>Policy Effect Breakdown</h3>${pie}` : ''}
  ${assignRows.length > 0 ? `<h3>Top Non-Compliant Assignments</h3>${table(['Policy', 'Subscription', 'Effect', 'Non-Compliant Resources', 'Subscriptions Impacted'], assignRows)}` : ''}
  ${subRows.length > 0 ? `<h3>Subscription Compliance</h3>${table(['Subscription', 'Compliance %', 'Non-Compliant', 'Compliant'], subRows)}` : ''}`;
}

function buildSupportTickets(d: SupportTicketDashboard): string {
  const pie = doughnut(chartId(),
    ['Critical', 'High', 'Moderate', 'Minimal'],
    [d.criticalCount, d.highCount, d.moderatCount, d.minimalCount],
    ['#ef4444', '#f97316', '#f59e0b', '#64748b']);
  const rows = (d.tickets ?? []).slice(0, 30).map((t) => [
    esc(t.severity), esc(t.title), esc(t.status),
    esc(t.serviceName), esc(t.subscriptionName),
    new Date(t.createdDate).toLocaleDateString(), `${t.ageDays}d`,
  ]);
  return `<div class="kpis">
    ${kpi('Open Tickets', d.totalOpenTickets, d.totalOpenTickets > 0 ? '#f59e0b' : '#34d399')}
    ${kpi('Critical', d.criticalCount, d.criticalCount > 0 ? '#ef4444' : '#64748b')}
    ${kpi('High', d.highCount, d.highCount > 0 ? '#f97316' : '#64748b')}
    ${kpi('Moderate', d.moderatCount, '#f59e0b')}
    ${kpi('Minimal', d.minimalCount)}
  </div>
  <h3>Severity Split</h3>${pie}
  ${rows.length > 0 ? `<h3>Open Tickets</h3>${table(['Severity', 'Title', 'Status', 'Service', 'Subscription', 'Opened', 'Age'], rows)}` : '<p class="empty">No open support tickets.</p>'}`;
}

function buildNetworkTopology(d: NetworkTopologyDashboard): string {
  const vnetRows = (d.vnets ?? []).slice(0, 30).map((v) => [
    esc(v.name), esc(v.subscriptionName), esc(v.location),
    esc((v.addressPrefixes ?? []).join(', ') || '—'),
    String((v.subnets ?? []).length),
  ]);
  return `<div class="kpis">
    ${kpi('VNets', d.vnetCount, '#22d3ee')}
    ${kpi('Peerings', d.peeringCount, '#a78bfa')}
    ${kpi('VPN Gateways', d.vpnGatewayCount, '#f59e0b')}
    ${kpi('Connections', d.connectionCount)}
    ${kpi('Local Gateways', d.localGatewayCount)}
  </div>
  ${vnetRows.length > 0 ? `<h3>VNet Inventory</h3>${table(['Name', 'Subscription', 'Location', 'Address Prefixes', 'Subnets'], vnetRows)}` : ''}`;
}

// ─── section router ───────────────────────────────────────────────────────────

const SECTION_META: Record<string, { id: string; label: string; icon: string }> = {
  executive:              { id: 'executive',              label: 'Health Overview',         icon: '🏥' },
  alerts:                 { id: 'alerts',                 label: 'Monitor Alerts',           icon: '🔔' },
  expressroute:           { id: 'expressroute',           label: 'Express Route',            icon: '🔌' },
  vwan:                   { id: 'vwan',                   label: 'Virtual WAN',              icon: '🌐' },
  'backup-health':        { id: 'backup-health',          label: 'Backup Health',            icon: '💾' },
  'database-health':      { id: 'database-health',        label: 'Database Health',          icon: '🗄️' },
  'key-vault-health':     { id: 'key-vault-health',       label: 'Key Vault Health',         icon: '🔑' },
  'aks-container-health': { id: 'aks-container-health',   label: 'AKS & Containers',         icon: '⎈' },
  'storage-compliance':   { id: 'storage-compliance',     label: 'Storage Compliance',       icon: '📦' },
  'service-health':       { id: 'service-health',         label: 'Service Health',           icon: '❤️' },
  'managed-identity-audit': { id: 'managed-identity-audit', label: 'Managed Identities',    icon: '🪪' },
  'advisor-score':        { id: 'advisor-score',          label: 'Advisor Score',            icon: '💡' },
  'messaging-health':     { id: 'messaging-health',       label: 'Messaging Health',         icon: '📨' },
  'vmss-health':          { id: 'vmss-health',            label: 'VMSS Health',              icon: '⚖️' },
  'wastage-tracker':      { id: 'wastage-tracker',        label: 'Wastage Tracker',          icon: '♻️' },
  'network-perimeter':    { id: 'network-perimeter',      label: 'Network Perimeter',        icon: '🛡️' },
  'tag-hygiene-compliance': { id: 'tag-hygiene-compliance', label: 'Tag Hygiene',           icon: '🏷️' },
  'orphaned-resources':   { id: 'orphaned-resources',     label: 'Orphaned Resources',       icon: '👻' },
  'top-costly-resources': { id: 'top-costly-resources',   label: 'Top Costly Resources',     icon: '💰' },
  'azure-changes':        { id: 'azure-changes',           label: 'Azure Change Activity',    icon: '📋' },
  'spend-anomaly':        { id: 'spend-anomaly',           label: 'Spend Anomaly & Forecast', icon: '📈' },
  'capacity-planning':    { id: 'capacity-planning',       label: 'Capacity Planning',        icon: '📊' },
  'dr-recoverability':    { id: 'dr-recoverability',       label: 'DR Recoverability',        icon: '🔄' },
  'ri-savings':           { id: 'ri-savings',              label: 'RI & Savings',             icon: '💵' },
  'iam-review':           { id: 'iam-review',              label: 'IAM Review',               icon: '🔐' },
  'nonprod-uptime-leakage': { id: 'nonprod-uptime-leakage', label: 'Non-Prod Uptime Leakage', icon: '⏱️' },
  'app-functions-health': { id: 'app-functions-health',    label: 'Apps & Functions Health',  icon: '⚡' },
  'policy-radar':         { id: 'policy-radar',            label: 'Azure Policy Radar',       icon: '📜' },
  'support-tickets':      { id: 'support-tickets',         label: 'Support Tickets',          icon: '🎫' },
  'network-topology':     { id: 'network-topology',        label: 'Network Topology',         icon: '🗺️' },
  'app-gateway':          { id: 'app-gateway',             label: 'Application Gateway',      icon: '🔀' },
  'vpn-gateway':          { id: 'vpn-gateway',             label: 'VPN Gateway',              icon: '🔒' },
};

const CORE_KEYS = new Set(['security', 'performance', 'cost', 'governance', 'reliability', 'dailyCostAnalysis']);

function buildSection(key: string, d: ReportData): RenderedSection | null {
  const meta = (k: string) => SECTION_META[k] ?? { id: k, label: k, icon: '📊' };

  switch (key) {
    case 'azureHealth':
    case 'security':
    case 'performance':
    case 'cost':
    case 'governance':
    case 'reliability':
    case 'dailyCostAnalysis': {
      if (!d.executive) return null;
      const m = meta('executive');
      return { id: m.id, label: m.label, html: section(m.id, 'Azure Overall Health', m.icon, buildExecutive(d.executive, d.security)) };
    }
    case 'alerts':
      if (!d.alerts) return null;
      return { ...meta('alerts'), html: section('alerts', 'Azure Monitor Alerts', '🔔', buildAlerts(d.alerts)) };
    case 'expressroute':
      if (!d.expressroute) return null;
      return { ...meta('expressroute'), html: section('expressroute', 'Express Route', '🔌', buildExpressRoute(d.expressroute)) };
    case 'vwan':
      if (!d.vwan) return null;
      return { ...meta('vwan'), html: section('vwan', 'Virtual WAN', '🌐', buildVwan(d.vwan)) };
    case 'backup-health':
      if (!d.backupHealth) return null;
      return { ...meta('backup-health'), html: section('backup-health', 'Backup Health', '💾', buildBackupHealth(d.backupHealth)) };
    case 'database-health':
      if (!d.databaseHealth) return null;
      return { ...meta('database-health'), html: section('database-health', 'Database Health', '🗄️', buildDatabaseHealth(d.databaseHealth)) };
    case 'key-vault-health':
      if (!d.keyVaultHealth) return null;
      return { ...meta('key-vault-health'), html: section('key-vault-health', 'Key Vault Health', '🔑', buildKeyVaultHealth(d.keyVaultHealth)) };
    case 'aks-container-health':
      if (!d.aksContainerHealth) return null;
      return { ...meta('aks-container-health'), html: section('aks-container-health', 'AKS & Container Health', '⎈', buildAksHealth(d.aksContainerHealth)) };
    case 'storage-compliance':
      if (!d.storageCompliance) return null;
      return { ...meta('storage-compliance'), html: section('storage-compliance', 'Storage Compliance', '📦', buildStorageCompliance(d.storageCompliance)) };
    case 'service-health':
      if (!d.serviceHealth) return null;
      return { ...meta('service-health'), html: section('service-health', 'Azure Service Health', '❤️', buildServiceHealth(d.serviceHealth)) };
    case 'managed-identity-audit':
      if (!d.managedIdentityAudit) return null;
      return { ...meta('managed-identity-audit'), html: section('managed-identity-audit', 'Managed Identity Audit', '🪪', buildManagedIdentity(d.managedIdentityAudit)) };
    case 'advisor-score':
      if (!d.advisorScore) return null;
      return { ...meta('advisor-score'), html: section('advisor-score', 'Advisor Score', '💡', buildAdvisorScore(d.advisorScore)) };
    case 'messaging-health':
      if (!d.messagingHealth) return null;
      return { ...meta('messaging-health'), html: section('messaging-health', 'Messaging Health', '📨', buildMessagingHealth(d.messagingHealth)) };
    case 'vmss-health':
      if (!d.vmssHealth) return null;
      return { ...meta('vmss-health'), html: section('vmss-health', 'VMSS Health', '⚖️', buildVmss(d.vmssHealth)) };
    case 'wastage-tracker':
      if (!d.wastageTracker) return null;
      return { ...meta('wastage-tracker'), html: section('wastage-tracker', 'Wastage Tracker', '♻️', buildWastage(d.wastageTracker)) };
    case 'network-perimeter':
      if (!d.networkPerimeter) return null;
      return { ...meta('network-perimeter'), html: section('network-perimeter', 'Network Perimeter', '🛡️', buildNetworkPerimeter(d.networkPerimeter)) };
    case 'tag-hygiene-compliance':
      if (!d.tagHygiene) return null;
      return { ...meta('tag-hygiene-compliance'), html: section('tag-hygiene-compliance', 'Tag Hygiene', '🏷️', buildTagHygiene(d.tagHygiene)) };
    case 'orphaned-resources':
      if (!d.orphanedResources) return null;
      return { ...meta('orphaned-resources'), html: section('orphaned-resources', 'Orphaned Resources', '👻', buildOrphaned(d.orphanedResources)) };
    case 'top-costly-resources':
      if (!d.topCostlyResources) return null;
      return { ...meta('top-costly-resources'), html: section('top-costly-resources', 'Top Costly Resources', '💰', buildTopCostly(d.topCostlyResources)) };
    case 'azure-changes':
      if (!d.azureChanges) return null;
      return { ...meta('azure-changes'), html: section('azure-changes', 'Azure Change Activity', '📋', buildAzureChanges(d.azureChanges)) };
    case 'spend-anomaly':
      if (!d.spendAnomaly) return null;
      return { ...meta('spend-anomaly'), html: section('spend-anomaly', 'Spend Anomaly & Forecast', '📈', buildSpendAnomaly(d.spendAnomaly)) };
    case 'capacity-planning':
      if (!d.capacityPlanning) return null;
      return { ...meta('capacity-planning'), html: section('capacity-planning', 'Capacity Planning', '📊', buildCapacityPlanning(d.capacityPlanning)) };
    case 'dr-recoverability':
      if (!d.drRecoverability) return null;
      return { ...meta('dr-recoverability'), html: section('dr-recoverability', 'DR Recoverability', '🔄', buildDrRecoverability(d.drRecoverability)) };
    case 'ri-savings':
      if (!d.riSavings) return null;
      return { ...meta('ri-savings'), html: section('ri-savings', 'RI & Savings', '💵', buildRiSavings(d.riSavings)) };
    case 'iam-review':
      if (!d.iamReview) return null;
      return { ...meta('iam-review'), html: section('iam-review', 'IAM Review', '🔐', buildIamReview(d.iamReview)) };
    case 'nonprod-uptime-leakage':
      if (!d.nonProdUptime) return null;
      return { ...meta('nonprod-uptime-leakage'), html: section('nonprod-uptime-leakage', 'Non-Prod Uptime Leakage', '⏱️', buildNonProdUptime(d.nonProdUptime)) };
    case 'app-functions-health':
      if (!d.appFunctionsHealth) return null;
      return { ...meta('app-functions-health'), html: section('app-functions-health', 'Apps & Functions Health', '⚡', buildAppFunctionsHealth(d.appFunctionsHealth)) };
    case 'policy-radar':
      if (!d.policyRadar) return null;
      return { ...meta('policy-radar'), html: section('policy-radar', 'Azure Policy Radar', '📜', buildPolicyRadar(d.policyRadar)) };
    case 'support-tickets':
      if (!d.supportTickets) return null;
      return { ...meta('support-tickets'), html: section('support-tickets', 'Support Ticket Tracker', '🎫', buildSupportTickets(d.supportTickets)) };
    case 'network-topology':
      if (!d.networkTopology) return null;
      return { ...meta('network-topology'), html: section('network-topology', 'Network Topology', '🗺️', buildNetworkTopology(d.networkTopology)) };
    case 'azure-firewall': {
      if (!d['azure-firewall']) return null;
      const fw = d['azure-firewall'];
      const fwRows = fw.firewalls.map((f) => [esc(f.name), esc(f.subscriptionName), esc(f.location), esc(f.skuTier), esc(f.provisioningState), f.policyName ?? '—']);
      const fwHtml = `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    ${kpi('Firewalls', fw.totalFirewalls)}${kpi('Healthy', fw.healthyCount)}${kpi('Blocked 24h', fw.totalBlockedLast24h)}${kpi('Threat Hits', fw.threatIntelHits)}
  </div>
  ${fwRows.length > 0 ? table(['Name', 'Subscription', 'Location', 'SKU', 'State', 'Policies'], fwRows) : '<p>No Azure Firewalls found.</p>'}`;
      return { ...meta('azure-firewall'), html: section('azure-firewall', 'Azure Firewall', '🔥', fwHtml) };
    }
    case 'app-gateway': {
      if (!d['app-gateway']) return null;
      const ag = d['app-gateway'];
      const agRows = ag.gateways.map((g) => [esc(g.name), esc(g.subscriptionName), esc(g.location), esc(g.skuTier), g.wafEnabled ? (g.wafMode === 'Prevention' ? 'Prevention' : 'Detection') : 'Disabled', esc(g.provisioningState)]);
      const agHtml = `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    ${kpi('Gateways', ag.totalGateways)}${kpi('WAF Enabled', ag.wafEnabledCount)}${kpi('Requests 24h', ag.totalRequests24h)}${kpi('Blocked 24h', ag.totalBlocked24h)}
  </div>
  ${agRows.length > 0 ? table(['Name', 'Subscription', 'Location', 'SKU', 'WAF', 'State'], agRows) : '<p>No Application Gateways found.</p>'}`;
      return { ...meta('app-gateway'), html: section('app-gateway', 'Application Gateway', '🔀', agHtml) };
    }
    case 'vpn-gateway': {
      if (!d['vpn-gateway']) return null;
      const vpn = d['vpn-gateway'];
      const vpnRows = vpn.gateways.map((g) => [esc(g.name), esc(g.subscriptionName), esc(g.location), esc(g.skuName), esc(g.generation), g.bgpEnabled ? 'Yes' : 'No', g.activeActiveEnabled ? 'Yes' : 'No', esc(g.provisioningState)]);
      const vpnHtml = `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    ${kpi('Gateways', vpn.totalGateways)}${kpi('Connections', vpn.totalConnections)}${kpi('Connected', vpn.connectedTunnels)}${kpi('Degraded', vpn.degradedCount)}
  </div>
  ${vpnRows.length > 0 ? table(['Name', 'Subscription', 'Location', 'SKU', 'Gen', 'BGP', 'Active-Active', 'State'], vpnRows) : '<p>No VPN Gateways found.</p>'}`;
      return { ...meta('vpn-gateway'), html: section('vpn-gateway', 'VPN Gateway', '🔒', vpnHtml) };
    }
    case 'insight-feed':
    case 'security-blast-radius':
      return null;
    default:
      return null;
  }
}

// ─── inline SVG icon ─────────────────────────────────────────────────────────

const NIGHTWATCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="40" height="40">
  <defs>
    <radialGradient id="rbg" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0a0f1e"/></radialGradient>
    <radialGradient id="reL" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#67e8f9"/><stop offset="55%" stop-color="#06b6d4" stop-opacity="0.9"/><stop offset="100%" stop-color="#0891b2" stop-opacity="0.4"/></radialGradient>
    <radialGradient id="reR" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#67e8f9"/><stop offset="55%" stop-color="#06b6d4" stop-opacity="0.9"/><stop offset="100%" stop-color="#0891b2" stop-opacity="0.4"/></radialGradient>
    <radialGradient id="rpu" cx="35%" cy="35%" r="60%"><stop offset="0%" stop-color="#1e3a5f"/><stop offset="100%" stop-color="#040d1a"/></radialGradient>
    <linearGradient id="rbod" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <filter id="feg"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="frg"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="rcc"><circle cx="32" cy="32" r="30"/></clipPath>
  </defs>
  <circle cx="32" cy="32" r="31" fill="none" stroke="#06b6d4" stroke-width="0.5" stroke-opacity="0.5" filter="url(#frg)"/>
  <circle cx="32" cy="32" r="30" fill="url(#rbg)"/>
  <g clip-path="url(#rcc)" opacity="0.4"><circle cx="12" cy="14" r="0.7" fill="#94a3b8"/><circle cx="52" cy="10" r="0.5" fill="#94a3b8"/><circle cx="8" cy="44" r="0.6" fill="#94a3b8"/><circle cx="56" cy="48" r="0.5" fill="#94a3b8"/></g>
  <g clip-path="url(#rcc)"><circle cx="50" cy="11" r="5.5" fill="#1e3a5f" opacity="0.9"/><circle cx="52" cy="10" r="4.2" fill="#0a0f1e"/></g>
  <ellipse cx="32" cy="44" rx="14" ry="13" fill="url(#rbod)" clip-path="url(#rcc)"/>
  <path d="M18 46 Q10 38 14 52 Q18 58 22 54 Z" fill="#1e293b" opacity="0.85" clip-path="url(#rcc)"/>
  <path d="M46 46 Q54 38 50 52 Q46 58 42 54 Z" fill="#1e293b" opacity="0.85" clip-path="url(#rcc)"/>
  <path d="M24 24 L21 16 L26 22 Z" fill="#334155"/>
  <path d="M40 24 L43 16 L38 22 Z" fill="#334155"/>
  <circle cx="32" cy="30" r="14" fill="#2d3f55"/>
  <ellipse cx="32" cy="31" rx="11" ry="10" fill="#3b5068" opacity="0.6"/>
  <circle cx="25.5" cy="30" r="7" fill="#0f1e35"/>
  <circle cx="38.5" cy="30" r="7" fill="#0f1e35"/>
  <circle cx="25.5" cy="30" r="5.8" fill="url(#reL)" filter="url(#feg)"/>
  <circle cx="38.5" cy="30" r="5.8" fill="url(#reR)" filter="url(#feg)"/>
  <circle cx="25.5" cy="30" r="3.2" fill="url(#rpu)"/>
  <circle cx="38.5" cy="30" r="3.2" fill="url(#rpu)"/>
  <circle cx="24" cy="28.5" r="1" fill="#e0f7ff" opacity="0.9"/>
  <circle cx="37" cy="28.5" r="1" fill="#e0f7ff" opacity="0.9"/>
  <path d="M30.5 33.5 L32 37 L33.5 33.5 Z" fill="#f59e0b" opacity="0.9"/>
  <circle cx="32" cy="32" r="30" fill="none" stroke="#0e7490" stroke-width="1" opacity="0.6"/>
</svg>`;

// ─── main export ──────────────────────────────────────────────────────────────

export function generateHtmlReport(data: ReportData): string {
  chartIdx = 0;

  // deduplicate keys — azureHealth/security/etc. all collapse to one section
  const seen = new Set<string>();
  const effectiveKeys = data.activeWidgetKeys.filter((k) => {
    const normalized = CORE_KEYS.has(k) ? 'azureHealth' : k;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // build sections, keep only those that produced content
  const rendered = effectiveKeys.map((k) => buildSection(k, data)).filter((s): s is RenderedSection => s !== null);

  const sectionsHtml = rendered.map((s) => s.html).join('\n');

  const sidebarLinks = rendered.map((s) =>
    `<a href="#${s.id}" onclick="navTo('${s.id}');return false;">${esc(s.label)}</a>`,
  ).join('\n');

  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NightWatch — ${esc(data.tenantId)} — ${esc(now)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020617;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh}

/* ── Sidebar ── */
nav{width:230px;min-width:230px;background:#0a0f1e;border-right:1px solid #0e7490;padding:0 0 24px;position:fixed;top:0;left:0;height:100vh;overflow-y:auto;z-index:10;display:flex;flex-direction:column}
.nav-header{padding:20px 16px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:10px;background:#050c1a}
.nav-header-text{display:flex;flex-direction:column}
.nav-brand{font-size:15px;font-weight:800;color:#fff;letter-spacing:.02em}
.nav-tagline{font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#06b6d4;margin-top:1px}
.nav-links{padding:14px 10px 0;flex:1}
.nav-group{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:#334155;padding:0 8px;margin:14px 0 4px}
nav a{display:flex;align-items:center;padding:7px 12px;border-radius:8px;color:#94a3b8;text-decoration:none;font-size:12.5px;margin-bottom:2px;transition:background .15s,color .15s}
nav a:hover{background:#0f172a;color:#e2e8f0}
nav a.active{background:#0c2a3a;color:#22d3ee;font-weight:600}
.nav-footer{padding:14px 16px;border-top:1px solid #1e293b;font-size:10px;color:#334155}

/* ── Main content ── */
main{margin-left:230px;padding:0;flex:1;max-width:1200px}

/* ── Page header ── */
.page-header{background:linear-gradient(135deg,#050c1a 0%,#0a1628 60%,#05131f 100%);border-bottom:1px solid #0e7490;padding:20px 36px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:5}
.page-header-text{display:flex;flex-direction:column}
.page-title{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.01em}
.page-subtitle{font-size:11px;color:#475569;margin-top:3px}
.page-badge{margin-left:auto;background:#0c2a3a;border:1px solid #0e7490;border-radius:20px;padding:5px 12px;font-size:11px;color:#22d3ee;white-space:nowrap}
.content{padding:28px 36px}

/* ── Sections ── */
section{margin-bottom:20px;border:1px solid #1e293b;border-radius:14px;overflow:hidden;scroll-margin-top:80px}
.sec-header{display:flex;justify-content:space-between;align-items:center;padding:13px 18px;background:#050d1a;cursor:pointer;border-bottom:1px solid #1e293b;user-select:none;transition:background .15s}
.sec-header:hover{background:#0f172a}
.sec-title{font-size:14px;font-weight:700;color:#e2e8f0;display:flex;align-items:center;gap:8px}
.sec-icon{font-size:16px}
.chevron{font-size:11px;color:#475569;transition:transform .2s}
.sec-body{padding:20px;background:#030912}

/* ── KPI cards ── */
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:18px}
.kpi{background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:14px 12px;text-align:center}
.kpi-val{font-size:22px;font-weight:800;line-height:1}
.kpi-lbl{font-size:10px;color:#64748b;margin-top:5px;text-transform:uppercase;letter-spacing:.06em}

/* ── Gauges ── */
.gauges{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:18px;justify-content:center}
.gauge-wrap{text-align:center}
.gauge-lbl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}

/* ── Charts ── */
h3{font-size:11px;font-weight:700;color:#64748b;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.1em}
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.chart-wrap{background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:14px;margin-bottom:14px;max-height:280px}

/* ── Tables ── */
.tbl-wrap{overflow-x:auto;margin-top:6px;border-radius:8px;border:1px solid #1e293b}
table{width:100%;border-collapse:collapse;font-size:11.5px}
th{text-align:left;padding:9px 12px;color:#64748b;background:#0f172a;border-bottom:1px solid #1e293b;white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:10px}
td{padding:8px 12px;border-bottom:1px solid #0f172a;color:#cbd5e1}
tr:last-child td{border-bottom:none}
tr:hover td{background:#0f172a}

/* ── Badges ── */
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600}
.badge-ok{background:#052e16;color:#34d399}
.badge-bad{background:#2d0909;color:#f87171}
.badge-crit{background:#2d0909;color:#f87171}
.badge-high{background:#2d1b09;color:#fb923c}
.badge-med{background:#2d2309;color:#fbbf24}
.badge-low{background:#052e16;color:#34d399}

/* ── Misc ── */
.empty{color:#334155;font-size:12px;padding:10px 0;font-style:italic}
.exec-summary{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px 16px;font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:16px}
.bullet-list{list-style:disc;padding-left:20px;font-size:12px;color:#94a3b8;display:flex;flex-wrap:wrap;gap:4px 24px}
.bullet-list li{margin:2px 0}
@media(max-width:700px){nav{display:none}main{margin-left:0}.page-header{padding:14px 16px}.content{padding:16px}.charts-row{grid-template-columns:1fr}}
</style>
</head>
<body>
<nav>
  <div class="nav-header">
    ${NIGHTWATCH_SVG}
    <div class="nav-header-text">
      <span class="nav-brand">Night Watch</span>
      <span class="nav-tagline">Operations Intelligence</span>
    </div>
  </div>
  <div class="nav-links">
    <div class="nav-group">Sections</div>
    ${sidebarLinks}
  </div>
  <div class="nav-footer">Generated ${esc(now)}</div>
</nav>
<main>
  <div class="page-header">
    ${NIGHTWATCH_SVG}
    <div class="page-header-text">
      <div class="page-title">Azure Night Watch</div>
      <div class="page-subtitle">Operations Intelligence Platform &nbsp;·&nbsp; ${esc(data.tenantId)}</div>
    </div>
    <div class="page-badge">Generated ${esc(now)}</div>
  </div>
  <div class="content">
    ${sectionsHtml || '<p style="color:#475569;padding:24px 0">No widget data available.</p>'}
  </div>
</main>
<script>
function navTo(id){
  var el=document.getElementById(id);
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  document.querySelectorAll('nav a').forEach(function(a){a.classList.remove('active')});
  var link=document.querySelector('nav a[href="#'+id+'"]');
  if(link)link.classList.add('active');
}
function toggle(id){
  var b=document.getElementById('body-'+id);
  var c=document.getElementById('chv-'+id);
  if(!b)return;
  var hidden=b.style.display==='none';
  b.style.display=hidden?'block':'none';
  c.style.transform=hidden?'':'rotate(-90deg)';
}
// highlight active nav item on scroll
var sections=document.querySelectorAll('section[id]');
window.addEventListener('scroll',function(){
  var scrollY=window.scrollY+100;
  sections.forEach(function(s){
    if(s.offsetTop<=scrollY&&s.offsetTop+s.offsetHeight>scrollY){
      document.querySelectorAll('nav a').forEach(function(a){a.classList.remove('active')});
      var link=document.querySelector('nav a[href="#'+s.id+'"]');
      if(link)link.classList.add('active');
    }
  });
},{passive:true});
</script>
</body>
</html>`;
}

export function downloadHtmlReport(html: string, tenantId: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `nightwatch-report-${tenantId}-${date}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
