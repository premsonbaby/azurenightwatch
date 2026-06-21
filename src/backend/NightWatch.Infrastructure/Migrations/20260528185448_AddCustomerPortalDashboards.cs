using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerPortalDashboards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent — EnsurePersistenceSchema may have already added AiSummaryEnabled
            migrationBuilder.Sql(@"
                IF COL_LENGTH('GlobalOperationsConfig', 'AiSummaryEnabled') IS NULL
                    ALTER TABLE [GlobalOperationsConfig] ADD [AiSummaryEnabled] bit NOT NULL CONSTRAINT DF_GlobalOperationsConfig_AiSummaryEnabled DEFAULT(0);
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('CustomerTenants', 'VisibleDashboardsJson') IS NULL
                    ALTER TABLE [CustomerTenants] ADD [VisibleDashboardsJson] nvarchar(max) NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('GlobalOperationsConfig', 'AiSummaryEnabled') IS NOT NULL
                    ALTER TABLE [GlobalOperationsConfig] DROP CONSTRAINT DF_GlobalOperationsConfig_AiSummaryEnabled;
                IF COL_LENGTH('GlobalOperationsConfig', 'AiSummaryEnabled') IS NOT NULL
                    ALTER TABLE [GlobalOperationsConfig] DROP COLUMN [AiSummaryEnabled];
            ");

            migrationBuilder.Sql(@"
                IF COL_LENGTH('CustomerTenants', 'VisibleDashboardsJson') IS NOT NULL
                    ALTER TABLE [CustomerTenants] DROP COLUMN [VisibleDashboardsJson];
            ");
        }
    }
}
