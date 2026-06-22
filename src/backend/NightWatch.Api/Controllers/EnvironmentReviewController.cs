using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Services;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/environment-review")]
[Authorize(Policy = "NightWatchOperator")]
public sealed class EnvironmentReviewController(EnvironmentReviewService reviewService) : ControllerBase
{
    // ── Reviews ─────────────────────────────────────────────────────────────────

    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetReviews(string tenantId, CancellationToken ct)
    {
        var reviews = await reviewService.GetReviewsAsync(tenantId, ct);
        return Ok(reviews);
    }

    [HttpGet("{tenantId}/{id:int}")]
    public async Task<IActionResult> GetReview(string tenantId, int id, CancellationToken ct)
    {
        var review = await reviewService.GetReviewAsync(tenantId, id, ct);
        return review is null ? NotFound() : Ok(review);
    }

    [HttpPost("{tenantId}")]
    public async Task<IActionResult> CreateReview(
        string tenantId,
        [FromBody] CreateEnvironmentReviewRequest request,
        CancellationToken ct)
    {
        var review = await reviewService.CreateReviewAsync(tenantId, request, ct);
        return CreatedAtAction(nameof(GetReview), new { tenantId, id = review.Id }, review);
    }

    [HttpPut("{tenantId}/{id:int}")]
    public async Task<IActionResult> UpdateReview(
        string tenantId, int id,
        [FromBody] UpdateEnvironmentReviewRequest request,
        CancellationToken ct)
    {
        var review = await reviewService.UpdateReviewAsync(tenantId, id, request, ct);
        return review is null ? NotFound() : Ok(review);
    }

    [HttpDelete("{tenantId}/{id:int}")]
    [Authorize(Policy = "NightWatchAdmin")]
    public async Task<IActionResult> DeleteReview(string tenantId, int id, CancellationToken ct)
    {
        var deleted = await reviewService.DeleteReviewAsync(tenantId, id, ct);
        return deleted ? NoContent() : NotFound();
    }

    // ── Findings ────────────────────────────────────────────────────────────────

    [HttpPost("{tenantId}/{reviewId:int}/findings")]
    public async Task<IActionResult> AddFinding(
        string tenantId, int reviewId,
        [FromBody] CreateReviewFindingRequest request,
        CancellationToken ct)
    {
        var finding = await reviewService.AddFindingAsync(tenantId, reviewId, request, ct);
        return finding is null ? NotFound() : Ok(finding);
    }

    [HttpPut("{tenantId}/{reviewId:int}/findings/{findingId:int}")]
    public async Task<IActionResult> UpdateFinding(
        string tenantId, int reviewId, int findingId,
        [FromBody] UpdateReviewFindingRequest request,
        CancellationToken ct)
    {
        var finding = await reviewService.UpdateFindingAsync(tenantId, reviewId, findingId, request, ct);
        return finding is null ? NotFound() : Ok(finding);
    }

    [HttpDelete("{tenantId}/{reviewId:int}/findings/{findingId:int}")]
    public async Task<IActionResult> DeleteFinding(
        string tenantId, int reviewId, int findingId,
        CancellationToken ct)
    {
        var deleted = await reviewService.DeleteFindingAsync(tenantId, reviewId, findingId, ct);
        return deleted ? NoContent() : NotFound();
    }

    // ── Finding Library ─────────────────────────────────────────────────────────

    [HttpGet("library")]
    [Authorize(Policy = "NightWatchDataRead")]
    public IActionResult GetLibrary()
    {
        return Ok(EnvironmentReviewService.GetFindingLibrary());
    }

    // ── PDF Export ──────────────────────────────────────────────────────────────

    [HttpGet("{tenantId}/{id:int}/pdf")]
    [Authorize(Policy = "NightWatchDataRead")]
    public async Task<IActionResult> GetPdf(string tenantId, int id, CancellationToken ct)
    {
        try
        {
            var pdf = await reviewService.GeneratePdfAsync(tenantId, id, ct);
            return File(pdf, "application/pdf", $"environment-review-{id}.pdf");
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
