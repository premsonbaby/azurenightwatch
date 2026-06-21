using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/aggregate")]
[Authorize(Policy = "TenantReader")]
public sealed class AggregateDashboardController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetAggregateDashboard(string tenantId, CancellationToken cancellationToken)
    {
        var tasks = new
        {
            Executive         = insightsService.GetExecutiveDashboardAsync(tenantId, cancellationToken),
            NetworkTopology   = insightsService.GetNetworkTopologyDashboardAsync(tenantId, cancellationToken),
            Security          = insightsService.GetSecurityDashboardAsync(tenantId, cancellationToken),
            Performance       = insightsService.GetPerformanceDashboardAsync(tenantId, cancellationToken),
            Cost              = insightsService.GetCostDashboardAsync(tenantId, cancellationToken),
            Governance        = insightsService.GetGovernanceDashboardAsync(tenantId, cancellationToken),
            Dr                = insightsService.GetDrDashboardAsync(tenantId, cancellationToken),
            TagHygiene        = insightsService.GetTagHygieneDashboardAsync(tenantId, cancellationToken),
            OrphanedResources = insightsService.GetOrphanedResourcesDashboardAsync(tenantId, cancellationToken),
            BackupHealth      = insightsService.GetBackupHealthDashboardAsync(tenantId, cancellationToken),
            IamReview         = insightsService.GetIamReviewDashboardAsync(tenantId, cancellationToken),
            WastageTracker    = insightsService.GetWastageTrackerDashboardAsync(tenantId, cancellationToken),
            NetworkPerimeter  = insightsService.GetNetworkPerimeterDashboardAsync(tenantId, cancellationToken),
            NonProdUptime     = insightsService.GetNonProdUptimeDashboardAsync(tenantId, cancellationToken),
            RiSavings         = insightsService.GetRiSavingsDashboardAsync(tenantId, cancellationToken),
            AppFunctionsHealth = insightsService.GetAppFunctionsHealthDashboardAsync(tenantId, cancellationToken),
            AzPolicyLens      = insightsService.GetAzPolicyLensDashboardAsync(tenantId, cancellationToken),
            DatabaseHealth    = insightsService.GetDatabaseHealthDashboardAsync(tenantId, cancellationToken),
            KeyVaultHealth    = insightsService.GetKeyVaultHealthDashboardAsync(tenantId, cancellationToken),
            AksContainerHealth = insightsService.GetAksContainerHealthDashboardAsync(tenantId, cancellationToken),
            StorageCompliance = insightsService.GetStorageComplianceDashboardAsync(tenantId, cancellationToken),
            ServiceHealth     = insightsService.GetServiceHealthDashboardAsync(tenantId, cancellationToken),
            ManagedIdentityAudit = insightsService.GetManagedIdentityAuditDashboardAsync(tenantId, cancellationToken),
            AdvisorScore      = insightsService.GetAdvisorScoreDashboardAsync(tenantId, cancellationToken),
            MessagingHealth   = insightsService.GetMessagingHealthDashboardAsync(tenantId, cancellationToken),
            SupportTickets    = insightsService.GetSupportTicketDashboardAsync(tenantId, cancellationToken),
            VmssHealth        = insightsService.GetVmssHealthDashboardAsync(tenantId, cancellationToken),
            Alerts            = insightsService.GetAlertsDashboardAsync(tenantId, cancellationToken),
            ExpressRoute      = insightsService.GetExpressRouteDashboardAsync(tenantId, cancellationToken),
            Vwan              = insightsService.GetVwanDashboardAsync(tenantId, cancellationToken),
            AzureFirewall     = insightsService.GetAzureFirewallDashboardAsync(tenantId, cancellationToken),
            AppGateway        = insightsService.GetAppGatewayDashboardAsync(tenantId, cancellationToken),
            VpnGateway        = insightsService.GetVpnGatewayDashboardAsync(tenantId, cancellationToken),
            IdentityAttackSurface = insightsService.GetIdentityAttackSurfaceDashboardAsync(tenantId, cancellationToken),
        };

        await Task.WhenAll(
            tasks.Executive, tasks.NetworkTopology, tasks.Security, tasks.Performance,
            tasks.Cost, tasks.Governance, tasks.Dr,
            tasks.TagHygiene, tasks.OrphanedResources, tasks.BackupHealth, tasks.IamReview,
            tasks.WastageTracker, tasks.NetworkPerimeter, tasks.NonProdUptime, tasks.RiSavings,
            tasks.AppFunctionsHealth, tasks.AzPolicyLens, tasks.DatabaseHealth, tasks.KeyVaultHealth,
            tasks.AksContainerHealth, tasks.StorageCompliance, tasks.ServiceHealth, tasks.ManagedIdentityAudit,
            tasks.AdvisorScore, tasks.MessagingHealth, tasks.SupportTickets, tasks.VmssHealth,
            tasks.Alerts, tasks.ExpressRoute, tasks.Vwan, tasks.AzureFirewall,
            tasks.AppGateway, tasks.VpnGateway, tasks.IdentityAttackSurface
        );

        return Ok(new
        {
            executive          = tasks.Executive.Result,
            networkTopology    = tasks.NetworkTopology.Result,
            security           = tasks.Security.Result,
            performance        = tasks.Performance.Result,
            cost               = tasks.Cost.Result,
            governance         = tasks.Governance.Result,
            dr                 = tasks.Dr.Result,
            topCostlyResources = (object?)null,
            tagHygiene         = tasks.TagHygiene.Result,
            orphanedResources  = tasks.OrphanedResources.Result,
            backupHealth       = tasks.BackupHealth.Result,
            iamReview          = tasks.IamReview.Result,
            wastageTracker     = tasks.WastageTracker.Result,
            networkPerimeter   = tasks.NetworkPerimeter.Result,
            nonProdUptime      = tasks.NonProdUptime.Result,
            riSavings          = tasks.RiSavings.Result,
            appFunctionsHealth = tasks.AppFunctionsHealth.Result,
            azPolicyLens       = tasks.AzPolicyLens.Result,
            databaseHealth     = tasks.DatabaseHealth.Result,
            keyVaultHealth     = tasks.KeyVaultHealth.Result,
            aksContainerHealth = tasks.AksContainerHealth.Result,
            storageCompliance  = tasks.StorageCompliance.Result,
            serviceHealth      = tasks.ServiceHealth.Result,
            managedIdentityAudit = tasks.ManagedIdentityAudit.Result,
            advisorScore       = tasks.AdvisorScore.Result,
            messagingHealth    = tasks.MessagingHealth.Result,
            supportTickets     = tasks.SupportTickets.Result,
            vmssHealth         = tasks.VmssHealth.Result,
            alerts             = tasks.Alerts.Result,
            expressRoute       = tasks.ExpressRoute.Result,
            vwan               = tasks.Vwan.Result,
            azureFirewall      = tasks.AzureFirewall.Result,
            appGateway         = tasks.AppGateway.Result,
            vpnGateway         = tasks.VpnGateway.Result,
            identityAttackSurface = tasks.IdentityAttackSurface.Result,
        });
    }
}
