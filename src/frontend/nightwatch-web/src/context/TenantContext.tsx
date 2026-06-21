import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { setActiveTenantId } from '../api/client';

interface TenantContextValue {
  activeTenantId: string;
  activeTenantName: string;
  switchTenant: (tenantId: string, displayName: string) => void;
  isHomeTenant: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

const HOME_TENANT_ID = 'global';
const STORAGE_KEY = 'nightwatch:active-tenant';

function readPersistedTenant(): { id: string; name: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { id: HOME_TENANT_ID, name: 'Home Tenant' };
    const parsed = JSON.parse(raw) as { id?: string; name?: string };
    if (parsed.id && parsed.name) return { id: parsed.id, name: parsed.name };
  } catch { /* ignore */ }
  return { id: HOME_TENANT_ID, name: 'Home Tenant' };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const persisted = readPersistedTenant();
  const [activeTenantId, setActiveTenantIdState] = useState<string>(() => {
    setActiveTenantId(persisted.id);
    return persisted.id;
  });
  const [activeTenantName, setActiveTenantName] = useState<string>(persisted.name);

  const switchTenant = useCallback((tenantId: string, displayName: string) => {
    setActiveTenantIdState(tenantId);
    setActiveTenantName(displayName);
    setActiveTenantId(tenantId);
    if (tenantId === HOME_TENANT_ID) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: tenantId, name: displayName }));
    }
  }, []);

  return (
    <TenantContext.Provider value={{
      activeTenantId,
      activeTenantName,
      switchTenant,
      isHomeTenant: activeTenantId === HOME_TENANT_ID,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider');
  return ctx;
}
