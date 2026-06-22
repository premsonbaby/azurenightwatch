using NightWatch.Application.Contracts;

namespace NightWatch.Infrastructure.Services;

internal static class FindingLibrary
{
    internal static readonly IReadOnlyList<FindingLibraryItemDto> Items =
    [
        // ── Security ────────────────────────────────────────────────────────────
        new("SEC-001", "Security", "Critical",
            "MFA not enforced for all users",
            "Multi-Factor Authentication is not enforced across the tenant. Users can authenticate with password only, significantly increasing the risk of account compromise.",
            "Enable and enforce MFA via Conditional Access Policy for all users. Exclude only approved break-glass accounts. Use Microsoft Authenticator or FIDO2 hardware keys.",
            "QuickWin"),

        new("SEC-002", "Security", "High",
            "Privileged roles assigned without PIM",
            "Global Administrator, Subscription Owner, or other privileged roles are permanently assigned rather than managed through Privileged Identity Management (PIM). This violates least-privilege and creates persistent attack surface.",
            "Migrate privileged role assignments to Azure AD PIM with Just-In-Time access, approval workflows, and time-bound activation. Remove permanent assignments.",
            "ShortTerm"),

        new("SEC-003", "Security", "High",
            "Defender for Cloud not enabled on all subscriptions",
            "Microsoft Defender for Cloud is not enabled or is in the free tier on one or more subscriptions, leaving resources without threat detection, vulnerability assessment, and security recommendations.",
            "Enable Defender for Cloud Enhanced Security Features on all subscriptions. Prioritise Defender for Servers, Defender for SQL, and Defender for Key Vault as a minimum baseline.",
            "QuickWin"),

        new("SEC-004", "Security", "Medium",
            "Guest accounts with privileged access",
            "External guest accounts have been granted directory roles or resource-level Owner/Contributor permissions. Guest accounts represent a higher risk as they are outside the organisation's lifecycle management.",
            "Review all guest account role assignments. Remove privileged roles from guests. Where cross-tenant access is required, use cross-tenant sync or Azure Lighthouse rather than direct guest membership.",
            "ShortTerm"),

        new("SEC-005", "Security", "Medium",
            "Secrets and keys stored in application code or configuration files",
            "Azure resource connection strings, API keys, or certificates are embedded in application settings or source code rather than being stored in Azure Key Vault.",
            "Migrate all secrets to Azure Key Vault. Use Managed Identity to authenticate the application to Key Vault, eliminating the need for any credentials in code or configuration.",
            "ShortTerm"),

        new("SEC-006", "Security", "High",
            "Missing Conditional Access baseline policies",
            "The tenant is missing one or more of the Microsoft-recommended Conditional Access baseline policies: block legacy authentication, require MFA for admins, or require compliant/hybrid-joined devices.",
            "Deploy the Microsoft Conditional Access policy templates for: (1) Require MFA for all users, (2) Block legacy authentication protocols, (3) Require MFA for Azure management.",
            "QuickWin"),

        // ── Identity ────────────────────────────────────────────────────────────
        new("IDN-001", "Identity", "High",
            "Stale user accounts not disabled",
            "User accounts that have not signed in for 90+ days remain active. Stale accounts are a vector for credential stuffing attacks and provide unnecessary access.",
            "Implement a process to regularly review and disable accounts inactive for 90 days. Use Azure AD Access Reviews to automate this process. Remove stale accounts after a grace period.",
            "ShortTerm"),

        new("IDN-002", "Identity", "Medium",
            "Service principals with overly broad permissions",
            "Application service principals or managed identities have been granted Subscription Contributor, Owner, or broad resource group permissions rather than scoped, least-privilege roles.",
            "Audit all service principal role assignments. Apply least-privilege using custom roles where standard roles are too broad. Prefer Managed Identities over service principal secrets.",
            "ShortTerm"),

        new("IDN-003", "Identity", "Medium",
            "Custom RBAC roles with excessive permissions",
            "Custom Azure RBAC roles have been created that grant wildcard ('*') actions or permissions broader than necessary, potentially exceeding the intent of the role.",
            "Review all custom role definitions. Replace wildcard actions with explicit resource provider actions. Validate against actual usage using Azure Activity Logs.",
            "LongTerm"),

        // ── Network ─────────────────────────────────────────────────────────────
        new("NET-001", "Network", "Critical",
            "NSG rules allowing any-to-any inbound traffic",
            "One or more Network Security Groups contain inbound allow rules with source 0.0.0.0/0 (Any) to Any destination port. This exposes resources to the public internet without restriction.",
            "Remove any-to-any NSG rules. Replace with explicit rules permitting only required source IP ranges and specific destination ports. Use Azure Service Tags where applicable.",
            "QuickWin"),

        new("NET-002", "Network", "High",
            "Management ports exposed to internet",
            "RDP (TCP 3389) or SSH (TCP 22) is accessible from the public internet via NSG rules or public IP attachments. This is a critical attack surface for brute-force and exploit attacks.",
            "Remove public access to RDP/SSH. Implement Azure Bastion for secure administrative access, or use Just-in-Time VM Access via Defender for Cloud.",
            "QuickWin"),

        new("NET-003", "Network", "High",
            "Virtual networks not connected to central hub",
            "One or more spoke virtual networks are not peered to a central hub VNet or Azure Virtual WAN hub. This creates isolated network segments that bypass central security inspection and routing.",
            "Implement a hub-spoke network topology. Peer all spoke VNets to the hub. Route egress traffic through Azure Firewall or Network Virtual Appliance in the hub.",
            "LongTerm"),

        new("NET-004", "Network", "Medium",
            "No Azure Firewall or NVA protecting egress traffic",
            "Outbound internet traffic from Azure virtual networks is not routed through a central Azure Firewall or Network Virtual Appliance. Resources can make outbound connections to any internet destination.",
            "Deploy Azure Firewall Premium in the hub VNet. Apply a default-deny outbound policy with explicit allow rules for required FQDNs and IP ranges. Enable IDPS in detection or prevention mode.",
            "LongTerm"),

        new("NET-005", "Network", "Medium",
            "Public IPs attached to resources without DDoS protection",
            "Virtual machines or other resources have public IP addresses but Azure DDoS Protection Standard is not enabled on the virtual network. This leaves the resources vulnerable to volumetric DDoS attacks.",
            "Enable Azure DDoS Protection Standard on all VNets containing public-facing resources. Consider Azure Front Door or Application Gateway with WAF for HTTP workloads.",
            "ShortTerm"),

        // ── Cost ────────────────────────────────────────────────────────────────
        new("CST-001", "Cost", "Medium",
            "No Azure Budget alerts configured",
            "No Budget alerts are configured on subscriptions or resource groups. Cost overruns are only discovered after the billing period closes, preventing proactive action.",
            "Configure Azure Budgets with alert thresholds at 80% and 100% of monthly budget. Include both actual and forecast alerts. Route notifications to the operations team email and Teams channel.",
            "QuickWin"),

        new("CST-002", "Cost", "Medium",
            "Orphaned resources consuming budget",
            "Unattached managed disks, unassociated public IPs, empty resource groups, and unused reserved capacity are incurring charges without delivering value.",
            "Implement a monthly orphaned resource review. Use NightWatch's orphaned resources dashboard to identify and clean up wastage. Consider automated runbooks for common categories.",
            "QuickWin"),

        new("CST-003", "Cost", "High",
            "No Reserved Instance or Savings Plan commitment",
            "The environment is running on pay-as-you-go compute pricing with no Reserved Instances or Compute Savings Plans. Based on the current steady-state workload, significant cost savings are available.",
            "Analyse the last 30 days of VM usage. Purchase 1-year Reserved Instances for stable baseline workloads (typically 40-60% saving). Use Savings Plans for variable workloads.",
            "ShortTerm"),

        new("CST-004", "Cost", "Medium",
            "Non-production resources running 24/7",
            "Development, test, and staging environments are running continuously including nights and weekends, incurring unnecessary compute costs.",
            "Implement auto-shutdown schedules for non-production VMs (e.g., 7pm–7am weekdays, weekends). Use Azure DevTest Labs or automation runbooks. Estimated saving: 65% of non-prod compute.",
            "QuickWin"),

        // ── Governance ──────────────────────────────────────────────────────────
        new("GOV-001", "Governance", "High",
            "No tagging policy enforced",
            "Azure resources are missing mandatory tags (e.g., Environment, Owner, CostCentre, Application). Without consistent tagging, cost allocation, ownership, and lifecycle management are not possible.",
            "Deploy Azure Policy to enforce required tags at subscription or management group level. Set the effect to 'Deny' for new resources and 'Modify' to append missing tags. Begin with 3-5 mandatory tags.",
            "ShortTerm"),

        new("GOV-002", "Governance", "Medium",
            "No management group hierarchy in place",
            "Subscriptions are not organised under a Management Group hierarchy. Policy and RBAC assignments must be repeated at each subscription level, increasing management overhead and risk of gaps.",
            "Implement an Azure Management Group hierarchy aligned to the organisation (e.g., Root > Platform > Landing Zones > Sandboxes). Apply Policies and RBAC at the appropriate hierarchy level.",
            "LongTerm"),

        new("GOV-003", "Governance", "Medium",
            "Azure Policy compliance below acceptable threshold",
            "One or more Azure Policy initiatives have a compliance rate below 80%. Non-compliant resources represent configurations that deviate from the agreed governance baseline.",
            "Review non-compliant resources in Azure Policy compliance view. Remediate automatically where possible using Policy remediation tasks. Investigate manual remediation for remaining resources.",
            "ShortTerm"),

        // ── Reliability ─────────────────────────────────────────────────────────
        new("REL-001", "Reliability", "Critical",
            "No backup configured for critical resources",
            "One or more production virtual machines, databases, or storage accounts do not have Azure Backup configured. A failure would result in permanent data loss.",
            "Configure Azure Backup for all production VMs, Azure SQL databases, and critical storage. Define RPO/RTO targets and validate backup restore procedures quarterly.",
            "QuickWin"),

        new("REL-002", "Reliability", "High",
            "Single region deployment with no failover",
            "Production workloads are deployed to a single Azure region with no geo-redundant backup, cross-region replication, or failover capability. A regional outage would result in full downtime.",
            "Implement geo-redundant architecture for critical workloads. Use Azure Site Recovery for VM replication, geo-redundant storage (GRS/GZRS), and Azure SQL geo-replication or failover groups.",
            "LongTerm"),

        new("REL-003", "Reliability", "Medium",
            "No availability zones used for critical resources",
            "Production VMs, load balancers, or databases are deployed without enabling Availability Zone configuration. A single datacenter failure within the region would cause an outage.",
            "Redeploy critical compute (VMs, VMSS, AKS node pools) across Availability Zones. Use Zone-Redundant Storage and Zone-Redundant SQL Database tiers for data services.",
            "ShortTerm"),

        // ── Operational Excellence ───────────────────────────────────────────────
        new("OPS-001", "OperationalExcellence", "Medium",
            "No centralised monitoring and alerting",
            "Azure Monitor alerts and action groups are not consistently configured across the environment. Issues are only discovered by end users or after significant impact has occurred.",
            "Deploy a centralised monitoring strategy using Azure Monitor, Log Analytics, and Application Insights. Configure alerts for critical metrics (CPU, memory, disk, response time) with appropriate action groups.",
            "ShortTerm"),

        new("OPS-002", "OperationalExcellence", "Medium",
            "Azure Advisor recommendations not being actioned",
            "The tenant has open Azure Advisor recommendations that have not been reviewed or actioned. Advisor provides prioritised, actionable recommendations to improve cost, security, reliability, and performance.",
            "Schedule a monthly Advisor review as part of the operational cadence. Assign ownership of each recommendation. Use NightWatch to track Advisor scores over time.",
            "QuickWin"),

        new("OPS-003", "OperationalExcellence", "Low",
            "No Azure Activity Log diagnostic settings configured",
            "Azure Activity Logs are not being exported to a Log Analytics workspace or Storage Account. Audit trails for management plane operations (resource creation, RBAC changes, policy events) may be lost.",
            "Configure Diagnostic Settings on each subscription to export Activity Logs to a central Log Analytics workspace. Retain logs for a minimum of 90 days (or longer per compliance requirements).",
            "QuickWin"),

        // ── Performance ─────────────────────────────────────────────────────────
        new("PER-001", "Performance", "Medium",
            "VMs running at sustained high CPU utilisation",
            "One or more virtual machines are consistently running above 85% CPU utilisation. This reduces application responsiveness and leaves no headroom for traffic spikes.",
            "Right-size or scale up the affected VMs. Consider migrating to VMSS with auto-scale for workloads with variable load patterns. Review application-level optimisations before vertical scaling.",
            "ShortTerm"),

        new("PER-002", "Performance", "Low",
            "No CDN configured for web workloads",
            "Web application static assets (images, CSS, JavaScript) are being served directly from origin without a Content Delivery Network. This increases latency for geographically distributed users.",
            "Deploy Azure Front Door or Azure CDN in front of web workloads. Configure caching rules for static content. This typically reduces page load times by 40-60% for remote users.",
            "ShortTerm"),
    ];
}
