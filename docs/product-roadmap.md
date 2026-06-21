# NightWatch — Product Roadmap

This document captures the feature gaps and work required to take NightWatch from an internal MSP tool to a commercially sellable product. Items are grouped by theme and prioritised within each group.

**Status key:** `[ ]` Not started &nbsp;|&nbsp; `[~]` In progress &nbsp;|&nbsp; `[x]` Done

---

## Current State (as of May 2026)

NightWatch is a fully functional MSP-internal Azure monitoring platform deployed at:
- **Frontend:** https://eun-p-nightwatch-web.azurewebsites.net
- **API:** https://eun-p-nightwatch-api.azurewebsites.net

It has 50+ monitoring dashboards, multi-tenant customer management, Teams notifications, AI summaries, and PDF/HTML exports. Access is restricted to MSP operators only via Azure AD.

The platform is not yet ready to sell because it lacks pricing tiers, customer-facing access, compliance documentation, and self-service onboarding.

---

## Priority 1 — Must Have to Make the First Sale

These items will block a deal from closing. Do these first.

### 1.1 Role-Based Access Control (enforcement in UI)

The app registration already defines three roles (`NightWatch.Admin`, `NightWatch.Operator`, `NightWatch.Reader`) but the frontend shows everything to everyone.

- [x] Read the user's assigned app role from the JWT claims in the frontend
- [x] `NightWatch.Reader` — dashboards and reports visible, widget selection only in Settings
- [x] `NightWatch.Operator` — full dashboard + settings, no user management
- [x] `NightWatch.Admin` — everything including user management and billing
- [x] Backend: enforce role on write endpoints (config, tenant management, cache clear)
- [x] Show/hide Settings and Tenant pages based on role

### 1.2 Customer Read-Only Portal

Currently customers have zero self-service visibility. MSPs sell this as a value-add; customers want to see their own data.

- [x] Separate login path for customer users (different from MSP operators)
- [x] Customer users can only see dashboards for their own tenant
- [x] Read-only — no settings, no tenant management, no cache controls
- [x] Branded header showing the customer's company name
- [x] Configurable per-tenant: which dashboards are visible to the customer

### 1.3 Guided Customer Onboarding

The current flow requires an MSP operator to know several manual steps. This needs to be a wizard.

- [x] Step 1: Enter customer tenant ID and display name
- [x] Step 2: Generate and send the admin consent link (already exists, needs UI polish)
- [x] Step 3: Verify consent was completed — poll the Graph API to confirm the service principal exists in the customer tenant
- [x] Step 4: Verify RBAC — check if the NightWatch MSP service principal has Reader on the customer's subscriptions; show which subscriptions are accessible and which are missing permissions
- [x] Step 5: Test data fetch — run a sample Resource Graph query against the tenant and confirm it returns data
- [x] Ongoing: show consent/connection status on the Tenants page (Connected / Consent Pending / RBAC Missing)

### 1.4 Audit Log

Required for enterprise procurement and SOC 2.

- [x] Log every authenticated API request: user, action, tenant, timestamp, IP
- [x] Store in a new `AuditLog` SQL table
- [x] UI page for admins to view and filter the audit log
- [x] Retention policy: configurable, default 90 days
- [x] Export audit log as CSV

### 1.5 Custom Alert Thresholds

Customers and MSPs want to define their own alerting rules rather than relying on fixed defaults.

- [x] Per-tenant threshold settings: monthly cost ceiling, security score floor, advisor score floor
- [x] Alert channels per threshold: Teams webhook, email (see 3.3), or both
- [x] Threshold breach history — log when a threshold was breached and when it recovered
- [x] UI to create/edit/delete thresholds

---

## Priority 2 — Must Have to Close Enterprise Deals

These are not always needed for a first sale but will come up in procurement for any mid-market or enterprise customer.

### 2.1 Security Posture Document

A one-page document answering the questions every enterprise security team asks.

