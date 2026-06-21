namespace NightWatch.Infrastructure.Abstractions;

public record SubscriptionSummary(string Id, string DisplayName);

public interface ISubscriptionDiscoveryService
{
    /// <summary>
    /// Returns enabled subscriptions the current identity can see.
    /// Results are cached for one hour. If AzureOperations:SubscriptionIds (or runtime scope)
    /// is configured, those are used instead of auto-discovery unless ignoreScopedSelection is true.
    /// </summary>
    Task<IReadOnlyList<SubscriptionSummary>> GetSubscriptionsAsync(CancellationToken cancellationToken, bool ignoreScopedSelection = false);
}
