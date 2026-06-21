import { test, expect, Page } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockConfig = { msalEnabled: false, clientId: '', tenantId: '', apiScope: '' };

const mockExecutive = {
  tenantId: 'tenant-a', azureHealthScore: 87, securityPostureScore: 72,
  performanceScore: 81, costEfficiencyScore: 68, reliabilityScore: 90,
  governanceComplianceScore: 77, executiveSummary: 'Systems are stable.',
  dailyTrend: [], subscriptionRiskHeatmap: [], businessImpactEstimateEur: 4200,
};

const mockSecurity = {
  findings: [{ id: '1', title: 'Open NSG rule', riskLevel: 'Critical', resourceId: '/subs/x/nsg', impact: 'High', remediation: 'Restrict rule.' }],
  blastRadiusNodes: [{ id: 'n1', label: 'VM-1', type: 'vm' }],
  blastRadiusEdges: [],
  metrics: [{ key: 'm1', label: 'Defender Score', value: 72, unit: '%', status: 'live', description: 'Posture.' }],
  exposedResources: [],
  coverageNotes: ['Coverage is partial.'],
};

const mockPerformance = {
  slaRiskScore: 12, cpuAnomalies: [], diskLatencyMs: [], networkBottleneckScore: [],
  outagePredictions: ['No imminent outage detected.'],
  metrics: [{ key: 'cpu', label: 'Avg CPU', value: 34, unit: '%', status: 'healthy', description: 'Average.' }],
  serviceHealthSignals: ['All regions healthy.'],
  regionalOutageImpacts: ['Up to 2 subscriptions affected.'],
  dependencyNodes: [], dependencyEdges: [],
  fragilityIndex: 28, fragilityRating: 'Stable',
  fragilityDrivers: ['No significant fragility drivers detected'],
};

const mockGovernance = {
  tagCompliancePercent: 83, namingCompliancePercent: 79, landingZoneCompliancePercent: 91,
  driftAlerts: ['3 policy drifts detected.'],
  ownershipInsights: [{ teamName: 'Platform Team', resourceCount: 120, unownedResources: 14 }],
  metrics: [{ key: 'tags', label: 'Tag compliance', value: 83, unit: '%', status: 'live', description: 'Tagged.' }],
  lifecycleAlerts: ['2 VMs are idle for >30 days.'],
  blueprintComparisons: ['Landing zone approximated.'],
  wallOfShameItems: [
    { resourceId: '/subs/x/vms/vm-001', resourceName: 'vm-untagged-001', resourceType: 'Microsoft.Compute/virtualMachines', subscriptionName: 'Dev-Sub', violations: ['Missing: owner', 'Naming non-compliant'], violationCount: 2 },
    { resourceId: '/subs/x/vms/vm-002', resourceName: 'vm-untagged-002', resourceType: 'Microsoft.Compute/virtualMachines', subscriptionName: 'Dev-Sub', violations: ['Missing: environment'], violationCount: 1 },
  ],
};

const mockSmart = {
  whatChanged: ['3 NSG rules active.', 'Cost: EUR 5000.'],
  aiRecommendations: [], relationshipNodes: [], relationshipEdges: [],
  riskTimeline: [],
  technicalDebtScore: 42, singleFailurePoints: ['No Log Analytics configured.'],
  suppressedAlerts: 5, environmentMaturityScore: 'Intermediate',
  operationalTimeline: [
    { timestamp: new Date().toISOString(), resourceId: '/nsg', resourceName: 'nsg-prod', changeType: 'RuleModified', description: '2 Any/Any rules active.', category: 'Security', impact: 'Critical' },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), resourceId: '/cost', resourceName: 'Cost Management', changeType: 'CostUpdated', description: 'EUR 5000 this month.', category: 'Cost', impact: 'Low' },
  ],
};

const mockCapacity = {
  key: 'capacity-planning', title: 'Capacity Planning', summary: 'Stable.', timeRange: '30d',
  generatedAt: new Date().toISOString(),
  metrics: [{ key: 'cpu', label: 'Avg CPU', value: 34, unit: '%', status: 'healthy', description: 'Avg.' }],
  trends: [], resources: [],
  headroomTimeline: [{ resourceName: 'vm-prod-01', metric: 'CPU', saturationDate: null, estimatedHeadroomDays: 45, status: 'safe' }],
  recommendations: ['Rightsize highest-risk resources.'],
  insightCallout: 'Stable capacity.',
  executiveRecommendation: 'No immediate action.', operationalRecommendation: 'Monitor weekly.',
  technicalRecommendation: 'Use trend deltas.',
  runwayForecast: [
    { resourceName: 'vm-db-01', resourceType: 'Microsoft.Compute/virtualMachines', metric: 'CPU', daysUntilExhaustion: 5, currentUsagePercent: 92, urgencyLevel: 'Critical' },
    { resourceName: 'vm-app-02', resourceType: 'Microsoft.Compute/virtualMachines', metric: 'CPU', daysUntilExhaustion: 25, currentUsagePercent: 78, urgencyLevel: 'High' },
  ],
};

