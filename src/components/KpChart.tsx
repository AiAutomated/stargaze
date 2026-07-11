import React, { useMemo, useState } from 'react';

export interface KpPoint {
  time: string;
  kp: number;
}

function kpColor(kp: number): string {
  if (kp < 3) return '#4ade80';
  if (kp < 4) return '#a3e635';
  if (kp < 5) return '#fbbf24';
  if (kp < 6) return '#f97316';
  if (kp < 7) return '#ef4444';
  return '#dc2626';
}

interface Props {
  history: KpPoint[];
  height?: number;
  /** Show interactive tooltip on hover */
  interactive?: boolean;
  label?: string;
  className?: string;
}

/**
 * Polished Kp history chart — SVG area + bars with gradient fill.
 */
export default function KpChart({
  history,
  height = 72,
  interactive = true,
  label = 'Kp History',
  className = '',
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = history.slice(-48);
  const n = pts.length;

  const path = useMemo(() => {
    if (n < 2) return { line: '', area: '' };
    const w = 100;
    const h = 100;
    const maxKp = 9;
    const coords = pts.map((p, i) => {
      const x = (i / (n - 1)) * w;
      const y = h - (Math.min(p.kp, maxKp) / maxKp) * (h * 0.88) - h * 0.06;
      return [x, y] as const;
    });
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c[0].toFixed(2)} ${c[1].toFixed(2)}`).join(' ');
    const area = `${line} L ${coords[n - 1][0].toFixed(2)} ${h} L ${coords[0][0].toFixed(2)} ${h} Z`;
    return { line, area, coords };
  }, [pts, n]);

  if (n === 0) {
    return (
      <div className={`flex items-center justify-center text-[10px] text-white/25 font-mono ${className}`} style={{ height }}>
        Waiting for NOAA Kp data…
      </div>
    );
  }

  const active = hover !== null ? pts[hover] : pts[n - 1];
  const activeColor = kpColor(active.kp);

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">{label}</p>
        <p className="text-[10px] font-mono font-semibold" style={{ color: activeColor }}>
          Kp {active.kp.toFixed(1)}
          <span className="text-white/30 font-normal ml-1.5">
            {new Date(active.time).toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </p>
      </div>

      <div className="relative rounded-xl overflow-hidden" style={{ height, background: 'rgba(0,0,0,0.2)' }}>
        {/* Threshold guides */}
        <div className="absolute inset-x-0 pointer-events-none" style={{ top: `${(1 - 5 / 9) * 88 + 6}%` }}>
          <div className="border-t border-dashed border-orange-500/25" />
          <span className="absolute right-1 -top-3 text-[7px] font-mono text-orange-400/40">G1</span>
        </div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="kpArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="kpLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="40%" stopColor="#fbbf24" />
              <stop offset="70%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          {path.area && <path d={path.area} fill="url(#kpArea)" />}
          {path.line && (
            <path d={path.line} fill="none" stroke="url(#kpLine)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {/* Hover points as thin bars on top for hit targets */}
        </svg>

        {/* Interactive bar hit areas */}
        {interactive && (
          <div className="absolute inset-0 flex">
            {pts.map((pt, i) => (
              <div
                key={i}
                className="flex-1 h-full cursor-crosshair relative group"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="img"
                aria-label={`Kp ${pt.kp.toFixed(1)} at ${pt.time}`}
              >
                {hover === i && (
                  <div
                    className="absolute bottom-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full"
                    style={{
                      height: `${Math.max(8, (pt.kp / 9) * 90)}%`,
                      background: kpColor(pt.kp),
                      boxShadow: `0 0 8px ${kpColor(pt.kp)}`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-1 text-[8px] font-mono text-white/20">
        <span>older</span>
        <span>Quiet ← → Storm</span>
        <span>now</span>
      </div>
    </div>
  );
}
