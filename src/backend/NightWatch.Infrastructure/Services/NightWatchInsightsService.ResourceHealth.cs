using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using NightWatch.Infrastructure.Abstractions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed partial class NightWatchInsightsService
{
    public async Task<AppFunctionsHealthDashboardDto> GetAppFunctionsHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new AppFunctionsHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, []);

        const string query = "resources | where type =~ 'microsoft.web/sites' | project id, name, subscriptionId, location, kind, state=tostring(properties.state)";

        var apps = new List<AppFunctionItemDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var rid = GetStringProperty(item, "id") ?? "";
                    var name = GetStringProperty(item, "name") ?? "unknown";
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var location = GetStringProperty(item, "location") ?? "";
                    var kind = GetStringProperty(item, "kind") ?? "app";
                    var state = GetStringProperty(item, "state") ?? "Unknown";
                    apps.Add(new AppFunctionItemDto(rid, name, kind, state, subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), location, ""));
                }
            }
            else
            {
                logger.LogWarning("App functions health ARG query returned no data array for tenant {TenantId}.", tenantId);
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "App functions health ARG query failed for tenant {TenantId}.", tenantId); }

        var running = apps.Count(a => a.State.Equals("Running", StringComparison.OrdinalIgnoreCase));
        var stopped = apps.Count(a => a.State.Equals("Stopped", StringComparison.OrdinalIgnoreCase));
        var functionApps = apps.Count(a => a.Kind.Contains("functionapp", StringComparison.OrdinalIgnoreCase));
        var webApps = apps.Count(a => !a.Kind.Contains("functionapp", StringComparison.OrdinalIgnoreCase) && !a.Kind.Contains("logicapp", StringComparison.OrdinalIgnoreCase));
        var logicApps = apps.Count(a => a.Kind.Contains("logicapp", StringComparison.OrdinalIgnoreCase));

        return new AppFunctionsHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, apps.Count, running, stopped, functionApps, webApps, logicApps, apps.OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase).ToArray());
    }

    // ── AzPolicyLens ────────────────────────────────────────────────────────────
    public async Task<DatabaseHealthDashboardDto> GetDatabaseHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new DatabaseHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, 0, 0, []);

        const string query = @"resources
| where type in~ ('microsoft.sql/servers/databases','microsoft.dbformysql/servers','microsoft.dbformysql/flexibleservers','microsoft.dbforpostgresql/servers','microsoft.dbforpostgresql/flexibleservers','microsoft.documentdb/databaseaccounts','microsoft.sql/servers/elasticpools')
| where name !~ 'master'
| extend engine = case(type =~ 'microsoft.sql/servers/databases','Azure SQL',type =~ 'microsoft.dbformysql/servers','MySQL',type =~ 'microsoft.dbformysql/flexibleservers','MySQL Flexible',type =~ 'microsoft.dbforpostgresql/servers','PostgreSQL',type =~ 'microsoft.dbforpostgresql/flexibleservers','PostgreSQL Flexible',type =~ 'microsoft.documentdb/databaseaccounts','Cosmos DB',type =~ 'microsoft.sql/servers/elasticpools','Elastic Pool','Other')
| extend tier = tostring(coalesce(properties.currentServiceObjectiveName, properties.sku.tier, sku.tier, ''))
| extend skuName = tostring(coalesce(sku.name, properties.sku.name, ''))
| extend statusRaw = tostring(coalesce(properties.status, properties.userVisibleState, ''))
| extend dtu = toint(coalesce(properties.currentSku.capacity, sku.capacity, 0))
| project id, name, engine, subscriptionId, location, tier, skuName, statusRaw, dtu
| order by engine asc, name asc";

        var dbs = new List<DatabaseResourceDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var rid = GetStringProperty(item, "id") ?? "";
                    var name = GetStringProperty(item, "name") ?? "unknown";
                    var engine = GetStringProperty(item, "engine") ?? "Other";
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var location = GetStringProperty(item, "location") ?? "";
                    var tier = GetStringProperty(item, "tier") ?? "";
                    var sku = GetStringProperty(item, "skuName") ?? "";
                    var status = GetStringProperty(item, "statusRaw") ?? "Unknown";
                    int? dtu = item.TryGetProperty("dtu", out var dtuEl) && dtuEl.ValueKind == JsonValueKind.Number ? dtuEl.GetInt32() : (int?)null;
                    dbs.Add(new DatabaseResourceDto(rid, name, engine, engine, subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), location, tier, sku, status, dtu));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Database health ARG query failed for tenant {TenantId}.", tenantId); }

        return new DatabaseHealthDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalDatabases: dbs.Count,
            RunningDatabases: dbs.Count(d => d.Status.Equals("Online", StringComparison.OrdinalIgnoreCase) || d.Status.Equals("Running", StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(d.Status)),
            StoppedDatabases: dbs.Count(d => d.Status.Equals("Stopped", StringComparison.OrdinalIgnoreCase) || d.Status.Equals("Paused", StringComparison.OrdinalIgnoreCase)),
            SqlCount: dbs.Count(d => d.DbEngine.StartsWith("Azure SQL", StringComparison.OrdinalIgnoreCase)),
            MySqlCount: dbs.Count(d => d.DbEngine.StartsWith("MySQL", StringComparison.OrdinalIgnoreCase)),
            PostgreSqlCount: dbs.Count(d => d.DbEngine.StartsWith("PostgreSQL", StringComparison.OrdinalIgnoreCase)),
            CosmosDbCount: dbs.Count(d => d.DbEngine.Equals("Cosmos DB", StringComparison.OrdinalIgnoreCase)),
            ElasticPoolCount: dbs.Count(d => d.DbEngine.Equals("Elastic Pool", StringComparison.OrdinalIgnoreCase)),
            Databases: dbs.Take(100).ToArray());
    }

    // ── Key Vault Health ─────────────────────────────────────────────────────
    public async Task<KeyVaultHealthDashboardDto> GetKeyVaultHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new KeyVaultHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, []);

        const string query = @"resources
