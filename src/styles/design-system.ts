/* ═══════════════════════════════════════════════════════════════════
   STARGAZE DESIGN SYSTEM
   Single source of truth for colour, type, motion and glow tokens.
   CSS counterparts live in src/index.css (@theme + utility classes).
   ═══════════════════════════════════════════════════════════════════ */

/** Opacity steps 10..100 for a hex colour. */
export type OpacityScale = {
  [K in 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100]: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Build rgba() strings at 10% steps from a hex colour. */
export function alphaScale(hex: string): OpacityScale {
  const [r, g, b] = hexToRgb(hex);
  const scale = {} as OpacityScale;
  for (let i = 1; i <= 10; i++) {
    scale[(i * 10) as keyof OpacityScale] = `rgba(${r}, ${g}, ${b}, ${i / 10})`;
  }
  return scale;
}

/** rgba() at an arbitrary alpha for one-off uses. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ─── Colour palette ────────────────────────────────────────────── */

export const palette = {
  /** Deep space page background */
  space: '#030014',
  /** Nebula purple — surfaces, gradients */
  nebula: '#1a0533',
  /** Star white — primary text */
  star: '#f0f4ff',
  /** Plasma cyan — navigation, interactive glow */
  plasma: '#00d4ff',
  /** Aurora green — success, live states */
  aurora: '#00ff88',
  /** Warning amber — alerts */
  amber: '#ffb700',
  /** Danger red — errors, destructive */
  danger: '#ff3366',
} as const;

export type PaletteKey = keyof typeof palette;

/** Every palette colour with 10 opacity steps, e.g. colors.plasma[40]. */
export const colors = Object.fromEntries(
  (Object.keys(palette) as PaletteKey[]).map(k => [k, alphaScale(palette[k])]),
) as Record<PaletteKey, OpacityScale>;

/* ─── Typography ────────────────────────────────────────────────── */

export const fonts = {
  /** Headings, UI labels */
  display: "'Space Grotesk', sans-serif",
  /** Data readouts, coordinates, countdowns */
  mono: "'JetBrains Mono', monospace",
  /** Body copy */
  sans: "'Inter', sans-serif",
} as const;

/** Fluid type scale (clamp min, preferred vw, max). */
export const typeScale = {
  xs: 'clamp(0.69rem, 0.65rem + 0.2vw, 0.78rem)',
  sm: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.92rem)',
  base: 'clamp(0.95rem, 0.88rem + 0.35vw, 1.08rem)',
  lg: 'clamp(1.12rem, 1rem + 0.6vw, 1.35rem)',
  xl: 'clamp(1.35rem, 1.15rem + 1vw, 1.75rem)',
  '2xl': 'clamp(1.7rem, 1.35rem + 1.75vw, 2.4rem)',
  '3xl': 'clamp(2.2rem, 1.6rem + 3vw, 3.4rem)',
  hero: 'clamp(2.8rem, 1.5rem + 6.5vw, 7rem)',
} as const;

/* ─── Glass morphism tiers ──────────────────────────────────────── */
/* Matching CSS classes: .glass-subtle / .glass-mid / .glass-strong */

export const glass = {
  subtle: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  mid: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  strong: {
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.20)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  },
} as const;

/* ─── Motion presets (motion/react) ─────────────────────────────── */

export const springSnappy = { type: 'spring', stiffness: 400, damping: 30 } as const;
export const springGentle = { type: 'spring', stiffness: 120, damping: 20 } as const;

/** Standard entrance: fade + rise. Use with motion variants. */
export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
} as const;

/** Stagger container for lists/grids of fadeUp children. */
export const staggerContainer = (stagger = 0.08, delay = 0) => ({
  animate: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const fadeUpVariant = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
} as const;

/* ─── Glow system ───────────────────────────────────────────────── */
/* Navigation → plasma cyan · alerts → amber · success → aurora green */

export const glow = {
  nav: `0 0 16px ${withAlpha(palette.plasma, 0.35)}, 0 0 40px ${withAlpha(palette.plasma, 0.12)}`,
  alert: `0 0 16px ${withAlpha(palette.amber, 0.35)}, 0 0 40px ${withAlpha(palette.amber, 0.12)}`,
  success: `0 0 16px ${withAlpha(palette.aurora, 0.35)}, 0 0 40px ${withAlpha(palette.aurora, 0.12)}`,
  danger: `0 0 16px ${withAlpha(palette.danger, 0.35)}, 0 0 40px ${withAlpha(palette.danger, 0.12)}`,
} as const;

/** Text glow for headings / readouts. */
export const textGlow = (key: PaletteKey, strength = 0.5): string =>
  `0 0 20px ${withAlpha(palette[key], strength)}, 0 0 40px ${withAlpha(palette[key], strength / 2)}`;

const designSystem = { palette, colors, fonts, typeScale, glass, springSnappy, springGentle, fadeUp, fadeUpVariant, staggerContainer, glow, textGlow, withAlpha, alphaScale };
export default designSystem;
