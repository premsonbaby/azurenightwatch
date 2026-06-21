using NightWatch.Application.Contracts;

namespace NightWatch.Application.Abstractions;

public interface IMonthlyReviewService
{
    Task<MonthlyReviewDto> GetReviewAsync(string tenantId, string? month, CancellationToken ct);
    Task<IReadOnlyList<ActionItemDto>> GetActionItemsAsync(string tenantId, string? month, CancellationToken ct);
    Task<ActionItemDto> CreateActionItemAsync(string tenantId, string month, CreateActionItemRequest request, CancellationToken ct);
    Task<ActionItemDto> UpdateActionItemAsync(string tenantId, int id, UpdateActionItemRequest request, string updatedByEmail, CancellationToken ct);
    Task DeleteActionItemAsync(string tenantId, int id, CancellationToken ct);
    Task<byte[]> GenerateReviewPdfAsync(string tenantId, string? month, string? mspName, CancellationToken ct);
}
