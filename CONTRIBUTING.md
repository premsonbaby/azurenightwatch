# Contributing to NightWatch

Thank you for your interest in contributing. This document covers how to get the project running locally and how to add new features.

---

## Quick start (demo mode — no Azure account required)

The fastest way to explore and contribute is with demo mode, which replaces all Azure API calls with realistic synthetic data.

**Prerequisites:** .NET 8 SDK, Node 20+, Git

```bash
# 1. Clone
git clone https://github.com/your-org/nightwatch.git
cd nightwatch

# 2. Start the API (demo mode is on by default in Development)
dotnet run --project src/backend/NightWatch.Api

# 3. In another terminal, start the frontend
cd src/frontend/nightwatch-web
npm install
npm run dev
```

Open http://localhost:5173 — no login, no Azure subscription needed.

### Or with docker-compose

```bash
docker compose up --build
```

Opens at http://localhost:5173.

---

## Quick start (real Azure data)

1. Register an app in Entra ID and grant it Reader + Cost Management Reader roles on your subscriptions.
2. Copy `appsettings.Example.json` → `appsettings.Production.json` and fill in the blanks.
3. Set `NightWatch:DemoMode` to `false` (or remove it).
4. Run `dotnet run --project src/backend/NightWatch.Api`.

---

## Architecture — how data flows

```
Browser (React SPA)
  │  HTTP + Bearer JWT
  ▼
NightWatch.Api (ASP.NET Core)
  │  Controller receives request
  ▼
NightWatch.Application
  INightWatchInsightsService.GetXxxDashboardAsync()
  │
  ▼
NightWatch.Infrastructure
  NightWatchInsightsService (partial classes per domain)
    │
    ├── CollectLiveSignalsAsync()     ← fires ~20 concurrent Azure API calls
    │     ├── IAzureResourceGraphClient  (ARG queries → resource counts)
    │     ├── IDefenderClient            (security assessments)
    │     ├── IAdvisorClient             (advisor recommendations)
    │     ├── ICostManagementClient      (90-day cost trend)
    │     └── IMonitorClient             (Log Analytics KQL)
    │
    └── Derives scores, insights, charts from LiveSignals
          → returns typed DTO to controller
          → serialised as JSON to the frontend
```

In **demo mode**, the five Azure clients are replaced with `Demo*` implementations in `NightWatch.Infrastructure/Services/Demo/` that return hardcoded realistic data. Everything else is identical.

---

## How to add a new dashboard

### 1. Backend — DTO + service method

Add a new record to `NightWatch.Application/Contracts/DashboardDtos.cs`:

```csharp
public sealed record MyDashboardDto(string Title, decimal Score, /* ... */);
```

Add the method to `INightWatchInsightsService`:

```csharp
Task<MyDashboardDto> GetMyDashboardAsync(string tenantId, CancellationToken cancellationToken);
```

Implement it in a new partial class `NightWatchInsightsService.MyDomain.cs` — derive values from `LiveSignals` (already collected) or make additional ARG queries.

### 2. Backend — controller

```csharp
[ApiController, Route("api/my-dashboard")]
public sealed class MyDashboardController(INightWatchInsightsService insights) : ControllerBase
{
    [HttpGet, Authorize("TenantReader")]
    public Task<IActionResult> Get(CancellationToken ct)
        => insights.GetMyDashboardAsync(User.GetTenantId(), ct)
               .ContinueWith(t => (IActionResult)Ok(t.Result), ct);
}
```

### 3. Frontend — type + client method

Add the TypeScript type to `src/frontend/nightwatch-web/src/types/dashboard.ts`:

```typescript
export interface MyDashboard { title: string; score: number; /* ... */ }
```

Add the client method to `src/frontend/nightwatch-web/src/api/client.ts`:

```typescript
async getMyDashboard(): Promise<MyDashboard> {
  return this.get<MyDashboard>('/api/my-dashboard');
}
```

### 4. Frontend — page + route

Create `src/frontend/nightwatch-web/src/pages/MyDashboardPage.tsx`.

Add a lazy import and route in `App.tsx`:

```tsx
const MyDashboardPage = lazy(() => import('./pages/MyDashboardPage').then(m => ({ default: m.MyDashboardPage })));
// ...
<Route path="/my-dashboard" element={<RouteErrorBoundary><Suspense fallback={<SkeletonDashboard />}><MyDashboardPage /></Suspense></RouteErrorBoundary>} />
```

Add an entry to `navItems` in `DashboardNav.tsx` and to `COMMANDS` in `CommandPalette.tsx`.

### 5. Demo data

Add a query pattern match in `DemoAzureResourceGraphClient.DispatchQuery()` if your dashboard needs new ARG queries.

---

## Project structure

```
src/
├── backend/
│   ├── NightWatch.Api/            — Controllers, middleware, startup, auth
│   ├── NightWatch.Application/    — Service interfaces, DTOs, recommendation engine
│   ├── NightWatch.Domain/         — Enums and domain models
│   └── NightWatch.Infrastructure/ — Azure API clients, EF Core, background services
│       └── Services/
│           ├── NightWatchInsightsService.*.cs  — one partial per domain
│           ├── Azure/             — Real Azure API clients
│           └── Demo/              — Fake clients for demo/dev mode
└── frontend/
    └── nightwatch-web/
        └── src/
            ├── api/               — Typed API client
            ├── components/        — Shared UI components
            ├── pages/             — One file per dashboard page
            └── types/             — TypeScript DTO types
```

---

## Code style

- **Backend:** C# 12, nullable enabled, file-scoped namespaces. No comments unless non-obvious.
- **Frontend:** React 19, TypeScript strict, Tailwind CSS 4. Avoid `any`. Export one component per file.
- **Tests:** The Playwright suite in `tests/` runs against `npm run preview` (built bundle). Run with `npx playwright test`.

---

## Pull request checklist

- [ ] New dashboard has a matching `Demo*` data path (or gracefully returns empty).
- [ ] `COMMANDS` in `CommandPalette.tsx` updated for any new route.
- [ ] `navItems` in `DashboardNav.tsx` updated.
- [ ] TypeScript compiles without errors: `npm run build`.
- [ ] Backend compiles: `dotnet build`.
