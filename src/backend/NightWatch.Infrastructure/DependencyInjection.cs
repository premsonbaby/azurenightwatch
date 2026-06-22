using Azure.Core;
using Azure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Options;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Plugins;
using NightWatch.Infrastructure.Services;
using NightWatch.Infrastructure.Services.Azure;
using NightWatch.Infrastructure.Services.Demo;

namespace NightWatch.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AzureOperationsOptions>(configuration.GetSection(AzureOperationsOptions.SectionName));
        services.Configure<MultiTenantOptions>(configuration.GetSection(MultiTenantOptions.SectionName));

        var sqlConnection = configuration.GetConnectionString("SqlDatabase");
        if (!string.IsNullOrWhiteSpace(sqlConnection))
            services.AddDbContext<NightWatchDbContext>(options => options.UseSqlServer(sqlConnection));
        else
            services.AddDbContext<NightWatchDbContext>(options => options.UseInMemoryDatabase("nightwatch-dev"));

        var demoMode = configuration.GetValue<bool>("NightWatch:DemoMode");

        if (demoMode)
        {
            // Demo mode: no Azure credentials needed — all data is synthetic.
            services.AddSingleton<ISubscriptionDiscoveryService, DemoSubscriptionDiscoveryService>();
            services.AddSingleton<IAzureResourceGraphClient, DemoAzureResourceGraphClient>();
            services.AddSingleton<IDefenderClient, DemoDefenderClient>();
            services.AddSingleton<IAdvisorClient, DemoAdvisorClient>();
            services.AddSingleton<ICostManagementClient, DemoCostManagementClient>();
            services.AddSingleton<IMonitorClient, DemoMonitorClient>();
            services.AddSingleton<IAzurePolicyInsightsClient, DemoAzurePolicyInsightsClient>();
        }
        else
        {
            // TenantCredentialContext is a singleton that wraps an AsyncLocal — all Azure clients
            // receive it as TokenCredential. Middleware (or the background service) sets the
            // per-flow credential before each tenant's work and clears it afterwards.
            services.AddSingleton<DefaultAzureCredential>();
            services.AddSingleton<TenantCredentialContext>();
            services.AddSingleton<TokenCredential>(sp => sp.GetRequiredService<TenantCredentialContext>());

            services.AddHttpClient("SubscriptionDiscovery", (sp, client) =>
            {
                var opts = sp.GetRequiredService<IOptions<AzureOperationsOptions>>().Value;
                client.BaseAddress = new Uri(opts.ManagementEndpoint);
                client.Timeout = TimeSpan.FromSeconds(30);
            });

            services.AddSingleton<ISubscriptionDiscoveryService, SubscriptionDiscoveryService>();

            services.AddHttpClient<IAzureResourceGraphClient, AzureResourceGraphClient>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<AzureOperationsOptions>>().Value;
                client.BaseAddress = new Uri(options.ManagementEndpoint);
                client.Timeout = TimeSpan.FromSeconds(30);
            });

            services.AddHttpClient<IDefenderClient, DefenderClient>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<AzureOperationsOptions>>().Value;
                client.BaseAddress = new Uri(options.ManagementEndpoint);
                client.Timeout = TimeSpan.FromSeconds(30);
            });

            services.AddHttpClient<IAdvisorClient, AdvisorClient>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<AzureOperationsOptions>>().Value;
                client.BaseAddress = new Uri(options.ManagementEndpoint);
                client.Timeout = TimeSpan.FromSeconds(30);
            });

            services.AddHttpClient<ICostManagementClient, CostManagementClient>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<AzureOperationsOptions>>().Value;
                client.BaseAddress = new Uri(options.ManagementEndpoint);
                client.Timeout = TimeSpan.FromSeconds(30);
            });

            services.AddHttpClient<IMonitorClient, MonitorClient>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<AzureOperationsOptions>>().Value;
                client.BaseAddress = new Uri(options.MonitorEndpoint);
                client.Timeout = TimeSpan.FromSeconds(30);
            });

            services.AddHttpClient<IAzurePolicyInsightsClient, AzurePolicyInsightsClient>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<AzureOperationsOptions>>().Value;
                client.BaseAddress = new Uri(options.ManagementEndpoint);
                client.Timeout = TimeSpan.FromSeconds(45);
            });
        }

        // Services needed in both real and demo modes
        services.AddSingleton<IOperationsScopeService, OperationsScopeService>();
        services.AddSingleton<ICacheBustService, CacheBustService>();
        services.AddScoped<IChangeHistoryService, ChangeHistoryService>();

        services.AddHttpClient<IAiSummaryService, AiSummaryService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(90);
        });

        services.Configure<EmailSmtpOptions>(configuration.GetSection("EmailSmtp"));
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IReportScheduleService, ReportScheduleService>();

        services.AddScoped<INightWatchInsightsService, NightWatchInsightsService>();
        services.AddScoped<IInsightAggregatorService, InsightAggregatorService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<ITenantRegistryService, TenantRegistryService>();
        services.AddScoped<IAlertThresholdService, AlertThresholdService>();
        services.AddScoped<IHealthSnapshotService, HealthSnapshotService>();
        services.AddScoped<IMonthlyReviewService, MonthlyReviewService>();
        services.AddScoped<EnvironmentReviewService>();

        services.AddScoped<IInsightPlugin, TechnicalDebtPlugin>();

        services.AddHttpClient<TeamsNotificationService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        services.AddHostedService<DashboardRefreshService>();
        services.AddHostedService<TeamsReportBackgroundService>();
        services.AddHostedService<TeamsAlertBackgroundService>();
        services.AddHostedService<MonthlySnapshotBackgroundService>();
        services.AddHostedService<ScheduledEmailReportBackgroundService>();
        return services;
    }
}
