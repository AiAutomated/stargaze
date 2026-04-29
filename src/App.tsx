import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import {
  Sparkles, Star, Globe, Radio, Info, Menu, X, Home as HomeIcon,
  ChevronRight, ChevronDown, ArrowRight, Clock, Calendar, MapPin,
  Eye, EyeOff, Zap, Activity, Bell, BellOff, Send, Shield, FileText,
  RefreshCw, AlertTriangle, CheckCircle, ExternalLink, Rocket, Moon,
  Cloud, Wind, BarChart2, Users, MessageSquare, Plus, Search,
  Filter, TrendingUp, Navigation, Compass, Gauge, Thermometer
} from 'lucide-react';
import meteorShowers from './data/meteorShowers.json';
import CesiumGlobe from './components/CesiumGlobe';

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

// ─── Particle Field (Light Theme Optimized) ────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; r: number; a: number; da: number; color: string }[] = [];
    const colors = ['#FACC1530', '#3B82F615', '#FFFFFF08'];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        a: Math.random() * 0.5,
        da: (Math.random() - 0.5) * 0.005,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      particles.forEach(p => {
        p.a = Math.max(0.05, Math.min(0.6, p.a + p.da));
        if (p.a <= 0.05 || p.a >= 0.6) p.da *= -1;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.a;
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
    />
  );
}

