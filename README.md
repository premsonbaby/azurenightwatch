# NightWatch — Azure Operations Intelligence Platform

NightWatch is a **managed service provider (MSP) platform** that turns customers' Azure data into client-ready reports, early warnings, and commercial conversations — automatically. It connects to customer tenants via a multi-tenant service principal, pulls live signals from Azure Resource Graph, Cost Management, Defender, Advisor, Monitor, and Policy Insights, and presents them through a customisable executive dashboard with 50+ drill-down views.

> **Access is restricted to MSP operators only by default.** Authentication is enforced at both the frontend (MSAL) and the backend (`/api/auth/check` validates the Azure AD tenant of the signed-in user). Customers can optionally be given read-only portal access to their own data.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  MSP Operator (browser)                                         │
│  React 19 SPA  ──MSAL──►  Azure AD (NightWatch app reg)        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Bearer JWT
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Azure App Service  (eun-p-nightwatch-api)                      │
│  .NET 8 Web API                                                 │
│  ├── JWT validation  (AzureAd:Audience)                         │
│  ├── Role-based policies  (Admin / Operator / Reader)           │
│  ├── /api/auth/check  — validates tid claim == HomeTenantId     │
│  ├── TenantCredentialMiddleware  — swaps credential when        │
│  │   request targets a customer tenantId                        │
│  └── 50+ controllers  (ARG / Cost Management / Defender / …)   │
└──────────────┬───────────────────────────┬──────────────────────┘
               │                           │
               ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────────────┐
│  Azure SQL Database     │  │  Customer Azure Tenants         │
│  DailySnapshots         │  │  Queried via NightWatch MSP     │
│  CustomerTenants        │  │  service principal              │
│  ExecutiveLayouts       │  │  (ClientSecretCredential)       │
│  GlobalOperationsConfig │  └─────────────────────────────────┘
│  MonthlyHealthSnapshots │
│  ReportSentLogs         │
│  AuditLog               │
│  AlertThresholds        │
│  ThresholdBreaches      │
└─────────────────────────┘
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Recharts, React Router 7 |
| Backend | ASP.NET Core Web API, .NET 8, C# 12 |
| Background services | .NET `BackgroundService` (hosted in the API process) |
| Auth | Microsoft Entra ID, JWT bearer (`Microsoft.Identity.Web`), MSAL |
| Database | Azure SQL Server, EF Core 8 (migrations applied at startup) |
| AI integration | Azure OpenAI or Anthropic Claude — pluggable via `IAiSummaryService` |
| Notifications | Microsoft Teams via Power Automate Workflows webhook (Adaptive Card) |
| Email | SMTP via `System.Net.Mail` — configurable for any provider (MailerSend, SendGrid, O365) |
| PDF export | QuestPDF (server-side, white-label ready) |
| HTML export | Custom HTML builder with embedded charts |
| Observability | Application Insights, Log Analytics |
| Drag-and-drop layout | dnd-kit |

---

## Repository Layout

```
.
├── src
│   ├── backend
│   │   ├── NightWatch.Api            — ASP.NET Core controllers, middleware, startup
│   │   ├── NightWatch.Application    — Service contracts, DTOs, recommendation engine
│   │   ├── NightWatch.Domain         — Domain models and enumerations
│   │   └── NightWatch.Infrastructure — Azure API clients, EF Core, background services
│   └── frontend
│       └── nightwatch-web            — React SPA (Vite, Tailwind, Recharts)
├── infra
│   └── bicep
│       └── main.bicep                — Azure infrastructure template
├── tests
│   └── NightWatch.Api.Tests          — API integration tests
├── docker-compose.yml                — Local Docker environment (API + frontend + SQL Server)
├── azure-pipelines.yml               — Azure DevOps deployment pipeline
└── AzureNightWatch.slnx              — .NET solution file
```

---

## App Registrations

Two Azure AD app registrations are required:

