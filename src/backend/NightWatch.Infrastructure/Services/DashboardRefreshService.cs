using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Abstractions;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;

namespace NightWatch.Infrastructure.Services;

/// <summary>
/// Proactively refreshes the LiveSignals cache before it expires so users never
/// trigger a cold Azure API round-trip. Refresh interval (12 min) is shorter than
/// the cache TTL (15 min) to guarantee the cache is always warm.
/// </summary>
public sealed class DashboardRefreshService(
    IServiceScopeFactory scopeFactory,
    ILogger<DashboardRefreshService> logger) : BackgroundService
{
    private static readonly TimeSpan InitialDelay   = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan RefreshInterval = TimeSpan.FromMinutes(12);
    private const string TenantKey = "global";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give the app time to finish starting before the first refresh
        await Task.Delay(InitialDelay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await RefreshAsync(stoppingToken);

            try { await Task.Delay(RefreshInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task RefreshAsync(CancellationToken ct)
    {
        // Skip refresh if no subscriptions are configured yet
        using var scope = scopeFactory.CreateScope();
        var operationsScope = scope.ServiceProvider.GetRequiredService<IOperationsScopeService>();
        if (operationsScope.GetCurrent().SubscriptionIds.Count == 0)
        {
            logger.LogDebug("Dashboard refresh skipped — no subscriptions configured.");
            return;
        }

        logger.LogInformation("Dashboard cache refresh starting.");
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            var insights = scope.ServiceProvider.GetRequiredService<INightWatchInsightsService>();

            // Warm cache — CollectLiveSignalsAsync is shared so these calls benefit all endpoints
            var executiveTask = Safe(() => insights.GetExecutiveDashboardAsync(TenantKey, ct));
            await Task.WhenAll(
                executiveTask,
                Safe(() => insights.GetSecurityDashboardAsync(TenantKey, ct)),
                Safe(() => insights.GetCostDashboardAsync(TenantKey, ct)),
                Safe(() => insights.GetGovernanceDashboardAsync(TenantKey, ct)),
                Safe(() => insights.GetPerformanceDashboardAsync(TenantKey, ct)),
                Safe(() => insights.GetDrDashboardAsync(TenantKey, ct)),
                Safe(() => insights.GetBackupHealthDashboardAsync(TenantKey, ct)),
                Safe(() => insights.GetQuickWinsDashboardAsync(TenantKey, ct))
            );

            sw.Stop();
            logger.LogInformation("Dashboard cache refresh completed in {Ms}ms.", sw.ElapsedMilliseconds);

            // Persist daily snapshot and upsert monthly health snapshot
            await PersistSnapshotAsync(scope, insights, ct);
        }
        catch (OperationCanceledException)
        {
            // App is shutting down — exit cleanly
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Dashboard cache refresh encountered an error.");
        }
    }

    private async Task PersistSnapshotAsync(IServiceScope scope, INightWatchInsightsService insights, CancellationToken ct)
    {
        try
        {
            var db = scope.ServiceProvider.GetRequiredService<NightWatchDbContext>();
            var executive = await insights.GetExecutiveDashboardAsync(TenantKey, ct);

            // Daily snapshot — one row per day; skip if already written today
            var today = DateTimeOffset.UtcNow.Date;
            var alreadyToday = await db.DailySnapshots
                .AnyAsync(s => s.TenantId == TenantKey && s.SnapshotDate >= today, ct);

            if (!alreadyToday)
            {
                db.DailySnapshots.Add(new DailySnapshotEntity
                {
                    Id = Guid.NewGuid(),
                    TenantId = TenantKey,
                    SnapshotDate = DateTimeOffset.UtcNow,
                    AzureHealthScore = executive.AzureHealthScore,
                    SecurityScore = executive.SecurityPostureScore,
                    CostEfficiencyScore = executive.CostEfficiencyScore,
                    ReliabilityScore = executive.ReliabilityScore,
                    GovernanceScore = executive.GovernanceComplianceScore,
                    BusinessImpactEstimateEur = executive.BusinessImpactEstimateEur,
                });
                await db.SaveChangesAsync(ct);
            }

            // Monthly snapshot — upsert current month
            var snapshotService = scope.ServiceProvider.GetRequiredService<IHealthSnapshotService>();
            await snapshotService.CaptureSnapshotAsync(TenantKey, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Snapshot persistence failed during dashboard refresh.");
        }
    }

    private static async Task Safe<T>(Func<Task<T>> fn)
    {
        try { await fn(); }
        catch { /* individual failures are non-fatal — logged upstream */ }
    }
}
