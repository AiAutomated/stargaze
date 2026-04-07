import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import {
  Sparkles, Star, Globe, Radio, Info, Menu, X,
  ChevronRight, ChevronDown, ArrowRight, Clock, Calendar, MapPin,
  Eye, Zap, Activity, Bell, BellOff, Send, Shield, FileText,
  RefreshCw, AlertTriangle, CheckCircle, ExternalLink, Rocket, Moon,
  Cloud, Wind, BarChart2, Users, MessageSquare, Plus, Search,
  Filter, TrendingUp, Navigation, Compass
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
  if (pos < 1.85) { phase = 'New Moon'; emoji = '🌑'; }
  else if (pos < 7.38) { phase = 'Waxing Crescent'; emoji = '🌒'; }
  else if (pos < 9.22) { phase = 'First Quarter'; emoji = '🌓'; }
  else if (pos < 14.77) { phase = 'Waxing Gibbous'; emoji = '🌔'; }
  else if (pos < 16.61) { phase = 'Full Moon'; emoji = '🌕'; }
  else if (pos < 22.15) { phase = 'Waning Gibbous'; emoji = '🌖'; }
  else if (pos < 23.99) { phase = 'Last Quarter'; emoji = '🌗'; }
  else { phase = 'Waning Crescent'; emoji = '🌘'; }
  return { phase, illumination: illum, emoji };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCountdown(ms: number): { days: string; hours: string; mins: string; secs: string } {
  if (ms <= 0) return { days: '00', hours: '00', mins: '00', secs: '00' };
  const s = Math.floor(ms / 1000);
  return {
    days: String(Math.floor(s / 86400)).padStart(2, '0'),
    hours: String(Math.floor((s % 86400) / 3600)).padStart(2, '0'),
    mins: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    secs: String(s % 60).padStart(2, '0'),
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

    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random(),
        da: (Math.random() - 0.5) * 0.008,
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
      style={{ opacity: 0.7 }}
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
            {n.type === 'info' && <Sparkles size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />}
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
    { to: '/', label: 'Home', icon: Sparkles },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/live', label: 'Live', icon: Radio },
    { to: '/globe', label: '3D Globe', icon: Globe },
    { to: '/about', label: 'About', icon: Info },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'glass-nav py-2' : 'py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-space font-bold text-white text-sm tracking-wide">Stargaze<span className="text-blue-400">.io</span></span>
        </Link>

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

        <div className="flex items-center gap-2">
          {watched.length > 0 && (
            <div className="relative">
              <Bell size={16} className="text-white/50" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full text-[8px] flex items-center justify-center font-bold">
                {watched.length}
              </span>
            </div>
          )}
          {notifications.length > 0 && (
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
          <button
            className="md:hidden text-white/60 hover:text-white p-1"
            onClick={() => setOpen(o => !o)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium font-space transition-all
                    ${pathname === to ? 'text-blue-300 bg-blue-500/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  <Icon size={15} />
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
    <footer className="relative z-10 border-t border-white/5 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles size={11} className="text-white" />
              </div>
              <span className="font-space font-bold text-sm">Stargaze<span className="text-blue-400">.io</span></span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Free, real-time meteor shower tracking and celestial event calendar. Open to all stargazers.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 font-space">Explore</p>
            {[['/', 'Home'], ['/calendar', 'Calendar'], ['/live', 'Live Feed'], ['/globe', '3D Globe']].map(([to, label]) => (
              <Link key={to} to={to} className="block text-xs text-white/35 hover:text-white/70 mb-1.5 transition-colors">{label}</Link>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 font-space">Resources</p>
            {[['https://www.imo.net', 'IMO Data'], ['https://api.nasa.gov', 'NASA API'], ['https://celestrak.org', 'CelesTrak']].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="block text-xs text-white/35 hover:text-white/70 mb-1.5 transition-colors">{label}</a>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 font-space">Legal</p>
            {[['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/about', 'About']].map(([to, label]) => (
              <Link key={to} to={to} className="block text-xs text-white/35 hover:text-white/70 mb-1.5 transition-colors">{label}</Link>
            ))}
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">© {new Date().getFullYear()} Stargaze.io — All rights reserved</p>
          <p className="text-xs text-white/25">Data: IMO · NASA · Open-Meteo · CelesTrak · WhereTheISS</p>
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
    { val: cd.days, label: 'Days' },
    { val: cd.hours, label: 'Hrs' },
    { val: cd.mins, label: 'Min' },
    { val: cd.secs, label: 'Sec' },
  ];

  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-widest font-mono mb-2">{label}</p>
      <div className="flex gap-2">
        {units.map(u => (
          <div key={u.label} className="flex flex-col items-center">
            <div className="glass rounded-lg px-3 py-2 min-w-[44px] text-center">
              <span className="countdown-digit">{u.val}</span>
            </div>
            <span className="countdown-label mt-1">{u.label}</span>
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

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-60" />;
}

// ─── ISS Widget ───────────────────────────────────────────────────────────────
function ISSWidget() {
  const [iss, setIss] = useState<{ latitude: number; longitude: number; altitude: number; velocity: number } | null>(null);
  const [error, setError] = useState(false);

  const fetchISS = useCallback(async () => {
    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      const d = await r.json();
      setIss({ latitude: +d.latitude.toFixed(3), longitude: +d.longitude.toFixed(3), altitude: Math.round(d.altitude), velocity: Math.round(d.velocity) });
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
          <Rocket size={14} className="text-orange-400" />
          <span className="text-xs font-semibold font-space text-white/70">ISS Live Tracker</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="text-[10px] text-green-400 font-mono">LIVE</span>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-white/30 text-center py-2">Connection error</p>
      ) : iss ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Latitude', value: `${iss.latitude}°`, icon: MapPin },
            { label: 'Longitude', value: `${iss.longitude}°`, icon: MapPin },
            { label: 'Altitude', value: `${iss.altitude} km`, icon: TrendingUp },
            { label: 'Speed', value: `${iss.velocity.toLocaleString()} km/h`, icon: Zap },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/3 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Icon size={9} className="text-white/30" />
                <span className="text-[9px] text-white/30 uppercase tracking-wider font-mono">{label}</span>
              </div>
              <p className="text-xs font-semibold font-mono text-white/80">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-center py-3">
          <RefreshCw size={14} className="text-white/30 animate-spin" />
        </div>
      )}
    </div>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: 'When is the best time to watch meteor showers?', a: 'The best viewing time is generally after midnight and before dawn, when Earth\'s rotation carries us into the meteor stream head-on, dramatically increasing the rate of visible meteors.' },
    { q: 'Do I need special equipment?', a: 'No! Meteor showers are one of the few astronomical events best enjoyed with the naked eye. Dark skies, a reclining chair, and patience are all you need.' },
    { q: 'How does ZHR work?', a: 'Zenithal Hourly Rate (ZHR) is the theoretical maximum meteors per hour under perfect conditions: a limiting magnitude of 6.5 and the radiant at the zenith. Real rates are typically 50-75% of ZHR.' },
    { q: 'Why do meteor showers have specific dates?', a: 'Earth follows a predictable orbit, so it intersects the same debris trails of comets and asteroids at the same points each year — like clockwork, creating annual showers.' },
    { q: 'How accurate are the forecasts?', a: 'Dates and peak times are very accurate based on orbital mechanics. Actual ZHR can vary due to uneven debris distribution, atmospheric conditions, and light pollution.' },
  ];

  return (
    <div className="space-y-2">
      {faqs.map((f, i) => (
        <div key={i} className="glass-card rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-medium text-white/80">{f.q}</span>
            <ChevronDown size={14} className={`text-white/40 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-4 text-sm text-white/50 leading-relaxed">{f.a}</p>
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
  const [apod, setApod] = useState<{ title: string; url: string; explanation: string; media_type: string } | null>(null);
  const [apodLoading, setApodLoading] = useState(true);
  const [weather, setWeather] = useState<{ cloudCover: number; humidity: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherDenied, setWeatherDenied] = useState(false);
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    setApodLoading(true);
    fetch(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`)
      .then(r => r.json())
      .then(d => { if (d.url || d.hdurl) setApod(d); })
      .catch(() => {})
      .finally(() => setApodLoading(false));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setWeatherDenied(true); return; }
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=cloud_cover,relative_humidity_2m&timezone=auto`);
        const d = await r.json();
        setWeather({ cloudCover: d.current.cloud_cover, humidity: d.current.relative_humidity_2m });
      } catch {}
      setWeatherLoading(false);
    }, () => { setWeatherLoading(false); setWeatherDenied(true); });
  }, []);

  const activeShowers = showers.filter(s => getShowerStatus(s) === 'active');
  const upcomingShowers = showers.filter(s => getShowerStatus(s) === 'upcoming').slice(0, 3);

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full mb-6">
          <span className="live-dot" />
          <span className="text-xs font-mono text-white/60 tracking-wider">LIVE CELESTIAL TRACKING</span>
        </div>
        <h1 className="hero-title hero-gradient-text mb-4">
          Watch the Skies
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed font-light">
          Real-time meteor shower tracking, celestial event calendars, and live ISS positioning — all free, all open.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link to="/calendar" className="btn-primary">
            <Calendar size={14} />
            View Calendar
          </Link>
          <Link to="/globe" className="btn-secondary">
            <Globe size={14} />
            Open 3D Globe
          </Link>
        </div>
      </motion.div>

      {/* Status Cards */}
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10"
      >
        {[
          {
            label: activeShowers.length > 0 ? 'Active Showers' : 'Next Shower',
            value: activeShowers.length > 0 ? activeShowers.length.toString() : (nextShower ? `${getDaysUntilPeak(nextShower)}d` : '—'),
            sub: activeShowers.length > 0 ? 'happening now' : (nextShower ? nextShower.name : undefined),
            icon: Activity,
            color: activeShowers.length > 0 ? 'text-green-400' : 'text-blue-400'
          },
          { label: 'Moon Phase', value: moon.emoji, sub: moon.phase, icon: Moon, color: 'text-yellow-300' },
          { label: 'Illumination', value: `${moon.illumination}%`, sub: moon.illumination > 60 ? 'affects viewing' : 'good for viewing', icon: Eye, color: 'text-blue-400' },
          { label: 'Cloud Cover', value: weather ? `${weather.cloudCover}%` : weatherDenied ? 'Allow location' : '…', sub: weather ? (weather.cloudCover < 30 ? 'clear skies' : weather.cloudCover < 60 ? 'partly cloudy' : 'overcast') : undefined, icon: Cloud, color: 'text-purple-400' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4 rounded-2xl">
            <Icon size={16} className={`${color} mb-2`} />
            <p className="text-xl font-bold font-space">{value}</p>
            {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
            <p className="text-[10px] text-white/35 uppercase tracking-wider mt-1 font-mono">{label}</p>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Next Shower Countdown */}
        <div className="lg:col-span-2">
          {nextShower ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6 rounded-2xl h-full relative overflow-hidden"
            >
              <MeteorVisualizer zhr={nextShower.zhr} active={true} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="section-label text-orange-400">Next Peak Event</span>
                </div>
                <h2 className="text-3xl font-bold font-space mb-1">{nextShower.name}</h2>
                <p className="text-sm text-white/50 mb-6">
                  {nextShower.constellation} constellation · Up to {nextShower.zhr} meteors/hour
                </p>
                <CountdownTimer targetDate={nextShower.peak} label="Until Peak" />
                <div className="mt-6 flex items-center gap-3">
                  <Link to={`/shower/${nextShower.id}`} className="btn-primary text-xs">
                    <ArrowRight size={12} />
                    Full Details
                  </Link>
                  <button
                    onClick={() => {
                      toggleWatch(nextShower);
                      addNotification({
                        title: watched.some(w => w.id === nextShower.id) ? 'Removed from watchlist' : 'Added to watchlist!',
                        message: `${nextShower.name} — peak ${formatDate(nextShower.peak)}`,
                        type: 'success',
                      });
                    }}
                    className="btn-secondary text-xs"
                  >
                    {watched.some(w => w.id === nextShower.id) ? <BellOff size={12} /> : <Bell size={12} />}
                    {watched.some(w => w.id === nextShower.id) ? 'Unwatch' : 'Watch'}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="glass-card p-6 rounded-2xl flex items-center justify-center h-full">
              <p className="text-white/30 text-sm">No upcoming showers found</p>
            </div>
          )}
        </div>

        {/* ISS + Moon */}
        <div className="flex flex-col gap-4">
          <ISSWidget />
          <div className="glass-card p-4 rounded-2xl flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Moon size={14} className="text-yellow-300" />
              <span className="text-xs font-semibold font-space text-white/70">Moon Status</span>
            </div>
            <p className="text-3xl mb-1">{moon.emoji}</p>
            <p className="text-sm font-semibold text-white/80">{moon.phase}</p>
            <p className="text-xs text-white/40 mt-1">{moon.illumination}% illuminated</p>
            <div className="mt-3 h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-200 rounded-full transition-all" style={{ width: `${moon.illumination}%` }} />
            </div>
            <p className="text-[10px] text-white/30 mt-2">
              {moon.illumination > 50 ? 'Bright moon — expect reduced visibility' : 'Good conditions for viewing'}
            </p>
          </div>
        </div>
      </div>

      {/* Active Showers */}
      {activeShowers.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="live-dot" />
            <h2 className="text-lg font-bold font-space">Active Right Now</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeShowers.map(s => (
              <motion.div
                key={s.id}
                whileHover={{ y: -2 }}
                className="glass-card p-4 rounded-2xl border border-green-500/15"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="badge-active text-[10px] px-2 py-0.5 rounded-full font-mono">ACTIVE</span>
                    <h3 className="text-base font-bold mt-1">{s.name}</h3>
                  </div>
                  <span className="text-xs font-mono text-white/40">{s.zhr} ZHR</span>
                </div>
                <p className="text-xs text-white/50 mb-3 line-clamp-2">{s.description}</p>
                <Link to={`/shower/${s.id}`} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Details <ArrowRight size={11} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Showers */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-space">Coming Up</h2>
          <Link to="/calendar" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            Full Calendar <ArrowRight size={11} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {upcomingShowers.map((s, i) => {
            const daysUntil = getDaysUntilPeak(s);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-4 rounded-2xl group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="badge-upcoming text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {daysUntil > 0 ? `IN ${daysUntil}d` : 'SOON'}
                  </span>
                  <Sparkles size={12} className="text-blue-400/50" />
                </div>
                <h3 className="text-sm font-bold mb-1 group-hover:text-blue-300 transition-colors">{s.name}</h3>
                <p className="text-[10px] text-white/35 font-mono mb-2">Peak: {formatDate(s.peak)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{s.constellation}</span>
                  <span className="text-[10px] font-mono text-orange-400">{s.zhr} ZHR</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* NASA APOD — always render */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Rocket size={14} className="text-orange-400" />
          <h2 className="text-lg font-bold font-space">NASA Astronomy Picture of the Day</h2>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          {apodLoading ? (
            <div className="h-56 flex items-center justify-center bg-gradient-to-br from-blue-950/40 to-purple-950/40 animate-pulse">
              <div className="text-center">
                <Rocket size={28} className="text-orange-400/40 mx-auto mb-2" />
                <p className="text-xs text-white/25 font-mono">Fetching from NASA…</p>
              </div>
            </div>
          ) : apod ? (
            apod.media_type === 'image' ? (
              <img src={apod.url} alt={apod.title} className="w-full h-56 object-cover" loading="lazy" />
            ) : (
              <div className="h-56 bg-gradient-to-br from-blue-900/20 to-purple-900/20 flex items-center justify-center">
                <a href={apod.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  <ExternalLink size={12} /> Watch on NASA
                </a>
              </div>
            )
          ) : (
            /* Fallback: beautiful static space gradient with link to APOD */
            <div className="h-56 relative overflow-hidden bg-gradient-to-br from-[#050520] via-[#0a0540] to-[#0d0228] flex items-center justify-center">
              <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(79,142,247,0.4) 0%, transparent 60%), radial-gradient(circle at 70% 30%, rgba(139,92,246,0.3) 0%, transparent 50%)' }} />
              <div className="relative text-center">
                <p className="text-4xl mb-2">🔭</p>
                <p className="text-sm font-semibold text-white/70 mb-1">Astronomy Picture of the Day</p>
                <p className="text-xs text-white/35 mb-4">NASA APOD · Updated daily</p>
                <a href="https://apod.nasa.gov" target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                  <ExternalLink size={11} /> View on NASA
                </a>
              </div>
            </div>
          )}
          {apod && (
            <div className="p-5">
              <h3 className="font-bold text-base mb-2">{apod.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{apod.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Observing Conditions — always render */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Cloud size={14} className="text-blue-400" />
          <h2 className="text-lg font-bold font-space">Observing Conditions</h2>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          {weatherDenied || (!weather && !weatherLoading) ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-white/70 mb-1">Enable location for live conditions</p>
                <p className="text-xs text-white/40 leading-relaxed">
                  Allow location access in your browser to see real-time cloud cover, humidity, and sky quality for your area.
                </p>
              </div>
              <div className="text-3xl opacity-40">📍</div>
            </div>
          ) : weatherLoading ? (
            <div className="flex items-center gap-3 animate-pulse">
              <Cloud size={18} className="text-blue-400/40" />
              <p className="text-xs text-white/30 font-mono">Fetching local weather…</p>
            </div>
          ) : weather ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Cloud Cover', value: `${weather.cloudCover}%`, good: weather.cloudCover < 30, icon: Cloud },
                  { label: 'Humidity', value: `${weather.humidity}%`, good: weather.humidity < 70, icon: Wind },
                  { label: 'Sky Quality', value: weather.cloudCover < 20 ? 'Excellent' : weather.cloudCover < 50 ? 'Fair' : 'Poor', good: weather.cloudCover < 50, icon: Eye },
                  { label: 'Moon Impact', value: moon.illumination < 30 ? 'Low' : moon.illumination < 70 ? 'Medium' : 'High', good: moon.illumination < 50, icon: Moon },
                ].map(({ label, value, good, icon: Icon }) => (
                  <div key={label} className="text-center p-3 rounded-xl bg-white/3">
                    <Icon size={18} className={`mx-auto mb-1.5 ${good ? 'text-green-400' : 'text-orange-400'}`} />
                    <p className="text-sm font-bold">{value}</p>
                    <p className="text-[10px] text-white/35 uppercase tracking-wider font-mono mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-white/5">
                <p className="text-xs text-white/40">
                  {weather.cloudCover < 20 ? '✓ Excellent conditions tonight — crystal clear skies expected.' :
                   weather.cloudCover < 50 ? '◎ Partly cloudy — viewing may be intermittent. Find a break in the clouds.' :
                   '✗ Heavy cloud cover — consider rescheduling to a clearer night.'}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={14} className="text-purple-400" />
          <h2 className="text-lg font-bold font-space">Frequently Asked Questions</h2>
        </div>
        <FaqSection />
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
          <div className="flex gap-2">
            {(['all', 'active', 'upcoming', 'past'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium font-space capitalize transition-all ${
                  filter === f ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'glass text-white/50 hover:text-white/80'
                }`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => setSortBy(s => s === 'date' ? 'zhr' : 'date')}
              className="px-3 py-2 rounded-lg text-xs font-medium font-space glass text-white/50 hover:text-white/80 flex items-center gap-1"
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
              const intensityPct = Math.min((s.zhr / 120) * 100, 100);

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
                        status === 'active' ? 'badge-active' :
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
                      >
                        {isWatched ? <Bell size={13} className="animate-pulse" /> : <Bell size={13} />}
                      </button>
                    </div>

                    <h3 className="text-lg font-bold font-space mb-1 group-hover:text-blue-300 transition-colors">{s.name}</h3>
                    <p className="text-[10px] font-mono text-white/35 mb-3">
                      {new Date(s.peak).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-white/50 mb-4 line-clamp-2 leading-relaxed">{s.description}</p>

                    <div className="mb-4">
                      <div className="flex justify-between text-[10px] text-white/35 mb-1.5 font-mono">
                        <span>Intensity</span>
                        <span>{s.zhr} ZHR</span>
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
                      <span className="text-[10px] text-white/30 flex items-center gap-1">
                        <Compass size={10} /> {s.constellation}
                      </span>
                      <Link
                        to={`/shower/${s.id}`}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-space font-semibold"
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
            <Sparkles size={32} className="text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No showers match your search</p>
          </div>
        )}
      </motion.div>
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
      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 text-center">
        <AlertTriangle size={40} className="text-orange-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Shower not found</h2>
        <button onClick={() => navigate('/calendar')} className="btn-primary mt-4">
          <ArrowRight size={13} /> Back to Calendar
        </button>
      </div>
    );
  }

  const status = getShowerStatus(shower);
  const isWatched = watched.some(w => w.id === shower.id);
  const daysUntil = getDaysUntilPeak(shower);

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 mb-6 transition-colors">
          <ChevronRight size={12} className="rotate-180" />
          Back
        </button>

        {/* Header */}
        <div className="glass-card p-8 rounded-2xl relative overflow-hidden mb-6">
          <MeteorVisualizer zhr={shower.zhr} active={status === 'active'} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
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
              <button
                onClick={() => toggleWatch(shower)}
                className={isWatched ? 'btn-secondary' : 'btn-primary'}
              >
                {isWatched ? <><BellOff size={13} /> Unwatch</> : <><Bell size={13} /> Watch Peak</>}
              </button>
              <Link to="/live" className="btn-secondary">
                <Radio size={13} /> Report Sighting
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Peak Date', value: formatDate(shower.peak), icon: Calendar },
            { label: 'ZHR', value: `${shower.zhr}/hr`, icon: Activity },
            { label: 'Constellation', value: shower.constellation, icon: Star },
            { label: 'Days Until', value: daysUntil > 0 ? `${daysUntil} days` : 'Past', icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass-card p-4 rounded-xl">
              <Icon size={14} className="text-blue-400 mb-2" />
              <p className="text-sm font-bold font-space">{value}</p>
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-mono mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold font-space text-white/70 mb-4 flex items-center gap-2">
              <Calendar size={13} className="text-blue-400" /> Activity Window
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Start', val: formatDate(shower.start) },
                { label: 'Peak', val: formatDate(shower.peak) },
                { label: 'End', val: formatDate(shower.end) },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-white/40 text-xs font-mono">{label}</span>
                  <span className="text-white/80 font-semibold">{val}</span>
                </div>
              ))}
            </div>
            {daysUntil > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <CountdownTimer targetDate={shower.peak} label="Time to Peak" />
              </div>
            )}
          </div>

          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-semibold font-space text-white/70 mb-4 flex items-center gap-2">
              <Star size={13} className="text-purple-400" /> Technical Data
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Parent Body', val: shower.parent || '—' },
                { label: 'Constellation', val: shower.constellation },
                { label: 'Orbital Period', val: shower.orbitalPeriod || '—' },
                { label: 'Composition', val: shower.composition || '—' },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-white/40 text-xs font-mono">{label}</span>
                  <span className="text-white/80 text-xs font-semibold">{val}</span>
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

        {/* Historical */}
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
      </motion.div>
    </div>
  );
}

// ─── LIVE FEED PAGE ───────────────────────────────────────────────────────────
function LiveFeed({ addNotification }: { addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void }) {
  const [reports, setReports] = useState<SightingReport[]>([
    { id: '1', time: '2 min ago', location: 'Colorado, USA', magnitude: '-2', duration: '3s', type: 'fireball', verified: true, timestamp: Date.now() - 120000 },
    { id: '2', time: '8 min ago', location: 'Ontario, Canada', magnitude: '1', duration: '1s', type: 'meteor', verified: true, timestamp: Date.now() - 480000 },
    { id: '3', time: '15 min ago', location: 'Bavaria, Germany', magnitude: '-4', duration: '5s', type: 'bolide', verified: false, timestamp: Date.now() - 900000 },
    { id: '4', time: '23 min ago', location: 'New South Wales, AU', magnitude: '0', duration: '2s', type: 'meteor', verified: true, timestamp: Date.now() - 1380000 },
    { id: '5', time: '41 min ago', location: 'Hokkaido, Japan', magnitude: '-1', duration: '2s', type: 'fireball', verified: true, timestamp: Date.now() - 2460000 },
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

  const typeColors: Record<string, string> = {
    meteor: 'text-blue-400',
    fireball: 'text-orange-400',
    bolide: 'text-red-400',
  };

  return (
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
                {reports.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-4 rounded-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold capitalize ${typeColors[r.type]}`}>{r.type}</span>
                          <span className="text-[10px] text-white/30 font-mono">Mag {r.magnitude}</span>
                          {r.verified && <CheckCircle size={11} className="text-green-400" />}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                          <MapPin size={9} />
                          <span>{r.location}</span>
                          <span className="text-white/20">·</span>
                          <Clock size={9} />
                          <span>{r.time}</span>
                          <span className="text-white/20">·</span>
                          <span>{r.duration}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Submit form */}
          <div className="lg:col-span-2">
            <div className="glass-card p-5 rounded-2xl sticky top-24">
              <h3 className="text-sm font-bold font-space mb-4 flex items-center gap-2">
                <Plus size={14} className="text-blue-400" />
                Submit a Sighting
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Location *</label>
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
                    <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Magnitude *</label>
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
                    <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Duration</label>
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
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Type</label>
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
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Notes</label>
                  <textarea
                    placeholder="Color, train, sounds..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="input-field h-20 resize-none"
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
                  {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  {submitting ? 'Submitting...' : 'Submit Report'}
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
  );
}

// ─── GLOBE PAGE ───────────────────────────────────────────────────────────────
function GlobePage() {
  return (
    <div className="relative z-10 pt-16 h-screen flex flex-col">
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
    { icon: Activity, title: 'Real-Time Data', desc: 'Live meteor shower activity tracking using IMO and NASA data sources' },
    { icon: Globe, title: '3D Globe', desc: 'Interactive CesiumJS globe with satellites, debris, and meteor radiant points' },
    { icon: Navigation, title: 'ISS Tracking', desc: 'Live International Space Station position updated every 5 seconds' },
    { icon: Cloud, title: 'Weather Integration', desc: 'Local cloud cover and observing conditions via Open-Meteo API' },
    { icon: Users, title: 'Community Feed', desc: 'Submit and browse real-time meteor sighting reports from around the world' },
    { icon: Bell, title: 'Peak Alerts', desc: 'Watch showers and get notified when they approach peak activity' },
  ];

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-10">
          <p className="section-label text-purple-400 mb-2">About the Project</p>
          <h1 className="text-4xl font-bold font-space mb-3">Built for <span className="text-gradient">Stargazers</span></h1>
          <p className="text-white/50 leading-relaxed max-w-2xl">
            Stargaze.io is a free, open-source celestial tracking platform. We aggregate data from NASA, IMO, CelesTrak,
            Open-Meteo, and more to bring you real-time meteor shower tracking without subscriptions or ads.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-5 rounded-2xl">
              <Icon size={20} className="text-blue-400 mb-3" />
              <h3 className="text-sm font-bold font-space mb-1">{title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="glass-card p-5 rounded-2xl mb-6">
          <h2 className="text-base font-bold font-space mb-4">Data Sources</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: 'NASA APOD', url: 'https://apod.nasa.gov', desc: 'Astronomy Picture of the Day' },
              { name: 'IMO', url: 'https://www.imo.net', desc: 'Meteor shower calendar data' },
              { name: 'CelesTrak', url: 'https://celestrak.org', desc: 'Satellite & debris TLE data' },
              { name: 'Open-Meteo', url: 'https://open-meteo.com', desc: 'Weather forecasts' },
              { name: 'WhereTheISS', url: 'https://wheretheiss.at', desc: 'ISS live position' },
            ].map(({ name, url, desc }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="glass p-3 rounded-xl hover:bg-white/5 transition-colors group">
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
            <div className="text-center py-6">
              <CheckCircle size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm font-semibold">Message sent!</p>
              <p className="text-xs text-white/40 mt-1">We'll get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Name</label>
                  <input type="text" value={formState.name} onChange={e => setFormState(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Your name" required />
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Email</label>
                  <input type="email" value={formState.email} onChange={e => setFormState(f => ({ ...f, email: e.target.value }))} className="input-field" placeholder="you@email.com" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Message</label>
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
  );
}

// ─── PRIVACY POLICY ───────────────────────────────────────────────────────────
function PrivacyPolicy() {
  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-6">
          <Shield size={16} className="text-blue-400" />
          <h1 className="text-3xl font-bold font-space">Privacy Policy</h1>
        </div>
        <p className="text-xs text-white/30 font-mono mb-8">Last updated: January 2026</p>
        <div className="glass-card p-6 rounded-2xl prose prose-invert prose-sm max-w-none">
          {[
            { h: 'Information We Collect', p: 'We collect minimal information necessary to provide our services. This may include location data (if you grant permission) to show local meteor visibility and weather conditions. We do not collect personal information without consent.' },
            { h: 'How We Use Your Information', p: 'Location data is used solely to fetch local weather and observing conditions from Open-Meteo. This data is sent directly from your browser to the weather API and is not stored on our servers.' },
            { h: 'Third-Party Services', p: 'Stargaze.io uses NASA\'s APOD API, Open-Meteo, CelesTrak, and WhereTheISS. These are external services with their own privacy policies. No personal data is shared with these services beyond what is required for their API calls.' },
            { h: 'Cookies', p: 'We use localStorage to save your watchlist preferences. No tracking cookies or advertising cookies are used.' },
            { h: 'Contact', p: 'Questions about this policy? Use the contact form on the About page.' },
          ].map(({ h, p }) => (
            <div key={h} className="mb-6">
              <h2 className="text-sm font-bold text-white/80 mb-2">{h}</h2>
              <p className="text-sm text-white/50 leading-relaxed">{p}</p>
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
        <div className="flex items-center gap-2 mb-6">
          <FileText size={16} className="text-purple-400" />
          <h1 className="text-3xl font-bold font-space">Terms of Service</h1>
        </div>
        <p className="text-xs text-white/30 font-mono mb-8">Last updated: January 2026</p>
        <div className="glass-card p-6 rounded-2xl">
          {[
            { h: 'Acceptance of Terms', p: 'By using Stargaze.io, you agree to these terms. This is a free educational tool — please use it responsibly.' },
            { h: 'Use of Service', p: 'Stargaze.io is provided free of charge for personal, non-commercial use. You may not attempt to disrupt, reverse-engineer, or misuse the service.' },
            { h: 'User-Submitted Content', p: 'Sighting reports you submit may be displayed publicly. Submit only genuine observations. False reports may be removed.' },
            { h: 'Accuracy Disclaimer', p: 'Celestial data (ZHR, peak dates, conditions) is provided for educational purposes. Real viewing conditions may vary. We make no guarantee of accuracy for time-sensitive decisions.' },
            { h: 'Third-Party Data', p: 'We aggregate data from NASA, IMO, CelesTrak, and Open-Meteo. These sources may have their own terms regarding data reuse.' },
            { h: 'Changes', p: 'These terms may be updated periodically. Continued use constitutes acceptance of any changes.' },
          ].map(({ h, p }) => (
            <div key={h} className="mb-6">
              <h2 className="text-sm font-bold text-white/80 mb-2">{h}</h2>
              <p className="text-sm text-white/50 leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── SCROLL TO TOP ────────────────────────────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [pathname]);
  return null;
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

  // Check for upcoming peaks
  useEffect(() => {
    const checkPeaks = () => {
      showers.forEach(s => {
        const hoursUntilPeak = (new Date(s.peak).getTime() - Date.now()) / 3600000;
        const status = getShowerStatus(s);
        if (hoursUntilPeak > 0 && hoursUntilPeak < 48) {
          addNotification({
            title: `${s.name} Peak in ${Math.round(hoursUntilPeak)}h`,
            message: `Peak rate: up to ${s.zhr} meteors/hour. Clear skies!`,
            type: 'info',
          });
        } else if (status === 'active') {
          addNotification({
            title: `${s.name} is Active!`,
            message: 'Go outside and look up — conditions permitting.',
            type: 'success',
          });
        }
      });
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
        <Navbar watched={watched} notifications={notifications} />
        <NotificationToasts notifications={notifications} dismiss={dismissNotification} />

        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home watched={watched} addNotification={addNotification} toggleWatch={toggleWatch} />} />
            <Route path="/calendar" element={<MeteorCalendar watched={watched} toggleWatch={toggleWatch} addNotification={addNotification} />} />
            <Route path="/shower/:id" element={<ShowerDetail watched={watched} toggleWatch={toggleWatch} />} />
            <Route path="/live" element={<LiveFeed addNotification={addNotification} />} />
            <Route path="/globe" element={<GlobePage />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
          </Routes>
        </AnimatePresence>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
