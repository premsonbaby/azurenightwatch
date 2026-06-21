using Microsoft.EntityFrameworkCore;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;

namespace NightWatch.Infrastructure.Services;

public sealed class TenantRegistryService(NightWatchDbContext db) : ITenantRegistryService
{
    public async Task<IReadOnlyList<CustomerTenantDto>> GetAllTenantsAsync(CancellationToken ct = default)
    {
        var entities = await db.CustomerTenants.OrderBy(x => x.DisplayName).ToListAsync(ct);
        return entities.Select(ToDto).ToList();
    }

    public async Task<CustomerTenantDto?> GetTenantAsync(string tenantId, CancellationToken ct = default)
    {
        var entity = await db.CustomerTenants.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<IReadOnlyList<CustomerTenantDto>> GetActiveTenantsAsync(CancellationToken ct = default)
    {
        var entities = await db.CustomerTenants.Where(x => x.IsActive).OrderBy(x => x.DisplayName).ToListAsync(ct);
        return entities.Select(ToDto).ToList();
    }

    public async Task<CustomerTenantDto> AddTenantAsync(AddTenantRequest request, CancellationToken ct = default)
    {
        var entity = new CustomerTenantEntity
        {
            TenantId = request.TenantId,
            DisplayName = request.DisplayName,
            IsActive = true,
            AddedAt = DateTimeOffset.UtcNow,
        };
        db.CustomerTenants.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task DeleteTenantAsync(string tenantId, CancellationToken ct = default)
    {
        var entity = await db.CustomerTenants.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException($"Tenant {tenantId} not found.");
        db.CustomerTenants.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    public async Task<CustomerTenantDto> UpdateTenantSettingsAsync(string tenantId, UpdateTenantSettingsRequest request, CancellationToken ct = default)
    {
        var entity = await db.CustomerTenants.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException($"Tenant {tenantId} not found.");

        entity.LogAnalyticsWorkspaceId = request.LogAnalyticsWorkspaceId ?? entity.LogAnalyticsWorkspaceId;
        entity.MonthlyBudgetLimit = request.MonthlyBudgetLimit ?? entity.MonthlyBudgetLimit;
        if (request.TeamsWebhookUrl is not null)
            entity.TeamsWebhookUrl = string.IsNullOrWhiteSpace(request.TeamsWebhookUrl) ? null : request.TeamsWebhookUrl;
        if (request.VisibleDashboards is not null)
            entity.VisibleDashboardsJson = request.VisibleDashboards.Count == 0
                ? null
                : System.Text.Json.JsonSerializer.Serialize(request.VisibleDashboards);
        if (request.AlertContacts is not null)
            entity.AlertContactsJson = request.AlertContacts.Count == 0
                ? null
                : System.Text.Json.JsonSerializer.Serialize(request.AlertContacts);

        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<CustomerTenantDto> MarkVerifiedAsync(string tenantId, CancellationToken ct = default)
    {
        var entity = await db.CustomerTenants.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException($"Tenant {tenantId} not found.");
        entity.LastVerifiedAt = DateTimeOffset.UtcNow;
        entity.IsActive = true;
        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<string?> GetTeamsWebhookUrlAsync(string tenantId, CancellationToken ct = default)
    {
        return await db.CustomerTenants
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.TeamsWebhookUrl)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<string>> GetAlertContactsAsync(string tenantId, CancellationToken ct = default)
    {
        var json = await db.CustomerTenants
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.AlertContactsJson)
            .FirstOrDefaultAsync(ct);
        return DeserializeStringList(json) ?? [];
    }

    private static readonly string[] DefaultVisibleDashboards =
        ["security", "cost", "advisor-score", "service-health", "azure-changes", "governance"];

    private static IReadOnlyList<string>? DeserializeVisibleDashboards(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json); }
        catch { return null; }
    }

    private static IReadOnlyList<string>? DeserializeStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json); }
        catch { return null; }
    }

    private static CustomerTenantDto ToDto(CustomerTenantEntity e) => new(
        e.Id,
        e.TenantId,
        e.DisplayName,
        e.IsActive,
        e.AddedAt,
        e.LastVerifiedAt,
        e.LogAnalyticsWorkspaceId,
        e.MonthlyBudgetLimit,
        e.TeamsWebhookUrl is not null,
        DeserializeVisibleDashboards(e.VisibleDashboardsJson) ?? DefaultVisibleDashboards,
        DeserializeStringList(e.AlertContactsJson) ?? []
    );
}
