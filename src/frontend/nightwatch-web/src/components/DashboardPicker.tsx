import { useMemo, useState } from 'react';

export interface DashboardPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

interface DashboardOption {
  key: string;
  label: string;
  group: 'Core' | 'Operations' | 'Security & Compliance' | 'Platform & Data' | 'Networking';
}

export const dashboardOptions: DashboardOption[] = [
  { key: 'azureHealth', label: 'Azure Overall Health', group: 'Core' },
  { key: 'security', label: 'Security Intelligence', group: 'Core' },
  { key: 'performance', label: 'Performance', group: 'Core' },
  { key: 'cost', label: 'Cost Optimization', group: 'Core' },
  { key: 'dailyCostAnalysis', label: 'Daily Cost Analysis', group: 'Core' },
  { key: 'governance', label: 'Governance', group: 'Core' },
  { key: 'reliability', label: 'Reliability', group: 'Core' },

  { key: 'capacity-planning', label: 'Capacity Planning', group: 'Operations' },
  { key: 'wastage-tracker', label: 'Wastage Tracker', group: 'Operations' },
  { key: 'ri-savings', label: 'RI & Savings', group: 'Operations' },
  { key: 'nonprod-uptime-leakage', label: 'Non-Prod Uptime', group: 'Operations' },
  { key: 'spend-anomaly', label: 'Spend Anomaly & Forecast', group: 'Operations' },
  { key: 'network-topology', label: 'Network Topology', group: 'Operations' },
  { key: 'top-costly-resources', label: 'Top Costly Resources', group: 'Operations' },
  { key: 'subscription-cost', label: 'Subscription Cost', group: 'Operations' },
  { key: 'insight-feed', label: 'Operational Intelligence', group: 'Operations' },
  { key: 'azure-changes', label: 'Azure Change Activity', group: 'Operations' },

  { key: 'security-blast-radius', label: 'Security Blast Radius', group: 'Security & Compliance' },
  { key: 'iam-review', label: 'IAM Review', group: 'Security & Compliance' },
  { key: 'tag-hygiene-compliance', label: 'Tag Hygiene', group: 'Security & Compliance' },
  { key: 'network-perimeter', label: 'Network Perimeter', group: 'Security & Compliance' },
  { key: 'backup-health', label: 'Backup Health', group: 'Security & Compliance' },
  { key: 'orphaned-resources', label: 'Orphaned Resources', group: 'Security & Compliance' },
  { key: 'dr-recoverability', label: 'Disaster Recoverability', group: 'Security & Compliance' },

  { key: 'app-functions-health', label: 'App Service Health', group: 'Platform & Data' },
  { key: 'policy-radar', label: 'Policy Radar', group: 'Security & Compliance' },

  { key: 'database-health', label: 'Database Health', group: 'Platform & Data' },
  { key: 'aks-container-health', label: 'AKS & Container Health', group: 'Platform & Data' },
  { key: 'messaging-health', label: 'Messaging Health', group: 'Platform & Data' },
  { key: 'vmss-health', label: 'VMSS Health', group: 'Platform & Data' },
  { key: 'key-vault-health', label: 'Key Vault Health', group: 'Security & Compliance' },
  { key: 'storage-compliance', label: 'Storage Compliance', group: 'Security & Compliance' },
  { key: 'identity-attack-surface', label: 'Identity Attack Surface', group: 'Security & Compliance' },
  { key: 'managed-identity-audit', label: 'Managed Identity Audit', group: 'Security & Compliance' },
  { key: 'advisor-score', label: 'Advisor Score', group: 'Operations' },
  { key: 'service-health', label: 'Azure Service Health', group: 'Operations' },
  { key: 'support-tickets', label: 'Support Ticket Tracker', group: 'Operations' },
  { key: 'alerts', label: 'Azure Monitor Alerts', group: 'Operations' },
  { key: 'expressroute', label: 'Express Route', group: 'Networking' },
  { key: 'vwan', label: 'Virtual WAN', group: 'Networking' },
  { key: 'azure-firewall', label: 'Azure Firewall', group: 'Networking' },
  { key: 'app-gateway', label: 'Application Gateway', group: 'Networking' },
  { key: 'vpn-gateway', label: 'VPN Gateway', group: 'Networking' },
];

const VALID_KEYS = new Set(dashboardOptions.map((d) => d.key));

export function DashboardPicker({ value, onChange }: DashboardPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedCount = value.filter((k) => VALID_KEYS.has(k)).length;

  const visibleDashboards = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return dashboardOptions;
    }

    return dashboardOptions.filter((item) => item.label.toLowerCase().includes(term));
  }, [search]);

  const groupedDashboards = useMemo(() => {
    const groups: Array<{ name: DashboardOption['group']; items: DashboardOption[] }> = [
      { name: 'Core', items: [] },
      { name: 'Operations', items: [] },
      { name: 'Security & Compliance', items: [] },
      { name: 'Platform & Data', items: [] },
      { name: 'Networking', items: [] },
    ];

    for (const item of visibleDashboards) {
      const group = groups.find((entry) => entry.name === item.group);
      if (group) {
        group.items.push(item);
      }
    }

    return groups.filter((group) => group.items.length > 0);
  }, [visibleDashboards]);

  const handleToggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  };

  const handleSelectAllVisible = () => {
    const visibleKeys = visibleDashboards.map((item) => item.key);
    const next = new Set(value);
    for (const key of visibleKeys) {
      next.add(key);
    }
    onChange(Array.from(next));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-cyan-400/30 bg-slate-900 px-3 py-2 text-left text-sm text-slate-100"
      >
        <span>{selectedCount > 0 ? `${selectedCount} of ${dashboardOptions.length} selected` : 'Select dashboards'}</span>
        <span className="text-cyan-300">{isOpen ? 'Hide' : 'Show'}</span>
      </button>

      {isOpen ? (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-cyan-400/20 bg-slate-950 p-3 shadow-2xl">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Available Dashboards</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="rounded-md border border-cyan-400/30 px-2 py-1 text-xs font-semibold text-cyan-100"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-md border border-rose-400/30 px-2 py-1 text-xs font-semibold text-rose-100"
              >
                Clear All
              </button>
            </div>
          </div>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dashboards"
            className="mb-3 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />

          <div className="max-h-80 overflow-y-auto space-y-3">
            {groupedDashboards.length === 0 ? (
              <p className="text-sm text-slate-300">No dashboards found.</p>
            ) : (
              groupedDashboards.map((group) => (
                <div key={group.name}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{group.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((dashboard) => (
                      <label key={dashboard.key} className="flex cursor-pointer select-none items-center gap-2">
                        <input
                          type="checkbox"
                          checked={value.includes(dashboard.key)}
                          onChange={() => handleToggle(dashboard.key)}
                          className="accent-cyan-500"
                        />
                        <span className="text-sm text-slate-100">{dashboard.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
