namespace NightWatch.Infrastructure.Services;

/// <summary>
/// Generates plain-English alert narratives from raw metric signals.
/// Template-based — no external dependency, always fast.
/// </summary>
public static class AlertNarrativeEngine
{
    public sealed record Narrative(
        string Title,
        string BusinessImpact,
        string SuggestedAction,
        string Severity);

    public static Narrative Generate(
        string metricType,
        decimal actualValue,
        decimal thresholdValue,
        string? tenantName = null,
        decimal? dailyBurnRate = null,
        int? daysLeft = null)
    {
        var tenant = string.IsNullOrWhiteSpace(tenantName) ? "" : $" for {tenantName}";

        return metricType switch
        {
            "MonthlyCostCeiling" => CostCeiling(actualValue, thresholdValue, tenant),
            "MonthlyCostRunRate" => CostRunRate(actualValue, thresholdValue, dailyBurnRate, daysLeft, tenant),
            "SecurityScoreFloor" => SecurityScore(actualValue, thresholdValue, tenant),
            "AdvisorScoreFloor" => AdvisorScore(actualValue, thresholdValue, tenant),
            "BackupCoverageFloor" => BackupCoverage(actualValue, thresholdValue, tenant),
            "GovernanceScoreFloor" => GovernanceScore(actualValue, thresholdValue, tenant),
            "ReliabilityScoreFloor" => ReliabilityScore(actualValue, thresholdValue, tenant),
            _ => Generic(metricType, actualValue, thresholdValue, tenant),
        };
    }

    private static Narrative CostCeiling(decimal actual, decimal threshold, string tenant) => new(
        Title: $"Monthly spend exceeded budget ceiling{tenant}",
        BusinessImpact: $"Current spend of {actual:N0} has exceeded the configured ceiling of {threshold:N0}. " +
            "Uncontrolled overspend erodes MSP margin and can trigger customer escalations at invoice time. " +
            "If this is unexpected, a workload may have been misconfigured, scaled up, or left running outside business hours.",
        SuggestedAction: "Open the Top Costly Resources dashboard to identify which resources are driving the spike. " +
            "Look for any workloads created or scaled in the last 7 days. " +
            "Enable auto-shutdown schedules for dev and test environments to prevent overnight leakage.",
        Severity: "High");

    private static Narrative CostRunRate(decimal actual, decimal threshold, decimal? dailyRate, int? daysLeft, string tenant)
    {
        var rateStr = dailyRate.HasValue ? $"{dailyRate.Value:N0}/day" : "current rate";
        var daysStr = daysLeft.HasValue ? $"{daysLeft.Value} days" : "before month end";
        return new(
            Title: $"Budget burn rate warning — exhaustion in {daysStr}{tenant}",
            BusinessImpact: $"Current spend is {actual:N0} with the budget ceiling set at {threshold:N0}. " +
                $"At {rateStr}, the budget will be exhausted in {daysStr}. " +
                "This is a pre-breach warning giving you time to act before the ceiling is breached.",
            SuggestedAction: "Review the Cost Anomaly dashboard for unexpected spikes in the last 7 days. " +
                "Stop or deallocate any non-production workloads running outside business hours. " +
                "If the spend is expected, consider raising the budget ceiling.",
            Severity: "Medium");
    }

    private static Narrative SecurityScore(decimal actual, decimal threshold, string tenant) => new(
        Title: $"Security posture score dropped below threshold{tenant}",
        BusinessImpact: $"Defender for Cloud security score has fallen to {actual:F0}% (minimum: {threshold:F0}%). " +
            "A lower score means unresolved security recommendations are increasing exposure to attacks such as " +
            "ransomware, credential theft, and lateral movement. " +
            "Customers with low scores are more likely to experience a security incident.",
        SuggestedAction: "Open Defender for Cloud and triage Critical and High severity recommendations. " +
            "Focus on: enabling MFA for privileged accounts, restricting public-facing management ports (RDP/SSH), " +
            "patching vulnerable OS images, and enabling endpoint protection on all VMs.",
        Severity: actual < threshold - 20 ? "Critical" : "High");

    private static Narrative AdvisorScore(decimal actual, decimal threshold, string tenant) => new(
        Title: $"Azure Advisor score below minimum{tenant}",
        BusinessImpact: $"Azure Advisor overall score is {actual:F0}% (minimum: {threshold:F0}%). " +
            "This reflects missed optimisation opportunities across cost, security, reliability, and performance. " +
            "A low score typically means there are quick-win recommendations that have been ignored, " +
            "leaving money and reliability improvements on the table.",
        SuggestedAction: "Review Azure Advisor recommendations in the portal, sorted by impact. " +
            "Highest-value actions are usually: right-size underutilised VMs, remove unattached disks, " +
            "enable backup for unprotected resources, and apply security patches.",
        Severity: "Medium");

    private static Narrative BackupCoverage(decimal actual, decimal threshold, string tenant) => new(
        Title: $"Backup coverage dropped below threshold{tenant}",
        BusinessImpact: $"Only {actual:F0}% of workloads have active backup protection (minimum: {threshold:F0}%). " +
            "Unprotected resources are at risk of permanent data loss from accidental deletion, " +
            "ransomware encryption, or hardware failure. " +
            "If a stateful workload has no backup, recovery after an incident may be impossible.",
        SuggestedAction: "Open the Backup Health dashboard to identify unprotected VMs and databases. " +
            "Enable Azure Backup for all production workloads through a Recovery Services Vault. " +
            "Ensure backup policies cover all databases, file shares, and critical virtual machines.",
        Severity: actual < threshold - 20 ? "Critical" : "High");

    private static Narrative GovernanceScore(decimal actual, decimal threshold, string tenant) => new(
        Title: $"Governance compliance score below minimum{tenant}",
        BusinessImpact: $"Governance compliance has fallen to {actual:F0}% (minimum: {threshold:F0}%). " +
            "This indicates tag hygiene issues, naming non-compliance, or Azure Policy violations. " +
            "Poor governance increases audit risk and makes it impossible to accurately allocate costs " +
            "to business units or customers.",
        SuggestedAction: "Review the Governance dashboard. Address tag compliance gaps first — " +
            "untagged resources cannot be mapped to cost centres. " +
            "Then enforce naming standards via Azure Policy assignments and review owner assignments for critical resources.",
        Severity: "Medium");

    private static Narrative ReliabilityScore(decimal actual, decimal threshold, string tenant) => new(
        Title: $"Reliability score dropped below threshold{tenant}",
        BusinessImpact: $"Platform reliability score is {actual:F0}%, below the minimum of {threshold:F0}%. " +
            "This may indicate missing redundancy configurations, disabled health probes, " +
            "or SLA-threatening single-points-of-failure in the environment.",
        SuggestedAction: "Check the DR Recoverability dashboard for workloads missing RPO/RTO coverage. " +
            "Enable zone-redundant deployments for production workloads. " +
            "Verify that backup restoration has been tested recently.",
        Severity: "High");

    private static Narrative Generic(string metricType, decimal actual, decimal threshold, string tenant) => new(
        Title: $"Alert threshold triggered: {metricType}{tenant}",
        BusinessImpact: $"Metric '{metricType}' has reached {actual:F1} (threshold: {threshold:F1}). Review the relevant dashboard.",
        SuggestedAction: "Investigate the metric in the NightWatch dashboard and take corrective action.",
        Severity: "High");
}
