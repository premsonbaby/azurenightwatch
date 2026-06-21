export interface CustomerTenant {
  id: number;
  tenantId: string;
  displayName: string;
  isActive: boolean;
  addedAt: string;
  lastVerifiedAt: string | null;
  logAnalyticsWorkspaceId: string | null;
  monthlyBudgetLimit: number | null;
  hasTeamsWebhook: boolean;
}

export interface AddTenantRequest {
  tenantId: string;
  displayName: string;
}

export interface UpdateTenantSettingsRequest {
  logAnalyticsWorkspaceId?: string | null;
  monthlyBudgetLimit?: number | null;
  teamsWebhookUrl?: string | null;
}

export interface LogAnalyticsWorkspace {
  workspaceId: string;
  name: string;
  resourceGroup: string;
  subscriptionId: string;
}
