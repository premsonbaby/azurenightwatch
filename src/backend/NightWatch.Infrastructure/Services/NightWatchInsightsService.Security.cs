using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using NightWatch.Infrastructure.Abstractions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Text.Json;
using Azure.Identity;
using Azure.Security.KeyVault.Certificates;

namespace NightWatch.Infrastructure.Services;

public sealed partial class NightWatchInsightsService
{
    public async Task<SecurityDashboardDto> GetSecurityDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var liveSubscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var liveSignals = await CollectLiveSignalsAsync(liveSubscriptions, cancellationToken);
        var liveFindings = new List<SecurityFinding>();

        if (liveSignals.AnyAnyNsgCount > 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-anyany",
                "NSG Any/Any access detected",
                RiskLevel.Critical,
                "multi-subscription",
                $"{liveSignals.AnyAnyNsgCount} NSG rules allow unrestricted Any/Any access.",
                "Restrict source CIDRs and destination ports immediately."));
        }

        if (liveSignals.DefenderRecommendationCount > 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-defender",
                "Defender for Cloud recommendations detected",
                RiskLevel.High,
                "multi-subscription",
                $"{liveSignals.DefenderRecommendationCount} Defender findings are active across accessible subscriptions.",
                "Prioritize high-severity recommendations and validate secure-score controls."));
        }

        if (liveSignals.AbandonedPublicIpCount > 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-pips",
                "Abandoned public IP addresses detected",
                RiskLevel.Medium,
                "multi-subscription",
                $"{liveSignals.AbandonedPublicIpCount} public IPs are unattached and increase exposure footprint.",
                "Remove unused public IPs or attach them to governed workloads only."));
        }

        if (liveSignals.UntaggedResourceCount > 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-untagged",
                "Untagged resources detected",
                RiskLevel.Medium,
                "multi-subscription",
                $"{liveSignals.UntaggedResourceCount} resources are missing tags, weakening ownership and incident response workflows.",
                "Enforce mandatory tags through Azure Policy and remediation tasks."));
        }

        var unprotectedVmCount = liveSignals.VmCount > 0
            ? Math.Max(0, liveSignals.VmCount - liveSignals.BackupProtectedItemCount)
            : 0;

        if (unprotectedVmCount > 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-nobackup",
                "VMs without backup protection",
                RiskLevel.High,
                "multi-subscription",
                $"{unprotectedVmCount} of {liveSignals.VmCount} VMs have no Recovery Services backup coverage.",
                "Enable Azure Backup for all production VMs via Recovery Services vault policies."));
        }

        if (liveSubscriptions.Count == 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-nosubscriptions",
                "No subscriptions discovered",
                RiskLevel.Low,
                "tenant",
                "The managed identity could not enumerate any enabled subscriptions.",
                "Grant Reader access at subscription scope or configure AzureOperations:SubscriptionIds."));
        }
        else if (liveFindings.Count == 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-clear",
                "No critical security signals returned",
                RiskLevel.Low,
                "multi-subscription",
                "Configured live queries returned no current public exposure or Defender findings.",
                "Validate Defender, ARG, and RBAC permissions if this looks unexpected."));
        }

        var blastRadiusGraph = BuildSecurityBlastRadiusGraph(liveSubscriptions, liveSignals);

        var (certExpired, certExpiring30, certTotal, certVaultCount, certMetricStatus, certMetricDesc) =
            await GetCertificateExpiryMetricAsync(liveSubscriptions, cancellationToken);

        if (certExpired > 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-certexpired",
                $"{certExpired} expired certificate{(certExpired == 1 ? "" : "s")} detected in Key Vaults",
                RiskLevel.High,
                "multi-subscription",
                $"{certExpired} certificate{(certExpired == 1 ? " has" : "s have")} passed their expiry date across {certVaultCount} Key Vault{(certVaultCount == 1 ? "" : "s")}.",
                "Rotate or remove expired certificates immediately to prevent service outages and trust failures."));
        }

        if (certExpiring30 > 0)
        {
            liveFindings.Add(new SecurityFinding(
                "sec-live-certexpiring",
                $"{certExpiring30} certificate{(certExpiring30 == 1 ? "" : "s")} expiring within 30 days",
                RiskLevel.Medium,
                "multi-subscription",
                $"{certExpiring30} certificate{(certExpiring30 == 1 ? "" : "s")} will expire within the next 30 days.",
                "Renew certificates before expiry to avoid service disruption. Consider enabling Key Vault auto-rotation."));
        }

        var metrics = new[]
        {
            Metric("defender", "Defender Recommendations", liveSignals.DefenderRecommendationCount, "count", StatusForCount(liveSignals.DefenderRecommendationCount), "Microsoft Defender for Cloud findings across accessible subscriptions."),
            Metric("publicExposed", "Publicly Exposed Resources", liveSignals.PublicExposedResourceCount, "count", StatusForCount(liveSignals.PublicExposedResourceCount), "Public IP exposure and internet-facing security signals discovered from Azure Resource Graph."),
            Metric("anyAnyNsg", "NSG Any/Any Rules", liveSignals.AnyAnyNsgCount, "count", StatusForCount(liveSignals.AnyAnyNsgCount), "Network security groups with wildcard source and destination access."),
            Metric("untagged", "Untagged Resources", liveSignals.UntaggedResourceCount, "count", StatusForCount(liveSignals.UntaggedResourceCount), "Resources without tags that reduce accountability and governance coverage."),
            Metric("abandonedPip", "Abandoned Public IPs", liveSignals.AbandonedPublicIpCount, "count", StatusForCount(liveSignals.AbandonedPublicIpCount), "Public IP addresses with no active attachment."),
            Metric("ownerAssignments", "Owner Role Assignments", liveSignals.OwnerAssignmentCount, "count", StatusForCount(liveSignals.OwnerAssignmentCount > 5 ? liveSignals.OwnerAssignmentCount : 0), "Observed Owner role assignments from authorization resources. Higher values increase RBAC risk."),
            Metric("backups", "VMs Without Backup", unprotectedVmCount, "count", liveSignals.VmCount > 0 ? StatusForCount(unprotectedVmCount) : "limited", liveSignals.VmCount > 0 ? $"{liveSignals.VmCount} VMs discovered, {liveSignals.BackupProtectedItemCount} protected by Recovery Services backup." : "No VM inventory returned from Azure Resource Graph."),
            Metric("patching", "VMs Without Patching", null, "count", "unavailable", "Patch posture requires Azure Update Manager integration or Log Analytics guest assessment."),
            Metric("expiredCerts", "Expired Certificates", certExpired, "count", certMetricStatus, certMetricDesc),
            Metric("unusedDisks", "Unused Disks", liveSignals.UnusedDiskCount, "count", StatusForCount(liveSignals.UnusedDiskCount), "Unattached managed disks create cost and residual data exposure risk."),
        };

        var coverageNotes = new List<string>
        {
            $"Live signals: Defender recommendations, public exposure ({liveSignals.PublicIpResources.Count} public IPs), NSG Any/Any, untagged resources, Owner assignments, and backup coverage.",
            $"Backup posture: {liveSignals.BackupProtectedItemCount} items protected across {liveSignals.BackupVaultCount} Recovery Services vaults. {unprotectedVmCount} VMs have no backup coverage.",
            certVaultCount > 0
                ? $"Certificate posture: {certTotal} certificates scanned across {certVaultCount} Key Vault{(certVaultCount == 1 ? "" : "s")}. {certExpired} expired, {certExpiring30} expiring within 30 days."
                : "Certificate posture: no Key Vaults discovered in scope.",
            "Not yet wired: guest patch posture (requires Azure Update Manager) and shadow IT detection.",
        };

        return new SecurityDashboardDto(
            liveFindings,
            blastRadiusGraph.Nodes,
            blastRadiusGraph.Edges,
            metrics,
            liveSignals.ExposedResources,
            coverageNotes.ToArray());
    }

    private async Task<(int Expired, int Expiring30, int Total, int VaultCount, string Status, string Description)>
        GetCertificateExpiryMetricAsync(IReadOnlyList<SubscriptionSummary> subscriptions, CancellationToken cancellationToken)
    {
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (subscriptionIds.Length == 0)
            return (0, 0, 0, 0, "unavailable", "No subscriptions in scope.");

        try
        {
            const string kvQuery = "resources | where type =~ 'microsoft.keyvault/vaults' | project name | order by name asc | limit 30";
            var vaultNames = new List<string>();
            using var kvResult = await azureResourceGraphClient.QueryResourcesAsync(kvQuery, subscriptionIds, null, cancellationToken);
            if (kvResult.RootElement.TryGetProperty("data", out var kvData) && kvData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in kvData.EnumerateArray())
                {
                    var name = GetStringProperty(item, "name");
                    if (!string.IsNullOrWhiteSpace(name)) vaultNames.Add(name);
                }
            }

            if (vaultNames.Count == 0)
                return (0, 0, 0, 0, "ok", "No Key Vaults discovered in scope.");

            var credential = new DefaultAzureCredential();
            var now = DateTimeOffset.UtcNow;
            var semaphore = new SemaphoreSlim(5, 5);

            var tasks = vaultNames.Select(async vaultName =>
            {
                await semaphore.WaitAsync(cancellationToken);
                try
                {
                    var client = new CertificateClient(new Uri($"https://{vaultName}.vault.azure.net/"), credential);
                    var expired = 0; var expiring30 = 0; var total = 0;
                    await foreach (var cert in client.GetPropertiesOfCertificatesAsync(cancellationToken: cancellationToken))
                    {
                        if (cert.Enabled != true) continue;
                        total++;
                        if (cert.ExpiresOn.HasValue)
                        {
                            if (cert.ExpiresOn.Value < now) expired++;
                            else if (cert.ExpiresOn.Value < now.AddDays(30)) expiring30++;
                        }
                    }
                    return (Expired: expired, Expiring30: expiring30, Total: total, Success: true);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Certificate scan failed for vault {VaultName}.", vaultName);
                    return (Expired: 0, Expiring30: 0, Total: 0, Success: false);
                }
                finally { semaphore.Release(); }
            });

            var results = await Task.WhenAll(tasks);
            var totalExpired    = results.Sum(r => r.Expired);
            var totalExpiring30 = results.Sum(r => r.Expiring30);
            var totalCerts      = results.Sum(r => r.Total);
            var scannedVaults   = results.Count(r => r.Success);

            var status = totalExpired > 0 ? "critical" : totalExpiring30 > 0 ? "warning" : "ok";
            var desc   = $"{totalCerts} certificates across {scannedVaults}/{vaultNames.Count} Key Vaults. {totalExpired} expired, {totalExpiring30} expiring within 30 days.";
            return (totalExpired, totalExpiring30, totalCerts, scannedVaults, status, desc);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Certificate expiry check failed.");
            return (0, 0, 0, 0, "unavailable", "Certificate scan encountered an error — check managed identity permissions.");
        }
    }

}
