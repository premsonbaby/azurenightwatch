namespace NightWatch.Infrastructure.Options;

public sealed class MultiTenantOptions
{
    public const string SectionName = "MultiTenant";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string HomeTenantId { get; set; } = "";
}
