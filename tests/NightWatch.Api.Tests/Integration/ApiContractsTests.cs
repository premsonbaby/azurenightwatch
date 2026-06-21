using NightWatch.Application.Contracts;
using System.Net;
using System.Net.Http.Json;

namespace NightWatch.Api.Tests.Integration;

public sealed class ApiContractsTests : IClassFixture<NightWatchApiFactory>
{
    private readonly NightWatchApiFactory _factory;

    public ApiContractsTests(NightWatchApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ExecutiveDashboard_ReturnsExpectedContract()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-test-roles", "NightWatch.Reader");
        client.DefaultRequestHeaders.Add("x-test-tenants", "tenant-a");

        var response = await client.GetAsync("/api/dashboard/executive/tenant-a");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ExecutiveDashboardDto>();
        Assert.NotNull(payload);
        Assert.Equal("tenant-a", payload.TenantId);
        Assert.NotEmpty(payload.DailyTrend);
        Assert.True(payload.AzureHealthScore > 0);
    }

    [Fact]
    public async Task ExecutiveDashboard_Forbid_WhenTenantClaimMissing()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-test-roles", "NightWatch.Reader");
        client.DefaultRequestHeaders.Add("x-test-tenants", "tenant-b");

        var response = await client.GetAsync("/api/dashboard/executive/tenant-a");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