| where type =~ 'microsoft.keyvault/vaults'
| extend softDelete = tobool(properties.enableSoftDelete)
| extend purgeProtection = tobool(properties.enablePurgeProtection)
| extend accessModel = iff(properties.enableRbacAuthorization == true, 'rbac', 'accessPolicy')
| extend skuName = tostring(properties.sku.name)
| project id, name, subscriptionId, location, softDelete, purgeProtection, accessModel, skuName
| order by name asc";

        var vaults = new List<KeyVaultItemDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var softDelete = item.TryGetProperty("softDelete", out var sd) && sd.ValueKind == JsonValueKind.True;
                    var purgeProtection = item.TryGetProperty("purgeProtection", out var pp) && pp.ValueKind == JsonValueKind.True;
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    vaults.Add(new KeyVaultItemDto(
                        GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "",
                        softDelete, purgeProtection, GetStringProperty(item, "accessModel") ?? "accessPolicy", GetStringProperty(item, "skuName") ?? ""));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Key vault health ARG query failed for tenant {TenantId}.", tenantId); }

        return new KeyVaultHealthDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalVaults: vaults.Count,
            SoftDeleteDisabledCount: vaults.Count(v => !v.SoftDeleteEnabled),
            PurgeProtectionDisabledCount: vaults.Count(v => !v.PurgeProtectionEnabled),
            AccessPolicyModelCount: vaults.Count(v => v.AccessModel.Equals("accessPolicy", StringComparison.OrdinalIgnoreCase)),
            RbacModelCount: vaults.Count(v => v.AccessModel.Equals("rbac", StringComparison.OrdinalIgnoreCase)),
            Vaults: vaults.Take(100).ToArray());
    }

    // ── AKS & Container Health ────────────────────────────────────────────────
    public async Task<AksContainerHealthDashboardDto> GetAksContainerHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new AksContainerHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, [], [], []);

        var clusters = new List<AksClusterDto>();
        var apps = new List<ContainerAppItemDto>();
        var registries = new List<ContainerRegistryItemDto>();

        try
        {
            const string clusterQuery = @"resources | where type =~ 'microsoft.containerservice/managedclusters'
| extend k8sVersion = tostring(properties.kubernetesVersion), nodeCount = toint(properties.agentPoolProfiles[0].count), skuName = tostring(sku.name), state = tostring(properties.provisioningState)
| project id, name, subscriptionId, location, k8sVersion, nodeCount, skuName, state | order by name asc";
            using var cr = await azureResourceGraphClient.QueryResourcesAsync(clusterQuery, subscriptionIds, null, cancellationToken);
            if (cr.RootElement.TryGetProperty("data", out var cd) && cd.ValueKind == JsonValueKind.Array)
                foreach (var item in cd.EnumerateArray())
                {
                    var nodeCount = item.TryGetProperty("nodeCount", out var nc) && nc.ValueKind == JsonValueKind.Number ? nc.GetInt32() : 0;
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    clusters.Add(new AksClusterDto(GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "k8sVersion") ?? "", GetStringProperty(item, "state") ?? "", nodeCount, GetStringProperty(item, "skuName") ?? ""));
                }
        }
        catch (Exception ex) { logger.LogWarning(ex, "AKS cluster ARG query failed."); }

        try
        {
            const string appQuery = "resources | where type =~ 'microsoft.app/containerapps' | extend state = tostring(properties.provisioningState) | project id, name, subscriptionId, location, state | order by name asc";
            using var ar = await azureResourceGraphClient.QueryResourcesAsync(appQuery, subscriptionIds, null, cancellationToken);
            if (ar.RootElement.TryGetProperty("data", out var ad) && ad.ValueKind == JsonValueKind.Array)
                foreach (var item in ad.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    apps.Add(new ContainerAppItemDto(GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "", GetStringProperty(item, "state") ?? ""));
                }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Container apps ARG query failed."); }

        try
        {
            const string regQuery = "resources | where type =~ 'microsoft.containerregistry/registries' | extend skuName = tostring(sku.name), adminEnabled = tobool(properties.adminUserEnabled) | project id, name, subscriptionId, location, skuName, adminEnabled | order by name asc";
            using var rr = await azureResourceGraphClient.QueryResourcesAsync(regQuery, subscriptionIds, null, cancellationToken);
            if (rr.RootElement.TryGetProperty("data", out var rd) && rd.ValueKind == JsonValueKind.Array)
                foreach (var item in rd.EnumerateArray())
                {
                    var admin = item.TryGetProperty("adminEnabled", out var ae) && ae.ValueKind == JsonValueKind.True;
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    registries.Add(new ContainerRegistryItemDto(GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "", GetStringProperty(item, "skuName") ?? "", admin));
                }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Container registry ARG query failed."); }

        return new AksContainerHealthDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalClusters: clusters.Count,
            RunningClusters: clusters.Count(c => c.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase)),
            StoppedClusters: clusters.Count(c => c.ProvisioningState.Equals("Stopped", StringComparison.OrdinalIgnoreCase)),
            TotalContainerApps: apps.Count, TotalRegistries: registries.Count,
            Clusters: clusters.ToArray(), ContainerApps: apps.ToArray(), Registries: registries.ToArray());
    }

    // ── Storage Account Compliance ────────────────────────────────────────────
    public async Task<StorageComplianceDashboardDto> GetStorageComplianceDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new StorageComplianceDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, []);

        const string query = @"resources
