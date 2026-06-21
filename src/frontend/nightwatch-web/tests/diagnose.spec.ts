import { test, expect, Page } from '@playwright/test';

const mockConfig = { msalEnabled: false, clientId: '', tenantId: '', apiScope: '' };

const mockExecutive = {
  tenantId: 'tenant-a', azureHealthScore: 87, securityPostureScore: 72,
  performanceScore: 81, costEfficiencyScore: 68, reliabilityScore: 90,
  governanceComplianceScore: 77, executiveSummary: 'Systems are stable.',
  dailyTrend: [], subscriptionRiskHeatmap: [], businessImpactEstimateEur: 4200,
};

async function setupMocks(page: Page) {
  await page.route('**/api/**', r => r.fulfill({ status: 200, json: {} }));
  await page.route('**/api/config', r => r.fulfill({ json: mockConfig }));
  await page.route('**/api/dashboard/executive/**', r => r.fulfill({ json: mockExecutive }));
}

test('diagnose executive dashboard with stack trace', async ({ page }) => {
  const pageErrors: Error[] = [];

  page.on('pageerror', err => pageErrors.push(err));

  // Log every request and its response
  page.on('request', req => {
    if (req.url().includes('/api/')) console.log('REQUEST:', req.url());
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) console.log('RESPONSE:', res.url(), res.status());
  });

  await setupMocks(page);
  await page.goto('/');
  await page.waitForTimeout(2000);

  if (pageErrors.length > 0) {
    console.log('=== Page Errors ===');
    for (const e of pageErrors) {
      console.log('Message:', e.message);
      console.log('Stack:', e.stack);
    }
  }

  expect(pageErrors, 'no page errors should occur').toHaveLength(0);
});
