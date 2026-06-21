using System.Collections.Generic;
using System.Threading.Tasks;

namespace NightWatch.Application.Contracts
{
    public interface IInsightAggregatorService
    {
        Task<IEnumerable<InsightDto>> GetCriticalInsightsAsync();
    }
}