### 1. NightWatch MSAL (user-facing auth)
- **Purpose:** MSP operators sign in through this app reg via MSAL
- **Type:** Single-tenant (MSP tenant only)
- **Config key:** `AzureAd__Audience` in App Service settings
- **Scope exposed:** `api://<client-id>/user_impersonation`

### 2. NightWatch MSP (service principal for customer queries)
- **Purpose:** Backend daemon credential for querying customer Azure tenants
- **Type:** Multi-tenant — customers grant admin consent to this app
- **Config keys:** `MultiTenant__ClientId` and `MultiTenant__ClientSecret`
- **Required RBAC on customer subscriptions:** Reader role

### MSP-only access enforcement
After MSAL login the frontend acquires a token and calls `GET /api/auth/check`. The backend reads the JWT `tid` claim and compares it against `MultiTenant:HomeTenantId`. Any user from a different tenant receives `403 Forbidden` and sees the "Access Restricted" page — no application content is visible.

---

## Role-Based Access Control

NightWatch enforces three application roles defined in the Azure AD Enterprise Application (NightWatch MSAL → Users and groups):

| Role | What they can do |
|---|---|
| `NightWatch.Admin` | Full access — all dashboards, all settings, user management, audit log |
| `NightWatch.Operator` | All dashboards, full settings, tenant management — no user management |
| `NightWatch.Reader` | Dashboards and widget selection only — no settings, no tenant management, read-only |

**Assigning roles:** Azure Portal → Entra ID → Enterprise Applications → NightWatch MSAL → Users and groups → Add user/group → Select role. The user must sign out and back in after assignment for the new role to take effect.

**Frontend enforcement:** The `RoleContext` reads the `roles` claim from the MSAL ID token and shows or hides navigation elements accordingly. The Settings button is hidden for Readers; the Tenants page is blocked for Readers.

**Backend enforcement:** API controllers use `[Authorize(Policy = "NightWatchOperator")]` or `[Authorize(Policy = "NightWatchAdmin")]` on write endpoints. All read endpoints use `[Authorize(Policy = "PlatformReader")]` which allows any valid NightWatch role.

> If no role is assigned to a user, the system falls back to `NightWatch.Admin` during the transition period.

---

## Scheduled Email Reports

MSP operators can configure automatic PDF reports to be emailed to customer contacts on a weekly or monthly schedule. Reports are generated server-side using QuestPDF and sent via SMTP.

### How it works

1. **Configure the schedule** — go to `/report-schedule` (accessible via the calendar icon in the top header). Set frequency, delivery day, time, timezone, and recipient email addresses. This can be configured for both the home tenant and any customer tenant.

2. **The backend polls every 5 minutes** — `ScheduledEmailReportBackgroundService` checks all active tenants with a report schedule configured. If the scheduled send window has been reached and no report has been sent in the current period, it generates the full PDF report and emails it to all configured recipients.

3. **Send Report Now** — the `/report-schedule` page includes a "Send Report Now" button that triggers an immediate send without waiting for the scheduled time. Useful for testing or for sending a report on demand before a customer meeting.

4. **Report history** — go to `/report-history` (calendar icon in header) to see all reports sent across all tenants, with timestamp, recipient count, file size, send type (Scheduled vs OnDemand), and delivery status (Sent / Failed).

### Report content
The emailed PDF is the same full operations report available via the PDF export button — it includes the executive dashboard, security posture, cost analysis, governance summary, DR status, backup coverage, and (if configured) an AI-generated summary.

### White-label branding
The MSP company name is injected into the PDF header and the email subject line. Set it in **Settings → Teams → Customer Name**. The subject line format is:

```
{Company Name} — Azure Operations Report — {Month Year}
```

### Configuring SMTP
Add the following application settings to the API App Service (`eun-p-nightwatch-api`):

