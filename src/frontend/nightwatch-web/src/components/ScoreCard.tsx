interface ScoreCardProps {
  label: string;
  value: number;
  suffix?: string;
}

export function ScoreCard({ label, value, suffix = '%' }: ScoreCardProps) {
  const v = value ?? 0;
  const tone = v >= 80 ? 'from-emerald-500/35 to-emerald-700/10' : v >= 65 ? 'from-amber-500/35 to-amber-700/10' : 'from-rose-500/35 to-rose-700/10';

  return (
    <article className={`rounded-2xl border border-white/15 bg-gradient-to-br ${tone} p-4 shadow-lg backdrop-blur-sm`}>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-200">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{v.toFixed(0)}{suffix}</p>
    </article>
  );
}
