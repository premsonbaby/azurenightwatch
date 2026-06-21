interface SkeletonCardProps {
  rows?: number;
  className?: string;
}

export function SkeletonCard({ rows = 3, className = '' }: SkeletonCardProps) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-800/40 p-5 animate-pulse ${className}`}>
      <div className="h-3 w-1/3 rounded bg-slate-700/60 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`h-2.5 rounded bg-slate-700/40 mb-2.5 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  );
}

export function SkeletonKpiCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-800/40 p-5 animate-pulse ${className}`}>
      <div className="h-2.5 w-1/2 rounded bg-slate-700/60 mb-3" />
      <div className="h-8 w-2/3 rounded bg-slate-700/50 mb-2" />
      <div className="h-2 w-1/3 rounded bg-slate-700/30" />
    </div>
  );
}

export function SkeletonDashboard({ kpis = 4, sections = 2 }: { kpis?: number; sections?: number }) {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className={`grid gap-4 grid-cols-2 lg:grid-cols-${Math.min(kpis, 4)}`}>
        {Array.from({ length: kpis }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>
      {/* Content sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <SkeletonCard key={i} rows={4 + i} />
      ))}
    </div>
  );
}
