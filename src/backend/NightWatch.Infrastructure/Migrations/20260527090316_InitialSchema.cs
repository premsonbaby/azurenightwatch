using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // All CREATE TABLE statements are guarded with IF NOT EXISTS so this migration
            // is safe to run against an existing database that was bootstrapped with EnsureCreated.
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DailySnapshots')
                BEGIN
                    CREATE TABLE [DailySnapshots] (
                        [Id]                        uniqueidentifier  NOT NULL,
                        [TenantId]                  nvarchar(128)     NOT NULL,
                        [SnapshotDate]              datetimeoffset    NOT NULL,
                        [AzureHealthScore]          decimal(18,2)     NOT NULL,
                        [SecurityScore]             decimal(18,2)     NOT NULL,
                        [CostEfficiencyScore]       decimal(18,2)     NOT NULL,
                        [ReliabilityScore]          decimal(18,2)     NOT NULL,
                        [GovernanceScore]           decimal(18,2)     NOT NULL,
                        [BusinessImpactEstimateEur] decimal(18,2)     NOT NULL,
                        CONSTRAINT [PK_DailySnapshots] PRIMARY KEY ([Id])
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ExecutiveDashboardLayouts')
                BEGIN
                    CREATE TABLE [ExecutiveDashboardLayouts] (
                        [Id]            uniqueidentifier  NOT NULL,
                        [TenantId]      nvarchar(128)     NOT NULL,
                        [UserObjectId]  nvarchar(128)     NOT NULL,
                        [LayoutJson]    nvarchar(max)     NOT NULL,
                        [UpdatedAtUtc]  datetimeoffset    NOT NULL,
                        CONSTRAINT [PK_ExecutiveDashboardLayouts] PRIMARY KEY ([Id])
                    );
                    CREATE UNIQUE INDEX [IX_ExecutiveDashboardLayouts_TenantId_UserObjectId]
                        ON [ExecutiveDashboardLayouts] ([TenantId], [UserObjectId]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'GlobalOperationsConfig')
                BEGIN
                    CREATE TABLE [GlobalOperationsConfig] (
                        [Id]                    uniqueidentifier  NOT NULL,
                        [ScopeKey]              nvarchar(64)      NOT NULL,
                        [SubscriptionId]        nvarchar(128)     NOT NULL,
                        [LogAnalyticsWorkspaceId] nvarchar(256)   NOT NULL,
                        [AiTarget]              nvarchar(64)      NOT NULL,
                        [AiEndpoint]            nvarchar(512)     NOT NULL,
                        [AiModel]               nvarchar(128)     NOT NULL,
                        [AiApiKey]              nvarchar(2048)    NOT NULL,
                        [AiUsageMonthKey]       nvarchar(7)       NOT NULL,
                        [AiPromptTokens]        bigint            NOT NULL,
                        [AiCompletionTokens]    bigint            NOT NULL,
                        [AiEstimatedCostUsd]    decimal(18,6)     NOT NULL,
                        [AiUsageUpdatedAtUtc]   datetimeoffset    NULL,
                        [DrSettingsJson]        nvarchar(max)     NOT NULL,
                        [AiBriefingPrompt]      nvarchar(max)     NOT NULL,
                        [TeamsSettingsJson]     nvarchar(max)     NOT NULL,
                        [TeamsLastReportSentAt] datetimeoffset    NULL,
                        [TeamsAlertStateJson]   nvarchar(max)     NOT NULL,
                        [UpdatedAtUtc]          datetimeoffset    NOT NULL,
                        CONSTRAINT [PK_GlobalOperationsConfig] PRIMARY KEY ([Id])
                    );
                    CREATE UNIQUE INDEX [IX_GlobalOperationsConfig_ScopeKey]
                        ON [GlobalOperationsConfig] ([ScopeKey]);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CustomerTenants')
                BEGIN
                    CREATE TABLE [CustomerTenants] (
                        [Id]                       int              NOT NULL IDENTITY(1,1),
                        [TenantId]                 nvarchar(128)    NOT NULL,
                        [DisplayName]              nvarchar(256)    NOT NULL,
                        [IsActive]                 bit              NOT NULL,
                        [AddedAt]                  datetimeoffset   NOT NULL,
                        [LastVerifiedAt]           datetimeoffset   NULL,
                        [LogAnalyticsWorkspaceId]  nvarchar(512)    NULL,
                        [MonthlyBudgetLimit]       decimal(18,2)    NULL,
                        [TeamsWebhookUrl]          nvarchar(2048)   NULL,
                        CONSTRAINT [PK_CustomerTenants] PRIMARY KEY ([Id]),
                        CONSTRAINT [UQ_CustomerTenants_TenantId] UNIQUE ([TenantId])
                    );
                    CREATE UNIQUE INDEX [IX_CustomerTenants_TenantId]
                        ON [CustomerTenants] ([TenantId]);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "CustomerTenants");
            migrationBuilder.DropTable(name: "DailySnapshots");
            migrationBuilder.DropTable(name: "ExecutiveDashboardLayouts");
            migrationBuilder.DropTable(name: "GlobalOperationsConfig");
        }
    }
}
