using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddAuditLogAndThresholds : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
                CREATE TABLE dbo.AuditLog (
                    Id          bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    UserId      nvarchar(128) NOT NULL,
                    UserEmail   nvarchar(256) NOT NULL,
                    HttpMethod  nvarchar(10)  NOT NULL,
                    Path        nvarchar(1024) NOT NULL,
                    TenantId    nvarchar(128) NULL,
                    IpAddress   nvarchar(64)  NULL,
                    StatusCode  int           NOT NULL,
                    DurationMs  int           NOT NULL,
                    Timestamp   datetimeoffset NOT NULL,
                    INDEX IX_AuditLog_Timestamp (Timestamp),
                    INDEX IX_AuditLog_UserId    (UserId)
                );
            ");

            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'dbo.AlertThresholds', N'U') IS NULL
                CREATE TABLE dbo.AlertThresholds (
                    Id              int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    TenantId        nvarchar(128) NOT NULL,
                    MetricType      nvarchar(64)  NOT NULL,
                    ThresholdValue  decimal(18,2) NOT NULL,
                    AlertChannel    nvarchar(32)  NOT NULL DEFAULT('Teams'),
                    IsEnabled       bit           NOT NULL DEFAULT(1),
                    CreatedAt       datetimeoffset NOT NULL,
                    UpdatedAt       datetimeoffset NOT NULL,
                    INDEX IX_AlertThresholds_TenantId (TenantId)
                );
            ");

            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'dbo.ThresholdBreaches', N'U') IS NULL
                CREATE TABLE dbo.ThresholdBreaches (
                    Id              int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    ThresholdId     int           NOT NULL,
                    TenantId        nvarchar(128) NOT NULL,
                    MetricType      nvarchar(64)  NOT NULL,
                    ThresholdValue  decimal(18,2) NOT NULL,
                    ActualValue     decimal(18,2) NOT NULL,
                    BreachedAt      datetimeoffset NOT NULL,
                    ResolvedAt      datetimeoffset NULL,
                    INDEX IX_ThresholdBreaches_TenantId_MetricType (TenantId, MetricType)
                );
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF OBJECT_ID(N'dbo.ThresholdBreaches', N'U') IS NOT NULL DROP TABLE dbo.ThresholdBreaches;");
            migrationBuilder.Sql("IF OBJECT_ID(N'dbo.AlertThresholds', N'U') IS NULL DROP TABLE dbo.AlertThresholds;");
            migrationBuilder.Sql("IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NOT NULL DROP TABLE dbo.AuditLog;");
        }
    }
}
