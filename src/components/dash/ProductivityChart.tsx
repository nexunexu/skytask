export function ProductivityChart({ series }: { series: { label: string; value: number }[] }) {
  const W = 400, H = 150, L = 34, B = 20;
  const pts = series.map((s, i) => ({
    x: L + (i * (W - L - 10)) / (series.length - 1),
    y: 8 + (1 - s.value / 100) * (H - B - 8),
    ...s,
  }));
  if (pts.length < 2) return null;
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  let d = `M ${P(0).x} ${P(0).y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  const area = `${d} L ${P(pts.length - 1).x} ${H - B} L ${P(0).x} ${H - B} Z`;
  const max = pts.reduce((a, b) => (b.value > a.value ? b : a), P(0));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="pc-line" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--neon-orange)" />
          <stop offset="45%" stopColor="var(--neon-purple)" />
          <stop offset="100%" stopColor="var(--neon-pink)" />
        </linearGradient>
        <linearGradient id="pc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--neon-blue)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--neon-blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((v) => {
        const y = 8 + (1 - v / 100) * (H - B - 8);
        return (
          <g key={v}>
            <line x1={L} x2={W - 6} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={2} y={y + 3} fontSize="8" fill="var(--muted-foreground)">{v}%</text>
          </g>
        );
      })}
      <path d={area} fill="url(#pc-area)" />
      <path d={d} fill="none" stroke="url(#pc-line)" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 4px var(--neon-purple))" }} />
      {pts.map((p) => (
        <g key={p.label + p.x}>
          <circle cx={p.x} cy={p.y} r="3" fill="var(--neon-purple)" stroke="var(--foreground)" strokeWidth="0.8" />
          <text x={p.x} y={H - 4} fontSize="8" textAnchor="middle" fill="var(--muted-foreground)">{p.label}</text>
        </g>
      ))}
      <g>
        <rect x={max.x - 14} y={max.y - 20} width="28" height="13" rx="3" fill="var(--secondary)" stroke="var(--border)" />
        <text x={max.x} y={max.y - 10.5} fontSize="8" textAnchor="middle" fill="var(--foreground)">{max.value}%</text>
      </g>
    </svg>
  );
}

export function Ring({ value }: { value: number }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 60 60" className="h-14 w-14 -rotate-90">
      <defs>
        <linearGradient id="ring-g" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--neon-pink)" />
          <stop offset="100%" stopColor="var(--neon-purple)" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
      <circle cx="30" cy="30" r={r} fill="none" stroke="url(#ring-g)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: "stroke-dashoffset .6s", filter: "drop-shadow(0 0 4px var(--neon-pink))" }} />
    </svg>
  );
}
