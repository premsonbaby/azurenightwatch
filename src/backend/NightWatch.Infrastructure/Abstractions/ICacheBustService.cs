namespace NightWatch.Infrastructure.Abstractions;

public interface ICacheBustService
{
    long Generation { get; }
    void Bust();
}
