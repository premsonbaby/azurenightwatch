using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Options;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;
using NightWatch.Infrastructure.Services.Azure;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed class OperationsScopeService(
    IOptions<AzureOperationsOptions> options,
    IServiceScopeFactory scopeFactory,
    ILogger<OperationsScopeService> logger) : IOperationsScopeService
{
    private readonly object _lock = new();
    private const string GlobalScopeKey = "global";

    // ── Global (AI + home-tenant) singleton fields ────────────────────────────
    private string? _selectedSubscriptionId = null;
    private List<string>? _selectedLogAnalyticsWorkspaceIds = null;
    private string? _selectedAiTarget = null;
    private string? _selectedAiEndpoint = null;
    private string? _selectedAiModel = null;
    private string? _selectedAiApiKey = null;
    private string _aiUsageMonthKey = DateTimeOffset.UtcNow.ToString("yyyy-MM");
    private long _aiPromptTokens;
    private long _aiCompletionTokens;
    private decimal _aiEstimatedCostUsd;
    private DateTimeOffset? _aiUsageUpdatedAtUtc;
    private DrScopeSettings? _selectedDrSettings = null;
    private string? _aiBriefingPrompt = null;
    private bool _aiSummaryEnabled = false;
    private DateTimeOffset _updatedAtUtc = DateTimeOffset.UtcNow;
    private bool _loadedFromStore;

    // ── Per-customer-tenant in-memory cache ───────────────────────────────────
    private sealed class TenantScopeState
    {
        public string? SubscriptionId;
        public List<string>? WorkspaceIds;
        public DrScopeSettings? DrSettings;
        public DateTimeOffset UpdatedAt = DateTimeOffset.UtcNow;
        public bool Loaded;
    }
    private readonly Dictionary<string, TenantScopeState> _tenantCache = new(StringComparer.OrdinalIgnoreCase);

    private static string GetCurrentScopeKey() =>
        TenantCredentialContext.GetCurrentTenantId() ?? GlobalScopeKey;

    // ── Public API ─────────────────────────────────────────────────────────────

    public OperationsScopeSettings GetCurrent()
    {
        lock (_lock)
        {
            EnsureLoaded();
            var scopeKey = GetCurrentScopeKey();
            if (scopeKey != GlobalScopeKey)
            {
                EnsureTenantLoaded(scopeKey);
                return BuildTenantSettings(_tenantCache[scopeKey]);
            }
            return BuildSettings();
        }
    }

    public OperationsScopeSettings Update(
        string? subscriptionId,
        IReadOnlyList<string>? logAnalyticsWorkspaceIds,
        string? aiTarget,
        string? aiEndpoint,
        string? aiModel,
        string? aiApiKey,
        DrScopeSettings? drSettings,
        bool? aiSummaryEnabled = null)
    {
        lock (_lock)
        {
            EnsureLoaded();
            var scopeKey = GetCurrentScopeKey();

            // AI settings always live in the global singleton
            _selectedAiTarget = string.IsNullOrWhiteSpace(aiTarget) ? null : aiTarget.Trim();
            _selectedAiEndpoint = string.IsNullOrWhiteSpace(aiEndpoint) ? null : aiEndpoint.Trim();
            _selectedAiModel = string.IsNullOrWhiteSpace(aiModel) ? null : aiModel.Trim();
            _selectedAiApiKey = string.IsNullOrWhiteSpace(aiApiKey) ? null : aiApiKey.Trim();
            if (aiSummaryEnabled.HasValue) _aiSummaryEnabled = aiSummaryEnabled.Value;
            _updatedAtUtc = DateTimeOffset.UtcNow;

            if (scopeKey == GlobalScopeKey)
            {
                // Home tenant — subscription/workspace/DR also live in the global singleton
                _selectedSubscriptionId = string.IsNullOrWhiteSpace(subscriptionId)
                    ? null : subscriptionId.Trim();
                _selectedLogAnalyticsWorkspaceIds = logAnalyticsWorkspaceIds is null
                    ? null
                    : logAnalyticsWorkspaceIds
                        .Where(id => !string.IsNullOrWhiteSpace(id))
                        .Select(id => id.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                if (drSettings is not null) _selectedDrSettings = drSettings;
                PersistCurrent();
                return BuildSettings();
            }
            else
            {
                // Customer tenant — save AI to global row, save tenant-specific to tenant row
                var normalizedWorkspaceIds = logAnalyticsWorkspaceIds is null
                    ? null
                    : logAnalyticsWorkspaceIds
                        .Where(id => !string.IsNullOrWhiteSpace(id))
                        .Select(id => id.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                PersistGlobalAi();
                PersistTenantScope(scopeKey, subscriptionId?.Trim(), normalizedWorkspaceIds, drSettings);

                // Update in-memory tenant cache
                if (!_tenantCache.TryGetValue(scopeKey, out var tenantState))
                    _tenantCache[scopeKey] = tenantState = new TenantScopeState { Loaded = true };
                tenantState.SubscriptionId = string.IsNullOrWhiteSpace(subscriptionId) ? null : subscriptionId.Trim();
                tenantState.WorkspaceIds = normalizedWorkspaceIds is { Count: > 0 } ? normalizedWorkspaceIds : null;
                if (drSettings is not null) tenantState.DrSettings = drSettings;
                tenantState.UpdatedAt = DateTimeOffset.UtcNow;

                return BuildTenantSettings(tenantState);
            }
        }
    }

    public void RecordAiUsage(AiUsageSample usageSample)
    {
        lock (_lock)
        {
            EnsureLoaded();

            var monthKey = usageSample.OccurredAtUtc.ToString("yyyy-MM");
            if (!string.Equals(_aiUsageMonthKey, monthKey, StringComparison.Ordinal))
            {
                _aiUsageMonthKey = monthKey;
                _aiPromptTokens = 0;
                _aiCompletionTokens = 0;
                _aiEstimatedCostUsd = 0m;
            }

            _aiPromptTokens += Math.Max(0, usageSample.PromptTokens);
            _aiCompletionTokens += Math.Max(0, usageSample.CompletionTokens);
            _aiEstimatedCostUsd += Math.Max(0m, usageSample.EstimatedCostUsd);
            _aiUsageUpdatedAtUtc = usageSample.OccurredAtUtc;

            PersistGlobalAi();
        }
    }

    public string? GetAiBriefingPrompt()
    {
        lock (_lock)
        {
            EnsureLoaded();
            return _aiBriefingPrompt;
        }
    }

    public void SetAiBriefingPrompt(string? prompt)
    {
        lock (_lock)
        {
            EnsureLoaded();
            _aiBriefingPrompt = string.IsNullOrWhiteSpace(prompt) ? null : prompt.Trim();
            _updatedAtUtc = DateTimeOffset.UtcNow;
            PersistGlobalAi();
        }
    }

    public TeamsNotificationSettings GetTeamsSettings()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
        if (db == null) return new TeamsNotificationSettings("", false, "09:00", "UTC", false);
        var scopeKey = GetCurrentScopeKey();
        var row = db.GlobalOperationsConfigs.FirstOrDefault(x => x.ScopeKey == scopeKey);
        if (row == null) return new TeamsNotificationSettings("", false, "09:00", "UTC", false);
        return DeserializeTeamsSettings(row.TeamsSettingsJson);
    }

    public async Task SaveTeamsSettingsAsync(TeamsNotificationSettings settings, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
        if (db == null) return;
        EnsurePersistenceSchema(db);
        var scopeKey = GetCurrentScopeKey();
        var row = await db.GlobalOperationsConfigs.FirstOrDefaultAsync(x => x.ScopeKey == scopeKey, ct);
        if (row == null)
        {
            row = BuildEmptyTenantRow(scopeKey);
            db.GlobalOperationsConfigs.Add(row);
        }
        row.TeamsSettingsJson = JsonSerializer.Serialize(settings);
        row.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<DateTimeOffset?> GetTeamsLastReportSentAtAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
        if (db == null) return null;
        var scopeKey = GetCurrentScopeKey();
        var row = await db.GlobalOperationsConfigs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScopeKey == scopeKey, ct);
        return row?.TeamsLastReportSentAt;
    }

    public async Task SetTeamsLastReportSentAtAsync(DateTimeOffset sentAt, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
        if (db == null) return;
        var scopeKey = GetCurrentScopeKey();
        var row = await db.GlobalOperationsConfigs.FirstOrDefaultAsync(x => x.ScopeKey == scopeKey, ct);
        if (row == null) return;
        row.TeamsLastReportSentAt = sentAt;
        await db.SaveChangesAsync(ct);
    }

    public async Task<string> GetTeamsAlertStateJsonAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
        if (db == null) return "";
        var scopeKey = GetCurrentScopeKey();
        var row = await db.GlobalOperationsConfigs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScopeKey == scopeKey, ct);
        return row?.TeamsAlertStateJson ?? "";
    }

    public async Task SetTeamsAlertStateJsonAsync(string json, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
        if (db == null) return;
        var scopeKey = GetCurrentScopeKey();
        var row = await db.GlobalOperationsConfigs.FirstOrDefaultAsync(x => x.ScopeKey == scopeKey, ct);
        if (row == null) return;
        row.TeamsAlertStateJson = json;
        await db.SaveChangesAsync(ct);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private void EnsureLoaded()
    {
        if (_loadedFromStore) return;

        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
            if (db is null) { _loadedFromStore = true; return; }

            EnsurePersistenceSchema(db);

            var existing = db.GlobalOperationsConfigs
                .SingleOrDefault(x => x.ScopeKey == GlobalScopeKey);

            if (existing is not null)
            {
                _selectedSubscriptionId = string.IsNullOrWhiteSpace(existing.SubscriptionId) ? null : existing.SubscriptionId;
                _selectedLogAnalyticsWorkspaceIds = DeserializeWorkspaceIds(existing.LogAnalyticsWorkspaceId);
                _selectedAiTarget = string.IsNullOrWhiteSpace(existing.AiTarget) ? null : existing.AiTarget;
                _selectedAiEndpoint = string.IsNullOrWhiteSpace(existing.AiEndpoint) ? null : existing.AiEndpoint;
                _selectedAiModel = string.IsNullOrWhiteSpace(existing.AiModel) ? null : existing.AiModel;
                _selectedAiApiKey = string.IsNullOrWhiteSpace(existing.AiApiKey) ? null : existing.AiApiKey;
                _aiUsageMonthKey = string.IsNullOrWhiteSpace(existing.AiUsageMonthKey)
                    ? DateTimeOffset.UtcNow.ToString("yyyy-MM")
                    : existing.AiUsageMonthKey;
                _aiPromptTokens = existing.AiPromptTokens;
                _aiCompletionTokens = existing.AiCompletionTokens;
                _aiEstimatedCostUsd = existing.AiEstimatedCostUsd;
                _aiUsageUpdatedAtUtc = existing.AiUsageUpdatedAtUtc;
                _selectedDrSettings = DeserializeDrSettings(existing.DrSettingsJson);
                _aiBriefingPrompt = string.IsNullOrWhiteSpace(existing.AiBriefingPrompt) ? null : existing.AiBriefingPrompt;
                _aiSummaryEnabled = existing.AiSummaryEnabled;
                _updatedAtUtc = existing.UpdatedAtUtc;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falling back to in-memory operations scope; global config persistence store is unavailable.");
        }

        _loadedFromStore = true;
    }

    private void EnsureTenantLoaded(string scopeKey)
    {
        if (_tenantCache.TryGetValue(scopeKey, out var state) && state.Loaded)
            return;

        state ??= new TenantScopeState();
        _tenantCache[scopeKey] = state;

        try
        {
            using var dbScope = scopeFactory.CreateScope();
            var db = dbScope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
            if (db is null) { state.Loaded = true; return; }

            var row = db.GlobalOperationsConfigs.SingleOrDefault(x => x.ScopeKey == scopeKey);
            if (row is not null)
            {
                state.SubscriptionId = string.IsNullOrWhiteSpace(row.SubscriptionId) ? null : row.SubscriptionId;
                state.WorkspaceIds = DeserializeWorkspaceIds(row.LogAnalyticsWorkspaceId);
                state.DrSettings = DeserializeDrSettings(row.DrSettingsJson);
                state.UpdatedAt = row.UpdatedAtUtc;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to load tenant scope config for {ScopeKey}.", scopeKey);
        }

        state.Loaded = true;
    }

    private void PersistCurrent()
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
            if (db is null) return;

            EnsurePersistenceSchema(db);

            var existing = db.GlobalOperationsConfigs
                .SingleOrDefault(x => x.ScopeKey == GlobalScopeKey);

            if (existing is null)
            {
                existing = new GlobalOperationsConfigEntity
                {
                    Id = Guid.NewGuid(),
                    ScopeKey = GlobalScopeKey,
                };
                db.GlobalOperationsConfigs.Add(existing);
            }

            existing.SubscriptionId = _selectedSubscriptionId ?? string.Empty;
            existing.LogAnalyticsWorkspaceId = _selectedLogAnalyticsWorkspaceIds is { Count: > 0 }
                ? JsonSerializer.Serialize(_selectedLogAnalyticsWorkspaceIds)
                : string.Empty;
            existing.AiTarget = _selectedAiTarget ?? string.Empty;
            existing.AiEndpoint = _selectedAiEndpoint ?? string.Empty;
            existing.AiModel = _selectedAiModel ?? string.Empty;
            existing.AiApiKey = _selectedAiApiKey ?? string.Empty;
            existing.AiUsageMonthKey = _aiUsageMonthKey;
            existing.AiPromptTokens = _aiPromptTokens;
            existing.AiCompletionTokens = _aiCompletionTokens;
            existing.AiEstimatedCostUsd = _aiEstimatedCostUsd;
            existing.AiUsageUpdatedAtUtc = _aiUsageUpdatedAtUtc;
            existing.DrSettingsJson = JsonSerializer.Serialize(_selectedDrSettings ?? BuildDefaultDrSettings());
            existing.AiBriefingPrompt = _aiBriefingPrompt ?? string.Empty;
            existing.AiSummaryEnabled = _aiSummaryEnabled;
            existing.UpdatedAtUtc = _updatedAtUtc;

            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Operations scope persistence failed; continuing with in-memory values.");
        }
    }

    private void PersistGlobalAi()
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
            if (db is null) return;

            EnsurePersistenceSchema(db);

            var existing = db.GlobalOperationsConfigs
                .SingleOrDefault(x => x.ScopeKey == GlobalScopeKey);

            if (existing is null)
            {
                existing = new GlobalOperationsConfigEntity
                {
                    Id = Guid.NewGuid(),
                    ScopeKey = GlobalScopeKey,
                    SubscriptionId = _selectedSubscriptionId ?? string.Empty,
                    LogAnalyticsWorkspaceId = _selectedLogAnalyticsWorkspaceIds is { Count: > 0 }
                        ? JsonSerializer.Serialize(_selectedLogAnalyticsWorkspaceIds) : string.Empty,
                    DrSettingsJson = JsonSerializer.Serialize(_selectedDrSettings ?? BuildDefaultDrSettings()),
                };
                db.GlobalOperationsConfigs.Add(existing);
            }

            existing.AiTarget = _selectedAiTarget ?? string.Empty;
            existing.AiEndpoint = _selectedAiEndpoint ?? string.Empty;
            existing.AiModel = _selectedAiModel ?? string.Empty;
            existing.AiApiKey = _selectedAiApiKey ?? string.Empty;
            existing.AiUsageMonthKey = _aiUsageMonthKey;
            existing.AiPromptTokens = _aiPromptTokens;
            existing.AiCompletionTokens = _aiCompletionTokens;
            existing.AiEstimatedCostUsd = _aiEstimatedCostUsd;
            existing.AiUsageUpdatedAtUtc = _aiUsageUpdatedAtUtc;
            existing.AiBriefingPrompt = _aiBriefingPrompt ?? string.Empty;
            existing.AiSummaryEnabled = _aiSummaryEnabled;
            existing.UpdatedAtUtc = _updatedAtUtc;

            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Global AI config persistence failed; continuing with in-memory values.");
        }
    }

    private void PersistTenantScope(string scopeKey, string? subscriptionId, List<string>? workspaceIds, DrScopeSettings? drSettings)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetService(typeof(NightWatchDbContext)) as NightWatchDbContext;
            if (db is null) return;

            EnsurePersistenceSchema(db);

            var existing = db.GlobalOperationsConfigs.SingleOrDefault(x => x.ScopeKey == scopeKey);
            if (existing is null)
            {
                existing = BuildEmptyTenantRow(scopeKey);
                db.GlobalOperationsConfigs.Add(existing);
            }

            existing.SubscriptionId = subscriptionId ?? string.Empty;
            existing.LogAnalyticsWorkspaceId = workspaceIds is { Count: > 0 }
                ? JsonSerializer.Serialize(workspaceIds) : string.Empty;
            existing.DrSettingsJson = JsonSerializer.Serialize(drSettings ?? BuildDefaultDrSettings());
            existing.UpdatedAtUtc = DateTimeOffset.UtcNow;

            db.SaveChanges();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Tenant scope config persistence failed for {ScopeKey}.", scopeKey);
        }
    }

    private static GlobalOperationsConfigEntity BuildEmptyTenantRow(string scopeKey) =>
        new()
        {
            Id = Guid.NewGuid(),
            ScopeKey = scopeKey,
            SubscriptionId = string.Empty,
            LogAnalyticsWorkspaceId = string.Empty,
            AiTarget = string.Empty,
            AiEndpoint = string.Empty,
            AiModel = string.Empty,
            AiApiKey = string.Empty,
            AiUsageMonthKey = string.Empty,
            AiPromptTokens = 0,
            AiCompletionTokens = 0,
            AiEstimatedCostUsd = 0m,
            DrSettingsJson = string.Empty,
            AiBriefingPrompt = string.Empty,
            TeamsSettingsJson = string.Empty,
            TeamsAlertStateJson = string.Empty,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

    private OperationsScopeSettings BuildSettings()
    {
        var configuredSubscriptions = options.Value.SubscriptionIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        IReadOnlyList<string> effectiveSubscriptions;
        if (!string.IsNullOrWhiteSpace(_selectedSubscriptionId))
            effectiveSubscriptions = [_selectedSubscriptionId!];
        else
            effectiveSubscriptions = configuredSubscriptions;

        var configuredWorkspaceIds = options.Value.LogAnalyticsWorkspaceIds
            .Concat(string.IsNullOrWhiteSpace(options.Value.LogAnalyticsWorkspaceId)
                ? []
                : [options.Value.LogAnalyticsWorkspaceId])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        IReadOnlyList<string> effectiveWorkspaceIds = _selectedLogAnalyticsWorkspaceIds is { Count: > 0 }
            ? _selectedLogAnalyticsWorkspaceIds
            : configuredWorkspaceIds;

        return new OperationsScopeSettings(
            effectiveSubscriptions,
            effectiveWorkspaceIds,
            BuildAiTarget(),
            BuildAiUsage(),
            new AiUsageRateSummary(options.Value.AiInputTokenCostPer1kUsd, options.Value.AiOutputTokenCostPer1kUsd),
            _selectedDrSettings ?? BuildDefaultDrSettings(),
            _aiSummaryEnabled,
            _updatedAtUtc);
    }

    private OperationsScopeSettings BuildTenantSettings(TenantScopeState tenantState)
    {
        IReadOnlyList<string> effectiveSubscriptions = !string.IsNullOrWhiteSpace(tenantState.SubscriptionId)
            ? [tenantState.SubscriptionId!]
            : [];

        IReadOnlyList<string> effectiveWorkspaceIds = tenantState.WorkspaceIds is { Count: > 0 }
            ? tenantState.WorkspaceIds
            : [];

        return new OperationsScopeSettings(
            effectiveSubscriptions,
            effectiveWorkspaceIds,
            BuildAiTarget(),
            BuildAiUsage(),
            new AiUsageRateSummary(options.Value.AiInputTokenCostPer1kUsd, options.Value.AiOutputTokenCostPer1kUsd),
            tenantState.DrSettings ?? BuildDefaultDrSettings(),
            _aiSummaryEnabled,
            tenantState.UpdatedAt);
    }

    private AiTargetSettings BuildAiTarget() => new(
        !string.IsNullOrWhiteSpace(_selectedAiTarget) ? _selectedAiTarget! : options.Value.AiTarget,
        !string.IsNullOrWhiteSpace(_selectedAiEndpoint) ? _selectedAiEndpoint! : options.Value.AiEndpoint,
        !string.IsNullOrWhiteSpace(_selectedAiModel) ? _selectedAiModel! : options.Value.AiModel,
        !string.IsNullOrWhiteSpace(_selectedAiApiKey) ? _selectedAiApiKey! : options.Value.AiApiKey);

    private AiUsageMonthSummary BuildAiUsage()
    {
        var currentMonthKey = DateTimeOffset.UtcNow.ToString("yyyy-MM");
        return string.Equals(_aiUsageMonthKey, currentMonthKey, StringComparison.Ordinal)
            ? new AiUsageMonthSummary(_aiUsageMonthKey, _aiPromptTokens, _aiCompletionTokens, _aiEstimatedCostUsd, _aiUsageUpdatedAtUtc)
            : new AiUsageMonthSummary(currentMonthKey, 0, 0, 0m, null);
    }

    private static DrScopeSettings BuildDefaultDrSettings() =>
        new(
            GlobalDesiredRpoMinutes: 15,
            GlobalDesiredRtoMinutes: 60,
            Thresholds: new DrComplianceThresholdsSettings(100m, 80m, 60m, 20m),
            CriticalityProfiles:
            [
                new DrCriticalityProfileSettings("Mission Critical", 5, 15),
                new DrCriticalityProfileSettings("Critical", 15, 60),
                new DrCriticalityProfileSettings("High", 30, 120),
                new DrCriticalityProfileSettings("Medium", 240, 480),
                new DrCriticalityProfileSettings("Low", 1440, 1440),
            ],
            Overrides: Array.Empty<DrTargetOverrideSettings>());

    private static List<string>? DeserializeWorkspaceIds(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (raw.TrimStart().StartsWith('['))
        {
            try
            {
                var ids = JsonSerializer.Deserialize<List<string>>(raw);
                return ids is { Count: > 0 } ? ids : null;
            }
            catch { return null; }
        }
        return [raw.Trim()];
    }

    private static DrScopeSettings? DeserializeDrSettings(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<DrScopeSettings>(json); }
        catch { return null; }
    }

    private static TeamsNotificationSettings DeserializeTeamsSettings(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new TeamsNotificationSettings("", false, "09:00", "UTC", false);
        try { return JsonSerializer.Deserialize<TeamsNotificationSettings>(json) ?? new TeamsNotificationSettings("", false, "09:00", "UTC", false); }
        catch { return new TeamsNotificationSettings("", false, "09:00", "UTC", false); }
    }

    private void EnsurePersistenceSchema(NightWatchDbContext db)
    {
        const string createTableSql = """
            IF OBJECT_ID(N'dbo.GlobalOperationsConfig', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.GlobalOperationsConfig (
                    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                    ScopeKey NVARCHAR(64) NOT NULL,
                    SubscriptionId NVARCHAR(128) NOT NULL,
                    LogAnalyticsWorkspaceId NVARCHAR(256) NOT NULL,
                    AiTarget NVARCHAR(64) NOT NULL,
                    AiEndpoint NVARCHAR(512) NOT NULL,
                    AiModel NVARCHAR(128) NOT NULL,
                    AiApiKey NVARCHAR(2048) NOT NULL,
                    AiUsageMonthKey NVARCHAR(7) NOT NULL,
                    AiPromptTokens BIGINT NOT NULL,
                    AiCompletionTokens BIGINT NOT NULL,
                    AiEstimatedCostUsd DECIMAL(18,6) NOT NULL,
                    AiUsageUpdatedAtUtc DATETIMEOFFSET NULL,
                    DrSettingsJson NVARCHAR(MAX) NOT NULL,
                    UpdatedAtUtc DATETIMEOFFSET NOT NULL
                );

                CREATE UNIQUE INDEX IX_GlobalOperationsConfig_ScopeKey
                ON dbo.GlobalOperationsConfig(ScopeKey);
            END

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'AiUsageMonthKey') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD AiUsageMonthKey NVARCHAR(7) NOT NULL CONSTRAINT DF_GlobalOperationsConfig_AiUsageMonthKey DEFAULT('');

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'AiPromptTokens') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD AiPromptTokens BIGINT NOT NULL CONSTRAINT DF_GlobalOperationsConfig_AiPromptTokens DEFAULT(0);

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'AiCompletionTokens') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD AiCompletionTokens BIGINT NOT NULL CONSTRAINT DF_GlobalOperationsConfig_AiCompletionTokens DEFAULT(0);

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'AiEstimatedCostUsd') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD AiEstimatedCostUsd DECIMAL(18,6) NOT NULL CONSTRAINT DF_GlobalOperationsConfig_AiEstimatedCostUsd DEFAULT(0);

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'AiUsageUpdatedAtUtc') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD AiUsageUpdatedAtUtc DATETIMEOFFSET NULL;

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'AiBriefingPrompt') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD AiBriefingPrompt NVARCHAR(MAX) NOT NULL CONSTRAINT DF_GlobalOperationsConfig_AiBriefingPrompt DEFAULT('');

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'TeamsSettingsJson') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD TeamsSettingsJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_GlobalOperationsConfig_TeamsSettingsJson DEFAULT('');

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'TeamsLastReportSentAt') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD TeamsLastReportSentAt DATETIMEOFFSET NULL;

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'TeamsAlertStateJson') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD TeamsAlertStateJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_GlobalOperationsConfig_TeamsAlertStateJson DEFAULT('');

            IF COL_LENGTH('dbo.GlobalOperationsConfig', 'AiSummaryEnabled') IS NULL
                ALTER TABLE dbo.GlobalOperationsConfig ADD AiSummaryEnabled BIT NOT NULL CONSTRAINT DF_GlobalOperationsConfig_AiSummaryEnabled DEFAULT(0);
            """;

        try
        {
            db.Database.ExecuteSqlRaw(createTableSql);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to ensure GlobalOperationsConfig schema exists.");
        }
    }
}
