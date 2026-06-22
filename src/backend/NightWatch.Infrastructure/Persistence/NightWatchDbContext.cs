using Microsoft.EntityFrameworkCore;
using NightWatch.Infrastructure.Persistence.Entities;

namespace NightWatch.Infrastructure.Persistence;

public sealed class NightWatchDbContext(DbContextOptions<NightWatchDbContext> options) : DbContext(options)
{
    public DbSet<DailySnapshotEntity> DailySnapshots => Set<DailySnapshotEntity>();
    public DbSet<MonthlyHealthSnapshotEntity> MonthlyHealthSnapshots => Set<MonthlyHealthSnapshotEntity>();
    public DbSet<ReportSentLogEntity> ReportSentLogs => Set<ReportSentLogEntity>();
    public DbSet<ExecutiveDashboardLayoutEntity> ExecutiveDashboardLayouts => Set<ExecutiveDashboardLayoutEntity>();
    public DbSet<GlobalOperationsConfigEntity> GlobalOperationsConfigs => Set<GlobalOperationsConfigEntity>();
    public DbSet<CustomerTenantEntity> CustomerTenants => Set<CustomerTenantEntity>();
    public DbSet<AuditLogEntity> AuditLogs => Set<AuditLogEntity>();
    public DbSet<AlertThresholdEntity> AlertThresholds => Set<AlertThresholdEntity>();
    public DbSet<ThresholdBreachEntity> ThresholdBreaches => Set<ThresholdBreachEntity>();
    public DbSet<ActionItemEntity> ActionItems => Set<ActionItemEntity>();
    public DbSet<EnvironmentReviewEntity> EnvironmentReviews => Set<EnvironmentReviewEntity>();
    public DbSet<ReviewFindingEntity> ReviewFindings => Set<ReviewFindingEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DailySnapshotEntity>(builder =>
        {
            builder.ToTable("DailySnapshots");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.SnapshotDate).IsRequired();
        });

        modelBuilder.Entity<MonthlyHealthSnapshotEntity>(builder =>
        {
            builder.ToTable("MonthlyHealthSnapshots");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.SnapshotMonth).HasMaxLength(7).IsRequired();
            builder.Property(x => x.AzureHealthScore).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(x => x.SecurityPostureScore).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(x => x.PerformanceScore).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(x => x.CostEfficiencyScore).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(x => x.ReliabilityScore).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(x => x.GovernanceComplianceScore).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(x => x.ActiveCriticalAlerts).IsRequired();
            builder.Property(x => x.BackupCoveragePercent).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(x => x.SubscriptionCount).IsRequired();
            builder.Property(x => x.CapturedAt).IsRequired();
            builder.HasIndex(x => new { x.TenantId, x.SnapshotMonth }).IsUnique();
        });

        modelBuilder.Entity<ExecutiveDashboardLayoutEntity>(builder =>
        {
            builder.ToTable("ExecutiveDashboardLayouts");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.UserObjectId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.LayoutJson).IsRequired();
            builder.Property(x => x.UpdatedAtUtc).IsRequired();
            builder.HasIndex(x => new { x.TenantId, x.UserObjectId }).IsUnique();
        });

        modelBuilder.Entity<CustomerTenantEntity>(builder =>
        {
            builder.ToTable("CustomerTenants");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.DisplayName).HasMaxLength(256).IsRequired();
            builder.Property(x => x.IsActive).IsRequired();
            builder.Property(x => x.AddedAt).IsRequired();
            builder.Property(x => x.LastVerifiedAt).IsRequired(false);
            builder.Property(x => x.LogAnalyticsWorkspaceId).HasMaxLength(512).IsRequired(false);
            builder.Property(x => x.MonthlyBudgetLimit).HasColumnType("decimal(18,2)").IsRequired(false);
            builder.Property(x => x.TeamsWebhookUrl).HasMaxLength(2048).IsRequired(false);
            builder.Property(x => x.VisibleDashboardsJson).IsRequired(false);
            builder.Property(x => x.ReportScheduleJson).IsRequired(false);
            builder.Property(x => x.ReportLastSentAt).IsRequired(false);
            builder.Property(x => x.AlertContactsJson).IsRequired(false);
            builder.HasIndex(x => x.TenantId).IsUnique();
        });

        modelBuilder.Entity<ReportSentLogEntity>(builder =>
        {
            builder.ToTable("ReportSentLogs");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.DisplayName).HasMaxLength(256).IsRequired();
            builder.Property(x => x.SentAt).IsRequired();
            builder.Property(x => x.RecipientCount).IsRequired();
            builder.Property(x => x.Status).HasMaxLength(32).IsRequired();
            builder.Property(x => x.ErrorMessage).HasMaxLength(1024).IsRequired(false);
            builder.Property(x => x.FileSizeBytes).IsRequired();
            builder.Property(x => x.ReportType).HasMaxLength(32).IsRequired();
            builder.HasIndex(x => x.TenantId);
            builder.HasIndex(x => x.SentAt);
        });

        modelBuilder.Entity<AuditLogEntity>(builder =>
        {
            builder.ToTable("AuditLog");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedOnAdd();
            builder.Property(x => x.UserId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.UserEmail).HasMaxLength(256).IsRequired();
            builder.Property(x => x.HttpMethod).HasMaxLength(10).IsRequired();
            builder.Property(x => x.Path).HasMaxLength(1024).IsRequired();
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired(false);
            builder.Property(x => x.IpAddress).HasMaxLength(64).IsRequired(false);
            builder.Property(x => x.StatusCode).IsRequired();
            builder.Property(x => x.DurationMs).IsRequired();
            builder.Property(x => x.Timestamp).IsRequired();
            builder.HasIndex(x => x.Timestamp);
            builder.HasIndex(x => x.UserId);
        });

        modelBuilder.Entity<AlertThresholdEntity>(builder =>
        {
            builder.ToTable("AlertThresholds");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.MetricType).HasMaxLength(64).IsRequired();
            builder.Property(x => x.ThresholdValue).HasColumnType("decimal(18,2)").IsRequired();
            builder.Property(x => x.AlertChannel).HasMaxLength(32).IsRequired();
            builder.Property(x => x.IsEnabled).IsRequired();
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.UpdatedAt).IsRequired();
            builder.HasIndex(x => x.TenantId);
        });

        modelBuilder.Entity<ThresholdBreachEntity>(builder =>
        {
            builder.ToTable("ThresholdBreaches");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.MetricType).HasMaxLength(64).IsRequired();
            builder.Property(x => x.ThresholdValue).HasColumnType("decimal(18,2)").IsRequired();
            builder.Property(x => x.ActualValue).HasColumnType("decimal(18,2)").IsRequired();
            builder.Property(x => x.BreachedAt).IsRequired();
            builder.Property(x => x.ResolvedAt).IsRequired(false);
            builder.Property(x => x.AlertTitle).HasMaxLength(256).IsRequired(false);
            builder.Property(x => x.BusinessImpact).HasMaxLength(1024).IsRequired(false);
            builder.Property(x => x.SuggestedAction).HasMaxLength(1024).IsRequired(false);
            builder.Property(x => x.Severity).HasMaxLength(32).IsRequired();
            builder.Property(x => x.IsAcknowledged).IsRequired();
            builder.Property(x => x.AcknowledgedAt).IsRequired(false);
            builder.Property(x => x.AcknowledgedBy).HasMaxLength(256).IsRequired(false);
            builder.HasIndex(x => new { x.TenantId, x.MetricType });
            builder.HasIndex(x => new { x.TenantId, x.IsAcknowledged });
        });

        modelBuilder.Entity<ActionItemEntity>(builder =>
        {
            builder.ToTable("ActionItems");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedOnAdd();
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.Month).HasMaxLength(7).IsRequired();
            builder.Property(x => x.Title).HasMaxLength(256).IsRequired();
            builder.Property(x => x.Description).HasMaxLength(2048).IsRequired();
            builder.Property(x => x.Priority).HasMaxLength(16).IsRequired();
            builder.Property(x => x.Status).HasMaxLength(16).IsRequired();
            builder.Property(x => x.Category).HasMaxLength(32).IsRequired();
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.ResolvedAt).IsRequired(false);
            builder.Property(x => x.ResolvedBy).HasMaxLength(256).IsRequired(false);
            builder.Property(x => x.ResolutionNote).HasMaxLength(1024).IsRequired(false);
            builder.HasIndex(x => new { x.TenantId, x.Month });
            builder.HasIndex(x => new { x.TenantId, x.Status });
        });

        modelBuilder.Entity<EnvironmentReviewEntity>(builder =>
        {
            builder.ToTable("EnvironmentReviews");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedOnAdd();
            builder.Property(x => x.TenantId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.CustomerName).HasMaxLength(256).IsRequired();
            builder.Property(x => x.ReviewDate).HasMaxLength(10).IsRequired();
            builder.Property(x => x.ReviewedBy).HasMaxLength(256).IsRequired();
            builder.Property(x => x.Status).HasMaxLength(32).IsRequired();
            builder.Property(x => x.Scope).HasMaxLength(2048).IsRequired(false);
            builder.Property(x => x.ExecutiveSummary).HasMaxLength(4000).IsRequired(false);
            builder.Property(x => x.OverallMaturity).HasMaxLength(32).IsRequired(false);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.UpdatedAt).IsRequired();
            builder.HasMany(x => x.Findings).WithOne(x => x.Review).HasForeignKey(x => x.ReviewId).OnDelete(DeleteBehavior.Cascade);
            builder.HasIndex(x => x.TenantId);
            builder.HasIndex(x => x.ReviewDate);
        });

        modelBuilder.Entity<ReviewFindingEntity>(builder =>
        {
            builder.ToTable("ReviewFindings");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedOnAdd();
            builder.Property(x => x.ReviewId).IsRequired();
            builder.Property(x => x.Pillar).HasMaxLength(64).IsRequired();
            builder.Property(x => x.Severity).HasMaxLength(32).IsRequired();
            builder.Property(x => x.Title).HasMaxLength(256).IsRequired();
            builder.Property(x => x.Description).HasMaxLength(4000).IsRequired();
            builder.Property(x => x.Recommendation).HasMaxLength(4000).IsRequired();
            builder.Property(x => x.Evidence).HasMaxLength(2048).IsRequired(false);
            builder.Property(x => x.EffortEstimate).HasMaxLength(32).IsRequired(false);
            builder.Property(x => x.Status).HasMaxLength(32).IsRequired();
            builder.Property(x => x.LibraryRef).HasMaxLength(128).IsRequired(false);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => x.ReviewId);
        });

        modelBuilder.Entity<GlobalOperationsConfigEntity>(builder =>
        {
            builder.ToTable("GlobalOperationsConfig");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.ScopeKey).HasMaxLength(64).IsRequired();
            builder.Property(x => x.SubscriptionId).HasMaxLength(128).IsRequired();
            builder.Property(x => x.LogAnalyticsWorkspaceId).HasMaxLength(256).IsRequired();
            builder.Property(x => x.AiTarget).HasMaxLength(64).IsRequired();
            builder.Property(x => x.AiEndpoint).HasMaxLength(512).IsRequired();
            builder.Property(x => x.AiModel).HasMaxLength(128).IsRequired();
            builder.Property(x => x.AiApiKey).HasMaxLength(2048).IsRequired();
            builder.Property(x => x.AiUsageMonthKey).HasMaxLength(7).IsRequired();
            builder.Property(x => x.AiPromptTokens).IsRequired();
            builder.Property(x => x.AiCompletionTokens).IsRequired();
            builder.Property(x => x.AiEstimatedCostUsd).HasColumnType("decimal(18,6)").IsRequired();
            builder.Property(x => x.AiUsageUpdatedAtUtc).IsRequired(false);
            builder.Property(x => x.DrSettingsJson).IsRequired();
            builder.Property(x => x.TeamsSettingsJson).IsRequired();
            builder.Property(x => x.TeamsLastReportSentAt).IsRequired(false);
            builder.Property(x => x.TeamsAlertStateJson).IsRequired();
            builder.Property(x => x.AiSummaryEnabled).IsRequired();
            builder.Property(x => x.ReportScheduleJson).IsRequired(false);
            builder.Property(x => x.ReportLastSentAt).IsRequired(false);
            builder.Property(x => x.UpdatedAtUtc).IsRequired();
            builder.HasIndex(x => x.ScopeKey).IsUnique();
        });
    }
}
