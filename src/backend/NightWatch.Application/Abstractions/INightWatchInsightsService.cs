using NightWatch.Application.Contracts;

namespace NightWatch.Application.Abstractions;

public interface INightWatchInsightsService
{
    Task<ExecutiveDashboardDto> GetExecutiveDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<NetworkTopologyDashboardDto> GetNetworkTopologyDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<SecurityDashboardDto> GetSecurityDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<PerformanceDashboardDto> GetPerformanceDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<CostDashboardDto> GetCostDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<GovernanceDashboardDto> GetGovernanceDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<SmartFeaturesDto> GetSmartFeaturesAsync(string tenantId, CancellationToken cancellationToken);
    Task<IntegrationCatalogDto> GetIntegrationCatalogAsync(CancellationToken cancellationToken);
    Task<IReadOnlyCollection<TenantOverviewDto>> GetTenantOverviewAsync(CancellationToken cancellationToken);
    Task<CapacityPlanningDashboardDto> GetCapacityPlanningDashboardAsync(string tenantId, string timeRange, CancellationToken cancellationToken);
    Task<CostAnomalyForecastDashboardDto> GetCostAnomalyForecastDashboardAsync(string tenantId, string timeRange, CancellationToken cancellationToken);
    Task<DrDashboardDto> GetDrDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<StrategicDashboardDto> GetStrategicDashboardAsync(string dashboardKey, string tenantId, CancellationToken cancellationToken);
    Task<ResourceDeepDiveDto> GetResourceDeepDiveAsync(string resourceId, string tenantId, CancellationToken cancellationToken);
    Task<QuickWinsDashboardDto> GetQuickWinsDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<TopCostlyResourcesDashboardDto> GetTopCostlyResourcesDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<TagHygieneDashboardDto> GetTagHygieneDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<OrphanedResourcesDashboardDto> GetOrphanedResourcesDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<BackupHealthDashboardDto> GetBackupHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<IamReviewDashboardDto> GetIamReviewDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<WastageTrackerDashboardDto> GetWastageTrackerDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<NetworkPerimeterDashboardDto> GetNetworkPerimeterDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<NonProdUptimeDashboardDto> GetNonProdUptimeDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<RiSavingsDashboardDto> GetRiSavingsDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<AppFunctionsHealthDashboardDto> GetAppFunctionsHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<AzPolicyLensDashboardDto> GetAzPolicyLensDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<DatabaseHealthDashboardDto> GetDatabaseHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<KeyVaultHealthDashboardDto> GetKeyVaultHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<AksContainerHealthDashboardDto> GetAksContainerHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<StorageComplianceDashboardDto> GetStorageComplianceDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<ServiceHealthDashboardDto> GetServiceHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<ManagedIdentityAuditDashboardDto> GetManagedIdentityAuditDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<AdvisorScoreDashboardDto> GetAdvisorScoreDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<MessagingHealthDashboardDto> GetMessagingHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<SupportTicketDashboardDto> GetSupportTicketDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<VmssHealthDashboardDto> GetVmssHealthDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<AlertsDashboardDto> GetAlertsDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<ExpressRouteDashboardDto> GetExpressRouteDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<VwanDashboardDto> GetVwanDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<AzureFirewallDashboardDto> GetAzureFirewallDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<AppGatewayDashboardDto> GetAppGatewayDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<VpnGatewayDashboardDto> GetVpnGatewayDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<IdentityAttackSurfaceDashboardDto> GetIdentityAttackSurfaceDashboardAsync(string tenantId, CancellationToken cancellationToken);
    Task<SubscriptionCostDashboardDto> GetSubscriptionCostDashboardAsync(string tenantId, int months, CancellationToken cancellationToken);
}