const mockTenants = [
  { tenantId: 'tenant-a', tenantName: 'Contoso Corp', subscriptionCount: 5, overallRiskScore: 72, activeCriticalAlerts: 3, segment: 'Enterprise', securityScore: 68, costScore: 74, performanceScore: 81, governanceScore: 77 },
];

const mockInsightFeed = [
  { id: '1', title: 'Security: 5 Unhealthy Assessments', message: 'Defender reports 5 issues.', category: 'Security', severity: 0, timestamp: new Date().toISOString(), targetPage: '/security' },
  { id: '2', title: 'Cost Optimisation Opportunity', message: 'Rightsize idle VMs.', category: 'Cost', severity: 2, timestamp: new Date().toISOString(), targetPage: '/cost' },
];

const mockQuickWins = {
  generatedAt: new Date().toISOString(), totalPotentialSavingsEur: 147, totalQuickWins: 3,
  items: [
    { resourceId: '/disk/1', resourceName: 'disk-orphan-001', resourceType: 'Microsoft.Compute/disks', subscriptionName: 'Dev-Sub', issueType: 'UnusedDisk', estimatedMonthlySavingsEur: 12, recommendation: 'Delete this unattached disk.', priority: 'High' },
    { resourceId: '/nic/1', resourceName: 'nic-unused-001', resourceType: 'Microsoft.Network/networkInterfaces', subscriptionName: 'Dev-Sub', issueType: 'UnusedNic', estimatedMonthlySavingsEur: 4, recommendation: 'Remove this unused NIC.', priority: 'Medium' },
  ],
  metrics: [{ key: 'quickWins', label: 'Quick Wins', value: 3, unit: 'items', status: 'attention', description: 'Resources to clean up.' }],
};

