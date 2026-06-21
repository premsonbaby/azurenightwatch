using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddBreachNarrative : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF COL_LENGTH('dbo.ThresholdBreaches', 'AlertTitle') IS NULL
                    ALTER TABLE dbo.ThresholdBreaches ADD AlertTitle nvarchar(256) NULL;

                IF COL_LENGTH('dbo.ThresholdBreaches', 'BusinessImpact') IS NULL
                    ALTER TABLE dbo.ThresholdBreaches ADD BusinessImpact nvarchar(1024) NULL;

                IF COL_LENGTH('dbo.ThresholdBreaches', 'SuggestedAction') IS NULL
                    ALTER TABLE dbo.ThresholdBreaches ADD SuggestedAction nvarchar(1024) NULL;

                IF COL_LENGTH('dbo.ThresholdBreaches', 'Severity') IS NULL
                    ALTER TABLE dbo.ThresholdBreaches ADD Severity nvarchar(32) NOT NULL DEFAULT 'High';

                IF COL_LENGTH('dbo.ThresholdBreaches', 'IsAcknowledged') IS NULL
                    ALTER TABLE dbo.ThresholdBreaches ADD IsAcknowledged bit NOT NULL DEFAULT 0;

                IF COL_LENGTH('dbo.ThresholdBreaches', 'AcknowledgedAt') IS NULL
                    ALTER TABLE dbo.ThresholdBreaches ADD AcknowledgedAt datetimeoffset NULL;

                IF COL_LENGTH('dbo.ThresholdBreaches', 'AcknowledgedBy') IS NULL
                    ALTER TABLE dbo.ThresholdBreaches ADD AcknowledgedBy nvarchar(256) NULL;

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_ThresholdBreaches_TenantId_IsAcknowledged'
                      AND object_id = OBJECT_ID(N'dbo.ThresholdBreaches')
                )
                CREATE INDEX IX_ThresholdBreaches_TenantId_IsAcknowledged
                    ON dbo.ThresholdBreaches (TenantId, IsAcknowledged);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE dbo.ThresholdBreaches DROP COLUMN IF EXISTS AlertTitle;
                ALTER TABLE dbo.ThresholdBreaches DROP COLUMN IF EXISTS BusinessImpact;
                ALTER TABLE dbo.ThresholdBreaches DROP COLUMN IF EXISTS SuggestedAction;
                ALTER TABLE dbo.ThresholdBreaches DROP COLUMN IF EXISTS Severity;
                ALTER TABLE dbo.ThresholdBreaches DROP COLUMN IF EXISTS IsAcknowledged;
                ALTER TABLE dbo.ThresholdBreaches DROP COLUMN IF EXISTS AcknowledgedAt;
                ALTER TABLE dbo.ThresholdBreaches DROP COLUMN IF EXISTS AcknowledgedBy;
            ");
        }
    }
}
