export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface PropertyChange {
  propertyPath: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ChangeEvent {
  id: string;
  timestamp: string;
  changeType: 'Create' | 'Update' | 'Delete';
  resourceId: string;
  resourceName: string;
  resourceType: string;
  resourceGroup: string;
  subscriptionId: string;
  changedBy: string;
  changedByType: string;
  clientType: string;
  correlationId: string;
  propertyChanges: PropertyChange[];
}

export interface ChangesDashboard {
  timeRange: string;
  changes: ChangeEvent[];
  totalCount: number;
  createCount: number;
  updateCount: number;
  deleteCount: number;
  topChangedBy: string[];
}

export interface ScoreComponent {
  name: string;
  value: number;
  trend: string;
}

export interface HeatmapCell {
  subscriptionId: string;
  subscriptionName: string;
  riskLevel: RiskLevel;
  impactEstimateEur: number;
}

export type DataStatus = 'Live' | 'Synthetic' | 'Unknown';

export interface ExecutiveDashboard {
  tenantId: string;
  azureHealthScore: number;
  securityPostureScore: number;
  performanceScore: number;
  costEfficiencyScore: number;
  reliabilityScore: number;
  governanceComplianceScore: number;
  executiveSummary: string;
  dailyTrend: ScoreComponent[];
  subscriptionRiskHeatmap: HeatmapCell[];
  businessImpactEstimateEur: number;
  backupCoveragePercent: number;
  totalStatefulWorkloads: number;
  protectedWorkloads: number;
  dataStatus: DataStatus;
}

export interface ExecutiveLayout {
  tenantId: string;
  widgetKeys: string[];
  updatedAtUtc?: string;
}

export interface NetworkTopologyDashboard {
  tenantId: string;
  generatedAt: string;
  vnetCount: number;
  peeringCount: number;
  vpnGatewayCount: number;
  connectionCount: number;
  localGatewayCount: number;
  vnets: NetworkTopologyVnet[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  notes: string[];
}

export interface NetworkTopologyVnet {
  resourceId: string;
  name: string;
  subscriptionId: string;
  subscriptionName: string;
  location: string;
  addressPrefixes: string[];
  dnsServers: string[];
  linkedPrivateDnsZones: string[];
  subnets: NetworkTopologySubnet[];
}

export interface NetworkTopologySubnet {
  resourceId: string;
  name: string;
  addressPrefix: string;
  networkSecurityGroupId: string | null;
  routeTableId: string | null;
  nsgRules: NetworkTopologySecurityRule[];
  routeRules: NetworkTopologyRouteRule[];
}

export interface NetworkTopologySecurityRule {
  name: string;
  priority: string;
  direction: string;
  access: string;
  protocol: string;
  source: string;
  sourcePort: string;
  destination: string;
  destinationPort: string;
}

export interface NetworkTopologyRouteRule {
  name: string;
  addressPrefix: string;
  nextHopType: string;
  nextHopIpAddress: string;
}

export interface SecurityFinding {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  resourceId: string;
  impact: string;
  remediation: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface DashboardMetric {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  status: string;
  description: string;
}

export interface ResourceInsight {
  resourceId: string;
  resourceName: string;
  category: string;
  riskLevel: RiskLevel;
  description: string;
}

export interface SecurityDashboard {
  findings: SecurityFinding[];
  blastRadiusNodes: GraphNode[];
  blastRadiusEdges: GraphEdge[];
  metrics: DashboardMetric[];
  exposedResources: ResourceInsight[];
  coverageNotes: string[];
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
}

export interface PerformanceDashboard {
  slaRiskScore: number;
  cpuAnomalies: TimeseriesPoint[];
  diskLatencyMs: TimeseriesPoint[];
  networkBottleneckScore: TimeseriesPoint[];
  outagePredictions: string[];
  metrics: DashboardMetric[];
  serviceHealthSignals: string[];
  regionalOutageImpacts: string[];
  dependencyNodes: GraphNode[];
  dependencyEdges: GraphEdge[];
  fragilityIndex: number;
  fragilityRating: string;
  fragilityDrivers: string[];
}

export interface Recommendation {
  title: string;
  description: string;
  estimatedMonthlySavings: number;
  riskLevel: RiskLevel;
}

export interface CostDashboard {
  predictedNextMonthCost: number;
  currentMonthCost: number;
  recommendations: Recommendation[];
  costTrend: TimeseriesPoint[];
  carbonFootprintKgCo2: number;
  metrics: DashboardMetric[];
  costSpikeAlerts: string[];
  reservedInstanceRecommendations: string[];
  savingsPlanSuggestions: string[];
}

export interface WallOfShameItem {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  subscriptionName: string;
  violations: string[];
  violationCount: number;
}

export interface GovernanceDashboard {
  tagCompliancePercent: number;
  namingCompliancePercent: number;
  landingZoneCompliancePercent: number;
  driftAlerts: string[];
  ownershipInsights: { teamName: string; resourceCount: number; unownedResources: number }[];
  metrics: DashboardMetric[];
  lifecycleAlerts: string[];
  blueprintComparisons: string[];
  wallOfShameItems: WallOfShameItem[];
}

export interface RiskEvent {
  timestamp: string;
  category: string;
  level: RiskLevel;
  description: string;
}

export interface OperationalChangeEvent {
  timestamp: string;
  resourceId: string;
  resourceName: string;
  changeType: string;
  description: string;
  category: string;
  impact: RiskLevel;
}

export interface SmartFeatures {
  whatChanged: string[];
  aiRecommendations: Recommendation[];
  relationshipNodes: GraphNode[];
  relationshipEdges: GraphEdge[];
  riskTimeline: RiskEvent[];
  technicalDebtScore: number;
  singleFailurePoints: string[];
  suppressedAlerts: number;
  environmentMaturityScore: string;
  operationalTimeline: OperationalChangeEvent[];
}

export interface TenantOverview {
  tenantId: string;
  tenantName: string;
  subscriptionCount: number;
  overallRiskScore: number;
  activeCriticalAlerts: number;
  segment: string;
  securityScore: number;
  costScore: number;
  performanceScore: number;
  governanceScore: number;
}

export interface ActionableInsight {
  issueTitle: string;
  severity: RiskLevel;
  riskScore: number;
  impactedTenant: string;
  subscription: string;
  resourceGroup: string;
  resourceName: string;
  resourceType: string;
  environment: string;
  businessUnitOrCostCenter: string;
  firstDetectedTime: string;
  lastDetectedTime: string;
  duration: string;
  impactAnalysis: string;
  rootCauseExplanation: string;
  recommendedRemediation: string;
  remediationSteps: string[];
  estimatedSavings: number;
  estimatedRiskReduction: number;
  estimatedPerformanceImprovement: number;
  estimatedOperationalImpact: string;
  confidenceScore: number;
  correlatedResources: string[];
  relatedIncidents: string[];
  relatedChanges: string[];
  responsibleOwnerTeam: string;
}

export interface HistoricalIntelligence {
  trend7Days: TimeseriesPoint[];
  trend30Days: TimeseriesPoint[];
  trend90Days: TimeseriesPoint[];
  trend6Months: TimeseriesPoint[];
  trend12Months: TimeseriesPoint[];
  timelineEvents: { timestamp: string; category: string; description: string }[];
  baselineComparison: string;
  trendDeviation: string;
  riskEvolution: string;
  predictedOutcomeIfIgnored: string;
}

export interface PredictiveInsight {
  forecastLabel: string;
  prediction: string;
  confidenceScore: number;
  timeHorizon: string;
}

export interface AuditEvidence {
  reason: string;
  dataSources: string;
  historicalEvidence: string;
  correlationLogic: string;
  telemetryReferences: string;
}

export interface DashboardStructuredSummary {
  headlineStatus: string;
  keyMetrics: DashboardMetric[];
  topRisks: string[];
  topActions: string[];
  forecastSignals: string[];
  evidenceReferences: string[];
}

export interface RiSavingsOpportunity {
  subscriptionId: string;
  subscriptionName: string;
  recommendedOption: string;
  contractModel: string;
  pricingAssumption: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  region: string;
  sku: string;
  monthlyCost: number;
  pricingModel: string;
  hasSavingsEnabled: boolean;
  potentialMonthlySavings: number;
  potentialSavingsPercent: number;
  confidenceScore: number;
  recommendation: string;
}

export interface StrategicDashboard {
  key: string;
  title: string;
  summary: string;
  metrics: DashboardMetric[];
  signals: string[];
  recommendations: string[];
  priority: RiskLevel;
  generatedAt: string;
  actionableDetails: ActionableInsight[];
  historicalIntelligence: HistoricalIntelligence;
  predictiveInsights: PredictiveInsight[];
  auditEvidence: AuditEvidence;
  structuredSummary: DashboardStructuredSummary;
  riSavingsOpportunities: RiSavingsOpportunity[];
  executiveRecommendation: string;
  operationalRecommendation: string;
  technicalRecommendation: string;
}

export interface ResourceDeepDive {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  healthScore: number;
  riskScore: number;
  costScore: number;
  performanceScore: number;
  securityScore: number;
  cpuTrend: TimeseriesPoint[];
  memoryTrend: TimeseriesPoint[];
  changeTimeline: { timestamp: string; category: string; description: string }[];
  securityFindings: string[];
  costInsights: string[];
  recommendations: string[];
}

export interface CapacityTrend {
  name: string;
  unit: string;
  thresholdPercent: number;
  history: TimeseriesPoint[];
  forecast: TimeseriesPoint[];
  currentAverage: number;
  projected30Days: number;
  projected60Days: number;
  projected90Days: number;
}

export interface CapacityResourceForecast {
  subscription: string;
  resourceGroup: string;
  resourceName: string;
  cpuCurrent: number;
  memoryCurrent: number;
  diskCurrent: number;
  projectedCpu90: number;
  projectedMemory90: number;
  projectedDisk90: number;
  estimatedHeadroomDays: number;
  saturationDate: string | null;
  estimatedMonthlyWaste: number;
  status: string;
}

export interface CapacityHeadroom {
  resourceName: string;
  metric: string;
  saturationDate: string | null;
  estimatedHeadroomDays: number;
  status: string;
}

export interface CapacityRunwayItem {
  resourceName: string;
  resourceType: string;
  metric: string;
  daysUntilExhaustion: number;
  currentUsagePercent: number;
  urgencyLevel: string;
}

export interface QuickWinItem {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  subscriptionName: string;
  issueType: string;
  estimatedMonthlySavingsEur: number;
  recommendation: string;
  priority: string;
}

export interface QuickWinsDashboard {
  generatedAt: string;
  totalPotentialSavingsEur: number;
  totalQuickWins: number;
  items: QuickWinItem[];
  metrics: DashboardMetric[];
}

export interface CapacityPlanningDashboard {
  key: string;
  title: string;
  summary: string;
  timeRange: string;
  generatedAt: string;
  metrics: DashboardMetric[];
  trends: CapacityTrend[];
  resources: CapacityResourceForecast[];
  headroomTimeline: CapacityHeadroom[];
  recommendations: string[];
  insightCallout: string;
  executiveRecommendation: string;
  operationalRecommendation: string;
  technicalRecommendation: string;
  runwayForecast: CapacityRunwayItem[];
}

export interface CostAnomalyPoint {
  timestamp: string;
  actualCost: number;
  baselineCost: number;
  deviationPercent: number;
  isAnomaly: boolean;
  severity: string;
}

export interface CostAnomalyItem {
  timestamp: string;
  actualCost: number;
  baselineCost: number;
  deviationPercent: number;
  severity: string;
  insight: string;
}

export interface BudgetBurnForecast {
  dailyBurnRate: number;
  projectedMonthEndCost: number;
  budgetLimit: number;
  forecastVariance: number;
  daysToBudgetExhaustion: number;
  budgetUtilizationPercent: number;
}

export interface CostAnomalyForecastDashboard {
  key: string;
  title: string;
  summary: string;
  timeRange: string;
  generatedAt: string;
  metrics: DashboardMetric[];
  trend: CostAnomalyPoint[];
  anomalies: CostAnomalyItem[];
  budgetForecast: BudgetBurnForecast;
  recommendations: string[];
  insightCallout: string;
  executiveRecommendation: string;
  operationalRecommendation: string;
  technicalRecommendation: string;
}

export interface DrComplianceThresholds {
  greenPercent: number;
  amberPercent: number;
  redPercent: number;
  nearBreachPercent: number;
}

export interface DrCriticalityProfile {
  name: string;
  desiredRpoMinutes: number;
  desiredRtoMinutes: number;
}

export interface DrTargetOverride {
  scopeType: string;
  scopeId: string;
  workloadType: string | null;
  resourceId: string | null;
  criticality: string;
  desiredRpoMinutes: number;
  desiredRtoMinutes: number;
}

export interface DrGovernanceSettings {
  globalDesiredRpoMinutes: number;
  globalDesiredRtoMinutes: number;
  thresholds: DrComplianceThresholds;
  criticalityProfiles: DrCriticalityProfile[];
  overrides: DrTargetOverride[];
}

export interface DrWorkloadAssessment {
  workloadId: string;
  workloadName: string;
  workloadType: string;
  subscriptionId: string;
  subscriptionName: string;
  resourceGroup: string;
  region: string;
  environment: string;
  criticality: string;
  desiredRpoMinutes: number;
  desiredRtoMinutes: number;
  achievableRpoMinutes: number;
  achievableRtoMinutes: number;
  complianceStatus: string;
  drReadinessStatus: string;
  riskScore: number;
  recoverabilityScore: number;
  gapSummary: string;
  rootCause: string;
  recommendation: string;
  estimatedEffort: string;
  estimatedMonthlyCostEur: number;
  priorityScore: number;
  confidenceScore: number;
  businessImpactIfIgnored: string;
}

export interface DrComplianceTrendPoint {
  timestamp: string;
  rpoCompliancePercent: number;
  rtoCompliancePercent: number;
  drReadinessScore: number;
  recoverabilityScore: number;
  nonCompliantWorkloads: number;
}

export interface DrSubscriptionRisk {
  subscriptionId: string;
  subscriptionName: string;
  totalWorkloads: number;
  nonCompliantWorkloads: number;
  riskScore: number;
  businessImpactExposureEur: number;
}

export interface DrRiskHeatmapCell {
  scope: string;
  workloadType: string;
  nonCompliantCount: number;
  avgRiskScore: number;
}

export interface DrDashboard {
  tenantId: string;
  generatedAt: string;
  governanceSettings: DrGovernanceSettings;
  totalWorkloadsAssessed: number;
  totalProtectedWorkloads: number;
  totalUnprotectedWorkloads: number;
  workloadsMeetingRpo: number;
  workloadsMeetingRto: number;
  workloadsFailingCompliance: number;
  drReadinessScore: number;
  recoverabilityScore: number;
  businessContinuityRiskScore: number;
  estimatedBusinessImpactExposureEur: number;
  rpoCompliancePercent: number;
  rtoCompliancePercent: number;
  riskHeatmap: DrRiskHeatmapCell[];
  subscriptionRiskRanking: DrSubscriptionRisk[];
  topFailingWorkloads: DrWorkloadAssessment[];
  workloadAssessments: DrWorkloadAssessment[];
  complianceTrend: DrComplianceTrendPoint[];
  actionableRecommendations: string[];
}

export interface TopCostlyResource {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  subscriptionId: string;
  subscriptionName: string;
  monthlyCostEur: number;
}

export interface TopCostlyResourcesDashboard {
  tenantId: string;
  resources: TopCostlyResource[];
  totalCostEur: number;
  generatedAt: string;
}

// ── Subscription Cost ──────────────────────────────────────────────────────
export interface SubscriptionMonthCost {
  subscriptionId: string;
  subscriptionName: string;
  costEur: number;
}

export interface SubscriptionCostMonth {
  month: string;
  monthLabel: string;
  totalCostEur: number;
  subscriptions: SubscriptionMonthCost[];
}

export interface SubscriptionCostSummary {
  subscriptionId: string;
  subscriptionName: string;
  totalCostEur: number;
  avgMonthlyCostEur: number;
  peakMonthCostEur: number;
  peakMonth: string;
}

export interface SubscriptionCostDashboard {
  tenantId: string;
  months: number;
  generatedAt: string;
  totalCostEur: number;
  avgMonthlyCostEur: number;
  currentMonthCostEur: number;
  monthlyBreakdown: SubscriptionCostMonth[];
  subscriptionSummaries: SubscriptionCostSummary[];
}

// ── Tag Hygiene ────────────────────────────────────────────────────────────
export interface TagHygieneResourceType {
  resourceType: string;
  shortType: string;
  untaggedCount: number;
  totalCount: number;
}
export interface TagHygieneSubscription {
  subscriptionId: string;
  subscriptionName: string;
  untaggedCount: number;
  totalCount: number;
  coveragePercent: number;
}
export interface TagHygieneDashboard {
  tenantId: string;
  generatedAt: string;
  coveragePercent: number;
  totalResources: number;
  untaggedResources: number;
  topUntaggedTypes: TagHygieneResourceType[];
  subscriptionBreakdown: TagHygieneSubscription[];
}

// ── Orphaned Resources ─────────────────────────────────────────────────────
export interface OrphanedResource {
  resourceId: string;
  name: string;
  resourceType: string;
  category: string;
  subscriptionName: string;
  estimatedMonthlyWasteEur: number;
}
export interface OrphanedResourcesDashboard {
  tenantId: string;
  generatedAt: string;
  totalOrphanedResources: number;
  estimatedMonthlyWasteEur: number;
  orphanedDisks: number;
  orphanedNics: number;
  orphanedPublicIps: number;
  orphanedSnapshots: number;
  resources: OrphanedResource[];
}


// ── Backup Health ──────────────────────────────────────────────────────────
export interface BackupHealthDashboard {
  tenantId: string;
  generatedAt: string;
  totalProtectedItems: number;
  unprotectedVms: number;
  totalVms: number;
  protectionCoveragePercent: number;
  backupVaultCount: number;
  unprotectedResourceTypes: string[];
}

// ── IAM Review ─────────────────────────────────────────────────────────────
export interface IamRiskItem {
  title: string;
  riskLevel: string;
  count: number;
  recommendation: string;
}
export interface IamSubscription {
  subscriptionName: string;
  totalAssignments: number;
  ownerAssignments: number;
}
export interface IamReviewDashboard {
  tenantId: string;
  generatedAt: string;
  totalRoleAssignments: number;
  ownerAssignments: number;
  servicePrincipalAssignments: number;
  userAssignments: number;
  customRoleCount: number;
  risks: IamRiskItem[];
  subscriptionBreakdown: IamSubscription[];
}

// ── Wastage Tracker ────────────────────────────────────────────────────────
export interface WastageItem {
  category: string;
  resourceName: string;
  resourceId: string;
  subscriptionName: string;
  estimatedMonthlyWasteEur: number;
  reason: string;
}
export interface WastageTrackerDashboard {
  tenantId: string;
  generatedAt: string;
  totalEstimatedMonthlyWasteEur: number;
  totalWastedResources: number;
  wastageItems: WastageItem[];
}

// ── Network Perimeter ──────────────────────────────────────────────────────
export interface ExposedResource {
  resourceName: string;
  resourceType: string;
  subscriptionName: string;
  exposureType: string;
  riskLevel: string;
  details?: string;
}
export interface NetworkPerimeterDashboard {
  tenantId: string;
  generatedAt: string;
  totalPublicIps: number;
  unprotectedPublicIps: number;
  openManagementPortResources: number;
  dangerousNsgRuleCount: number;
  exposedResources: ExposedResource[];
}

// ── Non-Prod Uptime Leakage ────────────────────────────────────────────────
export interface NonProdVm {
  resourceName: string;
  resourceId: string;
  subscriptionName: string;
  environment: string;
  vmSize: string;
  estimatedMonthlyCostEur: number;
}
export interface NonProdUptimeDashboard {
  tenantId: string;
  generatedAt: string;
  nonProdVmCount: number;
  runningNonProdVmCount: number;
  estimatedMonthlyLeakageEur: number;
  runningVms: NonProdVm[];
}

// ── RI & Savings ───────────────────────────────────────────────────────────
export interface RiRecommendation {
  resourceType: string;
  recommendationType: string;
  term: string;
  scope: string;
  estimatedAnnualSavingsEur: number;
  estimatedMonthlySavingsEur: number;
  impact: string;
}
export interface RiSavingsDashboard {
  tenantId: string;
  generatedAt: string;
  totalEstimatedAnnualSavingsEur: number;
  totalEstimatedMonthlySavingsEur: number;
  recommendationCount: number;
  recommendations: RiRecommendation[];
}

// ── App & Functions Health ─────────────────────────────────────────────────
export interface AppFunctionItem {
  resourceId: string;
  name: string;
  kind: string;
  state: string;
  subscriptionName: string;
  location: string;
  sku: string;
}
export interface AppFunctionsHealthDashboard {
  tenantId: string;
  generatedAt: string;
  totalApps: number;
  runningApps: number;
  stoppedApps: number;
  functionAppCount: number;
  webAppCount: number;
  logicAppCount: number;
  apps: AppFunctionItem[];
}

// ── Database Health ────────────────────────────────────────────────────────
export interface DatabaseResource {
  resourceId: string;
  name: string;
  resourceType: string;
  dbEngine: string;
  subscriptionName: string;
  location: string;
  tier: string;
  sku: string;
  status: string;
  dtuCapacity: number | null;
}
export interface DatabaseHealthDashboard {
  tenantId: string;
  generatedAt: string;
  totalDatabases: number;
  runningDatabases: number;
  stoppedDatabases: number;
  sqlCount: number;
  mySqlCount: number;
  postgreSqlCount: number;
  cosmosDbCount: number;
  elasticPoolCount: number;
  databases: DatabaseResource[];
}

// ── Key Vault Health ───────────────────────────────────────────────────────
export interface KeyVaultItem {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  softDeleteEnabled: boolean;
  purgeProtectionEnabled: boolean;
  accessModel: string;
  sku: string;
}
export interface KeyVaultHealthDashboard {
  tenantId: string;
  generatedAt: string;
  totalVaults: number;
  softDeleteDisabledCount: number;
  purgeProtectionDisabledCount: number;
  accessPolicyModelCount: number;
  rbacModelCount: number;
  vaults: KeyVaultItem[];
}

// ── AKS & Container Health ─────────────────────────────────────────────────
export interface AksCluster {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  kubernetesVersion: string;
  provisioningState: string;
  nodeCount: number;
  sku: string;
}
export interface ContainerAppItem {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  provisioningState: string;
}
export interface ContainerRegistryItem {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  sku: string;
  adminUserEnabled: boolean;
}
export interface AksContainerHealthDashboard {
  tenantId: string;
  generatedAt: string;
  totalClusters: number;
  runningClusters: number;
  stoppedClusters: number;
  totalContainerApps: number;
  totalRegistries: number;
  clusters: AksCluster[];
  containerApps: ContainerAppItem[];
  registries: ContainerRegistryItem[];
}

// ── Storage Account Compliance ─────────────────────────────────────────────
export interface StorageAccountItem {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  sku: string;
  publicBlobAccessEnabled: boolean;
  httpsOnly: boolean;
  minTlsVersion: string;
  allowSharedKeyAccess: boolean;
}
export interface StorageComplianceDashboard {
  tenantId: string;
  generatedAt: string;
  totalStorageAccounts: number;
  publicAccessCount: number;
  httpOnlyViolationCount: number;
  weakTlsCount: number;
  sharedKeyAllowedCount: number;
  fullyCompliantCount: number;
  storageAccounts: StorageAccountItem[];
}

// ── Azure Service Health ───────────────────────────────────────────────────
export interface ServiceHealthEvent {
  eventId: string;
  title: string;
  eventType: string;
  status: string;
  impactedService: string;
  subscriptionName: string;
  level: string;
  startTime: string | null;
}
export interface ServiceHealthDashboard {
  tenantId: string;
  generatedAt: string;
  activeIncidents: number;
  plannedMaintenance: number;
  healthAdvisories: number;
  securityAdvisories: number;
  events: ServiceHealthEvent[];
}

// ── Managed Identity Audit ─────────────────────────────────────────────────
export interface ManagedIdentityItem {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  identityType: string;
  federatedCredentialCount: number;
}
export interface ManagedIdentityAuditDashboard {
  tenantId: string;
  generatedAt: string;
  totalUserAssigned: number;
  totalSystemAssigned: number;
  userAssignedIdentities: ManagedIdentityItem[];
}

// ── Azure Advisor Score ────────────────────────────────────────────────────
export interface AdvisorScoreCategory {
  category: string;
  score: number;
  impactedResourceCount: number;
  potentialScoreIncrease: number;
}
export interface AdvisorScoreDashboard {
  tenantId: string;
  generatedAt: string;
  overallScore: number;
  categoryScores: AdvisorScoreCategory[];
}

// ── Messaging Health ───────────────────────────────────────────────────────
export interface ServiceBusNamespace {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  sku: string;
  status: string;
}
export interface EventHubNamespace {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  sku: string;
  throughputUnits: number;
}
export interface MessagingHealthDashboard {
  tenantId: string;
  generatedAt: string;
  totalServiceBusNamespaces: number;
  totalEventHubNamespaces: number;
  serviceBusNamespaces: ServiceBusNamespace[];
  eventHubNamespaces: EventHubNamespace[];
}

// ── Support Ticket Tracker ─────────────────────────────────────────────────
export interface SupportTicket {
  ticketId: string;
  title: string;
  severity: string;
  status: string;
  serviceName: string;
  subscriptionName: string;
  createdDate: string;
  ageDays: number;
}
export interface SupportTicketDashboard {
  tenantId: string;
  generatedAt: string;
  totalOpenTickets: number;
  criticalCount: number;
  highCount: number;
  moderatCount: number;
  minimalCount: number;
  tickets: SupportTicket[];
}

// ── VMSS Health ────────────────────────────────────────────────────────────
export interface VmssItem {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  sku: string;
  capacity: number;
  provisioningState: string;
  upgradePolicy: string;
}
export interface VmssHealthDashboard {
  tenantId: string;
  generatedAt: string;
  totalScaleSets: number;
  runningCount: number;
  failedCount: number;
  totalInstances: number;
  scaleSets: VmssItem[];
}

// ── Azure Monitor Alerts ────────────────────────────────────────────────────
export interface AlertItem {
  alertId: string;
  name: string;
  severity: string;
  alertState: string;
  monitorCondition: string;
  targetResource: string;
  targetResourceType: string;
  monitorService: string;
  subscriptionName: string;
  firedDateTime: string;
}
export interface AlertServiceCount {
  serviceName: string;
  count: number;
}
export interface AlertsDashboard {
  tenantId: string;
  generatedAt: string;
  totalActive: number;
  sev0Count: number;
  sev1Count: number;
  sev2Count: number;
  sev3Count: number;
  sev4Count: number;
  newCount: number;
  acknowledgedCount: number;
  byService: AlertServiceCount[];
  alerts: AlertItem[];
}

// ── AzPolicyLens ───────────────────────────────────────────────────────────
export interface PolicyCategoryBreakdown {
  category: string;
  nonCompliantResources: number;
}

export interface PolicyAssignmentSummary {
  assignmentId: string;
  displayName: string;
  scope: string;
  subscriptionName: string;
  nonCompliantResources: number;
  priorityScore: number;
  subscriptionsImpacted: number;
  effect: string;
}

export interface PolicySubCompliance {
  subscriptionId: string;
  subscriptionName: string;
  nonCompliantResources: number;
  compliantResources: number;
  compliancePercent: number;
  exemptResources: number;
  conflictResources: number;
}

export interface PolicyEffectCount {
  effect: string;
  count: number;
}

export interface AzPolicyLensDashboard {
  tenantId: string;
  generatedAt: string;
  totalAssignments: number;
  customDefinitions: number;
  totalNonCompliantResources: number;
  totalCompliantResources: number;
  overallCompliancePercent: number;
  totalExemptions: number;
  compliantAssignments: number;
  nonCompliantAssignments: number;
  topNonCompliantAssignments: PolicyAssignmentSummary[];
  subscriptionCompliance: PolicySubCompliance[];
  effectBreakdown: PolicyEffectCount[];
  categoryBreakdown: PolicyCategoryBreakdown[];
}

// ── Express Route ───────────────────────────────────────────────────────────
export interface ExpressRouteCircuit {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  serviceProvider: string;
  peeringLocation: string;
  bandwidthMbps: number;
  circuitProvisioningState: string;
  serviceProviderProvisioningState: string;
  sku: string;
  tier: string;
}

export interface ExpressRoutePeering {
  circuitId: string;
  circuitName: string;
  peeringType: string;
  state: string;
  primaryPrefix: string;
  secondaryPrefix: string;
}

export interface ExpressRouteDashboard {
  tenantId: string;
  generatedAt: string;
  totalCircuits: number;
  provisionedCount: number;
  notProvisionedCount: number;
  totalBandwidthMbps: number;
  circuits: ExpressRouteCircuit[];
  peerings: ExpressRoutePeering[];
}

// ── Virtual WAN ─────────────────────────────────────────────────────────────
export interface Vwan {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  vwanType: string;
  provisioningState: string;
  hubCount: number;
}

export interface VwanHub {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  vwanId: string;
  addressPrefix: string;
  provisioningState: string;
  hubRoutingPreference: string;
}

export interface VwanDashboard {
  tenantId: string;
  generatedAt: string;
  totalVwans: number;
  totalHubs: number;
  connectedHubs: number;
  vwans: Vwan[];
  hubs: VwanHub[];
}

// ── Azure Firewall ────────────────────────────────────────────────────────────
export interface AzureFirewallInstance {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  skuTier: string;
  threatIntelMode: string;
  provisioningState: string;
  policyName: string | null;
  isVirtualHubBased: boolean;
  publicIpCount: number;
}
export interface AzureFirewallPolicy {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  threatIntelMode: string;
  dnsProxyEnabled: boolean;
  tlsInspectionEnabled: boolean;
  linkedFirewallCount: number;
}
export interface AzureFirewallTrafficPoint {
  hour: string;
  allowedCount: number;
  deniedCount: number;
}
export interface AzureFirewallTopBlocked {
  destination: string;
  hitCount: number;
}
export interface AzureFirewallThreatHit {
  threatName: string;
  sourceIp: string;
  destinationIp: string;
  action: string;
  count: number;
}
export interface AzureFirewallPermissiveRule {
  policyName: string;
  ruleCollectionName: string;
  ruleName: string;
  sourceAddresses: string;
  destinationAddresses: string;
  destinationPorts: string;
}
export interface AzureFirewallInsight {
  category: string;
  message: string;
  severity: string;
}
export interface AzureFirewallDashboard {
  tenantId: string;
  generatedAt: string;
  totalFirewalls: number;
  healthyCount: number;
  degradedCount: number;
  hasPolicies: boolean;
  hasLogAnalyticsData: boolean;
  totalAllowedLast24h: number;
  totalBlockedLast24h: number;
  threatIntelHits: number;
  firewalls: AzureFirewallInstance[];
  policies: AzureFirewallPolicy[];
  trafficTrend: AzureFirewallTrafficPoint[];
  topBlockedDestinations: AzureFirewallTopBlocked[];
  threatHits: AzureFirewallThreatHit[];
  permissiveRules: AzureFirewallPermissiveRule[];
  insights: AzureFirewallInsight[];
}

// ── Application Gateway ───────────────────────────────────────────────────────
export interface AppGatewayInstance {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  skuTier: string;
  skuCapacity: number;
  provisioningState: string;
  wafEnabled: boolean;
  wafMode: string;
  wafRuleSetType: string;
  wafRuleSetVersion: string;
  sslPolicyName: string;
  backendPoolCount: number;
  listenerCount: number;
  routingRuleCount: number;
  http2Enabled: boolean;
  autoscaleEnabled: boolean;
  frontendPublicIpCount: number;
}
export interface AppGatewayTrafficPoint {
  hour: string;
  requestCount: number;
  blockedCount: number;
}
export interface AppGatewayTopUrl {
  url: string;
  requestCount: number;
}
export interface AppGatewayWafBlock {
  ruleId: string;
  message: string;
  hitCount: number;
}
export interface AppGatewayInsight {
  category: string;
  message: string;
  severity: string;
}
export interface AppGatewayListener {
  gatewayId: string;
  listenerName: string;
  protocol: string;
  hostname: string;
}
export interface AppGatewayDashboard {
  tenantId: string;
  generatedAt: string;
  totalGateways: number;
  healthyCount: number;
  degradedCount: number;
  wafEnabledCount: number;
  wafPreventionCount: number;
  totalRequests24h: number;
  totalBlocked24h: number;
  hasLogAnalyticsData: boolean;
  gateways: AppGatewayInstance[];
  listeners: AppGatewayListener[];
  trafficTrend: AppGatewayTrafficPoint[];
  topUrls: AppGatewayTopUrl[];
  topWafBlocks: AppGatewayWafBlock[];
  insights: AppGatewayInsight[];
}

// ── VPN Gateway ───────────────────────────────────────────────────────────────
export interface VpnGatewayInstance {
  resourceId: string;
  name: string;
  subscriptionName: string;
  location: string;
  skuName: string;
  generation: string;
  gatewayType: string;
  vpnType: string;
  bgpEnabled: boolean;
  bgpAsn: number;
  activeActiveEnabled: boolean;
  provisioningState: string;
  connectionCount: number;
}
export interface VpnGatewayConnection {
  resourceId: string;
  name: string;
  subscriptionName: string;
  connectionType: string;
  connectionStatus: string;
  bgpEnabled: boolean;
  localNetworkGatewayName: string;
  localNetworkGatewayIp: string;
  remoteVnetName: string;
}
export interface VpnGatewayTunnelPoint {
  hour: string;
  bytesIn: number;
  bytesOut: number;
}
export interface VpnGatewayInsight {
  category: string;
  message: string;
  severity: string;
}
export interface VpnGatewayDashboard {
  tenantId: string;
  generatedAt: string;
  totalGateways: number;
  healthyCount: number;
  degradedCount: number;
  totalConnections: number;
  connectedTunnels: number;
  hasLogAnalyticsData: boolean;
  gateways: VpnGatewayInstance[];
  connections: VpnGatewayConnection[];
  tunnelTrend: VpnGatewayTunnelPoint[];
  insights: VpnGatewayInsight[];
}

export interface AggregateDashboard {
  executive: ExecutiveDashboard;
  networkTopology: NetworkTopologyDashboard;
  security: SecurityDashboard;
  performance: PerformanceDashboard;
  cost: CostDashboard;
  governance: GovernanceDashboard;
  dr: DrDashboard;
  topCostlyResources: TopCostlyResourcesDashboard;
  tagHygiene: TagHygieneDashboard;
  orphanedResources: OrphanedResourcesDashboard;
  backupHealth: BackupHealthDashboard;
  iamReview: IamReviewDashboard;
  wastageTracker: WastageTrackerDashboard;
  networkPerimeter: NetworkPerimeterDashboard;
  nonProdUptime: NonProdUptimeDashboard;
  riSavings: RiSavingsDashboard;
  appFunctionsHealth: AppFunctionsHealthDashboard;
  azPolicyLens: AzPolicyLensDashboard;
  databaseHealth: DatabaseHealthDashboard;
  keyVaultHealth: KeyVaultHealthDashboard;
  aksContainerHealth: AksContainerHealthDashboard;
  storageCompliance: StorageComplianceDashboard;
  serviceHealth: ServiceHealthDashboard;
  managedIdentityAudit: ManagedIdentityAuditDashboard;
  advisorScore: AdvisorScoreDashboard;
  messagingHealth: MessagingHealthDashboard;
  supportTickets: SupportTicketDashboard;
  vmssHealth: VmssHealthDashboard;
  alerts: AlertsDashboard;
  expressRoute: ExpressRouteDashboard;
  vwan: VwanDashboard;
  azureFirewall: AzureFirewallDashboard;
  appGateway: AppGatewayDashboard;
  vpnGateway: VpnGatewayDashboard;
  identityAttackSurface: IdentityAttackSurfaceDashboard;
}

// ── Identity Attack Surface ───────────────────────────────────────────────────
export interface IdentityRiskFinding {
  id: string;
  title: string;
  severity: string;
  count: number;
  category: string;
  recommendation: string;
}

export interface PrivilegedRoleAssignment {
  principalName: string;
  principalType: string;
  roleName: string;
  subscriptionName: string;
  isOwnerRole: boolean;
}

export interface RiskySignInEvent {
  userDisplayName: string;
  userPrincipalName: string;
  riskLevel: string;
  ipAddress: string;
  signInTime: string;
}

export interface ConditionalAccessPolicySummary {
  policyName: string;
  appliedCount: number;
  blockedCount: number;
  mfaRequiredCount: number;
}

export interface IdentityAttackSurfaceDashboard {
  tenantId: string;
  generatedAt: string;
  totalPrivilegedAssignments: number;
  ownerAssignments: number;
  servicePrincipalOwnerCount: number;
  customRoleCount: number;
  guestUserAssignments: number;
  identityRiskScore: number;
  riskySignInCount: number;
  riskyUserCount: number;
  pimActivationCount: number;
  mfaBlockedCount: number;
  hasSignInLogData: boolean;
  hasAuditLogData: boolean;
  findings: IdentityRiskFinding[];
  privilegedRoles: PrivilegedRoleAssignment[];
  riskySignIns: RiskySignInEvent[];
  conditionalAccessPolicies: ConditionalAccessPolicySummary[];
}

export interface AlertBreach {
  id: number;
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

export interface AlertDigest {
  total: number;
  critical: number;
  high: number;
  medium: number;
  affectedTenants: number;
  breaches: AlertBreach[];
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

export interface ActionItem {
  id: number;
  tenantId: string;
  month: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface CreateActionItemRequest {
  title: string;
  description: string;
  priority: string;
  category: string;
}

export interface UpdateActionItemRequest {
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  resolutionNote?: string | null;
}

export interface ScoreDimensionComparison {
  dimension: string;
  thisMonth: number;
  lastMonth: number;
  delta: number;
  trend: string;
}

export interface MonthlyReview {
  tenantId: string;
  tenantDisplayName: string;
  month: string;
  monthLabel: string;
  previousMonth: string | null;
  previousMonthLabel: string | null;
  overallScore: number;
  previousOverallScore: number | null;
  overallDelta: number | null;
  dimensions: ScoreDimensionComparison[];
  improved: ScoreDimensionComparison[];
  declined: ScoreDimensionComparison[];
  openActionItems: number;
  resolvedThisMonth: number;
  actionItems: ActionItem[];
  hasPreviousData: boolean;
}
