using Azure.Core;
using Azure.Identity;

namespace NightWatch.Infrastructure.Services.Azure;

/// <summary>
/// Singleton TokenCredential registered in DI instead of DefaultAzureCredential.
/// Delegates to a per-async-flow credential set by TenantCredentialMiddleware or the background service.
/// Falls back to DefaultAzureCredential for home-tenant work.
/// </summary>
public sealed class TenantCredentialContext(DefaultAzureCredential home) : TokenCredential
{
    private static readonly AsyncLocal<TokenCredential?> _current = new();
    private static readonly AsyncLocal<string?> _currentTenantId = new();

    public static void Set(TokenCredential credential, string tenantId)
    {
        _current.Value = credential;
        _currentTenantId.Value = tenantId;
    }

    public static void Clear()
    {
        _current.Value = null;
        _currentTenantId.Value = null;
    }

    public static string? GetCurrentTenantId() => _currentTenantId.Value;

    public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken)
        => (_current.Value ?? home).GetToken(requestContext, cancellationToken);

    public override ValueTask<AccessToken> GetTokenAsync(TokenRequestContext requestContext, CancellationToken cancellationToken)
        => (_current.Value ?? home).GetTokenAsync(requestContext, cancellationToken);
}
