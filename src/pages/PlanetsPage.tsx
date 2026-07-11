import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Eye, Sun } from 'lucide-react';
import { getPlanets, PlanetInfo } from '../utils/planets';

const VIS_ICON: Record<PlanetInfo['visibility'], string> = {
  evening: '🌅',
  morning: '🌄',
  night:   '🌙',
  hidden:  '🚫',
};
const VIS_COLOR: Record<PlanetInfo['visibility'], string> = {
  evening: '#fbbf24',
  morning: '#f472b6',
  night:   '#818cf8',
  hidden:  'rgba(255,255,255,0.2)',
};

const TIPS: Record<string, string> = {
  Mercury: 'Nearest planet to the Sun — only briefly visible near the horizon after sunset or before sunrise. Binoculars help.',
  Venus:   'Brightest object in the sky after the Sun and Moon. Often called the Morning Star or Evening Star. Hard to miss.',
  Mars:    'Recognisable by its reddish-orange colour. Best when near opposition (closest to Earth).',
  Jupiter: 'Largest planet and third-brightest after Venus. Easy with the naked eye. Binoculars reveal the 4 Galilean moons.',
  Saturn:  'Rings visible through even a small telescope. Steady yellowish-white colour, no twinkling.',
  Uranus:  'At magnitude ~5.7, barely visible to the naked eye in dark skies. Binoculars recommended.',
};

