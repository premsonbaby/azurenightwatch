using NightWatch.Application.Abstractions;

namespace NightWatch.Infrastructure.Plugins;

public sealed class TechnicalDebtPlugin : IInsightPlugin
{
    public string Name => "TechnicalDebtPlugin";

    public IReadOnlyCollection<string> Analyze(string tenantId)
    {
        return Array.Empty<string>();
    }
}
