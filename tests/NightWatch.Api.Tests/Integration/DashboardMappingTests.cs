using NightWatch.Application.Contracts;
using System.Net;
using System.Net.Http.Json;

namespace NightWatch.Api.Tests.Integration;

public sealed class DashboardMappingTests : IClassFixture<NightWatchApiFactory>
{
    private readonly NightWatchApiFactory _factory;

    public DashboardMappingTests(NightWatchApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CostDashboard_MapsRecommendationsAndTrend()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-test-roles", "NightWatch.Reader");
        client.DefaultRequestHeaders.Add("x-test-tenants", "tenant-a");

        var response = await client.GetAsync("/api/dashboard/cost/tenant-a");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CostDashboardDto>();
        Assert.NotNull(payload);
        Assert.NotEmpty(payload.CostTrend);
        Assert.NotNull(payload.Recommendations);
    }

    [Fact]
    public async Task SecurityDashboard_MapsFindingsAndBlastRadius()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-test-roles", "NightWatch.Reader");
        client.DefaultRequestHeaders.Add("x-test-tenants", "tenant-a");

        var response = await client.GetAsync("/api/dashboard/security/tenant-a");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<SecurityDashboardDto>();
        Assert.NotNull(payload);
        Assert.NotEmpty(payload.Findings);
        Assert.NotEmpty(payload.BlastRadiusNodes);
        Assert.NotEmpty(payload.BlastRadiusEdges);
    }
}
