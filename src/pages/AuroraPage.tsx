import React from 'react';
import { motion } from 'motion/react';
import { Sun, ExternalLink, Zap, Wind, AlertTriangle } from 'lucide-react';
import { useSpaceData, flareClass, SolarFlare, CMEEvent } from '../hooks/useSpaceData';

export default function AuroraPage() {
  const { kpNow, kpHistory, kpLabel, kpColor, kpStatus, auroraLat, flares, cmes, loading } = useSpaceData();

  const latZones = [
    { lat: '65°+ N', kpMin: 0,  color: '#4ade80', desc: 'Always possible on clear nights' },
    { lat: '60°+ N', kpMin: 2,  color: '#86efac', desc: 'Faint arcs with Kp ≥ 2' },
    { lat: '55°+ N', kpMin: 4,  color: '#fbbf24', desc: 'Visible with Kp ≥ 4' },
    { lat: '50°+ N', kpMin: 5,  color: '#f97316', desc: 'G1 storm required (Kp ≥ 5)' },
    { lat: '45°+ N', kpMin: 6,  color: '#ef4444', desc: 'G2 storm required (Kp ≥ 6)' },
    { lat: '40°+ N', kpMin: 7,  color: '#dc2626', desc: 'G3+ storm required (Kp ≥ 7)' },
  ];

  return (
    <>
      <title>Aurora Forecast &amp; Solar Weather | Real-Time Kp Index | Stargaze</title>
      <meta name="description" content="Live aurora borealis and australis forecast. Real-time NOAA Kp index, solar flare alerts from NASA DONKI, CME tracking, and visibility by latitude." />
      <link rel="canonical" href="https://stargaze.io/aurora" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">

      {/* Header */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
          style={{ background:`${kpColor}10`, border:`1px solid ${kpColor}30` }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: kpColor }} />
          <span className="text-xs font-mono tracking-wider" style={{ color: kpColor }}>LIVE NOAA DATA · UPDATES EVERY 5 MIN</span>
        </div>
        <h1 className="hero-title hero-gradient-text mb-4">Aurora Forecast</h1>
        <p className="text-white/50 max-w-xl mx-auto text-base leading-relaxed">
          Real-time geomagnetic conditions, solar flare alerts, CME tracking, and aurora visibility forecasts — powered by NOAA and NASA DONKI.
        </p>
      </motion.div>

      {/* Kp + oval grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

        {/* Current Kp Big Card */}
        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.1 }}
          className="lg:col-span-2 glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background:`radial-gradient(ellipse at top right, ${kpColor}0d 0%, transparent 60%)` }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs font-mono text-white/35 uppercase tracking-widest mb-1">Planetary Kp Index</p>
                <div className="flex items-end gap-3">
                  <p className="text-6xl font-bold font-space" style={{ color: kpColor }}>
                    {kpNow !== null ? kpNow.toFixed(1) : '—'}
                  </p>
                  <div className="mb-2">
                    <p className="text-sm font-bold" style={{ color: kpColor }}>{kpLabel}</p>
                    <p className="text-xs text-white/40">NOAA / SWPC</p>
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background:`${kpColor}15`, border:`1px solid ${kpColor}30` }}>
                <Sun size={22} style={{ color: kpColor }} />
              </div>
            </div>

            {/* Kp bar */}
            <div className="mb-5">
              <div className="flex justify-between text-[9px] text-white/30 font-mono mb-1.5">
                {['0','1','2','3','4','5','6','7','8','9'].map(n => <span key={n}>{n}</span>)}
              </div>
              <div className="relative h-6 rounded-full overflow-hidden"
                style={{ background:'linear-gradient(to right,#4ade80 0%,#a3e635 22%,#fbbf24 40%,#f97316 55%,#ef4444 68%,#dc2626 100%)' }}>
                <div className="absolute inset-y-0 right-0 rounded-r-full"
                  style={{ width:`${100 - ((kpNow ?? 0) / 9) * 100}%`, background:'rgba(2,0,20,0.72)' }} />
                {kpNow !== null && (
                  <div className="absolute top-1/2 w-5 h-5 rounded-full border-2 border-white z-10"
                    style={{ left:`${(kpNow / 9) * 100}%`, transform:'translate(-50%,-50%)', background: kpColor, boxShadow:`0 0 12px ${kpColor}` }} />
                )}
              </div>
              <div className="flex justify-between text-[9px] text-white/20 font-mono mt-1">
                <span>Quiet</span><span>Unsettled</span><span>Active</span><span>G1</span><span>G2</span><span>G3+</span>
              </div>
            </div>

            {/* 72h sparkline */}
            {kpHistory.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2">
                  72-Hour Kp History ({kpHistory.length} readings)
                </p>
                <div className="flex gap-0.5 h-14 items-end">
                  {kpHistory.map((pt, i) => {
                    const barColor = pt.kp < 3 ? '#4ade80' : pt.kp < 5 ? '#fbbf24' : '#ef4444';
                    const title = `Kp ${pt.kp.toFixed(1)} — ${new Date(pt.time).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
                    return (
                      <div key={i} title={title} className="flex-1 rounded-sm min-h-[3px] cursor-pointer hover:opacity-100 transition-opacity"
                        style={{ height:`${Math.max(6,(pt.kp/9)*100)}%`, background: barColor, opacity: 0.45 + (i/kpHistory.length)*0.55 }} />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Aurora visibility message */}
            <div className="p-3.5 rounded-xl" style={{ background:`${kpColor}0d`, border:`1px solid ${kpColor}25` }}>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0 animate-pulse" style={{ background: kpColor }} />
                <div>
                  <p className="text-sm font-semibold text-white/85 mb-0.5">{auroraLat || 'Connecting to NOAA…'}</p>
                  {kpNow !== null && kpNow >= 5 && (
                    <p className="text-xs text-orange-300 font-medium">
                      🌌 Active geomagnetic storm — aurora possible further south than usual. Go outside now if you're at high latitudes!
                    </p>
                  )}
                  {kpNow !== null && kpNow < 3 && (
                    <p className="text-xs text-white/40">Quiet conditions. Best chance of aurora is at high northern latitudes (60°+) on a clear, dark night.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Latitude Visibility Guide */}
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.15 }}
          className="glass-card p-5 rounded-2xl">
          <p className="text-xs font-mono text-white/35 uppercase tracking-widest mb-4">Aurora Visibility by Latitude</p>
          <div className="space-y-2.5">
            {latZones.map(z => {
              const active = (kpNow ?? 0) >= z.kpMin;
              return (
                <div key={z.lat} className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                  style={{ background: active ? `${z.color}10` : 'rgba(255,255,255,0.03)', border: active ? `1px solid ${z.color}30` : '1px solid transparent' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? z.color : 'rgba(255,255,255,0.15)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold" style={{ color: active ? z.color : 'rgba(255,255,255,0.4)' }}>{z.lat}</p>
                      <p className="text-[9px] font-mono text-white/25">Kp≥{z.kpMin}</p>
                    </div>
                    <p className="text-[10px] text-white/35 leading-tight mt-0.5">{z.desc}</p>
                  </div>
                  {active && <div className="text-xs">✓</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-[10px] text-white/30 leading-relaxed">
              Southern Hemisphere: reverse latitudes apply. S. Tasmania, New Zealand, Patagonia visible at Kp≥5+.
            </p>
          </div>
        </motion.div>
      </div>

      {/* NOAA Aurora Oval */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
        className="glass-card p-5 rounded-2xl mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-white/35 uppercase tracking-widest mb-1">Live Aurora Oval</p>
            <h2 className="text-base font-bold font-space">NOAA 30-Minute Forecast</h2>
          </div>
          <a href="https://www.swpc.noaa.gov/products/aurora-30-minute-forecast" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            NOAA <ExternalLink size={11} />
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label:'Northern Hemisphere', url:'https://services.swpc.noaa.gov/images/aurora-forecast-north.png' },
            { label:'Southern Hemisphere', url:'https://services.swpc.noaa.gov/images/aurora-forecast-south.png' },
          ].map(({ label, url }) => (
            <div key={label}>
              <p className="text-[10px] text-white/35 font-mono mb-2">{label}</p>
              <div className="rounded-xl overflow-hidden" style={{ background:'rgba(0,0,0,0.4)' }}>
                <img src={url} alt={`Aurora oval — ${label}`}
                  className="w-full object-contain"
                  style={{ maxHeight: 320 }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity='0.2'; }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/25 mt-3">Images update every 5 minutes from NOAA Space Weather Prediction Center. Green = aurora oval extent at current Kp.</p>
      </motion.div>

      {/* Solar Flares + CMEs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

        {/* Solar Flares */}
        <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}
          className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Zap size={12} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-space">Solar Flares</h2>
              <p className="text-[10px] text-white/30 font-mono">NASA DONKI · Past 7 days</p>
            </div>
          </div>
          {flares.length === 0 ? (
            <div className="py-8 text-center">
              <Zap size={24} className="text-yellow-400/20 mx-auto mb-2" />
              <p className="text-xs text-white/30">{loading ? 'Loading solar activity…' : 'No flares reported in past 7 days'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {flares.slice(0, 8).map((f: SolarFlare) => {
                const { color, label } = flareClass(f.classType);
                const t = new Date(f.peakTime || f.beginTime);
                return (
                  <div key={f.flrID} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background:'rgba(255,255,255,0.03)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold font-space"
                      style={{ background:`${color}15`, border:`1px solid ${color}30`, color }}>
                      {f.classType}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
                      <p className="text-[10px] text-white/30 font-mono">
                        {t.toLocaleDateString('en-US',{month:'short',day:'numeric'})} {t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})} UTC
                        {f.sourceLocation ? ` · ${f.sourceLocation}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* CMEs */}
        <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
          className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Wind size={12} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-space">Coronal Mass Ejections</h2>
              <p className="text-[10px] text-white/30 font-mono">NASA DONKI · Past 7 days</p>
            </div>
          </div>
          {cmes.length === 0 ? (
            <div className="py-8 text-center">
              <Wind size={24} className="text-orange-400/20 mx-auto mb-2" />
              <p className="text-xs text-white/30">{loading ? 'Loading CME data…' : 'No CMEs reported in past 7 days'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cmes.slice(0, 8).map((cme: CMEEvent) => {
                const t = new Date(cme.startTime);
                const analysis = cme.cmeAnalyses?.[0];
                const speed = analysis?.speed ? `${Math.round(analysis.speed)} km/s` : 'Speed unknown';
                const type  = analysis?.type ?? 'C';
                const isEarth = type === 'C';
                return (
                  <div key={cme.activityID} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background:'rgba(255,255,255,0.03)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background:'rgba(251,146,60,0.10)', border:'1px solid rgba(251,146,60,0.22)' }}>
                      {isEarth ? '🌍' : '💨'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/80">{speed}{isEarth ? ' · Earth-directed' : ''}</p>
                      <p className="text-[10px] text-white/30 font-mono">
                        {t.toLocaleDateString('en-US',{month:'short',day:'numeric'})} {t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})} UTC
                      </p>
                    </div>
                    {isEarth && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background:'rgba(251,146,60,0.15)', color:'#fb923c' }}>EARTH</span>}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Tips */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
        className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-blue-400" />
          <h2 className="text-sm font-bold font-space">Aurora Photography Tips</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { tip:'Dark location', detail:'At least 30 min from city lights. Check light pollution maps beforehand.' },
            { tip:'Watch NOAA alerts', detail:'Sign up for NOAA space weather alerts. Storms can develop within hours.' },
            { tip:'Camera settings', detail:'ISO 1600–6400, f/2.8, 10-25 second exposure. Wider lens = more sky.' },
            { tip:'Face north (or south)', detail:'In Northern Hemisphere look north. Southern Hemisphere look south. Aurora often starts as a faint arc.' },
          ].map(({ tip, detail }) => (
            <div key={tip} className="p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.03)' }}>
              <p className="text-xs font-bold text-white/80 mb-1">{tip}</p>
              <p className="text-[10px] text-white/40 leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label:'NOAA Space Weather', url:'https://www.swpc.noaa.gov/' },
            { label:'3-Day Geomagnetic Forecast', url:'https://www.swpc.noaa.gov/products/3-day-forecast' },
            { label:'DONKI Solar Events', url:'https://kauai.ccmc.gsfc.nasa.gov/DONKI/' },
            { label:'SpaceWeatherLive', url:'https://www.spaceweatherlive.com/en/auroras.html' },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-blue-400/70 hover:text-blue-300 transition-colors font-mono">
              {label} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      </motion.div>
    </div>
    </>
  );
}
