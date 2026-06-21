using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddThresholdWebhookEmail : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.AlertThresholds', 'TeamsWebhookUrl') IS NULL
                    ALTER TABLE dbo.AlertThresholds ADD TeamsWebhookUrl nvarchar(1024) NULL;

                IF COL_LENGTH('dbo.AlertThresholds', 'AlertEmail') IS NULL
                    ALTER TABLE dbo.AlertThresholds ADD AlertEmail nvarchar(256) NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.AlertThresholds', 'TeamsWebhookUrl') IS NOT NULL
                    ALTER TABLE dbo.AlertThresholds DROP COLUMN TeamsWebhookUrl;

                IF COL_LENGTH('dbo.AlertThresholds', 'AlertEmail') IS NOT NULL
                    ALTER TABLE dbo.AlertThresholds DROP COLUMN AlertEmail;
            ");
        }
    }
}