| Setting | Example | Description |
|---|---|---|
| `EmailSmtp__Host` | `smtp.mailersend.net` | SMTP server hostname |
| `EmailSmtp__Port` | `587` | SMTP port (587 for STARTTLS, 465 for SSL) |
| `EmailSmtp__UseSsl` | `true` | Enable TLS/SSL |
| `EmailSmtp__Username` | `apikey` or your username | SMTP authentication username |
| `EmailSmtp__Password` | your password or API key | SMTP authentication password |
| `EmailSmtp__FromAddress` | `reports@yourdomain.com` | The From address on sent emails |
| `EmailSmtp__FromName` | `NightWatch Reports` | The display name shown to recipients |

Works with any SMTP provider: MailerSend, SendGrid, Office 365, Gmail, or your own mail server. If SMTP is not configured the schedule can still be saved but the "Send Report Now" button will show an error and no emails will be sent automatically.

---

## Proactive Alert Thresholds

MSP operators can define custom alert thresholds per customer tenant. When a threshold is breached, NightWatch fires a Teams notification immediately.

### Configurable metrics

| Metric | Description |
|---|---|
| Monthly Cost Ceiling | Alert when current-month spend exceeds this amount |
| Budget Burn Rate Warning | Pre-breach alert when the projected month-end cost will exceed this budget |
| Security Score Floor | Alert when Defender security score falls below this value |
| Advisor Score Floor | Alert when Azure Advisor overall score falls below this value |
| Backup Coverage Floor | Alert when backup protection coverage falls below this percentage |
| Governance Score Floor | Alert when governance compliance score falls below this value |
| Reliability Score Floor | Alert when platform reliability score falls below this value |

### Alert channels
- **Teams** — sends to the tenant's configured Teams webhook
- **Teams + Email** — sends to both Teams and configured email recipients (requires SMTP)

### Breach history
Every threshold breach is recorded in the `ThresholdBreaches` table with the actual value, breach time, severity, business impact, and suggested action. Breaches can be acknowledged from the UI at `/alert-thresholds`.

---

## Score History

NightWatch captures a snapshot of each tenant's health scores at the end of every month. The `MonthlySnapshotBackgroundService` runs every 6 hours and writes to `MonthlyHealthSnapshots` once per tenant per calendar month.

Scores captured per month:
- Azure Health Score (overall)
- Security Posture Score
- Performance Score
- Cost Efficiency Score
- Reliability Score
- Governance Compliance Score
- Active Critical Alerts count
- Backup Coverage %
- Subscription count

View the trend chart at `/score-history`. This data is the foundation for the upcoming monthly review report (Phase 4).

---

## Audit Log

Every authenticated API request is logged to the `AuditLog` table — user ID, email, HTTP method, endpoint path, tenant context, IP address, HTTP status code, duration, and timestamp.

Access the audit log at `/audit-log` (Admin role only). Features:
- Filter by date range, user, or tenant
- Paginated results
- CSV export for compliance reporting
- Configurable retention period (default 90 days)

---

## Customer Read-Only Portal

Customers can be given read-only access to their own Azure health data without seeing any other customer's data or the MSP's configuration.

- Customer users sign in via a separate login path at `/portal/`
- They can only see dashboards scoped to their own tenant
- No Settings, Tenants, or management pages are accessible
- The header shows the customer's own company name (branded experience)
- The MSP can configure which dashboards are visible to each customer

---

## Actionable Intelligence Features

In addition to the core monitoring dashboards, NightWatch includes several actionable intelligence views:

| Feature | Where | What it shows |
|---|---|---|
| **AI Insight Feed** | `/intelligence` | Fused Defender + cost signals ranked by severity with filter tabs (All / Security / Cost / Performance) |
| **Quick Wins** | `/quick-wins` | Orphaned disks, NICs, and public IPs with estimated monthly savings if deleted |
| **Wall of Shame** | `/governance` | Resources with the worst governance posture — persistently non-compliant, untagged, or misconfigured |
| **Fragility Index** | `/performance` | SVG radial gauge showing platform fragility 0–100 with the top contributing risk drivers listed below |
| **Tenant Heatmap** | `/msp` | 2D table of all customer tenants × score dimensions (Security / Cost / Performance / Governance) with colour coding |
| **Operational Timeline** | `/intelligence` | Vertical timeline of significant operational changes and events across the environment |
| **Capacity Runway** | `/capacity-planning` | Countdown cards per resource type showing how many days until capacity is exhausted, colour-coded by urgency |

