using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Infrastructure.Services;

public sealed class CacheBustService : ICacheBustService
{
    private long _generation;

    public long Generation => Interlocked.Read(ref _generation);

    public void Bust() => Interlocked.Increment(ref _generation);
}
