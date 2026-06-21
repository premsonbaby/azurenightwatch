using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddAlertContacts : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.CustomerTenants', 'AlertContactsJson') IS NULL
                    ALTER TABLE dbo.CustomerTenants ADD AlertContactsJson nvarchar(max) NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.CustomerTenants', 'AlertContactsJson') IS NOT NULL
                    ALTER TABLE dbo.CustomerTenants DROP COLUMN AlertContactsJson;
            ");
        }
    }
}