---

## Backend Layer Detail

### `NightWatch.Api`
- ASP.NET Core controllers (one per feature domain)
- JWT auth via `Microsoft.Identity.Web` in Production; `DevBypassAuthHandler` in Development (no login needed locally)
- Four authorization policies: `PlatformReader`, `PlatformOperator`, `NightWatchOperator`, `NightWatchAdmin`
- `TenantCredentialMiddleware` — when a request includes a customer `tenantId`, swaps the Azure credential to the NightWatch MSP `ClientSecretCredential` so all downstream Azure calls hit the correct tenant
- Rate limiting via `AspNetCoreRateLimit` (240 req/min per IP)
- Brotli + Gzip response compression

### `NightWatch.Infrastructure`
Azure API clients:

| Client | Azure Service |
|---|---|
| `AzureResourceGraphClient` | Resource Graph (ARG) — inventory and configuration queries |
| `CostManagementClient` | Cost Management API — daily cost granularity |
| `DefenderClient` | Microsoft Defender for Cloud — assessments and alerts |
| `AdvisorClient` | Azure Advisor — recommendations by category |
| `MonitorClient` | Log Analytics / Azure Monitor |
| `AzurePolicyInsightsClient` | Azure Policy compliance summarise API |

Background services:

| Service | Schedule | Description |
|---|---|---|
| `TeamsAlertBackgroundService` | Every 15 minutes | Polls health signals; fires immediate Teams alerts on threshold breach |
| `TeamsReportBackgroundService` | Every 1 minute (time-gated) | Sends daily HTML executive report to Teams webhook at configured time |
| `ScheduledEmailReportBackgroundService` | Every 5 minutes | Checks all tenants with a report schedule; generates and emails the PDF report when the scheduled window is reached |
| `MonthlySnapshotBackgroundService` | Every 6 hours | Captures monthly health score snapshots for all active tenants once per calendar month |
| `DashboardRefreshService` | Periodic | Pre-warms in-memory dashboard caches |

### `NightWatch.Application`
- `INightWatchInsightsService` — main service interface for all dashboard data
- `NightWatchInsightsService` — split across partial class files per domain (Cost, Security, Governance, Network, etc.)
- `InsightAggregatorService` — fuses Defender + cost signals into the Insight Feed
- `IReportScheduleService` — schedule CRUD, send logging, and history retrieval
- `IEmailService` — SMTP email delivery with PDF attachment
- DTOs in `DashboardDtos.cs`, `ReportScheduleDtos.cs`, `ThresholdDtos.cs`, `HealthSnapshotDtos.cs`

---

## Database

Azure SQL managed by EF Core migrations — applied automatically at API startup (idempotent).

| Table | Contents |
|---|---|
| `DailySnapshots` | Historical health/cost snapshots per tenant per day |
| `MonthlyHealthSnapshots` | Monthly health scores per tenant — used for trend charts and the upcoming monthly review report |
| `CustomerTenants` | Registered customer tenants — ID, name, Teams webhook, budget limit, visible dashboards, report schedule config, last report sent timestamp |
| `ExecutiveDashboardLayouts` | Per-user widget layout JSON, keyed by (TenantId, AAD ObjectId) |
| `GlobalOperationsConfig` | MSP operations scope: subscriptions, Log Analytics workspaces, AI config, Teams settings, DR thresholds, home tenant report schedule |
| `ReportSentLogs` | History of every report email sent — tenant, timestamp, recipient count, file size, type (Scheduled / OnDemand), status (Sent / Failed), error message |
| `AuditLog` | Every authenticated API request — user, action, tenant, IP, status code, duration, timestamp |
| `AlertThresholds` | Per-tenant configurable alert rules — metric type, threshold value, alert channel, enabled flag |
| `ThresholdBreaches` | History of every threshold breach — actual vs threshold value, breach time, resolution time, severity, business impact, acknowledgement |

