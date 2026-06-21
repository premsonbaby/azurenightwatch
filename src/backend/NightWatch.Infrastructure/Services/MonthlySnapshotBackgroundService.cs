using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Abstractions;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Persistence;
using System.Globalization;

namespace NightWatch.Infrastructure.Services;

/// <summary>
/// Runs once per day. On the 1st of each month (or first run after a month boundary)
/// captures a monthly health snapshot for every active customer tenant plus the home MSP tenant.
/// This builds the historical trend data used in monthly review reports.
/// </summary>
public sealed class MonthlySnapshotBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<MonthlySnapshotBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(InitialDelay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await TryCaptureForAllTenantsAsync(stoppingToken);

            try { await Task.Delay(CheckInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task TryCaptureForAllTenantsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var operationsScope = scope.ServiceProvider.GetRequiredService<IOperationsScopeService>();

        if (operationsScope.GetCurrent().SubscriptionIds.Count == 0)
        {
            logger.LogDebug("Monthly snapshot skipped — no subscriptions configured.");
            return;
        }

        try
        {
            var snapshotService = scope.ServiceProvider.GetRequiredService<IHealthSnapshotService>();
            var db = scope.ServiceProvider.GetRequiredService<NightWatchDbContext>();

            // Capture for home/MSP tenant
            await snapshotService.CaptureSnapshotAsync("global", ct);

            // Capture for every active customer tenant
            var customers = await db.CustomerTenants
                .Where(t => t.IsActive)
                .Select(t => t.TenantId)
                .ToListAsync(ct);

            foreach (var tenantId in customers)
            {
                if (ct.IsCancellationRequested) break;
                await snapshotService.CaptureSnapshotAsync(tenantId, ct);
            }

            logger.LogInformation(
                "Monthly health snapshots updated for {Count} tenant(s), month {Month}.",
                customers.Count + 1,
                DateTimeOffset.UtcNow.ToString("yyyy-MM", CultureInfo.InvariantCulture));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Monthly snapshot background run encountered an error.");
        }
    }
}
