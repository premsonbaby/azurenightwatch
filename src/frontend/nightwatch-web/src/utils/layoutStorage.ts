import { getMsalInstance, isMsalEnabled } from '../auth/authConfig';

function getUserKey(): string {
    if (!isMsalEnabled()) return 'dev';
    try {
        const msal = getMsalInstance();
        if (!msal) return 'anon';
        const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
        return account?.localAccountId ?? account?.homeAccountId ?? 'anon';
    } catch {
        return 'anon';
    }
}

function storageKey(): string {
    return `nightwatch:exec-layout:${getUserKey()}`;
}

export function loadLayoutFromStorage(): string[] | null {
    try {
        const raw = localStorage.getItem(storageKey());
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as string[]) : null;
    } catch {
        return null;
    }
}

export function saveLayoutToStorage(keys: string[]): void {
    try {
        localStorage.setItem(storageKey(), JSON.stringify(keys));
    } catch {
        // Ignore storage quota errors.
    }
}

function changesTimeRangeKey(): string {
    return `nightwatch:changes-time-range:${getUserKey()}`;
}

export function loadChangesTimeRangeFromStorage(): 'today' | '2days' | '1week' | null {
    try {
        const raw = localStorage.getItem(changesTimeRangeKey());
        if (raw === 'today' || raw === '2days' || raw === '1week') return raw;
        return null;
    } catch {
        return null;
    }
}

export function saveChangesTimeRangeToStorage(range: 'today' | '2days' | '1week'): void {
    try {
        localStorage.setItem(changesTimeRangeKey(), range);
    } catch {
        // Ignore storage quota errors.
    }
}

function spendAnomalyTimeRangeKey(): string {
    return `nightwatch:spend-anomaly-time-range:${getUserKey()}`;
}

export function loadSpendAnomalyTimeRangeFromStorage(): '7d' | '30d' | '90d' | null {
    try {
        const raw = localStorage.getItem(spendAnomalyTimeRangeKey());
        if (raw === '7d' || raw === '30d' || raw === '90d') return raw;
        return null;
    } catch {
        return null;
    }
}

export function saveSpendAnomalyTimeRangeToStorage(range: '7d' | '30d' | '90d'): void {
    try {
        localStorage.setItem(spendAnomalyTimeRangeKey(), range);
    } catch {
        // Ignore storage quota errors.
    }
}

function capacityPlanningTimeRangeKey(): string {
    return `nightwatch:capacity-planning-time-range:${getUserKey()}`;
}

export function loadCapacityPlanningTimeRangeFromStorage(): '7d' | '30d' | '90d' | null {
    try {
        const raw = localStorage.getItem(capacityPlanningTimeRangeKey());
        if (raw === '7d' || raw === '30d' || raw === '90d') return raw;
        return null;
    } catch {
        return null;
    }
}

export function saveCapacityPlanningTimeRangeToStorage(range: '7d' | '30d' | '90d'): void {
    try {
        localStorage.setItem(capacityPlanningTimeRangeKey(), range);
    } catch {
        // Ignore storage quota errors.
    }
}

function widgetWidthsKey(): string {
    return `nightwatch:widget-widths:${getUserKey()}`;
}

export function loadWidgetWidthsFromStorage(): Record<string, 'full' | 'half'> {
    try {
        const raw = localStorage.getItem(widgetWidthsKey());
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, 'full' | 'half'>;
        }
        return {};
    } catch {
        return {};
    }
}

export function saveWidgetWidthsToStorage(widths: Record<string, 'full' | 'half'>): void {
    try {
        localStorage.setItem(widgetWidthsKey(), JSON.stringify(widths));
    } catch {
        // Ignore storage quota errors.
    }
}