---

## Dashboard & Feature Catalog

### Core / Executive
| Route | Feature |
|---|---|
| `/` | Executive Dashboard — customisable widget grid (drag-and-drop, per-user layout) |
| `/intelligence` | Operational Intelligence — live Defender + cost insight feed with filter tabs |
| `/msp` | MSP / Tenant Heatmap — all customers × all score dimensions |
| `/score-history` | Health Score History — monthly trend charts for all score dimensions |
| `/quick-wins` | Quick Wins — orphaned resources with estimated savings |

### Reporting
| Route | Feature |
|---|---|
| `/report-schedule` | Report Schedule — configure frequency, recipients, and delivery time per tenant; Send Report Now button |
| `/report-history` | Report History — full log of all reports sent across all tenants with delivery status |

### Security
| Route | Feature |
|---|---|
| `/security` | Security Intelligence |
| `/iam-review` | IAM Risk Posture |
| `/network-perimeter` | Network Perimeter |
| `/identity-attack-surface` | Identity Attack Surface |
| `/managed-identity-audit` | Managed Identity Audit |
| `/key-vault-health` | Key Vault Health |
| `/storage-compliance` | Storage Compliance |
| `/backup-health` | Backup Reliability |

### Cost
| Route | Feature |
|---|---|
| `/cost` | Cost Optimisation |
| `/subscription-cost` | Subscription Cost — monthly spend by subscription (3/6/12 months, CSV export) |
| `/top-costly-resources` | Top Costly Resources |
| `/spend-anomaly` | Cost Anomaly Detection & Budget Burn Forecast |
| `/wastage-tracker` | Wastage Tracker (idle VMs, stopped VMs, orphaned resources) |
| `/ri-savings` | RI & Savings Plan Recommendations |
| `/nonprod-uptime` | Non-Prod Uptime Leakage |

### Performance & Reliability
| Route | Feature |
|---|---|
| `/performance` | Performance Dashboard with Fragility Index gauge |
| `/capacity-planning` | Capacity Planning with Runway countdown cards |
| `/dr-recoverability` | Disaster Recoverability (RPO/RTO posture) |

### Governance
| Route | Feature |
|---|---|
| `/governance` | Governance Dashboard with Wall of Shame |
| `/tag-hygiene-compliance` | Tag Hygiene Compliance |
| `/policy-radar` | Azure Policy Lens |
| `/orphaned-resources` | Orphaned Resources |
| `/azure-changes` | Azure Change Activity Timeline |

### Networking
| Route | Feature |
|---|---|
| `/network-topology` | Network Topology |
| `/expressroute` | ExpressRoute |
| `/vwan` | Virtual WAN |
| `/azure-firewall` | Azure Firewall |
| `/vpn-gateway` | VPN Gateway |
| `/app-gateway` | Application Gateway |

### Platform & Data
| Route | Feature |
|---|---|
| `/database-health` | Database Health |
| `/aks-container-health` | AKS & Container Health |
| `/app-service-health` | App Service & Functions Health |
| `/messaging-health` | Messaging Health (Service Bus / Event Hub) |
| `/vmss-health` | VMSS Health |

### Operations
| Route | Feature |
|---|---|
| `/advisor-score` | Azure Advisor Score |
| `/service-health` | Azure Service Health |
| `/support-tickets` | Support Ticket Tracker |
| `/alerts` | Azure Monitor Alerts |
| `/resource-deep-dive` | Resource Deep Dive |

