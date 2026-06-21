import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { getMsalInstance, getApiScopes, isMsalEnabled } from './authConfig';

let redirectInFlight = false;
let tokenRequestInFlight: Promise<string | null> | null = null;
const SILENT_TOKEN_TIMEOUT_MS = 10_000;
const REDIRECT_THROTTLE_MS = 60_000;
const LAST_REDIRECT_TS_KEY = 'nightwatch:lastRedirectTs';

function canAttemptRedirect(): boolean {
  try {
    const lastRedirectRaw = sessionStorage.getItem(LAST_REDIRECT_TS_KEY);
    const lastRedirect = lastRedirectRaw ? Number(lastRedirectRaw) : 0;
    if (Number.isFinite(lastRedirect) && Date.now() - lastRedirect < REDIRECT_THROTTLE_MS) {
      return false;
    }

    // Prevent redirect loops when Entra sent back an auth error in the hash/query.
    const hash = window.location.hash || '';
    const query = window.location.search || '';
    if (hash.includes('error=') || query.includes('error=')) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

function markRedirectAttempt(): void {
  try {
    sessionStorage.setItem(LAST_REDIRECT_TS_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures and continue.
  }
}

/**
 * Called when the API returns 401. Redirects to login if not already redirecting,
 * respecting the throttle to prevent redirect loops.
 */
export function handleApiUnauthorized(): void {
  if (!isMsalEnabled()) return;
  const msal = getMsalInstance();
  if (!msal) return;
  if (redirectInFlight || !canAttemptRedirect()) return;
  try {
    redirectInFlight = true;
    markRedirectAttempt();
    const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
    if (account) {
      void msal.acquireTokenRedirect({ scopes: getApiScopes(), account });
    } else {
      void msal.loginRedirect({ scopes: getApiScopes() });
    }
  } catch {
    redirectInFlight = false;
  }
}

/**
 * Silently acquires a Bearer token for the NightWatch API.
 * Returns null in dev mode (DevBypassAuthHandler handles auth server-side).
 * Triggers an interactive redirect if the silent request fails.
 */
export async function acquireApiToken(): Promise<string | null> {
  if (tokenRequestInFlight) {
    return tokenRequestInFlight;
  }

  tokenRequestInFlight = acquireApiTokenInternal();

  try {
    return await tokenRequestInFlight;
  } finally {
    tokenRequestInFlight = null;
  }
}

async function acquireApiTokenInternal(): Promise<string | null> {
  if (!isMsalEnabled()) return null;

  const msal = getMsalInstance();
  if (!msal) return null;

  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (!account) {
    if (!redirectInFlight && canAttemptRedirect()) {
      redirectInFlight = true;
      markRedirectAttempt();
      void msal.loginRedirect({ scopes: getApiScopes() });
    }
    return null;
  }

  try {
    const result = await Promise.race([
      msal.acquireTokenSilent({
        scopes: getApiScopes(),
        account,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('silent_token_timeout')), SILENT_TOKEN_TIMEOUT_MS);
      }),
    ]);
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      if (!redirectInFlight && canAttemptRedirect()) {
        redirectInFlight = true;
        markRedirectAttempt();
        void msal.acquireTokenRedirect({ scopes: getApiScopes() });
      }
    }
    return null;
  }
}