| where type =~ 'microsoft.storage/storageaccounts'
| extend publicBlob = tobool(properties.allowBlobPublicAccess)
| extend httpsOnly = tobool(properties.supportsHttpsTrafficOnly)
| extend minTls = tostring(properties.minimumTlsVersion)
| extend sharedKey = tobool(properties.allowSharedKeyAccess)
| extend skuName = tostring(sku.name)
| project id, name, subscriptionId, location, skuName, publicBlob, httpsOnly, minTls, sharedKey
| order by name asc";

        var accounts = new List<StorageAccountItemDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var publicBlob = item.TryGetProperty("publicBlob", out var pb) && pb.ValueKind == JsonValueKind.True;
                    var httpsOnly = item.TryGetProperty("httpsOnly", out var ho) && ho.ValueKind == JsonValueKind.True;
                    var minTls = GetStringProperty(item, "minTls") ?? "TLS1_0";
                    var sharedKey = !(item.TryGetProperty("sharedKey", out var sk) && sk.ValueKind == JsonValueKind.False);
                    accounts.Add(new StorageAccountItemDto(
                        GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "skuName") ?? "", publicBlob, httpsOnly, minTls, sharedKey));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Storage compliance ARG query failed for tenant {TenantId}.", tenantId); }

        var compliant = accounts.Count(a => !a.PublicBlobAccessEnabled && a.HttpsOnly && (a.MinTlsVersion == "TLS1_2" || a.MinTlsVersion == "TLS1_3") && !a.AllowSharedKeyAccess);
        return new StorageComplianceDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalStorageAccounts: accounts.Count,
            PublicAccessCount: accounts.Count(a => a.PublicBlobAccessEnabled),
            HttpOnlyViolationCount: accounts.Count(a => !a.HttpsOnly),
            WeakTlsCount: accounts.Count(a => a.MinTlsVersion != "TLS1_2" && a.MinTlsVersion != "TLS1_3"),
            SharedKeyAllowedCount: accounts.Count(a => a.AllowSharedKeyAccess),
            FullyCompliantCount: compliant,
            StorageAccounts: accounts.Take(100).ToArray());
    }

    // ── Azure Service Health ──────────────────────────────────────────────────
}
