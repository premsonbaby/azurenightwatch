using NightWatch.Application.Contracts;

namespace NightWatch.Infrastructure.Services;

internal static class HtmlReportBuilder
{
    private const string OwlSvg =
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" style=\"display:block;flex-shrink:0\">" +
        "<defs>" +
        "<radialGradient id=\"nw-bg\" cx=\"50%\" cy=\"40%\" r=\"55%\"><stop offset=\"0%\" stop-color=\"#1e293b\"/><stop offset=\"100%\" stop-color=\"#0a0f1e\"/></radialGradient>" +
        "<radialGradient id=\"nw-eL\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0%\" stop-color=\"#67e8f9\"/><stop offset=\"55%\" stop-color=\"#06b6d4\" stop-opacity=\"0.9\"/><stop offset=\"100%\" stop-color=\"#0891b2\" stop-opacity=\"0.4\"/></radialGradient>" +
        "<radialGradient id=\"nw-eR\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0%\" stop-color=\"#67e8f9\"/><stop offset=\"55%\" stop-color=\"#06b6d4\" stop-opacity=\"0.9\"/><stop offset=\"100%\" stop-color=\"#0891b2\" stop-opacity=\"0.4\"/></radialGradient>" +
        "<radialGradient id=\"nw-pu\" cx=\"35%\" cy=\"35%\" r=\"60%\"><stop offset=\"0%\" stop-color=\"#1e3a5f\"/><stop offset=\"100%\" stop-color=\"#040d1a\"/></radialGradient>" +
        "<linearGradient id=\"nw-bd\" x1=\"0%\" y1=\"0%\" x2=\"0%\" y2=\"100%\"><stop offset=\"0%\" stop-color=\"#334155\"/><stop offset=\"100%\" stop-color=\"#1e293b\"/></linearGradient>" +
        "<filter id=\"nw-eg\" x=\"-50%\" y=\"-50%\" width=\"200%\" height=\"200%\"><feGaussianBlur stdDeviation=\"1.5\" result=\"blur\"/><feMerge><feMergeNode in=\"blur\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter>" +
        "<filter id=\"nw-rg\" x=\"-10%\" y=\"-10%\" width=\"120%\" height=\"120%\"><feGaussianBlur stdDeviation=\"1\" result=\"blur\"/><feMerge><feMergeNode in=\"blur\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter>" +
        "<clipPath id=\"nw-cl\"><circle cx=\"32\" cy=\"32\" r=\"30\"/></clipPath>" +
        "</defs>" +
        "<circle cx=\"32\" cy=\"32\" r=\"31\" fill=\"none\" stroke=\"#06b6d4\" stroke-width=\"0.5\" stroke-opacity=\"0.5\" filter=\"url(#nw-rg)\"/>" +
        "<circle cx=\"32\" cy=\"32\" r=\"30\" fill=\"url(#nw-bg)\"/>" +
        "<g clip-path=\"url(#nw-cl)\" opacity=\"0.4\"><circle cx=\"12\" cy=\"14\" r=\"0.7\" fill=\"#94a3b8\"/><circle cx=\"52\" cy=\"10\" r=\"0.5\" fill=\"#94a3b8\"/><circle cx=\"8\" cy=\"44\" r=\"0.6\" fill=\"#94a3b8\"/><circle cx=\"56\" cy=\"48\" r=\"0.5\" fill=\"#94a3b8\"/><circle cx=\"20\" cy=\"8\" r=\"0.4\" fill=\"#7dd3fc\"/><circle cx=\"46\" cy=\"16\" r=\"0.4\" fill=\"#7dd3fc\"/><circle cx=\"57\" cy=\"30\" r=\"0.5\" fill=\"#94a3b8\"/><circle cx=\"7\" cy=\"28\" r=\"0.4\" fill=\"#94a3b8\"/></g>" +
        "<g clip-path=\"url(#nw-cl)\"><circle cx=\"50\" cy=\"11\" r=\"5.5\" fill=\"#1e3a5f\" opacity=\"0.9\"/><circle cx=\"52\" cy=\"10\" r=\"4.2\" fill=\"#0a0f1e\"/></g>" +
        "<ellipse cx=\"32\" cy=\"44\" rx=\"14\" ry=\"13\" fill=\"url(#nw-bd)\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M18 46 Q10 38 14 52 Q18 58 22 54 Z\" fill=\"#1e293b\" opacity=\"0.85\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M46 46 Q54 38 50 52 Q46 58 42 54 Z\" fill=\"#1e293b\" opacity=\"0.85\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M24 24 L21 16 L26 22 Z\" fill=\"#334155\"/><path d=\"M40 24 L43 16 L38 22 Z\" fill=\"#334155\"/>" +
        "<circle cx=\"32\" cy=\"30\" r=\"14\" fill=\"#2d3f55\"/>" +
        "<ellipse cx=\"32\" cy=\"31\" rx=\"11\" ry=\"10\" fill=\"#3b5068\" opacity=\"0.6\"/>" +
        "<circle cx=\"25.5\" cy=\"30\" r=\"7\" fill=\"#0f1e35\"/><circle cx=\"38.5\" cy=\"30\" r=\"7\" fill=\"#0f1e35\"/>" +
        "<circle cx=\"25.5\" cy=\"30\" r=\"5.8\" fill=\"url(#nw-eL)\" filter=\"url(#nw-eg)\"/>" +
        "<circle cx=\"38.5\" cy=\"30\" r=\"5.8\" fill=\"url(#nw-eR)\" filter=\"url(#nw-eg)\"/>" +
        "<circle cx=\"25.5\" cy=\"30\" r=\"3.2\" fill=\"url(#nw-pu)\"/><circle cx=\"38.5\" cy=\"30\" r=\"3.2\" fill=\"url(#nw-pu)\"/>" +
        "<circle cx=\"24\" cy=\"28.5\" r=\"1\" fill=\"#e0f7ff\" opacity=\"0.9\"/><circle cx=\"26.5\" cy=\"31.5\" r=\"0.4\" fill=\"#ffffff\" opacity=\"0.5\"/>" +
        "<circle cx=\"37\" cy=\"28.5\" r=\"1\" fill=\"#e0f7ff\" opacity=\"0.9\"/><circle cx=\"39.5\" cy=\"31.5\" r=\"0.4\" fill=\"#ffffff\" opacity=\"0.5\"/>" +
        "<path d=\"M30.5 33.5 L32 37 L33.5 33.5 Z\" fill=\"#f59e0b\" opacity=\"0.9\"/>" +
        "<ellipse cx=\"32\" cy=\"46\" rx=\"7\" ry=\"6\" fill=\"#3b5068\" opacity=\"0.5\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M27 43 Q32 40 37 43 Q32 46 27 43Z\" fill=\"#475569\" opacity=\"0.4\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M26 47 Q32 44 38 47 Q32 50 26 47Z\" fill=\"#475569\" opacity=\"0.4\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M27 56 Q25 58 23 57 Q24 55 27 56Z\" fill=\"#1e3a4c\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M27 56 Q27 59 25 60 Q25 57 27 56Z\" fill=\"#1e3a4c\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M37 56 Q39 58 41 57 Q40 55 37 56Z\" fill=\"#1e3a4c\" clip-path=\"url(#nw-cl)\"/>" +
        "<path d=\"M37 56 Q37 59 39 60 Q39 57 37 56Z\" fill=\"#1e3a4c\" clip-path=\"url(#nw-cl)\"/>" +
        "<circle cx=\"32\" cy=\"32\" r=\"30\" fill=\"none\" stroke=\"#0e7490\" stroke-width=\"1\" opacity=\"0.6\"/>" +
        "</svg>";

