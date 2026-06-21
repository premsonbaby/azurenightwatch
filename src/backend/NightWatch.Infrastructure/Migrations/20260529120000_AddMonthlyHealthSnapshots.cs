using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddMonthlyHealthSnapshots : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'dbo.MonthlyHealthSnapshots', N'U') IS NULL
                CREATE TABLE dbo.MonthlyHealthSnapshots (
                    Id                      uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
                    TenantId                nvarchar(128)    NOT NULL,
                    SnapshotMonth           nvarchar(7)      NOT NULL,
                    AzureHealthScore        decimal(5,2)     NOT NULL DEFAULT 0,
                    SecurityPostureScore    decimal(5,2)     NOT NULL DEFAULT 0,
                    PerformanceScore        decimal(5,2)     NOT NULL DEFAULT 0,
                    CostEfficiencyScore     decimal(5,2)     NOT NULL DEFAULT 0,
                    ReliabilityScore        decimal(5,2)     NOT NULL DEFAULT 0,
                    GovernanceComplianceScore decimal(5,2)   NOT NULL DEFAULT 0,
                    ActiveCriticalAlerts    int              NOT NULL DEFAULT 0,
                    BackupCoveragePercent   decimal(5,2)     NOT NULL DEFAULT 0,
                    SubscriptionCount       int              NOT NULL DEFAULT 0,
                    CapturedAt              datetimeoffset   NOT NULL
                );

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_MonthlyHealthSnapshots_TenantId_SnapshotMonth'
                      AND object_id = OBJECT_ID(N'dbo.MonthlyHealthSnapshots')
                )
                CREATE UNIQUE INDEX IX_MonthlyHealthSnapshots_TenantId_SnapshotMonth
                    ON dbo.MonthlyHealthSnapshots (TenantId, SnapshotMonth);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS dbo.MonthlyHealthSnapshots;");
        }
    }
}
