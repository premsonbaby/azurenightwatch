using AspNetCoreRateLimit;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Identity.Web;
using Microsoft.EntityFrameworkCore;
using NightWatch.Api.Auth;
using NightWatch.Api.Middleware;
using NightWatch.Application;
using NightWatch.Infrastructure;
using NightWatch.Infrastructure.Options;
using NightWatch.Infrastructure.Persistence;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);
const string CorsPolicyName = "NightWatchCors";

builder.Services.AddProblemDetails();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("RateLimit"));
builder.Services.Configure<IpRateLimitPolicies>(builder.Configuration.GetSection("RateLimitPolicies"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

var configuredCorsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
string[] defaultCorsOrigins = builder.Environment.IsDevelopment()
    ? ["http://localhost:5173", "http://localhost:5200"]
    : ["https://eun-p-nightwatch-web.azurewebsites.net"];
var allowedCorsOrigins = configuredCorsOrigins.Length > 0 ? configuredCorsOrigins : defaultCorsOrigins;

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
    {
        policy.WithOrigins(allowedCorsOrigins)
            .AllowAnyHeader()
            .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .WithExposedHeaders("Content-Disposition");
    });
});

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddAuthentication(DevBypassAuthHandler.SchemeName)
        .AddScheme<AuthenticationSchemeOptions, DevBypassAuthHandler>(DevBypassAuthHandler.SchemeName, _ => { });
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

}

builder.Services.AddSingleton<IAuthorizationHandler, TenantAccessHandler>();
builder.Services.AddScoped<IAuthorizationHandler, NightWatchDataReadHandler>();

// Role helpers — check both "roles" and ClaimTypes.Role since Microsoft.Identity.Web
// may map the JWT claim to either type depending on the token handler version.
static bool HasOperatorRole(System.Security.Claims.ClaimsPrincipal user) =>
    user.Claims.Any(c =>
        (c.Type == "roles" || c.Type == System.Security.Claims.ClaimTypes.Role) &&
        c.Value is "NightWatch.Admin" or "NightWatch.Operator");

static bool HasAdminRole(System.Security.Claims.ClaimsPrincipal user) =>
    user.Claims.Any(c =>
        (c.Type == "roles" || c.Type == System.Security.Claims.ClaimTypes.Role) &&
        c.Value == "NightWatch.Admin");

builder.Services.AddAuthorization(options =>
{
    // MSP users with any NightWatch role, OR registered customer portal users.
    // Used for all dashboard data read endpoints.
    options.AddPolicy("PlatformReader", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.Requirements.Add(new NightWatchDataReadRequirement());
    });
    // Operator+ access only (MSP operators). Used for settings write endpoints.
    options.AddPolicy("PlatformOperator", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(ctx => HasOperatorRole(ctx.User));
    });
    // Data read + tenant isolation. Used for all dashboard data endpoints.
    options.AddPolicy("TenantReader", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.Requirements.Add(new NightWatchDataReadRequirement());
        policy.Requirements.Add(new TenantAccessRequirement());
    });
    options.AddPolicy("NightWatchOperator", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(ctx => HasOperatorRole(ctx.User));
    });
    options.AddPolicy("NightWatchAdmin", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(ctx => HasAdminRole(ctx.User));
    });
});
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Validate required configuration before the app starts so developers get a clear error
// instead of mysterious 500s when config is missing.
ValidateStartupConfig(builder.Configuration, builder.Environment);

var app = builder.Build();

app.UseExceptionHandler(exceptionHandlerApp =>
{
    exceptionHandlerApp.Run(async context =>
    {
        var exFeature = context.Features.Get<IExceptionHandlerFeature>();
        var ex = exFeature?.Error;

        context.Response.StatusCode = ex switch
        {
            OperationCanceledException => 499,
            UnauthorizedAccessException => StatusCodes.Status403Forbidden,
            KeyNotFoundException => StatusCodes.Status404NotFound,
            ArgumentException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };

        var problemDetailsService = context.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails =
            {
                Detail = app.Environment.IsDevelopment() ? ex?.Message : "An unexpected error occurred. Please try again later."
            }
        });
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseResponseCompression();
app.UseCors(CorsPolicyName);
app.UseMiddleware<TenantCredentialMiddleware>();
app.UseMiddleware<NightWatch.Api.Middleware.AuditMiddleware>();
app.UseIpRateLimiting();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "Azure Night Watch API" }));
app.MapControllers();

// Apply any pending EF Core migrations at startup (idempotent — safe to run every deployment)
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<NightWatchDbContext>();
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
        startupLogger.LogWarning(ex, "Database migration failed — DB may be unavailable at startup.");
    }
}

app.Run();

public partial class Program
{
    static void ValidateStartupConfig(IConfiguration config, IHostEnvironment env)
    {
        var demoMode = config.GetValue<bool>("NightWatch:DemoMode");
        if (demoMode || env.IsDevelopment()) return;

        var errors = new List<string>();

        var tenantId = config["AzureAd:TenantId"];
        var clientId = config["AzureAd:ClientId"];
        if (string.IsNullOrWhiteSpace(tenantId))
            errors.Add("AzureAd:TenantId — set to your Entra ID tenant GUID (or 'organizations' for multi-tenant)");
        if (string.IsNullOrWhiteSpace(clientId) || clientId == "00000000-0000-0000-0000-000000000000")
            errors.Add("AzureAd:ClientId — set to your app registration client ID");

        var homeTenantId = config["MultiTenant:HomeTenantId"];
        if (string.IsNullOrWhiteSpace(homeTenantId))
            errors.Add("MultiTenant:HomeTenantId — must match AzureAd:TenantId; used for MSP-only access check");

        if (errors.Count == 0) return;

        var lines = string.Join(Environment.NewLine, errors.Select(e => $"  • {e}"));
        throw new InvalidOperationException(
            $"NightWatch is missing required configuration. Copy appsettings.Example.json and fill in:{Environment.NewLine}{lines}{Environment.NewLine}" +
            "Or set NightWatch:DemoMode=true in appsettings.Development.json to run with synthetic data.");
    }
}