// ─── Notification System ──────────────────────────────────────────────────────
function NotificationToasts({ notifications, dismiss }: { notifications: Notification[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed top-20 right-4 z-[160] flex flex-col gap-2 max-w-xs w-full">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            className="technical-panel flex items-start gap-3 p-4 rounded-xl border border-black/5"
          >
            {n.type === 'success' && <CheckCircle size={16} className="text-[#FACC15] flex-shrink-0 mt-0.5" />}
            {n.type === 'warning' && <AlertTriangle size={16} className="text-[#FACC15] flex-shrink-0 mt-0.5" />}
            {n.type === 'info'    && <Sparkles size={16} className="text-[#FACC15] flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">{n.title}</p>
              <p className="text-xs text-white/50 mt-0.5">{n.message}</p>
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



// ─── Sale Popup ─────────────────────────────────────────────────────────────
function SalePopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkVisibility = () => {
      const hiddenUntil = localStorage.getItem('stargaze_sale_hidden_until');
      if (!hiddenUntil || Date.now() > parseInt(hiddenUntil, 10)) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    checkVisibility();
    const interval = setInterval(checkVisibility, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    const hiddenUntil = Date.now() + 45 * 60 * 1000; // 45 Minutes re-display
    localStorage.setItem('stargaze_sale_hidden_until', hiddenUntil.toString());
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          className="fixed bottom-6 left-6 z-[200] max-w-sm w-full pointer-events-none"
        >
          <div className="technical-panel bg-black/90 backdrop-blur-2xl p-6 rounded-3xl border border-[#FACC15]/30 shadow-2xl shadow-[#FACC15]/10 relative overflow-hidden pointer-events-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FACC15] to-transparent" />
            
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FACC15]/20 flex items-center justify-center flex-shrink-0">
                <Rocket className="text-[#FACC15]" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-1">Stargaze Studio for Sale</h3>
                <p className="text-[10px] text-white/50 leading-relaxed mb-4">
                  The domain Stargaze.io and this entire celestial visualization platform are now available for acquisition.
                </p>
                <a 
                  href="https://www.atom.com/view/name/Stargaze.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#FACC15] text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                >
                  View Listing <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ watched, notifications }: { watched: WatchedShower[]; notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const links = [
    { to: '/', label: 'Observatory', icon: HomeIcon },
    { to: '/calendar', label: 'Meteor Shower', icon: Calendar },
    { to: '/globe', label: 'Globe', icon: Globe },
    { to: '/live', label: 'Live', icon: Radio },
  ];

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled ? 'py-4' : 'py-10'
      }`}
    >
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className={`glass-pro px-8 py-5 rounded-[26px] flex items-center justify-between transition-all duration-500 ${
          scrolled ? 'bg-black/40 scale-[0.98] shadow-2xl' : 'bg-transparent'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-[14px] bg-white flex items-center justify-center shadow-2xl shadow-white/10 group-hover:invert transition-all duration-500">
              <Sparkles size={20} className="text-black" />
            </div>
            <div>
              <span className="font-sans font-black text-white text-2xl tracking-[-0.08em] uppercase leading-none block">Stargaze</span>
              <span className="pro-mono mt-1 block">Celestial Guide</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {links.map((link) => {
              const active = pathname === link.to;
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-3 ${
                    active ? 'text-white' : 'text-white/30 hover:text-white'
                  }`}
                >
                  {/* <Icon size={14} className={active ? 'text-white' : ''} /> */}
                  <span>{link.label}</span>
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white/5 border border-white/10 rounded-full -z-10"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side icons */}
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex flex-col items-end">
              <div className="flex items-center gap-2 opacity-50">
                <span className="w-1.5 h-1.5 bg-[#FACC15] rounded-full intensity-active" />
                <span className="pro-mono !text-[9px]">Sensor Alpha-7 Active</span>
              </div>
            </div>
            
            <button className="hidden sm:flex w-11 h-11 rounded-full border border-white/10 items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all">
              <Search size={18} />
            </button>

            <Link 
              to="/live" 
              className="btn-pro !px-6 !py-3 !text-[11px] uppercase tracking-widest hidden sm:flex"
            >
              Live Tracking
            </Link>

            <button
              className="md:hidden text-white/60 hover:text-white p-2 rounded-full hover:bg-white/5 transition-all"
              onClick={() => setOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-nav border-t border-white/10 overflow-hidden mx-4 mt-2 rounded-2xl bg-black/90 backdrop-blur-3xl"
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              {links.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                    ${pathname === to
                      ? 'text-[#FACC15] bg-[#FACC15]/10 border border-[#FACC15]/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/5 mt-24 bg-black/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-8 py-24">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-16 mb-20">
          <div className="col-span-2">
             <Link to="/" className="flex items-center gap-3 mb-8 group">
               <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-white/5 transition-transform group-hover:scale-105 group-hover:invert duration-500">
                 <Sparkles size={18} className="text-black" />
               </div>
               <span className="font-sans font-black text-white text-xl tracking-tighter uppercase italic">
                 Stargaze
               </span>
             </Link>
             <p className="text-xs text-white/40 leading-relaxed font-medium max-w-xs mb-8">
               A professional celestial tracking system. We help you find exactly when and where to see the next meteor shower, track the ISS, and monitor global space events in real-time.
             </p>
            <div className="flex gap-4">
               {['Twitter', 'GitHub', 'Discord'].map(social => (
                 <div key={social} className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/20 hover:text-[#FACC15] hover:border-[#FACC15]/20 transition-all cursor-pointer">
                    <span className="text-[10px] font-black">{social[0]}</span>
                 </div>
               ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-8">Navigation</p>
            {[['/', 'Explorer'], ['/calendar', 'Meteor Shower'], ['/live', 'Community'], ['/globe', 'System View']].map(([to, label]) => (
              <Link key={to} to={to} className="block text-[11px] font-black text-white/30 hover:text-[#FACC15] mb-4 transition-all uppercase tracking-widest">{label}</Link>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-8">Sources</p>
            {[['https://www.imo.net', 'IMO Atlas'], ['https://api.nasa.gov', 'NASA Lab'], ['https://celestrak.org', 'CelesTrak Core']].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="block text-[11px] font-black text-white/30 hover:text-[#FACC15] mb-4 transition-all uppercase tracking-widest">{label}</a>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-8">Platform</p>
            {[['/privacy', 'Data Privacy'], ['/terms', 'Service Terms'], ['/about', 'Studio Info']].map(([to, label]) => (
              <Link key={to} to={to} className="block text-[11px] font-black text-white/30 hover:text-[#FACC15] mb-4 transition-all uppercase tracking-widest">{label}</Link>
            ))}
          </div>
        </div>
        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
            Stargaze Engine v4.2 — Built for the Scientific Community
          </p>
          <div className="flex items-center gap-6">
             <span className="w-1.5 h-1.5 bg-[#FACC15] rounded-full animate-pulse" />
             <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Global Status: Operational</p>
          </div>
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
      <p className="section-label mb-3">{label}</p>
      <div className="flex gap-2 sm:gap-3">
        {units.map(u => (
          <div key={u.label} className="flex flex-col items-center">
            <div
              className="rounded-2xl px-3 py-2 sm:px-4 sm:py-3 min-w-[56px] text-center bg-[#FACC15]/5 border border-[#FACC15]/10"
            >
              <span className="countdown-digit text-white">{u.val}</span>
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
    const spawnRate = active ? Math.max(3, Math.floor(zhr / 12)) : Math.max(1, Math.floor(zhr / 25));

    function spawn() {
      for (let i = 0; i < spawnRate; i++) {
        if (Math.random() < (active ? 0.4 : 0.2)) {
          meteors.push({
            x: Math.random() * canvas!.width,
            y: -20,
            vx: (Math.random() - 0.5) * 4 + (4 + Math.random() * 4), 
            vy: 4 + Math.random() * 6,
            life: 0,
            maxLife: 30 + Math.random() * 40,
            len: 30 + Math.random() * 60,
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
        grad.addColorStop(0, `rgba(250,204,21,${alpha * 0.9})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
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
  const [loading, setLoading] = useState(true);

  const fetchISS = useCallback(async () => {
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (!r.ok) throw new Error('Orbital signal lost');
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchISS();
    const id = setInterval(fetchISS, 5000);
    return () => clearInterval(id);
  }, [fetchISS]);

  return (
    <div className="h-full flex flex-col p-10 min-h-[400px] justify-between relative overflow-hidden">
      {/* Background Tech Detail */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FACC15]/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
      
      <div>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center">
              <Rocket size={24} className="text-[#FACC15]" />
            </div>
            <div>
              <p className="pro-mono !text-white !text-[10px]">ISS LIVE TRACKER</p>
              <p className="pro-mono !text-[#FACC15] !text-[8px] mt-1 italic tracking-[0.4em]">Z-Vector Mapping</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#FACC15]/5 border border-[#FACC15]/10 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <span className="text-[10px] text-[#FACC15] font-black tracking-widest uppercase">Live Signal</span>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center gap-6 py-12 text-center bg-red-500/5 rounded-3xl border border-red-500/20">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                <AlertTriangle size={28} className="text-red-500" />
            </div>
            <div>
              <p className="text-red-500 font-black uppercase text-sm mb-2">Connection Error</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest leading-relaxed">Orbital sync failed. Satellite link temporarily unreachable.</p>
            </div>
            <button onClick={fetchISS} className="px-6 py-2.5 bg-red-500/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all">Manual Sync</button>
          </div>
        ) : (loading || !iss) ? (
          <div className="flex flex-col items-center justify-center gap-6 py-20">
            <RefreshCw size={32} className="text-[#FACC15] animate-spin opacity-40" />
            <p className="pro-mono !text-white/20 italic">Calibrating Transponder...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: 'Latitude',  value: `${iss.latitude}°`,                   icon: MapPin,      color: '#FACC15' },
              { label: 'Longitude', value: `${iss.longitude}°`,                  icon: MapPin,      color: '#3B82F6' },
              { label: 'Altitude',  value: `${iss.altitude}`, unit: 'KM',         icon: TrendingUp,  color: '#A855F7' },
              { label: 'Velocity',  value: `${iss.velocity.toLocaleString()}`, unit: 'KM/H', icon: Zap, color: '#22C55E' },
            ].map(({ label, value, icon: Icon, unit, color }) => (
              <div key={label} className="bg-white/[0.03] border border-white/5 rounded-[32px] p-6 hover:bg-white/5 transition-all group overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: color }} />
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                    <Icon size={12} className="text-white/30" />
                  </div>
                  <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">{label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold font-mono text-white tracking-tighter">{value}</p>
                  {unit && <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
         <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.3em]">Hardware ID: ISS-42</p>
         <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.3em] italic">Station Alpha</p>
      </div>
    </div>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: 'What is the optimal observation window?', a: 'Peak visibility occurs between 02:00 and 05:00 local time. This is when the observer is strictly oriented towards the planetary trajectory vector, maximizing atmospheric intersection probability.' },
    { q: 'Is additional instrumentation required?', a: 'The human optical system is sufficient for wide-field meteor observation. We recommend a dark-site threshold (Bortle 1-3) and full scotopic adaptation (approximately 30 minutes in darkness).' },
    { q: 'Clarification of ZHR parameters?', a: 'Zenithal Hourly Rate (ZHR) is a normalized technical metric assuming an idealized radiant at zenith and a limiting magnitude of 6.5. Actual observed rates scale linearly with sky quality.' },
    { q: 'Why are these events cyclical?', a: 'Earth passes through stagnant debris streams—fragmentation remnants of cometary parent bodies—at fixed orbital intersections each year, creating high-fidelity temporal cycles.' },
  ];

  return (
    <div className="space-y-4">
      {faqs.map((f, i) => (
        <div key={i} className="technical-panel rounded-3xl overflow-hidden border-white/5 bg-white/[0.02]">
          <button
            className="w-full flex items-center justify-between p-6 text-left group transition-all"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-black text-white tracking-tight group-hover:text-[#FACC15] uppercase italic">{f.q}</span>
            <div className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center transition-all ${open === i ? 'bg-[#FACC15] text-black rotate-180' : 'text-white/20'}`}>
               <ChevronDown size={14} />
            </div>
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="px-6 pb-6 text-xs text-white/50 leading-relaxed font-medium border-t border-white/5 pt-4">
                  {f.a}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function ShootingStars() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ top: '-10%', left: `${20 + i * 8}%`, opacity: 0, scale: 0 }}
          animate={{ 
            top: '120%', 
            left: `${i * 8 - 10}%`, 
            opacity: [0, 0.8, 0],
            scale: [0.3, 1.2, 0.3]
          }}
          transition={{
            duration: 1.5 + Math.random() * 2.5,
            repeat: Infinity,
            delay: Math.random() * 15,
            ease: "easeIn"
          }}
          className={`absolute w-[1px] h-[150px] bg-gradient-to-t from-transparent ${i % 2 === 0 ? 'via-white/60' : 'via-[#FACC15]/60'} to-transparent rotate-[45deg] blur-[0.5px]`}
        />
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
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const nextShower = getNextShower();
  const moon = getMoonPhase();
  const [apod, setApod] = useState<{ title: string; url: string; explanation: string; media_type: string } | null>(null);
  const [apodLoading, setApodLoading] = useState(true);
  const [weather, setWeather] = useState<{ cloudCover: number; humidity: number; temp: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherDenied, setWeatherDenied] = useState(false);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    setApodLoading(true);
    fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY')
      .then(r => r.json())
      .then(d => { if (d.url || d.hdurl) setApod(d); })
      .catch(() => {})
      .finally(() => setApodLoading(false));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setWeatherDenied(true); return; }
    setWeatherLoading(true);
        navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=cloud_cover,relative_humidity_2m,temperature_2m&timezone=auto`);
          const d = await r.json();
          setWeather({ 
            cloudCover: d.current.cloud_cover, 
            humidity: d.current.relative_humidity_2m,
            temp: Math.round(d.current.temperature_2m)
          });
        } catch {}
        setWeatherLoading(false);
      },
      () => { setWeatherLoading(false); setWeatherDenied(true); }
    );
  }, []);

  const activeShowers  = showers.filter(s => getShowerStatus(s) === 'active');
  const upcomingShowers = showers.filter(s => getShowerStatus(s) === 'upcoming').slice(0, 3);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="cinematic-vignette" />
      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 pt-48 pb-32">

      {/* ── Hero ── */}
      <div className="flex flex-col items-center text-center mb-40 relative">
        <ShootingStars />
        {/* Cinematic Background Layer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="absolute -top-48 inset-x-0 -z-10 h-[120vh] pointer-events-none overflow-hidden"
        >
          <div className="absolute inset-0 bg-black/60 z-10" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent z-20" />
          
          {/* Generative Starfield Overlay */}
          <div className="absolute inset-0 z-0">
             {[...Array(20)].map((_, i) => (
               <motion.div
                 key={i}
                 initial={{ opacity: 0, scale: 0 }}
                 animate={{ opacity: [0, 0.4, 0], scale: [0.5, 1.2, 0.5] }}
                 transition={{ 
                   duration: 5 + Math.random() * 10, 
                   repeat: Infinity,
                   delay: Math.random() * 20
                 }}
                 className="absolute bg-white rounded-full blur-[40px]"
                 style={{
                   left: `${Math.random() * 100}%`,
                   top: `${Math.random() * 100}%`,
                   width: `${Math.random() * 300 + 100}px`,
                   height: `${Math.random() * 300 + 100}px`,
                   backgroundColor: i % 3 === 0 ? '#FACC1510' : (i % 3 === 1 ? '#3B82F610' : '#FFFFFF05')
                 }}
               />
             ))}
          </div>

          <motion.video 
            autoPlay 
            loop 
            muted 
            playsInline
            style={{ y }}
            className="w-full h-full object-cover grayscale opacity-20 scale-125"
          >
            <source src="https://assets.mixkit.co/videos/preview/mixkit-stars-in-the-night-sky-moving-slowly-3798-large.mp4" type="video/mp4" />
          </motion.video>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <span className="pro-mono !text-[#FACC15] !tracking-[0.6em] mb-6 block intensity-active">Optical Grade Clarity</span>
          <h1 className="hero-title">
            Stargaze. <br/>
            <span className="text-white/40 italic">Precision Orbital Tracking.</span>
          </h1>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1.5 }}
          className="text-xl text-white/30 max-w-3xl leading-relaxed font-medium mb-16 px-6"
        >
          The definitive technical observatory for mapping meteor trajectories, 
          orbital windows, and local atmospheric dynamics with cinematic fidelity.
        </motion.p>

        <div className="flex flex-wrap justify-center gap-8">
          <Link to="/globe" className="btn-pro">
            Open Configurator
          </Link>
          <Link to="/calendar" className="btn-pro-outline">
            The Chronicle
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 glass-pro-card p-0 overflow-hidden relative min-h-[600px]">
          <div className="absolute inset-0 z-0">
             <img 
               src="https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&q=80&w=2000" 
               className="w-full h-full object-cover grayscale opacity-40 mix-blend-screen" 
               alt="Deep space nebula visualization for celestial tracking" 
             />
             <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent" />
          </div>
          
          <div className="relative z-10 p-16 flex flex-col justify-end h-full">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-[1px] w-12 bg-white/20" />
              <p className="pro-mono">Celestial Synthesis v4.2</p>
            </div>
            
            <h2 className="text-5xl font-bold tracking-tight mb-8">
              Cinematic Simulation. <br/>
              <span className="text-white/30 italic">Pure hardware acceleration.</span>
            </h2>
            
            <p className="text-lg text-white/40 max-w-md leading-relaxed font-medium mb-12">
              Advanced tracking of orbital dynamics, meteor trajectories, and global atmospheric states.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="glass-pro-card p-0 overflow-hidden relative group">
            <ISSWidget />
          </div>
          <div className="glass-pro-card p-12 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-5 mb-12">
                <div className="w-14 h-14 pro-radius-sm bg-white/5 border border-white/10 flex items-center justify-center">
                  <Moon size={28} className="text-white/60" />
                </div>
                <div>
                  <p className="pro-mono !text-white">Lunar Integration</p>
                  <p className="pro-mono !text-[9px] mt-1 italic">Orbital Phase: Verified</p>
                </div>
              </div>
              <div className="flex items-center gap-10">
                <span className="text-8xl">{moon.emoji}</span>
                <div>
                  <p className="text-4xl font-bold tracking-tight">{moon.phase}</p>
                  <p className="pro-mono !text-[#FACC15] mt-2 !tracking-widest">{moon.illumination}% Luminous</p>
                </div>
              </div>
            </div>
            
            <div className="pt-12 mt-12 border-t border-white/5">
                <p className="pro-mono !text-[9px] mb-4">Luminescence Gradient</p>
                <div className="h-[1px] w-full bg-white/10 relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${moon.illumination}%` }}
                    className="absolute inset-y-0 left-0 bg-white"
                  />
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Cards ── */}
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-6 my-16"
      >
        {[
          { label: 'Active Showers', value: activeShowers.length.toString(), sub: 'In Orbit', icon: Activity },
          { label: 'System status', value: 'Alpha-7', sub: 'Operational', icon: Gauge },
          { label: 'Sky Clarity', value: weather ? `${100 - weather.cloudCover}%` : '—', sub: 'Optical Grade', icon: Eye },
          { label: 'Orbital Path', value: 'Locked', sub: 'Nadir Vector', icon: Navigation },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="glass-pro-card p-8 group hover:scale-[1.02]">
            <Icon size={18} className="text-white/40 mb-6 group-hover:text-white transition-colors" />
            <p className="text-3xl font-bold tracking-tight mb-1 text-white">{value}</p>
            <p className="pro-mono !text-[9px] !text-white/30">{label}</p>
          </div>
        ))}
      </motion.div>

    {/* ─── Main Grid: Countdown + ISS/Moon ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
        {/* Next Shower Countdown */}
        <div className="lg:col-span-2">
          {nextShower ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="glass-pro-card p-12 h-full relative overflow-hidden group"
            >
              <MeteorVisualizer zhr={nextShower.zhr} active />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between mb-12">
                    <span className="pro-mono !text-[#FACC15] !tracking-[0.4em]">Primary Event Sync</span>
                    {nextShower.speed && (
                      <span className="pro-mono !text-white/20">
                        Velocity: {nextShower.speed} km/s
                      </span>
                    )}
                  </div>
                  <h2 className="text-6xl font-bold tracking-tighter mb-4 group-hover:italic transition-all duration-1000">{nextShower.name}</h2>
                  <p className="text-xl text-white/30 max-w-lg mb-12 font-medium">
                    Intersection with {nextShower.constellation} constellation clusters. Expected frequency threshold: {nextShower.zhr} ZHR.
                  </p>
                </div>
                
                <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-end justify-between gap-8">
                  <div className="flex-1 w-full">
                    <CountdownTimer targetDate={nextShower.peak} label="Synchronization Window" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Link to={`/shower/${nextShower.id}`} className="btn-pro text-[10px]">
                      Analysis
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="glass-pro-card p-20 flex items-center justify-center h-full">
              <p className="pro-mono !text-white/20 italic text-xl">No active trajectories detected</p>
            </div>
          )}
        </div>

        {/* ISS + Moon Mini Column */}
        <div className="flex flex-col gap-8">
          <ISSWidget />
          <div className="glass-pro-card p-10 flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
               <div className="w-1.5 h-1.5 bg-[#FACC15] rounded-full intensity-active" />
               <span className="pro-mono !text-[9px]">Orbital Beacon</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed font-medium">
              The observatory is currently synchronizing with the latest lunar phase data and atmospheric clarity coefficients.
            </p>
            <div className="mt-8 pt-8 border-t border-white/5">
               <p className="pro-mono !text-[10px] text-white tracking-widest uppercase">Studio v2.5</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Showers ── */}
      {activeShowers.length > 0 && (
        <div className="mb-32">
          <div className="flex flex-col mb-12">
            <span className="pro-mono !text-[#FACC15] !tracking-[0.5em] mb-4 uppercase">Orbital Intersections</span>
            <h2 className="text-4xl font-bold tracking-tight text-white uppercase italic">Active Phase Monitoring</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeShowers.map(s => (
              <motion.div
                key={s.id}
                whileHover={{ y: -8 }}
                className="glass-pro-card p-12 group relative overflow-hidden h-full flex flex-col justify-between border-[#FACC15]/20 shadow-2xl shadow-black/10"
              >
                <MeteorVisualizer zhr={s.zhr} active />
                <div className="absolute inset-0 border-2 border-[#FACC15]/10 pro-radius intensity-active pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#FACC15]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-12">
                    <div className="px-4 py-2 pro-radius-sm bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#FACC15] rounded-full intensity-active" />
                      <span className="pro-mono !text-[#FACC15] !text-[9px]">ACTIVE</span>
                    </div>
                    <div className="text-right">
                       <p className="pro-mono !text-white/20 !text-[8px] mb-1">THRESHOLD</p>
                       <span className="text-2xl font-bold text-[#FACC15] font-mono tracking-tighter italic">{s.zhr} ZHR</span>
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold mb-4 text-white group-hover:tracking-wider transition-all duration-700 uppercase italic tracking-tighter">{s.name}</h3>
                  <div className="flex items-center gap-4 mb-8">
                     <div className="pro-radius-sm px-2 py-1 bg-white/5 border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest">{s.constellation}</div>
                     <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">Peak: {formatDate(s.peak)}</div>
                  </div>
                  <p className="text-sm text-white/30 mb-12 font-medium leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>
                <Link to={`/shower/${s.id}`} className="relative z-10 w-fit flex items-center gap-3 pro-mono !text-[#FACC15] hover:italic transition-all group/link font-black text-[10px] tracking-widest">
                  ACCESS DATA <ArrowRight size={14} className="group-hover/link:translate-x-2 transition-transform" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming Showers Widget ── */}
      <div className="mb-32">
        <div className="flex items-end justify-between mb-12">
          <div className="flex flex-col">
            <span className="pro-mono !text-[#FACC15] !tracking-[0.5em] mb-4 uppercase">Schedule Projection</span>
            <h2 className="text-4xl font-bold tracking-tight text-white uppercase italic tracking-tighter">Proximity Alerts</h2>
          </div>
          <Link to="/calendar" className="btn-pro-outline !px-8 !py-3 flex items-center gap-3 group/link italic">
            Full Chronicle <ChevronRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {upcomingShowers.map((s, i) => {
            const daysUntil = getDaysUntilPeak(s);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="glass-pro-card p-10 group relative overflow-hidden transition-all duration-500 border-white/5 hover:border-[#FACC15]/20 bg-white/[0.02]"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-12">
                    <div className="bg-[#FACC15]/5 border border-[#FACC15]/10 px-3 py-1.5 rounded-xl">
                      <span className="pro-mono !text-[#FACC15] !text-[9px] font-black uppercase">
                        T-MINUS {daysUntil}D
                      </span>
                    </div>
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
                       <Clock size={16} className="text-white/20 group-hover:text-[#FACC15] transition-colors" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter italic group-hover:text-[#FACC15] transition-colors">{s.name}</h3>
                  <p className="text-[10px] text-white/30 font-black tracking-[0.2em] uppercase mb-10">{s.constellation} SECTOR</p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-8 border-t border-white/5">
                    <div>
                       <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Peak Flux</p>
                       <p className="text-lg font-bold text-white font-mono tracking-tighter">{s.zhr} ZHR</p>
                    </div>
                    <div className="text-right">
                       <p className="text-white/20 text-[8px] font-black uppercase tracking-widest mb-1">Velocity</p>
                       <p className="text-lg font-bold text-white font-mono tracking-tighter">{s.speed || 40} KM/S</p>
                    </div>
                  </div>
                </div>

                <Link to={`/shower/${s.id}`} className="absolute inset-0 z-20" />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── NASA APOD ── */}
      <div className="mb-32">
        <div className="flex flex-col mb-12">
            <span className="pro-mono !text-[#FACC15] !tracking-[0.5em] mb-4">Cosmic Aperture</span>
            <h2 className="text-4xl font-bold tracking-tight text-white uppercase italic">Daily Celestial View</h2>
        </div>
        <div className="glass-pro-card !p-0 overflow-hidden min-h-[700px] group relative">
          {apodLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
              <RefreshCw size={32} className="text-white/20 animate-spin mb-6" />
              <p className="pro-mono !text-white/30 italic">Retrieving cosmic imagery…</p>
            </div>
          ) : apod ? (
            <div className="h-full flex flex-col">
              <div className="relative flex-1 group/img overflow-hidden min-h-[500px]">
                {apod.media_type === 'image' ? (
                  <img 
                    src={apod.url} 
                    alt={apod.title} 
                    className="w-full h-full object-cover grayscale brightness-75 group-hover/img:scale-105 transition-transform duration-[4000ms]" 
                  />
                ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center">
                    <ExternalLink size={40} className="text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                <div className="absolute bottom-12 left-12 right-12 z-10">
                   <p className="pro-mono !text-white/40 mb-2 italic">NASA ASTRONOMY DATA</p>
                   <h3 className="text-5xl font-bold tracking-tighter text-white uppercase italic">{apod.title}</h3>
                </div>
              </div>
              <div className="p-16 border-t border-white/5 flex flex-col md:flex-row gap-16 items-start">
                 <div className="md:w-1/3">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-1.5 h-1.5 bg-[#FACC15] rounded-full intensity-active" />
                       <span className="pro-mono !text-white">NASA Metadata</span>
                    </div>
                    <p className="pro-mono !text-[11px] leading-relaxed italic text-white/40">
                      Real-time updates from NASA's Astronomy Picture of the Day API.
                    </p>
                 </div>
                 <div className="flex-1">
                    <p className="text-lg text-white/50 leading-relaxed font-medium line-clamp-4">
                      {apod.explanation}
                    </p>
                    <Link to="https://apod.nasa.gov" target="_blank" className="mt-8 btn-pro-outline !w-fit group/btn italic">
                      View Full Data <ArrowRight className="group-hover/btn:translate-x-2 transition-transform" />
                    </Link>
                 </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Observing Conditions ── */}
      <div className="mb-32">
        <div className="flex flex-col mb-12">
            <span className="pro-mono !text-[#FACC15] !tracking-[0.5em] mb-4">Local Status</span>
            <h2 className="text-4xl font-bold tracking-tight text-white uppercase italic">Viewing Conditions</h2>
        </div>
        <div className="glass-pro-card p-16">
          {weatherDenied || (!weather && !weatherLoading) ? (
            <div className="flex flex-col md:flex-row items-center gap-16">
              <div className="flex-1">
                <p className="text-3xl font-bold text-white mb-6 uppercase italic leading-tight">Enable Location Access</p>
                <p className="text-lg text-white/40 font-medium leading-relaxed max-w-xl">
                  Enable location access to unlock real-time visibility metrics, cloud coverage, and precise viewing conditions for your specific area.
                </p>
                <button className="btn-pro mt-12 overflow-hidden group">
                   <span className="relative z-10">Initialize Sync</span>
                </button>
              </div>
              <div className="w-48 h-48 pro-radius bg-white/5 border border-white/10 flex items-center justify-center text-6xl shadow-2xl">📡</div>
            </div>
          ) : weatherLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw size={40} className="text-white/20 animate-spin mb-8" />
              <p className="pro-mono !text-white/30 italic">Scanning Tropospheric Layers…</p>
            </div>
          ) : weather ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
                {[
                  { label: 'Cloud Density', value: `${weather.cloudCover}%`, icon: Cloud, desc: weather.cloudCover < 10 ? 'Pristine transparency' : (weather.cloudCover < 40 ? 'Atmospheric interference' : 'Obscured visibility') },
                  { label: 'Thermal Window', value: `${weather.temp}°C`, icon: Thermometer, desc: 'External ambient' },
                  { label: 'Humidity', value: `${weather.humidity}%`, icon: Wind, desc: 'Moisture coefficients' },
                  { label: 'Optical Integrity', value: weather.cloudCover < 5 ? 'OPTIMUM' : (weather.cloudCover < 25 ? 'NOMINAL' : 'DEGRADED'), icon: Eye, desc: 'Signal strength' },
                ].map(({ label, value, icon: Icon, desc }) => (
                  <div key={label} className="p-10 pro-radius-sm bg-white/5 border border-white/10 group hover:bg-white/[0.08] transition-all duration-700">
                    <Icon size={24} className="text-[#FACC15] mb-8 transition-transform group-hover:rotate-12" />
                    <p className="text-3xl font-bold text-white mb-2">{value}</p>
                    <p className="pro-mono !text-white/30 !text-[9px] mb-4 uppercase">{label}</p>
                    <p className="text-[10px] text-white/20 font-black uppercase tracking-widest italic">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="pt-12 border-t border-white/5 flex items-center gap-6">
                 <div className={`w-3 h-3 rounded-full ${weather.cloudCover < 20 ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-[#FACC15] intensity-active'}`} />
                 <p className="pro-mono !text-white/60 italic text-sm">
                  <span className="text-[#FACC15] font-black uppercase mr-3 tracking-widest">Diagnostic:</span>
                  {weather.cloudCover < 20 ? 'Clear skies detected. High-fidelity celestial mapping window is currently open.' : 'Significant cloud cover identified. Sensor arrays may experience signal interference.'}
                 </p>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── FAQ ── */}
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
    </div>
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
    <div className="relative min-h-screen overflow-hidden">
      <div className="cinematic-vignette" />
      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 pt-48 pb-32">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-24">
          <div className="flex flex-col mb-12">
             <span className="pro-mono !text-[#FACC15] !tracking-[0.5em] mb-4">Universal Registry</span>
             <h1 className="text-7xl font-bold text-white tracking-tighter leading-tight uppercase italic">
              Meteor Shower <br/>Chronicles.
             </h1>
          </div>
          <p className="text-xl text-white/40 max-w-2xl font-medium leading-relaxed">
            The definitive technical atlas of major meteor streams, orbital windows, and atmospheric intersection events for the current epoch.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-6 mb-24">
          <div className="relative flex-1 group">
            <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors" />
            <input
              type="text"
              placeholder="Query identifier or constellation host..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 pro-radius-sm py-6 pl-16 pr-8 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.08] transition-all italic"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            {(['all', 'active', 'upcoming', 'past'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-8 py-6 pro-radius-sm text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${
                  filter === f
                    ? 'bg-white text-black shadow-2xl shadow-white/20'
                    : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filtered.map((s, i) => {
              const status = getShowerStatus(s);
              const isWatched = watched?.some(w => w.id === s.id);
              const intensityPct = Math.min((s.zhr / 150) * 100, 100);

              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass-pro-card p-12 group relative overflow-hidden flex flex-col justify-between h-[500px] transition-all duration-700 ${status === 'active' ? 'border-[#FACC15]/30 shadow-2xl shadow-[#FACC15]/5' : ''}`}
                >
                  {status === 'active' && <MeteorVisualizer zhr={s.zhr} active />}
                  {status === 'active' && (
                    <div className="absolute inset-0 border-2 border-[#FACC15]/20 pro-radius intensity-active pointer-events-none" />
                  )}
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-12">
                        <span className={`pro-mono !text-[9px] ${status === 'active' ? '!text-[#FACC15]' : '!text-white/20'}`}>
                          {status === 'active' ? 'ACTIVE PHASE' : `Node ${s.id.slice(0, 4)}`}
                        </span>
                        <button
                          onClick={() => {
                            toggleWatch(s);
                          }}
                          className={`w-12 h-12 pro-radius-sm border flex items-center justify-center transition-all ${isWatched ? 'bg-[#FACC15] border-[#FACC15] text-black shadow-2xl shadow-[#FACC15]/20' : 'bg-white/5 border-white/10 text-white/20 hover:text-white hover:border-white/30'}`}
                        >
                          <Bell size={18} />
                        </button>
                      </div>

                      <h3 className="text-3xl font-bold mb-4 text-white uppercase italic tracking-tighter group-hover:tracking-normal transition-all duration-700">{s.name}</h3>
                      <p className="pro-mono !text-white/30 mb-8 italic">Peak Event: {formatDate(s.peak)}</p>
                      <p className="text-base text-white/40 mb-12 line-clamp-3 leading-relaxed font-medium">{s.description}</p>
                    </div>

                    <div className="pt-8 border-t border-white/5">
                      <div className="flex items-center justify-between mb-8">
                        <span className="pro-mono !text-[11px] !text-white">{s.zhr} ZHR Synthesis</span>
                        <Link to={`/shower/${s.id}`} className="w-12 h-12 bg-white/5 pro-radius-sm flex items-center justify-center text-white/20 hover:text-white transition-all">
                             <ArrowRight size={18} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-32">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
               <Sparkles size={32} className="text-[#FACC15]/20" />
            </div>
            <p className="text-sm font-black text-white/30 uppercase tracking-widest">No matching trajectories found</p>
          </div>
        )}
      </motion.div>
     </div>
    </div>
  );
}

// ─── SHOWER DETAIL PAGE ───────────────────────────────────────────────────────
function ShowerDetail({ watched, toggleWatch }: { watched: WatchedShower[]; toggleWatch: (s: MeteorShower) => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shower = showers.find(s => s.id === id);

  if (!shower) {
    return (
      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-40 text-center">
        <div className="w-20 h-20 bg-orange-500/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-orange-500/10">
           <AlertTriangle size={32} className="text-orange-500" />
        </div>
        <h2 className="text-3xl font-black font-space mb-4 text-white">Object Lost in Space</h2>
        <p className="text-sm text-white/40 font-medium mb-12">The requested celestial identifier is not registered in our current epoch database.</p>
        <button onClick={() => navigate('/calendar')} className="btn-primary px-10">
          <ArrowRight size={18} className="rotate-180" /> Return to Atlas
        </button>
      </div>
    );
  }

  const status    = getShowerStatus(shower);
  const isWatched = watched?.some(w => w.id === shower.id);
  const daysUntil = getDaysUntilPeak(shower);

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 pt-40 pb-24 text-white">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-3 text-xs font-black text-white/30 hover:text-[#FACC15] mb-12 transition-all uppercase tracking-widest"
        >
          <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center group-hover:border-[#FACC15]/30 transition-all">
            <ChevronRight size={14} className="rotate-180" />
          </div>
          Return to Celestial Atlas
        </button>

        {/* Header card */}
        <div className="glass-card p-12 md:p-20 rounded-[64px] relative overflow-hidden mb-12 border-white/5 shadow-2xl shadow-black/5 bg-[#050505]">
          <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          <MeteorVisualizer zhr={shower.zhr} active={status === 'active'} />
          
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <span className={`text-[10px] px-3 py-1.5 rounded-lg font-black tracking-widest uppercase border ${
                status === 'active' ? 'bg-[#FACC15] text-black border-transparent shadow-xl shadow-[#FACC15]/15' : status === 'upcoming' ? 'bg-[#FACC15]/5 text-[#FACC15] border-[#FACC15]/10' : 'bg-white/5 text-white/20 border-transparent'
              }`}>{status.toUpperCase()} PHASING</span>
              {shower.parent && (
                <span className="text-[10px] px-3 py-1.5 rounded-lg font-black tracking-widest uppercase bg-white/5 text-white/30 border border-white/5">
                  SOURCE: {shower.parent}
                </span>
              )}
            </div>
            <h1 className="text-5xl md:text-8xl font-black font-space mb-8 text-white tracking-tighter leading-none italic uppercase">{shower.name}</h1>
            <p className="text-base text-white/40 leading-relaxed font-medium mb-12">{shower.description}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button onClick={() => toggleWatch(shower)} className={`px-10 py-5 rounded-[24px] text-xs font-black uppercase tracking-widest transition-all ${isWatched ? 'bg-white/5 text-white border border-white/10' : 'bg-[#FACC15] text-black shadow-xl shadow-[#FACC15]/20 hover:scale-105'}`}>
                {isWatched ? <span className="flex items-center gap-2"><BellOff size={16} /> Disconnect Signal</span> : <span className="flex items-center gap-2"><Bell size={16} /> Track Trajectory</span>}
              </button>
              <Link to="/live" className="px-10 py-5 rounded-[24px] text-xs font-black uppercase tracking-widest bg-white/[0.02] border border-white/10 text-white hover:bg-white/5 transition-all flex items-center gap-2 shadow-sm">
                <Radio size={16} className="text-[#FACC15]" /> Community Feed
              </Link>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Intersection Peak', value: formatDate(shower.peak),                             icon: Calendar, color: 'text-[#FACC15]', bg: 'bg-[#FACC15]/5' },
            { label: 'Flow Intensity',    value: `${shower.zhr} ZHR`,                                 icon: Activity, color: 'text-[#FACC15]', bg: 'bg-[#FACC15]/5' },
            { label: 'Entry Velocity',    value: shower.speed ? `${shower.speed} KM/S` : '—',        icon: Gauge,    color: 'text-[#FACC15]', bg: 'bg-[#FACC15]/5' },
            { label: 'Time Window',       value: daysUntil > 0 ? `${daysUntil} DAYS` : status === 'active' ? 'NOW' : 'PAST', icon: Clock, color: 'text-[#FACC15]', bg: 'bg-[#FACC15]/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="glass-card p-8 rounded-[40px] text-center border-white/5 hover:border-[#FACC15]/10 transition-colors group bg-white/[0.02]">
              <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                 <Icon size={20} className={color} />
              </div>
              <p className="text-lg font-black font-space tracking-tight text-white">{value}</p>
              <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-black mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Activity Window */}
          <div className="glass-card p-10 rounded-[48px] md:col-span-1 border-white/5 bg-white/[0.02]">
            <h3 className="section-label mb-8 flex items-center gap-2">
              <Calendar size={14} className="text-[#FACC15]" /> Synthesis Schedule
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Window Activation', val: formatDate(shower.start) },
                { label: 'Peak Synthesis',   val: formatDate(shower.peak)  },
                { label: 'Window Termination', val: formatDate(shower.end)   },
              ].map(({ label, val }) => (
                <div key={label} className="flex flex-col gap-1.5 p-4 bg-white/[0.04] rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{label}</span>
                  <span className="text-xs font-black text-white">{val}</span>
                </div>
              ))}
            </div>
            {daysUntil > 0 && (
              <div className="mt-8 pt-8 border-t border-white/5">
                <CountdownTimer targetDate={shower.peak} label="Countdown to Synergy" />
              </div>
            )}
          </div>

          {/* Technical and Tips */}
          <div className="md:col-span-2 flex flex-col gap-6">
             <div className="glass-card p-10 rounded-[48px] border-white/5 bg-white/[0.02]">
                <h3 className="section-label mb-8 flex items-center gap-2">
                  <Zap size={14} className="text-[#FACC15]" /> Ballistic Parameters
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Parent Nucleus',     val: shower.parent || 'Undeclared' },
                    { label: 'Host Constellation',   val: shower.constellation },
                    { label: 'Orbital Resonance',  val: shower.orbitalPeriod || 'Irregular' },
                    { label: 'Fragment Matrix',     val: shower.composition || 'Standard Debris' },
                    { label: 'Approach Speed',     val: shower.speed ? `${shower.speed} KM/S` : 'Variable' },
                  ].map(({ label, val }) => (
                    <div key={label} className="p-4 bg-black/2 rounded-2xl border border-black/5">
                      <span className="text-[9px] font-black text-[#111827]/30 uppercase tracking-widest block mb-1">{label}</span>
                      <span className="text-[11px] font-black text-[#111827]">{val}</span>
                    </div>
                  ))}
                </div>
             </div>

             {shower.viewingTips && (
               <div className="glass-card p-10 rounded-[48px] border-white/5 bg-[#FACC15]/5">
                 <h3 className="section-label mb-6 flex items-center gap-2">
                   <Sparkles size={14} className="text-[#FACC15]" /> Optimal Viewing Protocol
                 </h3>
                 <p className="text-sm text-white/50 leading-relaxed font-medium italic">{shower.viewingTips}</p>
               </div>
             )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── LIVE FEED PAGE ───────────────────────────────────────────────────────────
function LiveFeed({ addNotification }: { addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void }) {
  const [reports, setReports] = useState<SightingReport[]>([
    { id: '1', time: '2 min ago',  location: 'Colorado, USA',         magnitude: '-2', duration: '3s', type: 'fireball', verified: true,  timestamp: Date.now() - 120000  },
    { id: '2', time: '8 min ago',  location: 'Ontario, Canada',        magnitude: '1',  duration: '1s', type: 'meteor',   verified: true,  timestamp: Date.now() - 480000  },
    { id: '3', time: '15 min ago', location: 'Bavaria, Germany',       magnitude: '-4', duration: '5s', type: 'bolide',   verified: false, timestamp: Date.now() - 900000  },
    { id: '4', time: '23 min ago', location: 'New South Wales, AU',    magnitude: '0',  duration: '2s', type: 'meteor',   verified: true,  timestamp: Date.now() - 1380000 },
    { id: '5', time: '41 min ago', location: 'Hokkaido, Japan',        magnitude: '-1', duration: '2s', type: 'fireball', verified: true,  timestamp: Date.now() - 2460000 },
  ]);

  const [form, setForm] = useState({ location: '', magnitude: '', duration: '', type: 'meteor' as const, notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location || !form.magnitude) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    const newReport: SightingReport = {
      id: Date.now().toString(),
      time: 'Just now',
      location: form.location,
      magnitude: form.magnitude,
      duration: form.duration || '—',
      type: form.type as any,
      verified: false,
      timestamp: Date.now(),
    };
    setReports(prev => [newReport, ...prev]);
    setForm({ location: '', magnitude: '', duration: '', type: 'meteor', notes: '' });
    setSubmitting(false);
    addNotification({ title: 'Sighting Submitted!', message: 'Your report is being reviewed.', type: 'success' });
  };

  const typeConfig: Record<string, { color: string; bg: string; border: string }> = {
    meteor:   { color: 'text-blue-500',   bg: 'bg-blue-500/5',  border: 'border-blue-500/10'  },
    fireball: { color: 'text-[#FACC15]', bg: 'bg-[#FACC15]/5', border: 'border-[#FACC15]/10' },
    bolide:   { color: 'text-red-500',    bg: 'bg-red-500/5',  border: 'border-red-500/10'  },
  };

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-40 pb-24">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-1.5 h-8 bg-[#FACC15] rounded-full" />
             <p className="text-xs font-black text-[#FACC15] uppercase tracking-[0.2em]">Community Feed</p>
          </div>
          <h1 className="text-5xl md:text-7xl font-black font-space mb-6 text-white tracking-tighter leading-none">
            Live Sighting <br/><span className="hero-gradient-text italic">Network.</span>
          </h1>
          <p className="text-sm text-white/40 max-w-xl font-medium leading-relaxed">
            Real-time telemetry and visual observations contributed by our global satellite of observers. Authenticated in the field.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Feed */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="live-dot" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{reports.length} ACTIVE SIGNALS TODAY</span>
              </div>
              <div className="flex gap-2">
                 <button className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/30">
                    <Filter size={14} />
                 </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <AnimatePresence>
                {reports.map((r, i) => {
                  const cfg = typeConfig[r.type] || typeConfig.meteor;
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass-card p-6 rounded-3xl border-white/5 hover:border-[#FACC15]/10 transition-all shadow-sm hover:shadow-xl group"
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <span
                              className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border font-mono ${cfg.color} ${cfg.bg} ${cfg.border}`}
                            >
                              {r.type}
                            </span>
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest font-mono">Magnitude {r.magnitude}</span>
                            {r.verified && (
                              <span className="flex items-center gap-1 text-[10px] text-[#FACC15] font-black uppercase tracking-widest font-mono">
                                <CheckCircle size={12} strokeWidth={3} /> VERIFIED
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-white/40 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><MapPin size={12} className="text-[#FACC15]" /> {r.location}</span>
                            <span className="flex items-center gap-2"><Clock size={12} className="text-[#FACC15]" /> {r.time}</span>
                            <span className="flex items-center gap-2 font-mono">{r.duration} EXPOSURE</span>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/10 group-hover:bg-[#FACC15]/5 group-hover:text-[#FACC15]/30 transition-all">
                           <ChevronRight size={20} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Submit form */}
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-pro-card p-0 overflow-hidden relative group">
              <ISSWidget />
            </div>

            <div className="glass-card p-10 rounded-[48px] sticky top-32 border-white/5 shadow-2xl shadow-black/5">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center">
                  <Plus size={20} className="text-[#FACC15]" />
                </div>
                <div>
                   <h3 className="text-lg font-black font-space text-white tracking-tight">Signal Transmission</h3>
                   <p className="text-[10px] text-[#FACC15] font-black uppercase tracking-widest">Report Observation</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Spatial Coordinates *</label>
                  <input
                    type="text"
                    placeholder="City, Region, Sphere"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white placeholder:text-white/20 focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Apparent Mag *</label>
                    <input
                      type="number"
                      placeholder="-3"
                      value={form.magnitude}
                      onChange={e => setForm(f => ({ ...f, magnitude: e.target.value }))}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white placeholder:text-white/20 focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Duration (Seconds)</label>
                    <input
                      type="text"
                      placeholder="3.5s"
                      value={form.duration}
                      onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white placeholder:text-white/20 focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Event Classification</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all appearance-none"
                  >
                    <option value="meteor" className="bg-[#050505]">Standard Meteor Trace</option>
                    <option value="fireball" className="bg-[#050505]">High-Velo Fireball (Mag &lt; -3)</option>
                    <option value="bolide" className="bg-[#050505]">Explosive Bolide Event</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Phenomena Notes</label>
                  <textarea
                    placeholder="Coloration, sonics, ionization trails..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white placeholder:text-white/20 focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all h-28 resize-none"
                  />
                </div>

                <button type="submit" disabled={submitting} className="w-full py-5 rounded-[24px] bg-[#FACC15] text-black text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#FACC15]/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                  {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  {submitting ? 'TRANSMITTING…' : 'TRANSMIT SIGNAL'}
                </button>
              </form>
              
              <div className="mt-8 pt-8 border-t border-white/5">
                <p className="text-[10px] text-white/30 font-medium leading-relaxed italic">
                  Transmission protocols require verification by peer nodes. Signals under review are marked as unverified.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── GLOBE PAGE ───────────────────────────────────────────────────────────────
function GlobePage() {
  return (
    <div className="relative z-10 pt-16 h-screen flex flex-col overflow-hidden">
      <div className="flex-1 relative">
        <CesiumGlobe />
      </div>
    </div>
  );
}

// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────
function About() {
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const features = [
    { icon: Activity,   title: 'Telemetry Engine',     desc: 'Real-time meteor flow analysis via IMO/NASA technical interfaces.' },
    { icon: Globe,      title: 'Orbital Atlas',         desc: '3D spatial visualization of fragmentation radiant points and satellite paths.' },
    { icon: Navigation, title: 'ISS Trajectory',        desc: 'Precision tracking of the International Space Station with 5s refreshes.' },
    { icon: Cloud,      title: 'Atmospheric Data',     desc: 'Hyper-local obstruction analysis (Cloud/Humidity) via Open-Meteo.' },
    { icon: Users,      title: 'Community Layer',      desc: 'Decentralized sighting reports from a global network of vetted observers.' },
    { icon: Bell,       title: 'Nexus Alerts',         desc: 'Signal synchronization for upcoming peak atmospheric intersections.' },
  ];

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 pt-40 pb-24 text-white">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-1.5 h-8 bg-[#FACC15] rounded-full" />
             <p className="text-xs font-black text-[#FACC15] uppercase tracking-[0.2em]">Studio Mission</p>
          </div>
          <h1 className="text-5xl md:text-7xl font-black font-space mb-8 tracking-tighter leading-none italic">
             Defining the <span className="hero-gradient-text">Future of Space.</span>
          </h1>
          <p className="text-sm text-white/40 max-w-2xl font-medium leading-relaxed">
            Stargaze is a community-driven technical platform designed to democratize high-fidelity celestial data. We believe space is an open architectural canvas for all of humanity to explore.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-10 rounded-[48px] group hover:border-[#FACC15]/10 transition-all border-white/5 hover:shadow-2xl hover:shadow-black/5">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-6 group-hover:bg-[#FACC15]/5 transition-all">
                <Icon size={20} className="text-white/30 group-hover:text-[#FACC15]" />
              </div>
              <h3 className="text-lg font-black font-space mb-3 tracking-tight">{title}</h3>
              <p className="text-[11px] text-white/40 leading-relaxed font-medium uppercase tracking-widest">{desc}</p>
            </div>
          ))}
        </div>

        {/* Data Sources */}
        <div className="technical-panel p-10 rounded-[48px] mb-12 border-white/5">
          <h2 className="text-sm font-black font-space mb-8 uppercase tracking-[0.2em] text-white">Data Provider Network</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'NASA APOD',    url: 'https://apod.nasa.gov',    desc: 'Visual Synthesis' },
              { name: 'IMO CORE',     url: 'https://www.imo.net',       desc: 'Stream Registry' },
              { name: 'CELESTRAK',    url: 'https://celestrak.org',     desc: 'Orbital TLE' },
              { name: 'OPEN-METEO',   url: 'https://open-meteo.com',    desc: 'Atmosphere' },
            ].map(({ name, url, desc }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-[#FACC15]/30 transition-all group"
              >
                <p className="text-[11px] font-black text-white group-hover:text-[#FACC15] flex items-center justify-between">
                  {name} <ExternalLink size={12} className="opacity-20 group-hover:opacity-100" />
                </p>
                <p className="text-[9px] text-white/30 mt-2 font-black uppercase tracking-widest">{desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="glass-card p-12 rounded-[56px] border-white/5 bg-black/40 shadow-2xl shadow-black/5">
          <h2 className="text-xl font-black font-space mb-8 tracking-tight italic text-white">Studio Inquiries</h2>
          {sent ? (
            <div className="text-center py-20 bg-white/5 rounded-[40px]">
              <div className="w-16 h-16 rounded-full bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-[#FACC15]" />
              </div>
              <p className="text-lg font-black text-white">Signal Received.</p>
              <p className="text-xs text-white/40 mt-2 font-black uppercase tracking-widest">We will respond within the current moon cycle.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Identifier</label>
                  <input type="text" value={formState.name} onChange={e => setFormState(f => ({ ...f, name: e.target.value }))} className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white placeholder:text-white/10 focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all" placeholder="Enter name..." required />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Email Node</label>
                  <input type="email" value={formState.email} onChange={e => setFormState(f => ({ ...f, email: e.target.value }))} className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white placeholder:text-white/10 focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all" placeholder="name@domain.com" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">Message Matrix</label>
                <textarea value={formState.message} onChange={e => setFormState(f => ({ ...f, message: e.target.value }))} className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-xs font-black text-white placeholder:text-white/10 focus:border-[#FACC15]/30 focus:bg-white/10 outline-none transition-all h-32 resize-none" placeholder="Technical inquiries, bug reports, system feedback..." required />
              </div>
              <button type="submit" className="px-12 py-5 rounded-[24px] bg-[#FACC15] text-black text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#FACC15]/20 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">
                <Send size={16} /> Finalize Transmission
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── PRIVACY POLICY ───────────────────────────────────────────────────────────
function PrivacyPolicy() {
  return (
    <div className="relative z-10 max-w-4xl mx-auto px-4 pt-40 pb-24 text-white">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 rounded-2xl bg-[#FACC15]/10 border border-[#FACC15]/20 flex items-center justify-center">
            <Shield size={20} className="text-[#FACC15]" />
          </div>
          <div>
             <h1 className="text-4xl font-black font-space tracking-tight italic">Data Protocol</h1>
             <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black mt-1">Privacy Architecture</p>
          </div>
        </div>
        <div className="technical-panel p-12 rounded-[56px] space-y-12 border-white/5">
          {[
            { h: 'Observational Integrity',     p: 'We maintain a strict zero-retention policy for astronomical datasets. Your spatial coordinates are processed locally to synchronize terrestrial coordinates with orbital radiants. No PII is archived on the Stargaze cluster.' },
            { h: 'Encryption & Transit', p: 'Data transmissions between your browser and our distributed system use high-entropy SSL/TLS protocols. Third-party interfaces (NASA, Open-Meteo) are queried via secure technical bridges.' },
            { h: 'Hardware Access',        p: 'Geolocation access is used exclusively to calibrate atmospheric obstruction indexes. This permission can be revoked at any time via your browser system settings.' },
            { h: 'Epoch Preservation',      p: 'We use immutable localStorage nodes to preserve your celestial watchlist. No cross-site tracking or advertising pixels are permitted within this environment.' },
          ].map(({ h, p }) => (
            <div key={h} className="space-y-4">
              <h2 className="text-sm font-black text-white uppercase tracking-[0.1em]">{h}</h2>
              <p className="text-xs text-white/50 leading-relaxed font-medium">{p}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── TERMS OF SERVICE ─────────────────────────────────────────────────────────
function TermsOfService() {
  return (
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
            { h: 'Acceptance of Terms',     p: 'By using Stargaze, you agree to these terms. This is a free educational tool — please use it responsibly.' },
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
  );
}

// ─── NOT FOUND (404) ─────────────────────────────────────────────────────────
function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 pt-20 text-center bg-[#050505]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="max-w-lg"
      >
        <div className="w-32 h-32 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto mb-12 shadow-inner">
           <EyeOff size={48} className="text-[#FACC15]/20" />
        </div>
        <p className="text-[12rem] font-black font-space leading-none text-white/[0.02] absolute inset-0 flex items-center justify-center -z-10 select-none">404</p>
        <h1 className="text-5xl font-black font-space mb-6 text-white tracking-tighter italic">Vaporized Signal.</h1>
        <p className="text-white/40 text-sm font-medium leading-relaxed mb-12 max-w-xs mx-auto">
          The requested celestial node has drifted beyond the observable event horizon. It no longer exists in this coordinate system.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => navigate(-1)} className="px-10 py-5 rounded-[24px] bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all">
             Protocol Return
          </button>
          <Link to="/" className="px-10 py-5 rounded-[24px] bg-[#FACC15] text-black text-xs font-black uppercase tracking-widest shadow-xl shadow-[#FACC15]/20 flex items-center gap-2">
            <Sparkles size={16} /> Re-Launch Core
          </Link>
        </div>
      </motion.div>
    </div>
  );
}




function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [pathname]);
  return null;
}

// ─── ANIMATED ROUTES ─────────────────────────────────────────────────────────
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
        <Route path="/about"      element={<About />} />
        <Route path="/privacy"    element={<PrivacyPolicy />} />
        <Route path="/terms"      element={<TermsOfService />} />
        <Route path="*"           element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [watched, setWatched] = useState<WatchedShower[]>(() => {
    try { 
      const stored = JSON.parse(localStorage.getItem('stargaze_watched') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch { return []; }
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    localStorage.setItem('stargaze_watched', JSON.stringify(watched));
  }, [watched]);

  useEffect(() => {
    const checkPeaks = () => {
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
      prev?.some(w => w.id === s.id)
        ? prev.filter(w => w.id !== s.id)
        : [...(prev || []), { id: s.id, name: s.name, watchedAt: Date.now() }]
    );
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen text-white relative bg-[#050505]">
        <div className="atmosphere" />
        <ParticleField />
        <ScrollToTop />
        <Navbar watched={watched} notifications={notifications} />
        <NotificationToasts notifications={notifications} dismiss={dismissNotification} />
        <SalePopup />

        <AnimatedRoutes watched={watched} addNotification={addNotification} toggleWatch={toggleWatch} />

        <Footer />
      </div>
    </BrowserRouter>
  );
}


