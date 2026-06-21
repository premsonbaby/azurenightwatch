using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Contracts;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "PlatformReader")]
public class IntelligenceController : ControllerBase
{
    private readonly IInsightAggregatorService _insightAggregator;

    public IntelligenceController(IInsightAggregatorService insightAggregator)
    {
        _insightAggregator = insightAggregator;
    }

    [HttpGet("feed")]
    public async Task<ActionResult<IEnumerable<InsightDto>>> GetFeed()
    {
        var insights = await _insightAggregator.GetCriticalInsightsAsync();
        return Ok(insights);
    }
}
