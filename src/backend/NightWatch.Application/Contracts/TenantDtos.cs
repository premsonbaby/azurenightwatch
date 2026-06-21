namespace NightWatch.Application.Contracts;

public sealed record CustomerTenantDto(
    int Id,
    string TenantId,
    string DisplayName,
    bool IsActive,
    DateTimeOffset AddedAt,
    DateTimeOffset? LastVerifiedAt,
    string? LogAnalyticsWorkspaceId,
    decimal? MonthlyBudgetLimit,
    bool HasTeamsWebhook,
    IReadOnlyList<string>? VisibleDashboards = null,
    IReadOnlyList<string>? AlertContacts = null
);

public sealed record AddTenantRequest(
    string TenantId,
    string DisplayName
);

public sealed record UpdateTenantSettingsRequest(
    string? LogAnalyticsWorkspaceId,
    decimal? MonthlyBudgetLimit,
    string? TeamsWebhookUrl,
    IReadOnlyList<string>? VisibleDashboards = null,
    IReadOnlyList<string>? AlertContacts = null
);

public sealed record LogAnalyticsWorkspaceDto(
    string WorkspaceId,
    string Name,
    string ResourceGroup,
    string SubscriptionId
);