export default function PlanetsPage() {
  const planets = useMemo(() => getPlanets(), []);

  const visibleCount = planets.filter(p => p.visibility !== 'hidden').length;

  return (
    <>
      <title>Planet Visibility Tonight | Planets in the Night Sky | Stargaze</title>
      <meta name="description" content="See which planets are visible tonight. Real-time positions for Mercury, Venus, Mars, Jupiter, Saturn and Uranus — morning sky, evening sky, or all night." />
      <link rel="canonical" href="https://stargaze.io/planets" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">

      {/* Header */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-12 relative">
        <div className="hero-orb hero-orb-purple" style={{ top: -20, left: '40%', opacity: 0.4 }} aria-hidden="true" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
            style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 24px rgba(139,92,246,0.12)' }}>
            <Eye size={12} className="text-purple-400" />
            <span className="text-xs font-mono text-purple-300/80 tracking-wider">
              {visibleCount} PLANET{visibleCount !== 1 ? 'S' : ''} VISIBLE TONIGHT
            </span>
          </div>
          <h1 className="hero-title hero-gradient-text mb-4">Planets Tonight</h1>
          <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
            Approximate positions computed from orbital mechanics. Visibility depends on your local horizon, atmosphere, and light pollution.
          </p>
        </div>
      </motion.div>

      {/* Quick summary strip */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {planets.filter(p => p.visibility !== 'hidden').map(p => (
          <div key={p.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono"
            style={{ background:`${VIS_COLOR[p.visibility]}12`, border:`1px solid ${VIS_COLOR[p.visibility]}30`, color: VIS_COLOR[p.visibility] }}>
            <span>{p.symbol}</span>
            <span>{p.name}</span>
            <span className="text-white/30">·</span>
            <span>{VIS_ICON[p.visibility]} {p.visibility}</span>
          </div>
        ))}
        {planets.filter(p => p.visibility === 'hidden').map(p => (
          <div key={p.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono"
            style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.25)' }}>
            <span>{p.symbol}</span>
            <span>{p.name}</span>
            <span>· {VIS_ICON.hidden}</span>
          </div>
        ))}
      </div>

      {/* Planet cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {planets.map((p, i) => {
          const visColor = VIS_COLOR[p.visibility];
          const isVisible = p.visibility !== 'hidden';
          return (
            <motion.div key={p.name}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}
              className="glass-card p-5 rounded-2xl relative overflow-hidden"
              style={{ borderTop: isVisible ? `2px solid ${visColor}50` : undefined, opacity: isVisible ? 1 : 0.65 }}>
              {/* Background tint */}
              {isVisible && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background:`radial-gradient(ellipse at top left, ${visColor}07 0%, transparent 60%)` }} />
              )}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="planet-orb" style={{
                      width: 48, height: 48, fontSize: 22,
                      ['--planet-glow' as string]: p.color,
                      background: `radial-gradient(circle at 32% 28%, ${p.color}99, ${p.color}44 55%, rgba(0,0,0,0.5))`,
                    }}>
                      <span>{p.symbol}</span>
                    </div>
                    <div>
                      <h2 className="text-base font-bold font-space">{p.name}</h2>
                      <p className="text-[10px] font-mono text-white/30">{p.approxMag !== undefined ? `Mag ${p.approxMag > 0 ? '+' : ''}${p.approxMag}` : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg">{VIS_ICON[p.visibility]}</span>
                  </div>
                </div>

                {/* Visibility status */}
                <div className="px-3 py-2 rounded-xl mb-3" style={{ background:`${visColor}10`, border:`1px solid ${visColor}20` }}>
                  <p className="text-xs font-semibold" style={{ color: visColor }}>{p.description}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg text-center" style={{ background:'rgba(255,255,255,0.03)' }}>
                    <p className="text-sm font-bold text-white/85">{p.elongation}°</p>
                    <p className="text-[9px] text-white/30 font-mono">from Sun</p>
                  </div>
                  <div className="p-2 rounded-lg text-center" style={{ background:'rgba(255,255,255,0.03)' }}>
                    <p className="text-sm font-bold text-white/85">{p.direction === 'east' ? 'East' : 'West'}</p>
                    <p className="text-[9px] text-white/30 font-mono">of Sun</p>
                  </div>
                </div>

                {/* Tip */}
                {TIPS[p.name] && (
                  <p className="text-[10px] text-white/35 leading-relaxed mt-3">{TIPS[p.name]}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Elongation diagram */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4 }}
        className="glass-card p-6 rounded-2xl mb-10">
        <h2 className="text-sm font-bold font-space mb-4">Current Elongations from the Sun</h2>
        <div className="space-y-3">
          {planets.map(p => {
            const pct = Math.min(100, (p.elongation / 180) * 100);
            return (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-16 text-right">
                  <span className="text-xs font-mono text-white/50">{p.symbol} {p.name.slice(0,3)}</span>
                </div>
                <div className="score-bar flex-1" style={{ height: 10 }}>
                  <div className="score-bar-fill"
                    style={{ width:`${pct}%`, background: `linear-gradient(90deg, ${p.color || VIS_COLOR[p.visibility]}aa, ${p.color || VIS_COLOR[p.visibility]})` }} />
                </div>
                <div className="w-12 text-xs font-mono" style={{ color: p.color || VIS_COLOR[p.visibility] }}>
                  {p.elongation}°
                </div>
                <div className="w-20 text-[10px] font-mono text-white/30 hidden sm:block">
                  {p.elongation < 15 ? 'too close' : p.direction === 'east' ? 'eve. sky' : 'morn. sky'}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-white/20 font-mono mt-3">
          <span>0° — behind Sun</span>
          <span>90° — quarter</span>
          <span>180° — opposition</span>
        </div>
      </motion.div>

      {/* Note + external links */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.45 }}
        className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 rounded-xl"
        style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[10px] text-white/30 font-mono">
          Positions computed from simplified Keplerian elements (Schlyter). Accuracy ≈ 1° for dates 1990–2030. Enough for naked-eye planning.
        </p>
        <div className="flex gap-3">
          {[
            { label:'Stellarium Web', url:'https://stellarium-web.org/' },
            { label:'SkySafari', url:'https://skysafariastronomy.com/' },
            { label:'JPL Horizons', url:'https://ssd.jpl.nasa.gov/horizons/' },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-300 transition-colors font-mono">
              {label} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      </motion.div>
    </div>
    </>
  );
}
