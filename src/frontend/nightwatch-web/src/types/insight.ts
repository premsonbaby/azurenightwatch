export const SeverityLevel = {
    Critical: 'Critical',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
} as const;

export type SeverityLevel = typeof SeverityLevel[keyof typeof SeverityLevel];

export interface Insight {
    id: string;
    title: string;
    message: string;
    category: string;
    severity: SeverityLevel;
    timestamp: string;
    targetPage: string;
    resourceId?: string;
}
