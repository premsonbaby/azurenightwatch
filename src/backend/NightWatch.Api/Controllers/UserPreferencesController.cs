using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using NightWatch.Infrastructure.Persistence;
using System.Security.Claims;

namespace NightWatch.Api.Controllers;

public sealed record SaveUserPreferencesRequest(string? ActiveTenantId);

[ApiController]
[Route("api/user")]
[Authorize]
public sealed class UserPreferencesController(NightWatchDbContext dbContext) : ControllerBase
{
    private const string EnsureTableSql = """
        IF OBJECT_ID(N'dbo.UserPreferences', N'U') IS NULL
        CREATE TABLE dbo.UserPreferences (
            UserObjectId NVARCHAR(128) NOT NULL PRIMARY KEY,
            ActiveTenantId NVARCHAR(128) NOT NULL DEFAULT('global'),
            UpdatedAtUtc DATETIMEOFFSET NOT NULL DEFAULT(SYSDATETIMEOFFSET())
        );
        """;

    [HttpGet("preferences")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var oid = GetUserObjectId();
        var conn = dbContext.Database.GetDbConnection();
        await conn.OpenAsync(ct);
        try
        {
            await using var ensureCmd = conn.CreateCommand();
            ensureCmd.CommandText = EnsureTableSql;
            await ensureCmd.ExecuteNonQueryAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT ActiveTenantId FROM dbo.UserPreferences WHERE UserObjectId = @oid";
            cmd.Parameters.Add(new SqlParameter("@oid", oid));
            var result = await cmd.ExecuteScalarAsync(ct);
            return Ok(new { activeTenantId = result as string ?? "global" });
        }
        finally
        {
            await conn.CloseAsync();
        }
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> Save([FromBody] SaveUserPreferencesRequest request, CancellationToken ct)
    {
        var oid = GetUserObjectId();
        var tenantId = string.IsNullOrWhiteSpace(request.ActiveTenantId) ? "global" : request.ActiveTenantId.Trim();
        var conn = dbContext.Database.GetDbConnection();
        await conn.OpenAsync(ct);
        try
        {
            await using var ensureCmd = conn.CreateCommand();
            ensureCmd.CommandText = EnsureTableSql;
            await ensureCmd.ExecuteNonQueryAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                MERGE dbo.UserPreferences AS t
                USING (SELECT @oid AS UserObjectId, @tid AS ActiveTenantId) AS s
                ON t.UserObjectId = s.UserObjectId
                WHEN MATCHED THEN UPDATE SET ActiveTenantId = s.ActiveTenantId, UpdatedAtUtc = SYSDATETIMEOFFSET()
                WHEN NOT MATCHED THEN INSERT (UserObjectId, ActiveTenantId, UpdatedAtUtc)
                    VALUES (s.UserObjectId, s.ActiveTenantId, SYSDATETIMEOFFSET());
                """;
            cmd.Parameters.Add(new SqlParameter("@oid", oid));
            cmd.Parameters.Add(new SqlParameter("@tid", tenantId));
            await cmd.ExecuteNonQueryAsync(ct);
            return Ok(new { activeTenantId = tenantId });
        }
        finally
        {
            await conn.CloseAsync();
        }
    }

    private string GetUserObjectId() =>
        User.FindFirstValue("oid") ??
        User.FindFirstValue("http://schemas.microsoft.com/identity/claims/objectidentifier") ??
        User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        "dev-user";
}
