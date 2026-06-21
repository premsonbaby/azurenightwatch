# NightWatch Frontend

React 19 SPA built with Vite, TypeScript, and Tailwind CSS.

## Stack

| | |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 2 |
| Routing | React Router 7 |
| Auth | MSAL React 3 (`@azure/msal-react`) |
| Drag-and-drop | dnd-kit |
| PDF export | jsPDF |

## Development

```powershell
npm install
npm run dev   # http://localhost:5173
```

MSAL is disabled in development — no Azure AD login prompt appears.

## Build

```powershell
npm run build   # outputs to dist/
```

## Key Directories

| Path | Description |
|---|---|
| `src/auth/` | MSAL initialisation, `getApiBaseUrl()`, MSP auth check |
| `src/api/client.ts` | Typed API client for all backend endpoints |
| `src/pages/` | One file per dashboard/detail page |
| `src/components/` | Shared components (DashboardPicker, DashboardState, etc.) |
| `src/types/dashboard.ts` | TypeScript interfaces for all API response shapes |
| `src/context/` | TenantContext — active tenant state |
| `src/utils/` | Layout persistence, report generation helpers |

See the [root README](../../README.md) for full deployment and architecture details.
