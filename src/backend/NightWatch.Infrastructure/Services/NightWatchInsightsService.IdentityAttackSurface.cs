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
    public async Task<IdentityAttackSurfaceDashboardDto> GetIdentityAttackSurfaceDashboardAsync(
        string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new IdentityAttackSurfaceDashboardDto(tenantId, DateTimeOffset.UtcNow,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, [], [], [], []);

        // ── ARG: role assignments ─────────────────────────────────────────────
        const string ownerRoleId = "8e3af657-a8ff-443c-a75c-2fe8c4bcb635";
        const string assignmentsQuery = @"authorizationresources
| where type =~ 'microsoft.authorization/roleassignments'
| extend roleDefId = tostring(properties.roleDefinitionId)
| extend principalType = tostring(properties.principalType)
| extend principalId = tostring(properties.principalId)
| project subscriptionId, principalType, principalId, roleDefId";

        const string customRolesQuery = @"authorizationresources
| where type =~ 'microsoft.authorization/roledefinitions'
| where properties.roleType =~ 'CustomRole'
| summarize CustomRoleCount = count()";

        // Best-effort: ARG does not expose display names for principals — we surface principal type
        const string principalNamesQuery = @"authorizationresources
| where type =~ 'microsoft.authorization/roleassignments'
| extend roleDefId = tostring(properties.roleDefinitionId)
| where roleDefId endswith '8e3af657-a8ff-443c-a75c-2fe8c4bcb635'
| extend principalType = tostring(properties.principalType)
| extend principalId = tostring(properties.principalId)
| project subscriptionId, principalType, principalId, roleDefId
| take 50";

        int totalAssignments = 0, ownerAssignments = 0, spOwnerCount = 0, guestAssignments = 0, customRoleCount = 0;
        var privilegedRoles = new List<PrivilegedRoleAssignmentDto>();

        try
        {
            var assignTask = azureResourceGraphClient.QueryResourcesAsync(assignmentsQuery, subscriptionIds, null, cancellationToken);
            var customTask = azureResourceGraphClient.QueryResourcesAsync(customRolesQuery, subscriptionIds, null, cancellationToken);
            var ownerTask = azureResourceGraphClient.QueryResourcesAsync(principalNamesQuery, subscriptionIds, null, cancellationToken);
            await Task.WhenAll(assignTask, customTask, ownerTask);

            // Custom role count
            using var customDoc = await customTask;
            if (customDoc.RootElement.TryGetProperty("data", out var customData) && customData.ValueKind == JsonValueKind.Array)
            {
                foreach (var row in customData.EnumerateArray())
                {
                    if (row.TryGetProperty("CustomRoleCount", out var cc) && cc.ValueKind == JsonValueKind.Number)
                        customRoleCount = cc.GetInt32();
                }
            }

            // All assignments — count totals
            using var assignDoc = await assignTask;
            if (assignDoc.RootElement.TryGetProperty("data", out var assignData) && assignData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in assignData.EnumerateArray())
                {
                    var principalType = GetStringProperty(item, "principalType") ?? "";
                    var roleDefId = GetStringProperty(item, "roleDefId") ?? "";
                    var isOwner = roleDefId.EndsWith(ownerRoleId, StringComparison.OrdinalIgnoreCase);

                    totalAssignments++;
                    if (isOwner) ownerAssignments++;
                    if (principalType.Equals("Guest", StringComparison.OrdinalIgnoreCase)) guestAssignments++;
                    if (isOwner && principalType.Equals("ServicePrincipal", StringComparison.OrdinalIgnoreCase)) spOwnerCount++;
                }
            }

            // Owner-role assignments for privileged role list
            using var ownerDoc = await ownerTask;
            if (ownerDoc.RootElement.TryGetProperty("data", out var ownerData) && ownerData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in ownerData.EnumerateArray())
                {
                    var principalType = GetStringProperty(item, "principalType") ?? "Unknown";
                    var principalId = GetStringProperty(item, "principalId") ?? "";
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var subName = subNameMap.GetValueOrDefault(subId, "Unknown Subscription");
                    privilegedRoles.Add(new PrivilegedRoleAssignmentDto(
                        PrincipalName: $"{principalType} ({principalId[..Math.Min(8, principalId.Length)]}...)",
                        PrincipalType: principalType,
                        RoleName: "Owner",
                        SubscriptionName: subName,
                        IsOwnerRole: true));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Identity Attack Surface ARG query failed for tenant {TenantId}.", tenantId); }

        // ── Log Analytics: sign-in logs, PIM events, conditional access ────────
        var workspaceIds = operationsScopeService.GetCurrent().LogAnalyticsWorkspaceIds;
        var riskySignIns = new List<RiskySignInEventDto>();
        var caPolicies = new List<ConditionalAccessPolicySummaryDto>();
        int riskySignInCount = 0, riskyUserCount = 0, pimActivationCount = 0, mfaBlockedCount = 0;
        bool hasSignInLogData = false, hasAuditLogData = false;

        if (workspaceIds.Count > 0)
        {
            const string riskySignInsKql = @"SigninLogs
| where TimeGenerated >= ago(24h)
| where RiskLevelDuringSignIn in ('high', 'medium', 'low')
| where RiskLevelDuringSignIn != 'none'
| project UserDisplayName, UserPrincipalName, RiskLevelDuringSignIn, IPAddress, TimeGenerated
| order by TimeGenerated desc
| take 25";

            const string riskyUsersCountKql = @"SigninLogs
| where TimeGenerated >= ago(24h)
| where RiskLevelDuringSignIn in ('high', 'medium')
| summarize RiskyUserCount = dcount(UserId)";

            const string pimKql = @"AuditLogs
| where TimeGenerated >= ago(24h)
| where Category =~ 'RoleManagement'
| where ActivityDisplayName has_any ('activated', 'Add member to role')
| summarize PimActivationCount = count()";

            const string caKql = @"SigninLogs
| where TimeGenerated >= ago(24h)
| where isnotempty(ConditionalAccessStatus)
| mv-expand Policy = ConditionalAccessPolicies
| extend PolicyName = tostring(Policy.displayName)
| extend PolicyResult = tostring(Policy.result)
| where isnotempty(PolicyName)
| summarize
    AppliedCount = count(),
    BlockedCount = countif(PolicyResult =~ 'block'),
    MfaCount = countif(PolicyResult =~ 'requireMfa' or PolicyResult =~ 'mfaCompleted')
  by PolicyName
| order by AppliedCount desc
| take 10";

            const string mfaBlockedKql = @"SigninLogs
| where TimeGenerated >= ago(24h)
| where ResultType in ('50074', '50076', '50079', '500121')
| summarize MfaBlockedCount = count()";

            foreach (var wsId in workspaceIds)
            {
                try
                {
                    var riskyTask = monitorClient.QueryWorkspaceAsync(wsId, riskySignInsKql, cancellationToken);
                    var riskyUsersTask = monitorClient.QueryWorkspaceAsync(wsId, riskyUsersCountKql, cancellationToken);
                    var pimTask = monitorClient.QueryWorkspaceAsync(wsId, pimKql, cancellationToken);
                    var caTask = monitorClient.QueryWorkspaceAsync(wsId, caKql, cancellationToken);
                    var mfaTask = monitorClient.QueryWorkspaceAsync(wsId, mfaBlockedKql, cancellationToken);
                    await Task.WhenAll(riskyTask, riskyUsersTask, pimTask, caTask, mfaTask);

                    // Risky sign-ins
                    using var riskyDoc = await riskyTask;
                    if (TryGetFirstMonitorTable(riskyDoc.RootElement, out var rCols, out var rRows))
                    {
                        var dispIdx = FindColumnIndex(rCols, "UserDisplayName");
                        var upnIdx = FindColumnIndex(rCols, "UserPrincipalName");
                        var riskIdx = FindColumnIndex(rCols, "RiskLevelDuringSignIn");
                        var ipIdx = FindColumnIndex(rCols, "IPAddress");
                        var tsIdx = FindColumnIndex(rCols, "TimeGenerated");
                        foreach (var row in rRows.EnumerateArray())
                        {
                            var cells = row.EnumerateArray().ToArray();
                            if (cells.Length <= Math.Max(dispIdx, upnIdx)) continue;
                            riskySignInCount++;
                            riskySignIns.Add(new RiskySignInEventDto(
                                UserDisplayName: dispIdx >= 0 && cells.Length > dispIdx ? cells[dispIdx].GetString() ?? "" : "",
                                UserPrincipalName: upnIdx >= 0 && cells.Length > upnIdx ? cells[upnIdx].GetString() ?? "" : "",
                                RiskLevel: riskIdx >= 0 && cells.Length > riskIdx ? cells[riskIdx].GetString() ?? "unknown" : "unknown",
                                IpAddress: ipIdx >= 0 && cells.Length > ipIdx ? cells[ipIdx].GetString() ?? "" : "",
                                SignInTime: tsIdx >= 0 && cells.Length > tsIdx ? cells[tsIdx].GetString() ?? "" : ""));
                        }
                        hasSignInLogData = true;
                    }

                    // Risky user count
                    using var riskyUsersDoc = await riskyUsersTask;
                    if (TryGetFirstMonitorTable(riskyUsersDoc.RootElement, out var ruCols, out var ruRows))
                    {
                        var countIdx = FindColumnIndex(ruCols, "RiskyUserCount");
                        foreach (var row in ruRows.EnumerateArray())
                        {
                            var cells = row.EnumerateArray().ToArray();
                            if (countIdx >= 0 && cells.Length > countIdx && cells[countIdx].ValueKind == JsonValueKind.Number)
                                riskyUserCount += cells[countIdx].GetInt32();
                        }
                    }

                    // PIM activations
                    using var pimDoc = await pimTask;
                    if (TryGetFirstMonitorTable(pimDoc.RootElement, out var pCols, out var pRows))
                    {
                        var pCountIdx = FindColumnIndex(pCols, "PimActivationCount");
                        foreach (var row in pRows.EnumerateArray())
                        {
                            var cells = row.EnumerateArray().ToArray();
                            if (pCountIdx >= 0 && cells.Length > pCountIdx && cells[pCountIdx].ValueKind == JsonValueKind.Number)
                                pimActivationCount += cells[pCountIdx].GetInt32();
                        }
                        hasAuditLogData = true;
                    }

                    // Conditional access policies
                    using var caDoc = await caTask;
                    if (TryGetFirstMonitorTable(caDoc.RootElement, out var caCols, out var caRows))
                    {
                        var nameIdx = FindColumnIndex(caCols, "PolicyName");
                        var appliedIdx = FindColumnIndex(caCols, "AppliedCount");
                        var blockedIdx = FindColumnIndex(caCols, "BlockedCount");
                        var mfaIdx = FindColumnIndex(caCols, "MfaCount");
                        foreach (var row in caRows.EnumerateArray())
                        {
                            var cells = row.EnumerateArray().ToArray();
                            var policyName = nameIdx >= 0 && cells.Length > nameIdx ? cells[nameIdx].GetString() ?? "" : "";
                            if (string.IsNullOrWhiteSpace(policyName)) continue;
                            var applied = appliedIdx >= 0 && cells.Length > appliedIdx && cells[appliedIdx].ValueKind == JsonValueKind.Number ? cells[appliedIdx].GetInt32() : 0;
                            var blocked = blockedIdx >= 0 && cells.Length > blockedIdx && cells[blockedIdx].ValueKind == JsonValueKind.Number ? cells[blockedIdx].GetInt32() : 0;
                            var mfa = mfaIdx >= 0 && cells.Length > mfaIdx && cells[mfaIdx].ValueKind == JsonValueKind.Number ? cells[mfaIdx].GetInt32() : 0;
                            caPolicies.Add(new ConditionalAccessPolicySummaryDto(policyName, applied, blocked, mfa));
                        }
                    }

                    // MFA blocked
                    using var mfaDoc = await mfaTask;
                    if (TryGetFirstMonitorTable(mfaDoc.RootElement, out var mfaCols, out var mfaRows))
                    {
                        var mfaCountIdx = FindColumnIndex(mfaCols, "MfaBlockedCount");
                        foreach (var row in mfaRows.EnumerateArray())
                        {
                            var cells = row.EnumerateArray().ToArray();
                            if (mfaCountIdx >= 0 && cells.Length > mfaCountIdx && cells[mfaCountIdx].ValueKind == JsonValueKind.Number)
                                mfaBlockedCount += cells[mfaCountIdx].GetInt32();
                        }
                    }
                }
                catch (Exception ex) { logger.LogWarning(ex, "Identity Attack Surface Log Analytics query failed for workspace {WorkspaceId}.", wsId); }
            }
        }

        // ── Build findings ────────────────────────────────────────────────────
        var findings = new List<IdentityRiskFindingDto>();

        if (ownerAssignments > 5)
            findings.Add(new IdentityRiskFindingDto("ias-owner-excess", "Excessive Owner Assignments",
                ownerAssignments > 15 ? "Critical" : "High", ownerAssignments,
                "Privileged Access",
                "Reduce Owner-role assignments and adopt least-privilege roles (Contributor, Reader) where full ownership is not required."));

        if (spOwnerCount > 0)
            findings.Add(new IdentityRiskFindingDto("ias-sp-owner", "Service Principals with Owner Role",
                spOwnerCount > 3 ? "Critical" : "High", spOwnerCount,
                "Privileged Access",
                "Service principals with Owner access are high-value attack targets. Replace with scoped custom roles or managed identity assignments."));

        if (customRoleCount > 10)
            findings.Add(new IdentityRiskFindingDto("ias-custom-roles", "High Custom Role Count",
                "Medium", customRoleCount,
                "Role Hygiene",
                "Audit and consolidate custom RBAC roles. Proliferation increases permission misconfiguration risk."));

        if (guestAssignments > 0)
            findings.Add(new IdentityRiskFindingDto("ias-guest-assignments", "Guest Users with Role Assignments",
                guestAssignments > 5 ? "High" : "Medium", guestAssignments,
                "Guest Access",
                "Review guest user role assignments. Guests should have time-limited, least-privilege access only."));

        if (riskySignInCount > 10)
            findings.Add(new IdentityRiskFindingDto("ias-risky-signins", "Elevated Risky Sign-In Volume",
                riskySignInCount > 50 ? "Critical" : "High", riskySignInCount,
                "Sign-In Risk",
                "Investigate risky sign-ins. Enable Conditional Access policies that block or challenge high-risk sign-ins automatically."));

        if (riskyUserCount > 0)
            findings.Add(new IdentityRiskFindingDto("ias-risky-users", "Users Flagged as Risky",
                riskyUserCount > 5 ? "High" : "Medium", riskyUserCount,
                "User Risk",
                "Remediate risky users via Entra Identity Protection. Require password reset and MFA re-registration."));

        if (mfaBlockedCount > 0)
            findings.Add(new IdentityRiskFindingDto("ias-mfa-blocked", "Users Blocked by MFA",
                "Medium", mfaBlockedCount,
                "MFA Friction",
                "High MFA failure count may indicate users bypassing or struggling with MFA. Investigate authentication methods."));

        if (findings.Count == 0)
            findings.Add(new IdentityRiskFindingDto("ias-clear", "No Critical Identity Risks Detected",
                "Low", 0,
                "Posture",
                "No critical identity attack surface signals were found. Continue reviewing privileged access periodically."));

        // ── Compute risk score ────────────────────────────────────────────────
        int riskScore = 0;
        if (ownerAssignments > 15) riskScore += 30;
        else if (ownerAssignments > 5) riskScore += 15;
        if (spOwnerCount > 3) riskScore += 25;
        else if (spOwnerCount > 0) riskScore += 15;
        if (customRoleCount > 10) riskScore += 10;
        if (guestAssignments > 5) riskScore += 10;
        else if (guestAssignments > 0) riskScore += 5;
        if (riskySignInCount > 50) riskScore += 25;
        else if (riskySignInCount > 10) riskScore += 15;
        if (riskyUserCount > 5) riskScore += 15;
        else if (riskyUserCount > 0) riskScore += 8;
        riskScore = Math.Min(100, riskScore);

        return new IdentityAttackSurfaceDashboardDto(
            TenantId: tenantId,
            GeneratedAt: DateTimeOffset.UtcNow,
            TotalPrivilegedAssignments: totalAssignments,
            OwnerAssignments: ownerAssignments,
            ServicePrincipalOwnerCount: spOwnerCount,
            CustomRoleCount: customRoleCount,
            GuestUserAssignments: guestAssignments,
            IdentityRiskScore: riskScore,
            RiskySignInCount: riskySignInCount,
            RiskyUserCount: riskyUserCount,
            PimActivationCount: pimActivationCount,
            MfaBlockedCount: mfaBlockedCount,
            HasSignInLogData: hasSignInLogData,
            HasAuditLogData: hasAuditLogData,
            Findings: findings.ToArray(),
            PrivilegedRoles: privilegedRoles.ToArray(),
            RiskySignIns: riskySignIns.ToArray(),
            ConditionalAccessPolicies: caPolicies.ToArray());
    }
}
