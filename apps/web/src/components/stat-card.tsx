interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'white' | 'volt' | 'ink';
}

const tones = {
  white: 'bg-white border-gray-100 text-ink',
  volt: 'bg-volt-300 border-volt-400 text-ink',
  ink: 'bg-ink border-ink text-white',
};

export function StatCard({ label, value, sub, tone = 'white' }: StatCardProps) {
  return (
    <div className={`rounded-2xl p-4 border shadow-card ${tones[tone]}`}>
      <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${tone === 'ink' ? 'text-white/50' : 'text-gray-500'}`}>{label}</p>
      <p className="font-display text-3xl font-extrabold mt-1 tabular-nums leading-none">{value}</p>
      {sub && <p className={`text-xs mt-1.5 ${tone === 'ink' ? 'text-white/50' : 'text-gray-500'}`}>{sub}</p>}
    </div>
  );
}
