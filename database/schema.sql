CREATE TABLE dbo.DailySnapshots (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId NVARCHAR(128) NOT NULL,
    SnapshotDate DATETIMEOFFSET NOT NULL,
    AzureHealthScore DECIMAL(5,2) NOT NULL,
    SecurityScore DECIMAL(5,2) NOT NULL,
    CostEfficiencyScore DECIMAL(5,2) NOT NULL,
    ReliabilityScore DECIMAL(5,2) NOT NULL,
    GovernanceScore DECIMAL(5,2) NOT NULL,
    BusinessImpactEstimateEur DECIMAL(18,2) NOT NULL
);

CREATE INDEX IX_DailySnapshots_TenantId_SnapshotDate
ON dbo.DailySnapshots(TenantId, SnapshotDate DESC);

CREATE TABLE dbo.ExecutiveDashboardLayouts (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId NVARCHAR(128) NOT NULL,
    UserObjectId NVARCHAR(128) NOT NULL,
    LayoutJson NVARCHAR(MAX) NOT NULL,
    UpdatedAtUtc DATETIMEOFFSET NOT NULL
);

CREATE UNIQUE INDEX IX_ExecutiveDashboardLayouts_TenantId_UserObjectId
ON dbo.ExecutiveDashboardLayouts(TenantId, UserObjectId);

CREATE TABLE dbo.GlobalOperationsConfig (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ScopeKey NVARCHAR(64) NOT NULL,
    SubscriptionId NVARCHAR(128) NOT NULL,
    LogAnalyticsWorkspaceId NVARCHAR(256) NOT NULL,
    AiTarget NVARCHAR(64) NOT NULL,
    AiEndpoint NVARCHAR(512) NOT NULL,
    AiModel NVARCHAR(128) NOT NULL,
    AiApiKey NVARCHAR(2048) NOT NULL,
    AiUsageMonthKey NVARCHAR(7) NOT NULL,
    AiPromptTokens BIGINT NOT NULL,
    AiCompletionTokens BIGINT NOT NULL,
    AiEstimatedCostUsd DECIMAL(18,6) NOT NULL,
    AiUsageUpdatedAtUtc DATETIMEOFFSET NULL,
    DrSettingsJson NVARCHAR(MAX) NOT NULL,
    UpdatedAtUtc DATETIMEOFFSET NOT NULL
);

CREATE UNIQUE INDEX IX_GlobalOperationsConfig_ScopeKey
ON dbo.GlobalOperationsConfig(ScopeKey);
