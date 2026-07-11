import React, { useMemo } from 'react';

/** Simple 2D star patterns (0–100 viewBox coords) for shower radiants */
type Pattern = {
  stars: { x: number; y: number; r: number; name?: string }[];
  lines: [number, number][]; // indices into stars
  color: string;
};

const PATTERNS: Record<string, Pattern> = {
  // Boötes (kite shape) — Quadrantids radiant nearby
  'Boötes': {
    color: '#88ccff',
    stars: [
      { x: 50, y: 18, r: 2.4, name: 'Arcturus' },
      { x: 38, y: 38, r: 1.6 },
      { x: 62, y: 40, r: 1.5 },
      { x: 32, y: 58, r: 1.4 },
      { x: 55, y: 62, r: 1.5 },
      { x: 48, y: 78, r: 1.3 },
      { x: 72, y: 70, r: 1.2 },
    ],
    lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [4, 6]],
  },
  Lyra: {
    color: '#aa88ff',
    stars: [
      { x: 50, y: 22, r: 2.6, name: 'Vega' },
      { x: 38, y: 48, r: 1.5 },
      { x: 62, y: 48, r: 1.5 },
      { x: 36, y: 72, r: 1.4 },
      { x: 64, y: 72, r: 1.4 },
    ],
    lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
  },
  Aquarius: {
    color: '#44ccff',
    stars: [
      { x: 28, y: 30, r: 1.8 },
      { x: 42, y: 38, r: 1.5 },
      { x: 55, y: 32, r: 1.6 },
      { x: 68, y: 42, r: 1.4 },
      { x: 48, y: 55, r: 1.5 },
      { x: 38, y: 68, r: 1.3 },
      { x: 58, y: 72, r: 1.4 },
      { x: 72, y: 62, r: 1.2 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [4, 6], [6, 7]],
  },
  Perseus: {
    color: '#ff4488',
    stars: [
      { x: 30, y: 28, r: 1.8 },
      { x: 48, y: 22, r: 2.0, name: 'Mirfak' },
      { x: 62, y: 35, r: 1.6 },
      { x: 72, y: 52, r: 1.5 },
      { x: 55, y: 58, r: 1.7 },
      { x: 38, y: 52, r: 1.5 },
      { x: 42, y: 75, r: 1.4 },
      { x: 68, y: 72, r: 1.3 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [5, 6], [4, 7]],
  },
  Orion: {
    color: '#ff9944',
    stars: [
      { x: 35, y: 20, r: 1.8, name: 'Betelgeuse' },
      { x: 65, y: 22, r: 1.7, name: 'Bellatrix' },
      { x: 42, y: 48, r: 1.5 },
      { x: 50, y: 50, r: 1.6, name: 'Alnilam' },
      { x: 58, y: 52, r: 1.5 },
      { x: 38, y: 78, r: 1.9, name: 'Saiph' },
      { x: 68, y: 75, r: 2.2, name: 'Rigel' },
    ],
    lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
  },
  Leo: {
    color: '#ffcc33',
    stars: [
      { x: 22, y: 40, r: 1.9, name: 'Regulus' },
      { x: 38, y: 32, r: 1.5 },
      { x: 48, y: 22, r: 1.6 },
      { x: 58, y: 28, r: 1.4 },
      { x: 70, y: 38, r: 1.5 },
      { x: 78, y: 55, r: 1.7, name: 'Denebola' },
      { x: 55, y: 58, r: 1.4 },
      { x: 40, y: 55, r: 1.3 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]],
  },
  Gemini: {
    color: '#44ff88',
    stars: [
      { x: 32, y: 22, r: 2.0, name: 'Castor' },
      { x: 48, y: 28, r: 2.1, name: 'Pollux' },
      { x: 28, y: 45, r: 1.4 },
      { x: 52, y: 48, r: 1.4 },
      { x: 25, y: 68, r: 1.5 },
      { x: 55, y: 72, r: 1.5 },
      { x: 38, y: 58, r: 1.3 },
      { x: 68, y: 55, r: 1.3 },
    ],
    lines: [[0, 2], [0, 1], [1, 3], [2, 4], [3, 5], [2, 6], [3, 7]],
  },
  'Ursa Minor': {
    color: '#88ffff',
    stars: [
      { x: 55, y: 18, r: 2.2, name: 'Polaris' },
      { x: 48, y: 35, r: 1.4 },
      { x: 42, y: 52, r: 1.3 },
      { x: 38, y: 68, r: 1.5 },
      { x: 52, y: 78, r: 1.4 },
      { x: 68, y: 72, r: 1.4 },
      { x: 62, y: 55, r: 1.3 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2]],
  },
  // Fallback abstract radiant
  default: {
    color: '#93c5fd',
    stars: [
      { x: 50, y: 50, r: 2.4 },
      { x: 30, y: 35, r: 1.4 },
      { x: 70, y: 32, r: 1.3 },
      { x: 28, y: 68, r: 1.3 },
      { x: 72, y: 70, r: 1.4 },
      { x: 50, y: 22, r: 1.2 },
      { x: 50, y: 78, r: 1.2 },
    ],
    lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
  },
};

function resolvePattern(name: string): Pattern {
  if (PATTERNS[name]) return PATTERNS[name];
  // fuzzy
  const key = Object.keys(PATTERNS).find(k =>
    k !== 'default' && (name.includes(k) || k.includes(name))
  );
  return PATTERNS[key ?? 'default'];
}

interface Props {
  constellation: string;
  /** Compact for cards; full for detail pages */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
  /** Pulse a radiant glow at the center */
  radiant?: boolean;
}

export default function ConstellationMap({
  constellation,
  size = 'md',
  className = '',
  showLabel = true,
  radiant = true,
}: Props) {
  const pattern = useMemo(() => resolvePattern(constellation), [constellation]);
  const h = size === 'sm' ? 72 : size === 'lg' ? 160 : 110;

  return (
    <div
      className={`constellation-wrap relative overflow-hidden rounded-xl ${className}`}
      style={{
        height: h,
        background: 'radial-gradient(ellipse at 50% 45%, rgba(30,20,70,0.55) 0%, rgba(5,2,20,0.9) 70%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`rad-${constellation.replace(/\s/g, '')}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={pattern.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={pattern.color} stopOpacity="0" />
          </radialGradient>
          <filter id="starGlow">
            <feGaussianBlur stdDeviation="0.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient radiant wash */}
        {radiant && (
          <circle cx="50" cy="50" r="28" fill={`url(#rad-${constellation.replace(/\s/g, '')})`}>
            <animate attributeName="opacity" values="0.5;1;0.5" dur="3.5s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Connection lines */}
        {pattern.lines.map(([a, b], i) => {
          const s1 = pattern.stars[a];
          const s2 = pattern.stars[b];
          if (!s1 || !s2) return null;
          return (
            <line
              key={i}
              x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y}
              stroke={pattern.color}
              strokeWidth="0.45"
              strokeOpacity="0.45"
              strokeLinecap="round"
            >
              <animate
                attributeName="stroke-opacity"
                values="0.25;0.55;0.25"
                dur={`${3 + (i % 3) * 0.4}s`}
                begin={`${i * 0.15}s`}
                repeatCount="indefinite"
              />
            </line>
          );
        })}

        {/* Stars */}
        {pattern.stars.map((st, i) => (
          <g key={i} filter="url(#starGlow)">
            <circle
              cx={st.x}
              cy={st.y}
              r={st.r}
              fill={i === 0 ? '#fff' : pattern.color}
            >
              <animate
                attributeName="opacity"
                values="0.55;1;0.55"
                dur={`${2.2 + (i % 4) * 0.5}s`}
                begin={`${i * 0.2}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values={`${st.r};${st.r * 1.25};${st.r}`}
                dur={`${2.8 + (i % 3) * 0.4}s`}
                begin={`${i * 0.15}s`}
                repeatCount="indefinite"
              />
            </circle>
            {/* Cross flare on brightest */}
            {st.r >= 2 && (
              <>
                <line x1={st.x - st.r * 2.2} y1={st.y} x2={st.x + st.r * 2.2} y2={st.y}
                  stroke="#fff" strokeWidth="0.25" strokeOpacity="0.5" />
                <line x1={st.x} y1={st.y - st.r * 2.2} x2={st.x} y2={st.y + st.r * 2.2}
                  stroke="#fff" strokeWidth="0.25" strokeOpacity="0.5" />
              </>
            )}
          </g>
        ))}

        {/* Meteor streak accents */}
        <g opacity="0.7">
          <line x1="12" y1="18" x2="28" y2="32" stroke={pattern.color} strokeWidth="0.5" strokeLinecap="round">
            <animate attributeName="opacity" values="0;0.8;0" dur="4s" begin="0.5s" repeatCount="indefinite" />
          </line>
          <line x1="78" y1="20" x2="90" y2="30" stroke="#fff" strokeWidth="0.4" strokeLinecap="round">
            <animate attributeName="opacity" values="0;0.7;0" dur="5s" begin="2s" repeatCount="indefinite" />
          </line>
        </g>
      </svg>

      {showLabel && (
        <div className="absolute bottom-1.5 left-0 right-0 text-center pointer-events-none">
          <span
            className="text-[9px] font-mono uppercase tracking-[0.18em]"
            style={{ color: pattern.color, opacity: 0.75 }}
          >
            {constellation} radiant
          </span>
        </div>
      )}
    </div>
  );
}
