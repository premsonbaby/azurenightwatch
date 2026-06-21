using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Infrastructure.Services.Demo;

public sealed class DemoSubscriptionDiscoveryService : ISubscriptionDiscoveryService
{
    private static readonly IReadOnlyList<SubscriptionSummary> FakeSubscriptions =
    [
        new SubscriptionSummary("demo-sub-001", "Contoso Production"),
        new SubscriptionSummary("demo-sub-002", "Contoso Non-Production"),
    ];

    public Task<IReadOnlyList<SubscriptionSummary>> GetSubscriptionsAsync(CancellationToken cancellationToken, bool ignoreScopedSelection = false)
        => Task.FromResult(FakeSubscriptions);
}
