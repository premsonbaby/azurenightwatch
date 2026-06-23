using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddGlobalConfigReportSchedule : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.GlobalOperationsConfig', 'ReportScheduleJson') IS NULL
                    ALTER TABLE dbo.GlobalOperationsConfig ADD ReportScheduleJson nvarchar(max) NULL;

                IF COL_LENGTH('dbo.GlobalOperationsConfig', 'ReportLastSentAt') IS NULL
                    ALTER TABLE dbo.GlobalOperationsConfig ADD ReportLastSentAt datetimeoffset NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE dbo.GlobalOperationsConfig DROP COLUMN IF EXISTS ReportLastSentAt;
                ALTER TABLE dbo.GlobalOperationsConfig DROP COLUMN IF EXISTS ReportScheduleJson;
            ");
        }
    }
}
