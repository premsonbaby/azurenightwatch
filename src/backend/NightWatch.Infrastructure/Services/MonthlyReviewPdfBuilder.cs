using NightWatch.Application.Contracts;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace NightWatch.Infrastructure.Services;

internal static class MonthlyReviewPdfBuilder
{
    private const string Brand = "#22d3ee";
    private const string HeaderBg = "#0f172a";
    private const string SectionBg = "#1e293b";
    private const string Text = "#0f172a";
    private const string TextMuted = "#64748b";
    private const string White = "#ffffff";
    private const string Green = "#16a34a";
    private const string Amber = "#d97706";
    private const string Red = "#dc2626";
    private const string Border = "#e2e8f0";

    private const string OwlSvg = """
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

    public static byte[] Build(MonthlyReviewDto review, string? mspName)
    {
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0);
                page.DefaultTextStyle(t => t.FontFamily("Arial").FontSize(9).FontColor(Text));
                page.Header().Element(c => BuildHeader(c, review, mspName));
                page.Footer().Element(c => BuildFooter(c, mspName));
                page.Content().Padding(16, Unit.Millimetre).Element(c => BuildContent(c, review));
            });
        });

        return doc.GeneratePdf();
    }

    private static void BuildHeader(IContainer c, MonthlyReviewDto review, string? mspName)
    {
        c.Background(HeaderBg).Padding(14).Row(row =>
        {
            row.ConstantItem(48).Height(48).Svg(OwlSvg);
            row.ConstantItem(10);
            row.RelativeItem().AlignMiddle().Column(col =>
            {
                col.Item().Text("Azure Night Watch").Bold().FontSize(18).FontColor(Brand);
                col.Item().Text("Monthly Review Report").FontSize(9).FontColor("#94a3b8");
            });
            row.ConstantItem(220).AlignMiddle().Column(col =>
            {
                col.Item().AlignRight().Text(review.TenantDisplayName).Bold().FontSize(12).FontColor(White);
                col.Item().AlignRight().Text(review.MonthLabel).FontSize(10).FontColor("#94a3b8");
                col.Item().AlignRight()
                    .Text($"Generated: {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC")
                    .FontSize(8).FontColor("#64748b");
            });
        });
    }

    private static void BuildFooter(IContainer c, string? mspName)
    {
        c.Background(HeaderBg).PaddingHorizontal(14).PaddingVertical(6).Row(row =>
        {
            var footerText = string.IsNullOrWhiteSpace(mspName)
                ? "Azure Night Watch — Monthly Review — Confidential"
                : $"Azure Night Watch — Prepared by {mspName} — Confidential";
            row.RelativeItem().Text(footerText).FontSize(7).FontColor("#64748b");
            row.RelativeItem().AlignRight().Text(t =>
            {
                t.Span("Page ").FontSize(7).FontColor("#64748b");
                t.CurrentPageNumber().FontSize(7).FontColor("#64748b");
                t.Span(" of ").FontSize(7).FontColor("#64748b");
                t.TotalPages().FontSize(7).FontColor("#64748b");
            });
        });
    }

    private static void BuildContent(IContainer c, MonthlyReviewDto review)
    {
        c.Column(col =>
        {
            col.Spacing(12);
            col.Item().Element(c2 => BuildExecSummary(c2, review));
            if (review.HasPreviousData)
                col.Item().Element(c2 => BuildScoreComparison(c2, review));
            if (review.Improved.Count > 0 || review.Declined.Count > 0)
                col.Item().Element(c2 => BuildTrendSummary(c2, review));
            col.Item().Element(c2 => BuildActionItems(c2, review));
        });
    }

    private static void BuildExecSummary(IContainer c, MonthlyReviewDto review)
    {
        c.Background(SectionBg).Padding(14).Column(col =>
        {
            col.Item().Text("Executive Summary").Bold().FontSize(12).FontColor(Brand);
            col.Item().PaddingTop(8).Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("Overall Health Score").FontSize(8).FontColor("#94a3b8");
                    inner.Item().Text(review.OverallScore.ToString("F0")).Bold().FontSize(28).FontColor(ScoreColor(review.OverallScore));
                    if (review.OverallDelta.HasValue)
                    {
                        var delta = review.OverallDelta.Value;
                        var sign = delta >= 0 ? "+" : string.Empty;
                        var deltaColor = delta > 0 ? Green : delta < 0 ? Red : TextMuted;
                        inner.Item().Text($"{sign}{delta:F1} vs {review.PreviousMonthLabel}").FontSize(8).FontColor(deltaColor);
                    }
                });
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("Open Action Items").FontSize(8).FontColor("#94a3b8");
                    inner.Item().Text(review.OpenActionItems.ToString()).Bold().FontSize(28).FontColor(review.OpenActionItems == 0 ? Green : Amber);
                    inner.Item().Text($"{review.ResolvedThisMonth} resolved this month").FontSize(8).FontColor(TextMuted);
                });
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("Areas Improved").FontSize(8).FontColor("#94a3b8");
                    inner.Item().Text(review.Improved.Count.ToString()).Bold().FontSize(28).FontColor(Green);
                });
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("Areas Declined").FontSize(8).FontColor("#94a3b8");
                    inner.Item().Text(review.Declined.Count.ToString()).Bold().FontSize(28).FontColor(review.Declined.Count == 0 ? Green : Red);
                });
            });
        });
    }

    private static void BuildScoreComparison(IContainer c, MonthlyReviewDto review)
    {
        c.Column(col =>
        {
            col.Item().PaddingBottom(6).Text("Score Comparison").Bold().FontSize(11).FontColor(Text);
            col.Item().Table(table =>
            {
                table.ColumnsDefinition(cols =>
                {
                    cols.RelativeColumn(3);
                    cols.RelativeColumn(2);
                    cols.RelativeColumn(2);
                    cols.RelativeColumn(2);
                    cols.RelativeColumn(2);
                });

                static void HeaderCell(IContainer h, string label) =>
                    h.Background(SectionBg).Padding(6).Text(label).Bold().FontSize(8).FontColor(Brand);

                table.Header(header =>
                {
                    header.Cell().Element(c2 => HeaderCell(c2, "Dimension"));
                    header.Cell().Element(c2 => HeaderCell(c2, review.PreviousMonthLabel ?? "Previous"));
                    header.Cell().Element(c2 => HeaderCell(c2, review.MonthLabel));
                    header.Cell().Element(c2 => HeaderCell(c2, "Change"));
                    header.Cell().Element(c2 => HeaderCell(c2, "Trend"));
                });

                AddComparisonRow(table, "Overall Health",
                    review.PreviousOverallScore ?? review.OverallScore,
                    review.OverallScore,
                    review.OverallDelta ?? 0);

                foreach (var dim in review.Dimensions)
                    AddComparisonRow(table, dim.Dimension, dim.LastMonth, dim.ThisMonth, dim.Delta);
            });
        });
    }

    private static void AddComparisonRow(TableDescriptor table, string label, decimal prev, decimal cur, decimal delta)
    {
        static void DataCell(IContainer c2, string text, string? color = null)
        {
            var t = c2.BorderBottom(0.5f).BorderColor(Border).Padding(5).Text(text).FontSize(8);
            if (color is not null) t.FontColor(color);
        }

        table.Cell().Element(c2 => DataCell(c2, label));
        table.Cell().Element(c2 => DataCell(c2, prev.ToString("F0")));
        table.Cell().Element(c2 => DataCell(c2, cur.ToString("F0"), ScoreColor(cur)));
        var sign = delta >= 0 ? "+" : string.Empty;
        var deltaColor = delta > 0.5m ? Green : delta < -0.5m ? Red : TextMuted;
        table.Cell().Element(c2 => DataCell(c2, $"{sign}{delta:F1}", deltaColor));
        var arrow = delta > 0.5m ? "▲ Improved" : delta < -0.5m ? "▼ Declined" : "→ Stable";
        var arrowColor = delta > 0.5m ? Green : delta < -0.5m ? Red : TextMuted;
        table.Cell().Element(c2 => DataCell(c2, arrow, arrowColor));
    }

    private static void BuildTrendSummary(IContainer c, MonthlyReviewDto review)
    {
        c.Row(row =>
        {
            if (review.Improved.Count > 0)
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().PaddingBottom(4).Text("What Improved").Bold().FontSize(10).FontColor(Green);
                    foreach (var dim in review.Improved)
                    {
                        col.Item().Row(r =>
                        {
                            r.ConstantItem(12).Text("▲").FontSize(8).FontColor(Green);
                            r.RelativeItem().Text($"{dim.Dimension} (+{dim.Delta:F1})").FontSize(8).FontColor(Text);
                        });
                    }
                });
            }

            if (review.Improved.Count > 0 && review.Declined.Count > 0)
                row.ConstantItem(20);

            if (review.Declined.Count > 0)
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().PaddingBottom(4).Text("What Declined").Bold().FontSize(10).FontColor(Red);
                    foreach (var dim in review.Declined)
                    {
                        col.Item().Row(r =>
                        {
                            r.ConstantItem(12).Text("▼").FontSize(8).FontColor(Red);
                            r.RelativeItem().Text($"{dim.Dimension} ({dim.Delta:F1})").FontSize(8).FontColor(Text);
                        });
                    }
                });
            }
        });
    }

    private static void BuildActionItems(IContainer c, MonthlyReviewDto review)
    {
        c.Column(col =>
        {
            col.Item().PaddingBottom(6).Text("Action Items").Bold().FontSize(11).FontColor(Text);

            var items = review.ActionItems;
            if (items.Count == 0)
            {
                col.Item().Background("#f0fdf4").Border(0.5f).BorderColor("#bbf7d0")
                    .Padding(10).Text("No action items recorded.").FontSize(8).FontColor(Green);
                return;
            }

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(cols =>
                {
                    cols.RelativeColumn(4);
                    cols.RelativeColumn(2);
                    cols.RelativeColumn(1.5f);
                    cols.RelativeColumn(1.5f);
                    cols.RelativeColumn(2);
                });

                static void HeaderCell(IContainer h, string label) =>
                    h.Background(SectionBg).Padding(6).Text(label).Bold().FontSize(8).FontColor(Brand);

                table.Header(header =>
                {
                    header.Cell().Element(c2 => HeaderCell(c2, "Title"));
                    header.Cell().Element(c2 => HeaderCell(c2, "Category"));
                    header.Cell().Element(c2 => HeaderCell(c2, "Priority"));
                    header.Cell().Element(c2 => HeaderCell(c2, "Status"));
                    header.Cell().Element(c2 => HeaderCell(c2, "Month"));
                });

                foreach (var item in items)
                {
                    var priorityColor = item.Priority switch { "High" => Red, "Low" => Green, _ => Amber };
                    var statusColor = item.Status switch { "Resolved" => Green, "Dismissed" => TextMuted, _ => Amber };

                    static void DataCell(IContainer c2, string text, string? color = null)
                    {
                        var t = c2.BorderBottom(0.5f).BorderColor(Border).Padding(5).Text(text).FontSize(8);
                        if (color is not null) t.FontColor(color);
                    }

                    table.Cell().Element(c2 => DataCell(c2, item.Title));
                    table.Cell().Element(c2 => DataCell(c2, item.Category));
                    table.Cell().Element(c2 => DataCell(c2, item.Priority, priorityColor));
                    table.Cell().Element(c2 => DataCell(c2, item.Status, statusColor));
                    table.Cell().Element(c2 => DataCell(c2, item.Month));
                }
            });
        });
    }

    private static string ScoreColor(decimal score) =>
        score >= 80 ? Green : score >= 60 ? Amber : Red;
}
