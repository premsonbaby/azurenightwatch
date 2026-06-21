using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/support-tickets")]
[Authorize(Policy = "TenantReader")]
public sealed class SupportTicketController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetSupportTickets(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetSupportTicketDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