    internal sealed record ReportData(
        ExecutiveDashboardDto Executive,
        SecurityDashboardDto Security,
        CostDashboardDto Cost,
        PerformanceDashboardDto Performance,
        GovernanceDashboardDto Governance,
        DrDashboardDto Dr,
        CapacityPlanningDashboardDto Capacity,
        QuickWinsDashboardDto QuickWins,
        TopCostlyResourcesDashboardDto TopCostly,
        WastageTrackerDashboardDto Wastage,
        OrphanedResourcesDashboardDto Orphaned,
        BackupHealthDashboardDto BackupHealth,
        IamReviewDashboardDto IamReview,
        TagHygieneDashboardDto TagHygiene,
        NetworkPerimeterDashboardDto NetworkPerimeter,
        RiSavingsDashboardDto RiSavings,
        NonProdUptimeDashboardDto NonProdUptime,
        AppFunctionsHealthDashboardDto AppFunctions,
        AzPolicyLensDashboardDto PolicyLens,
        SupportTicketDashboardDto SupportTickets,
        string? AiEnvironmentSummary,
        string? AiActionPlan,
        string TenantId,
        string? TenantDisplayName,
        DateTimeOffset GeneratedAt,
        string? MspName = null);

    private static string Esc(string? s) =>
        s is null ? string.Empty : s
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;");

    private static string ScoreColor(decimal score) => score switch
    {
        >= 80 => "#10b981",
        >= 60 => "#f59e0b",
        _ => "#ef4444"
    };

    private static string ScoreLabel(decimal score) => score switch
    {
        >= 80 => "Good",
        >= 60 => "Warning",
        _ => "Critical"
    };

    private static string If(bool condition, string html) => condition ? html : string.Empty;

