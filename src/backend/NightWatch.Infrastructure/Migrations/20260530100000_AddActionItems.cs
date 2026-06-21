using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddActionItems : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'dbo.ActionItems', N'U') IS NULL
                CREATE TABLE dbo.ActionItems (
                    Id              int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    TenantId        nvarchar(128)  NOT NULL,
                    Month           nvarchar(7)    NOT NULL,
                    Title           nvarchar(256)  NOT NULL,
                    Description     nvarchar(2048) NOT NULL DEFAULT '',
                    Priority        nvarchar(16)   NOT NULL DEFAULT 'Medium',
                    Status          nvarchar(16)   NOT NULL DEFAULT 'Open',
                    Category        nvarchar(32)   NOT NULL DEFAULT 'General',
                    CreatedAt       datetimeoffset NOT NULL,
                    ResolvedAt      datetimeoffset NULL,
                    ResolvedBy      nvarchar(256)  NULL,
                    ResolutionNote  nvarchar(1024) NULL
                );

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_ActionItems_TenantId_Month'
                      AND object_id = OBJECT_ID(N'dbo.ActionItems')
                )
                CREATE INDEX IX_ActionItems_TenantId_Month ON dbo.ActionItems (TenantId, Month);

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_ActionItems_TenantId_Status'
                      AND object_id = OBJECT_ID(N'dbo.ActionItems')
                )
                CREATE INDEX IX_ActionItems_TenantId_Status ON dbo.ActionItems (TenantId, Status);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS dbo.ActionItems;");
        }
    }
}
