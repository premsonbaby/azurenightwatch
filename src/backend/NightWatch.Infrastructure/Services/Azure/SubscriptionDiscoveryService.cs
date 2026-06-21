using Azure.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Options;
using System.Net.Http.Headers;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

/// <summary>
/// Discovers all enabled Azure subscriptions accessible to the current identity.
/// Registered as Singleton — uses IHttpClientFactory to avoid socket exhaustion.
/// Results are cached for 1 hour; customers can override by listing SubscriptionIds in config.
/// </summary>
public sealed class SubscriptionDiscoveryService(
    IHttpClientFactory httpClientFactory,
    TokenCredential credential,
    IOptions<AzureOperationsOptions> options,
    IOperationsScopeService operationsScopeService,
    ILogger<SubscriptionDiscoveryService> logger) : ISubscriptionDiscoveryService
{
    private static readonly TokenRequestContext ManagementScope = new(["https://management.azure.com/.default"]);

    private readonly Dictionary<string, (IReadOnlyList<SubscriptionSummary> subs, DateTimeOffset expiry)> _tenantCache = [];
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public async Task<IReadOnlyList<SubscriptionSummary>> GetSubscriptionsAsync(CancellationToken cancellationToken, bool ignoreScopedSelection = false)
    {
        // For customer tenant contexts, return only the subscriptions accessible via that credential —
        // never apply the MSP's ops-scope filter, since those subscription IDs belong to the home tenant.
        var customerTenantId = TenantCredentialContext.GetCurrentTenantId();
        var isCustomerTenant = !string.IsNullOrWhiteSpace(customerTenantId);

        var allSubscriptions = await FetchAllSubscriptionsAsync(cancellationToken, customerTenantId ?? "home");

        if (ignoreScopedSelection || isCustomerTenant)
            return allSubscriptions;

        var operationalScoped = operationsScopeService.GetCurrent().SubscriptionIds
            .Where(id => !string.IsNullOrWhiteSpace(id) && id != "00000000-0000-0000-0000-000000000000")
            .ToList();

        if (operationalScoped.Count > 0)
            return FilterAndResolveNames(operationalScoped, allSubscriptions);

        var configured = options.Value.SubscriptionIds
            .Where(id => !string.IsNullOrWhiteSpace(id) && id != "00000000-0000-0000-0000-000000000000")
            .ToList();

        if (configured.Count > 0)
            return FilterAndResolveNames(configured, allSubscriptions);

        return allSubscriptions;
    }

    private static IReadOnlyList<SubscriptionSummary> FilterAndResolveNames(
        IReadOnlyList<string> scopedIds,
        IReadOnlyList<SubscriptionSummary> allSubscriptions)
    {
        var nameById = allSubscriptions.ToDictionary(s => s.Id, s => s.DisplayName, StringComparer.OrdinalIgnoreCase);
        return scopedIds
            .Select(id => new SubscriptionSummary(id, nameById.TryGetValue(id, out var name) ? name : id))
            .ToList()
            .AsReadOnly();
    }

    private async Task<IReadOnlyList<SubscriptionSummary>> FetchAllSubscriptionsAsync(CancellationToken cancellationToken, string tenantKey)
    {
        if (_tenantCache.TryGetValue(tenantKey, out var hit) && DateTimeOffset.UtcNow < hit.expiry)
            return hit.subs;

        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            if (_tenantCache.TryGetValue(tenantKey, out hit) && DateTimeOffset.UtcNow < hit.expiry)
                return hit.subs;

            var token = await credential.GetTokenAsync(ManagementScope, cancellationToken);
            var client = httpClientFactory.CreateClient("SubscriptionDiscovery");

            using var request = new HttpRequestMessage(
                HttpMethod.Get, "/subscriptions?api-version=2022-12-01");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);

            using var response = await client.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            var result = new List<SubscriptionSummary>();
            if (doc.RootElement.TryGetProperty("value", out var value))
            {
                foreach (var sub in value.EnumerateArray())
                {
                    var state = sub.TryGetProperty("state", out var stateEl) ? stateEl.GetString() : null;
                    if (!string.Equals(state, "Enabled", StringComparison.OrdinalIgnoreCase))
                        continue;

                    var id = sub.TryGetProperty("subscriptionId", out var idEl) ? idEl.GetString() : null;
                    var name = sub.TryGetProperty("displayName", out var nameEl) ? nameEl.GetString() : null;
                    if (id is not null)
                        result.Add(new SubscriptionSummary(id, name ?? id));
                }
            }

            logger.LogInformation("Discovered {Count} enabled subscriptions for tenant key '{TenantKey}'.", result.Count, tenantKey);
            var readOnly = result.AsReadOnly();
            _tenantCache[tenantKey] = (readOnly, DateTimeOffset.UtcNow.AddHours(1));
            return readOnly;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unable to discover subscriptions for tenant key '{TenantKey}' — credentials may not be configured. Returning empty list.", tenantKey);
            var empty = Array.Empty<SubscriptionSummary>();
            _tenantCache[tenantKey] = (empty, DateTimeOffset.UtcNow.AddMinutes(5));
            return empty;
        }
        finally
        {
            _semaphore.Release();
        }
    }
}