    private static string Table(string headers, string rows, string? title = null) =>
        $"{(title is not null ? $"<h3 class=\"sub-heading\">{title}</h3>" : string.Empty)}" +
        $"<table><thead><tr>{headers}</tr></thead><tbody>{rows}</tbody></table>";

    private static string Th(string label) => $"<th>{Esc(label)}</th>";
    private static string Td(string value) => $"<td>{Esc(value)}</td>";
    private static string TdC(string value, string color) => $"<td style=\"color:{color}\">{Esc(value)}</td>";
    private static string TdH(string inner) => $"<td>{inner}</td>";

    private static string Chip(string label, string value, string? color = null) =>
        color is not null
            ? $"<div class=\"metric-chip\">{Esc(label)} <strong style=\"color:{color}\">{value}</strong></div>"
            : $"<div class=\"metric-chip\">{Esc(label)} <strong>{value}</strong></div>";

    private static string TruncNote(int total, int cap) =>
        total > cap
            ? $"<p class=\"truncation-note\">Showing top {cap} of {total} items</p>"
            : string.Empty;

    private static string CurrencySymbol(string? code) => (code ?? "EUR").ToUpperInvariant() switch
    {
        "USD" => "$",
        "GBP" => "£",
        "JPY" => "¥",
        "CHF" => "CHF ",
        "CAD" => "CA$",
        "AUD" => "A$",
        "SEK" or "NOK" or "DKK" => "kr ",
        _ => "€"
    };

    public static string Build(ReportData data)
    {
        var sections = new List<(string id, string label, string html)>();

        if (!string.IsNullOrWhiteSpace(data.AiEnvironmentSummary))
            sections.Add(("ai-summary", "AI Environment Summary", BuildAiSummarySection(data.AiEnvironmentSummary, data.GeneratedAt)));

        if (!string.IsNullOrWhiteSpace(data.AiActionPlan))
            sections.Add(("ai-action-plan", "Action Plan by Horizon", BuildAiActionPlanSection(data.AiActionPlan)));

        sections.Add(("executive", "Executive Scorecard", BuildExecutiveSection(data.Executive)));
        sections.Add(("security", "Security", BuildSecuritySection(data.Security)));
        sections.Add(("cost", "Cost Management", BuildCostSection(data.Cost)));
        sections.Add(("performance", "Performance", BuildPerformanceSection(data.Performance)));
        sections.Add(("governance", "Governance", BuildGovernanceSection(data.Governance)));
        sections.Add(("dr", "DR Recoverability", BuildDrSection(data.Dr)));
        sections.Add(("capacity", "Capacity Planning", BuildCapacitySection(data.Capacity)));
        var reportCurrency = data.Cost?.Currency ?? data.TopCostly?.Currency ?? "EUR";
        sections.Add(("quick-wins", "Quick Wins", BuildQuickWinsSection(data.QuickWins, reportCurrency)));
        sections.Add(("top-costly", "Top Costly Resources", BuildTopCostlySection(data.TopCostly)));
        sections.Add(("wastage", "Wastage Tracker", BuildWastageSection(data.Wastage)));
        sections.Add(("orphaned", "Orphaned Resources", BuildOrphanedSection(data.Orphaned, reportCurrency)));
        sections.Add(("backup", "Backup Health", BuildBackupSection(data.BackupHealth)));
        sections.Add(("iam", "IAM Review", BuildIamSection(data.IamReview)));
        sections.Add(("tags", "Tag Hygiene", BuildTagHygieneSection(data.TagHygiene)));
        sections.Add(("network", "Network Perimeter", BuildNetworkSection(data.NetworkPerimeter)));
        sections.Add(("ri-savings", "RI & Savings", BuildRiSavingsSection(data.RiSavings)));
        sections.Add(("nonprod", "Non-Prod Uptime", BuildNonProdSection(data.NonProdUptime)));
        sections.Add(("apps", "App & Functions Health", BuildAppFunctionsSection(data.AppFunctions)));
        sections.Add(("policy", "Policy Radar", BuildPolicySection(data.PolicyLens)));
        sections.Add(("support", "Support Tickets", BuildSupportSection(data.SupportTickets)));

        var navLinks = string.Join("\n",
            sections.Select(s => $"<a href=\"#{Esc(s.id)}\" onclick=\"navTo('{Esc(s.id)}');return false;\">{Esc(s.label)}</a>"));

        var mainContent = string.Join("\n", sections.Select(s => s.html));

        return "<!DOCTYPE html>\n" +
               "<html lang=\"en\">\n" +
               "<head>\n" +
               "  <meta charset=\"utf-8\"/>\n" +
               "  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>\n" +
               $"  <title>Azure Night Watch — Operations Report — {data.GeneratedAt:yyyy-MM-dd}</title>\n" +
               $"  <style>{Css()}</style>\n" +
               "</head>\n" +
               "<body>\n" +
               "  <nav class=\"sidebar\">\n" +
               "    <div class=\"sidebar-brand\"><div class=\"brand-title\">Azure Night Watch</div><div class=\"brand-sub\">Operations Intelligence</div></div>\n" +
               $"    <div class=\"nav-links\">{navLinks}</div>\n" +
               $"    <div class=\"sidebar-footer\">Generated {data.GeneratedAt:yyyy-MM-dd HH:mm} UTC<br/>{Esc(!string.IsNullOrWhiteSpace(data.TenantDisplayName) ? data.TenantDisplayName : !string.IsNullOrWhiteSpace(data.MspName) ? data.MspName : "Home Tenant")}</div>\n" +
               "  </nav>\n" +
               "  <main class=\"content\">\n" +
               $"    <div class=\"report-header\">{OwlSvg}<div class=\"report-header-text\"><div class=\"report-header-title\">Azure Night Watch</div><div class=\"report-header-sub\">Operations Intelligence Report</div></div>" +
               $"<div class=\"report-header-right\"><div class=\"report-header-tenant\">{Esc(!string.IsNullOrWhiteSpace(data.TenantDisplayName) ? data.TenantDisplayName : !string.IsNullOrWhiteSpace(data.MspName) ? data.MspName : "Home Tenant")}</div>{(!string.IsNullOrWhiteSpace(data.MspName) && !string.IsNullOrWhiteSpace(data.TenantDisplayName) ? $"<div class=\"report-header-msp\" style=\"font-size:11px;color:#94a3b8;margin-top:2px\">Prepared by {Esc(data.MspName)}</div>" : "")}<div class=\"report-header-date\">Generated {data.GeneratedAt:yyyy-MM-dd HH:mm} UTC</div></div></div>\n" +
               $"    {mainContent}\n" +
               "  </main>\n" +
               $"  <script>{Js()}</script>\n" +
               "</body>\n</html>";
    }

    private static string BuildAiSummarySection(string summary, DateTimeOffset generatedAt)
    {
        var paragraphs = string.Join("\n",
            summary.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                   .Where(p => !string.IsNullOrWhiteSpace(p))
                   .Select(p => $"<p>{Esc(p.Trim())}</p>"));

        return "<section id=\"ai-summary\" class=\"ai-summary-section\">" +
               $"<div class=\"ai-body\">{paragraphs}</div>" +
               "</section>";
    }

    private static string BuildAiActionPlanSection(string actionPlan)
    {
        var (horizons, tail) = ParseHtmlHorizons(actionPlan);

        var boxes = string.Join("", horizons.Select(h =>
        {
            var items = string.Join("", h.Items.Select(i =>
                $"<li>{Esc(i.TrimStart('•', '-', '▶', ' '))}</li>"));

            return $"<div class=\"horizon-box {h.CssClass}\">" +
                   $"<div class=\"horizon-header\"><div class=\"horizon-label\">{Esc(h.Label)}</div>" +
                   $"<div class=\"horizon-period\">{Esc(h.Period)}</div></div>" +
                   $"<ul class=\"horizon-items\">{items}</ul></div>";
        }));

        var tailHtml = tail.Count > 0
            ? "<div class=\"ai-notes\">" +
              string.Join("", tail.Select(l => $"<p>{Esc(l.TrimStart('•', '-', '▶', ' '))}</p>")) +
              "</div>"
            : "";

        return "<section id=\"ai-action-plan\" class=\"ai-summary-section\">" +
               "<div class=\"ai-header\"><div class=\"ai-icon\">&#x1F3AF;</div><div>" +
               "<h2 class=\"section-title ai-title\">Action Plan by Horizon</h2>" +
               "<p class=\"section-sub\">AI-generated prioritised actions for immediate, short, and medium-term execution</p>" +
               "</div></div>" +
               $"<div class=\"horizon-grid\">{boxes}</div>" +
               tailHtml +
               "</section>";
    }

    private sealed record HorizonBlock(string Label, string Period, string CssClass, List<string> Items);

    private static (List<HorizonBlock> Blocks, List<string> Tail) ParseHtmlHorizons(string text)
    {
        var defs = new (string Key, string Label, string Period, string Css)[]
        {
            ("IMMEDIATE", "Immediate", "0 – 24 Hours", "horizon-immediate"),
            ("THIS WEEK",  "This Week",  "Short-Term",       "horizon-short"),
            ("THIS MONTH", "This Month", "Medium-Term",      "horizon-medium"),
        };

        var blocks = new List<HorizonBlock>();
        var tail = new List<string>();
        int currentIdx = -1;
        var currentItems = new List<string>();
        bool inTail = false;

        void Flush()
        {
            if (currentIdx < 0) return;
            var def = defs[currentIdx];
            var kept = currentItems.Where(l => l.Length > 2).ToList();
            if (kept.Count > 0)
                blocks.Add(new HorizonBlock(def.Label, def.Period, def.Css, kept));
            currentItems = [];
            currentIdx = -1;
        }

        foreach (var rawLine in text.Split('\n'))
        {
            if (inTail)
            {
                var tl = rawLine.Trim();
                if (tl.Length > 2) tail.Add(tl);
                continue;
            }

            // Strip markdown decorators before header detection
            var stripped = rawLine.Trim().TrimStart('*', '#', ' ');

            int matchIdx = -1;
            for (int i = 0; i < defs.Length; i++)
            {
                if (stripped.StartsWith(defs[i].Key, StringComparison.OrdinalIgnoreCase))
                { matchIdx = i; break; }
            }

            if (matchIdx >= 0)
            {
                Flush();
                currentIdx = matchIdx;
                continue;
            }

            var trimmed = rawLine.Trim();

            // Numbered section header (e.g. "10) Data Quality...") → tail begins
            if (System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^\*{0,2}\d+[\.\)]"))
            {
                Flush();
                inTail = true;
                if (trimmed.Length > 2) tail.Add(trimmed);
                continue;
            }

            if (currentIdx >= 0 && trimmed.Length > 2)
                currentItems.Add(trimmed);
        }

        Flush();
        return (blocks, tail);
    }

    private static string BuildExecutiveSection(ExecutiveDashboardDto d)
    {
        static string Card(string label, decimal score) =>
            $"<div class=\"kpi-card\">" +
            $"<div class=\"kpi-value\" style=\"color:{ScoreColor(score)}\">{score:F0}</div>" +
            $"<div class=\"kpi-bar-bg\"><div class=\"kpi-bar\" style=\"width:{Math.Min(score, 100)}%;background:{ScoreColor(score)}\"></div></div>" +
            $"<div class=\"kpi-label\">{label}</div>" +
            $"<div class=\"kpi-status\" style=\"color:{ScoreColor(score)}\">{ScoreLabel(score)}</div>" +
            "</div>";

        var allHeatmap = d.SubscriptionRiskHeatmap.ToList();
        var heatmapRows = string.Join("", allHeatmap.Take(8).Select(c =>
        {
            var col = c.RiskLevel.ToString() switch { "Critical" or "High" => "#ef4444", "Medium" => "#f59e0b", _ => "#10b981" };
            return $"<tr>{Td(c.SubscriptionName)}{TdC(c.RiskLevel.ToString(), col)}</tr>";
        }));

        var heatmapTable = If(allHeatmap.Any(),
            Table(Th("Subscription") + Th("Risk Level"), heatmapRows, "Subscription Risk Heatmap") +
            TruncNote(allHeatmap.Count, 8));

        return "<section id=\"executive\">" +
               "<h2 class=\"section-title\">Executive Scorecard</h2>" +
               $"<p class=\"section-sub\">{Esc(d.ExecutiveSummary)}</p>" +
               $"<div class=\"kpi-grid\">{Card("Azure Health", d.AzureHealthScore)}{Card("Security Posture", d.SecurityPostureScore)}{Card("Performance", d.PerformanceScore)}{Card("Cost Efficiency", d.CostEfficiencyScore)}{Card("Reliability", d.ReliabilityScore)}{Card("Governance", d.GovernanceComplianceScore)}</div>" +
               $"<div class=\"metric-row\">{Chip("Backup Coverage", $"{d.BackupCoveragePercent:F1}%")}{Chip("Protected Workloads", $"{d.ProtectedWorkloads}/{d.TotalStatefulWorkloads}")}</div>" +
               heatmapTable +
               "</section>";
    }

    private static string BuildSecuritySection(SecurityDashboardDto d)
    {
        var metrics = string.Join("", d.Metrics.Take(6).Select(m =>
            Chip(m.Label, $"{m.Value?.ToString("F0") ?? "—"} {m.Unit}".Trim())));

        var allFindings = d.Findings.ToList();
        var findingRows = string.Join("", allFindings.Take(8).Select(f =>
        {
            var col = f.RiskLevel.ToString() switch { "Critical" or "High" => "#ef4444", "Medium" => "#f59e0b", _ => "#10b981" };
            return $"<tr>{TdC(f.RiskLevel.ToString(), col)}{Td(f.Title)}{Td(f.Impact)}</tr>";
        }));

        var allExposed = d.ExposedResources.ToList();
        var exposedRows = string.Join("", allExposed.Take(6).Select(r =>
            $"<tr>{Td(r.ResourceName)}{Td(r.Category)}{Td(r.Description)}</tr>"));

        var notes = If(d.CoverageNotes.Any(),
            $"<div class=\"notes\">{string.Join("<br/>", d.CoverageNotes.Select(Esc))}</div>");

        return "<section id=\"security\">" +
               "<h2 class=\"section-title\">Security</h2>" +
               $"<div class=\"metric-row\">{metrics}</div>" +
               If(allFindings.Any(), Table(Th("Severity") + Th("Finding") + Th("Details"), findingRows, "Security Findings") + TruncNote(allFindings.Count, 8)) +
               If(allExposed.Any(), Table(Th("Resource") + Th("Category") + Th("Description"), exposedRows, "Exposed Resources") + TruncNote(allExposed.Count, 6)) +
               notes +
               "</section>";
    }

    private static string BuildCostSection(CostDashboardDto d)
    {
        var sym = CurrencySymbol(d.Currency);
        var metrics = string.Join("", d.Metrics.Take(4).Select(m =>
            Chip(m.Label, $"{m.Value?.ToString("F0") ?? "—"} {m.Unit}".Trim())));

        var allRecs = d.Recommendations.ToList();
        var recItems = string.Join("", allRecs.Take(6).Select(r =>
            $"<li>{Esc(r.Description)} &mdash; <em>saves {sym}{r.EstimatedMonthlySavings:N0}/mo</em></li>"));

        var allAlerts = d.CostSpikeAlerts.ToList();
        var alertItems = string.Join("", allAlerts.Take(4).Select(a => $"<li>{Esc(a)}</li>"));

        return "<section id=\"cost\">" +
               "<h2 class=\"section-title\">Cost Management</h2>" +
               $"<div class=\"metric-row\">{Chip("Current Month", $"{sym}{d.CurrentMonthCost:N0}")}{Chip("Predicted Next Month", $"{sym}{d.PredictedNextMonthCost:N0}")}{Chip("Carbon Footprint", $"{d.CarbonFootprintKgCo2:N0} kg CO₂")}{metrics}</div>" +
               If(allRecs.Any(), $"<h3 class=\"sub-heading\">Cost Recommendations</h3><ul>{recItems}</ul>{TruncNote(allRecs.Count, 6)}") +
               If(allAlerts.Any(), $"<h3 class=\"sub-heading\">Cost Spike Alerts</h3><ul>{alertItems}</ul>{TruncNote(allAlerts.Count, 4)}") +
               "</section>";
    }

    private static string BuildPerformanceSection(PerformanceDashboardDto d)
    {
        var metrics = string.Join("", d.Metrics.Take(4).Select(m =>
            Chip(m.Label, $"{m.Value?.ToString("F0") ?? "—"} {m.Unit}".Trim())));

        var fragColor = d.FragilityIndex >= 70 ? "#ef4444" : d.FragilityIndex >= 40 ? "#f59e0b" : "#10b981";
        var allDrivers = d.FragilityDrivers.ToList();
        var driverItems = string.Join("", allDrivers.Take(5).Select(fd => $"<li>{Esc(fd)}</li>"));
        var allPreds = d.OutagePredictions.ToList();
        var predItems = string.Join("", allPreds.Take(4).Select(p => $"<li>{Esc(p)}</li>"));

        return "<section id=\"performance\">" +
               "<h2 class=\"section-title\">Performance</h2>" +
               $"<div class=\"metric-row\">{Chip("SLA Risk Score", $"{d.SlaRiskScore:F1}")}{Chip("Fragility Index", $"{d.FragilityIndex} &mdash; {Esc(d.FragilityRating)}", fragColor)}{metrics}</div>" +
               If(allDrivers.Any(), $"<h3 class=\"sub-heading\">Fragility Drivers</h3><ul>{driverItems}</ul>{TruncNote(allDrivers.Count, 5)}") +
               If(allPreds.Any(), $"<h3 class=\"sub-heading\">Outage Predictions</h3><ul>{predItems}</ul>{TruncNote(allPreds.Count, 4)}") +
               "</section>";
    }

    private static string BuildGovernanceSection(GovernanceDashboardDto d)
    {
        var allShame = d.WallOfShameItems.ToList();
        var shameRows = string.Join("", allShame.Take(8).Select(w =>
            $"<tr>{Td(w.ResourceName)}{Td(w.ResourceType)}{Td(w.SubscriptionName)}{TdC(w.ViolationCount.ToString(), "#ef4444")}{Td(string.Join(", ", w.Violations.Take(2)))}</tr>"));

        var allDrift = d.DriftAlerts.ToList();
        var driftNotes = If(allDrift.Any(),
            $"<div class=\"notes\"><strong>Drift Alerts:</strong> {string.Join(" &middot; ", allDrift.Take(3).Select(Esc))}</div>");

        return "<section id=\"governance\">" +
               "<h2 class=\"section-title\">Governance</h2>" +
               $"<div class=\"metric-row\">{Chip("Tag Compliance", $"{d.TagCompliancePercent:F1}%")}{Chip("Naming Compliance", $"{d.NamingCompliancePercent:F1}%")}{Chip("Landing Zone Compliance", $"{d.LandingZoneCompliancePercent:F1}%")}</div>" +
               If(allShame.Any(), Table(Th("Resource") + Th("Type") + Th("Subscription") + Th("Violations") + Th("Details"), shameRows, "Wall of Shame — Top Violators") + TruncNote(allShame.Count, 8)) +
               driftNotes +
               "</section>";
    }

    private static string BuildDrSection(DrDashboardDto d)
    {
        var drColor = ScoreColor(d.DrReadinessScore);

        var failRows = string.Join("", d.TopFailingWorkloads.Take(8).Select(w =>
        {
            var col = w.ComplianceStatus == "Compliant" ? "#10b981" : "#ef4444";
            return $"<tr>{Td(w.WorkloadName)}{Td(w.Environment)}{Td(w.Criticality)}{Td($"{w.AchievableRpoMinutes}m / {w.AchievableRtoMinutes}m")}{TdC(w.ComplianceStatus, col)}</tr>";
        }));

        var allRecs = d.ActionableRecommendations.ToList();
        var recItems = string.Join("", allRecs.Take(4).Select(Esc).Select(r => $"<li>{r}</li>"));

        return "<section id=\"dr\">" +
               "<h2 class=\"section-title\">DR Recoverability</h2>" +
               $"<div class=\"metric-row\">{Chip("DR Readiness Score", $"{d.DrReadinessScore:F1}", drColor)}{Chip("RPO Compliance", $"{d.RpoCompliancePercent:F1}%")}{Chip("RTO Compliance", $"{d.RtoCompliancePercent:F1}%")}{Chip("Protected Workloads", $"{d.TotalProtectedWorkloads}/{d.TotalWorkloadsAssessed}")}{Chip("Failing Compliance", d.WorkloadsFailingCompliance.ToString(), "#ef4444")}</div>" +
               If(d.TopFailingWorkloads.Any(), Table(Th("Workload") + Th("Env") + Th("Criticality") + Th("Achievable RPO/RTO") + Th("Status"), failRows, "Non-Compliant Workloads") + TruncNote(d.TopFailingWorkloads.Count, 8)) +
               If(allRecs.Any(), $"<ul>{recItems}</ul>{TruncNote(allRecs.Count, 4)}") +
               "</section>";
    }

    private static string BuildCapacitySection(CapacityPlanningDashboardDto d)
    {
        var metrics = string.Join("", d.Metrics.Take(4).Select(m =>
            Chip(m.Label, $"{m.Value?.ToString("F0") ?? "—"} {m.Unit}".Trim())));

        var runwayRows = string.Join("", d.RunwayForecast
            .OrderBy(r => r.DaysUntilExhaustion).Take(8).Select(r =>
        {
            var col = r.DaysUntilExhaustion < 30 ? "#ef4444" : r.DaysUntilExhaustion < 60 ? "#f59e0b" : "#10b981";
            return $"<tr>{Td(r.ResourceName)}{Td(r.ResourceType)}{Td(r.Metric)}{Td($"{r.CurrentUsagePercent:F1}%")}{TdC($"{r.DaysUntilExhaustion}d", col)}{Td(r.UrgencyLevel)}</tr>";
        }));

        var allRecs = d.Recommendations.ToList();
        var recItems = string.Join("", allRecs.Take(3).Select(Esc).Select(r => $"<li>{r}</li>"));

        return "<section id=\"capacity\">" +
               "<h2 class=\"section-title\">Capacity Planning</h2>" +
               $"<p class=\"section-sub\">{Esc(d.InsightCallout)}</p>" +
               $"<div class=\"metric-row\">{metrics}</div>" +
               If(d.RunwayForecast.Any(), Table(Th("Resource") + Th("Type") + Th("Metric") + Th("Usage") + Th("Days Left") + Th("Urgency"), runwayRows, "Capacity Runway Forecast") + TruncNote(d.RunwayForecast.Count, 8)) +
               If(allRecs.Any(), $"<ul>{recItems}</ul>{TruncNote(allRecs.Count, 3)}") +
               "</section>";
    }

    private static string BuildQuickWinsSection(QuickWinsDashboardDto d, string currency)
    {
        var sym = CurrencySymbol(currency);
        var rows = string.Join("", d.Items.OrderByDescending(i => i.EstimatedMonthlySavingsEur).Take(10).Select(i =>
        {
            var col = i.Priority switch { "High" or "Critical" => "#ef4444", "Medium" => "#f59e0b", _ => "#10b981" };
            return $"<tr>{Td(i.ResourceName)}{Td(i.ResourceType)}{Td(i.SubscriptionName)}{TdC(i.Priority, col)}{Td(sym + i.EstimatedMonthlySavingsEur.ToString("N0"))}{Td(i.Recommendation)}</tr>";
        }));

        return "<section id=\"quick-wins\">" +
               "<h2 class=\"section-title\">Quick Wins</h2>" +
               $"<div class=\"metric-row\">{Chip("Total Quick Wins", d.TotalQuickWins.ToString())}{Chip("Potential Monthly Savings", $"{sym}{d.TotalPotentialSavingsEur:N0}", "#10b981")}</div>" +
               If(d.Items.Any(), Table(Th("Resource") + Th("Type") + Th("Subscription") + Th("Priority") + Th("Savings/mo") + Th("Action"), rows) + TruncNote(d.Items.Count, 10)) +
               If(!d.Items.Any(), "<p class=\"empty\">No quick wins identified.</p>") +
               "</section>";
    }

    private static string BuildTopCostlySection(TopCostlyResourcesDashboardDto d)
    {
        var sym = CurrencySymbol(d.Currency);
        var rows = string.Join("", d.Resources.Take(10).Select(r =>
            $"<tr>{Td(r.ResourceName)}{Td(r.ResourceType)}{Td(r.SubscriptionName)}{TdC(sym + r.MonthlyCostEur.ToString("N0"), "#f59e0b")}</tr>"));

        return "<section id=\"top-costly\">" +
               "<h2 class=\"section-title\">Top Costly Resources</h2>" +
               $"<div class=\"metric-row\">{Chip("Total Cost (top resources)", $"{sym}{d.TotalCostEur:N0}/mo")}</div>" +
               If(d.Resources.Any(), Table(Th("Resource") + Th("Type") + Th("Subscription") + Th("Monthly Cost"), rows) + TruncNote(d.Resources.Count, 10)) +
               "</section>";
    }

    private static string BuildWastageSection(WastageTrackerDashboardDto d)
    {
        var sym = CurrencySymbol(d.Currency);
        var rows = string.Join("", d.WastageItems.OrderByDescending(w => w.EstimatedMonthlyWasteEur).Take(10).Select(w =>
            $"<tr>{Td(w.Category)}{Td(w.ResourceName)}{Td(w.SubscriptionName)}{TdC(sym + w.EstimatedMonthlyWasteEur.ToString("N0"), "#ef4444")}{Td(w.Reason)}</tr>"));

        return "<section id=\"wastage\">" +
               "<h2 class=\"section-title\">Wastage Tracker</h2>" +
               $"<div class=\"metric-row\">{Chip("Total Monthly Waste", $"{sym}{d.TotalEstimatedMonthlyWasteEur:N0}", "#ef4444")}{Chip("Wasted Resources", d.TotalWastedResources.ToString())}</div>" +
               If(d.WastageItems.Any(), Table(Th("Category") + Th("Resource") + Th("Subscription") + Th("Waste/mo") + Th("Reason"), rows) + TruncNote(d.WastageItems.Count, 10)) +
               If(!d.WastageItems.Any(), "<p class=\"empty\">No wastage detected.</p>") +
               "</section>";
    }

    private static string BuildOrphanedSection(OrphanedResourcesDashboardDto d, string currency)
    {
        var sym = CurrencySymbol(currency);
        var rows = string.Join("", d.Resources.Take(10).Select(r =>
            $"<tr>{Td(r.Name)}{Td(r.ResourceType)}{Td(r.Category)}{Td(r.SubscriptionName)}{TdC(sym + r.EstimatedMonthlyWasteEur.ToString("N0"), "#ef4444")}</tr>"));

        return "<section id=\"orphaned\">" +
               "<h2 class=\"section-title\">Orphaned Resources</h2>" +
               $"<div class=\"metric-row\">{Chip("Total Orphaned", d.TotalOrphanedResources.ToString(), "#ef4444")}{Chip("Monthly Waste", $"{sym}{d.EstimatedMonthlyWasteEur:N0}", "#ef4444")}{Chip("Disks", d.OrphanedDisks.ToString())}{Chip("NICs", d.OrphanedNics.ToString())}{Chip("Public IPs", d.OrphanedPublicIps.ToString())}{Chip("Snapshots", d.OrphanedSnapshots.ToString())}</div>" +
               If(d.Resources.Any(), Table(Th("Name") + Th("Type") + Th("Category") + Th("Subscription") + Th("Waste/mo"), rows) + TruncNote(d.Resources.Count, 10)) +
               "</section>";
    }

    private static string BuildBackupSection(BackupHealthDashboardDto d)
    {
        var col = d.ProtectionCoveragePercent >= 90 ? "#10b981" : d.ProtectionCoveragePercent >= 70 ? "#f59e0b" : "#ef4444";
        var unprotectedItems = string.Join("", d.UnprotectedResourceTypes.Take(5).Select(t => $"<li>{Esc(t)}</li>"));

        return "<section id=\"backup\">" +
               "<h2 class=\"section-title\">Backup Health</h2>" +
               $"<div class=\"metric-row\">{Chip("Coverage", $"{d.ProtectionCoveragePercent:F1}%", col)}{Chip("Unprotected VMs", d.UnprotectedVms.ToString(), "#ef4444")}{Chip("Backup Vaults", d.BackupVaultCount.ToString())}</div>" +
               If(d.UnprotectedResourceTypes.Any(), $"<h3 class=\"sub-heading\">Unprotected Resource Types</h3><ul>{unprotectedItems}</ul>") +
               "</section>";
    }

    private static string BuildIamSection(IamReviewDashboardDto d)
    {
        var rows = string.Join("", d.Risks.Take(6).Select(r =>
        {
            var col = r.RiskLevel switch { "Critical" or "High" => "#ef4444", "Medium" => "#f59e0b", _ => "#10b981" };
            return $"<tr>{Td(r.Title)}{TdC(r.RiskLevel, col)}{Td(r.Count.ToString())}{Td(r.Recommendation)}</tr>";
        }));

        return "<section id=\"iam\">" +
               "<h2 class=\"section-title\">IAM Review</h2>" +
               $"<div class=\"metric-row\">{Chip("Total Assignments", d.TotalRoleAssignments.ToString())}{Chip("Owner Assignments", d.OwnerAssignments.ToString(), "#f59e0b")}{Chip("Service Principals", d.ServicePrincipalAssignments.ToString())}{Chip("Custom Roles", d.CustomRoleCount.ToString())}</div>" +
               If(d.Risks.Any(), Table(Th("Risk") + Th("Level") + Th("Count") + Th("Recommendation"), rows) + TruncNote(d.Risks.Count, 6)) +
               "</section>";
    }

    private static string BuildTagHygieneSection(TagHygieneDashboardDto d)
    {
        var col = d.CoveragePercent >= 90 ? "#10b981" : d.CoveragePercent >= 70 ? "#f59e0b" : "#ef4444";
        var rows = string.Join("", d.SubscriptionBreakdown.Take(6).Select(s =>
        {
            var sc = s.CoveragePercent >= 90 ? "#10b981" : s.CoveragePercent >= 70 ? "#f59e0b" : "#ef4444";
            return $"<tr>{Td(s.SubscriptionName)}{Td(s.TotalCount.ToString())}{TdC(s.UntaggedCount.ToString(), "#ef4444")}{TdC($"{s.CoveragePercent:F1}%", sc)}</tr>";
        }));

        return "<section id=\"tags\">" +
               "<h2 class=\"section-title\">Tag Hygiene</h2>" +
               $"<div class=\"metric-row\">{Chip("Coverage", $"{d.CoveragePercent:F1}%", col)}{Chip("Total Resources", d.TotalResources.ToString())}{Chip("Untagged", d.UntaggedResources.ToString(), "#ef4444")}</div>" +
               If(d.SubscriptionBreakdown.Any(), Table(Th("Subscription") + Th("Total") + Th("Untagged") + Th("Coverage"), rows) + TruncNote(d.SubscriptionBreakdown.Count, 6)) +
               "</section>";
    }

    private static string BuildNetworkSection(NetworkPerimeterDashboardDto d)
    {
        var rows = string.Join("", d.ExposedResources.Take(8).Select(r =>
        {
            var col = r.RiskLevel switch { "Critical" or "High" => "#ef4444", "Medium" => "#f59e0b", _ => "#10b981" };
            return $"<tr>{Td(r.ResourceName)}{Td(r.ResourceType)}{Td(r.SubscriptionName)}{Td(r.ExposureType)}{TdC(r.RiskLevel, col)}</tr>";
        }));

        return "<section id=\"network\">" +
               "<h2 class=\"section-title\">Network Perimeter</h2>" +
               $"<div class=\"metric-row\">{Chip("Public IPs", d.TotalPublicIps.ToString())}{Chip("Unprotected Public IPs", d.UnprotectedPublicIps.ToString(), "#ef4444")}{Chip("Open Mgmt Ports", d.OpenManagementPortResources.ToString(), "#ef4444")}{Chip("Dangerous NSG Rules", d.DangerousNsgRuleCount.ToString(), "#ef4444")}</div>" +
               If(d.ExposedResources.Any(), Table(Th("Resource") + Th("Type") + Th("Subscription") + Th("Exposure") + Th("Risk"), rows) + TruncNote(d.ExposedResources.Count, 8)) +
               "</section>";
    }

    private static string BuildRiSavingsSection(RiSavingsDashboardDto d)
    {
        var sym = CurrencySymbol(d.Currency);
        var rows = string.Join("", d.Recommendations.Take(8).Select(r =>
            $"<tr>{Td(r.ResourceType)}{Td(r.RecommendationType)}{Td(r.Term)}{Td(r.Scope)}{TdC(sym + r.EstimatedMonthlySavingsEur.ToString("N0") + "/mo", "#10b981")}{TdC(sym + r.EstimatedAnnualSavingsEur.ToString("N0") + "/yr", "#10b981")}</tr>"));

        return "<section id=\"ri-savings\">" +
               "<h2 class=\"section-title\">RI &amp; Savings</h2>" +
               $"<div class=\"metric-row\">{Chip("Annual Savings Opportunity", $"{sym}{d.TotalEstimatedAnnualSavingsEur:N0}", "#10b981")}{Chip("Monthly Savings Opportunity", $"{sym}{d.TotalEstimatedMonthlySavingsEur:N0}", "#10b981")}{Chip("Recommendations", d.RecommendationCount.ToString())}</div>" +
               If(d.Recommendations.Any(), Table(Th("Resource Type") + Th("Type") + Th("Term") + Th("Scope") + Th("Monthly") + Th("Annual"), rows) + TruncNote(d.Recommendations.Count, 8)) +
               "</section>";
    }

    private static string BuildNonProdSection(NonProdUptimeDashboardDto d)
    {
        var sym = CurrencySymbol(d.Currency);
        var rows = string.Join("", d.RunningVms.Take(8).Select(v =>
            $"<tr>{Td(v.ResourceName)}{Td(v.SubscriptionName)}{Td(v.Environment)}{Td(v.VmSize)}{TdC(sym + v.EstimatedMonthlyCostEur.ToString("N0"), "#ef4444")}</tr>"));

        return "<section id=\"nonprod\">" +
               "<h2 class=\"section-title\">Non-Prod Uptime Leakage</h2>" +
               $"<div class=\"metric-row\">{Chip("Non-Prod VMs", d.NonProdVmCount.ToString())}{Chip("Running Non-Prod VMs", d.RunningNonProdVmCount.ToString(), "#f59e0b")}{Chip("Monthly Leakage", $"{sym}{d.EstimatedMonthlyLeakageEur:N0}", "#ef4444")}</div>" +
               If(d.RunningVms.Any(), Table(Th("Name") + Th("Subscription") + Th("Environment") + Th("Size") + Th("Cost/mo"), rows, "Running Non-Prod VMs") + TruncNote(d.RunningVms.Count, 8)) +
               "</section>";
    }

    private static string BuildAppFunctionsSection(AppFunctionsHealthDashboardDto d)
    {
        var allStopped = d.Apps.Where(a => a.State != "Running").ToList();
        var stoppedRows = string.Join("", allStopped.Take(8).Select(a =>
            $"<tr>{Td(a.Name)}{Td(a.Kind)}{Td(a.SubscriptionName)}{Td(a.Location)}{TdC(a.State, "#ef4444")}</tr>"));

        return "<section id=\"apps\">" +
               "<h2 class=\"section-title\">App &amp; Functions Health</h2>" +
               $"<div class=\"metric-row\">{Chip("Total Apps", d.TotalApps.ToString())}{Chip("Running", d.RunningApps.ToString(), "#10b981")}{Chip("Stopped", d.StoppedApps.ToString(), "#ef4444")}{Chip("Function Apps", d.FunctionAppCount.ToString())}{Chip("Web Apps", d.WebAppCount.ToString())}</div>" +
               If(allStopped.Any(), Table(Th("Name") + Th("Kind") + Th("Subscription") + Th("Location") + Th("State"), stoppedRows, "Stopped / Unhealthy Apps") + TruncNote(allStopped.Count, 8)) +
               If(!allStopped.Any(), "<p class=\"empty\">All apps are running.</p>") +
               "</section>";
    }

    private static string BuildPolicySection(AzPolicyLensDashboardDto d)
    {
        var col = d.OverallCompliancePercent >= 90 ? "#10b981" : d.OverallCompliancePercent >= 70 ? "#f59e0b" : "#ef4444";

        var rows = string.Join("", d.TopNonCompliantAssignments.Take(6).Select(a =>
            $"<tr>{Td(a.DisplayName)}{Td(a.SubscriptionName)}{Td(a.Effect)}{TdC(a.NonCompliantResources.ToString(), "#ef4444")}</tr>"));

        return "<section id=\"policy\">" +
               "<h2 class=\"section-title\">Policy Radar</h2>" +
               $"<div class=\"metric-row\">{Chip("Overall Compliance", $"{d.OverallCompliancePercent:F1}%", col)}{Chip("Non-Compliant Resources", d.TotalNonCompliantResources.ToString(), "#ef4444")}{Chip("Total Assignments", d.TotalAssignments.ToString())}{Chip("Exemptions", d.TotalExemptions.ToString())}</div>" +
               If(d.TopNonCompliantAssignments.Any(), Table(Th("Policy") + Th("Subscription") + Th("Effect") + Th("Non-Compliant"), rows, "Top Non-Compliant Policies") + TruncNote(d.TopNonCompliantAssignments.Count, 6)) +
               "</section>";
    }

    private static string BuildSupportSection(SupportTicketDashboardDto d)
    {
        var rows = string.Join("", d.Tickets.Take(8).Select(t =>
        {
            var col = t.Severity switch { "Critical" or "Sev A" => "#ef4444", "High" or "Sev B" => "#f59e0b", _ => "#94a3b8" };
            return $"<tr>{Td(t.Title)}{TdC(t.Severity, col)}{Td(t.Status)}{Td(t.ServiceName)}{Td(t.SubscriptionName)}{Td(t.AgeDays + "d")}</tr>";
        }));

        return "<section id=\"support\">" +
               "<h2 class=\"section-title\">Support Tickets</h2>" +
               $"<div class=\"metric-row\">{Chip("Open Tickets", d.TotalOpenTickets.ToString())}{Chip("Critical", d.CriticalCount.ToString(), "#ef4444")}{Chip("High", d.HighCount.ToString(), "#f59e0b")}{Chip("Moderate", d.ModeratCount.ToString())}</div>" +
               If(d.Tickets.Any(), Table(Th("Title") + Th("Severity") + Th("Status") + Th("Service") + Th("Subscription") + Th("Age"), rows) + TruncNote(d.Tickets.Count, 8)) +
               If(!d.Tickets.Any(), "<p class=\"empty\">No open support tickets.</p>") +
               "</section>";
    }

    private static string Css() =>
        ":root{--bg:#0b1222;--surface:#111827;--surface2:#1e293b;--border:rgba(255,255,255,0.08);--cyan:#22d3ee;--cyan-dim:rgba(34,211,238,0.15);--text:#e2e8f0;--text-sub:#94a3b8;--sidebar-w:220px;}" +
        "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}" +
        "html{scroll-behavior:smooth;}" +
        "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);font-size:13px;line-height:1.5;}" +
        ".sidebar{position:fixed;top:0;left:0;bottom:0;width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;z-index:100;}" +
        ".sidebar-brand{padding:14px;border-bottom:1px solid var(--border);}" +
        ".brand-title{font-size:12px;font-weight:700;color:var(--cyan);letter-spacing:.05em;}" +
        ".brand-sub{font-size:10px;color:var(--text-sub);margin-top:2px;}" +
        ".report-header{display:flex;align-items:center;gap:16px;background:#0f172a;border:1px solid rgba(34,211,238,0.2);border-radius:14px;padding:20px 24px;margin-bottom:28px;}" +
        ".report-header-text{flex:1;}" +
        ".report-header-title{font-size:22px;font-weight:800;color:#22d3ee;letter-spacing:.03em;}" +
        ".report-header-sub{font-size:11px;color:#94a3b8;margin-top:3px;}" +
        ".report-header-right{text-align:right;}" +
        ".report-header-tenant{font-size:13px;font-weight:700;color:#e2e8f0;}" +
        ".report-header-date{font-size:10px;color:#94a3b8;margin-top:2px;}" +
        ".nav-links{flex:1;overflow-y:auto;padding:8px 0;}" +
        ".nav-links a{display:block;padding:7px 14px;font-size:11.5px;color:var(--text-sub);text-decoration:none;border-left:2px solid transparent;transition:all .15s;}" +
        ".nav-links a:hover,.nav-links a.active{color:var(--cyan);background:var(--cyan-dim);border-left-color:var(--cyan);}" +
        ".sidebar-footer{padding:10px 14px;font-size:10px;color:var(--text-sub);border-top:1px solid var(--border);}" +
        ".content{margin-left:var(--sidebar-w);padding:32px 36px;min-height:100vh;}" +
        "section{margin-bottom:40px;padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:14px;scroll-margin-top:24px;}" +
        ".section-title{font-size:15px;font-weight:700;color:var(--text);letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;}" +
        ".section-sub{color:var(--text-sub);font-size:12px;margin-bottom:16px;}" +
        ".sub-heading{font-size:12px;font-weight:600;color:var(--text-sub);text-transform:uppercase;letter-spacing:.08em;margin:16px 0 8px;}" +
        ".ai-summary-section{background:linear-gradient(135deg,#0f172a 0%,#1a1f35 100%);border-color:rgba(34,211,238,0.3);}" +
        ".ai-header{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;}" +
        ".ai-icon{font-size:28px;line-height:1;}" +
        ".ai-title{color:var(--cyan);}" +
        ".ai-body{line-height:1.8;color:var(--text);}" +
        ".ai-body p{margin-bottom:12px;}" +
        ".ai-body p:last-child{margin-bottom:0;}" +
        ".kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px;}" +
        ".kpi-card{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;}" +
        ".kpi-value{font-size:28px;font-weight:700;line-height:1;margin-bottom:6px;}" +
        ".kpi-bar-bg{background:rgba(255,255,255,0.06);border-radius:4px;height:4px;margin-bottom:8px;overflow:hidden;}" +
        ".kpi-bar{height:4px;border-radius:4px;}" +
        ".kpi-label{font-size:11px;color:var(--text-sub);text-transform:uppercase;letter-spacing:.08em;}" +
        ".kpi-status{font-size:11px;font-weight:600;margin-top:2px;}" +
        ".metric-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}" +
        ".metric-chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:11.5px;color:var(--text-sub);}" +
        ".metric-chip strong{color:var(--text);}" +
        "table{width:100%;border-collapse:collapse;font-size:12px;}" +
        "th{text-align:left;padding:8px 10px;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-sub);border-bottom:1px solid var(--border);}" +
        "td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--text);}" +
        "tr:last-child td{border-bottom:none;}" +
        "tr:hover td{background:rgba(255,255,255,0.02);}" +
        "ul{padding-left:18px;margin-bottom:8px;}" +
        "li{color:var(--text-sub);margin-bottom:4px;font-size:12px;}" +
        "li em{color:var(--cyan);font-style:normal;}" +
        ".notes{background:rgba(34,211,238,0.05);border-left:3px solid var(--cyan-dim);padding:10px 14px;border-radius:4px;font-size:12px;color:var(--text-sub);margin-top:12px;line-height:1.7;}" +
        ".empty{color:var(--text-sub);font-size:12px;font-style:italic;margin-top:8px;}" +
        ".horizon-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:8px;}" +
        ".horizon-box{border-radius:10px;overflow:hidden;border:1px solid transparent;}" +
        ".horizon-header{padding:14px 16px;}" +
        ".horizon-label{font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.08em;}" +
        ".horizon-period{font-size:10px;color:rgba(255,255,255,0.7);margin-top:2px;}" +
        ".horizon-items{list-style:none;padding:0;margin:0;}" +
        ".horizon-items li{padding:8px 14px 8px 32px;border-bottom:1px solid rgba(0,0,0,0.06);font-size:12px;position:relative;line-height:1.5;}" +
        ".horizon-items li:last-child{border-bottom:none;}" +
        ".horizon-items li::before{content:'▶';position:absolute;left:14px;top:9px;font-size:8px;}" +
        ".horizon-immediate{border-color:#b91c1c;}" +
        ".horizon-immediate .horizon-header{background:#b91c1c;}" +
        ".horizon-immediate .horizon-items{background:#fef2f2;color:#7f1d1d;}" +
        ".horizon-immediate .horizon-items li::before{color:#b91c1c;}" +
        ".horizon-short{border-color:#b45309;}" +
        ".horizon-short .horizon-header{background:#b45309;}" +
        ".horizon-short .horizon-items{background:#fffbeb;color:#78350f;}" +
        ".horizon-short .horizon-items li::before{color:#b45309;}" +
        ".horizon-medium{border-color:#15803d;}" +
        ".horizon-medium .horizon-header{background:#15803d;}" +
        ".horizon-medium .horizon-items{background:#f0fdf4;color:#14532d;}" +
        ".horizon-medium .horizon-items li::before{color:#15803d;}" +
        ".ai-notes{margin-top:16px;border-left:3px solid rgba(34,211,238,0.3);padding:10px 16px;border-radius:4px;background:rgba(34,211,238,0.04);}" +
        ".ai-notes p{font-size:12px;color:var(--text-sub);line-height:1.7;margin-bottom:6px;}" +
        ".ai-notes p:last-child{margin-bottom:0;}" +
        ".truncation-note{text-align:right;font-size:11px;font-style:italic;color:var(--text-sub);margin-top:4px;}" +
        "@media(max-width:900px){.horizon-grid{grid-template-columns:1fr;}}" +
        "@media print{.sidebar{display:none!important;}.content{margin-left:0!important;padding:20px!important;}section{page-break-inside:avoid;border:1px solid #334155;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}}";

    private static string Js() =>
        "(function(){" +
        "function navTo(id){var el=document.getElementById(id);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.nav-links a').forEach(function(a){a.classList.remove('active');});var link=document.querySelector('.nav-links a[href=\"#'+id+'\"]');if(link)link.classList.add('active');}" +
        "window.navTo=navTo;" +
        "window.addEventListener('scroll',function(){var sections=document.querySelectorAll('section[id]');var scrollY=window.scrollY+80;var active=null;sections.forEach(function(s){if(s.offsetTop<=scrollY)active=s.id;});document.querySelectorAll('.nav-links a').forEach(function(a){a.classList.toggle('active',a.getAttribute('href')==='#'+active);});},{passive:true});" +
        "})();";
}
