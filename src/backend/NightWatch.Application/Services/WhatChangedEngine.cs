using NightWatch.Application.Abstractions;

namespace NightWatch.Application.Services;

public sealed class WhatChangedEngine : IWhatChangedEngine
{
    public IReadOnlyCollection<string> BuildIncidentNarrative(string tenantId)
    {
        return Array.Empty<string>();
    }
}
