using System.Text.Json;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using NightWatch.Infrastructure.Abstractions;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace NightWatch.Infrastructure.Services;

public static class ReportServiceDefaults
{
    public const string AiBriefingPrompt =
        "Write an executive briefing for senior leadership in exactly two parts. Do not output the part labels themselves.\n\n" +
        "Start directly with 2-3 concise paragraphs covering overall environment health, top concerns, cost efficiency highlights, and a forward-looking observation. Use clear non-technical language. No bullet points, no markdown formatting.\n\n" +
        "Then output this exact separator on its own line:\n" +
        "---ACTION PLAN---\n\n" +
        "Then output the action plan with plain text headers and exactly 3 bullets each:\n" +
        "IMMEDIATE (0 – 24 Hours):\n" +
        "• [urgent action 1]\n" +
        "• [urgent action 2]\n" +
        "• [urgent action 3]\n\n" +
        "THIS WEEK:\n" +
        "• [important action 1]\n" +
        "• [important action 2]\n" +
        "• [important action 3]\n\n" +
        "THIS MONTH:\n" +
        "• [strategic action 1]\n" +
        "• [strategic action 2]\n" +
        "• [strategic action 3]\n\n" +
        "OUTPUT RULES: (1) Separate Part 1 and Part 2 with exactly the line ---ACTION PLAN--- on its own line. " +
        "(2) After the last THIS MONTH bullet, output nothing else — no numbered lists, no data quality notes, no closing remarks, no additional sections.";
}

