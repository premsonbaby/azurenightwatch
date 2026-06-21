namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class CustomerTenantEntity
{
    public int Id { get; set; }
    public string TenantId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset AddedAt { get; set; }
    public DateTimeOffset? LastVerifiedAt { get; set; }
    public string? LogAnalyticsWorkspaceId { get; set; }
    public decimal? MonthlyBudgetLimit { get; set; }
    public string? TeamsWebhookUrl { get; set; }
    public string? VisibleDashboardsJson { get; set; }

    /// <summary>JSON-serialised ReportScheduleConfig. Null means no scheduled email reports.</summary>
    public string? ReportScheduleJson { get; set; }
    public DateTimeOffset? ReportLastSentAt { get; set; }

    /// <summary>JSON-serialised List&lt;string&gt; of email addresses to notify when a breach fires for this tenant.</summary>
    public string? AlertContactsJson { get; set; }
}
