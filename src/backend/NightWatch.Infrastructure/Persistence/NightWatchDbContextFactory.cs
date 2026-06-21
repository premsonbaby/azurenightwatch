using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace NightWatch.Infrastructure.Persistence;

public sealed class NightWatchDbContextFactory : IDesignTimeDbContextFactory<NightWatchDbContext>
{
    public NightWatchDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<NightWatchDbContext>()
            .UseSqlServer("Server=localhost;Database=NightWatch;Trusted_Connection=True;")
            .Options;

        return new NightWatchDbContext(options);
    }
}
