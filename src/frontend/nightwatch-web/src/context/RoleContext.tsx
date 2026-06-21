import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { isMsalEnabled } from '../auth/authConfig';

export type NightWatchRole = 'NightWatch.Admin' | 'NightWatch.Operator' | 'NightWatch.Reader';

interface RoleContextValue {
  role: NightWatchRole;
  isOperator: boolean; // Admin or Operator — can change settings
  isAdmin: boolean;    // Admin only — user/tenant management
}

const RoleContext = createContext<RoleContextValue>({
  role: 'NightWatch.Reader',
  isOperator: false,
  isAdmin: false,
});

function RoleProviderInner({ children }: { children: ReactNode }) {
  const { instance } = useMsal();

  const value = useMemo((): RoleContextValue => {
    const account = instance.getActiveAccount();
    const claims = account?.idTokenClaims as Record<string, unknown> | undefined;
    const roles = Array.isArray(claims?.roles) ? (claims!.roles as string[]) : [];

    let role: NightWatchRole;
    if (roles.includes('NightWatch.Admin')) {
      role = 'NightWatch.Admin';
    } else if (roles.includes('NightWatch.Operator')) {
      role = 'NightWatch.Operator';
    } else if (roles.includes('NightWatch.Reader')) {
      role = 'NightWatch.Reader';
    } else {
      // No NightWatch role assigned — default to read-only access.
      role = 'NightWatch.Reader';
    }

    return {
      role,
      isOperator: role !== 'NightWatch.Reader',
      isAdmin: role === 'NightWatch.Admin',
    };
  }, [instance]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  if (!isMsalEnabled()) {
    return (
      <RoleContext.Provider value={{ role: 'NightWatch.Admin', isOperator: true, isAdmin: true }}>
        {children}
      </RoleContext.Provider>
    );
  }
  return <RoleProviderInner>{children}</RoleProviderInner>;
}

export const useRole = () => useContext(RoleContext);
