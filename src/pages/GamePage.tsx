import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gamepad2, Play, Pause, RotateCcw, Crosshair, Shield, Zap,
  Heart, Volume2, VolumeX, BookOpen, Rocket,
} from 'lucide-react';
import { VoidArmadaGame, type HudState, type GamePhase } from '../game/voidArmada';

/**
 * Stargaze Armada — 3D free-flight conquest
 * Inspired by high-end space battle demos: third-person flight,
 * living planets, capture orbits, capital fleets, full HUD.
 */

const emptyHud: HudState = {
  phase: 'title',
  hull: 100,
  shield: 100,
  energy: 100,
  velocity: 0,
  score: 0,
  wave: 1,
  kills: 0,
  objective: '',
  capturing: null,
  capturePct: 0,
  sectors: [],
  hostileAlert: null,
  message: null,
  joystick: null,
};

function Bar({
  value, max = 100, color, label,
}: { value: number; max?: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[9px] font-mono mb-0.5">
        <span className="text-white/40 tracking-wider">{label}</span>
        <span style={{ color }}>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

export default function GamePage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<VoidArmadaGame | null>(null);
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const game = new VoidArmadaGame(mountRef.current);
    game.start();
    gameRef.current = game;
    const off = game.onHud(setHud);
    setReady(true);
    return () => {
      off();
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    // sync mute — audio is on game instance
    // toggled via M key in engine; UI button flips local + re-reads
  }, [muted]);

  const launch = useCallback(() => {
    gameRef.current?.launch();
  }, []);

  const setPhase = useCallback((p: GamePhase) => {
    gameRef.current?.setPhase(p);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m;
      gameRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const phase = hud.phase;
  const showOverlay = phase === 'title' || phase === 'briefing' || phase === 'paused' || phase === 'victory' || phase === 'defeat';

  return (
    <>
      <title>Stargaze Armada — 3D Space Conquest | Stargaze</title>
      <meta name="description" content="Pilot a capital interceptor through asteroid fields, capture living worlds, and crush Dominion fleets in Stargaze Armada — free 3D space battle in the browser." />
      <link rel="canonical" href="https://stargaze.io/game" />

      <div className="fixed inset-0 z-[5] bg-black">
        {/* WebGL mount */}
        <div ref={mountRef} className="absolute inset-0" />

        {/* ── In-game chrome ─────────────────────────────────────────── */}
        {phase === 'playing' || phase === 'paused' ? (
          <div className="pointer-events-none absolute inset-0 z-10 select-none">
            {/* Top left — title + objective (desktop only) */}
            {!isMobile && (
              <div className="absolute top-4 left-4 max-w-xs">
                <div
                  className="px-3 py-2 rounded-lg mb-2"
                  style={{ background: 'rgba(5,10,25,0.72)', border: '1px solid rgba(100,160,255,0.2)' }}
                >
                  <p className="text-[10px] font-mono tracking-[0.25em] text-cyan-400/90">STARGAZE :: ARMADA</p>
                  <p className="text-[9px] font-mono text-white/35">FIGHTER · YOUR CRAFT</p>
                </div>
                <div
                  className="px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(5,10,25,0.65)', border: '1px solid rgba(100,160,255,0.15)' }}
                >
                  <p className="text-[8px] font-mono text-cyan-500/70 tracking-widest mb-1">PRIMARY OBJECTIVE</p>
                  <p className="text-[11px] text-white/70 leading-snug">{hud.objective}</p>
                </div>
              </div>
            )}

            {/* Top right — galactic map (desktop) / compact dots (mobile) */}
            {!isMobile ? (
              <div
                className="absolute top-4 right-4 w-52 rounded-lg p-3"
                style={{ background: 'rgba(5,10,25,0.75)', border: '1px solid rgba(100,160,255,0.2)' }}
              >
                <p className="text-[9px] font-mono tracking-[0.2em] text-cyan-400/80 mb-2">GALACTIC MAP</p>
                <div className="space-y-1">
                  {hud.sectors.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            background:
                              s.status === 'allied' ? '#4ade80'
                                : s.status === 'capturing' ? '#fbbf24'
                                  : s.status === 'hostile' ? '#f87171'
                                    : '#64748b',
                            boxShadow: s.status === 'capturing' ? '0 0 6px #fbbf24' : undefined,
                          }}
                        />
                        <span className={`truncate ${s.status === 'locked' ? 'text-white/25' : 'text-white/70'}`}>
                          {s.name}
                        </span>
                      </div>
                      <span className="text-white/30 text-[9px] flex-shrink-0">
                        {s.status === 'allied' ? 'ALLIED'
                          : s.status === 'capturing' ? `${s.capture | 0}%`
                            : s.status === 'hostile' ? 'HOSTILE'
                              : 'LOCKED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Mobile — compact sector dots top-right */
              <div
                className="absolute top-10 right-2 flex flex-col gap-1 p-2 rounded-lg"
                style={{ background: 'rgba(5,10,25,0.65)', border: '1px solid rgba(100,160,255,0.15)' }}
              >
                {hud.sectors.map(s => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background:
                          s.status === 'allied' ? '#4ade80'
                            : s.status === 'capturing' ? '#fbbf24'
                              : s.status === 'hostile' ? '#f87171'
                                : '#64748b',
                        boxShadow: s.status === 'capturing' ? '0 0 5px #fbbf24' : undefined,
                      }}
                    />
                    <span className="text-[8px] font-mono text-white/50 truncate max-w-[60px]">{s.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top center — score / wave / kills */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4">
              <div
                className="px-2 sm:px-3 py-1.5 rounded-lg text-center"
                style={{ background: 'rgba(5,10,25,0.7)', border: '1px solid rgba(100,160,255,0.15)' }}
              >
                <p className="text-[7px] sm:text-[8px] font-mono text-white/30">SCORE</p>
                <p className="text-xs sm:text-sm font-mono font-bold text-white/90 tabular-nums">{hud.score.toLocaleString()}</p>
              </div>
              <div
                className="px-2 sm:px-3 py-1.5 rounded-lg text-center"
                style={{ background: 'rgba(5,10,25,0.7)', border: '1px solid rgba(100,160,255,0.15)' }}
              >
                <p className="text-[7px] sm:text-[8px] font-mono text-white/30">WAVE</p>
                <p className="text-xs sm:text-sm font-mono font-bold text-cyan-300 tabular-nums">{hud.wave}</p>
              </div>
              <div
                className="px-2 sm:px-3 py-1.5 rounded-lg text-center"
                style={{ background: 'rgba(5,10,25,0.7)', border: '1px solid rgba(100,160,255,0.15)' }}
              >
                <p className="text-[7px] sm:text-[8px] font-mono text-white/30">KILLS</p>
                <p className="text-xs sm:text-sm font-mono font-bold text-orange-300 tabular-nums">{hud.kills}</p>
              </div>
            </div>

            {/* Vitals — bottom-left desktop, top-left mobile */}
            <div
              className={`absolute w-36 sm:w-44 rounded-lg p-2 sm:p-3 ${
                isMobile ? 'top-10 left-2' : 'bottom-6 left-4'
              }`}
              style={{ background: 'rgba(5,10,25,0.78)', border: '1px solid rgba(100,160,255,0.18)' }}
            >
              <Bar value={hud.hull} color="#f87171" label="HULL" />
              <Bar value={hud.shield} color="#38bdf8" label="SHIELD" />
              <Bar value={hud.energy} color="#a3e635" label="ENERGY" />
            </div>

            {/* Bottom center — ship tag + capture */}
            {!isMobile && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
                {hud.capturing && (
                  <div
                    className="mb-2 px-4 py-2 rounded-lg"
                    style={{ background: 'rgba(5,10,25,0.8)', border: '1px solid rgba(251,191,36,0.35)' }}
                  >
                    <p className="text-[9px] font-mono text-amber-400 tracking-widest mb-1">
                      CAPTURING {hud.capturing}
                    </p>
                    <div className="w-48 h-1.5 rounded-full overflow-hidden mx-auto" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width] duration-200"
                        style={{ width: `${hud.capturePct}%` }}
                      />
                    </div>
                  </div>
                )}
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
                  style={{ background: 'rgba(5,10,25,0.75)', border: '1px solid rgba(100,160,255,0.2)' }}
                >
                  <Crosshair size={12} className="text-cyan-400" />
                  <span className="text-[10px] font-mono text-white/70 tracking-wider">CAPITAL</span>
                  <span className="text-[10px] font-mono text-white/30">·</span>
                  <span className="text-[10px] font-mono text-cyan-300/80">VEL {hud.velocity}</span>
                </div>
              </div>
            )}

            {/* Mobile — capture bar above joystick */}
            {isMobile && hud.capturing && (
              <div
                className="absolute bottom-40 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg"
                style={{ background: 'rgba(5,10,25,0.8)', border: '1px solid rgba(251,191,36,0.35)' }}
              >
                <p className="text-[9px] font-mono text-amber-400 tracking-widest mb-1">
                  CAPTURING {hud.capturing}
                </p>
                <div className="w-40 h-1.5 rounded-full overflow-hidden mx-auto" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width] duration-200"
                    style={{ width: `${hud.capturePct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bottom right — controls (desktop) or hostile alert */}
            <div className="absolute bottom-6 right-4 space-y-2">
              {hud.hostileAlert && (
                <div
                  className="px-3 py-2 rounded-lg text-right"
                  style={{ background: 'rgba(40,5,10,0.85)', border: '1px solid rgba(248,113,113,0.4)' }}
                >
                  <p className="text-[9px] font-mono text-red-400 tracking-widest">⚠ HOSTILE CONTACT</p>
                  <p className="text-[10px] text-red-200/70">{hud.hostileAlert}</p>
                </div>
              )}
              {!isMobile && (
                <div
                  className="px-3 py-2 rounded-lg text-[9px] font-mono text-white/35 leading-relaxed"
                  style={{ background: 'rgba(5,10,25,0.7)', border: '1px solid rgba(100,160,255,0.12)' }}
                >
                  <div>WASD fly · mouse look</div>
                  <div>SHIFT boost · J/Z fire</div>
                  <div>R/F up/down · C cam · P pause</div>
                </div>
              )}
            </div>

            {/* ── Mobile touch controls ───────────────────────────────── */}
            {isMobile && (
              <>
                {/* Left joystick base + knob */}
                <div
                  className="absolute"
                  style={{ bottom: 32, left: 32, width: 120, height: 120 }}
                >
                  {/* Base ring */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: '2px solid rgba(56,189,248,0.35)',
                      background: 'rgba(5,10,25,0.45)',
                    }}
                  />
                  {/* Knob — moves with hud.joystick */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: 44,
                      height: 44,
                      top: '50%',
                      left: '50%',
                      transform: `translate(calc(-50% + ${(hud.joystick?.nx ?? 0) * 36}px), calc(-50% + ${(hud.joystick?.ny ?? 0) * 36}px))`,
                      background: 'rgba(56,189,248,0.55)',
                      border: '2px solid rgba(56,189,248,0.9)',
                      boxShadow: '0 0 12px rgba(56,189,248,0.4)',
                      transition: hud.joystick ? 'none' : 'transform 0.12s ease-out',
                    }}
                  />
                  {/* Direction arrows hint */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[16px] text-cyan-400/20 select-none">✛</span>
                  </div>
                </div>

                {/* Right fire button */}
                <div
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    bottom: 48,
                    right: 40,
                    width: 80,
                    height: 80,
                    background: 'rgba(248,113,113,0.2)',
                    border: '2px solid rgba(248,113,113,0.5)',
                    boxShadow: '0 0 16px rgba(248,113,113,0.2)',
                  }}
                >
                  <span className="text-[9px] font-mono text-red-300/80 tracking-widest">FIRE</span>
                </div>

                {/* Drag-to-aim hint label */}
                <div className="absolute" style={{ bottom: 148, right: 40 }}>
                  <p className="text-[8px] font-mono text-white/20 text-center tracking-wider">DRAG TO AIM</p>
                </div>
              </>
            )}

            {/* Floating message */}
            <AnimatePresence>
              {hud.message && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-1/3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-sm font-space font-semibold text-cyan-100"
                  style={{
                    background: 'rgba(10,20,50,0.85)',
                    border: '1px solid rgba(100,180,255,0.35)',
                    boxShadow: '0 0 30px rgba(56,189,248,0.2)',
                  }}
                >
                  {hud.message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Crosshair (desktop only — mobile uses drag aim) */}
            {!isMobile && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none opacity-50">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400/60" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400/60" />
                <div className="absolute inset-0 rounded-full border border-cyan-400/30" />
              </div>
            )}

            {/* Aim hint */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none">
              {isMobile ? (
                <p className="text-[9px] font-mono text-white/25 tracking-widest">
                  LEFT THUMB MOVE · RIGHT THUMB AIM · TAP RIGHT FIRE
                </p>
              ) : (
                <p className="text-[9px] font-mono text-white/25 tracking-widest">
                  CLICK CANVAS TO LOCK MOUSE AIM · ESC TO RELEASE
                </p>
              )}
            </div>

            {/* Pause button */}
            <button
              type="button"
              className="pointer-events-auto absolute top-20 right-4 p-2 rounded-lg text-white/50 hover:text-white transition-colors"
              style={{ background: 'rgba(5,10,25,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => setPhase(phase === 'paused' ? 'playing' : 'paused')}
              aria-label="Pause"
            >
              {phase === 'paused' ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
        ) : null}

        {/* ── Overlays: title / pause / end ──────────────────────────── */}
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              key={phase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center p-4"
              style={{
                background:
                  phase === 'title' || phase === 'briefing'
                    ? 'radial-gradient(ellipse at 50% 40%, rgba(10,20,50,0.45) 0%, rgba(0,0,0,0.72) 70%)'
                    : 'rgba(0,0,0,0.72)',
                backdropFilter: phase === 'paused' ? 'blur(6px)' : undefined,
              }}
            >
              {/* Title */}
              {(phase === 'title' || phase === 'briefing') && (
                <motion.div
                  initial={{ scale: 0.96, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-lg rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(160deg, rgba(12,18,40,0.95), rgba(5,8,20,0.97))',
                    border: '1px solid rgba(100,160,255,0.28)',
                    boxShadow: '0 0 60px rgba(56,189,248,0.12), 0 24px 80px rgba(0,0,0,0.5)',
                  }}
                >
                  <div className="absolute inset-0 pointer-events-none opacity-40"
                    style={{ background: 'radial-gradient(circle at 80% 0%, rgba(56,189,248,0.2), transparent 50%)' }} />

                  <p className="text-[10px] font-mono tracking-[0.35em] text-cyan-400/80 mb-2 relative">
                    3D GALACTIC CONQUEST · CAPITAL SHIPS · PORTALS
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold font-space relative mb-1"
                    style={{
                      background: 'linear-gradient(135deg, #e0f2fe, #38bdf8 40%, #818cf8)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    STARGAZE
                  </h1>
                  <h2 className="text-2xl sm:text-3xl font-bold font-space text-white/90 relative mb-4 tracking-wide">
                    ARMADA
                  </h2>
                  <p className="text-sm text-white/50 leading-relaxed max-w-md mx-auto mb-6 relative">
                    Pilot your interceptor through asteroid fields, gravity wells, and Dominion fleets.
                    Hold orbit, capture worlds, and conquer the sector.
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-6 text-left relative">
                    {[
                      { t: '3D Free Flight', d: 'Full chase-cam combat with boost & dual cannons' },
                      { t: 'Living Worlds', d: 'Planets, rings, ice giants — claim each zone' },
                      { t: 'Fleet Warfare', d: 'Fighters, capitals, lasers, asteroid belts' },
                      { t: 'Conquest', d: 'Clear hostiles, hold orbit, own the galaxy map' },
                    ].map(c => (
                      <div key={c.t} className="p-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] font-mono text-cyan-400/80 mb-0.5">{c.t}</p>
                        <p className="text-[10px] text-white/40 leading-snug">{c.d}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center relative">
                    <button type="button" onClick={launch} className="btn-primary text-sm px-8 py-3">
                      <Rocket size={15} /> Launch
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhase('briefing')}
                      className="btn-secondary text-sm px-6 py-3"
                    >
                      <BookOpen size={14} /> Briefing
                    </button>
                  </div>

                  {phase === 'briefing' && (
                    <div className="mt-5 text-left text-[11px] text-white/45 leading-relaxed space-y-1.5 relative border-t border-white/10 pt-4">
                      <p><span className="text-cyan-400/80 font-mono">WASD</span> — thrust · <span className="text-cyan-400/80 font-mono">Mouse</span> — look (click to lock)</p>
                      <p><span className="text-cyan-400/80 font-mono">SHIFT</span> — boost · <span className="text-cyan-400/80 font-mono">J / Z / click</span> — fire</p>
                      <p><span className="text-cyan-400/80 font-mono">R / F</span> — rise / descend · <span className="text-cyan-400/80 font-mono">C</span> — camera · <span className="text-cyan-400/80 font-mono">P</span> — pause</p>
                      <p className="text-white/30 pt-1">Destroy red hostiles near a world, then hold close orbit to capture it on the Galactic Map.</p>
                      <button type="button" onClick={launch} className="btn-primary text-xs mt-2">
                        Ready — Launch
                      </button>
                    </div>
                  )}

                  <p className="mt-5 text-[9px] font-mono text-white/20 relative">
                    Free browser 3D · high score in this session · press M to mute
                  </p>
                </motion.div>
              )}

              {/* Paused */}
              {phase === 'paused' && (
                <div className="text-center">
                  <Pause size={32} className="text-white/40 mx-auto mb-3" />
                  <h2 className="text-2xl font-bold font-space mb-4">Paused</h2>
                  <div className="flex gap-3 justify-center">
                    <button type="button" onClick={() => setPhase('playing')} className="btn-primary text-sm">
                      <Play size={14} /> Resume
                    </button>
                    <button type="button" onClick={launch} className="btn-secondary text-sm">
                      <RotateCcw size={14} /> Restart
                    </button>
                  </div>
                </div>
              )}

              {/* Victory */}
              {phase === 'victory' && (
                <div
                  className="max-w-md w-full rounded-2xl p-8 text-center"
                  style={{ background: 'rgba(5,20,15,0.95)', border: '1px solid rgba(74,222,128,0.35)' }}
                >
                  <p className="text-xs font-mono text-green-400 tracking-widest mb-2">SECTOR SECURED</p>
                  <h2 className="text-3xl font-bold font-space mb-2">Galaxy Conquered</h2>
                  <p className="text-4xl font-mono font-bold text-green-300 mb-1">{hud.score.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mb-6">{hud.kills} kills · all worlds allied</p>
                  <button type="button" onClick={launch} className="btn-primary">
                    <RotateCcw size={14} /> Play again
                  </button>
                </div>
              )}

              {/* Defeat */}
              {phase === 'defeat' && (
                <div
                  className="max-w-md w-full rounded-2xl p-8 text-center"
                  style={{ background: 'rgba(25,5,10,0.95)', border: '1px solid rgba(248,113,113,0.35)' }}
                >
                  <p className="text-xs font-mono text-red-400 tracking-widest mb-2">HULL CRITICAL</p>
                  <h2 className="text-3xl font-bold font-space mb-2">Ship Destroyed</h2>
                  <p className="text-4xl font-mono font-bold text-white/90 mb-1">{hud.score.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mb-6">Wave {hud.wave} · {hud.kills} kills</p>
                  <button type="button" onClick={launch} className="btn-primary">
                    <RotateCcw size={14} /> Re-deploy
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top nav escape — back to site */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 pointer-events-none">
          <a
            href="/"
            className="pointer-events-auto text-[10px] font-mono text-white/35 hover:text-white/70 transition-colors px-2 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.35)' }}
          >
            ← Stargaze
          </a>
          <button
            type="button"
            onClick={toggleMute}
            className="pointer-events-auto p-1.5 rounded text-white/40 hover:text-white/80"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        {!ready && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-mono text-white/40">Initializing Armada…</p>
            </div>
          </div>
        )}
      </div>

      {/* Spacer for document flow / footer */}
      <div className="h-screen w-full" aria-hidden="true" />
    </>
  );
}
