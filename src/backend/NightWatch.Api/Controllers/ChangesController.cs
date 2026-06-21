using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/changes")]
[Authorize(Policy = "TenantReader")]
public sealed class ChangesController(IChangeHistoryService changeHistory) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetChanges(
        string tenantId,
        [FromQuery] string timeRange = "today",
        CancellationToken cancellationToken = default)
    {
        var result = await changeHistory.GetChangesAsync(tenantId, timeRange, cancellationToken);
        return Ok(result);
    }
}