- [ ] Where is customer data stored? (Azure SQL in `northeurope`, no cross-region replication)
- [ ] What data is collected? (Azure resource metadata only — no workload data, no secrets)
- [ ] How is data encrypted? (TLS in transit, SQL TDE at rest, Key Vault for secrets)
- [ ] Who has access? (MSP operators only, AAD-enforced)
- [ ] Penetration test — commission one and attach the executive summary
- [ ] Data retention policy — how long is data kept, how is it deleted when a customer offboards

### 2.2 SOC 2 Type II (longer term)

- [ ] Identify a SOC 2 auditor
- [ ] Implement controls: access reviews, change management, incident response, availability monitoring
- [ ] Annual audit cycle

### 2.3 High Availability & Backup

- [ ] Upgrade SQL to Standard tier with geo-redundant backup enabled
- [ ] Document RPO / RTO for the platform itself
- [ ] Runbook: how to restore the database from backup
- [ ] Consider slot-based deployments (staging → production swap) to eliminate deploy downtime

### 2.4 Data Residency Statement

- [ ] Document that all data stays in `northeurope` (Azure North Europe region)
- [ ] If a customer requires a different region, document the redeployment process using the Bicep template

### 2.5 GDPR / Data Deletion

- [ ] Customer offboarding procedure: when a tenant is removed, delete all their data from `DailySnapshots`, `ExecutiveDashboardLayouts`, `GlobalOperationsConfig`, `CustomerTenants`
- [ ] Implement soft-delete on `CustomerTenants` with a 30-day grace period before hard delete
- [ ] Document data processing in a Data Processing Agreement (DPA) template

---

## Priority 3 — Differentiators (Win Deals Against Competitors)

These are not blocking but will win deals where competitors exist.

### 3.1 One-Click Remediation Actions

The platform identifies problems but can't fix them. Remediation is the natural next step.

- [ ] Deallocate an idle or stopped VM from the Wastage Tracker page
- [ ] Delete an orphaned resource (disk, NIC, public IP) from the Orphaned Resources page
- [ ] Apply a missing tag from the Tag Hygiene page
- [ ] Confirm dialog before any action; log all actions to the Audit Log
- [ ] Permissions check before showing action buttons (requires `NightWatch.Operator` role)

### 3.2 Scheduled PDF Reports

Currently reports are manual exports only.

- [ ] Per-tenant scheduled report: daily / weekly / monthly
- [ ] Delivery options: email attachment, Teams message
- [ ] Report includes: executive summary, KPI cards, top issues, cost trend, AI summary (if configured)
- [ ] Report history — keep last 12 reports per tenant, downloadable from the UI

### 3.3 Email Notifications

Teams webhooks cover a narrow audience. Most customers also want email.

- [ ] SMTP / SendGrid integration (configurable per tenant)
- [ ] Alert emails: threshold breaches, critical security findings
- [ ] Daily summary email (alternative to or alongside Teams report)
- [ ] Per-user email preferences

### 3.4 SLA Report

A monthly SLA summary is a standard MSP deliverable.

- [ ] Track uptime per customer tenant (based on resource availability signals)
- [ ] Monthly SLA report: availability %, incidents, MTTR, cost summary
- [ ] PDF export of SLA report
- [ ] Historical SLA trend (12 months)

---

## Priority 4 — Commercial Infrastructure (Distribution & Revenue)

### 4.1 Pricing Tiers & Feature Gating

- [ ] Define tier structure — example:
  - **Starter:** up to 2 customer tenants, core dashboards only, no AI, no white-labelling
  - **Professional:** up to 10 tenants, all dashboards, AI summary, scheduled reports
  - **Enterprise:** unlimited tenants, white-labelling, audit log, SLA reports, SLAs
- [ ] Feature flag system — gate features based on the MSP's active plan
- [ ] Plan stored in the MSP's account record in the database

### 4.2 Billing Integration

- [ ] Stripe integration for subscription billing (monthly / annual)
- [ ] Usage metering: bill by number of active customer tenants
- [ ] Billing portal: MSP operators can view invoices, update payment method, upgrade/downgrade plan
- [ ] Trial period: 14-day free trial, no credit card required