### Management (Operator/Admin only)
| Route | Access | Feature |
|---|---|---|
| `/tenants` | Operator+ | Customer Tenant Registry, onboarding wizard, admin consent, connection status |
| `/settings/operations` | Operator+ | Operations scope, AI config, Teams notifications, DR settings |
| `/alert-thresholds` | Operator+ | Custom alert threshold rules and breach history per tenant |
| `/report-schedule` | Operator+ | Per-tenant report schedule configuration and on-demand send |
| `/report-history` | Operator+ | Full report send history across all tenants |
| `/audit-log` | Admin only | Full API audit trail with CSV export |

---

## Azure App Service Settings

**Portal → App Services → `<your-api-app-name>` → Configuration → Application settings**

### Core authentication (required)

| Setting | Where to get it | Notes |
|---|---|---|
| `AzureAd__ClientId` | App Registrations → NightWatch MSAL → Application (client) ID | |
| `MultiTenant__ClientId` | App Registrations → NightWatch MSP → Application (client) ID | |
| `MultiTenant__ClientSecret` | App Registrations → NightWatch MSP → Certificates & secrets | Treat as a password |
| `ConnectionStrings__SqlDatabase` | SQL Server → your database → Connection strings (ADO.NET) | |
| `ApplicationInsights__ConnectionString` | Application Insights → Connection String | Optional but recommended |

### Email / Scheduled reports (required for email delivery)

| Setting | Example | Description |
|---|---|---|
| `EmailSmtp__Host` | `smtp.mailersend.net` | SMTP server hostname |
| `EmailSmtp__Port` | `587` | SMTP port |
| `EmailSmtp__UseSsl` | `true` | Enable TLS |
| `EmailSmtp__Username` | your username | SMTP auth username |
| `EmailSmtp__Password` | your password | SMTP auth password |
| `EmailSmtp__FromAddress` | `reports@yourdomain.com` | Sender email address |
| `EmailSmtp__FromName` | `NightWatch Reports` | Sender display name |

### Baked into `appsettings.json` — only override if needed

| Setting | Default | Description |
|---|---|---|
| `AzureAd__TenantId` | `organizations` | Accepts tokens from any AAD tenant; MSP restriction enforced by auth check |
| `AzureAd__Audience` | Set in pipeline | Application ID URI for JWT validation |
| `MultiTenant__HomeTenantId` | Set in pipeline | MSP tenant GUID — blocks non-MSP users |

---

## Deployment

### Option A — Azure DevOps Pipeline (full deployment)

The pipeline file is `azure-pipelines.yml`. It is **manually triggered**.

| Stage | What it does |
|---|---|
| `Deploy_Infrastructure` | Creates resource group, runs Bicep template — provisions API App Service, frontend App Service, SQL Server, Key Vault, Log Analytics, Application Insights |
| `Configure_App_Settings` | Sets core app settings on the API App Service automatically |
| `Assign_Managed_Identity_Roles` | Grants Reader, Security Reader, Cost Management Reader, Log Analytics Reader to the API managed identity |
| `Build_Artifacts` | Publishes .NET API and builds Vite frontend, packages both as zip files |
| `Deploy_API` | Deploys API zip to App Service |
| `Deploy_Web` | Deploys frontend zip to App Service |

**Required pipeline variables:**

| Variable | Secret? | Notes |
|---|---|---|
| `deploymentSubscriptionId` | No | Your Azure subscription GUID |
| `SQL_ADMIN_PASSWORD` | Yes | Min 8 chars, mixed case, number, symbol |

**After the pipeline completes**, manually add to the API App Service: `MultiTenant__ClientId`, `MultiTenant__ClientSecret`, `ConnectionStrings__SqlDatabase`, `ApplicationInsights__ConnectionString`, and all `EmailSmtp__*` settings.

**Upgrade the API App Service plan to at least Basic B1** and enable Always On — background services (email reports, Teams alerts) stop when the app idles on the Free F1 tier.

