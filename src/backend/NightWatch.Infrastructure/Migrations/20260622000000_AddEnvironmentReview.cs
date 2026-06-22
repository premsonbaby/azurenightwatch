using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NightWatch.Infrastructure.Migrations
{
    public partial class AddEnvironmentReview : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'dbo.EnvironmentReviews', N'U') IS NULL
                CREATE TABLE dbo.EnvironmentReviews (
                    Id                  int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    TenantId            nvarchar(128)  NOT NULL,
                    CustomerName        nvarchar(256)  NOT NULL,
                    ReviewDate          nvarchar(10)   NOT NULL,
                    ReviewedBy          nvarchar(256)  NOT NULL,
                    Status              nvarchar(32)   NOT NULL DEFAULT 'Draft',
                    Scope               nvarchar(2048) NULL,
                    ExecutiveSummary    nvarchar(4000) NULL,
                    OverallMaturity     nvarchar(32)   NULL,
                    CreatedAt           datetimeoffset NOT NULL,
                    UpdatedAt           datetimeoffset NOT NULL
                );

                IF OBJECT_ID(N'dbo.ReviewFindings', N'U') IS NULL
                CREATE TABLE dbo.ReviewFindings (
                    Id                  int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    ReviewId            int            NOT NULL,
                    Pillar              nvarchar(64)   NOT NULL DEFAULT 'General',
                    Severity            nvarchar(32)   NOT NULL DEFAULT 'Medium',
                    Title               nvarchar(256)  NOT NULL,
                    Description         nvarchar(4000) NOT NULL DEFAULT '',
                    Recommendation      nvarchar(4000) NOT NULL DEFAULT '',
                    Evidence            nvarchar(2048) NULL,
                    EffortEstimate      nvarchar(32)   NULL,
                    Status              nvarchar(32)   NOT NULL DEFAULT 'Open',
                    LibraryRef          nvarchar(128)  NULL,
                    CreatedAt           datetimeoffset NOT NULL,
                    CONSTRAINT FK_ReviewFindings_EnvironmentReviews FOREIGN KEY (ReviewId)
                        REFERENCES dbo.EnvironmentReviews (Id) ON DELETE CASCADE
                );

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnvironmentReviews_TenantId' AND object_id = OBJECT_ID(N'dbo.EnvironmentReviews'))
                CREATE INDEX IX_EnvironmentReviews_TenantId ON dbo.EnvironmentReviews (TenantId);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnvironmentReviews_ReviewDate' AND object_id = OBJECT_ID(N'dbo.EnvironmentReviews'))
                CREATE INDEX IX_EnvironmentReviews_ReviewDate ON dbo.EnvironmentReviews (ReviewDate);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReviewFindings_ReviewId' AND object_id = OBJECT_ID(N'dbo.ReviewFindings'))
                CREATE INDEX IX_ReviewFindings_ReviewId ON dbo.ReviewFindings (ReviewId);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS dbo.ReviewFindings;
                DROP TABLE IF EXISTS dbo.EnvironmentReviews;
            ");
        }
    }
}
