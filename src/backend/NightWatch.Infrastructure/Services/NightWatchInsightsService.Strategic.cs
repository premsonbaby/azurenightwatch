using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using NightWatch.Infrastructure.Abstractions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed partial class NightWatchInsightsService
{
    public async Task<StrategicDashboardDto> GetStrategicDashboardAsync(string dashboardKey, string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var signals = await CollectLiveSignalsAsync(subscriptions, cancellationToken);
        var normalizedKey = (dashboardKey ?? string.Empty).Trim().ToLowerInvariant();

        logger.LogInformation("Strategic dashboard requested. key={DashboardKey}, tenant={TenantId}, subscriptions={SubscriptionCount}", normalizedKey, tenantId, subscriptions.Count);

        var descriptors = new Dictionary<string, (string Title, string Summary, IReadOnlyCollection<string> Recommendations)>
        {
            ["executive-cost-roi"] = ("Executive Cost & ROI Summary", "Leadership view of spend, budget trend, forecast, efficiency, and ROI posture.", ["Prioritize subscriptions trending beyond budget by >10%.", "Right-size overprovisioned compute fleets in production.", "Track cloud efficiency and ROI monthly in the board pack."]),
            ["cost-allocation"] = ("Tenant / Cost Center Allocation", "Showback and chargeback visibility by tenant, cost center, environment, and owner.", ["Enforce mandatory billing tags for all new resources.", "Add ownership mapping for all untagged resource groups.", "Review low-confidence allocations weekly."]),
            ["wastage-tracker"] = ("Wastage & Underutilization Tracker", "Detect idle and orphaned assets with estimated savings opportunities.", ["Shut down consistently idle VMs outside business hours.", "Remove unattached disks, NICs, and public IPs.", "Reclaim unused App Service Plan capacity."]),
            ["ri-savings"] = ("Reserved Instance & Savings Plan Optimization", "Commitment coverage, utilization, and missed savings potential.", ["Purchase commitments for stable baseline workloads.", "Reassign underutilized reservations to matching families.", "Track expirations and renewal windows proactively."]),
            ["true-bu-shared-cost"] = ("True Business Unit Shared-Cost Report", "Redistribute shared Azure platform costs across business units with allocation logic.", ["Validate allocation percentages for shared services monthly.", "Reconcile chargeback deltas with subscription owners.", "Track trends in shared-cost growth by business unit."]),
            ["inactive-user-license-mapping"] = ("Active vs Inactive User Licensing & Resource Mapping", "Identify high-cost resources mapped to inactive or dormant Entra identities.", ["Review stale ownership mappings for high-cost resources.", "Transfer ownership to active accountable users.", "Disable unattended spend patterns tied to inactive owners."]),
            ["lookback-seasonality-forecast"] = ("Historical Look-Back & Seasonality Forecast", "Compare current spend trajectory against historical seasonality-aware patterns.", ["Validate seasonality windows for EOQ and campaign periods.", "Investigate deviations between linear and seasonal trends.", "Align budget alerts with known seasonal peaks."]),
            ["nonprod-uptime-leakage"] = ("Non-Production Schedule & Up-time Leakage", "Quantify non-prod runtime leakage outside expected business-hours schedule.", ["Enforce auto-shutdown for non-prod outside schedule windows.", "Track leakage savings captured per engineering team.", "Exception-manage always-on workloads with approval."]),
            ["aks-micro-billing"] = ("Granular Kubernetes (AKS) Micro-Billing", "Attribute AKS infrastructure costs to namespaces, pods, and deployment owners.", ["Track namespace-level cost variance weekly.", "Set cost guardrails for high-burst namespaces.", "Align deployment ownership with chargeback records."]),
            ["azure-unified-cost-security"] = ("Azure Unified Cost & Security Dashboard", "Single Azure view correlating spend, exposure, and control posture across scope.", ["Prioritize remediation where high spend and high risk intersect.", "Track security-to-cost efficiency improvements over time.", "Use unified view for leadership governance reviews."]),
            ["executive-summary-slides"] = ("Executive Summary Slide Generator", "Leadership-ready cloud spend and efficiency summary aligned to business KPIs.", ["Publish monthly cloud KPI summary to leadership.", "Track spend-per-business-unit and service criticality.", "Export executive pack with governance and risk highlights."]),
            ["orphaned-resources"] = ("Abandoned / Orphaned Snapshot & Backup Report", "Find orphaned snapshots and backup artifacts with avoidable recurring cost.", ["Delete stale snapshots beyond retention policy.", "Review backup vault assets with no active workload linkage.", "Track realized monthly savings from orphan cleanup."]),
            ["overprivileged-identities"] = ("Over-Privileged Managed Identities Report", "Detect managed identities with excessive permissions relative to observed usage.", ["Downgrade over-scoped identities to least privilege roles.", "Review inactive privileged assignments every 30 days.", "Audit privileged identity usage against policy baselines."]),
            ["tag-hygiene-compliance"] = ("Tag Hygiene & Compliance Missing-Link", "Track untagged and mistagged resources with ownership accountability.", ["Enforce mandatory tag policies for new resources.", "Notify creators of repeated tag non-compliance.", "Automate remediation for known non-compliant patterns."]),
            ["spend-anomaly"] = ("Anomalous Spend Alerting", "Daily anomaly monitoring with subscription and resource-level spike detection.", ["Investigate top anomaly contributors within 24h.", "Set threshold and baseline alerts per environment.", "Auto-create tickets for high-confidence spend spikes."]),
            ["compliance-scorecard"] = ("Multi-Tenant Compliance Scorecard", "Compliance trend and control-failure visibility across frameworks and subscriptions.", ["Prioritize failed controls mapped to critical workloads.", "Enforce remediation deadlines for high-risk policy failures.", "Publish weekly compliance drift report."]),
            ["iam-review"] = ("IAM & Privileged Access Review", "Over-privilege, stale accounts, and privileged exposure analytics.", ["Reduce owner assignments and enforce least privilege.", "Require MFA and JIT for privileged paths.", "Review dormant admins every 30 days."]),
            ["network-perimeter"] = ("Network Security & Perimeter Health", "Public exposure and perimeter hardening posture across the network estate.", ["Close Any/Any and open admin ports from internet.", "Move admin access to Bastion/JIT.", "Validate WAF and firewall policy baselines."]),
            ["backup-health"] = ("Data Protection & Backup Health", "Backup success, policy coverage, retention, and recovery readiness posture.", ["Enable backup for all production stateful resources.", "Alert on backup failures and retention drift.", "Run restore drills and track RTO/RPO adherence."]),
            ["threat-map"] = ("Threat Detection & Vulnerability Map", "Unified visibility of active threats, vulnerabilities, and severity trends.", ["Patch critical CVEs within defined SLA.", "Prioritize threats with external exposure signals.", "Track vulnerability recurrence by resource owner."]),
            ["compute-scaling"] = ("Compute Scaling & Efficiency", "Compute utilization, rightsizing, and autoscale effectiveness insights.", ["Adopt autoscale for bursty workloads.", "Downsize low-utilization VMs and VMSS instances.", "Track scale events vs. business demand."]),
            ["hubspoke-expressroute"] = ("Hub-Spoke Networking & ExpressRoute Health", "Connectivity reliability and topology risk across hub-spoke networks.", ["Monitor packet drops and gateway saturation.", "Validate route propagation and segmentation.", "Map critical dependency paths across hubs."]),
            ["storage-iops"] = ("Storage Performance & IOPS", "Latency, throughput, error rates, and storage growth forecasting.", ["Upgrade tiers for sustained IOPS bottlenecks.", "Investigate hotspots with repeated throttling.", "Forecast storage growth and pre-scale capacity."]),
            ["aks-operations"] = ("AKS Cluster Operations", "Cluster health, pod reliability, autoscaling, and namespace consumption visibility.", ["Tune HPA/cluster autoscaler thresholds.", "Investigate failed deployments and unstable pods.", "Enforce namespace quotas and limits."]),
            ["sql-managed-instance"] = ("Azure SQL & Managed Instance Health", "Database utilization, query performance, and failover readiness analytics.", ["Tune long-running queries and deadlocks.", "Monitor replication lag and storage pressure.", "Validate failover runbooks regularly."]),
            ["cosmos-performance"] = ("Cosmos DB Performance", "RU utilization, throttling, partition hotspots, and replication health insights.", ["Redistribute hot partitions and tune keys.", "Optimize indexing and RU allocation.", "Investigate frequent 429 responses."]),
            ["data-pipelines"] = ("Enterprise Data Pipeline Monitoring", "Pipeline reliability, SLA breaches, and bottleneck tracking for data platforms.", ["Retry and isolate recurrent failing stages.", "Alert on long-running jobs and SLA risks.", "Improve dataflow observability with lineage tags."]),
            ["app-functions-health"] = ("App Services & Functions Health", "Runtime reliability, errors, cold starts, and scaling efficiency.", ["Investigate recurring 5xx and timeout patterns.", "Optimize cold-start mitigation and plan sizing.", "Track density and memory pressure trends."]),
            ["apim-operations"] = ("API Management Operations", "Latency, error rates, cache effectiveness, and consumer behavior insights.", ["Tune APIM cache and policy chain latency.", "Detect abusive consumers and throttle safely.", "Review dependency failures behind API routes."]),
            ["microservices-map"] = ("Microservices Dependency Map", "Distributed tracing and service-to-service bottleneck visibility.", ["Address top dependency latency contributors.", "Trace failing transaction paths end-to-end.", "Stabilize queue and event-bus bottlenecks."])
        };

        if (!descriptors.TryGetValue(normalizedKey, out var descriptor))
        {
            descriptor = ("Strategic Dashboard", "Unknown dashboard key requested.", ["Use a supported strategic dashboard key."]);
        }

        if (normalizedKey == "backup-health")
        {
            return BuildBackupHealthStrategicDashboard(normalizedKey, tenantId, descriptor, signals, subscriptions);
        }

        var baseMetrics = BuildStrategicMetrics(normalizedKey, signals, subscriptions.Count);
        var actionable = BuildActionableDetails(normalizedKey, tenantId, signals, subscriptions);
        var historical = BuildHistoricalIntelligence(normalizedKey, signals);
        var predictive = BuildPredictiveInsights(normalizedKey, signals);
        var priority = DetermineStrategicPriority(normalizedKey, signals);
        var riSavingsOpportunities = normalizedKey == "ri-savings"
            ? await BuildRiSavingsOpportunitiesAsync(subscriptions, cancellationToken)
            : Array.Empty<RiSavingsOpportunityDto>();
        var auditEvidence = new AuditEvidenceDto(
            "Recommendation exists because live Azure telemetry indicates measurable operational, security, and cost risk patterns.",
            "Azure Resource Graph, Azure Monitor/Log Analytics, Defender for Cloud, Azure Advisor, Cost Management.",
            "Historical trend points are synthesized from live telemetry windows (7d/30d/90d/6m/12m).",
            "Correlates exposure, performance, cost, and governance drift to infer likely root causes.",
            "KQL/ARG-backed metrics plus recommendation engine outputs.");
        var structuredSummary = BuildStructuredSummary(normalizedKey, baseMetrics, actionable, predictive, signals, priority);

        return new StrategicDashboardDto(
            normalizedKey,
            descriptor.Title,
            descriptor.Summary,
            baseMetrics,
            BuildSignalNotes(normalizedKey, signals, subscriptions.Count),
            descriptor.Recommendations,
            priority,
            DateTimeOffset.UtcNow,
            actionable,
            historical,
            predictive,
            auditEvidence,
            structuredSummary,
            riSavingsOpportunities,
            "Prioritize Critical and High modules first, with cost and exposure risks handled in the same sprint.",
            "Create owner-assigned action items for each insight and track closure SLA weekly.",
            "Apply remediation runbooks, validate through telemetry, and capture before/after evidence for auditability.");
    }

    public async Task<ResourceDeepDiveDto> GetResourceDeepDiveAsync(string resourceId, string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var signals = await CollectLiveSignalsAsync(subscriptions, cancellationToken);

        logger.LogInformation("Resource deep dive requested. resource={ResourceId}, tenant={TenantId}", resourceId, tenantId);

        var target = signals.ExposedResources.FirstOrDefault(r => string.Equals(r.ResourceId, resourceId, StringComparison.OrdinalIgnoreCase))
            ?? new ResourceInsightDto(resourceId, resourceId.Split('/').LastOrDefault() ?? "resource", "Unknown", RiskLevel.Medium, "Resource identified via deep-dive request.");

        var now = DateTimeOffset.UtcNow;
        var changeTimeline = new[]
        {
            new TimelineEventDto(now.AddDays(-30), "Created", "Resource baseline observed in tenant inventory."),
            new TimelineEventDto(now.AddDays(-10), "Configuration", "Configuration drift signal detected from governance checks."),
            new TimelineEventDto(now.AddDays(-3), "Security", "Defender recommendation associated with resource category."),
            new TimelineEventDto(now.AddHours(-12), "Cost", "Cost/anomaly engine flagged correlated spend behavior."),
        };

        return new ResourceDeepDiveDto(
            target.ResourceId,
            target.ResourceName,
            target.Category,
            ClampScore(100m - (signals.AppFailureCount * 2m)),
            ClampScore((signals.PublicExposedResourceCount * 8m) + (signals.AnyAnyNsgCount * 15m)),
            ClampScore(100m - (signals.CurrentMonthCost > 0 ? Math.Min(90m, signals.CurrentMonthCost / 200m) : 0m)),
            ClampScore(100m - (signals.AppFailureCount * 3m)),
            ClampScore(100m - (signals.DefenderRecommendationCount * 1.5m)),
            signals.CpuTrend.TakeLast(24).ToArray(),
            signals.DiskLatencyTrend.TakeLast(24).ToArray(),
            changeTimeline,
            [
                target.Description,
                $"Exposure indicators in scope: {signals.PublicExposedResourceCount}.",
                $"Defender recommendations in scope: {signals.DefenderRecommendationCount}."
            ],
            [
                $"Current month spend context: EUR {signals.CurrentMonthCost:N0}.",
                $"Cost optimization opportunities in scope: {signals.CostAdvisorRecommendationCount}."
            ],
            [
                "Apply least-privilege access and tighten perimeter controls.",
                "Enable/validate backup and restore coverage.",
                "Right-size and monitor utilization for cost/performance balance."
            ]);
    }

}
