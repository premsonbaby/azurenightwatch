import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Insight } from '../types/insight';
import { SeverityLevel } from '../types/insight';
import { Bell, AlertTriangle, TrendingDown, ShieldAlert, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';
import { nightWatchClient } from '../api/client';

const severityColors: Record<SeverityLevel, string> = {
    [SeverityLevel.Critical]: 'border-red-500 bg-red-500/10',
    [SeverityLevel.High]: 'border-orange-500 bg-orange-500/10',
    [SeverityLevel.Medium]: 'border-yellow-500 bg-yellow-500/10',
    [SeverityLevel.Low]: 'border-blue-500 bg-blue-500/10',
};

const severityLabels: Record<SeverityLevel, string> = {
    [SeverityLevel.Critical]: 'Critical',
    [SeverityLevel.High]: 'High',
    [SeverityLevel.Medium]: 'Medium',
    [SeverityLevel.Low]: 'Low',
};

const categoryIcons: Record<string, React.ReactNode> = {
    Security: <ShieldAlert size={16} className="text-red-400" />,
    Cost: <TrendingDown size={16} className="text-green-400" />,
    Performance: <AlertTriangle size={16} className="text-yellow-400" />,
    Governance: <FileText size={16} className="text-blue-400" />,
    General: <Bell size={16} className="text-gray-400" />,
};

type FilterTab = 'All' | 'Critical' | 'High' | 'Medium' | 'Low';

const filterTabs: FilterTab[] = ['All', 'Critical', 'High', 'Medium', 'Low'];

const tabSeverityMap: Partial<Record<FilterTab, SeverityLevel>> = {
    Critical: SeverityLevel.Critical,
    High: SeverityLevel.High,
    Medium: SeverityLevel.Medium,
    Low: SeverityLevel.Low,
};

const tabActiveClass = 'bg-white/10 text-white';
const tabInactiveClass = 'text-gray-400 hover:text-gray-200 hover:bg-white/5';

interface InsightFeedProps {
    refreshTick?: number;
}

export const InsightFeed: React.FC<InsightFeedProps> = ({ refreshTick = 0 }) => {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('All');

    useEffect(() => {
        let cancelled = false;
        setLoading((prev) => prev || insights.length === 0);

        nightWatchClient.getIntelligenceFeed(refreshTick)
            .then(data => {
                if (!cancelled) {
                    setInsights(Array.isArray(data) ? (data as Insight[]) : []);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error("Error fetching insights:", err);
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTick]);

    if (loading) {
        return (
            <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    const filteredInsights = activeFilter === 'All'
        ? insights
        : insights.filter(i => i.severity === tabSeverityMap[activeFilter]);

    const countBySeverity = (sev: SeverityLevel) => insights.filter(i => i.severity === sev).length;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-1 flex-wrap">
                {filterTabs.map(tab => {
                    const sev = tabSeverityMap[tab];
                    const count = sev !== undefined ? countBySeverity(sev) : insights.length;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveFilter(tab)}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${activeFilter === tab ? tabActiveClass : tabInactiveClass}`}
                        >
                            {tab} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
                        </button>
                    );
                })}
            </div>

            {filteredInsights.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-8 text-center">
                    <CheckCircle2 size={36} className="text-emerald-400" strokeWidth={1.5} />
                    <p className="text-sm font-semibold text-emerald-300">
                        {activeFilter === 'All' ? 'All systems nominal' : `No ${activeFilter.toLowerCase()} severity signals`}
                    </p>
                    <p className="text-xs text-slate-400">
                        {activeFilter === 'All'
                            ? 'No active Defender findings or Advisor recommendations were returned for the current Azure scope.'
                            : `Filter to another severity level to see remaining signals, or all signals are below ${activeFilter.toLowerCase()} threshold.`}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-260px)] pr-2">
                    {filteredInsights.map(insight => (
                        <Link
                            key={insight.id}
                            to={insight.targetPage}
                            className={`group relative p-3 rounded-lg border-l-4 transition-all hover:translate-x-1 ${severityColors[insight.severity]}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    {categoryIcons[insight.category] || categoryIcons.General}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="font-medium text-gray-100 text-sm">{insight.title}</h4>
                                        <ChevronRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">{insight.message}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                                            {new Date(insight.timestamp).toLocaleString()}
                                        </span>
                                        <span className="text-[10px] text-gray-600">·</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            {severityLabels[insight.severity]}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};