public sealed class ReportService(
    INightWatchInsightsService insights,
    IAiSummaryService aiSummaryService,
    IOperationsScopeService operationsScopeService,
    ILogger<ReportService> logger) : IReportService
{
    public async Task<string> GenerateHtmlReportAsync(string tenantId, ReportOptions options, CancellationToken cancellationToken = default)
    {
        var data = await GatherDataAsync(tenantId, options, cancellationToken);
        return HtmlReportBuilder.Build(data);
    }

    public async Task<byte[]> GeneratePdfReportAsync(string tenantId, ReportOptions options, CancellationToken cancellationToken = default)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var data = await GatherDataAsync(tenantId, options, cancellationToken);
        return PdfReportBuilder.Build(data);
    }

    private async Task<HtmlReportBuilder.ReportData> GatherDataAsync(string tenantId, ReportOptions options, CancellationToken ct)
    {
        var executiveTask    = Safe(() => insights.GetExecutiveDashboardAsync(tenantId, ct));
        var securityTask     = Safe(() => insights.GetSecurityDashboardAsync(tenantId, ct));
        var costTask         = Safe(() => insights.GetCostDashboardAsync(tenantId, ct));
        var performanceTask  = Safe(() => insights.GetPerformanceDashboardAsync(tenantId, ct));
        var governanceTask   = Safe(() => insights.GetGovernanceDashboardAsync(tenantId, ct));
        var drTask           = Safe(() => insights.GetDrDashboardAsync(tenantId, ct));
        var capacityTask     = Safe(() => insights.GetCapacityPlanningDashboardAsync(tenantId, "30d", ct));
        var quickWinsTask    = Safe(() => insights.GetQuickWinsDashboardAsync(tenantId, ct));
        var topCostlyTask    = Safe(() => insights.GetTopCostlyResourcesDashboardAsync(tenantId, ct));
        var wastageTask      = Safe(() => insights.GetWastageTrackerDashboardAsync(tenantId, ct));
        var orphanedTask     = Safe(() => insights.GetOrphanedResourcesDashboardAsync(tenantId, ct));
        var backupTask       = Safe(() => insights.GetBackupHealthDashboardAsync(tenantId, ct));
        var iamTask          = Safe(() => insights.GetIamReviewDashboardAsync(tenantId, ct));
        var tagsTask         = Safe(() => insights.GetTagHygieneDashboardAsync(tenantId, ct));
        var networkTask      = Safe(() => insights.GetNetworkPerimeterDashboardAsync(tenantId, ct));
        var riSavingsTask    = Safe(() => insights.GetRiSavingsDashboardAsync(tenantId, ct));
        var nonProdTask      = Safe(() => insights.GetNonProdUptimeDashboardAsync(tenantId, ct));
        var appFunctionsTask = Safe(() => insights.GetAppFunctionsHealthDashboardAsync(tenantId, ct));
        var policyTask       = Safe(() => insights.GetAzPolicyLensDashboardAsync(tenantId, ct));
        var supportTask      = Safe(() => insights.GetSupportTicketDashboardAsync(tenantId, ct));

        await Task.WhenAll(executiveTask, securityTask, costTask, performanceTask, governanceTask,
            drTask, capacityTask, quickWinsTask, topCostlyTask, wastageTask, orphanedTask,
            backupTask, iamTask, tagsTask, networkTask, riSavingsTask, nonProdTask,
            appFunctionsTask, policyTask, supportTask);

        var executive    = await executiveTask    ?? EmptyExecutive(tenantId);
        var security     = await securityTask     ?? EmptySecurity();
        var cost         = await costTask         ?? EmptyCost();
        var performance  = await performanceTask  ?? EmptyPerformance();
        var governance   = await governanceTask   ?? EmptyGovernance();
        var dr           = await drTask           ?? EmptyDr(tenantId);
        var capacity     = await capacityTask     ?? EmptyCapacity();
        var quickWins    = await quickWinsTask    ?? EmptyQuickWins();
        var topCostly    = await topCostlyTask    ?? EmptyTopCostly(tenantId);
        var wastage      = await wastageTask      ?? EmptyWastage(tenantId);
        var orphaned     = await orphanedTask     ?? EmptyOrphaned(tenantId);
        var backup       = await backupTask       ?? EmptyBackup(tenantId);
        var iam          = await iamTask          ?? EmptyIam(tenantId);
        var tags         = await tagsTask         ?? EmptyTagHygiene(tenantId);
        var network      = await networkTask      ?? EmptyNetwork(tenantId);
        var riSavings    = await riSavingsTask    ?? EmptyRiSavings(tenantId);
        var nonProd      = await nonProdTask      ?? EmptyNonProd(tenantId);
        var appFunctions = await appFunctionsTask ?? EmptyAppFunctions(tenantId);
        var policy       = await policyTask       ?? EmptyPolicy(tenantId);
        var support      = await supportTask      ?? EmptySupport(tenantId);

        string? aiSummary = null;
        string? aiActionPlan = null;
        if (options.AiEnabled)
        {
            (aiSummary, aiActionPlan) = await GenerateEnvironmentBriefingAsync(executive, security, cost, dr, governance, ct);
        }

        return new HtmlReportBuilder.ReportData(
            executive, security, cost, performance, governance,
            dr, capacity, quickWins, topCostly, wastage,
            orphaned, backup, iam, tags, network,
            riSavings, nonProd, appFunctions, policy, support,
            aiSummary, aiActionPlan, tenantId, options.TenantDisplayName, DateTimeOffset.UtcNow, options.MspName);
    }

    private async Task<(string? Summary, string? ActionPlan)> GenerateEnvironmentBriefingAsync(
        ExecutiveDashboardDto executive,
        SecurityDashboardDto security,
        CostDashboardDto cost,
        DrDashboardDto dr,
        GovernanceDashboardDto governance,
        CancellationToken ct)
    {
        try
        {
            var scope = operationsScopeService.GetCurrent();
            if (string.Equals(scope.AiTarget.Target, "none", StringComparison.OrdinalIgnoreCase))
                return (null, null);

            var briefingPayload = new
            {
                reportType = "morning_environment_briefing",
                requestedFormat = "structured_briefing_with_action_plan",
                instructions = operationsScopeService.GetAiBriefingPrompt() ?? ReportServiceDefaults.AiBriefingPrompt,
                azureHealthScore = executive.AzureHealthScore,
                securityPostureScore = executive.SecurityPostureScore,
                performanceScore = executive.PerformanceScore,
                costEfficiencyScore = executive.CostEfficiencyScore,
                reliabilityScore = executive.ReliabilityScore,
                governanceComplianceScore = executive.GovernanceComplianceScore,
                executiveSummary = executive.ExecutiveSummary,
                backupCoveragePercent = executive.BackupCoveragePercent,
                protectedWorkloads = executive.ProtectedWorkloads,
                totalStatefulWorkloads = executive.TotalStatefulWorkloads,
                currentMonthCostEur = cost.CurrentMonthCost,
                predictedNextMonthCostEur = cost.PredictedNextMonthCost,
                costSpikeAlerts = cost.CostSpikeAlerts.Take(3),
                securityFindingsCount = security.Findings.Count(),
                highSeverityFindings = security.Findings
                    .Where(f => f.RiskLevel is RiskLevel.Critical or RiskLevel.High)
                    .Take(3).Select(f => f.Title),
                drReadinessScore = dr.DrReadinessScore,
                rpoCompliancePercent = dr.RpoCompliancePercent,
                rtoCompliancePercent = dr.RtoCompliancePercent,
                workloadsFailingCompliance = dr.WorkloadsFailingCompliance,
                tagCompliancePercent = governance.TagCompliancePercent,
                landingZoneCompliancePercent = governance.LandingZoneCompliancePercent,
                generatedAtUtc = DateTimeOffset.UtcNow,
            };

            var json = JsonSerializer.Serialize(briefingPayload);
            var result = await aiSummaryService.SummarizeWithUsageAsync(json, scope.AiTarget, ct);

            if (result.Usage is not null)
                operationsScopeService.RecordAiUsage(result.Usage);

            var summary = result.Summary;
            if (summary.StartsWith("AI summarization target is not configured", StringComparison.OrdinalIgnoreCase))
                return (null, null);

            // Try several separator variations the AI might produce
            string[] separators = ["---ACTION PLAN---", "--- ACTION PLAN ---", "--ACTION PLAN--", "**ACTION PLAN**", "## ACTION PLAN", "## Action Plan", "**Action Plan**"];
            var sepIndex = -1;
            var matchedSep = "";
            foreach (var sep in separators)
            {
                var idx = summary.IndexOf(sep, StringComparison.OrdinalIgnoreCase);
                if (idx >= 0) { sepIndex = idx; matchedSep = sep; break; }
            }

            if (sepIndex >= 0)
            {
                var narrative = summary[..sepIndex].Trim();
                var actionPlan = summary[(sepIndex + matchedSep.Length)..].Trim();
                return (narrative, actionPlan);
            }

            // Fallback: if horizon markers appear in the text, split there
            var horizonKeys = new[] { "IMMEDIATE (0", "THIS WEEK:", "THIS MONTH:", "Immediate (0", "This Week:", "This Month:" };
            var firstHorizonIdx = horizonKeys
                .Select(k => summary.IndexOf(k, StringComparison.OrdinalIgnoreCase))
                .Where(i => i >= 0)
                .DefaultIfEmpty(-1)
                .Min();

            if (firstHorizonIdx > 50)
                return (summary[..firstHorizonIdx].Trim(), summary[firstHorizonIdx..].Trim());

            return (summary.Trim(), null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to generate AI environment briefing; proceeding without AI summary.");
            return (null, null);
        }
    }

    private async Task<T?> Safe<T>(Func<Task<T>> factory) where T : class
    {
        try { return await factory(); }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Dashboard fetch failed; using empty fallback for {Type}.", typeof(T).Name);
            return null;
        }
    }

    // ── Fallback factories ───────────────────────────────────────────────────────
    private static ExecutiveDashboardDto EmptyExecutive(string t) =>
        new(t, 0, 0, 0, 0, 0, 0, "Data unavailable.", [], [], 0, 0, 0, 0);
    private static SecurityDashboardDto EmptySecurity() =>
        new([], [], [], [], [], []);
    private static CostDashboardDto EmptyCost() =>
        new(0, 0, [], [], 0, [], [], [], []);
    private static PerformanceDashboardDto EmptyPerformance() =>
        new(0, [], [], [], [], [], [], [], [], [], 0, "Unknown", []);
    private static GovernanceDashboardDto EmptyGovernance() =>
        new(0, 0, 0, [], [], [], [], [], []);
    private static DrDashboardDto EmptyDr(string t) =>
        new(t, DateTimeOffset.UtcNow, new(60, 120, new(90, 75, 60, 85), [], []), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, [], [], [], [], [], []);
    private static CapacityPlanningDashboardDto EmptyCapacity() =>
        new("", "", "", "30d", DateTimeOffset.UtcNow, [], [], [], [], [], "", "", "", "", []);
    private static QuickWinsDashboardDto EmptyQuickWins() =>
        new(DateTimeOffset.UtcNow, 0, 0, [], []);
    private static TopCostlyResourcesDashboardDto EmptyTopCostly(string t) =>
        new(t, [], 0, DateTimeOffset.UtcNow);
    private static WastageTrackerDashboardDto EmptyWastage(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, []);
    private static OrphanedResourcesDashboardDto EmptyOrphaned(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, []);
    private static BackupHealthDashboardDto EmptyBackup(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, []);
    private static IamReviewDashboardDto EmptyIam(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, [], []);
    private static TagHygieneDashboardDto EmptyTagHygiene(string t) =>
        new(t, DateTimeOffset.UtcNow, 100, 0, 0, [], []);
    private static NetworkPerimeterDashboardDto EmptyNetwork(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, 0, []);
    private static RiSavingsDashboardDto EmptyRiSavings(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, []);
    private static NonProdUptimeDashboardDto EmptyNonProd(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, []);
    private static AppFunctionsHealthDashboardDto EmptyAppFunctions(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, []);
    private static AzPolicyLensDashboardDto EmptyPolicy(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, 0, 100, 0, 0, 0, [], [], [], []);
    private static SupportTicketDashboardDto EmptySupport(string t) =>
        new(t, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, []);
}
