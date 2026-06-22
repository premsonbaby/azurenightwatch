using NightWatch.Infrastructure.Persistence.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace NightWatch.Infrastructure.Services;

internal static class EnvironmentReviewPdfBuilder
{
    private const string Brand = "#22d3ee";
    private const string HeaderBg = "#0f172a";
    private const string SectionBg = "#f8fafc";
    private const string Text = "#0f172a";
    private const string TextMuted = "#64748b";
    private const string White = "#ffffff";
    private const string Border = "#e2e8f0";

    private static string SeverityColor(string s) => s switch
    {
        "Critical" => "#dc2626",
        "High" => "#ea580c",
        "Medium" => "#d97706",
        "Low" => "#16a34a",
        _ => "#64748b",
    };

    private static string PillarColor(string p) => p switch
    {
        "Security" => "#ef4444",
        "Identity" => "#8b5cf6",
        "Network" => "#3b82f6",
        "Cost" => "#10b981",
        "Governance" => "#f59e0b",
        "Reliability" => "#06b6d4",
        "Performance" => "#ec4899",
        _ => "#64748b",
    };

    public static byte[] Build(EnvironmentReviewEntity review)
    {
        var findings = review.Findings.OrderBy(f => PillarOrder(f.Pillar)).ThenBy(f => SeverityOrder(f.Severity)).ToList();
        var byPillar = findings.GroupBy(f => f.Pillar).OrderBy(g => PillarOrder(g.Key)).ToList();

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0);
                page.DefaultTextStyle(t => t.FontFamily("Arial").FontSize(9).FontColor(Text));
                page.Header().Element(c => BuildCoverHeader(c, review));
                page.Footer().Element(c => BuildFooter(c));
                page.Content().Padding(16, Unit.Millimetre).Element(c => BuildBody(c, review, findings, byPillar));
            });
        });

        return doc.GeneratePdf();
    }

    private static void BuildCoverHeader(IContainer container, EnvironmentReviewEntity review)
    {
        container.Background(HeaderBg).Padding(16, Unit.Millimetre).Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("Azure Environment Review").FontSize(7).FontColor(Brand).LetterSpacing(0.15f);
                    inner.Item().Text(review.CustomerName).FontSize(22).Bold().FontColor(White);
                    inner.Item().PaddingTop(4).Text($"Review Date: {review.ReviewDate}  ·  Reviewed by: {review.ReviewedBy}")
                        .FontSize(8).FontColor("#94a3b8");
                });
                row.ConstantItem(60).AlignMiddle().AlignRight().Column(logo =>
                {
                    logo.Item().Text("NightWatch").FontSize(10).Bold().FontColor(Brand);
                    logo.Item().Text("Operations Intelligence").FontSize(6).FontColor("#64748b");
                });
            });

            if (!string.IsNullOrWhiteSpace(review.OverallMaturity))
            {
                col.Item().PaddingTop(8).Row(row =>
                {
                    row.AutoItem().Background("#1e293b").Padding(4, Unit.Millimetre).Column(inner =>
                    {
                        inner.Item().Text("Overall Maturity").FontSize(6).FontColor("#94a3b8").LetterSpacing(0.1f);
                        inner.Item().Text(review.OverallMaturity).FontSize(11).Bold().FontColor(Brand);
                    });
                });
            }
        });
    }

    private static void BuildFooter(IContainer container)
    {
        container.Background(HeaderBg).PaddingHorizontal(16, Unit.Millimetre).PaddingVertical(4, Unit.Millimetre).Row(row =>
        {
            row.RelativeItem().Text("Confidential — for the named recipient only. Do not distribute without permission.")
                .FontSize(6).FontColor("#64748b");
            row.AutoItem().Text(t =>
            {
                t.Span("Page ").FontSize(6).FontColor("#64748b");
                t.CurrentPageNumber().FontSize(6).FontColor("#94a3b8");
                t.Span(" of ").FontSize(6).FontColor("#64748b");
                t.TotalPages().FontSize(6).FontColor("#94a3b8");
            });
        });
    }

    private static void BuildBody(IContainer container, EnvironmentReviewEntity review,
        List<ReviewFindingEntity> findings, List<IGrouping<string, ReviewFindingEntity>> byPillar)
    {
        container.Column(col =>
        {
            // Executive summary
            if (!string.IsNullOrWhiteSpace(review.ExecutiveSummary))
            {
                col.Item().PaddingBottom(8).Column(s =>
                {
                    s.Item().Text("Executive Summary").FontSize(12).Bold().FontColor(Text);
                    s.Item().PaddingTop(2).LineHorizontal(1).LineColor(Brand);
                    s.Item().PaddingTop(6).Background(SectionBg).Padding(8).Text(review.ExecutiveSummary)
                        .FontSize(9).FontColor(Text).LineHeight(1.5f);
                });
            }

            // Scope
            if (!string.IsNullOrWhiteSpace(review.Scope))
            {
                col.Item().PaddingBottom(8).Column(s =>
                {
                    s.Item().Text("Review Scope").FontSize(12).Bold().FontColor(Text);
                    s.Item().PaddingTop(2).LineHorizontal(1).LineColor(Border);
                    s.Item().PaddingTop(6).Text(review.Scope).FontSize(9).FontColor(TextMuted).LineHeight(1.4f);
                });
            }

            // Finding summary table
            col.Item().PaddingBottom(8).Column(s =>
            {
                s.Item().Text("Finding Summary").FontSize(12).Bold().FontColor(Text);
                s.Item().PaddingTop(2).LineHorizontal(1).LineColor(Brand);
                s.Item().PaddingTop(6).Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(3);
                        c.RelativeColumn();
                        c.RelativeColumn();
                        c.RelativeColumn();
                        c.RelativeColumn();
                        c.RelativeColumn();
                    });
                    table.Header(h =>
                    {
                        foreach (var hdr in new[] { "Pillar", "Critical", "High", "Medium", "Low", "Total" })
                            h.Cell().Background("#e2e8f0").Padding(4).Text(hdr).FontSize(8).Bold();
                    });
                    foreach (var grp in byPillar)
                    {
                        table.Cell().BorderBottom(1).BorderColor(Border).Padding(4).Text(grp.Key).FontSize(8);
                        table.Cell().BorderBottom(1).BorderColor(Border).Padding(4)
                            .Text(grp.Count(f => f.Severity == "Critical").ToString()).FontSize(8).FontColor(SeverityColor("Critical"));
                        table.Cell().BorderBottom(1).BorderColor(Border).Padding(4)
                            .Text(grp.Count(f => f.Severity == "High").ToString()).FontSize(8).FontColor(SeverityColor("High"));
                        table.Cell().BorderBottom(1).BorderColor(Border).Padding(4)
                            .Text(grp.Count(f => f.Severity == "Medium").ToString()).FontSize(8).FontColor(SeverityColor("Medium"));
                        table.Cell().BorderBottom(1).BorderColor(Border).Padding(4)
                            .Text(grp.Count(f => f.Severity == "Low").ToString()).FontSize(8).FontColor(SeverityColor("Low"));
                        table.Cell().BorderBottom(1).BorderColor(Border).Padding(4)
                            .Text(grp.Count().ToString()).FontSize(8).Bold();
                    }
                    // Totals row
                    table.Cell().Background("#f1f5f9").Padding(4).Text("TOTAL").FontSize(8).Bold();
                    table.Cell().Background("#f1f5f9").Padding(4).Text(findings.Count(f => f.Severity == "Critical").ToString()).FontSize(8).Bold().FontColor(SeverityColor("Critical"));
                    table.Cell().Background("#f1f5f9").Padding(4).Text(findings.Count(f => f.Severity == "High").ToString()).FontSize(8).Bold().FontColor(SeverityColor("High"));
                    table.Cell().Background("#f1f5f9").Padding(4).Text(findings.Count(f => f.Severity == "Medium").ToString()).FontSize(8).Bold().FontColor(SeverityColor("Medium"));
                    table.Cell().Background("#f1f5f9").Padding(4).Text(findings.Count(f => f.Severity == "Low").ToString()).FontSize(8).Bold().FontColor(SeverityColor("Low"));
                    table.Cell().Background("#f1f5f9").Padding(4).Text(findings.Count.ToString()).FontSize(8).Bold();
                });
            });

            // Findings by pillar
            col.Item().Text("Detailed Findings").FontSize(12).Bold().FontColor(Text);
            col.Item().PaddingTop(2).LineHorizontal(1).LineColor(Brand);

            int seq = 1;
            foreach (var grp in byPillar)
            {
                col.Item().PaddingTop(10).Text(grp.Key).FontSize(10).Bold().FontColor(PillarColor(grp.Key));
                col.Item().LineHorizontal(1).LineColor(Border);

                foreach (var f in grp)
                {
                    col.Item().PaddingTop(6).Background(f.Status == "AcceptedRisk" ? "#fef9c3" : White)
                        .Border(1).BorderColor(Border).Padding(8).Column(fc =>
                        {
                            fc.Item().Row(row =>
                            {
                                row.AutoItem().Background(SeverityColor(f.Severity)).PaddingVertical(2).PaddingHorizontal(4)
                                    .Text(f.Severity.ToUpper()).FontSize(6).Bold().FontColor(White);
                                row.AutoItem().PaddingLeft(6).Text($"#{seq++} — {f.Title}").FontSize(9).Bold();
                                if (!string.IsNullOrWhiteSpace(f.EffortEstimate))
                                    row.AutoItem().PaddingLeft(8).Text($"[{f.EffortEstimate}]").FontSize(7).FontColor(TextMuted);
                                if (f.Status == "AcceptedRisk")
                                    row.AutoItem().PaddingLeft(8).Text("ACCEPTED RISK").FontSize(6).FontColor("#92400e");
                            });

                            fc.Item().PaddingTop(5).Text("Finding").FontSize(7).Bold().FontColor(TextMuted);
                            fc.Item().PaddingTop(2).Text(f.Description).FontSize(8).FontColor(Text).LineHeight(1.4f);

                            if (!string.IsNullOrWhiteSpace(f.Evidence))
                            {
                                fc.Item().PaddingTop(5).Text("Evidence").FontSize(7).Bold().FontColor(TextMuted);
                                fc.Item().PaddingTop(2).Background("#f8fafc").Padding(4)
                                    .Text(f.Evidence).FontSize(7).FontColor("#475569").LineHeight(1.3f);
                            }

                            fc.Item().PaddingTop(5).Text("Recommendation").FontSize(7).Bold().FontColor(TextMuted);
                            fc.Item().PaddingTop(2).Text(f.Recommendation).FontSize(8).FontColor(Text).LineHeight(1.4f);
                        });
                }
            }

            // Signature / delivery
            col.Item().PaddingTop(20).LineHorizontal(1).LineColor(Border);
            col.Item().PaddingTop(8).Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("Report prepared by").FontSize(7).FontColor(TextMuted);
                    inner.Item().PaddingTop(2).Text(review.ReviewedBy).FontSize(9).Bold();
                });
                row.RelativeItem().AlignRight().Column(inner =>
                {
                    inner.Item().Text("Report generated").FontSize(7).FontColor(TextMuted);
                    inner.Item().PaddingTop(2).Text(DateTimeOffset.UtcNow.ToString("dd MMM yyyy")).FontSize(9);
                });
            });
        });
    }

    private static int SeverityOrder(string s) => s switch
    {
        "Critical" => 0, "High" => 1, "Medium" => 2, "Low" => 3, _ => 4
    };

    private static int PillarOrder(string p) => p switch
    {
        "Security" => 0, "Identity" => 1, "Network" => 2, "Cost" => 3,
        "Governance" => 4, "Reliability" => 5, "Performance" => 6, _ => 7
    };
}
