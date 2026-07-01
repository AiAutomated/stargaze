import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import {
  Sparkles, Star, Globe, Radio, Info, Menu, X,
  ChevronRight, ChevronDown, ArrowRight, Clock, Calendar, MapPin,
  Eye, Zap, Activity, Bell, BellOff, Send, Shield, FileText,
  RefreshCw, AlertTriangle, CheckCircle, ExternalLink, Rocket, Moon,
  Cloud, Wind, BarChart2, Users, MessageSquare, Plus, Search,
  Filter, TrendingUp, Navigation, Compass, Gauge, ShoppingBag, BellRing,
  Sun, Flame, Camera, Globe2, Triangle, Newspaper, Settings, Orbit
} from 'lucide-react';
import { useSpaceData, auToLD, asteroidSize, fireballEnergy } from './hooks/useSpaceData';
import { getPlanets } from './utils/planets';
import meteorShowers from './data/meteorShowers.json';

// ─── Lazy-load heavy components ───────────────────────────────────────────────
const CesiumGlobe       = lazy(() => import('./components/CesiumGlobe'));
const SolarSystemViewer = lazy(() => import('./components/SolarSystemViewer'));
const SkyView           = lazy(() => import('./components/SkyView'));

// ─── Lazy-load new page components ───────────────────────────────────────────
const AuroraPage   = lazy(() => import('./pages/AuroraPage'));
const PlanetsPage  = lazy(() => import('./pages/PlanetsPage'));
const NewsPage     = lazy(() => import('./pages/NewsPage'));
const ISSPage      = lazy(() => import('./pages/ISSPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Suspense fallback
function PageLoader() {
  return (
    <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/30 text-xs font-mono">Loading…</p>
      </div>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface MeteorShower {
  id: string;
  name: string;
  peak: string;
  start: string;
  end: string;
  zhr: number;
  parent: string;
  constellation: string;
  description: string;
  orbitalPeriod?: string;
  composition?: string;
  historicalStorms?: string;
  historicalVisibility?: string;
  speed?: number;
  viewingTips?: string;
}

interface SightingReport {
  id: string;
  time: string;
  location: string;
  magnitude: string;
  duration: string;
  type: 'meteor' | 'fireball' | 'bolide';
  verified: boolean;
  timestamp: number;
}

interface WatchedShower { id: string; name: string; watchedAt: number; }
interface Notification { id: string; title: string; message: string; type: 'info' | 'success' | 'warning'; timestamp: number; }

const showers = meteorShowers as MeteorShower[];

// ─── Utilities ────────────────────────────────────────────────────────────────
function getShowerStatus(shower: MeteorShower): 'active' | 'upcoming' | 'past' {
  const now = new Date();
  const start = new Date(shower.start);
  const end = new Date(shower.end);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'past';
}

function getDaysUntilPeak(shower: MeteorShower): number {
  return Math.ceil((new Date(shower.peak).getTime() - Date.now()) / 86400000);
}

function getNextShower(): MeteorShower | null {
  const now = new Date();
  return showers
    .filter(s => new Date(s.peak) > now)
    .sort((a, b) => new Date(a.peak).getTime() - new Date(b.peak).getTime())[0] || null;
}

function getMoonPhase(): { phase: string; illumination: number; emoji: string } {
  const known = new Date('2000-01-06T18:14:00Z');
  const now = new Date();
  const diff = (now.getTime() - known.getTime()) / 86400000;
  const cycle = 29.53058770576;
  const pos = ((diff % cycle) + cycle) % cycle;
  const illum = Math.round((1 - Math.abs(pos - cycle / 2) / (cycle / 2)) * 100);
  let phase = 'New Moon', emoji = '🌑';
  if (pos < 1.85)       { phase = 'New Moon';        emoji = '🌑'; }
  else if (pos < 7.38)  { phase = 'Waxing Crescent'; emoji = '🌒'; }
  else if (pos < 9.22)  { phase = 'First Quarter';   emoji = '🌓'; }
  else if (pos < 14.77) { phase = 'Waxing Gibbous';  emoji = '🌔'; }
  else if (pos < 16.61) { phase = 'Full Moon';        emoji = '🌕'; }
  else if (pos < 22.15) { phase = 'Waning Gibbous';  emoji = '🌖'; }
  else if (pos < 23.99) { phase = 'Last Quarter';    emoji = '🌗'; }
  else                  { phase = 'Waning Crescent';  emoji = '🌘'; }
  return { phase, illumination: illum, emoji };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCountdown(ms: number): { days: string; hours: string; mins: string; secs: string } {
  if (ms <= 0) return { days: '00', hours: '00', mins: '00', secs: '00' };
  const s = Math.floor(ms / 1000);
  return {
    days:  String(Math.floor(s / 86400)).padStart(2, '0'),
    hours: String(Math.floor((s % 86400) / 3600)).padStart(2, '0'),
    mins:  String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    secs:  String(s % 60).padStart(2, '0'),
  };
}

// ─── Stars Background ─────────────────────────────────────────────────────────
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const stars: { x: number; y: number; r: number; a: number; da: number; color: string }[] = [];
    const colors = ['#ffffff', '#93c5fd', '#c4b5fd', '#fde047'];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 280; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.25,
        a: Math.random(),
        da: (Math.random() - 0.5) * 0.007,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      stars.forEach(st => {
        st.a = Math.max(0.05, Math.min(1, st.a + st.da));
        if (st.a <= 0.05 || st.a >= 1) st.da *= -1;
        ctx!.beginPath();
        ctx!.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx!.fillStyle = st.color;
        ctx!.globalAlpha = st.a;
        ctx!.fill();
      });
      ctx!.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.75 }}
    />
  );
}

// ─── Notification System ──────────────────────────────────────────────────────
function NotificationToasts({ notifications, dismiss }: { notifications: Notification[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-xs w-full">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            className="toast flex items-start gap-3 p-4 rounded-xl"
          >
            {n.type === 'success' && <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />}
            {n.type === 'warning' && <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />}
            {n.type === 'info'    && <Sparkles size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/90">{n.title}</p>
              <p className="text-xs text-white/55 mt-0.5">{n.message}</p>
            </div>
            <button onClick={() => dismiss(n.id)} className="text-white/30 hover:text-white/70 flex-shrink-0">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ watched, notifications, toggleWatch }: { watched: WatchedShower[]; notifications: Notification[]; toggleWatch: (s: WatchedShower) => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const links = [
    { to: '/',         label: 'Home',     icon: Sparkles },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/aurora',   label: 'Aurora',   icon: Sun },
    { to: '/planets',  label: 'Planets',  icon: Orbit },
    { to: '/live',     label: 'Live',     icon: Radio },
    { to: '/globe',    label: '3D Globe', icon: Globe },
    { to: '/sky',      label: 'Sky',      icon: Star },
    { to: '/news',     label: 'News',     icon: Newspaper },
    { to: '/iss',      label: 'ISS',      icon: Rocket },
    { to: '/gear',     label: 'Gear',     icon: ShoppingBag },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'glass-nav py-2' : 'py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-space font-bold text-white text-sm tracking-wide">
            Stargaze
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 font-space
                ${pathname === to
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                  : 'text-white/55 hover:text-white/90 hover:bg-white/5'}`}
            >
              <Icon size={13} />
              {label}
            </Link>
          ))}
        </div>

        {/* Right side icons */}
        <div className="flex items-center gap-3">
          {/* Bell — opens watchlist panel */}
          <button
            onClick={() => setWatchlistOpen(o => !o)}
            className="relative hidden sm:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/8 transition-all"
            aria-label="Watchlist"
            title="My Watchlist"
          >
            <Bell size={16} className={watched.length > 0 ? 'text-blue-400' : 'text-white/40'} />
            {watched.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[8px] flex items-center justify-center font-bold shadow shadow-blue-500/50">
                {watched.length}
              </span>
            )}
          </button>
          {notifications.length > 0 && (
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow shadow-green-400/50" />
          )}
          <Link to="/settings"
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/8 transition-all"
            aria-label="Settings" title="Notification Settings">
            <Settings size={16} className={pathname === '/settings' ? 'text-blue-400' : 'text-white/40'} />
          </Link>
          <button
            className="md:hidden text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-nav border-t border-white/5 overflow-hidden"
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              {links.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium font-space transition-all
                    ${pathname === to
                      ? 'text-blue-300 bg-blue-500/12 border border-blue-500/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Watchlist slide-in panel ── */}
      <AnimatePresence>
        {watchlistOpen && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setWatchlistOpen(false)} />
            {/* Panel */}
            <motion.div initial={{ opacity:0, x:80 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:80 }}
              transition={{ type:'spring', damping:26, stiffness:280 }}
              className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col"
              style={{ background:'rgba(5,0,20,0.97)', borderLeft:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-blue-400" />
                  <h2 className="font-bold font-space text-sm text-white">My Watchlist</h2>
                  {watched.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">{watched.length}</span>
                  )}
                </div>
                <button onClick={() => setWatchlistOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {watched.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-4xl mb-4">🔭</p>
                    <p className="text-sm font-semibold text-white/60 mb-2">Nothing watched yet</p>
                    <p className="text-xs text-white/35 leading-relaxed mb-4">Watch meteor showers from the Calendar to get peak alerts here.</p>
                    <Link to="/calendar" onClick={() => setWatchlistOpen(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600/30 text-blue-300 border border-blue-500/25 hover:bg-blue-600/50 transition-colors">
                      <Calendar size={12} /> Browse Calendar
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {watched.map(s => {
                      const peak = new Date(s.peak);
                      const now = new Date();
                      const daysUntil = Math.ceil((peak.getTime() - now.getTime()) / 86400000);
                      const isActive = now >= new Date(s.start) && now <= new Date(s.end);
                      const isPast = now > peak;
                      return (
                        <motion.div key={s.id} layout initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                          className="p-3 rounded-2xl relative group"
                          style={{ background: isActive ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)', border: isActive ? '1px solid rgba(34,197,94,0.20)' : '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {isActive && <span className="inline-block text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-mono font-bold mb-1">● ACTIVE</span>}
                              <p className="text-sm font-bold text-white leading-tight">{s.name}</p>
                              <p className="text-[11px] text-white/40 mt-0.5">Peak: {peak.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                            </div>
                            <button onClick={() => toggleWatch(s)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100">
                              <BellOff size={13} />
                            </button>
                          </div>
                          {!isPast && (
                            <div className="mt-2.5 flex items-center gap-2">
                              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                                  style={{ width: isActive ? '75%' : `${Math.max(5, 100 - Math.min(100, daysUntil * 3))}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-white/40 flex-shrink-0">
                                {isActive ? 'Now!' : daysUntil > 0 ? `${daysUntil}d` : 'Peak today!'}
                              </span>
                            </div>
                          )}
                          {isPast && <p className="text-[10px] text-white/25 mt-1.5 font-mono">Peak passed</p>}
                        </motion.div>
                      );
                    })}
                    <p className="text-[10px] text-white/25 text-center mt-4">Hover a shower to remove it</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-white/8">
                <Link to="/calendar" onClick={() => setWatchlistOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all">
                  <Calendar size={13} /> Open Full Calendar
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles size={11} className="text-white" />
              </div>
              <span className="font-space font-bold text-sm">Stargaze</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Free, real-time meteor shower tracking and celestial event calendar. Open to all stargazers.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/55 uppercase tracking-widest mb-3 font-space">Explore</p>
            {[['/', 'Home'], ['/calendar', 'Calendar'], ['/live', 'Live Feed'], ['/globe', '3D Globe'], ['/gear', 'Gear Guide']].map(([to, label]) => (
              <Link key={to} to={to} className="block text-xs text-white/35 hover:text-white/70 mb-2 transition-colors">{label}</Link>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-white/55 uppercase tracking-widest mb-3 font-space">Resources</p>
            {[['https://www.imo.net', 'IMO Data'], ['https://api.nasa.gov', 'NASA API'], ['https://celestrak.org', 'CelesTrak']].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="block text-xs text-white/35 hover:text-white/70 mb-2 transition-colors">{label}</a>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-white/55 uppercase tracking-widest mb-3 font-space">Legal</p>
            {[['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/about', 'About']].map(([to, label]) => (
              <Link key={to} to={to} className="block text-xs text-white/35 hover:text-white/70 mb-2 transition-colors">{label}</Link>
            ))}
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/22">© {new Date().getFullYear()} Stargaze — All rights reserved</p>
          <p className="text-xs text-white/22">Data: IMO · NASA · Open-Meteo · CelesTrak · WhereTheISS</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function CountdownTimer({ targetDate, label }: { targetDate: string; label: string }) {
  const [cd, setCd] = useState(() => formatCountdown(new Date(targetDate).getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setCd(formatCountdown(new Date(targetDate).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const units = [
    { val: cd.days,  label: 'Days' },
    { val: cd.hours, label: 'Hrs'  },
    { val: cd.mins,  label: 'Min'  },
    { val: cd.secs,  label: 'Sec'  },
  ];

  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-widest font-mono mb-3">{label}</p>
      <div className="flex gap-2 sm:gap-3">
        {units.map(u => (
          <div key={u.label} className="flex flex-col items-center">
            <div
              className="rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 min-w-[44px] text-center"
              style={{ background: 'rgba(79,142,247,0.10)', border: '1px solid rgba(79,142,247,0.20)' }}
            >
              <span className="countdown-digit">{u.val}</span>
            </div>
            <span className="countdown-label mt-1.5">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Meteor Canvas Visualizer ─────────────────────────────────────────────────
function MeteorVisualizer({ zhr, active }: { zhr: number; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const meteors: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; len: number }[] = [];
    let animId: number;
    const spawnRate = Math.max(1, Math.floor(zhr / 20));

    function spawn() {
      for (let i = 0; i < spawnRate; i++) {
        if (Math.random() < 0.3) {
          meteors.push({
            x: Math.random() * canvas!.width,
            y: -10,
            vx: 2 + Math.random() * 3,
            vy: 3 + Math.random() * 4,
            life: 0,
            maxLife: 40 + Math.random() * 30,
            len: 20 + Math.random() * 40,
          });
        }
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      spawn();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        const alpha = 1 - m.life / m.maxLife;
        const grad = ctx!.createLinearGradient(m.x, m.y, m.x - m.vx * 5, m.y - m.vy * 5);
        grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
        grad.addColorStop(1, 'rgba(79,142,247,0)');
        ctx!.beginPath();
        ctx!.moveTo(m.x, m.y);
        ctx!.lineTo(m.x - m.vx * m.len / 10, m.y - m.vy * m.len / 10);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        if (m.life >= m.maxLife || m.x > canvas!.width + 50 || m.y > canvas!.height + 50) {
          meteors.splice(i, 1);
        }
      }
      animId = requestAnimationFrame(draw);
    }

    if (active) draw();
    return () => cancelAnimationFrame(animId);
  }, [zhr, active]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-50" />;
}

// ─── ISS Widget ───────────────────────────────────────────────────────────────
function ISSWidget() {
  const [iss, setIss] = useState<{ latitude: number; longitude: number; altitude: number; velocity: number } | null>(null);
  const [error, setError] = useState(false);

  const fetchISS = useCallback(async () => {
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      const d = await r.json();
      setIss({
        latitude:  +d.latitude.toFixed(3),
        longitude: +d.longitude.toFixed(3),
        altitude:  Math.round(d.altitude),
        velocity:  Math.round(d.velocity),
      });
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchISS();
    const id = setInterval(fetchISS, 5000);
    return () => clearInterval(id);
  }, [fetchISS]);

  return (
    <div className="glass-card p-4 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Rocket size={12} className="text-orange-400" />
          </div>
          <span className="text-xs font-semibold font-space text-white/75">ISS Live Tracker</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="text-[10px] text-green-400 font-mono font-semibold tracking-wider">LIVE</span>
        </div>
      </div>
      {error ? (
        <div className="flex items-center justify-center gap-2 py-3 text-white/30">
          <AlertTriangle size={13} />
          <span className="text-xs">Connection error</span>
        </div>
      ) : iss ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Latitude',  value: `${iss.latitude}°`,                   icon: MapPin },
            { label: 'Longitude', value: `${iss.longitude}°`,                  icon: MapPin },
            { label: 'Altitude',  value: `${iss.altitude} km`,                 icon: TrendingUp },
            { label: 'Speed',     value: `${iss.velocity.toLocaleString()} km/h`, icon: Zap },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }} className="rounded-xl p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <Icon size={9} className="text-white/30" />
                <span className="text-[9px] text-white/30 uppercase tracking-wider font-mono">{label}</span>
              </div>
              <p className="text-xs font-semibold font-mono text-white/85">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-3">
          <RefreshCw size={14} className="text-white/30 animate-spin" />
          <span className="text-xs text-white/30 font-mono">Connecting…</span>
        </div>
      )}
    </div>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: 'When is the best time to watch meteor showers?', a: 'After midnight is almost always best. As Earth rotates into the incoming debris stream head-on, the rate of meteors roughly doubles compared to the evening hours. Set an alarm for 1 or 2 AM if you\'re serious about it.' },
    { q: 'Do I need a telescope?', a: 'No, and actually a telescope makes things worse. Meteor showers need wide-angle vision, not magnification. A blanket, a reclining chair, dark skies, and patience are genuinely all you need.' },
    { q: 'What does ZHR mean?', a: 'Zenithal Hourly Rate is the theoretical maximum under perfect conditions: total darkness, no light pollution, and the radiant directly overhead. Real-world rates are typically 40 to 70 percent of ZHR, so divide by two and you\'re in the right ballpark.' },
    { q: 'Why do showers happen on the same dates every year?', a: 'Earth crosses the same comet debris trails at the same points in its orbit each year. It\'s as reliable as the calendar. The Perseids are always mid-August, the Geminids always mid-December, and so on.' },
    { q: 'How accurate are the peak predictions?', a: 'Dates and times are highly accurate because orbital mechanics are well understood. What varies is the actual rate - uneven debris distribution and local weather can push counts up or down significantly.' },
  ];

  return (
    <div className="space-y-2">
      {faqs.map((f, i) => (
        <div key={i} className="glass-card rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-left group"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-medium text-white/80 group-hover:text-white/95 transition-colors">{f.q}</span>
            <ChevronDown size={14} className={`text-white/35 flex-shrink-0 ml-3 transition-transform duration-200 ${open === i ? 'rotate-180 text-blue-400' : ''}`} />
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-4 text-sm text-white/52 leading-relaxed">{f.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function Home({ watched, addNotification, toggleWatch }: {
  watched: WatchedShower[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void;
  toggleWatch: (s: MeteorShower) => void;
}) {
  const nextShower = getNextShower();
  const moon = getMoonPhase();
  const spaceData = useSpaceData();
  const [apod, setApod] = useState<{ title: string; url: string; explanation: string; media_type: string } | null>(null);
  const [apodLoading, setApodLoading] = useState(true);
  const [weather, setWeather] = useState<{ cloudCover: number; humidity: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherDenied, setWeatherDenied] = useState(false);
  const [weekTab, setWeekTab] = useState<'asteroids' | 'fireballs'>('asteroids');
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    // Check localStorage cache first (valid for the current calendar day)
    const today = new Date().toISOString().slice(0, 10); // "2026-06-30"
    try {
      const cached = JSON.parse(localStorage.getItem('stargaze_apod') || '{}');
      if (cached.date === today && (cached.url || cached.hdurl)) {
        setApod(cached);
        setApodLoading(false);
        return;
      }
    } catch {}

    setApodLoading(true);
    fetch('https://api.nasa.gov/planetary/apod?api_key=0oMQ3t0Hfqwtanhhg9gIccTe5PHmZjjt6hi48Dmp')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (d.url || d.hdurl) {
          // Cache with today's date
          try { localStorage.setItem('stargaze_apod', JSON.stringify({ ...d, _cached: today })); } catch {}
          setApod(d);
        }
      })
      .catch(() => {
        // Try the date-indexed fallback: yesterday's APOD is also fine
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
        fetch(`https://api.nasa.gov/planetary/apod?api_key=0oMQ3t0Hfqwtanhhg9gIccTe5PHmZjjt6hi48Dmp&date=${yesterday}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d && (d.url || d.hdurl)) setApod(d); })
          .catch(() => {});
      })
      .finally(() => setApodLoading(false));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setWeatherDenied(true); return; }
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=cloud_cover,relative_humidity_2m&timezone=auto`);
          const d = await r.json();
          setWeather({ cloudCover: d.current.cloud_cover, humidity: d.current.relative_humidity_2m });
        } catch {}
        setWeatherLoading(false);
      },
      () => { setWeatherLoading(false); setWeatherDenied(true); }
    );
  }, []);

  const activeShowers  = showers.filter(s => getShowerStatus(s) === 'active');
  const upcomingShowers = showers.filter(s => getShowerStatus(s) === 'upcoming').slice(0, 3);
  const { kpNow, kpHistory, kpLabel, kpColor, kpStatus, auroraLat, fireballs, asteroids, epicImg, marsSnap } = spaceData;

  // Viewing quality score (0-10) based on moon + cloud cover
  const cloudScore = weather ? Math.max(0, 10 - Math.round(weather.cloudCover / 10)) : 7;
  const moonScore  = Math.max(0, 10 - Math.round(moon.illumination / 10));
  const viewScore  = Math.round((cloudScore + moonScore) / 2);
  const viewLabel  = viewScore >= 8 ? 'Excellent' : viewScore >= 6 ? 'Good' : viewScore >= 4 ? 'Fair' : 'Poor';
  const viewColor  = viewScore >= 8 ? '#4ade80' : viewScore >= 6 ? '#fbbf24' : viewScore >= 4 ? '#f97316' : '#ef4444';

  return (
    <>
      <title>Stargaze — Live Space Weather, Meteor Showers, Asteroids &amp; Aurora Tracker</title>
      <meta name="description" content="Real-time space weather dashboard: aurora Kp index, meteor showers, asteroid flybys, JPL fireballs, ISS tracking, Mars rover photos, and NASA APOD. Free, always." />
      <meta property="og:title" content="Stargaze — Live Space Weather &amp; Meteor Shower Tracker" />
      <meta property="og:description" content="Aurora alerts, asteroid flybys, meteor showers, ISS tracking, and NASA imagery — all in one free real-time dashboard." />
      <meta property="og:url" content="https://www.stargaze.io/" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href="https://www.stargaze.io/" />
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org", "@type": "WebSite",
        "name": "Stargaze", "url": "https://www.stargaze.io",
        "description": "Live space weather, aurora tracker, meteor showers, asteroid close approaches, and NASA imagery. Free.",
        "potentialAction": { "@type": "SearchAction", "target": "https://www.stargaze.io/calendar?q={search_term_string}", "query-input": "required name=search_term_string" }
      })}</script>

    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7 }}
        className="text-center mb-10">
        <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
          style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.20)' }}>
          <span className="live-dot" />
          <span className="text-xs font-mono text-green-400/85 tracking-wider">LIVE SPACE DASHBOARD</span>
        </motion.div>
        <h1 className="hero-title hero-gradient-text mb-5">Space Is Happening<br className="hidden sm:block" /> Right Now</h1>
        <p className="text-lg text-white/48 max-w-2xl mx-auto leading-relaxed font-light">
          Real-time aurora alerts, meteor showers, asteroid close approaches, government fireball data, ISS tracking, and NASA imagery — all free, all live.
        </p>
        <div className="flex items-center justify-center flex-wrap gap-3 mt-8">
          <Link to="/calendar" className="btn-primary"><Calendar size={14} />Meteor Calendar</Link>
          <Link to="/sky"      className="btn-secondary"><Star size={14} />Night Sky Map</Link>
          <Link to="/globe"    className="btn-secondary"><Globe size={14} />3D Globe</Link>
          <Link to="/live"     className="btn-secondary"><Radio size={14} />Live Sightings</Link>
        </div>
      </motion.div>

      {/* ══ LIVE STATUS STRIP ═════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}
        className="flex flex-wrap items-center justify-center gap-3 mb-10 text-[11px] font-mono">
        {[
          { icon: Sun,      label: `Kp ${kpNow !== null ? kpNow.toFixed(1) : '…'} — ${kpLabel}`,        color: kpColor },
          { icon: Sparkles, label: activeShowers.length > 0 ? `${activeShowers.length} Shower${activeShowers.length > 1 ? 's' : ''} Active` : nextShower ? `Next: ${nextShower.name}` : '9 Showers Tracked', color: '#c084fc' },
          { icon: Flame,    label: `${fireballs.length > 0 ? fireballs.length : '—'} Fireballs on Record`, color: '#fb923c' },
          { icon: Triangle, label: `${asteroids.length > 0 ? asteroids.length : '—'} Asteroid${asteroids.length !== 1 ? 's' : ''} This Week`, color: '#60a5fa' },
          { icon: Rocket,   label: 'ISS Orbiting Now',                                                    color: '#34d399' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <Icon size={11} style={{ color }} />
            <span style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
          </div>
        ))}
      </motion.div>

      {/* ══ TONIGHT GRID — 5 live status cards ═══════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10" ref={ref}>
        {/* Aurora */}
        <motion.div initial={{ opacity:0, y:15 }} animate={inView ? { opacity:1, y:0 } : {}} transition={{ delay:0 }}
          className="glass-card p-4 rounded-2xl" style={{ borderTop:`2px solid ${kpColor}33` }}>
          <Sun size={16} style={{ color: kpColor }} className="mb-2.5" />
          <p className="text-xl font-bold font-space leading-none mb-1" style={{ color: kpColor }}>
            {kpNow !== null ? kpNow.toFixed(1) : '—'}
          </p>
          <p className="text-[10px] text-white/42">{kpLabel}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1.5 font-mono">Kp Index</p>
        </motion.div>
        {/* Next Shower */}
        <motion.div initial={{ opacity:0, y:15 }} animate={inView ? { opacity:1, y:0 } : {}} transition={{ delay:0.06 }}
          className="glass-card p-4 rounded-2xl" style={{ borderTop:'2px solid rgba(192,132,252,0.25)' }}>
          <Activity size={16} className={activeShowers.length > 0 ? 'text-green-400 mb-2.5' : 'text-purple-400 mb-2.5'} />
          <p className="text-xl font-bold font-space leading-none mb-1">
            {activeShowers.length > 0 ? activeShowers.length : (nextShower ? `${getDaysUntilPeak(nextShower)}d` : '—')}
          </p>
          <p className="text-[10px] text-white/42">{activeShowers.length > 0 ? 'happening now' : (nextShower?.name ?? '—')}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1.5 font-mono">{activeShowers.length > 0 ? 'Active Now' : 'Next Shower'}</p>
        </motion.div>
        {/* Moon */}
        <motion.div initial={{ opacity:0, y:15 }} animate={inView ? { opacity:1, y:0 } : {}} transition={{ delay:0.12 }}
          className="glass-card p-4 rounded-2xl" style={{ borderTop:'2px solid rgba(253,224,71,0.18)' }}>
          <Moon size={16} className="text-yellow-300 mb-2.5" />
          <p className="text-xl font-bold font-space leading-none mb-1">{moon.emoji}</p>
          <p className="text-[10px] text-white/42">{moon.illumination}% lit</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1.5 font-mono">{moon.phase}</p>
        </motion.div>
        {/* Sky Quality */}
        <motion.div initial={{ opacity:0, y:15 }} animate={inView ? { opacity:1, y:0 } : {}} transition={{ delay:0.18 }}
          className="glass-card p-4 rounded-2xl" style={{ borderTop:`2px solid ${viewColor}33` }}>
          <Eye size={16} style={{ color: viewColor }} className="mb-2.5" />
          <p className="text-xl font-bold font-space leading-none mb-1" style={{ color: viewColor }}>{viewScore}/10</p>
          <p className="text-[10px] text-white/42">{weather ? `${weather.cloudCover}% cloud` : 'enable location'}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1.5 font-mono">Sky Quality</p>
        </motion.div>
        {/* Fireballs */}
        <motion.div initial={{ opacity:0, y:15 }} animate={inView ? { opacity:1, y:0 } : {}} transition={{ delay:0.24 }}
          className="glass-card p-4 rounded-2xl" style={{ borderTop:'2px solid rgba(251,146,60,0.25)' }}>
          <Flame size={16} className="text-orange-400 mb-2.5" />
          <p className="text-xl font-bold font-space leading-none mb-1">{fireballs.length || '—'}</p>
          <p className="text-[10px] text-white/42">JPL confirmed</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1.5 font-mono">Recent Fireballs</p>
        </motion.div>
      </div>

      {/* ══ AURORA + NEXT SHOWER ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">

        {/* Aurora Card */}
        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2 }}
          className="lg:col-span-3 glass-card p-6 rounded-2xl relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
            style={{ background:`radial-gradient(circle, ${kpColor}12 0%, transparent 70%)`, transform:'translate(25%, -25%)' }} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:`${kpColor}18`, border:`1px solid ${kpColor}35` }}>
                  <Sun size={14} style={{ color: kpColor }} />
                </div>
                <div>
                  <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Geomagnetic Activity</p>
                  <h2 className="text-sm font-bold font-space text-white/90">Aurora Alert</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-space" style={{ color: kpColor }}>
                  {kpNow !== null ? kpNow.toFixed(1) : '—'}
                </p>
                <p className="text-[10px] font-mono" style={{ color: kpColor }}>{kpLabel}</p>
              </div>
            </div>

            {/* Kp bar meter */}
            <div className="mb-4">
              <div className="flex justify-between text-[9px] text-white/30 font-mono mb-1.5">
                <span>0 Quiet</span><span>3 Unsettled</span><span>5 Storm</span><span>9 Extreme</span>
              </div>
              <div className="relative h-5 rounded-full overflow-hidden"
                style={{ background:'linear-gradient(to right, #4ade80 0%, #a3e635 25%, #fbbf24 40%, #f97316 55%, #ef4444 70%, #dc2626 100%)' }}>
                {/* dark mask over unfilled portion */}
                <div className="absolute inset-y-0 right-0 rounded-r-full"
                  style={{ width:`${100 - ((kpNow ?? 0) / 9) * 100}%`, background:'rgba(2,0,20,0.72)' }} />
                {/* indicator */}
                {kpNow !== null && (
                  <div className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg z-10"
                    style={{ left:`${(kpNow / 9) * 100}%`, transform:'translate(-50%, -50%)', background: kpColor, boxShadow:`0 0 10px ${kpColor}` }} />
                )}
              </div>
            </div>

            {/* 24h sparkline */}
            {kpHistory.length > 0 && (
              <div className="mb-5">
                <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest mb-1.5">24h Kp History</p>
                <div className="flex gap-0.5 h-10 items-end">
                  {kpHistory.slice(-24).map((pt, i) => {
                    const barColor = pt.kp < 3 ? '#4ade80' : pt.kp < 5 ? '#fbbf24' : '#ef4444';
                    return (
                      <div key={i} title={`Kp ${pt.kp.toFixed(1)} — ${pt.time}`}
                        className="flex-1 rounded-sm min-h-[2px] transition-all"
                        style={{ height:`${Math.max(4, (pt.kp / 9) * 100)}%`, background: barColor, opacity: 0.5 + (i / 24) * 0.5 }} />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Aurora visibility */}
            <div className="p-3 rounded-xl mb-4" style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${kpColor}22` }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: kpColor }} />
                <p className="text-xs text-white/75">{auroraLat || 'Connecting to NOAA…'}</p>
              </div>
              {kpNow !== null && kpNow >= 5 && (
                <p className="text-[10px] text-orange-300 mt-1.5 font-semibold">
                  🌌 Geomagnetic storm in progress — aurora possible at lower latitudes than usual
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <a href="https://www.spaceweather.com" target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs py-2 rounded-xl font-semibold transition-all hover:opacity-80"
                style={{ background:`${kpColor}18`, color: kpColor, border:`1px solid ${kpColor}30` }}>
                Space Weather
              </a>
              <a href="https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json" target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-xs py-2 rounded-xl text-white/50 font-semibold transition-all hover:text-white/80"
                style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                NOAA Raw Data
              </a>
            </div>
          </div>
        </motion.div>

        {/* Next Shower + ISS + Moon */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Next Shower Countdown */}
          {nextShower && (
            <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.25 }}
              className="glass-card p-5 rounded-2xl relative overflow-hidden flex-1">
              <MeteorVisualizer zhr={nextShower.zhr} active />
              <div className="relative z-10">
                <span className="section-label text-orange-400 mb-3 block">Next Peak Event</span>
                <h2 className="text-2xl font-bold font-space mb-1">{nextShower.name}</h2>
                <p className="text-xs text-white/40 mb-4">{nextShower.constellation} · Up to {nextShower.zhr} ZHR</p>
                <CountdownTimer targetDate={nextShower.peak} label="Until Peak" />
                <div className="mt-4 flex gap-2 flex-wrap">
                  <Link to={`/shower/${nextShower.id}`} className="btn-primary text-xs"><ArrowRight size={11}/>Details</Link>
                  <button onClick={() => { toggleWatch(nextShower); addNotification({ title: watched.some(w=>w.id===nextShower.id) ? 'Removed' : 'Watching!', message: nextShower.name, type:'success' }); }}
                    className="btn-secondary text-xs">
                    {watched.some(w=>w.id===nextShower.id) ? <BellOff size={11}/> : <Bell size={11}/>}
                    {watched.some(w=>w.id===nextShower.id) ? 'Unwatch' : 'Watch'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {/* ISS Widget */}
          <ISSWidget />
        </div>
      </div>

      {/* ══ THIS WEEK IN SPACE ════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
        className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/12 border border-blue-500/22 flex items-center justify-center">
              <AlertTriangle size={12} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-bold font-space">This Week in Space</h2>
          </div>
          <div className="flex gap-1">
            {(['asteroids', 'fireballs'] as const).map(tab => (
              <button key={tab} onClick={() => setWeekTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-space transition-all ${
                  weekTab === tab ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-white/35 hover:text-white/60'
                }`}>
                {tab === 'asteroids' ? `Asteroids ${asteroids.length > 0 ? `(${asteroids.length})` : ''}` : `Fireballs ${fireballs.length > 0 ? `(${fireballs.length})` : ''}`}
              </button>
            ))}
          </div>
        </div>

        {/* Asteroid Flybys */}
        {weekTab === 'asteroids' && (
          asteroids.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {asteroids.slice(0, 6).map((ast, i) => {
                const dist  = parseFloat(ast.dist);
                const vrel  = parseFloat(ast.v_rel);
                const hMag  = parseFloat(ast.h);
                const ld    = auToLD(dist);
                const size  = isNaN(hMag) ? 'Unknown' : asteroidSize(hMag);
                const name  = ast.fullname?.trim() || ast.des;
                const closeDate = new Date(ast.cd);
                const daysUntil = Math.ceil((closeDate.getTime() - Date.now()) / 86400000);
                const isClose = dist < 0.01; // less than ~4 LD
                return (
                  <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}
                    className="glass-card p-4 rounded-2xl relative overflow-hidden"
                    style={{ borderLeft: isClose ? '2px solid rgba(96,165,250,0.5)' : undefined }}>
                    {isClose && (
                      <div className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold"
                        style={{ background:'rgba(96,165,250,0.15)', color:'#93c5fd', border:'1px solid rgba(96,165,250,0.25)' }}>
                        CLOSE APPROACH
                      </div>
                    )}
                    <div className="flex items-start gap-2 mb-3">
                      <Triangle size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white/90 truncate">{name}</p>
                        <p className="text-[10px] text-white/35 font-mono">
                          {daysUntil > 0 ? `in ${daysUntil}d` : daysUntil === 0 ? 'today' : `${Math.abs(daysUntil)}d ago`} · {closeDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label:'Distance', val: ld },
                        { label:'Speed',    val: `${vrel.toFixed(1)} km/s` },
                        { label:'Est. Size', val: size },
                      ].map(({ label, val }) => (
                        <div key={label} className="p-2 rounded-lg text-center" style={{ background:'rgba(255,255,255,0.03)' }}>
                          <p className="text-[10px] font-bold text-white/75 leading-tight">{val}</p>
                          <p className="text-[9px] text-white/30 font-mono mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-8 rounded-2xl text-center">
              <Triangle size={28} className="text-blue-400/30 mx-auto mb-3" />
              <p className="text-sm text-white/40 font-semibold mb-1">No close approaches this week</p>
              <p className="text-xs text-white/25">Next week might be different. Check back soon.</p>
            </div>
          )
        )}

        {/* Government Confirmed Fireballs */}
        {weekTab === 'fireballs' && (
          fireballs.length > 0 ? (
            <div className="space-y-2">
              {fireballs.slice(0, 10).map((fb, i) => {
                const energy = fireballEnergy(fb);
                const date = new Date(fb.date);
                const daysAgo = Math.floor((Date.now() - date.getTime()) / 86400000);
                const locationStr = fb.lat && fb.lon
                  ? `${parseFloat(fb.lat).toFixed(1)}°${fb.lat_dir ?? ''}, ${parseFloat(fb.lon).toFixed(1)}°${fb.lon_dir ?? ''}`
                  : null;
                return (
                  <motion.div key={i} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.04 }}
                    className="glass-card px-4 py-3 rounded-xl flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background:'rgba(251,146,60,0.12)', border:'1px solid rgba(251,146,60,0.22)' }}>
                      <Flame size={14} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-white/85">{date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                        {daysAgo === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-mono">TODAY</span>}
                      </div>
                      <p className="text-[10px] text-white/35 font-mono">{locationStr ?? 'Location not reported'}{fb.alt ? ` · ${parseFloat(fb.alt).toFixed(0)} km alt` : ''}{fb.vel ? ` · ${parseFloat(fb.vel).toFixed(1)} km/s` : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-orange-400">{energy}</p>
                      <p className="text-[9px] text-white/30 font-mono">impact energy</p>
                    </div>
                    <div className="text-[10px] text-white/20 font-mono flex-shrink-0">{daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</div>
                  </motion.div>
                );
              })}
              <p className="text-[10px] text-white/20 text-center pt-1 font-mono">Source: JPL Center for Near Earth Object Studies · US Government sensor network</p>
            </div>
          ) : (
            <div className="glass-card p-8 rounded-2xl text-center">
              <Flame size={28} className="text-orange-400/30 mx-auto mb-3" />
              <p className="text-sm text-white/40 font-semibold mb-1">Loading fireball data…</p>
              <p className="text-xs text-white/25">Fetching from JPL government sensor network</p>
            </div>
          )
        )}
      </motion.div>

      {/* ══ ACTIVE SHOWERS ════════════════════════════════════════════════════ */}
      {activeShowers.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="live-dot" />
            <h2 className="text-lg font-bold font-space">Active Right Now</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeShowers.map(s => (
              <motion.div key={s.id} whileHover={{ y:-2 }}
                className="glass-card p-4 rounded-2xl" style={{ borderLeft:'2px solid rgba(34,197,94,0.35)' }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="badge-active text-[10px] px-2 py-0.5 rounded-full font-mono">ACTIVE</span>
                    <h3 className="text-base font-bold mt-1.5">{s.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-orange-400 font-semibold">{s.zhr} ZHR</span>
                    {s.speed && <p className="text-[10px] text-white/30 font-mono mt-0.5">{s.speed} km/s</p>}
                  </div>
                </div>
                <p className="text-xs text-white/50 mb-3 line-clamp-2 leading-relaxed">{s.description}</p>
                <Link to={`/shower/${s.id}`} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  Details <ArrowRight size={11} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ══ UPCOMING SHOWERS ══════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/12 border border-purple-500/22 flex items-center justify-center">
              <Clock size={12} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-bold font-space">Next Up</h2>
          </div>
          <Link to="/calendar" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            Full Calendar <ArrowRight size={11} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {upcomingShowers.map((s, i) => {
            const daysUntil = getDaysUntilPeak(s);
            const isImminent = daysUntil <= 7;
            const isVeryClose = daysUntil <= 2;
            return (
              <motion.div key={s.id} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.1 }}
                whileHover={{ y:-3 }} className="glass-card p-4 rounded-2xl group relative overflow-hidden"
                style={{ borderLeft: isImminent ? '2px solid rgba(168,85,247,0.45)' : undefined }}>
                {isImminent && <div className="absolute inset-0 pointer-events-none"
                  style={{ background:'radial-gradient(ellipse at top left, rgba(168,85,247,0.06) 0%, transparent 70%)' }} />}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${isVeryClose ? 'bg-purple-500/25 text-purple-300' : 'badge-upcoming'}`}>
                    {isVeryClose ? '🌠 IMMINENT' : daysUntil > 0 ? `IN ${daysUntil}d` : 'PEAK SOON'}
                  </span>
                  <span className="text-[10px] font-mono text-orange-400 font-semibold">{s.zhr} ZHR</span>
                </div>
                <h3 className="text-sm font-bold mb-0.5 group-hover:text-purple-300 transition-colors">{s.name}</h3>
                <p className="text-[10px] text-white/35 font-mono mb-3">Peak {formatDate(s.peak)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/35">{s.constellation}</span>
                  <Link to={`/shower/${s.id}`} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
                    Details <ChevronRight size={10} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ══ SPACE TODAY — APOD + EPIC Earth + Mars Rover ═════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-orange-500/12 border border-orange-500/22 flex items-center justify-center">
            <Rocket size={12} className="text-orange-400" />
          </div>
          <h2 className="text-lg font-bold font-space">Space Today</h2>
          <span className="text-[10px] text-white/25 font-mono ml-1">NASA live feeds</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* APOD */}
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
            <div className="relative">
              {apodLoading ? (
                <div className="h-48 flex items-center justify-center shimmer">
                  <Rocket size={22} className="text-orange-400/35 animate-float" />
                </div>
              ) : apod ? (
                apod.media_type === 'image' ? (
                  <img src={apod.url} alt={apod.title} className="w-full h-48 object-cover" loading="lazy" />
                ) : (
                  <div className="h-48 flex items-center justify-center bg-blue-500/5">
                    <a href={apod.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs"><ExternalLink size={11}/>Watch on NASA</a>
                  </div>
                )
              ) : (
                <div className="h-48 flex items-center justify-center" style={{ background:'linear-gradient(135deg,#050520,#0a0540)' }}>
                  <div className="text-center"><p className="text-3xl mb-2">🔭</p><p className="text-xs text-white/30">NASA APOD</p></div>
                </div>
              )}
              <div className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold"
                style={{ background:'rgba(251,146,60,0.8)', color:'#fff' }}>NASA APOD</div>
            </div>
            <div className="p-4 flex-1">
              <h3 className="text-xs font-bold mb-1 line-clamp-2">{apod?.title ?? 'Astronomy Picture of the Day'}</h3>
              <p className="text-[10px] text-white/40 leading-relaxed line-clamp-3">{apod?.explanation ?? 'Updated daily by NASA. The most beautiful images of the universe.'}</p>
            </div>
          </div>

          {/* EPIC Earth */}
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
            <div className="relative">
              {epicImg ? (
                <img src={epicImg.url} alt="Earth from DSCOVR satellite" className="w-full h-48 object-cover object-center" loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="h-48 flex items-center justify-center" style={{ background:'linear-gradient(135deg,#03071a,#040d26,#030522)' }}>
                  <Globe2 size={36} className="text-blue-400/30" />
                </div>
              )}
              <div className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold"
                style={{ background:'rgba(59,130,246,0.8)', color:'#fff' }}>EARTH FROM SPACE</div>
            </div>
            <div className="p-4 flex-1">
              <h3 className="text-xs font-bold mb-1">Earth Right Now</h3>
              <p className="text-[10px] text-white/40 leading-relaxed">
                {epicImg
                  ? `NASA EPIC camera aboard the DSCOVR satellite, 1.5M km from Earth. Photo taken ${new Date(epicImg.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}.`
                  : 'Daily full-disk Earth photos from NASA DSCOVR satellite at the L1 Lagrange point, 1.5 million km away.'}
              </p>
            </div>
          </div>

          {/* Mars Rover */}
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
            <div className="relative">
              {marsSnap ? (
                <img src={marsSnap.src} alt={`Mars — ${marsSnap.camera}`} className="w-full h-48 object-cover" loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="h-48 flex items-center justify-center" style={{ background:'linear-gradient(135deg,#1c0a02,#2d100a,#1a0805)' }}>
                  <Camera size={36} className="text-red-400/30" />
                </div>
              )}
              <div className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold"
                style={{ background:'rgba(220,38,38,0.8)', color:'#fff' }}>MARS TODAY</div>
            </div>
            <div className="p-4 flex-1">
              <h3 className="text-xs font-bold mb-1">Curiosity Rover</h3>
              <p className="text-[10px] text-white/40 leading-relaxed">
                {marsSnap
                  ? `${marsSnap.camera} · Sol ${marsSnap.sol} · ${new Date(marsSnap.earthDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
                  : 'Latest photos from NASA Curiosity rover on the surface of Mars, updated when the rover transmits new images.'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ══ BEST VIEWING WINDOW ═══════════════════════════════════════════════ */}
      {(() => {
        const moonBad  = moon.illumination > 55;
        const bestHour = moonBad ? '02:00–04:30' : '23:00–04:30';
        const tip = moonBad
          ? `Bright moon tonight. Best window is ${bestHour} when the moon is lower. Fireballs and bright meteors still worth watching.`
          : `Dark skies tonight. Prime viewing is ${bestHour}. Lie flat, look straight up, give your eyes 20 minutes to adapt.`;
        return (
          <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }}
            className="glass-card p-5 rounded-2xl mb-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
              style={{ background:`radial-gradient(circle,${viewColor}0a 0%,transparent 70%)`, transform:'translate(30%,-30%)' }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background:`${viewColor}18`, border:`1px solid ${viewColor}33` }}>
                    <Moon size={12} style={{ color:viewColor }} />
                  </div>
                  <span className="text-xs font-semibold text-white/75">Best Viewing Window Tonight</span>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color:viewColor }}>{viewLabel} — {viewScore}/10</span>
              </div>
              <div className="flex gap-0.5 mb-3">
                {Array.from({length:10},(_,i) => (
                  <div key={i} className="flex-1 h-2.5 rounded-sm"
                    style={{ background: i < viewScore ? viewColor : 'rgba(255,255,255,0.06)' }} />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { label:'Best window', val:bestHour, icon:'🕑' },
                  { label:'Moon', val:`${moon.illumination}% — ${moon.phase}`, icon:moon.emoji },
                  { label:'Cloud cover', val: weather ? `${weather.cloudCover}%` : 'Enable location', icon:'☁️' },
                  { label:'Active showers', val: activeShowers.length > 0 ? activeShowers.map(s=>s.name).join(', ') : 'None tonight', icon:'🌠' },
                ].map(({label,val,icon}) => (
                  <div key={label} className="p-2 rounded-xl" style={{ background:'rgba(255,255,255,0.03)' }}>
                    <p className="text-[9px] text-white/35 font-mono uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-[11px] text-white/80 font-medium">{icon} {val}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed">{tip}</p>
            </div>
          </motion.div>
        );
      })()}

      {/* ══ OBSERVING CONDITIONS ══════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-blue-500/12 border border-blue-500/22 flex items-center justify-center">
            <Cloud size={12} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-bold font-space">Local Observing Conditions</h2>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          {weatherDenied || (!weather && !weatherLoading) ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-white/72 mb-1">Enable location for live conditions</p>
                <p className="text-xs text-white/40 leading-relaxed">Allow location in your browser to see real-time cloud cover and sky quality for your area.</p>
              </div>
              <div className="text-3xl opacity-35 flex-shrink-0">📍</div>
            </div>
          ) : weatherLoading ? (
            <div className="flex items-center gap-3">
              <RefreshCw size={14} className="text-blue-400/50 animate-spin flex-shrink-0" />
              <p className="text-xs text-white/30 font-mono">Fetching local conditions…</p>
            </div>
          ) : weather ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label:'Cloud Cover', value:`${weather.cloudCover}%`,  good:weather.cloudCover<30,  icon:Cloud },
                  { label:'Humidity',    value:`${weather.humidity}%`,     good:weather.humidity<70,    icon:Wind },
                  { label:'Sky Quality', value:weather.cloudCover<20?'Excellent':weather.cloudCover<50?'Fair':'Poor', good:weather.cloudCover<50, icon:Eye },
                  { label:'Moon Impact', value:moon.illumination<30?'Low':moon.illumination<70?'Medium':'High', good:moon.illumination<50, icon:Moon },
                ].map(({label,value,good,icon:Icon}) => (
                  <div key={label} className="text-center p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.03)' }}>
                    <Icon size={18} className={`mx-auto mb-1.5 ${good?'text-green-400':'text-orange-400'}`} />
                    <p className="text-sm font-bold">{value}</p>
                    <p className="text-[10px] text-white/32 uppercase tracking-wider font-mono mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-white/5">
                <p className="text-xs text-white/40">
                  {weather.cloudCover<20 ? '✓ Excellent conditions tonight. Crystal clear skies expected.' :
                   weather.cloudCover<50 ? '◎ Partly cloudy. Viewing will be intermittent — look for breaks in the clouds.' :
                   '✗ Heavy cloud cover. Worth rescheduling to a clearer night if you can.'}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ══ PLANETS TONIGHT ══════════════════════════════════════════════════ */}
      {(() => {
        const planets = getPlanets();
        const visible = planets.filter(p => p.visibility !== 'hidden');
        return (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/12 border border-purple-500/22 flex items-center justify-center">
                  <Orbit size={12} className="text-purple-400" />
                </div>
                <h2 className="text-lg font-bold font-space">Planets Tonight</h2>
              </div>
              <Link to="/planets" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                Full Details <ArrowRight size={11} />
              </Link>
            </div>
            {visible.length === 0 ? (
              <div className="glass-card p-5 rounded-2xl text-center text-white/30 text-sm">No planets well-placed for viewing tonight</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {planets.map(p => {
                  const visColors: Record<string, string> = { evening:'#fbbf24', morning:'#f472b6', night:'#818cf8', hidden:'rgba(255,255,255,0.2)' };
                  const vc = visColors[p.visibility];
                  const isVis = p.visibility !== 'hidden';
                  return (
                    <Link to="/planets" key={p.name}
                      className="glass-card p-3.5 rounded-xl flex flex-col items-center text-center transition-all hover:ring-1 hover:ring-white/10"
                      style={{ opacity: isVis ? 1 : 0.45 }}>
                      <div className="text-2xl mb-1.5">{p.symbol}</div>
                      <p className="text-xs font-bold text-white/80 mb-1">{p.name}</p>
                      <p className="text-[9px] font-semibold" style={{ color: vc }}>{p.visibility === 'hidden' ? 'Not visible' : p.visibility}</p>
                      <p className="text-[9px] text-white/25 font-mono mt-0.5">{p.elongation}° from ☀️</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ══ SPACE NEWS ════════════════════════════════════════════════════════ */}
      {spaceData.news.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/12 border border-blue-500/22 flex items-center justify-center">
                <Newspaper size={12} className="text-blue-400" />
              </div>
              <h2 className="text-lg font-bold font-space">Latest Space News</h2>
            </div>
            <Link to="/news" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              All Articles <ArrowRight size={11} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {spaceData.news.slice(0, 3).map((article, i) => {
              const ago = (() => {
                const d = (Date.now() - new Date(article.published_at).getTime()) / 1000;
                return d < 3600 ? `${Math.floor(d/60)}m ago` : d < 86400 ? `${Math.floor(d/3600)}h ago` : `${Math.floor(d/86400)}d ago`;
              })();
              return (
                <motion.a key={article.id}
                  href={article.url} target="_blank" rel="noopener noreferrer"
                  initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.08 }}
                  className="glass-card rounded-2xl overflow-hidden group flex flex-col hover:ring-1 hover:ring-blue-500/25 transition-all">
                  <div className="relative h-36 overflow-hidden" style={{ background:'rgba(0,0,30,0.6)' }}>
                    {article.image_url && (
                      <img src={article.image_url} alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                      />
                    )}
                    <div className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full font-mono"
                      style={{ background:'rgba(0,0,0,0.65)', color:'rgba(255,255,255,0.5)' }}>{ago}</div>
                  </div>
                  <div className="p-3.5 flex-1">
                    <p className="text-[9px] font-mono text-blue-400/60 mb-1">{article.news_site}</p>
                    <h3 className="text-xs font-bold leading-snug line-clamp-3 group-hover:text-blue-300 transition-colors">{article.title}</h3>
                  </div>
                </motion.a>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ FAQ ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-purple-500/12 border border-purple-500/22 flex items-center justify-center">
            <MessageSquare size={12} className="text-purple-400" />
          </div>
          <h2 className="text-lg font-bold font-space">Frequently Asked Questions</h2>
        </div>
        <FaqSection />
      </div>
    </div>
    </>
  );
}

// ─── METEOR CALENDAR PAGE ─────────────────────────────────────────────────────
function MeteorCalendar({ watched, toggleWatch, addNotification }: {
  watched: WatchedShower[];
  toggleWatch: (s: MeteorShower) => void;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'zhr'>('date');

  const filtered = showers
    .filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.constellation.toLowerCase().includes(search.toLowerCase());
      const status = getShowerStatus(s);
      const matchFilter = filter === 'all' || status === filter;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => sortBy === 'date'
      ? new Date(a.peak).getTime() - new Date(b.peak).getTime()
      : b.zhr - a.zhr);

  return (
    <>
      <title>Meteor Shower Calendar 2026 | Dates, Peak Times &amp; Forecasts | Stargaze</title>
      <meta name="description" content="Complete 2026 meteor shower calendar with peak dates, ZHR rates, radiant constellations, and viewing tips for every major meteor shower." />
      <meta property="og:title" content="Meteor Shower Calendar 2026 | Stargaze" />
      <meta property="og:description" content="Complete 2026 meteor shower calendar with peak dates, ZHR rates, and viewing tips." />
      <link rel="canonical" href="https://stargaze.io/calendar" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <p className="section-label text-blue-400 mb-2">2026 Season</p>
          <h1 className="text-4xl font-bold font-space mb-2">Meteor Shower <span className="text-gradient">Calendar</span></h1>
          <p className="text-white/50 text-sm">Complete guide to every major meteor shower of 2026</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search showers or constellations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'upcoming', 'past'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium font-space capitalize transition-all ${
                  filter === f
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => setSortBy(s => s === 'date' ? 'zhr' : 'date')}
              className="px-3 py-2 rounded-lg text-xs font-medium font-space text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent flex items-center gap-1 transition-all"
            >
              <Filter size={11} />
              {sortBy === 'date' ? 'By ZHR' : 'By Date'}
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((s, i) => {
              const status = getShowerStatus(s);
              const isWatched = watched.some(w => w.id === s.id);
              const intensityPct = Math.min((s.zhr / 150) * 100, 100);

              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card p-5 rounded-2xl group relative overflow-hidden"
                >
                  {status === 'active' && <MeteorVisualizer zhr={s.zhr} active />}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                        status === 'active'   ? 'badge-active' :
                        status === 'upcoming' ? 'badge-upcoming' : 'badge-past'
                      }`}>
                        {status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => {
                          toggleWatch(s);
                          addNotification({ title: isWatched ? 'Removed from watchlist' : `Watching ${s.name}`, message: `Peak: ${formatDate(s.peak)}`, type: 'success' });
                        }}
                        className={`p-1.5 rounded-lg transition-all ${isWatched ? 'text-blue-400 bg-blue-500/15' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
                        title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        {isWatched ? <Bell size={13} className="animate-pulse" /> : <Bell size={13} />}
                      </button>
                    </div>

                    <h3 className="text-lg font-bold font-space mb-0.5 group-hover:text-blue-300 transition-colors">{s.name}</h3>
                    <p className="text-[10px] font-mono text-white/35 mb-3">
                      Peak: {new Date(s.peak).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-white/50 mb-4 line-clamp-2 leading-relaxed">{s.description}</p>

                    {/* Intensity bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-[10px] text-white/32 mb-1.5 font-mono">
                        <span>Intensity</span>
                        <span className="text-orange-400 font-semibold">{s.zhr} ZHR</span>
                      </div>
                      <div className="intensity-bar">
                        <motion.div
                          className="intensity-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${intensityPct}%` }}
                          transition={{ delay: i * 0.05 + 0.3, duration: 0.8 }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white/30 flex items-center gap-1">
                          <Compass size={10} /> {s.constellation}
                        </span>
                        {s.speed && (
                          <span className="text-[10px] text-white/30 flex items-center gap-1">
                            <Gauge size={10} /> {s.speed} km/s
                          </span>
                        )}
                      </div>
                      <Link
                        to={`/shower/${s.id}`}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-space font-semibold transition-colors"
                      >
                        Details <ChevronRight size={10} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Sparkles size={32} className="text-white/12 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No showers match your search</p>
          </div>
        )}
      </motion.div>
    </div>
    </>
  );
}

// ─── SHOWER DETAIL PAGE ───────────────────────────────────────────────────────
function ShowerDetail({ watched, toggleWatch }: { watched: WatchedShower[]; toggleWatch: (s: MeteorShower) => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shower = showers.find(s => s.id === id);

  if (!shower) {
    return (
      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 text-center">
        <AlertTriangle size={40} className="text-orange-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Shower not found</h2>
        <button onClick={() => navigate('/calendar')} className="btn-primary mt-4">
          <ArrowRight size={13} /> Back to Calendar
        </button>
      </div>
    );
  }

  const status    = getShowerStatus(shower);
  const isWatched = watched.some(w => w.id === shower.id);
  const daysUntil = getDaysUntilPeak(shower);

  const peakYear = new Date(shower.peak).getFullYear();
  const shareUrl = `https://www.stargaze.io/shower/${shower.id}`;
  const shareText = `${shower.name} meteor shower peaks ${formatDate(shower.peak)} with up to ${shower.zhr} meteors/hour. Track it live:`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": `${shower.name} Meteor Shower ${peakYear}`,
    "description": shower.description,
    "startDate": shower.start,
    "endDate": shower.end,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
    "location": { "@type": "VirtualLocation", "url": shareUrl },
    "url": shareUrl,
    "organizer": { "@type": "Organization", "name": "Stargaze", "url": "https://www.stargaze.io" }
  };

  return (
    <>
      <title>{shower.name} Meteor Shower {peakYear}: Peak Date, Times &amp; Viewing Guide | Stargaze</title>
      <meta name="description" content={`${shower.name} ${peakYear} peaks on ${formatDate(shower.peak)} with up to ${shower.zhr} meteors per hour. Full viewing guide, peak times, weather conditions, and live tracking.`} />
      <meta property="og:title" content={`${shower.name} Meteor Shower ${peakYear} | Stargaze`} />
      <meta property="og:description" content={`Peaks ${formatDate(shower.peak)} with up to ${shower.zhr} meteors/hour. Free live tracking and viewing guide.`} />
      <meta property="og:url" content={shareUrl} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={`${shower.name} Meteor Shower ${peakYear}`} />
      <meta name="twitter:description" content={`Peaks ${formatDate(shower.peak)} — up to ${shower.zhr}/hr. Free tracking at stargaze.io`} />
      <link rel="canonical" href={shareUrl} />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    <div className="relative z-10 max-w-5xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 mb-6 transition-colors"
        >
          <ChevronRight size={12} className="rotate-180" />
          Back
        </button>

        {/* Header card */}
        <div className="glass-card p-6 sm:p-8 rounded-2xl relative overflow-hidden mb-6">
          <MeteorVisualizer zhr={shower.zhr} active={status === 'active'} />
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                status === 'active' ? 'badge-active' : status === 'upcoming' ? 'badge-upcoming' : 'badge-past'
              }`}>{status.toUpperCase()}</span>
              {shower.parent && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/5 text-white/40 border border-white/10">
                  {shower.parent}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-space mb-3 text-gradient">{shower.name}</h1>
            <p className="text-white/50 text-base leading-relaxed max-w-2xl mb-6">{shower.description}</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => toggleWatch(shower)} className={isWatched ? 'btn-secondary' : 'btn-primary'}>
                {isWatched ? <><BellOff size={13} /> Unwatch</> : <><Bell size={13} /> Watch Peak</>}
              </button>
              <Link to="/live" className="btn-secondary">
                <Radio size={13} /> Report Sighting
              </Link>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Peak Date',    value: formatDate(shower.peak),                             icon: Calendar, color: 'text-blue-400' },
            { label: 'ZHR',          value: `${shower.zhr}/hr`,                                 icon: Activity, color: 'text-orange-400' },
            { label: 'Speed',        value: shower.speed ? `${shower.speed} km/s` : 'N/A',      icon: Gauge,    color: 'text-purple-400' },
            { label: 'Days Until',   value: daysUntil > 0 ? `${daysUntil}d` : status === 'active' ? 'Now!' : 'Past', icon: Clock, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card p-4 rounded-xl text-center">
              <Icon size={16} className={`${color} mx-auto mb-2`} />
              <p className="text-sm font-bold font-space">{value}</p>
              <p className="text-[10px] text-white/32 uppercase tracking-wider font-mono mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Activity Window */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold font-space text-white/70 mb-4 flex items-center gap-2">
              <Calendar size={13} className="text-blue-400" /> Activity Window
            </h3>
            <div className="space-y-1">
              {[
                { label: 'Start', val: formatDate(shower.start) },
                { label: 'Peak',  val: formatDate(shower.peak)  },
                { label: 'End',   val: formatDate(shower.end)   },
              ].map(({ label, val }) => (
                <div key={label} className="stat-row">
                  <span className="text-white/40 text-xs font-mono">{label}</span>
                  <span className="text-white/82 text-xs font-semibold">{val}</span>
                </div>
              ))}
            </div>
            {daysUntil > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <CountdownTimer targetDate={shower.peak} label="Time to Peak" />
              </div>
            )}
          </div>

          {/* Technical Data */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold font-space text-white/70 mb-4 flex items-center gap-2">
              <Star size={13} className="text-purple-400" /> Technical Data
            </h3>
            <div className="space-y-1">
              {[
                { label: 'Parent Body',     val: shower.parent || 'Unknown' },
                { label: 'Constellation',   val: shower.constellation },
                { label: 'Orbital Period',  val: shower.orbitalPeriod || 'Unknown' },
                { label: 'Composition',     val: shower.composition || 'Unknown' },
                { label: 'Entry Speed',     val: shower.speed ? `${shower.speed} km/s` : 'Unknown' },
              ].map(({ label, val }) => (
                <div key={label} className="stat-row">
                  <span className="text-white/40 text-xs font-mono">{label}</span>
                  <span className="text-white/82 text-xs font-semibold text-right max-w-[55%]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Viewing Tips */}
        {shower.viewingTips && (
          <div className="glass-card p-5 rounded-2xl mb-4">
            <h3 className="text-sm font-semibold font-space text-white/70 mb-3 flex items-center gap-2">
              <Eye size={13} className="text-green-400" /> Viewing Tips
            </h3>
            <p className="text-sm text-white/55 leading-relaxed">{shower.viewingTips}</p>
          </div>
        )}

        {/* Historical Notes */}
        {(shower.historicalStorms || shower.historicalVisibility) && (
          <div className="glass-card p-5 rounded-2xl mb-4">
            <h3 className="text-sm font-semibold font-space text-white/70 mb-3 flex items-center gap-2">
              <BarChart2 size={13} className="text-orange-400" /> Historical Notes
            </h3>
            {shower.historicalStorms && (
              <div className="mb-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-mono mb-1">Historical Storms</p>
                <p className="text-sm text-white/55 leading-relaxed">{shower.historicalStorms}</p>
              </div>
            )}
            {shower.historicalVisibility && (
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-mono mb-1">Visibility Notes</p>
                <p className="text-sm text-white/55 leading-relaxed">{shower.historicalVisibility}</p>
              </div>
            )}
          </div>
        )}

        {/* Share this shower */}
        <div className="glass-card p-5 rounded-2xl mt-4">
          <h3 className="text-sm font-semibold font-space text-white/70 mb-3 flex items-center gap-2">
            <Send size={13} className="text-blue-400" /> Share This Shower
          </h3>
          <p className="text-xs text-white/40 mb-4">Help others catch the {shower.name} this year</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(29,155,240,0.12)', border: '1px solid rgba(29,155,240,0.25)', color: '#1d9bf0' }}
            >
              𝕏 Share on X
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.22)', color: '#25d366' }}
            >
              💬 WhatsApp
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(24,119,242,0.10)', border: '1px solid rgba(24,119,242,0.22)', color: '#4267B2' }}
            >
              f Facebook
            </a>
            <button
              onClick={() => { navigator.clipboard.writeText(shareUrl); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
            >
              <ExternalLink size={11} /> Copy Link
            </button>
          </div>
        </div>

        {/* SEO content block */}
        <div className="mt-8 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 className="text-base font-bold font-space mb-3 text-white/80">About the {shower.name} {peakYear}</h2>
          <p className="text-sm text-white/45 leading-relaxed mb-3">
            The {shower.name} meteor shower peaks on <strong className="text-white/65">{formatDate(shower.peak)}</strong> with
            a maximum rate of <strong className="text-white/65">up to {shower.zhr} meteors per hour</strong> under ideal dark-sky conditions.
            The radiant point sits in the constellation {shower.constellation}.
          </p>
          <p className="text-sm text-white/45 leading-relaxed">
            Active from {formatDate(shower.start)} through {formatDate(shower.end)}, the shower is caused by Earth passing through
            debris left behind by {shower.parent || 'its parent body'}.
            {shower.speed ? ` Meteors enter the atmosphere at ${shower.speed} km/s.` : ''}
          </p>
        </div>
      </motion.div>
    </div>
    </>
  );
}

// ─── LIVE FEED PAGE ───────────────────────────────────────────────────────────
// Helper: turn a timestamp into a relative "X min ago" string
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return 'Just now';
  if (s < 3600) return `${Math.floor(s/60)} min ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// Seed data (these are example/demo reports to show the page isn't empty)
const SEED_REPORTS: SightingReport[] = [
  { id: 's1', time: '', location: 'Colorado, USA',      magnitude: '-2', duration: '3s', type: 'fireball', verified: true,  timestamp: Date.now() - 7*3600000  },
  { id: 's2', time: '', location: 'Ontario, Canada',    magnitude: '1',  duration: '1s', type: 'meteor',   verified: true,  timestamp: Date.now() - 11*3600000 },
  { id: 's3', time: '', location: 'Bavaria, Germany',   magnitude: '-4', duration: '5s', type: 'bolide',   verified: false, timestamp: Date.now() - 18*3600000 },
  { id: 's4', time: '', location: 'New South Wales, AU',magnitude: '0',  duration: '2s', type: 'meteor',   verified: true,  timestamp: Date.now() - 22*3600000 },
  { id: 's5', time: '', location: 'Hokkaido, Japan',    magnitude: '-1', duration: '2s', type: 'fireball', verified: true,  timestamp: Date.now() - 26*3600000 },
];

function LiveFeed({ addNotification }: { addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void }) {
  // Load user-submitted sightings from localStorage, merge with seed data
  const [reports, setReports] = useState<SightingReport[]>(() => {
    try {
      const saved: SightingReport[] = JSON.parse(localStorage.getItem('stargaze_live_reports') || '[]');
      return [...saved, ...SEED_REPORTS];
    } catch { return SEED_REPORTS; }
  });

  // Live-update relative timestamps every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const [form, setForm] = useState({ location: '', magnitude: '', duration: '', type: 'meteor', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location || !form.magnitude) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 700));
    const newReport: SightingReport = {
      id: Date.now().toString(),
      time: '',
      location: form.location,
      magnitude: form.magnitude,
      duration: form.duration || '—',
      type: form.type as any,
      verified: false,
      timestamp: Date.now(),
    };
    // Save to localStorage (only user-submitted, not seed data)
    try {
      const saved: SightingReport[] = JSON.parse(localStorage.getItem('stargaze_live_reports') || '[]');
      localStorage.setItem('stargaze_live_reports', JSON.stringify([newReport, ...saved].slice(0, 50)));
    } catch {}
    setReports(prev => [newReport, ...prev]);
    setForm({ location: '', magnitude: '', duration: '', type: 'meteor', notes: '' });
    setSubmitting(false);
    addNotification({ title: '🌠 Sighting Logged!', message: `Your ${form.type} from ${form.location} has been added.`, type: 'success' });
  };

  const typeConfig: Record<string, { color: string; bg: string; border: string }> = {
    meteor:   { color: 'text-blue-400',   bg: 'rgba(79,142,247,0.08)',  border: 'rgba(79,142,247,0.15)'  },
    fireball: { color: 'text-orange-400', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.15)' },
    bolide:   { color: 'text-red-400',    bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.15)'  },
  };

  return (
    <>
      <title>Live Meteor Sighting Reports | Submit Your Fireball &amp; Meteor Sightings | Stargaze</title>
      <meta name="description" content="Saw a fireball or meteor? Log your sighting and browse real-time reports from observers across the UK, US, and worldwide. Free community meteor tracker." />
      <meta property="og:title" content="Live Meteor Sighting Reports | Stargaze" />
      <meta property="og:description" content="Log meteor and fireball sightings and browse reports from observers worldwide. Free community tracker." />
      <link rel="canonical" href="https://stargaze.io/live" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <p className="section-label text-green-400 mb-2">Community Reports</p>
          <h1 className="text-4xl font-bold font-space mb-2">Live <span className="text-gradient">Sighting Feed</span></h1>
          <p className="text-white/50 text-sm">Real-time meteor sighting reports from observers worldwide</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Feed */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-4">
              <span className="live-dot" />
              <span className="text-xs font-mono text-white/50">{reports.length} reports today</span>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {reports.map((r, i) => {
                  const cfg = typeConfig[r.type] || typeConfig.meteor;
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass-card p-4 rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full border font-mono ${cfg.color}`}
                              style={{ background: cfg.bg, borderColor: cfg.border }}
                            >
                              {r.type}
                            </span>
                            <span className="text-[10px] text-white/35 font-mono">Mag {r.magnitude}</span>
                            {r.verified && (
                              <span className="flex items-center gap-0.5 text-[10px] text-green-400 font-mono">
                                <CheckCircle size={10} /> verified
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                            <span className="flex items-center gap-1"><MapPin size={9} />{r.location}</span>
                            <span className="text-white/18">·</span>
                            <span className="flex items-center gap-1"><Clock size={9} />{timeAgo(r.timestamp)}</span>
                            <span className="text-white/18">·</span>
                            <span>{r.duration}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Submit form */}
          <div className="lg:col-span-2">
            <div className="glass-card p-5 rounded-2xl sticky top-24">
              <h3 className="text-sm font-bold font-space mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/12 border border-blue-500/22 flex items-center justify-center">
                  <Plus size={12} className="text-blue-400" />
                </div>
                Submit a Sighting
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Location *</label>
                  <input
                    type="text"
                    placeholder="City, Country"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Magnitude *</label>
                    <input
                      type="number"
                      placeholder="-3"
                      value={form.magnitude}
                      onChange={e => setForm(f => ({ ...f, magnitude: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Duration</label>
                    <input
                      type="text"
                      placeholder="3s"
                      value={form.duration}
                      onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                    className="input-field"
                  >
                    <option value="meteor">Meteor</option>
                    <option value="fireball">Fireball (mag &lt; -3)</option>
                    <option value="bolide">Bolide (explosive)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Notes</label>
                  <textarea
                    placeholder="Color, train, sounds..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="input-field h-20 resize-none"
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
                  {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </form>
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] text-white/25 leading-relaxed">
                  Reports are reviewed before being marked as verified. All submissions are anonymous.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
}

// ─── GLOBE PAGE ───────────────────────────────────────────────────────────────
function GlobePage() {
  // Decode shareable URL: /globe?solar=1&z=22&type=planet&name=Jupiter
  const searchParams = new URLSearchParams(window.location.search);
  const initView = searchParams.get('solar') === '1' ? 'solar' : 'earth';
  const initZoom = parseFloat(searchParams.get('z') ?? '0') || null;
  const initSelect = searchParams.get('name') || null;
  const initType  = (searchParams.get('type') ?? '') as 'planet' | 'comet' | '';

  const [view, setView] = useState<'earth' | 'solar'>(initView);

  return (
    <>
      <title>3D Solar System &amp; Live Satellite Tracker | Stargaze</title>
      <meta name="description" content="Interactive 3D globe showing live satellite positions, space debris, and real-time meteor radiant points. Zoom out to explore the full solar system with live planetary positions." />
      <meta property="og:title" content="3D Solar System &amp; Satellite Tracker | Stargaze" />
      <meta property="og:description" content="Real-time satellite tracking and 3D solar system explorer. See exactly where every planet is right now, and how meteor showers form." />
      <link rel="canonical" href="https://stargaze.io/globe" />

    {/* View toggle — floats above both layers */}
    <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1 rounded-2xl"
      style={{ background: 'rgba(5,5,15,0.82)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
      <button
        onClick={() => setView('earth')}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
          view === 'earth'
            ? 'bg-blue-600/80 text-white shadow-lg'
            : 'text-white/45 hover:text-white/70'
        }`}>
        <Globe size={12} />
        Earth Globe
      </button>
      <button
        onClick={() => setView('solar')}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
          view === 'solar'
            ? 'bg-purple-600/80 text-white shadow-lg'
            : 'text-white/45 hover:text-white/70'
        }`}>
        <Sparkles size={12} />
        Solar System
      </button>
    </div>

    <div className="relative z-10 pt-16 h-screen flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        {/* Earth globe layer */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${view === 'earth' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <Suspense fallback={<PageLoader />}><CesiumGlobe /></Suspense>
        </div>
        {/* Solar system layer */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${view === 'solar' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {view === 'solar' && <Suspense fallback={<PageLoader />}><SolarSystemViewer initZoom={initZoom} initSelectName={initSelect} initSelectType={initType || undefined} /></Suspense>}
        </div>
      </div>
    </div>
    </>
  );
}

// ─── SKY PAGE ─────────────────────────────────────────────────────────────────
function SkyPage() {
  return (
    <>
      <title>Tonight's Night Sky | Live Star Map &amp; Meteor Radiant Finder | Stargaze</title>
      <meta name="description" content="Live 3D night sky view from your location. See which stars are visible tonight, where meteor shower radiants are, and your local seeing conditions." />
      <link rel="canonical" href="https://stargaze.io/sky" />
    <div className="relative z-10 pt-16 h-screen flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <Suspense fallback={<PageLoader />}><SkyView /></Suspense>
      </div>
    </div>
    </>
  );
}

// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────
function About() {
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Open user's email client with pre-filled message
    const subject = encodeURIComponent(`Stargaze Feedback from ${formState.name}`);
    const body = encodeURIComponent(`Name: ${formState.name}\nEmail: ${formState.email}\n\n${formState.message}`);
    window.open(`mailto:blackshotsgeneralstore@gmail.com?subject=${subject}&body=${body}`, '_blank');
    setSent(true);
  };

  const features = [
    { icon: Activity,   title: 'Real-Time Data',       desc: 'Meteor shower tracking sourced directly from IMO and NASA. Updates continuously.' },
    { icon: Globe,      title: '3D Globe',              desc: 'Interactive globe showing live satellites, debris fields, and meteor radiant positions.' },
    { icon: Navigation, title: 'ISS Tracking',          desc: 'Watch the International Space Station move across the globe in real time, updated every 5 seconds.' },
    { icon: Cloud,      title: 'Sky Conditions',        desc: 'Your local cloud cover and seeing conditions pulled from Open-Meteo. No account needed.' },
    { icon: Users,      title: 'Sighting Reports',      desc: 'Log what you see and browse reports from observers around the world.' },
    { icon: Bell,       title: 'Peak Alerts',           desc: 'Watch any shower and get a notification when peak night is approaching.' },
  ];

  return (
    <>
      <title>About Stargaze | Free Meteor Shower Tracker Built for Stargazers</title>
      <meta name="description" content="Stargaze is a free meteor shower tracking platform with live data from NASA, IMO, CelesTrak, and Open-Meteo. No ads, no subscriptions, just the night sky." />
      <meta property="og:title" content="About Stargaze | Free Meteor Shower Tracker" />
      <meta property="og:description" content="Free meteor shower tracking with live NASA data, ISS positioning, and sky condition forecasts. No ads, no subscriptions." />
      <link rel="canonical" href="https://stargaze.io/about" />
    <div className="relative z-10 max-w-5xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-10">
          <p className="section-label text-purple-400 mb-2">About the Project</p>
          <h1 className="text-4xl font-bold font-space mb-3">Built for <span className="text-gradient">Stargazers</span></h1>
          <p className="text-white/50 leading-relaxed max-w-2xl">
            Stargaze is a free, open-source celestial tracking platform. We aggregate data from NASA, IMO, CelesTrak,
            Open-Meteo, and more to bring you real-time meteor shower tracking without subscriptions or ads.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-5 rounded-2xl group hover:border-blue-500/20 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-blue-500/12 border border-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/18 transition-colors">
                <Icon size={16} className="text-blue-400" />
              </div>
              <h3 className="text-sm font-bold font-space mb-1">{title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Data Sources */}
        <div className="glass-card p-5 rounded-2xl mb-6">
          <h2 className="text-base font-bold font-space mb-4">Data Sources</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: 'NASA APOD',    url: 'https://apod.nasa.gov',    desc: 'Astronomy Picture of the Day' },
              { name: 'IMO',          url: 'https://www.imo.net',       desc: 'Meteor shower calendar data' },
              { name: 'CelesTrak',    url: 'https://celestrak.org',     desc: 'Satellite & debris TLE data' },
              { name: 'Open-Meteo',   url: 'https://open-meteo.com',    desc: 'Weather forecasts' },
              { name: 'WhereTheISS',  url: 'https://wheretheiss.at',    desc: 'ISS live position' },
            ].map(({ name, url, desc }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                className="p-3 rounded-xl hover:bg-white/5 transition-colors group border border-white/5 hover:border-white/10"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <p className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 flex items-center gap-1">
                  {name} <ExternalLink size={9} />
                </p>
                <p className="text-[10px] text-white/35 mt-0.5">{desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-base font-bold font-space mb-4">Get in Touch</h2>
          {sent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={24} className="text-green-400" />
              </div>
              <p className="text-sm font-semibold">Message sent!</p>
              <p className="text-xs text-white/40 mt-1">We'll get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Name</label>
                  <input type="text" value={formState.name} onChange={e => setFormState(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Your name" required />
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Email</label>
                  <input type="email" value={formState.email} onChange={e => setFormState(f => ({ ...f, email: e.target.value }))} className="input-field" placeholder="you@email.com" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1.5">Message</label>
                <textarea value={formState.message} onChange={e => setFormState(f => ({ ...f, message: e.target.value }))} className="input-field h-24 resize-none" placeholder="Bug reports, feature requests, general feedback..." required />
              </div>
              <button type="submit" className="btn-primary">
                <Send size={13} /> Send Message
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
    </>
  );
}

// ─── PRIVACY POLICY ───────────────────────────────────────────────────────────
function PrivacyPolicy() {
  return (
    <>
      <title>Privacy Policy | Stargaze</title>
      <meta name="description" content="Read the Stargaze privacy policy. We are committed to protecting your data and your privacy while you explore the night sky with us." />
      <link rel="canonical" href="https://stargaze.io/privacy" />
    <div className="relative z-10 max-w-3xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-blue-500/12 border border-blue-500/22 flex items-center justify-center">
            <Shield size={16} className="text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold font-space">Privacy Policy</h1>
        </div>
        <p className="text-xs text-white/30 font-mono mb-8">Last updated: January 2026</p>
        <div className="glass-card p-6 rounded-2xl space-y-6">
          {[
            { h: 'Information We Collect',     p: 'We collect minimal information necessary to provide our services. This may include location data (if you grant permission) to show local meteor visibility and weather conditions. We do not collect personal information without consent.' },
            { h: 'How We Use Your Information', p: 'Location data is used solely to fetch local weather and observing conditions from Open-Meteo. This data is sent directly from your browser to the weather API and is not stored on our servers.' },
            { h: 'Third-Party Services',        p: 'Stargaze uses NASA\'s APOD API, Open-Meteo, CelesTrak, and WhereTheISS. These are external services with their own privacy policies. No personal data is shared with these services beyond what is required for their API calls.' },
            { h: 'Cookies',                     p: 'We use localStorage to save your watchlist preferences. No tracking cookies or advertising cookies are used.' },
            { h: 'Contact',                     p: 'Questions about this policy? Use the contact form on the About page.' },
          ].map(({ h, p }) => (
            <div key={h}>
              <h2 className="text-sm font-bold text-white/82 mb-2">{h}</h2>
              <p className="text-sm text-white/50 leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
    </>
  );
}

// ─── TERMS OF SERVICE ─────────────────────────────────────────────────────────
function TermsOfService() {
  return (
    <>
      <title>Terms of Service | Stargaze</title>
      <meta name="description" content="Read the Stargaze terms of service. Learn about usage rights, accuracy disclaimers, and community guidelines for the Stargaze platform." />
      <link rel="canonical" href="https://stargaze.io/terms" />
    <div className="relative z-10 max-w-3xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-purple-500/12 border border-purple-500/22 flex items-center justify-center">
            <FileText size={16} className="text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold font-space">Terms of Service</h1>
        </div>
        <p className="text-xs text-white/30 font-mono mb-8">Last updated: January 2026</p>
        <div className="glass-card p-6 rounded-2xl space-y-6">
          {[
            { h: 'Acceptance of Terms',     p: 'By using Stargaze, you agree to these terms. It is a free educational tool, so please use it responsibly.' },
            { h: 'Use of Service',          p: 'Stargaze is provided free of charge for personal, non-commercial use. You may not attempt to disrupt, reverse-engineer, or misuse the service.' },
            { h: 'User-Submitted Content',  p: 'Sighting reports you submit may be displayed publicly. Submit only genuine observations. False reports may be removed.' },
            { h: 'Accuracy Disclaimer',     p: 'Celestial data (ZHR, peak dates, conditions) is provided for educational purposes. Real viewing conditions may vary. We make no guarantee of accuracy for time-sensitive decisions.' },
            { h: 'Third-Party Data',        p: 'We aggregate data from NASA, IMO, CelesTrak, and Open-Meteo. These sources may have their own terms regarding data reuse.' },
            { h: 'Changes',                 p: 'These terms may be updated periodically. Continued use constitutes acceptance of any changes.' },
          ].map(({ h, p }) => (
            <div key={h}>
              <h2 className="text-sm font-bold text-white/82 mb-2">{h}</h2>
              <p className="text-sm text-white/50 leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
    </>
  );
}

// ─── NOT FOUND (404) ─────────────────────────────────────────────────────────
function NotFound() {
  const navigate = useNavigate();
  return (
    <>
      <title>Page Not Found | Stargaze</title>
      <meta name="description" content="The page you're looking for doesn't exist or has moved. Return to the Stargaze meteor shower tracker." />
      <meta name="robots" content="noindex" />
    <div className="relative z-10 min-h-[75vh] flex flex-col items-center justify-center px-4 pt-20 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md">
        <p className="text-7xl mb-4 select-none leading-none">🔭</p>
        <p className="text-[7rem] font-bold font-mono leading-none text-white/6 select-none -mt-2 mb-4">404</p>
        <h1 className="text-3xl font-bold font-space mb-3 -mt-6">Lost in Space</h1>
        <p className="text-white/40 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
          That page drifted out of orbit. It may have moved, been removed, or never existed.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary">
            <ChevronRight size={14} className="rotate-180" /> Go Back
          </button>
          <Link to="/" className="btn-primary">
            <Sparkles size={14} /> Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
    </>
  );
}

// ─── SCROLL TO TOP ────────────────────────────────────────────────────────────
// ─── GEAR PAGE ────────────────────────────────────────────────────────────────
// Returns both UK and US affiliate links.
// UK: uses search URL because UK ASINs differ from US ones (direct dp/ links 404 on .co.uk).
// US: direct ASIN dp link.
function getAmazonUrls(asin: string, name: string): { uk: string; us: string } {
  return {
    uk: `https://www.amazon.co.uk/s?k=${encodeURIComponent(name)}&tag=space018-21`,
    us: `https://www.amazon.com/dp/${asin}?tag=stargazeio-20`,
  };
}

interface GearItem {
  id: string; name: string; description: string; why: string;
  price: string; ukPrice?: string; category: string; emoji: string;
  asin: string; badge?: string; badgeColor?: string; stars: number; reviews: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

const gearItems: GearItem[] = [
  // ── Telescopes ──────────────────────────────────────────────────────────────
  {
    id: 'nexstar-5se', category: 'Telescopes', emoji: '🔭', level: 'intermediate',
    name: 'Celestron NexStar 5SE',
    description: 'Motorized GoTo mount automatically locates and tracks over 40,000 celestial objects.',
    why: 'The best all-round computerised scope under £600. Set it up once, let it do the finding.',
    price: '$449', ukPrice: '£449', asin: 'B000HNBSBC',
    badge: 'Best All-Round', badgeColor: 'amber', stars: 4.5, reviews: '2,100+'
  },
  {
    id: 'heritage-130p', category: 'Telescopes', emoji: '🔭', level: 'beginner',
    name: 'Sky-Watcher Heritage 130P',
    description: 'Collapsible Dobsonian with a 130mm mirror. Huge aperture for the price.',
    why: 'No motor needed for meteor showers. Just point up and look. Easily the best value beginner scope out there.',
    price: '$159', ukPrice: '£149', asin: 'B004YIBVP8',
    badge: 'Best Value', badgeColor: 'green', stars: 4.6, reviews: '3,400+'
  },
  {
    id: 'starsense', category: 'Telescopes', emoji: '🔭', level: 'beginner',
    name: 'Celestron StarSense Explorer LT 114AZ',
    description: 'Uses your smartphone camera as a sky-alignment finder. Point at the sky and it tells you what you\'re looking at.',
    why: 'Ideal first scope. The app does the hard part of finding objects, so you can focus on looking.',
    price: '$149', ukPrice: '£139', asin: 'B08D1QMZG1',
    badge: 'Beginner Friendly', badgeColor: 'blue', stars: 4.3, reviews: '890+'
  },
  {
    id: 'dobsonian-8', category: 'Telescopes', emoji: '🔭', level: 'advanced',
    name: 'Sky-Watcher 8" Dobsonian',
    description: '200mm mirror delivers stunning views of planets, nebulae, and galaxies. Manual mount keeps it simple and robust.',
    why: 'More aperture means more photons. Once you\'re hooked on the Heritage 130P, this is the natural step up.',
    price: '$329', ukPrice: '£319', asin: 'B000X2T3Z2',
    badge: 'High Performance', badgeColor: 'purple', stars: 4.7, reviews: '1,800+'
  },
  // ── Binoculars ──────────────────────────────────────────────────────────────
  {
    id: 'skymaster', category: 'Binoculars', emoji: '👁️', level: 'beginner',
    name: 'Celestron SkyMaster 15x70',
    description: '70mm objective lenses pull in serious amounts of light. Tripod-adaptable for steady views.',
    why: 'Actually better than a small telescope for meteor showers. A wider field means you catch far more of the sky at once.',
    price: '$59', ukPrice: '£55', asin: 'B000JZXWWO',
    badge: 'Most Popular', badgeColor: 'amber', stars: 4.4, reviews: '8,200+'
  },
  {
    id: 'prooptic', category: 'Binoculars', emoji: '👁️', level: 'beginner',
    name: 'Bresser Astro 20x80 Binoculars',
    description: 'Giant 80mm objectives and 20x magnification for serious deep-sky sweeping.',
    why: 'Giant binoculars that show you the Milky Way band and star clusters in a way that will genuinely surprise you.',
    price: '$89', ukPrice: '£79', asin: 'B000C28HZS',
    badge: 'Deep Sky King', badgeColor: 'blue', stars: 4.3, reviews: '650+'
  },
  {
    id: 'bak4-compact', category: 'Binoculars', emoji: '👁️', level: 'beginner',
    name: 'Celestron Nature DX 10x50',
    description: 'Fully waterproof, nitrogen-purged 10x50 binoculars with BAK-4 prisms.',
    why: 'Great for daytime birding AND night-time sweeping. The most versatile pair on this list.',
    price: '$79', ukPrice: '£74', asin: 'B004GKZFOI',
    badge: 'Dual Use', badgeColor: 'green', stars: 4.5, reviews: '4,100+'
  },
  // ── Accessories ─────────────────────────────────────────────────────────────
  {
    id: 'red-light', category: 'Accessories', emoji: '🔦', level: 'beginner',
    name: 'LUXPRO Red LED Headlamp',
    description: 'Hands-free red light that preserves your night-adapted vision while reading charts or adjusting equipment.',
    why: 'White light destroys 30 minutes of dark adaptation in seconds. A red headlamp is non-negotiable.',
    price: '$16', ukPrice: '£14', asin: 'B07PD9KDZQ',
    badge: 'Essential', badgeColor: 'red', stars: 4.4, reviews: '12,000+'
  },
  {
    id: 'recliner', category: 'Accessories', emoji: '🪑', level: 'beginner',
    name: 'Coleman Camping Chair with Footrest',
    description: 'Reclining camp chair with integrated footrest. Look up at the sky without craning your neck.',
    why: 'The single biggest comfort upgrade for a meteor watch. Neck ache ruins any session.',
    price: '$52', ukPrice: '£48', asin: 'B002KHHKQY',
    badge: 'Pro Tip', badgeColor: 'amber', stars: 4.4, reviews: '6,800+'
  },
  {
    id: 'dew-heater', category: 'Accessories', emoji: '🌡️', level: 'intermediate',
    name: 'Astromania Telescope Dew Shield',
    description: 'Dew heater strips prevent moisture condensing on your eyepiece and objective on cold nights.',
    why: 'Dew kills a session in under an hour on UK autumn/winter nights. This is the solution.',
    price: '$38', ukPrice: '£35', asin: 'B001GVNB8C',
    badge: 'UK Essential', badgeColor: 'blue', stars: 4.2, reviews: '340+'
  },
  {
    id: 'collimation', category: 'Accessories', emoji: '🎯', level: 'intermediate',
    name: 'Astro Essentials Laser Collimator',
    description: '1.25" laser collimator for aligning Newtonian and Dobsonian telescope mirrors quickly and accurately.',
    why: 'A mis-collimated mirror blurs everything. Takes 2 minutes with a laser, 20 without.',
    price: '$29', ukPrice: '£25', asin: 'B07BS7XHWJ',
    badge: 'Quick Win', badgeColor: 'green', stars: 4.3, reviews: '2,100+'
  },
  // ── Books & Charts ──────────────────────────────────────────────────────────
  {
    id: 'turn-left', category: 'Books & Charts', emoji: '📚', level: 'beginner',
    name: 'Turn Left at Orion',
    description: 'Step-by-step guide to finding 100 deep-sky objects with a small telescope, written for beginners.',
    why: 'The best beginner telescope book ever written. Clear, practical, actually fun. Buy it alongside your first scope.',
    price: '$24', ukPrice: '£22', asin: 'B004GKZFOI',
    badge: 'Classic', badgeColor: 'amber', stars: 4.8, reviews: '3,200+'
  },
  {
    id: 'planisphere', category: 'Books & Charts', emoji: '🗺️', level: 'beginner',
    name: "Philip's Planisphere 51.5°N",
    description: 'Rotating star wheel calibrated for the UK and northern Europe. Shows exactly which stars are up, right now.',
    why: 'No battery, no signal, no screen glare. The most reliable star chart you\'ll ever own.',
    price: '$10', ukPrice: '£9', asin: '0540065641',
    badge: 'No Tech Needed', badgeColor: 'green', stars: 4.7, reviews: '1,500+'
  },
  {
    id: 'nightwatch', category: 'Books & Charts', emoji: '📚', level: 'beginner',
    name: 'NightWatch: A Practical Guide to Viewing the Universe',
    description: 'The most comprehensive beginner astronomy book available. Covers equipment, techniques, and 100 objects.',
    why: 'If Turn Left is the "how to find things" book, NightWatch is the "why everything is amazing" book.',
    price: '$30', ukPrice: '£28', asin: 'B000SEIPT2',
    badge: 'Highly Rated', badgeColor: 'purple', stars: 4.8, reviews: '2,800+'
  },
  // ── Astrophotography ────────────────────────────────────────────────────────
  {
    id: 'phone-adapter', category: 'Astrophotography', emoji: '📱', level: 'beginner',
    name: 'Gosky Universal Smartphone Adapter',
    description: 'Universal clip mounts your phone to any telescope eyepiece or binocular. Photograph what you see.',
    why: 'Zero learning curve. Clip on, align, snap. Great first step into astrophotography.',
    price: '$22', ukPrice: '£20', asin: 'B07BS7XHWJ',
    badge: 'Beginner Pick', badgeColor: 'green', stars: 4.1, reviews: '5,600+'
  },
  {
    id: 'star-tracker', category: 'Astrophotography', emoji: '⚙️', level: 'intermediate',
    name: 'Sky-Watcher Star Adventurer Mini',
    description: 'Compact motorized tracking mount that follows the rotation of Earth. Enables long-exposure shots without star trails.',
    why: 'The gateway to serious astrophotography. Pairs with any DSLR or mirrorless camera.',
    price: '$219', ukPrice: '£199', asin: 'B07DSKNHQF',
    badge: 'Serious Upgrade', badgeColor: 'purple', stars: 4.5, reviews: '1,200+'
  },
  {
    id: 'intervalometer', category: 'Astrophotography', emoji: '⏱️', level: 'intermediate',
    name: 'MIOPS Smart Camera Remote',
    description: 'Wireless intervalometer for time-lapse, bulb exposures, and HDR sequences. Works with Canon, Nikon, Sony.',
    why: 'Touching your camera during a long exposure causes blur. An intervalometer is the cure.',
    price: '$35', ukPrice: '£32', asin: 'B07PD9KDZQ',
    badge: 'Must Have', badgeColor: 'amber', stars: 4.3, reviews: '890+'
  },
];

// Star rating renderer
function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => {
        const filled = stars >= n;
        const half   = !filled && stars >= n - 0.5;
        return (
          <svg key={n} width="11" height="11" viewBox="0 0 24 24" fill={filled ? '#f59e0b' : half ? 'url(#half)' : 'none'} stroke="#f59e0b" strokeWidth="2">
            {half && <defs><linearGradient id="half"><stop offset="50%" stopColor="#f59e0b"/><stop offset="50%" stopColor="transparent"/></linearGradient></defs>}
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
        );
      })}
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  amber:  'text-amber-400 bg-amber-400/10 border-amber-400/25',
  green:  'text-green-400 bg-green-400/10 border-green-400/25',
  blue:   'text-blue-400 bg-blue-400/10 border-blue-400/25',
  purple: 'text-purple-400 bg-purple-400/10 border-purple-400/25',
  red:    'text-red-400 bg-red-400/10 border-red-400/25',
};

const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  beginner:     { label: 'Beginner',     color: 'text-green-400/70' },
  intermediate: { label: 'Intermediate', color: 'text-blue-400/70'  },
  advanced:     { label: 'Advanced',     color: 'text-purple-400/70' },
};

function GearPage() {
  const categories = [...new Set(gearItems.map(i => i.category))];
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [levelFilter, setLevelFilter] = useState<string>('All');


  const visibleItems = gearItems.filter(i =>
    (activeCategory === 'All' || i.category === activeCategory) &&
    (levelFilter === 'All' || i.level === levelFilter)
  );

  return (
    <>
      <title>Best Telescopes &amp; Astronomy Gear 2026 | UK &amp; US Buying Guide | Stargaze</title>
      <meta name="description" content="Best telescopes, binoculars, and stargazing gear for 2026. Hand-picked for UK and US buyers with Amazon links, star ratings, and honest expert notes for every budget." />
      <meta property="og:title" content="Astronomy Gear Guide 2026 | Stargaze" />
      <meta property="og:description" content="Best telescopes, binoculars, and accessories for stargazing. Every budget covered." />
      <link rel="canonical" href="https://stargaze.io/gear" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-5">
            <ShoppingBag size={12} className="text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold font-space uppercase tracking-widest">Gear Guide 2026</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-space font-bold text-white mb-4">
            The Right Gear Makes the Night
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto text-sm leading-relaxed">
            Hand-picked for meteor watchers and stargazers — from first-time buyers to serious astrophotographers.
            {' '}Links open on Amazon UK or US — both always shown. Small commission earned at no extra cost to you.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {['All', ...categories].map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold font-space border transition-all
                ${activeCategory === cat
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                  : 'border-white/8 text-white/45 hover:text-white/70 hover:border-white/15 bg-white/[0.02]'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Experience level filter */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {['All','beginner','intermediate','advanced'].map(lvl => (
            <button key={lvl} onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all capitalize
                ${levelFilter === lvl
                  ? 'bg-white/10 border-white/25 text-white/90'
                  : 'border-white/5 text-white/30 hover:text-white/55 hover:border-white/10 bg-transparent'}`}>
              {lvl === 'All' ? '✦ All levels' : `${lvl === 'beginner' ? '🌱' : lvl === 'intermediate' ? '⭐' : '🚀'} ${lvl}`}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <AnimatePresence mode="popLayout">
          {activeCategory === 'All' ? (
            // Grouped by category when showing all
            categories.map(cat => {
              const items = visibleItems.filter(i => i.category === cat);
              if (!items.length) return null;
              return (
                <motion.div key={cat} layout initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="mb-12">
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="text-base font-space font-semibold text-white/80 whitespace-nowrap">{cat}</h2>
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-xs text-white/30 font-mono">{items.length} picks</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map(item => <GearCard key={item.id} item={item} />)}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div layout initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
              {visibleItems.map(item => <GearCard key={item.id} item={item} />)}
            </motion.div>
          )}
        </AnimatePresence>

        {visibleItems.length === 0 && (
          <div className="text-center py-20 text-white/35">
            <p className="text-4xl mb-3">🔭</p>
            <p className="text-sm">No items match this filter combination.</p>
          </div>
        )}

        {/* Affiliate disclosure */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 text-center mt-4">
          <p className="text-xs text-white/28 leading-relaxed">
            <span className="text-white/40 font-medium">Affiliate disclosure:</span>{' '}
            Stargaze participates in the Amazon Associates Programme (UK: space018-21 · US: stargazeio-20).
            Purchases via links on this page earn us a small commission at no extra cost to you.
            Prices are approximate and may vary.
          </p>
        </div>
      </motion.div>
    </>
  );
}

function GearCard({ item }: { item: GearItem }) {
  const lvl = LEVEL_CONFIG[item.level];
  const badgeClass = BADGE_COLORS[item.badgeColor || 'amber'];
  const { uk, us } = getAmazonUrls(item.asin, item.name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="relative flex flex-col rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Top area */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Badge + level */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {item.badge ? (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${badgeClass}`}>
              {item.badge}
            </span>
          ) : <span />}
          <span className={`text-[10px] font-mono ${lvl.color} flex-shrink-0`}>{lvl.label}</span>
        </div>

        {/* Emoji icon */}
        <div className="text-4xl mb-3">{item.emoji}</div>

        {/* Name */}
        <h3 className="text-sm font-bold text-white leading-snug mb-2">{item.name}</h3>

        {/* Description */}
        <p className="text-xs text-white/42 leading-relaxed mb-3">{item.description}</p>

        {/* "Why" blurb */}
        <div className="mt-auto pt-3 border-t border-white/5">
          <p className="text-[11px] text-blue-300/60 leading-relaxed italic">"{item.why}"</p>
        </div>
      </div>

      {/* Ratings + price row */}
      <div className="px-5 pt-3 pb-2 flex items-center justify-between"
        style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <StarRating stars={item.stars} />
            <span className="text-[10px] text-white/35 font-mono">{item.reviews}</span>
          </div>
          <div className="flex items-center gap-2">
            {item.ukPrice && <span className="text-xs font-bold text-green-400">{item.ukPrice}</span>}
            <span className="text-xs font-bold text-green-400/60">{item.price}</span>
          </div>
        </div>
      </div>

      {/* Buy buttons — both UK and US */}
      <div className="px-4 pb-4 flex gap-2"
        style={{ background: 'rgba(0,0,0,0.15)' }}>
        <a href={uk} target="_blank" rel="noopener noreferrer sponsored"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all"
          style={{ background: 'rgba(247,153,58,0.12)', border: '1px solid rgba(247,153,58,0.25)', color: '#f79e3a' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,153,58,0.22)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(247,153,58,0.12)'; }}>
          🇬🇧 Amazon UK
        </a>
        <a href={us} target="_blank" rel="noopener noreferrer sponsored"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all"
          style={{ background: 'rgba(79,142,247,0.10)', border: '1px solid rgba(79,142,247,0.22)', color: '#6fa8f7' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(79,142,247,0.20)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(79,142,247,0.10)'; }}>
          🇺🇸 Amazon US
        </a>
      </div>
    </motion.div>
  );
}

// ─── PUSH NOTIFICATION BANNER ─────────────────────────────────────────────────
declare global { interface Window { OneSignalDeferred?: ((os: any) => void)[]; } }

function PushNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'denied'>('idle');

  useEffect(() => {
    // Show the banner 4 seconds after page load, only if not already dismissed
    const dismissed = sessionStorage.getItem('push_dismissed');
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem('push_dismissed', '1');
  };

  const subscribe = async () => {
    setStatus('loading');
    try {
      const os = (window as any).OneSignal;
      if (os) {
        await os.Notifications.requestPermission();
        const opted = os.User?.PushSubscription?.optedIn;
        setStatus(opted ? 'subscribed' : 'denied');
        if (opted) setTimeout(dismiss, 1500);
      } else {
        setStatus('denied');
      }
    } catch {
      setStatus('denied');
    }
  };

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-80 z-50"
    >
      <div className="bg-[#0d1117] border border-blue-500/25 rounded-2xl p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0 mt-0.5">
            <BellRing size={16} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-xs font-semibold text-white">Get meteor shower alerts</p>
              <button onClick={dismiss} className="text-white/25 hover:text-white/60 transition-colors shrink-0 -mt-0.5">
                <X size={14} />
              </button>
            </div>
            {status === 'subscribed' ? (
              <p className="text-xs text-green-400 flex items-center gap-1.5 mt-2">
                <CheckCircle size={12} /> You'll be notified before every peak!
              </p>
            ) : (
              <>
                <p className="text-xs text-white/40 leading-relaxed mb-3">
                  We'll ping you before the next shower peaks. One click, no spam.
                </p>
                <button
                  onClick={subscribe}
                  disabled={status === 'loading'}
                  className="w-full text-xs font-semibold bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white rounded-xl py-2 transition-colors"
                >
                  {status === 'loading' ? 'Enabling…' : '🔔 Enable alerts'}
                </button>
                {status === 'denied' && (
                  <p className="text-[10px] text-white/30 mt-2 leading-relaxed">
                    Blocked — allow notifications in your browser settings and reload.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [pathname]);
  return null;
}

// ─── ANIMATED ROUTES ─────────────────────────────────────────────────────────
// Routes must be inside a component that can call useLocation() so AnimatePresence
// receives a changing key on navigation — without this, enter/exit animations never fire.
function AnimatedRoutes({ watched, addNotification, toggleWatch }: {
  watched: WatchedShower[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void;
  toggleWatch: (s: MeteorShower) => void;
}) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"           element={<Home watched={watched} addNotification={addNotification} toggleWatch={toggleWatch} />} />
        <Route path="/calendar"   element={<MeteorCalendar watched={watched} toggleWatch={toggleWatch} addNotification={addNotification} />} />
        <Route path="/shower/:id" element={<ShowerDetail watched={watched} toggleWatch={toggleWatch} />} />
        <Route path="/live"       element={<LiveFeed addNotification={addNotification} />} />
        <Route path="/globe"      element={<GlobePage />} />
        <Route path="/sky"        element={<SkyPage />} />
        <Route path="/gear"       element={<GearPage />} />
        <Route path="/about"      element={<About />} />
        <Route path="/privacy"    element={<PrivacyPolicy />} />
        <Route path="/terms"      element={<TermsOfService />} />
        <Route path="/aurora"     element={<Suspense fallback={<PageLoader />}><AuroraPage /></Suspense>} />
        <Route path="/planets"    element={<Suspense fallback={<PageLoader />}><PlanetsPage /></Suspense>} />
        <Route path="/news"       element={<Suspense fallback={<PageLoader />}><NewsPage /></Suspense>} />
        <Route path="/iss"        element={<Suspense fallback={<PageLoader />}><ISSPage /></Suspense>} />
        <Route path="/settings"   element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
        <Route path="*"           element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [watched, setWatched] = useState<WatchedShower[]>(() => {
    try { return JSON.parse(localStorage.getItem('stargaze_watched') || '[]'); } catch { return []; }
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    localStorage.setItem('stargaze_watched', JSON.stringify(watched));
  }, [watched]);

  // Check for upcoming peaks on mount — max 1 notification to avoid spamming
  useEffect(() => {
    const checkPeaks = () => {
      // Prioritise the soonest shower with a peak within 48h
      const soonest = showers
        .filter(s => { const h = (new Date(s.peak).getTime() - Date.now()) / 3600000; return h > 0 && h < 48; })
        .sort((a, b) => new Date(a.peak).getTime() - new Date(b.peak).getTime())[0];
      if (soonest) {
        const h = Math.round((new Date(soonest.peak).getTime() - Date.now()) / 3600000);
        addNotification({
          title: `${soonest.name} Peak in ${h}h`,
          message: `Up to ${soonest.zhr} meteors/hour at peak. Clear skies!`,
          type: 'info',
        });
        return;
      }
      // Otherwise surface the highest-ZHR currently active shower
      const active = showers
        .filter(s => getShowerStatus(s) === 'active')
        .sort((a, b) => b.zhr - a.zhr)[0];
      if (active) {
        addNotification({
          title: `${active.name} is Active Now!`,
          message: `Up to ${active.zhr} meteors/hour. Go outside and look up!`,
          type: 'success',
        });
      }
    };
    const id = setTimeout(checkPeaks, 2000);
    return () => clearTimeout(id);
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp'>) => {
    const note: Notification = { ...n, id: Math.random().toString(36).slice(2), timestamp: Date.now() };
    setNotifications(prev => [note, ...prev.slice(0, 4)]);
    setTimeout(() => setNotifications(prev => prev.filter(x => x.id !== note.id)), 6000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const toggleWatch = useCallback((s: MeteorShower) => {
    setWatched(prev =>
      prev.some(w => w.id === s.id)
        ? prev.filter(w => w.id !== s.id)
        : [...prev, { id: s.id, name: s.name, watchedAt: Date.now() }]
    );
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen text-white relative">
        <div className="atmosphere" />
        <StarField />
        <ScrollToTop />
        <Navbar watched={watched} notifications={notifications} toggleWatch={toggleWatch} />
        <NotificationToasts notifications={notifications} dismiss={dismissNotification} />

        <AnimatedRoutes watched={watched} addNotification={addNotification} toggleWatch={toggleWatch} />

        <Footer />
        <PushNotificationBanner />
      </div>
    </BrowserRouter>
  );
}
