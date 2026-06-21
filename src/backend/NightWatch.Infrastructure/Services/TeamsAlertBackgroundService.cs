using Azure.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NightWatch.Application.Abstractions;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Options;
using NightWatch.Infrastructure.Services.Azure;
using System.Text;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed class TeamsAlertBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOperationsScopeService operationsScope,
    IOptions<MultiTenantOptions> multiTenantOpts,
    ILogger<TeamsAlertBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(15);
    private DateTimeOffset _lastDailyDigest = DateTimeOffset.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Teams alert monitoring service started.");
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunForHomeTenantAsync(stoppingToken);
                await RunForCustomerTenantsAsync(stoppingToken);
                await TrySendDailyDigestAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unhandled error in Teams alert monitoring service.");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    // ── Home tenant ──────────────────────────────────────────────────────────

    private async Task RunForHomeTenantAsync(CancellationToken ct)
    {
        var settings = operationsScope.GetTeamsSettings();
        if (!settings.AlertsEnabled || string.IsNullOrWhiteSpace(settings.WebhookUrl)) return;

        await EvaluateAndSendAlertsAsync(settings.WebhookUrl, tenantLabel: null, stateKey: "home", tenantId: "global", ct);

        // Also send to customer webhook if configured
        if (settings.CustomerWebhookEnabled && !string.IsNullOrWhiteSpace(settings.CustomerWebhookUrl))
        {
            try
            {
                await EvaluateAndSendAlertsAsync(settings.CustomerWebhookUrl, tenantLabel: null, stateKey: "home-customer", tenantId: "global", ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Customer webhook alert evaluation failed.");
            }
        }
    }

    // ── Customer tenants ─────────────────────────────────────────────────────

    private async Task RunForCustomerTenantsAsync(CancellationToken ct)
    {
        var opts = multiTenantOpts.Value;
        if (string.IsNullOrWhiteSpace(opts.ClientId) || string.IsNullOrWhiteSpace(opts.ClientSecret)) return;

        using var scope = scopeFactory.CreateScope();
        var tenantRegistry = scope.ServiceProvider.GetRequiredService<ITenantRegistryService>();
        var activeTenants = await tenantRegistry.GetActiveTenantsAsync(ct);

        foreach (var tenant in activeTenants)
        {
            var webhookUrl = await tenantRegistry.GetTeamsWebhookUrlAsync(tenant.TenantId, ct);
            if (string.IsNullOrWhiteSpace(webhookUrl)) continue;

            var credential = new ClientSecretCredential(tenant.TenantId, opts.ClientId, opts.ClientSecret);
            TenantCredentialContext.Set(credential, tenant.TenantId);
            try
            {
                await EvaluateAndSendAlertsAsync(webhookUrl, tenant.DisplayName, $"tenant:{tenant.TenantId}", tenant.TenantId, ct);
            }
            catch (Exception ex) { logger.LogError(ex, "Teams alert check failed for tenant {TenantId}.", tenant.TenantId); }
            finally { TenantCredentialContext.Clear(); }
        }
    }

    // ── Core evaluation logic ────────────────────────────────────────────────

    private async Task EvaluateAndSendAlertsAsync(
        string webhookUrl, string? tenantLabel, string stateKey, string tenantId, CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var insightsService = scope.ServiceProvider.GetService<INightWatchInsightsService>();
            if (insightsService == null) return;

            var scopeSettings = operationsScope.GetCurrent();
            if (tenantLabel is null && scopeSettings.SubscriptionIds.Count == 0) return;

            var stateJson = await operationsScope.GetTeamsAlertStateJsonAsync(ct);
            var previousState = DeserializeAlertState(stateJson);
            var newState = new Dictionary<string, DateTimeOffset>();

            var teamsService = scope.ServiceProvider.GetRequiredService<TeamsNotificationService>();

            await CheckExposedNsgsAsync(insightsService, webhookUrl, teamsService, tenantLabel, stateKey, previousState, newState, ct);
            await CheckThresholdBreachesAsync(insightsService, webhookUrl, teamsService, tenantId, tenantLabel, scope, previousState, newState, ct);

            await operationsScope.SetTeamsAlertStateJsonAsync(JsonSerializer.Serialize(newState), ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error evaluating Teams alerts (stateKey={Key}).", stateKey);
        }
    }

    // ── Threshold breach checks ──────────────────────────────────────────────

    private async Task CheckThresholdBreachesAsync(
        INightWatchInsightsService insightsService,
        string webhookUrl,
        TeamsNotificationService teamsService,
        string tenantId,
        string? tenantLabel,
        IServiceScope scope,
        Dictionary<string, DateTimeOffset> previousState,
        Dictionary<string, DateTimeOffset> newState,
        CancellationToken ct)
    {
        try
        {
            var thresholdService = scope.ServiceProvider.GetRequiredService<IAlertThresholdService>();
            var thresholds = (await thresholdService.GetThresholdsAsync(tenantId, ct))
                .Where(t => t.IsEnabled).ToList();
            if (thresholds.Count == 0) return;

            var enabledTypes = thresholds.Select(t => t.MetricType).Distinct().ToList();

            foreach (var metricType in enabledTypes)
            {
                decimal currentValue;
                decimal? dailyBurnRate = null;
                int? daysLeft = null;

                try
                {
                    switch (metricType)
                    {
                        case "MonthlyCostCeiling":
                        {
                            var cost = await insightsService.GetCostDashboardAsync(tenantId, ct);
                            currentValue = cost.CurrentMonthCost;
                            break;
                        }
                        case "MonthlyCostRunRate":
                        {
                            var anomaly = await insightsService.GetCostAnomalyForecastDashboardAsync(tenantId, "30d", ct);
                            dailyBurnRate = anomaly.BudgetForecast.DailyBurnRate;
                            currentValue = anomaly.BudgetForecast.ProjectedMonthEndCost;
                            // Days left = days until budget exhaustion
                            daysLeft = anomaly.BudgetForecast.DaysToBudgetExhaustion > 0
                                ? anomaly.BudgetForecast.DaysToBudgetExhaustion
                                : null;
                            break;
                        }
                        case "SecurityScoreFloor":
                        {
                            var sec = await insightsService.GetSecurityDashboardAsync(tenantId, ct);
                            var metric = sec.Metrics.FirstOrDefault(m =>
                                string.Equals(m.Key, "securityScore", StringComparison.OrdinalIgnoreCase));
                            currentValue = metric?.Value ?? 0m;
                            break;
                        }
                        case "AdvisorScoreFloor":
                        {
                            var adv = await insightsService.GetAdvisorScoreDashboardAsync(tenantId, ct);
                            currentValue = adv.OverallScore;
                            break;
                        }
                        case "BackupCoverageFloor":
                        {
                            var backup = await insightsService.GetBackupHealthDashboardAsync(tenantId, ct);
                            currentValue = backup.ProtectionCoveragePercent;
                            break;
                        }
                        case "GovernanceScoreFloor":
                        {
                            var gov = await insightsService.GetGovernanceDashboardAsync(tenantId, ct);
                            currentValue = gov.TagCompliancePercent;
                            break;
                        }
                        case "ReliabilityScoreFloor":
                        {
                            var exec = await insightsService.GetExecutiveDashboardAsync(tenantId, ct);
                            currentValue = exec.ReliabilityScore;
                            break;
                        }
                        default: continue;
                    }
                }
                catch (Exception ex)
                {
                    logger.LogDebug(ex, "Could not fetch metric {Metric} for threshold check.", metricType);
                    continue;
                }

                var previousBreaches = await thresholdService.GetBreachesAsync(tenantId, 50, ct);
                var wasBreaching = previousBreaches.Any(b => b.MetricType == metricType && b.ResolvedAt == null);

                await thresholdService.CheckAndRecordBreachesAsync(
                    tenantId, metricType, currentValue, ct, tenantLabel, dailyBurnRate, daysLeft);

                var currentBreaches = await thresholdService.GetBreachesAsync(tenantId, 50, ct);
                var isNowBreaching = currentBreaches.Any(b => b.MetricType == metricType && b.ResolvedAt == null);
                var isNewBreach = isNowBreaching && !wasBreaching;

                if (isNewBreach)
                {
                    var breach = currentBreaches.First(b => b.MetricType == metricType && b.ResolvedAt == null);
                    var metricThreshold = thresholds.First(t => t.MetricType == metricType);
                    var effectiveWebhook = !string.IsNullOrWhiteSpace(metricThreshold.TeamsWebhookUrl)
                        ? metricThreshold.TeamsWebhookUrl
                        : webhookUrl;
                    var settings = operationsScope.GetTeamsSettings();
                    await SendNarrativeAlertAsync(teamsService, effectiveWebhook, breach, tenantLabel ?? settings.CustomerName, ct);
                    logger.LogWarning("Narrative alert sent: {Metric}={Value} (tenant={Tenant})", metricType, currentValue, tenantId);

                    // Email: use per-threshold email if set, else fall back to tenant registry contacts
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
                    if (!string.IsNullOrWhiteSpace(metricThreshold.AlertEmail) && metricThreshold.AlertChannel is "Both")
                    {
                        if (emailService.IsConfigured)
                            await SendBreachEmailAsync(emailService, [metricThreshold.AlertEmail], breach, tenantLabel ?? tenantId, ct);
                    }
                    else if (tenantId != "global")
                    {
                        var tenantRegistry = scope.ServiceProvider.GetRequiredService<ITenantRegistryService>();
                        var contacts = await tenantRegistry.GetAlertContactsAsync(tenantId, ct);
                        if (contacts.Count > 0 && emailService.IsConfigured)
                            await SendBreachEmailAsync(emailService, contacts, breach, tenantLabel ?? tenantId, ct);
                    }
                }

                // Pre-breach warning: score floor metrics within 5 pts of threshold
                if (!IsCeilingMetric(metricType))
                {
                    var threshold = thresholds.First(t => t.MetricType == metricType);
                    var gap = currentValue - threshold.ThresholdValue;
                    if (gap is > 0 and <= 5)
                    {
                        var warningKey = $"{tenantId}:{metricType}:warning";
                        if (!previousState.TryGetValue(warningKey, out var lastWarned) ||
                            DateTimeOffset.UtcNow - lastWarned > TimeSpan.FromHours(12))
                        {
                            var settings = operationsScope.GetTeamsSettings();
                            var label = tenantLabel ?? settings.CustomerName;
                            var warnTitle = $"⚠️ Warning: {FormatMetricName(metricType)} is approaching its threshold";
                            var warnBody = $"**Customer:** {label}\n\n" +
                                $"Current value is **{currentValue:F1}** — only **{gap:F1} points** above the configured threshold of **{threshold.ThresholdValue:F1}**.\n\n" +
                                "Action recommended before this breaches the alert threshold.";
                            await teamsService.SendCriticalAlertAsync(webhookUrl, warnTitle, warnBody, "Medium", label, ct);
                            newState[warningKey] = DateTimeOffset.UtcNow;
                            logger.LogInformation("Pre-breach warning sent: {Metric}={Value} gap={Gap} (tenant={Tenant})", metricType, currentValue, gap, tenantId);
                        }
                        else
                        {
                            newState[warningKey] = lastWarned;
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Threshold check failed for tenant {Tenant}.", tenantId);
        }
    }

    private static bool IsCeilingMetric(string metricType) =>
        metricType is "MonthlyCostCeiling" or "MonthlyCostRunRate";

    private static string FormatMetricName(string metricType) => metricType switch
    {
        "SecurityScoreFloor" => "Security Score",
        "AdvisorScoreFloor" => "Advisor Score",
        "BackupCoverageFloor" => "Backup Coverage",
        "GovernanceScoreFloor" => "Governance Score",
        "ReliabilityScoreFloor" => "Reliability Score",
        _ => metricType
    };

    private static async Task SendBreachEmailAsync(
        IEmailService emailService,
        IReadOnlyList<string> contacts,
        Application.Contracts.ThresholdBreachDto breach,
        string tenantLabel,
        CancellationToken ct)
    {
        var subject = $"NightWatch Alert — {tenantLabel} — {breach.AlertTitle ?? breach.MetricType}";
        var html = $"""
            <html><body style="font-family:system-ui,sans-serif;color:#1e293b;max-width:600px;margin:40px auto;padding:0 20px">
              <h2 style="color:#dc2626">⚠️ {breach.AlertTitle ?? "Alert: " + breach.MetricType}</h2>
              <p><strong>Customer:</strong> {tenantLabel}</p>
              <p><strong>Severity:</strong> {breach.Severity}</p>
              {(breach.BusinessImpact is not null ? $"<h3>Business Impact</h3><p>{breach.BusinessImpact}</p>" : "")}
              {(breach.SuggestedAction is not null ? $"<h3>Recommended Action</h3><p>{breach.SuggestedAction}</p>" : "")}
              <p style="color:#64748b;font-size:12px">Actual: {breach.ActualValue:F1} · Threshold: {breach.ThresholdValue:F1} · Detected: {breach.BreachedAt:yyyy-MM-dd HH:mm} UTC</p>
              <p style="font-size:12px;color:#94a3b8">Generated by NightWatch — Azure Operations Intelligence</p>
            </body></html>
            """;
        await emailService.SendAlertEmailAsync(contacts.ToList(), subject, html, ct);
    }

    // ── Rich narrative Teams message ─────────────────────────────────────────

    private static async Task SendNarrativeAlertAsync(
        TeamsNotificationService teamsService,
        string webhookUrl,
        Application.Contracts.ThresholdBreachDto breach,
        string customerName,
        CancellationToken ct)
    {
        var title = breach.AlertTitle ?? $"Alert: {breach.MetricType}";
        var body = new StringBuilder();
        body.AppendLine($"**Customer:** {customerName}\n");

        if (!string.IsNullOrWhiteSpace(breach.BusinessImpact))
        {
            body.AppendLine($"**Business Impact**\n{breach.BusinessImpact}\n");
        }

        if (!string.IsNullOrWhiteSpace(breach.SuggestedAction))
        {
            body.AppendLine($"**Recommended Action**\n{breach.SuggestedAction}\n");
        }

        body.AppendLine($"Actual: **{breach.ActualValue:F1}** · Threshold: **{breach.ThresholdValue:F1}**");

        await teamsService.SendCriticalAlertAsync(webhookUrl, title, body.ToString(), breach.Severity, customerName, ct);
    }

    // ── NSG exposure check ───────────────────────────────────────────────────

    private async Task CheckExposedNsgsAsync(
        INightWatchInsightsService insightsService,
        string webhookUrl,
        TeamsNotificationService teamsService,
        string? tenantLabel,
        string stateKey,
        Dictionary<string, DateTimeOffset> previousState,
        Dictionary<string, DateTimeOffset> newState,
        CancellationToken ct)
    {
        try
        {
            var dashboard = await insightsService.GetNetworkPerimeterDashboardAsync("global", ct);
            var exposed = dashboard.ExposedResources.Where(r => r.RiskLevel == "Critical" || r.RiskLevel == "High").ToList();

            foreach (var resource in exposed)
            {
                var key = $"{stateKey}:nsg:{resource.ResourceName}";
                newState[key] = DateTimeOffset.UtcNow;

                var shouldAlert = !previousState.TryGetValue(key, out var lastAlerted)
                    || DateTimeOffset.UtcNow - lastAlerted > TimeSpan.FromHours(24);

                if (!shouldAlert) continue;

                var narrative = new StringBuilder();
                if (tenantLabel is not null) narrative.AppendLine($"**Customer:** {tenantLabel}\n");
                narrative.AppendLine($"**Business Impact**\n" +
                    $"**{resource.ResourceName}** has a dangerous inbound rule allowing internet access " +
                    $"({resource.ExposureType}). Risk level: **{resource.RiskLevel}**. " +
                    "This is a known attack vector for ransomware and brute-force attacks.\n");
                narrative.AppendLine($"**Recommended Action**\n" +
                    "Restrict the NSG rule to specific trusted IP ranges only. " +
                    "If remote access is required, use Azure Bastion instead of exposing management ports. " +
                    "Enable Just-In-Time VM access via Defender for Cloud.");
                if (!string.IsNullOrWhiteSpace(resource.Details))
                    narrative.AppendLine($"\nRule details: {resource.Details}");

                var settings = operationsScope.GetTeamsSettings();
                var tenantPrefix = tenantLabel is not null ? $"[{tenantLabel}] " : "";
                await teamsService.SendCriticalAlertAsync(
                    webhookUrl,
                    $"{tenantPrefix}Exposed Network Security Group: {resource.ResourceName}",
                    narrative.ToString(),
                    resource.RiskLevel,
                    tenantLabel ?? settings.CustomerName, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Could not check exposed NSGs (stateKey={Key}).", stateKey);
        }
    }

    // ── Daily digest across all tenants ─────────────────────────────────────

    private async Task TrySendDailyDigestAsync(CancellationToken ct)
    {
        // Send once per day after 08:00 UTC
        var now = DateTimeOffset.UtcNow;
        if (now.Hour < 8) return;
        if ((now - _lastDailyDigest).TotalHours < 20) return;

        var settings = operationsScope.GetTeamsSettings();
        if (!settings.AlertsEnabled || string.IsNullOrWhiteSpace(settings.WebhookUrl)) return;

        try
        {
            using var scope = scopeFactory.CreateScope();
            var thresholdService = scope.ServiceProvider.GetRequiredService<IAlertThresholdService>();
            var openBreaches = await thresholdService.GetOpenBreachesAcrossAllTenantsAsync(ct);

            if (openBreaches.Count == 0)
            {
                await SendDigestAsync(settings.WebhookUrl, openBreaches, scope, ct);
            }
            else
            {
                await SendDigestAsync(settings.WebhookUrl, openBreaches, scope, ct);
            }

            _lastDailyDigest = now;
            logger.LogInformation("Daily alert digest sent. Open breaches: {Count}", openBreaches.Count);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Daily digest failed.");
        }
    }

    private async Task SendDigestAsync(
        string webhookUrl,
        IReadOnlyList<Application.Contracts.ThresholdBreachDto> openBreaches,
        IServiceScope scope,
        CancellationToken ct)
    {
        var teamsService = scope.ServiceProvider.GetRequiredService<TeamsNotificationService>();
        var settings = operationsScope.GetTeamsSettings();

        if (openBreaches.Count == 0)
        {
            await teamsService.SendCriticalAlertAsync(
                webhookUrl,
                "✅ Daily Alert Digest — All Clear",
                "No open threshold breaches across any customer tenant. All monitored metrics are within configured limits.",
                "Low", settings.CustomerName, ct);
            return;
        }

        var critical = openBreaches.Count(b => b.Severity == "Critical");
        var high = openBreaches.Count(b => b.Severity == "High");
        var tenants = openBreaches.Select(b => b.TenantId).Distinct().Count();

        var body = new StringBuilder();
        body.AppendLine($"**{openBreaches.Count} open breach{(openBreaches.Count != 1 ? "es" : "")} across {tenants} tenant{(tenants != 1 ? "s" : "")}**\n");
        if (critical > 0) body.AppendLine($"🔴 Critical: {critical}");
        if (high > 0) body.AppendLine($"🟡 High: {high}");
        body.AppendLine();

        // Top 5 by severity then recency
        var top = openBreaches
            .OrderByDescending(b => b.Severity == "Critical" ? 2 : b.Severity == "High" ? 1 : 0)
            .ThenByDescending(b => b.BreachedAt)
            .Take(5);

        foreach (var breach in top)
        {
            var age = (DateTimeOffset.UtcNow - breach.BreachedAt).TotalHours;
            var ageStr = age < 1 ? "< 1h ago" : $"{(int)age}h ago";
            body.AppendLine($"• **{breach.AlertTitle ?? breach.MetricType}** · {ageStr}");
        }

        body.AppendLine("\nOpen NightWatch to review and acknowledge alerts.");

        await teamsService.SendCriticalAlertAsync(
            webhookUrl,
            $"⚠️ Daily Alert Digest — {openBreaches.Count} Open Issue{(openBreaches.Count != 1 ? "s" : "")}",
            body.ToString(),
            critical > 0 ? "Critical" : "High",
            settings.CustomerName, ct);
    }

    private static Dictionary<string, DateTimeOffset> DeserializeAlertState(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<Dictionary<string, DateTimeOffset>>(json) ?? []; }
        catch { return []; }
    }
}
