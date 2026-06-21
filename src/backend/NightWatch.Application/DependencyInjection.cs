using Microsoft.Extensions.DependencyInjection;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Services;

namespace NightWatch.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IRecommendationEngine, RecommendationEngine>();
        services.AddScoped<IRiskScoringService, RiskScoringService>();
        services.AddScoped<IWhatChangedEngine, WhatChangedEngine>();
        return services;
    }
}
