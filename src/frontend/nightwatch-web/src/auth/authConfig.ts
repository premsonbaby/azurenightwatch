import { PublicClientApplication, LogLevel } from '@azure/msal-browser';
import type { Configuration, IPublicClientApplication } from '@azure/msal-browser';

export interface AppAuthConfig {
  tenantId: string;
  clientId: string;
  apiScope?: string;
  msalEnabled: boolean;
}

let _msalInstance: IPublicClientApplication | null = null;
let _apiScopes: string[] = [];
let _msalEnabled = false;
let _mspTenantGuid = '';
let _apiBaseUrl = '';

/**
 * Calls the Azure AD OIDC discovery endpoint to resolve any tenant identifier
 * (domain name, GUID, or alias) to its canonical tenant GUID.
 */
async function resolveTenantGuid(tenantId: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
    );
    if (!resp.ok) return '';
    const data = await resp.json();
    // issuer: "https://login.microsoftonline.com/{guid}/v2.0"
    const match = (data.issuer as string | undefined)?.match(
      /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/v2\.0/i,
    );
    return match?.[1] ?? '';
  } catch {
    return '';
  }
}

/**
 * Fetches public auth config from the API and initialises MSAL if required.
 * Must be awaited before rendering the React tree.
 */
export async function initAuth(apiBaseUrl: string): Promise<void> {
  _apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  try {
    const resp = await fetch(`${_apiBaseUrl}/api/config`);
    if (!resp.ok) return;

    const config: AppAuthConfig = await resp.json();
    _msalEnabled = config.msalEnabled && Boolean(config.clientId) && Boolean(config.tenantId);

    if (!_msalEnabled) return;

    // Resolve the MSP tenant GUID before any auth check so we can verify
    // that authenticated users actually belong to the MSP tenant.
    const tenantId = config.tenantId?.trim() ?? '';
    const isSpecificTenant = tenantId && tenantId !== 'common' && tenantId !== 'organizations';
    if (isSpecificTenant) {
      _mspTenantGuid = await resolveTenantGuid(tenantId);
    }

    const msalConfig: Configuration = {
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Warning,
          piiLoggingEnabled: false,
        },
      },
    };

    const resolvedApiScope = config.apiScope?.trim() || `api://${config.clientId}/user_impersonation`;
    _apiScopes = [resolvedApiScope];
    _msalInstance = new PublicClientApplication(msalConfig);
    await _msalInstance.initialize();

    // Ensure redirect responses are processed before any token/account checks.
    const redirectResult = await _msalInstance.handleRedirectPromise();
    if (redirectResult?.account) {
      _msalInstance.setActiveAccount(redirectResult.account);
      return;
    }

    const existingAccount = _msalInstance.getActiveAccount() ?? _msalInstance.getAllAccounts()[0] ?? null;
    if (existingAccount) {
      _msalInstance.setActiveAccount(existingAccount);
    }
  } catch {
    // Auth is non-blocking — app still works in dev without credentials.
  }
}

export function getMsalInstance(): IPublicClientApplication | null {
  return _msalInstance;
}

export function isMsalEnabled(): boolean {
  return _msalEnabled;
}

export function getApiScopes(): string[] {
  return _apiScopes;
}

export function getMspTenantGuid(): string {
  return _mspTenantGuid;
}

export function getApiBaseUrl(): string {
  return _apiBaseUrl;
}