### 4.3 Azure Marketplace / AppSource Listing

This is the primary distribution channel for reaching MSPs in the Microsoft ecosystem.

- [ ] Create a publisher account in Partner Center
- [ ] Prepare the Marketplace listing: description, screenshots, pricing plans
- [ ] SaaS offer type (transactable) — customers buy through Azure, billed via Azure
- [ ] Implement the Marketplace SaaS fulfillment API (subscription lifecycle webhooks)
- [ ] Submit for Microsoft certification review

### 4.4 Self-Service Sign-Up

- [ ] Public marketing/landing page (outside the app)
- [ ] Sign-up flow: enter company name, AAD tenant ID → trial provisioned automatically
- [ ] Automated provisioning: create tenant record, send welcome email with onboarding steps
- [ ] In-app onboarding checklist for new MSPs

---

## Priority 5 — Product Polish

### 5.1 White-Labelling

MSPs want to present NightWatch as their own product to their customers.

- [ ] Configurable logo (uploaded per MSP account)
- [ ] Configurable product name shown in the UI
- [ ] Custom domain support (e.g. `monitor.msp-company.com` instead of the azurewebsites.net URL)
- [ ] Branded email templates

### 5.2 Public Documentation Site

- [ ] Public docs site (GitBook, Docusaurus, or similar)
- [ ] Getting started guide
- [ ] Customer onboarding guide (the admin consent flow)
- [ ] API reference
- [ ] Changelog / release notes

### 5.3 In-App Onboarding

- [ ] First-time user checklist (add a subscription, configure Teams, add a customer tenant)
- [ ] Tooltips on key UI elements for first-time users
- [ ] Empty state improvements — every dashboard should explain what data it needs when it has nothing to show

### 5.4 Mobile Responsiveness

The dashboards are currently desktop-only. Not a blocker for an MSP tool but will come up.

- [ ] Audit which pages are most-visited and prioritise those for mobile layout
- [ ] Executive dashboard: single-column layout on mobile
- [ ] Key metrics (KPI cards) readable on phone

---

## Technical Debt to Address Before Scale

These are not visible to customers but will cause pain as the platform grows.

| Item | Risk if ignored |
|---|---|
| In-memory cache (single instance) | Cache lost on restart; doesn't work if scaled to multiple instances |
| Background services in API process | Teams notifications fail silently if App Service restarts mid-job |
| No distributed locking | Multiple instances could send duplicate Teams reports |
| Free F1 App Service plan (Bicep default) | Always On not available; background services stop on idle |
| No integration tests against real Azure | Mock-based tests will miss permission or API version changes |
| SQL connection string in app settings (plaintext) | Should move to Key Vault secret reference |

### Suggested technical improvements
- [ ] Replace in-memory cache with **Azure Cache for Redis** (supports multi-instance + persistence)
- [ ] Extract background services (Teams alerts, daily reports) into a separate **Azure Container App Job** or **Azure Functions** so they run independently of the API
- [ ] Move SQL connection string to **Key Vault** secret reference in App Service config
- [ ] Add integration test suite that runs against a real Azure subscription in CI
- [ ] Set Bicep default App Service plan to **B1** (Basic) to match production requirements

---

## Suggested Sprints for Next Week Onwards

| Week | Focus |
|---|---|
| Week 1 | Role enforcement in UI (1.1) + Customer read-only portal foundations (1.2) |
| Week 2 | Customer onboarding wizard (1.3) + connection status on Tenants page |
| Week 3 | Audit log — backend + UI (1.4) |
| Week 4 | Custom alert thresholds (1.5) + email notifications foundation (3.3) |
| Week 5 | Scheduled PDF reports (3.2) + SLA report (3.4) |
| Week 6 | Security posture document (2.1) + HA / backup documentation (2.3) |
| Week 7 | Pricing tier / feature flag system (4.1) |
| Week 8 | Stripe billing integration (4.2) |
| After that | Azure Marketplace listing (4.3), white-labelling (5.1), self-service sign-up (4.4) |