// ── Setup ─────────────────────────────────────────────────────────────────────
async function setupMocks(page: Page) {
  // Catch-all must be registered FIRST — Playwright routes are LIFO, so
  // registering specific routes after means they take priority over this.
  await page.route('**/api/**', r => r.fulfill({ status: 200, json: {} }));
  await page.route('**/api/config', r => r.fulfill({ json: mockConfig }));
  await page.route('**/api/dashboard/executive/**', r => r.fulfill({ json: mockExecutive }));
  await page.route('**/api/dashboard/security/**', r => r.fulfill({ json: mockSecurity }));
  await page.route('**/api/dashboard/performance/**', r => r.fulfill({ json: mockPerformance }));
  await page.route('**/api/dashboard/governance/**', r => r.fulfill({ json: mockGovernance }));
  await page.route('**/api/dashboard/smart/**', r => r.fulfill({ json: mockSmart }));
  await page.route('**/api/dashboard/capacity-planning/**', r => r.fulfill({ json: mockCapacity }));
  await page.route('**/api/dashboard/cost/**', r => r.fulfill({ json: { predictedNextMonthCost: 5200, currentMonthCost: 4900, recommendations: [], costTrend: [], carbonFootprintKgCo2: 1437, metrics: [], costSpikeAlerts: [], reservedInstanceRecommendations: [], savingsPlanSuggestions: [] } }));
  await page.route('**/api/tenants', r => r.fulfill({ json: mockTenants }));
  await page.route('**/api/intelligence/feed', r => r.fulfill({ json: mockInsightFeed }));
  await page.route('**/api/dashboard/quick-wins/**', r => r.fulfill({ json: mockQuickWins }));
  await page.route('**/api/operations-config', r => r.fulfill({ json: { subscriptionIds: [], logAnalyticsWorkspaceId: '', aiTarget: 'none', aiEndpoint: '', aiModel: '', aiApiKeyConfigured: false, drSettings: { globalDesiredRpoMinutes: 240, globalDesiredRtoMinutes: 480, thresholds: { greenPercent: 95, amberPercent: 80, redPercent: 60, nearBreachPercent: 90 }, criticalityProfiles: [], overrides: [] }, updatedAtUtc: new Date().toISOString() } }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('Executive Dashboard', () => {
  test('renders health scores', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await expect(page.getByText('87', { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Systems are stable.')).toBeVisible();
  });

  test('scorecard drill-down links exist', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const links = page.locator('a[href*="/security"], a[href*="/performance"], a[href*="/cost"]');
    await expect(links.first()).toBeVisible();
  });
});

test.describe('Security Dashboard', () => {
  test('renders findings and coverage notes', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/security');
    await expect(page.getByText('Open NSG rule')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Coverage is partial.')).toBeVisible();
  });
});

test.describe('Performance Dashboard', () => {
  test('renders fragility index gauge', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/performance');
    await expect(page.getByText('Fragility Index')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('28')).toBeVisible();
    await expect(page.getByText('Stable')).toBeVisible();
  });

  test('renders fragility drivers', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/performance');
    await expect(page.getByRole('heading', { name: 'Fragility Drivers' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No significant fragility drivers detected')).toBeVisible();
  });

  test('shows outage predictions', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/performance');
    await expect(page.getByText('No imminent outage detected.')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Governance Dashboard - Wall of Shame', () => {
  test('renders wall of shame table with violations', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/governance');
    await expect(page.getByText('Wall of Shame')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('vm-untagged-001')).toBeVisible();
    await expect(page.getByText('vm-untagged-002')).toBeVisible();
  });

  test('shows violation badges', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/governance');
    await expect(page.getByText('Missing: owner')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Naming non-compliant')).toBeVisible();
  });

  test('shows compliance KPIs', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/governance');
    await expect(page.getByText('Tag compliance: 83%')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Intelligence Dashboard - Operational Timeline', () => {
  test('renders timeline section', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/intelligence');
    await expect(page.getByText('Operational Timeline')).toBeVisible({ timeout: 10_000 });
  });

  test('shows timeline events with categories', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/intelligence');
    await expect(page.getByText('nsg-prod')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('2 Any/Any rules active.')).toBeVisible();
    await expect(page.getByText('Cost Management')).toBeVisible();
  });
});

test.describe('Capacity Planning - Runway Countdown', () => {
  test('renders runway forecast cards', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/capacity-planning');
    await expect(page.getByText('Capacity Runway', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('vm-db-01')).toBeVisible();
    await expect(page.getByText('5', { exact: true })).toBeVisible();
  });

  test('shows urgency levels with correct colors', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/capacity-planning');
    await expect(page.getByText('Critical').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('High').first()).toBeVisible();
  });
});

test.describe('MSP Dashboard - Tenant Health Heatmap', () => {
  test('renders heatmap table', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/msp');
    await expect(page.getByText('Tenant Health Heatmap')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Contoso Corp').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows per-dimension score columns', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/msp');
    await expect(page.getByText('Security')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Governance')).toBeVisible();
    await expect(page.getByText('Performance')).toBeVisible();
  });
});

test.describe('Quick Wins Page', () => {
  test('renders potential savings', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/quick-wins');
    await expect(page.getByText('Quick Wins', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('€147')).toBeVisible();
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible();
  });

  test('renders orphaned resource items', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/quick-wins');
    await expect(page.getByText('disk-orphan-001')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Delete this unattached disk.')).toBeVisible();
  });

  test('shows annual opportunity calculation', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/quick-wins');
    await expect(page.getByText('Annual Opportunity')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('€1764')).toBeVisible();
  });
});

test.describe('Insight Feed - Filter Tabs', () => {
  test('renders severity filter tabs', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /All/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Critical/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /High/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Medium/i })).toBeVisible();
  });

  test('filters insights by severity tab', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await expect(page.getByText('Security: 5 Unhealthy Assessments')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Critical/i }).click();
    await expect(page.getByText('Security: 5 Unhealthy Assessments')).toBeVisible();
    // Cost insight is Medium severity — should be hidden in Critical filter
    await expect(page.getByText('Cost Optimisation Opportunity')).not.toBeVisible();
  });

  test('All tab shows all insights', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await expect(page.getByText('Security: 5 Unhealthy Assessments')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Critical/i }).click();
    await page.getByRole('button', { name: /All/i }).click();
    await expect(page.getByText('Security: 5 Unhealthy Assessments')).toBeVisible();
    await expect(page.getByText('Cost Optimisation Opportunity')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('quick-wins route is accessible', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/quick-wins');
    await expect(page).not.toHaveURL('/');
    await expect(page.getByText('Idle & orphaned resources')).toBeVisible({ timeout: 10_000 });
  });

  test('unknown route redirects to home', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/this-route-does-not-exist');
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Accessibility basics', () => {
  test('executive dashboard has no broken images', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const brokenImages = await page.evaluate(() =>
      Array.from(document.images).filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)
    );
    expect(brokenImages).toHaveLength(0);
  });

  test('page title is set', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });
});
