using NightWatch.Application.Contracts;

namespace NightWatch.Application.Abstractions;

public interface ITenantRegistryService
{
    Task<IReadOnlyList<CustomerTenantDto>> GetAllTenantsAsync(CancellationToken ct = default);
    Task<CustomerTenantDto?> GetTenantAsync(string tenantId, CancellationToken ct = default);
    Task<CustomerTenantDto> AddTenantAsync(AddTenantRequest request, CancellationToken ct = default);
    Task DeleteTenantAsync(string tenantId, CancellationToken ct = default);
    Task<CustomerTenantDto> UpdateTenantSettingsAsync(string tenantId, UpdateTenantSettingsRequest request, CancellationToken ct = default);
    Task<CustomerTenantDto> MarkVerifiedAsync(string tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<CustomerTenantDto>> GetActiveTenantsAsync(CancellationToken ct = default);
    Task<string?> GetTeamsWebhookUrlAsync(string tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetAlertContactsAsync(string tenantId, CancellationToken ct = default);
}