---

### Option B — Manual re-deployment (existing environment)

#### Deploy Backend

```powershell
dotnet publish src/backend/NightWatch.Api/NightWatch.Api.csproj -c Release -o publish/api
Compress-Archive -Path publish/api/* -DestinationPath api.zip -Force
az webapp deploy --resource-group <resource-group> --name <api-app-name> --src-path api.zip --type zip
```

EF Core migrations run automatically on API startup.

#### Deploy Frontend

```powershell
cd src/frontend/nightwatch-web
npm run build
cd ../../..
Compress-Archive -Path src/frontend/nightwatch-web/dist/* -DestinationPath web.zip -Force
az webapp deploy --resource-group <resource-group> --name <web-app-name> --src-path web.zip --type zip
```

---

## Local Development

### Option A — Docker (recommended, no local toolchain required)

Prerequisites: Docker Desktop

```bash
docker compose up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API      | http://localhost:5000 |
| Swagger  | http://localhost:5000/swagger |
| SQL      | localhost:1433 · `sa` / `NightWatch_Dev123!` |

The API runs with `DevBypassAuthHandler` (no Azure AD login needed) and `DemoMode=true` (synthetic data, no live Azure credentials required). EF Core migrations are applied automatically; SQL Server takes ~30 seconds to initialise on first run.

### Option B — Without Docker

#### Prerequisites
- .NET 8 SDK
- Node.js 20+
- SQL Server LocalDB (included with Visual Studio) or a local SQL Server instance

### Backend

```powershell
dotnet run --project src/backend/NightWatch.Api/NightWatch.Api.csproj
```

`DevBypassAuthHandler` bypasses all authentication in Development mode. The API auto-applies EF Core migrations to LocalDB on startup. Edit `appsettings.Development.json` to set subscription IDs and a Log Analytics workspace for live Azure data.

### Frontend

```powershell
cd src/frontend/nightwatch-web
npm install
npm run dev   # http://localhost:5173
```

MSAL is disabled in Development — no login prompt appears.

---

## Adding a Customer Tenant

1. Navigate to **Tenants** and click **Add Tenant**
2. Enter the customer's Azure AD tenant ID and display name
3. Click **Send Admin Consent Link** — generates a URL using the NightWatch MSP app registration
4. Send that URL to a Global Administrator at the customer organisation
5. After they consent, click **Verify Consent** to confirm the service principal exists in their tenant
6. Click **Verify RBAC** to check which subscriptions the NightWatch service principal can access
7. Assign the **Reader** role on relevant subscriptions to the NightWatch MSP service principal if missing
8. The tenant becomes active and all dashboards start populating
9. Optionally configure a report schedule at `/report-schedule` after switching to that tenant

---

## Teams Notifications

Per-tenant configuration at **Settings → Teams**:
- **Webhook URL** — Power Automate Workflows incoming webhook
- **Daily report** — scheduled HTML executive summary sent once per day
- **Threshold alerts** — real-time messages on critical security/cost breaches
- **Customer Name** — used as the MSP branding name in email subjects and PDF headers

> The legacy Teams "Incoming Webhooks" connector was retired December 31, 2025. Only **Power Automate Workflows** webhook URLs work.

**Reliable delivery requires Always On:** Background services only run while the App Service is alive. Upgrade the API plan to at least **Basic B1** and enable Always On.

---

## AI Executive Summary

Optional. Configure in **Settings → AI Target**:

| Provider | Required fields |
|---|---|
| Azure OpenAI | Endpoint URL, deployment/model name, API key |
| Anthropic Claude | API key, model name (e.g. `claude-sonnet-4-6`) |

Token usage and estimated cost (USD) are tracked per calendar month in `GlobalOperationsConfig`. The summary is included in PDF/HTML exports and scheduled email reports (when "Include AI summary" is enabled on the report schedule). It can be toggled per user on the executive dashboard.
