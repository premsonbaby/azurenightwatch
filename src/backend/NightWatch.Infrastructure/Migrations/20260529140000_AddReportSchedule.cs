using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddReportSchedule : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.CustomerTenants', 'ReportScheduleJson') IS NULL
                    ALTER TABLE dbo.CustomerTenants ADD ReportScheduleJson nvarchar(max) NULL;

                IF COL_LENGTH('dbo.CustomerTenants', 'ReportLastSentAt') IS NULL
                    ALTER TABLE dbo.CustomerTenants ADD ReportLastSentAt datetimeoffset NULL;

                IF OBJECT_ID(N'dbo.ReportSentLogs', N'U') IS NULL
                CREATE TABLE dbo.ReportSentLogs (
                    Id              int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    TenantId        nvarchar(128)  NOT NULL,
                    DisplayName     nvarchar(256)  NOT NULL,
                    SentAt          datetimeoffset NOT NULL,
                    RecipientCount  int            NOT NULL DEFAULT 0,
                    Status          nvarchar(32)   NOT NULL DEFAULT 'Sent',
                    ErrorMessage    nvarchar(1024) NULL,
                    FileSizeBytes   bigint         NOT NULL DEFAULT 0,
                    ReportType      nvarchar(32)   NOT NULL DEFAULT 'Email'
                );

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_ReportSentLogs_TenantId'
                      AND object_id = OBJECT_ID(N'dbo.ReportSentLogs')
                )
                CREATE INDEX IX_ReportSentLogs_TenantId ON dbo.ReportSentLogs (TenantId);

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_ReportSentLogs_SentAt'
                      AND object_id = OBJECT_ID(N'dbo.ReportSentLogs')
                )
                CREATE INDEX IX_ReportSentLogs_SentAt ON dbo.ReportSentLogs (SentAt);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS dbo.ReportSentLogs;
                ALTER TABLE dbo.CustomerTenants DROP COLUMN IF EXISTS ReportScheduleJson;
                ALTER TABLE dbo.CustomerTenants DROP COLUMN IF EXISTS ReportLastSentAt;
            ");
        }
    }
}
