import { useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface NavCommand {
  label: string;
  to: string;
  group: string;
  keywords?: string;
}

const COMMANDS: NavCommand[] = [
  // Core Dashboards
  { label: 'Executive Dashboard', to: '/', group: 'Dashboards', keywords: 'home overview summary scores kpi' },
  { label: 'Security Dashboard', to: '/security', group: 'Dashboards', keywords: 'defender nsg threats vulnerabilities findings' },
  { label: 'Performance Dashboard', to: '/performance', group: 'Dashboards', keywords: 'cpu fragility reliability health metrics' },
  { label: 'Cost Dashboard', to: '/cost', group: 'Dashboards', keywords: 'spend budget anomaly savings optimization' },
  { label: 'Capacity Planning', to: '/capacity-planning', group: 'Dashboards', keywords: 'runway growth forecast resources' },
  { label: 'Governance Dashboard', to: '/governance', group: 'Dashboards', keywords: 'compliance policy tags naming wall of shame' },
  { label: 'Intelligence Dashboard', to: '/intelligence', group: 'Dashboards', keywords: 'insights timeline ai operational changes' },
  { label: 'MSP Dashboard', to: '/msp', group: 'Dashboards', keywords: 'multi tenant heatmap customers' },
  { label: 'Exec Cost ROI (Strategic)', to: '/executive-cost-roi', group: 'Dashboards', keywords: 'strategic roadmap long-term planning roi' },

  // Cost & Savings
  { label: 'Quick Wins', to: '/quick-wins', group: 'Cost & Savings', keywords: 'orphaned savings easy cost optimization' },
  { label: 'RI Savings', to: '/ri-savings', group: 'Cost & Savings', keywords: 'reserved instances commitments savings plan' },
  { label: 'Wastage Tracker', to: '/wastage-tracker', group: 'Cost & Savings', keywords: 'unused idle orphaned cost waste' },
  { label: 'Spend Anomaly', to: '/spend-anomaly', group: 'Cost & Savings', keywords: 'cost spike anomaly forecast alerts' },
  { label: 'Top Costly Resources', to: '/top-costly-resources', group: 'Cost & Savings', keywords: 'expensive resources cost top billing' },
  { label: 'Subscription Cost', to: '/subscription-cost', group: 'Cost & Savings', keywords: 'billing subscription breakdown' },
  { label: 'Exec Cost ROI', to: '/executive-cost-roi', group: 'Cost & Savings', keywords: 'executive cost roi return investment' },
  { label: 'Cost Allocation', to: '/cost-allocation', group: 'Cost & Savings', keywords: 'chargeback allocation business unit' },
  { label: 'Non-Prod Uptime Leakage', to: '/nonprod-uptime-leakage', group: 'Cost & Savings', keywords: 'dev test staging running hours waste' },

  // Security & Identity
  { label: 'IAM Review', to: '/iam-review', group: 'Security & Identity', keywords: 'access identity role assignment rbac permissions' },
  { label: 'Network Perimeter', to: '/network-perimeter', group: 'Security & Identity', keywords: 'nsg firewall exposure public ip security' },
  { label: 'Identity Attack Surface', to: '/identity-attack-surface', group: 'Security & Identity', keywords: 'privileged access entra identity attack' },
  { label: 'Managed Identity Audit', to: '/managed-identity-audit', group: 'Security & Identity', keywords: 'managed identity service principal audit' },
  { label: 'Azure Policy Lens', to: '/policy-radar', group: 'Security & Identity', keywords: 'policy compliance audit deny regulatory' },

  // Reliability & Operations
  { label: 'Backup Health', to: '/backup-health', group: 'Reliability', keywords: 'backup recovery rsv protection vault jobs' },
  { label: 'DR Recoverability', to: '/dr-recoverability', group: 'Reliability', keywords: 'disaster recovery rpo rto failover' },
  { label: 'Service Health', to: '/service-health', group: 'Reliability', keywords: 'azure outages incidents service health status' },
  { label: 'Alerts Dashboard', to: '/alerts', group: 'Reliability', keywords: 'alert monitor threshold breach notifications' },
  { label: 'Advisor Score', to: '/advisor-score', group: 'Reliability', keywords: 'azure advisor recommendations score' },

  // Resource Health
  { label: 'Orphaned Resources', to: '/orphaned-resources', group: 'Resources', keywords: 'unused disk nic public ip orphaned detached' },
  { label: 'Tag Hygiene', to: '/tag-hygiene-compliance', group: 'Resources', keywords: 'tags tagging compliance governance metadata' },
  { label: 'Database Health', to: '/database-health', group: 'Resources', keywords: 'sql database server health performance' },
  { label: 'Key Vault Health', to: '/key-vault-health', group: 'Resources', keywords: 'key vault secrets certificates expiry' },
  { label: 'AKS & Containers', to: '/aks-container-health', group: 'Resources', keywords: 'kubernetes aks containers pods health' },
  { label: 'Storage Compliance', to: '/storage-compliance', group: 'Resources', keywords: 'storage blobs https compliance access' },
  { label: 'VMSS Health', to: '/vmss-health', group: 'Resources', keywords: 'virtual machine scale set autoscale health' },
  { label: 'App & Functions Health', to: '/app-service-health', group: 'Resources', keywords: 'azure functions serverless app health' },
  { label: 'Messaging Health', to: '/messaging-health', group: 'Resources', keywords: 'service bus event hub queue messaging' },

  // Networking
  { label: 'Network Topology', to: '/network-topology', group: 'Networking', keywords: 'vnet peering topology map network diagram' },
  { label: 'Express Route', to: '/expressroute', group: 'Networking', keywords: 'expressroute circuit bgp connectivity' },
  { label: 'VWAN', to: '/vwan', group: 'Networking', keywords: 'virtual wan hub connectivity' },
  { label: 'App Gateway', to: '/app-gateway', group: 'Networking', keywords: 'application gateway waf ingress routing' },
  { label: 'VPN Gateway', to: '/vpn-gateway', group: 'Networking', keywords: 'vpn gateway p2s s2s connectivity' },
  { label: 'Azure Firewall', to: '/azure-firewall', group: 'Networking', keywords: 'firewall rules dnat snat security' },

  // Reports & Settings
  { label: 'Azure Changes', to: '/azure-changes', group: 'Reports & Settings', keywords: 'changes modifications history audit log' },
  { label: 'Monthly Review', to: '/monthly-review', group: 'Reports & Settings', keywords: 'monthly review report summary pdf' },
  { label: 'Report Schedule', to: '/report-schedule', group: 'Reports & Settings', keywords: 'scheduled email report automation' },
  { label: 'Report History', to: '/report-history', group: 'Reports & Settings', keywords: 'sent reports history logs archive' },
  { label: 'Score History', to: '/score-history', group: 'Reports & Settings', keywords: 'historical scores trends over time' },
  { label: 'Alert Thresholds', to: '/alert-thresholds', group: 'Reports & Settings', keywords: 'threshold notifications webhooks email' },
  { label: 'Alerts Digest', to: '/alerts-digest', group: 'Reports & Settings', keywords: 'digest summary breaches notifications' },
  { label: 'Audit Log', to: '/audit-log', group: 'Reports & Settings', keywords: 'audit log activity user actions history' },
  { label: 'Tenants', to: '/tenants', group: 'Reports & Settings', keywords: 'customer tenants manage registered' },
  { label: 'Operations Settings', to: '/settings/operations', group: 'Reports & Settings', keywords: 'settings config scope subscriptions workspace' },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl mx-4 rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        <Command className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <Command.Input
              autoFocus
              placeholder="Search dashboards and pages…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            />
            <kbd className="hidden text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 sm:inline">ESC</kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-500">
            <Command.Empty className="py-8 text-center text-sm text-slate-500">
              No pages found.
            </Command.Empty>

            {Object.entries(
              COMMANDS.reduce<Record<string, NavCommand[]>>((acc, cmd) => {
                (acc[cmd.group] ??= []).push(cmd);
                return acc;
              }, {})
            ).map(([group, items]) => (
              <Command.Group key={group} heading={group}>
                {items.map((item) => (
                  <Command.Item
                    key={item.to}
                    value={`${item.label} ${item.keywords ?? ''}`}
                    onSelect={() => handleSelect(item.to)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 aria-selected:bg-slate-800 aria-selected:text-cyan-100"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="border-t border-white/10 px-4 py-2 flex items-center gap-4 text-[10px] text-slate-600">
            <span><kbd className="border border-slate-700 rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd className="border border-slate-700 rounded px-1">↵</kbd> open</span>
            <span><kbd className="border border-slate-700 rounded px-1">ESC</kbd> close</span>
            <span className="ml-auto">Ctrl+K to reopen</span>
          </div>
        </Command>
      </div>
    </div>,
    document.body
  );
}
