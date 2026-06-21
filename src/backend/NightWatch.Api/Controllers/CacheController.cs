using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "PlatformReader")]
public class CacheController : ControllerBase
{
    private readonly ICacheBustService _cacheBust;

    public CacheController(ICacheBustService cacheBust)
    {
        _cacheBust = cacheBust;
    }

    [HttpPost("clear")]
    [Authorize(Policy = "NightWatchOperator")]
    public IActionResult Clear()
    {
        _cacheBust.Bust();
        return NoContent();
    }
}
