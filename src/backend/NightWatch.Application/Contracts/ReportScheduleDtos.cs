namespace NightWatch.Application.Contracts;

public sealed record ReportScheduleDto(
    string TenantId,
    bool Enabled,
    string Frequency,           // "Monthly" | "Weekly"
    int DayOfMonth,             // 1-28, used when Frequency = Monthly
    string DayOfWeek,           // "Monday"..."Sunday", used when Frequency = Weekly
    string SendTime,            // "HH:mm" in the configured timezone
    string TimeZone,            // IANA/Windows tz id
    IReadOnlyList<string> Recipients,
    bool IncludeAiSummary,
    DateTimeOffset? LastSentAt,
    bool SmtpConfigured);

public sealed record UpsertReportScheduleRequest(
    bool Enabled,
    string Frequency,
    int DayOfMonth,
    string DayOfWeek,
    string SendTime,
    string TimeZone,
    IReadOnlyList<string> Recipients,
    bool IncludeAiSummary);

public sealed record ReportSentLogDto(
    int Id,
    string TenantId,
    string DisplayName,
    DateTimeOffset SentAt,
    int RecipientCount,
    string Status,
    string? ErrorMessage,
    long FileSizeBytes,
    string ReportType);
