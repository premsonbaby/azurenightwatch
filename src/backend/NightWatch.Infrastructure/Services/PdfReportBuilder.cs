using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace NightWatch.Infrastructure.Services;

// Owl SVG icon — same asset as the website
file static class OwlIcon
{
    internal const string Svg = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
          <circle cx="32" cy="32" r="30" fill="#1e293b"/>
          <circle cx="32" cy="32" r="30" fill="none" stroke="#06b6d4" stroke-width="1" opacity="0.6"/>
          <ellipse cx="32" cy="44" rx="14" ry="13" fill="#334155"/>
          <path d="M18 46 Q10 38 14 52 Q18 58 22 54 Z" fill="#1e293b"/>
          <path d="M46 46 Q54 38 50 52 Q46 58 42 54 Z" fill="#1e293b"/>
          <path d="M24 24 L21 16 L26 22 Z" fill="#334155"/>
          <path d="M40 24 L43 16 L38 22 Z" fill="#334155"/>
          <circle cx="32" cy="30" r="14" fill="#2d3f55"/>
          <circle cx="25.5" cy="30" r="7" fill="#0f1e35"/>
          <circle cx="38.5" cy="30" r="7" fill="#0f1e35"/>
          <circle cx="25.5" cy="30" r="5.8" fill="#22d3ee"/>
          <circle cx="38.5" cy="30" r="5.8" fill="#22d3ee"/>
          <circle cx="25.5" cy="30" r="3.2" fill="#040d1a"/>
          <circle cx="38.5" cy="30" r="3.2" fill="#040d1a"/>
          <circle cx="24" cy="28.5" r="1" fill="#e0f7ff"/>
          <circle cx="37" cy="28.5" r="1" fill="#e0f7ff"/>
          <path d="M30.5 33.5 L32 37 L33.5 33.5 Z" fill="#f59e0b"/>
        </svg>
        """;
}

internal static class PdfReportBuilder
{
    // Brand colours matching the website
    private const string Brand = "#22d3ee";           // cyan-400
    private const string BrandDark = "#0891b2";       // cyan-600
    private const string HeaderBg = "#0f172a";        // slate-900
    private const string SectionBg = "#1e293b";       // slate-800
    private const string CardBg = "#f8fafc";          // slate-50
    private const string Border = "#e2e8f0";          // slate-200
    private const string Text = "#0f172a";            // slate-900
    private const string TextMuted = "#64748b";       // slate-500
    private const string White = "#ffffff";

    // Status colours
    private const string Green = "#16a34a";
    private const string Amber = "#d97706";
    private const string Red = "#dc2626";
    private const string Purple = "#7c3aed";

    // Horizon box colours — solid, prominent
    private const string HorizonImmediateBg = "#b91c1c";     // red-700
    private const string HorizonImmediateBody = "#fef2f2";   // red-50
    private const string HorizonShortBg = "#b45309";         // amber-700
    private const string HorizonShortBody = "#fffbeb";       // amber-50
    private const string HorizonMediumBg = "#15803d";        // green-700
    private const string HorizonMediumBody = "#f0fdf4";      // green-50

    public static byte[] Build(HtmlReportBuilder.ReportData d)
    {
        var doc = Document.Create(container =>
        {
            // ── Cover page ───────────────────────────────────────────────────────
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0);
                page.DefaultTextStyle(t => t.FontFamily("Arial").FontColor(Text));
                page.Content().Background(HeaderBg).Column(col =>
                {
                    col.Item().Height(110);

                    col.Item().AlignCenter().Width(96).Height(96).Svg(OwlIcon.Svg);

                    col.Item().Height(36);

                    col.Item().AlignCenter().Text("Azure Night Watch")
                        .Bold().FontSize(34).FontColor(Brand);

                    col.Item().Height(10);

                    col.Item().AlignCenter().Text("Operations Intelligence Report")
                        .FontSize(14).FontColor("#94a3b8");

                    col.Item().Height(44);

                    col.Item().PaddingHorizontal(60).Height(1).Background(BrandDark);

                    col.Item().Height(36);

                    var tenantLabel = !string.IsNullOrWhiteSpace(d.TenantDisplayName)
                        ? d.TenantDisplayName
                        : !string.IsNullOrWhiteSpace(d.MspName) ? d.MspName : "Home Tenant";
                    col.Item().AlignCenter().Text(tenantLabel)
                        .Bold().FontSize(22).FontColor(White);

                    if (!string.IsNullOrWhiteSpace(d.MspName) && !string.IsNullOrWhiteSpace(d.TenantDisplayName))
                    {
                        col.Item().Height(10);
                        col.Item().AlignCenter().Text($"Prepared by {d.MspName}")
                            .FontSize(11).FontColor("#94a3b8");
                    }

                    col.Item().Height(18);

                    col.Item().AlignCenter().Text($"Generated: {d.GeneratedAt:MMMM dd, yyyy}")
                        .FontSize(11).FontColor("#64748b");

                    col.Item().Extend();

                    col.Item().AlignCenter().PaddingBottom(28)
                        .Text("CONFIDENTIAL — For authorised recipients only")
                        .FontSize(9).FontColor("#374151");
                });
            });

            // ── Content pages ────────────────────────────────────────────────────
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0);
                page.DefaultTextStyle(t => t.FontFamily("Arial").FontSize(9).FontColor(Text));
                page.Header().Element(c => BuildHeader(c, d));
                page.Footer().Element(c => BuildFooter(c, d));
                page.Content().Padding(16, Unit.Millimetre).Element(c => BuildContent(c, d));
            });
        });

        return doc.GeneratePdf();
    }

    // ── Header — dark, website-style with owl icon ───────────────────────────────
    private static void BuildHeader(IContainer c, HtmlReportBuilder.ReportData d)
    {
        c.Background(HeaderBg).Padding(14).Row(row =>
        {
            // Owl icon
            row.ConstantItem(48).Height(48).Svg(OwlIcon.Svg);

            row.ConstantItem(10); // spacer

            // Brand text
            row.RelativeItem().AlignMiddle().Column(col =>
            {
                col.Item().Text("Azure Night Watch")
                    .Bold().FontSize(18).FontColor(Brand);
                col.Item().Text("Operations Intelligence Report")
                    .FontSize(9).FontColor("#94a3b8");
            });

            // Right: tenant name + date
            row.ConstantItem(220).AlignMiddle().Column(col =>
            {
                var label = !string.IsNullOrWhiteSpace(d.TenantDisplayName)
                    ? d.TenantDisplayName
                    : !string.IsNullOrWhiteSpace(d.MspName) ? d.MspName : "Home Tenant";
                col.Item().AlignRight().Text(label).Bold().FontSize(10).FontColor(White);
                col.Item().AlignRight()
                    .Text($"Generated: {d.GeneratedAt:yyyy-MM-dd HH:mm} UTC")
                    .FontSize(8).FontColor("#94a3b8");
            });
        });
    }

    private static void BuildFooter(IContainer c, HtmlReportBuilder.ReportData? d = null)
    {
        c.Background(HeaderBg).PaddingHorizontal(14).PaddingVertical(6).Row(row =>
        {
            var footerText = string.IsNullOrWhiteSpace(d?.MspName)
                ? "Azure Night Watch — Confidential"
                : $"Azure Night Watch — Prepared by {d.MspName} — Confidential";
            row.RelativeItem()
                .Text(footerText)
                .FontSize(7).FontColor("#64748b");
            row.RelativeItem().AlignRight().Text(t =>
            {
                t.Span("Page ").FontSize(7).FontColor("#64748b");
                t.CurrentPageNumber().FontSize(7).FontColor("#64748b");
                t.Span(" of ").FontSize(7).FontColor("#64748b");
                t.TotalPages().FontSize(7).FontColor("#64748b");
            });
        });
    }

    // ── Content ───────────────────────────────────────────────────────────────────
    private static void BuildContent(IContainer c, HtmlReportBuilder.ReportData d)
    {
        c.Column(col =>
        {
            col.Spacing(10);

            // AI narrative + action plan horizon boxes
            if (!string.IsNullOrWhiteSpace(d.AiEnvironmentSummary) || !string.IsNullOrWhiteSpace(d.AiActionPlan))
                col.Item().Element(e => BuildAiSection(e, d.AiEnvironmentSummary, d.AiActionPlan));

            col.Item().Element(e => BuildExecutiveSection(e, d.Executive));
            col.Item().Element(e => BuildSecuritySection(e, d.Security));
            col.Item().Element(e => BuildCostSection(e, d.Cost));
            col.Item().Element(e => BuildPerformanceSection(e, d.Performance));
            col.Item().Element(e => BuildGovernanceSection(e, d.Governance));
            col.Item().Element(e => BuildDrSection(e, d.Dr));
            col.Item().Element(e => BuildCapacitySection(e, d.Capacity));
            col.Item().Element(e => BuildBackupSection(e, d.BackupHealth));
            col.Item().Element(e => BuildNetworkSection(e, d.NetworkPerimeter));
            col.Item().Element(e => BuildIamSection(e, d.IamReview));
            col.Item().Element(e => BuildCostSavingsSection(e, d.RiSavings, d.Wastage, d.TopCostly));
            col.Item().Element(e => BuildOrphanedTagsSection(e, d.Orphaned, d.TagHygiene));
            col.Item().Element(e => BuildNonProdSection(e, d.NonProdUptime));
            col.Item().Element(e => BuildAppFunctionsSection(e, d.AppFunctions));
            col.Item().Element(e => BuildPolicySection(e, d.PolicyLens));
            col.Item().Element(e => BuildSupportSection(e, d.SupportTickets));
            col.Item().Element(e => BuildQuickWinsSection(e, d.QuickWins));
        });
    }

    // ── AI section: narrative + horizon boxes ─────────────────────────────────────
    private static void BuildAiSection(IContainer c, string? summary, string? actionPlan)
    {
        c.Column(col =>
        {
            col.Spacing(8);

            // Narrative — subtle left accent, no title
            if (!string.IsNullOrWhiteSpace(summary))
            {
                col.Item()
                    .BorderLeft(3).BorderColor(Brand)
                    .PaddingLeft(10).PaddingVertical(6)
                    .Text(summary)
                    .FontSize(8.5f).FontColor("#1e3a5f").LineHeight(1.6f);
            }

            // Horizon boxes
            if (!string.IsNullOrWhiteSpace(actionPlan))
            {
                var (horizons, tail) = ParseHorizons(actionPlan);
                if (horizons.Count > 0)
                {
                    col.Item().Row(row =>
                    {
                        foreach (var (label, period, headerBg, bodyBg, items) in horizons)
                        {
                            row.RelativeItem().Padding(3).Column(boxCol =>
                            {
                                boxCol.Item()
                                    .Background(headerBg)
                                    .Padding(8)
                                    .Column(hCol =>
                                    {
                                        hCol.Item().Text(label).Bold().FontSize(10f).FontColor(White);
                                        hCol.Item().Text(period).FontSize(7.5f).FontColor("#ffffffbb");
                                    });

                                boxCol.Item()
                                    .Background(bodyBg)
                                    .BorderLeft(2).BorderRight(2).BorderBottom(2).BorderColor(headerBg)
                                    .Padding(8)
                                    .Column(bodyCol =>
                                    {
                                        foreach (var item in items)
                                        {
                                            bodyCol.Item().PaddingBottom(5).Row(itemRow =>
                                            {
                                                itemRow.ConstantItem(12).Text("▶").FontSize(7).FontColor(headerBg);
                                                itemRow.RelativeItem()
                                                    .PaddingLeft(2)
                                                    .Text(item.TrimStart('•', '▶', '-', ' '))
                                                    .FontSize(7.5f).FontColor(Text).LineHeight(1.4f);
                                            });
                                        }
                                    });
                            });
                        }
                    });
                }

                // Render any leftover content (e.g. "Data Quality and Gaps") as a notes block
                if (tail.Count > 0)
                {
                    col.Item()
                        .BorderLeft(3).BorderColor(Border)
                        .PaddingLeft(10).PaddingVertical(6)
                        .Column(notesCol =>
                        {
                            foreach (var line in tail)
                                notesCol.Item().PaddingBottom(3)
                                    .Text(line.TrimStart('•', '▶', '-', ' '))
                                    .FontSize(7.5f).FontColor(TextMuted).LineHeight(1.4f);
                        });
                }
            }
        });
    }

    private static (List<(string Label, string Period, string HeaderBg, string BodyBg, List<string> Items)> Horizons, List<string> Tail)
        ParseHorizons(string actionPlan)
    {
        var defs = new (string Key, string Label, string Period, string HeaderBg, string BodyBg)[]
        {
            ("IMMEDIATE", "Immediate",  "0 – 24 Hours", HorizonImmediateBg, HorizonImmediateBody),
            ("THIS WEEK", "This Week",  "Short-Term",   HorizonShortBg,     HorizonShortBody),
            ("THIS MONTH","This Month", "Medium-Term",  HorizonMediumBg,    HorizonMediumBody),
        };

        var result = new List<(string, string, string, string, List<string>)>();
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
                result.Add((def.Label, def.Period, def.HeaderBg, def.BodyBg, kept));
            currentItems = [];
            currentIdx = -1;
        }

        foreach (var rawLine in actionPlan.Split('\n'))
        {
            if (inTail)
            {
                var tl = rawLine.Trim();
                if (tl.Length > 2) tail.Add(tl);
                continue;
            }

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
        return (result, tail);
    }

    // ── Executive ─────────────────────────────────────────────────────────────────
    private static void BuildExecutiveSection(IContainer c, ExecutiveDashboardDto d)
    {
        Section(c, "Executive Summary", BrandDark, inner =>
        {
            inner.Column(col =>
            {
                // Score bars grid
                col.Item().Row(row =>
                {
                    ScoreBar(row.RelativeItem(), "Health Score", d.AzureHealthScore);
                    ScoreBar(row.RelativeItem(), "Security Posture", d.SecurityPostureScore);
                    ScoreBar(row.RelativeItem(), "Performance", d.PerformanceScore);
                });
                col.Item().PaddingTop(4).Row(row =>
                {
                    ScoreBar(row.RelativeItem(), "Cost Efficiency", d.CostEfficiencyScore);
                    ScoreBar(row.RelativeItem(), "Reliability", d.ReliabilityScore);
                    ScoreBar(row.RelativeItem(), "Governance", d.GovernanceComplianceScore);
                });

                if (!string.IsNullOrWhiteSpace(d.ExecutiveSummary))
                    col.Item().PaddingTop(8).Text(d.ExecutiveSummary).FontSize(8).FontColor(TextMuted).LineHeight(1.4f);

                col.Item().PaddingTop(8).Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Backup Coverage", $"{d.BackupCoveragePercent:F0}%");
                    MetricPill(row.RelativeItem(), "Protected Workloads", $"{d.ProtectedWorkloads}/{d.TotalStatefulWorkloads}");
                    row.RelativeItem(); // spacer
                });
            });
        });
    }

    // ── Security ──────────────────────────────────────────────────────────────────
    private static void BuildSecuritySection(IContainer c, SecurityDashboardDto d)
    {
        Section(c, "Security", Red, inner =>
        {
            var findings = d.Findings.Take(8).ToList();
            if (findings.Count == 0)
            {
                inner.Text("No security findings reported.").FontSize(8).FontColor(TextMuted);
                return;
            }
            inner.Table(t =>
            {
                t.ColumnsDefinition(cols =>
                {
                    cols.ConstantColumn(55);
                    cols.RelativeColumn(3);
                    cols.RelativeColumn(4);
                });
                AddTableHeader(t, "Severity", "Finding", "Impact");
                foreach (var f in findings)
                {
                    var color = f.RiskLevel is RiskLevel.Critical or RiskLevel.High ? Red
                                : f.RiskLevel == RiskLevel.Medium ? Amber : Green;
                    t.Cell().Padding(3).Text(f.RiskLevel.ToString()).FontSize(7.5f).Bold().FontColor(color);
                    t.Cell().Padding(3).Text(f.Title).FontSize(7.5f).FontColor(Text);
                    t.Cell().Padding(3).Text(f.Impact ?? "").FontSize(7.5f).FontColor(TextMuted);
                }
            });
        });
    }

    // ── Cost ──────────────────────────────────────────────────────────────────────
    private static void BuildCostSection(IContainer c, CostDashboardDto d)
    {
        var sym = CurrencySymbol(d.Currency);
        Section(c, "Cost Management", Amber, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Current Month", $"{sym}{d.CurrentMonthCost:N0}");
                    MetricPill(row.RelativeItem(), "Next Month Forecast", $"{sym}{d.PredictedNextMonthCost:N0}");
                    MetricPill(row.RelativeItem(), "Carbon Footprint", $"{d.CarbonFootprintKgCo2:N0} kg CO₂");
                });

                var allRecs = d.Recommendations.ToList();
                var recs = allRecs.Take(6).ToList();
                if (recs.Count > 0)
                {
                    var heading = allRecs.Count > 6
                        ? $"Cost Recommendations (top 6 of {allRecs.Count})"
                        : "Cost Recommendations";
                    col.Item().PaddingTop(6).Text(heading).Bold().FontSize(8).FontColor(SectionBg);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols => { cols.RelativeColumn(5); cols.ConstantColumn(80); });
                        AddTableHeader(t, "Recommendation", "Monthly Saving");
                        foreach (var r in recs)
                        {
                            t.Cell().Padding(3).Text(r.Description).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).AlignRight().Text($"{sym}{r.EstimatedMonthlySavings:N0}").FontSize(7.5f).FontColor(Green);
                        }
                    });
                }
            });
        });
    }

    // ── Governance ────────────────────────────────────────────────────────────────
    private static void BuildGovernanceSection(IContainer c, GovernanceDashboardDto d)
    {
        Section(c, "Governance & Compliance", Purple, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Tag Compliance", $"{d.TagCompliancePercent:F0}%");
                    MetricPill(row.RelativeItem(), "Landing Zone", $"{d.LandingZoneCompliancePercent:F0}%");
                    MetricPill(row.RelativeItem(), "Naming Compliance", $"{d.NamingCompliancePercent:F0}%");
                    row.RelativeItem();
                });

                var shame = d.WallOfShameItems.Take(8).ToList();
                if (shame.Count > 0)
                {
                    var heading = d.WallOfShameItems.Count() > 8
                        ? $"Wall of Shame — Top Violators (showing 8 of {d.WallOfShameItems.Count()})"
                        : "Wall of Shame — Top Violators";
                    col.Item().PaddingTop(6).Text(heading).Bold().FontSize(8).FontColor(TextMuted);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(1);
                            cols.RelativeColumn(1);
                            cols.ConstantColumn(55);
                            cols.RelativeColumn(3);
                        });
                        AddTableHeader(t, "Resource", "Type", "Subscription", "Violations", "Issues");
                        foreach (var w in shame)
                        {
                            t.Cell().Padding(3).Text(w.ResourceName).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(w.ResourceType).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text(w.SubscriptionName).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).AlignCenter().Text(w.ViolationCount.ToString()).FontSize(7.5f).Bold().FontColor(Red);
                            t.Cell().Padding(3).Text(string.Join(", ", w.Violations.Take(2))).FontSize(7f).FontColor(TextMuted);
                        }
                    });
                }

                var driftAlerts = d.DriftAlerts.Take(3).ToList();
                if (driftAlerts.Count > 0)
                {
                    col.Item().PaddingTop(6).Text("Drift Alerts").Bold().FontSize(8).FontColor(TextMuted);
                    foreach (var alert in driftAlerts)
                        col.Item().PaddingTop(2).PaddingLeft(8).Text(alert).FontSize(7.5f).FontColor(Text).LineHeight(1.4f);
                }
            });
        });
    }

    // ── DR ────────────────────────────────────────────────────────────────────────
    private static void BuildDrSection(IContainer c, DrDashboardDto d)
    {
        Section(c, "Disaster Recovery & Resilience", BrandDark, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "DR Readiness", $"{d.DrReadinessScore:F0}");
                    MetricPill(row.RelativeItem(), "RPO Compliance", $"{d.RpoCompliancePercent:F0}%");
                    MetricPill(row.RelativeItem(), "RTO Compliance", $"{d.RtoCompliancePercent:F0}%");
                    MetricPill(row.RelativeItem(), "Failing Workloads", d.WorkloadsFailingCompliance.ToString());
                });

                var failing = d.TopFailingWorkloads.Take(6).ToList();
                if (failing.Count > 0)
                {
                    var heading = d.TopFailingWorkloads.Count > 6
                        ? $"Non-Compliant Workloads (top 6 of {d.TopFailingWorkloads.Count})"
                        : "Non-Compliant Workloads";
                    col.Item().PaddingTop(6).Text(heading).Bold().FontSize(8).FontColor(TextMuted);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(1);
                            cols.RelativeColumn(1);
                            cols.ConstantColumn(75);
                            cols.ConstantColumn(60);
                        });
                        AddTableHeader(t, "Workload", "Environment", "Criticality", "Achievable RPO/RTO", "Status");
                        foreach (var w in failing)
                        {
                            var statusColor = w.ComplianceStatus == "Compliant" ? Green : Red;
                            t.Cell().Padding(3).Text(w.WorkloadName).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(w.Environment).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text(w.Criticality).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text($"{w.AchievableRpoMinutes}m / {w.AchievableRtoMinutes}m").FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(w.ComplianceStatus).FontSize(7.5f).Bold().FontColor(statusColor);
                        }
                    });
                }

                var recs = d.ActionableRecommendations.Take(3).ToList();
                if (recs.Count > 0)
                {
                    col.Item().PaddingTop(6).Text("Recommended Actions").Bold().FontSize(8).FontColor(TextMuted);
                    foreach (var r in recs)
                        col.Item().PaddingTop(2).PaddingLeft(8).Text(r).FontSize(7.5f).FontColor(Text).LineHeight(1.4f);
                }
            });
        });
    }

    // ── Backup ────────────────────────────────────────────────────────────────────
    private static void BuildBackupSection(IContainer c, BackupHealthDashboardDto d)
    {
        var coverageColor = d.ProtectionCoveragePercent >= 90 ? Green : d.ProtectionCoveragePercent >= 70 ? Amber : Red;
        Section(c, "Backup Health", BrandDark, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Coverage", $"{d.ProtectionCoveragePercent:F0}%");
                    MetricPill(row.RelativeItem(), "Protected Items", d.TotalProtectedItems.ToString());
                    MetricPill(row.RelativeItem(), "Unprotected VMs", d.UnprotectedVms.ToString());
                    MetricPill(row.RelativeItem(), "Total VMs", d.TotalVms.ToString());
                });

                var unprotected = d.UnprotectedResourceTypes.Take(6).ToList();
                if (unprotected.Count > 0)
                {
                    col.Item().PaddingTop(6).Text("Unprotected Resource Types").Bold().FontSize(8).FontColor(Red);
                    col.Item().PaddingTop(4).Row(row =>
                    {
                        foreach (var type in unprotected)
                            row.AutoItem().Padding(3).Border(1).BorderColor(Red).Background("#fff5f5").Padding(4)
                                .Text(type).FontSize(7.5f).FontColor(Red);
                    });
                }
            });
        });
    }

    // ── Network ───────────────────────────────────────────────────────────────────
    private static void BuildNetworkSection(IContainer c, NetworkPerimeterDashboardDto d)
    {
        Section(c, "Network Perimeter", Red, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Public IPs", d.TotalPublicIps.ToString());
                    MetricPill(row.RelativeItem(), "Unprotected IPs", d.UnprotectedPublicIps.ToString());
                    MetricPill(row.RelativeItem(), "Open Mgmt Ports", d.OpenManagementPortResources.ToString());
                    MetricPill(row.RelativeItem(), "Dangerous NSG Rules", d.DangerousNsgRuleCount.ToString());
                });

                var exposed = d.ExposedResources.Take(8).ToList();
                if (exposed.Count > 0)
                {
                    var heading = d.ExposedResources.Count > 8
                        ? $"Exposed Resources (top 8 of {d.ExposedResources.Count})"
                        : "Exposed Resources";
                    col.Item().PaddingTop(6).Text(heading).Bold().FontSize(8).FontColor(TextMuted);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(1);
                            cols.RelativeColumn(1);
                            cols.RelativeColumn(1);
                            cols.ConstantColumn(55);
                        });
                        AddTableHeader(t, "Resource", "Type", "Subscription", "Exposure", "Risk");
                        foreach (var r in exposed)
                        {
                            var riskColor = r.RiskLevel is "Critical" or "High" ? Red : r.RiskLevel == "Medium" ? Amber : Green;
                            t.Cell().Padding(3).Text(r.ResourceName).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(r.ResourceType).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text(r.SubscriptionName).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text(r.ExposureType).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(r.RiskLevel).FontSize(7.5f).Bold().FontColor(riskColor);
                        }
                    });
                }
            });
        });
    }

    // ── IAM ───────────────────────────────────────────────────────────────────────
    private static void BuildIamSection(IContainer c, IamReviewDashboardDto d)
    {
        Section(c, "Identity & Access Management", Purple, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Total Assignments", d.TotalRoleAssignments.ToString());
                    MetricPill(row.RelativeItem(), "Owner Assignments", d.OwnerAssignments.ToString());
                    MetricPill(row.RelativeItem(), "Service Principals", d.ServicePrincipalAssignments.ToString());
                    MetricPill(row.RelativeItem(), "Custom Roles", d.CustomRoleCount.ToString());
                });

                var risks = d.Risks.Take(6).ToList();
                if (risks.Count > 0)
                {
                    var heading = d.Risks.Count > 6
                        ? $"IAM Risk Findings (top 6 of {d.Risks.Count})"
                        : "IAM Risk Findings";
                    col.Item().PaddingTop(6).Text(heading).Bold().FontSize(8).FontColor(TextMuted);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.ConstantColumn(55);
                            cols.ConstantColumn(40);
                            cols.RelativeColumn(3);
                        });
                        AddTableHeader(t, "Risk", "Level", "Count", "Recommendation");
                        foreach (var r in risks)
                        {
                            var riskColor = r.RiskLevel is "Critical" or "High" ? Red : r.RiskLevel == "Medium" ? Amber : Green;
                            t.Cell().Padding(3).Text(r.Title).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(r.RiskLevel).FontSize(7.5f).Bold().FontColor(riskColor);
                            t.Cell().Padding(3).AlignRight().Text(r.Count.ToString()).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(r.Recommendation).FontSize(7f).FontColor(TextMuted).LineHeight(1.3f);
                        }
                    });
                }
            });
        });
    }

    // ── Performance ───────────────────────────────────────────────────────────────
    private static void BuildPerformanceSection(IContainer c, PerformanceDashboardDto d)
    {
        Section(c, "Performance & Reliability", BrandDark, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    var fragColor = d.FragilityIndex >= 70 ? Red : d.FragilityIndex >= 40 ? Amber : Green;
                    MetricPill(row.RelativeItem(), "SLA Risk Score", $"{d.SlaRiskScore:F1}");
                    MetricPill(row.RelativeItem(), "Fragility Index", $"{d.FragilityIndex}");
                    MetricPill(row.RelativeItem(), "Fragility Rating", d.FragilityRating);
                    row.RelativeItem();
                });

                var drivers = d.FragilityDrivers.Take(5).ToList();
                if (drivers.Count > 0)
                {
                    col.Item().PaddingTop(6).Text("Fragility Drivers").Bold().FontSize(8).FontColor(TextMuted);
                    foreach (var driver in drivers)
                        col.Item().PaddingTop(2).PaddingLeft(8).Row(r =>
                        {
                            r.ConstantItem(10).Text("▶").FontSize(7).FontColor(Amber);
                            r.RelativeItem().PaddingLeft(2).Text(driver).FontSize(7.5f).FontColor(Text).LineHeight(1.4f);
                        });
                }

                var predictions = d.OutagePredictions.Take(3).ToList();
                if (predictions.Count > 0)
                {
                    col.Item().PaddingTop(6).Text("Outage Predictions").Bold().FontSize(8).FontColor(Red);
                    foreach (var pred in predictions)
                        col.Item().PaddingTop(2).PaddingLeft(8).Row(r =>
                        {
                            r.ConstantItem(10).Text("▶").FontSize(7).FontColor(Red);
                            r.RelativeItem().PaddingLeft(2).Text(pred).FontSize(7.5f).FontColor(Text).LineHeight(1.4f);
                        });
                }
            });
        });
    }

    // ── Capacity Planning ─────────────────────────────────────────────────────────
    private static void BuildCapacitySection(IContainer c, CapacityPlanningDashboardDto d)
    {
        Section(c, "Capacity Planning", BrandDark, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    foreach (var m in d.Metrics.Take(4))
                        MetricPill(row.RelativeItem(), m.Label, $"{m.Value?.ToString("F0") ?? "—"} {m.Unit}".Trim());
                });

                var runway = d.RunwayForecast.OrderBy(r => r.DaysUntilExhaustion).Take(6).ToList();
                if (runway.Count > 0)
                {
                    var heading = d.RunwayForecast.Count > 6
                        ? $"Capacity Runway Forecast (top 6 of {d.RunwayForecast.Count})"
                        : "Capacity Runway Forecast";
                    col.Item().PaddingTop(6).Text(heading).Bold().FontSize(8).FontColor(TextMuted);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(1);
                            cols.RelativeColumn(1);
                            cols.ConstantColumn(55);
                            cols.ConstantColumn(55);
                        });
                        AddTableHeader(t, "Resource", "Type", "Metric", "Usage", "Days Left");
                        foreach (var r in runway)
                        {
                            var dayColor = r.DaysUntilExhaustion < 30 ? Red : r.DaysUntilExhaustion < 60 ? Amber : Green;
                            t.Cell().Padding(3).Text(r.ResourceName).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(r.ResourceType).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text(r.Metric).FontSize(7f).FontColor(TextMuted);
                            t.Cell().Padding(3).AlignRight().Text($"{r.CurrentUsagePercent:F0}%").FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).AlignRight().Text($"{r.DaysUntilExhaustion}d").FontSize(7.5f).Bold().FontColor(dayColor);
                        }
                    });
                }

                var recs = d.Recommendations.Take(3).ToList();
                if (recs.Count > 0)
                {
                    col.Item().PaddingTop(6).Text("Recommendations").Bold().FontSize(8).FontColor(TextMuted);
                    foreach (var r in recs)
                        col.Item().PaddingTop(2).PaddingLeft(8).Text(r).FontSize(7.5f).FontColor(Text).LineHeight(1.4f);
                }
            });
        });
    }

    // ── Cost Savings ──────────────────────────────────────────────────────────────
    private static void BuildCostSavingsSection(IContainer c, RiSavingsDashboardDto ri, WastageTrackerDashboardDto wastage, TopCostlyResourcesDashboardDto topCostly)
    {
        var sym = CurrencySymbol(ri.Currency);
        Section(c, "Cost Savings & Wastage", Amber, inner =>
        {
            inner.Row(row =>
            {
                MetricPill(row.RelativeItem(), "RI Monthly Saving", $"{sym}{ri.TotalEstimatedMonthlySavingsEur:N0}/mo");
                MetricPill(row.RelativeItem(), "RI Annual Saving", $"{sym}{ri.TotalEstimatedAnnualSavingsEur:N0}/yr");
                MetricPill(row.RelativeItem(), "Wasted Spend", $"{sym}{wastage.TotalEstimatedMonthlyWasteEur:N0}/mo");
                MetricPill(row.RelativeItem(), "Top Resource Cost", $"{sym}{topCostly.TotalCostEur:N0}");
            });
        });
    }

    // ── Orphaned & Tags ───────────────────────────────────────────────────────────
    private static void BuildOrphanedTagsSection(IContainer c, OrphanedResourcesDashboardDto orphaned, TagHygieneDashboardDto tags)
    {
        Section(c, "Orphaned Resources & Tag Hygiene", Red, inner =>
        {
            inner.Row(row =>
            {
                MetricPill(row.RelativeItem(), "Orphaned Resources", orphaned.TotalOrphanedResources.ToString());
                MetricPill(row.RelativeItem(), "Orphaned Cost", $"€{orphaned.EstimatedMonthlyWasteEur:N0}/mo");
                MetricPill(row.RelativeItem(), "Tag Coverage", $"{tags.CoveragePercent:F0}%");
                MetricPill(row.RelativeItem(), "Untagged Resources", tags.UntaggedResources.ToString());
            });
        });
    }

    // ── Non-Prod ──────────────────────────────────────────────────────────────────
    private static void BuildNonProdSection(IContainer c, NonProdUptimeDashboardDto d)
    {
        var sym = CurrencySymbol(d.Currency);
        Section(c, "Non-Prod Uptime Leakage", Amber, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Non-Prod VMs", d.NonProdVmCount.ToString());
                    MetricPill(row.RelativeItem(), "Running After Hours", d.RunningNonProdVmCount.ToString());
                    MetricPill(row.RelativeItem(), "Monthly Leakage", $"{sym}{d.EstimatedMonthlyLeakageEur:N0}/mo");
                    row.RelativeItem();
                });

                var vms = d.RunningVms.Take(6).ToList();
                if (vms.Count > 0)
                {
                    col.Item().PaddingTop(6).Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(1);
                            cols.RelativeColumn(1);
                            cols.ConstantColumn(60);
                        });
                        AddTableHeader(t, "VM Name", "Subscription", "Environment", "Size", "Cost/mo");
                        foreach (var v in vms)
                        {
                            t.Cell().Padding(3).Text(v.ResourceName).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(v.SubscriptionName).FontSize(7.5f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text(v.Environment).FontSize(7.5f).FontColor(TextMuted);
                            t.Cell().Padding(3).Text(v.VmSize).FontSize(7.5f).FontColor(TextMuted);
                            t.Cell().Padding(3).AlignRight().Text($"{sym}{v.EstimatedMonthlyCostEur:N0}").FontSize(7.5f).FontColor(Red);
                        }
                    });
                }
            });
        });
    }

    // ── App Functions ─────────────────────────────────────────────────────────────
    private static void BuildAppFunctionsSection(IContainer c, AppFunctionsHealthDashboardDto d)
    {
        Section(c, "App & Functions Health", BrandDark, inner =>
        {
            inner.Row(row =>
            {
                MetricPill(row.RelativeItem(), "Total Apps", d.TotalApps.ToString());
                MetricPill(row.RelativeItem(), "Running", d.RunningApps.ToString());
                MetricPill(row.RelativeItem(), "Stopped", d.StoppedApps.ToString());
                MetricPill(row.RelativeItem(), "Function Apps", d.FunctionAppCount.ToString());
                MetricPill(row.RelativeItem(), "Web Apps", d.WebAppCount.ToString());
            });
        });
    }

    // ── Policy ────────────────────────────────────────────────────────────────────
    private static void BuildPolicySection(IContainer c, AzPolicyLensDashboardDto d)
    {
        Section(c, "Azure Policy Compliance", Purple, inner =>
        {
            inner.Row(row =>
            {
                MetricPill(row.RelativeItem(), "Assignments", d.TotalAssignments.ToString());
                MetricPill(row.RelativeItem(), "Non-Compliant Resources", d.TotalNonCompliantResources.ToString());
                MetricPill(row.RelativeItem(), "Compliant Resources", d.TotalCompliantResources.ToString());
                MetricPill(row.RelativeItem(), "Compliance %", $"{d.OverallCompliancePercent:F0}%");
            });
        });
    }

    // ── Support ───────────────────────────────────────────────────────────────────
    private static void BuildSupportSection(IContainer c, SupportTicketDashboardDto d)
    {
        Section(c, "Support Tickets", TextMuted, inner =>
        {
            inner.Row(row =>
            {
                MetricPill(row.RelativeItem(), "Open Tickets", d.TotalOpenTickets.ToString());
                MetricPill(row.RelativeItem(), "Critical", d.CriticalCount.ToString());
                MetricPill(row.RelativeItem(), "High", d.HighCount.ToString());
                MetricPill(row.RelativeItem(), "Moderate", d.ModeratCount.ToString());
            });
        });
    }

    // ── Quick Wins ────────────────────────────────────────────────────────────────
    private static void BuildQuickWinsSection(IContainer c, QuickWinsDashboardDto d)
    {
        // QuickWins items store savings in EUR; use a sensible default symbol
        const string sym = "€";
        Section(c, "Quick Wins", Green, inner =>
        {
            inner.Column(col =>
            {
                col.Item().Row(row =>
                {
                    MetricPill(row.RelativeItem(), "Opportunities", d.TotalQuickWins.ToString());
                    MetricPill(row.RelativeItem(), "Potential Saving", $"{sym}{d.TotalPotentialSavingsEur:N0}/mo");
                    row.RelativeItem();
                    row.RelativeItem();
                });

                var wins = d.Items.OrderByDescending(i => i.EstimatedMonthlySavingsEur).Take(8).ToList();
                if (wins.Count > 0)
                {
                    var heading = d.Items.Count > 8
                        ? $"Top 8 of {d.Items.Count} opportunities"
                        : string.Empty;
                    if (heading.Length > 0)
                        col.Item().PaddingTop(4).Text(heading).FontSize(7.5f).FontColor(TextMuted);

                    col.Item().PaddingTop(4).Table(t =>
                    {
                        t.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(3);
                            cols.ConstantColumn(70);
                            cols.ConstantColumn(45);
                        });
                        AddTableHeader(t, "Resource", "Recommendation", "Saving/mo", "Priority");
                        foreach (var w in wins)
                        {
                            var priColor = w.Priority is "High" or "Critical" ? Red : w.Priority == "Medium" ? Amber : Green;
                            t.Cell().Padding(3).Text(w.ResourceName).FontSize(7.5f).FontColor(Text);
                            t.Cell().Padding(3).Text(w.Recommendation).FontSize(7.5f).FontColor(TextMuted);
                            t.Cell().Padding(3).AlignRight().Text($"{sym}{w.EstimatedMonthlySavingsEur:N0}").FontSize(7.5f).FontColor(Green);
                            t.Cell().Padding(3).AlignCenter().Text(w.Priority).FontSize(7.5f).Bold().FontColor(priColor);
                        }
                    });
                }
            });
        });
    }

    // ── Currency helper ───────────────────────────────────────────────────────

    private static string CurrencySymbol(string? code) => (code ?? "EUR").ToUpperInvariant() switch
    {
        "USD" => "$",
        "GBP" => "£",
        "JPY" => "¥",
        "CHF" => "CHF ",
        "CAD" => "CA$",
        "AUD" => "A$",
        "SEK" or "NOK" or "DKK" => "kr ",
        _ => "€"
    };

    // ── Visual helpers ────────────────────────────────────────────────────────────

    private static void Section(IContainer c, string title, string accentColor, Action<IContainer> buildContent)
    {
        c.Border(1).BorderColor(Border).Column(col =>
        {
            // Coloured header bar
            col.Item().Background(accentColor).Padding(6).Row(row =>
            {
                row.AutoItem().Width(3).Background(White).Height(14);
                row.ConstantItem(8);
                row.RelativeItem().AlignMiddle()
                    .Text(title).Bold().FontSize(9).FontColor(White);
            });

            col.Item().Padding(8).Element(buildContent);
        });
    }

    private static void ScoreBar(IContainer c, string label, decimal score)
    {
        var color = score >= 80 ? Green : score >= 60 ? Amber : Red;
        var filled = (float)Math.Clamp(score, 0, 100);
        var empty = 100f - filled;

        c.Padding(3).Column(col =>
        {
            col.Item().Row(r =>
            {
                r.RelativeItem().Text(label).FontSize(7.5f).FontColor(TextMuted);
                r.AutoItem().Text($"{score:F0}").Bold().FontSize(7.5f).FontColor(color);
            });
            col.Item().PaddingTop(2).Height(7).Row(r =>
            {
                if (filled > 0) r.RelativeItem(filled).Background(color);
                if (empty > 0) r.RelativeItem(empty).Background(Border);
            });
        });
    }

    private static void MetricPill(IContainer c, string label, string value)
    {
        c.Padding(2).Border(1).BorderColor(Border).Background(CardBg).Padding(5).Column(col =>
        {
            col.Item().AlignCenter().Text(value).Bold().FontSize(9).FontColor(SectionBg);
            col.Item().AlignCenter().Text(label).FontSize(6.5f).FontColor(TextMuted);
        });
    }

    private static void AddTableHeader(TableDescriptor t, params string[] cols)
    {
        t.Header(h =>
        {
            foreach (var col in cols)
                h.Cell().Background(SectionBg).Padding(4)
                    .Text(col).Bold().FontSize(7.5f).FontColor(White);
        });
    }
}
