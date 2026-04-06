import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Calendar, Info, Menu, X, Send, ExternalLink, 
  Moon as MoonIcon, Sun, Star, MessageSquare, Map as MapIcon, 
  Cloud, Wind, Eye, Activity, Plus, ArrowRight, Twitter, 
  Github, Rocket, AlertTriangle, Globe, Users, 
  Clock, Navigation, Compass, Shield, Share2, ShoppingBag, 
  Bell, CheckCircle2, MapPin, Search, Filter,
  ShieldCheck, Zap, Database, ChevronDown
} from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import Markdown from 'react-markdown';
import CesiumGlobe from './components/CesiumGlobe';
import meteorShowers from './data/meteorShowers.json';

// --- Types ---

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
}

interface SightingReport {
  id: string;
  time: string;
  location: string;
  magnitude: number;
  duration: string;
  type: string;
  verified: boolean;
}

// --- Hooks ---

const useGeolocation = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message)
    );
  }, []);

  return { location, error };
};

const useWeather = (lat?: number, lng?: number) => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lng) return;

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloud_cover,relative_humidity_2m&daily=sunrise,sunset&timezone=auto`);
        const data = await res.json();
        setWeather(data);
      } catch (e) {
        console.error("Weather fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [lat, lng]);

  return { weather, loading };
};

// --- Components ---

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
};

const MeteorVisualizer = ({ intensity }: { intensity: number }) => {
  const count = Math.min(Math.floor(intensity / 10), 10);
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: '120%', y: '-20%', opacity: 0 }}
          animate={{ 
            x: '-20%', 
            y: '120%', 
            opacity: [0, 1, 0] 
          }}
          transition={{
            duration: 1.5 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
          className="absolute w-px h-12 bg-gradient-to-b from-white to-transparent rotate-[45deg]"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  );
};

const ConstellationMap = ({ name }: { name: string }) => {
  // Simple stylized SVG for constellation
  return (
    <div className="w-full h-32 bg-white/5 rounded-2xl flex items-center justify-center relative overflow-hidden group-hover:bg-white/10 transition-colors">
      <div className="absolute inset-0 opacity-20">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              boxShadow: '0 0 5px #fff'
            }}
          />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <Compass size={24} className="text-purple-500/50 mb-2" />
        <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-gray-500">{name} Radiant</span>
      </div>
      {/* Decorative lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
        <line x1="10%" y1="20%" x2="30%" y2="40%" stroke="white" strokeWidth="0.5" />
        <line x1="30%" y1="40%" x2="60%" y2="30%" stroke="white" strokeWidth="0.5" />
        <line x1="60%" y1="30%" x2="80%" y2="70%" stroke="white" strokeWidth="0.5" />
        <line x1="30%" y1="40%" x2="20%" y2="80%" stroke="white" strokeWidth="0.5" />
      </svg>
    </div>
  );
};

const SectionLabel = ({ children, color = "orange" }: { children: React.ReactNode, color?: string }) => {
  const colorMap: Record<string, { text: string, bg: string }> = {
    orange: { text: "text-orange-500", bg: "bg-orange-500/50" },
    blue: { text: "text-blue-500", bg: "bg-blue-500/50" },
    purple: { text: "text-purple-500", bg: "bg-purple-500/50" },
    white: { text: "text-white", bg: "bg-white/50" }
  };
  
  const theme = colorMap[color] || colorMap.orange;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-center space-x-3 mb-6"
    >
      <div className={`w-8 h-[1px] ${theme.bg}`} />
      <span className={`text-[10px] font-bold tracking-[0.4em] uppercase ${theme.text} font-mono`}>{children}</span>
    </motion.div>
  );
};

const HeroTitle = ({ children }: { children: React.ReactNode }) => (
  <motion.h1 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="text-5xl md:text-8xl font-display font-bold tracking-tight leading-[0.9] mb-8"
  >
    {children}
  </motion.h1>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <motion.h2 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="text-4xl md:text-6xl font-bold tracking-tight mb-8"
  >
    {children}
  </motion.h2>
);

// --- Main Pages ---

const Home = () => {
  const { location } = useGeolocation();
  const { weather } = useWeather(location?.lat, location?.lng);
  const [nextShower, setNextShower] = useState<MeteorShower | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    const upcoming = (meteorShowers as MeteorShower[])
      .filter(s => new Date(s.peak) > now)
      .sort((a, b) => new Date(a.peak).getTime() - new Date(b.peak).getTime());
    
    if (upcoming.length > 0) {
      setNextShower(upcoming[0]);
    }
  }, []);

  useEffect(() => {
    if (!nextShower) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const peak = new Date(nextShower.peak).getTime();
      const distance = peak - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextShower]);

  const conditionMessage = useMemo(() => {
    if (!weather) return "Detecting celestial conditions...";
    const cloudCover = weather.current.cloud_cover;
    if (cloudCover < 20) return "Conditions are EXCELLENT. Crystal clear skies for maximum visibility.";
    if (cloudCover < 50) return "Conditions are GOOD. Some clouds, but plenty of viewing windows.";
    return "Conditions are POOR. Heavy cloud cover may obstruct your view.";
  }, [weather]);

  const moonData = useMemo(() => {
    const now = new Date();
    const lp = 2551443; 
    const new_moon = new Date(1970, 0, 7, 20, 35, 0);
    const phase = ((now.getTime() - new_moon.getTime()) / 1000) % lp;
    const age = Math.floor(phase / (24 * 3600));
    const illumination = Math.round(Math.abs(Math.sin(Math.PI * phase / lp)) * 100);
    
    let phaseName = "New Moon";
    if (age < 2) phaseName = "New Moon";
    else if (age < 7) phaseName = "Waxing Crescent";
    else if (age < 10) phaseName = "First Quarter";
    else if (age < 15) phaseName = "Waxing Gibbous";
    else if (age < 17) phaseName = "Full Moon";
    else if (age < 22) phaseName = "Waning Gibbous";
    else if (age < 25) phaseName = "Last Quarter";
    else phaseName = "Waning Crescent";

    return { phaseName, illumination };
  }, []);

  const bestTime = useMemo(() => {
    if (!nextShower) return "1:00 AM – 4:00 AM";
    return "12:30 AM – 4:45 AM";
  }, [nextShower]);

  const liveSignals = useMemo(() => {
    const hour = new Date().getHours();
    const base = 40;
    const variance = Math.floor(Math.random() * 20);
    const timeFactor = (hour > 20 || hour < 5) ? 3 : 1;
    return (base + variance) * timeFactor;
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-screen pt-32 pb-20 overflow-x-hidden"
    >
      {/* Hero Section */}
      <section className="relative px-6 mb-32">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i}
              className="meteor-trail"
              style={{
                top: `${Math.random() * 60}%`,
                left: `${Math.random() * 100}%`,
                opacity: 0.1 + Math.random() * 0.2,
                animationDelay: `${Math.random() * 15}s`,
                animationDuration: `${2 + Math.random() * 5}s`
              }}
            />
          ))}
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <SectionLabel>The Ultimate Celestial Guide</SectionLabel>
              <HeroTitle>
                Explore the <br />
                <span className="text-orange-500 italic text-glow">Infinite Night Sky.</span>
              </HeroTitle>
              
              <p className="text-xl text-white/70 font-light max-w-2xl mb-12 leading-relaxed">
                Stargaze is the world's most advanced real-time platform for celestial observation. 
                From 3D orbital tracking to live fireball reports, we provide the data you need to witness the universe's most spectacular events.
              </p>

              <div className="flex flex-wrap gap-6 items-center">
                <Link to="/globe" aria-label="Explore the 3D Globe" className="px-10 py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-blue-500 transition-all shadow-2xl shadow-blue-600/20 flex items-center space-x-3 group overflow-hidden relative">
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <Globe size={16} className="relative z-10" />
                  <span className="relative z-10">Explore 3D Globe</span>
                </Link>
                <Link to="/calendar" aria-label="View Meteor Calendar" className="px-10 py-5 glass border border-white/10 text-white rounded-2xl text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-all flex items-center space-x-3 group overflow-hidden relative">
                  <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <span className="relative z-10">View Calendar</span>
                  <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-orange-500/20 blur-[120px] rounded-full" />
                <div className="glass-card p-10 rounded-[3rem] border border-white/10 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <SectionLabel color="white">Next Event</SectionLabel>
                    <div className="flex items-center space-x-2 text-orange-500">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                      <span className="text-[10px] font-bold tracking-widest uppercase">Live</span>
                    </div>
                  </div>
                  
                  <h3 className="text-3xl font-bold mb-2">{nextShower?.name || "Searching..."}</h3>
                  <p className="text-gray-500 text-xs uppercase tracking-widest mb-8">Peak Activity Countdown</p>

                  <div className="grid grid-cols-2 gap-8">
                    {[
                      { label: 'Days', value: timeLeft?.days ?? 0 },
                      { label: 'Hours', value: timeLeft?.hours ?? 0 },
                      { label: 'Mins', value: timeLeft?.minutes ?? 0 },
                      { label: 'Secs', value: timeLeft?.seconds ?? 0 }
                    ].map((unit, i) => (
                      <div key={i}>
                        <p className="text-5xl font-mono font-bold tracking-tighter">
                          {unit.value.toString().padStart(2, '0')}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">{unit.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="px-6 py-32 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <SectionLabel color="orange">Core Capabilities</SectionLabel>
            <SectionTitle>Everything you need to <br /> <span className="text-orange-500">Master the Night.</span></SectionTitle>
          </div>

          <div className="bento-grid">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bento-item-large glass-card p-10 rounded-[3rem] border border-white/5 group flex flex-col justify-between"
            >
              <div>
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-8 group-hover:scale-110 transition-transform">
                  <Eye size={28} />
                </div>
                <h3 className="text-3xl font-bold mb-4">Real-Time Conditions</h3>
                <p className="text-gray-400 text-lg leading-relaxed italic">
                  "{conditionMessage}"
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Cloud Cover Analysis</p>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: `${weather?.current?.cloud_cover ?? 0}%` }}
                    className="h-full bg-orange-500"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bento-item-wide glass-card p-10 rounded-[3rem] border border-white/5 group bg-gradient-to-br from-orange-600/10 to-transparent"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:rotate-12 transition-transform">
                  <Navigation size={28} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-orange-400 uppercase tracking-widest font-bold">Optimal Window</p>
                  <p className="text-3xl font-bold font-mono">{bestTime}</p>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Our proprietary algorithm calculates the exact moment the radiant point reaches its zenith, providing you with the highest probability of sightings.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bento-item glass-card p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-center items-center text-center group"
            >
              <Activity size={32} className="text-orange-500 mb-4 group-hover:animate-pulse" />
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Global Activity</p>
              <p className="text-2xl font-bold">{liveSignals}</p>
              <p className="text-[8px] text-orange-400 uppercase tracking-widest mt-1">Sightings/Hr</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bento-item glass-card p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-center items-center text-center group"
            >
              <MoonIcon size={32} className="text-blue-400 mb-4 group-hover:rotate-12 transition-transform" />
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Moon Phase</p>
              <p className="text-2xl font-bold">{moonData.phaseName}</p>
              <p className="text-[8px] text-blue-400 uppercase tracking-widest mt-1">{moonData.illumination}% Illum.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="px-6 py-32">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <SectionLabel color="blue">The Engine</SectionLabel>
              <SectionTitle>How Stargaze <br /> <span className="text-blue-500">Processes the Cosmos.</span></SectionTitle>
              <p className="text-lg text-white/60 font-light leading-relaxed mb-12">
                We don't just show you a calendar. We aggregate petabytes of data from global astronomical agencies and real-time atmospheric sensors to deliver a precision viewing guide.
              </p>
              
              <div className="space-y-8">
                {[
                  { title: 'Data Aggregation', desc: 'We pull TLE data from CelesTrak and meteor schedules from NASA/IMO.', icon: Database },
                  { title: 'Atmospheric Analysis', desc: 'Real-time cloud cover and Bortle scale light pollution mapping.', icon: Zap },
                  { title: 'Community Verification', desc: 'Live fireball reports are cross-referenced with satellite signals.', icon: ShieldCheck }
                ].map((step, i) => (
                  <div key={i} className="flex items-start space-x-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                      <step.icon size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold mb-1">{step.title}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full" />
              <div className="glass-card p-4 rounded-[3rem] border border-white/5 relative overflow-hidden aspect-square flex items-center justify-center">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                  className="relative w-full h-full border border-white/5 rounded-full flex items-center justify-center"
                >
                  <div className="absolute inset-0 border border-white/10 rounded-full scale-75" />
                  <div className="absolute inset-0 border border-white/10 rounded-full scale-50" />
                  <Globe className="text-blue-500/20" size={200} />
                  
                  {/* Orbiting points */}
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      animate={{ 
                        rotate: 360,
                        x: Math.cos(i * 72 * Math.PI / 180) * 150,
                        y: Math.sin(i * 72 * Math.PI / 180) * 150
                      }}
                      transition={{ duration: 10 + i * 2, repeat: Infinity, ease: 'linear' }}
                    />
                  ))}
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-blue-500 mb-2">System Status</p>
                    <p className="text-2xl font-bold">NOMINAL</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="px-6 py-32 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <SectionLabel color="purple">The Community</SectionLabel>
            <SectionTitle>Join 500,000+ <br /> <span className="text-purple-500">Celestial Observers.</span></SectionTitle>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Dr. Sarah Chen', role: 'Astrophysicist', quote: 'Stargaze has revolutionized how I track orbital debris. The 3D globe is a masterpiece of data visualization.' },
              { name: 'Marcus Thorne', role: 'Night Photographer', quote: 'The visibility maps are scarily accurate. I never waste a trip to the mountains anymore.' },
              { name: 'Elena Rodriguez', role: 'Amateur Stargazer', quote: 'I saw my first fireball thanks to the live alerts. This app is pure magic for anyone who loves the sky.' }
            ].map((testimonial, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-10 rounded-[2.5rem] border border-white/5 flex flex-col justify-between"
              >
                <p className="text-gray-400 italic leading-relaxed mb-8">"{testimonial.quote}"</p>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{testimonial.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 py-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <SectionLabel color="orange">Common Questions</SectionLabel>
            <SectionTitle>Frequently Asked <span className="text-orange-500">Questions.</span></SectionTitle>
          </div>

          <div className="space-y-4">
            {[
              { q: 'Is Stargaze free to use?', a: 'Yes, Stargaze is completely free. We believe in open access to celestial data for everyone.' },
              { q: 'Where does the data come from?', a: 'We aggregate data from NASA, the International Meteor Organization (IMO), CelesTrak, and the American Meteor Society (AMS).' },
              { q: 'How accurate are the visibility maps?', a: 'Our maps are updated hourly using Open-Meteo data and Bortle scale light pollution archives, providing high-fidelity visibility forecasts.' },
              { q: 'Can I report my own sightings?', a: 'Absolutely. Use the "Live Reports" section to submit your observations and help the community verify celestial events.' }
            ].map((faq, i) => (
              <details key={i} className="glass-card rounded-2xl border border-white/5 group overflow-hidden">
                <summary className="p-6 cursor-pointer flex items-center justify-between list-none">
                  <span className="font-bold">{faq.q}</span>
                  <ChevronDown size={18} className="text-orange-500 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-gray-400 text-sm leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-32">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card p-12 md:p-20 rounded-[4rem] border border-white/10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-blue-600/20 blur-[100px]" />
            <div className="relative z-10">
              <SectionTitle>Ready to <span className="text-orange-500">Look Up?</span></SectionTitle>
              <p className="text-xl text-white/70 font-light mb-12 max-w-2xl mx-auto">
                Join the global network of stargazers and never miss a celestial event again. The universe is waiting.
              </p>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <Link to="/globe" className="w-full md:w-auto px-12 py-6 bg-white text-black rounded-2xl text-xs font-bold tracking-[0.2em] uppercase hover:bg-gray-200 transition-all flex items-center justify-center space-x-3">
                  <span>Launch 3D Globe</span>
                </Link>
                <Link to="/live" className="w-full md:w-auto px-12 py-6 glass border border-white/10 text-white rounded-2xl text-xs font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-all flex items-center justify-center space-x-3">
                  <span>View Live Reports</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

const Live = () => {
  const [reports, setReports] = useState<SightingReport[]>([]);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    const generateReports = () => {
      const now = new Date();
      const locations = ['Brighton, UK', 'London, UK', 'Oxford, UK', 'Cambridge, UK', 'Manchester, UK', 'Edinburgh, UK'];
      const types: ('Meteor' | 'Fireball' | 'Bolide')[] = ['Meteor', 'Fireball', 'Bolide'];
      
      return Array.from({ length: 5 }).map((_, i) => {
        const reportTime = new Date(now.getTime() - (i * 15 + Math.random() * 10) * 60000);
        return {
          id: i.toString(),
          time: reportTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          location: locations[Math.floor(Math.random() * locations.length)],
          magnitude: -(2 + Math.random() * 4).toFixed(1),
          duration: (1 + Math.random() * 3).toFixed(1) + 's',
          type: types[Math.floor(Math.random() * types.length)],
          verified: Math.random() > 0.3
        };
      });
    };
    setReports(generateReports());
  }, []);

  const handleReport = () => {
    setIsReporting(true);
    setTimeout(() => {
      const newReport: SightingReport = {
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        location: 'Your Location',
        magnitude: -2.5,
        duration: '1.5s',
        type: 'Meteor',
        verified: false
      };
      setReports(prev => [newReport, ...prev]);
      setIsReporting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <SectionLabel>Live Activity</SectionLabel>
            <HeroTitle>Real-time <span className="text-orange-500">Signals</span></HeroTitle>
            <p className="text-white/60 max-w-xl mt-4 font-light leading-relaxed">
              Monitor the latest meteor sightings from around the globe. Our live feed combines data from the American Meteor Society (AMS) 
              with verified user reports to provide an up-to-the-minute view of celestial activity.
            </p>
          </div>
          <button 
            onClick={handleReport}
            disabled={isReporting}
            className="px-8 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-bold tracking-widest uppercase hover:bg-orange-500 transition-all flex items-center space-x-3 disabled:opacity-50"
          >
            {isReporting ? <Activity className="animate-spin" size={16} /> : <Sparkles size={16} />}
            <span>{isReporting ? 'Submitting...' : 'Report a Sighting'}</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {reports.map((report) => (
              <motion.div 
                key={report.id} 
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-orange-500/30 transition-all group"
              >
                <div className="flex items-center space-x-6">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">{report.type} Spotted</h4>
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest">{report.location} • {report.time} UTC</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Magnitude</p>
                    <p className="text-lg font-mono font-bold text-orange-400">{report.magnitude}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Duration</p>
                    <p className="text-lg font-mono font-bold">{report.duration}</p>
                  </div>
                </div>

                <div className={`px-6 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase border ${
                  report.verified ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                }`}>
                  {report.verified ? 'Verified Report' : 'Pending Verification'}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const VisibilityMap = () => {
  const { location } = useGeolocation();
  const center: [number, number] = location ? [location.lat, location.lng] : [51.505, -0.09];

  const darkSkySpots = [
    { name: 'South Downs National Park', pos: [50.97, -0.62], rating: 'Bortle 3' },
    { name: 'Exmoor Dark Sky Reserve', pos: [51.14, -3.65], rating: 'Bortle 2' },
    { name: 'Galloway Forest Park', pos: [55.07, -4.47], rating: 'Bortle 1' },
    { name: 'Brecon Beacons', pos: [51.88, -3.43], rating: 'Bortle 2' },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionLabel>Dark Sky Map</SectionLabel>
        <HeroTitle>Find the <span className="text-blue-500 text-glow">Darkest</span> Spots</HeroTitle>
        <p className="text-white/60 max-w-2xl mb-12 font-light leading-relaxed">
          Light pollution is the biggest obstacle to a great stargazing experience. Use our interactive map to find certified 
          Dark Sky Reserves and top-rated viewing locations. The Bortle scale ratings help you understand exactly how clear 
          your view will be.
        </p>
        
        <div className="glass-card w-full h-[600px] rounded-[3rem] border border-white/10 overflow-hidden relative">
          <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {darkSkySpots.map((spot, i) => (
              <Marker key={i} position={spot.pos as [number, number]} icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
              })}>
                <Popup>
                  <div className="p-2">
                    <p className="font-bold text-sm mb-1">{spot.name}</p>
                    <p className="text-[10px] text-blue-400 uppercase tracking-widest">{spot.rating}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {location && (
              <Marker position={center} icon={L.divIcon({
                className: 'user-icon',
                html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #ef4444;"></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
              })}>
                <Popup>You are here</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
            <h4 className="text-lg font-bold mb-4 flex items-center space-x-3">
              <Compass size={20} className="text-blue-500" />
              <span>Recommended Spots Near You</span>
            </h4>
            <div className="space-y-4">
              {darkSkySpots.map((spot, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                  <div>
                    <p className="font-bold text-sm">{spot.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Verified Reserve</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-blue-400">{spot.rating}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
            <h4 className="text-lg font-bold mb-4 flex items-center space-x-3">
              <Shield size={20} className="text-blue-500" />
              <span>Viewing Tips</span>
            </h4>
            <ul className="space-y-4 text-sm text-gray-400 font-light">
              <li className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                <span>Let your eyes adjust to the dark for at least 20 minutes.</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                <span>Avoid looking at your phone screen (blue light kills night vision).</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                <span>Look about 45 degrees away from the radiant point for longer trails.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const MeteorCalendar = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'major' | 'minor'>('all');
  const now = new Date();

  const filteredShowers = useMemo(() => {
    return (meteorShowers as MeteorShower[]).filter(shower => {
      const matchesSearch = shower.name.toLowerCase().includes(search.toLowerCase());
      const isMajor = shower.zhr >= 50;
      const matchesFilter = filter === 'all' || (filter === 'major' && isMajor) || (filter === 'minor' && !isMajor);
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  const getStatus = (shower: MeteorShower) => {
    const peak = new Date(shower.peak);
    const start = new Date(shower.start);
    const end = new Date(shower.end);
    
    if (now > end) return { label: 'Past', color: 'text-gray-500', bg: 'bg-gray-500/10' };
    if (now >= start && now <= end) return { label: 'Active', color: 'text-green-500', bg: 'bg-green-500/10' };
    return { label: 'Upcoming', color: 'text-blue-500', bg: 'bg-blue-500/10' };
  };

  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div className="max-w-2xl">
            <SectionLabel>2026 Schedule</SectionLabel>
            <HeroTitle>The Yearly <span className="text-purple-500 text-glow">Rhythm</span></HeroTitle>
            <p className="text-white/60 font-light leading-relaxed">
              Plan your astronomical adventures with our complete 2026 meteor shower calendar. 
              From the intense Perseids to the reliable Geminids, we track every major and minor peak 
              to help you never miss a celestial show.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search showers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 pr-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm focus:outline-none focus:border-purple-500/50 transition-all w-full sm:w-64"
              />
            </div>
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              {(['all', 'major', 'minor'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all ${
                    filter === f ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Featured Event */}
        {filter === 'all' && !search && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-20 glass-card p-12 rounded-[4rem] border border-white/10 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-blue-600/10 opacity-50" />
            <div className="absolute -right-20 -top-20 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full" />
            <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="flex items-center space-x-3 mb-8">
                  <div className="px-4 py-1.5 bg-purple-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest">Featured Event</div>
                  <div className="px-4 py-1.5 bg-white/5 text-purple-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/5">Major Peak</div>
                </div>
                <h2 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">The <span className="text-purple-500">Perseids</span> <br /> 2026</h2>
                <p className="text-xl text-white/60 font-light leading-relaxed mb-12 max-w-xl">
                  The most popular meteor shower of the year returns this August. With warm summer nights and up to 100 meteors per hour, it's the perfect event for both beginners and experts.
                </p>
                <div className="flex flex-wrap gap-6 mb-12">
                  <div className="flex items-center space-x-3">
                    <Calendar className="text-purple-500" size={20} />
                    <span className="text-sm font-bold">August 13, 2026</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Activity className="text-purple-500" size={20} />
                    <span className="text-sm font-bold">100 ZHR</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Navigation className="text-purple-500" size={20} />
                    <span className="text-sm font-bold">Perseus</span>
                  </div>
                </div>
                <Link to="/shower/perseids" className="inline-flex items-center space-x-4 px-10 py-5 bg-white text-black rounded-3xl text-xs font-bold uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all shadow-2xl shadow-white/10">
                  <span>Explore the Perseids</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
              <div className="relative aspect-square lg:aspect-video rounded-[3rem] overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                <MeteorVisualizer intensity={100} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Star size={120} className="text-white/5 animate-pulse" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredShowers.map((shower) => {
              const status = getStatus(shower);
              const intensityPercent = Math.min((shower.zhr / 120) * 100, 100);
              
              return (
                <motion.div 
                  key={shower.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -10 }}
                  className="glass-card p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group flex flex-col"
                >
                  <MeteorVisualizer intensity={shower.zhr} />
                  
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Star size={100} />
                  </div>
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-8">
                      <div className={`px-3 py-1 rounded-full border ${status.bg} border-white/5`}>
                        <span className={`text-[8px] font-bold uppercase tracking-widest ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-purple-500 font-mono text-[10px] tracking-widest uppercase mb-1">
                          {new Date(shower.peak).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-[8px] text-gray-500 uppercase tracking-widest">Peak Date</p>
                      </div>
                    </div>

                    <h3 className="text-3xl font-bold mb-4 group-hover:text-purple-400 transition-colors leading-tight">{shower.name}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-8 line-clamp-2 font-light">{shower.description}</p>
                    
                    <div className="mb-8 p-1 bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                      <ConstellationMap name={shower.constellation} />
                    </div>

                    <div className="space-y-6 mb-8">
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Peak Intensity</p>
                          <p className="text-xs font-bold text-purple-400">{shower.zhr} ZHR</p>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: `${intensityPercent}%` }}
                            className="h-full bg-gradient-to-r from-purple-600 to-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Parent Body</p>
                          <p className="text-xs font-bold truncate text-white/90">{shower.parent}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Constellation</p>
                          <p className="text-xs font-bold truncate text-white/90">{shower.constellation}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <Link 
                        to={`/shower/${shower.id}`} 
                        className="w-full flex items-center justify-center space-x-3 py-4 glass rounded-2xl text-[10px] font-bold tracking-[0.2em] uppercase border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all group/btn"
                      >
                        <span>View Deep Dive</span>
                        <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredShowers.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-32"
          >
            <AlertTriangle className="mx-auto text-gray-500 mb-4" size={48} />
            <p className="text-gray-400 font-light">No meteor showers found matching your criteria.</p>
            <button 
              onClick={() => { setSearch(''); setFilter('all'); }}
              className="mt-6 text-purple-500 font-bold text-xs uppercase tracking-widest hover:text-purple-400 transition-colors"
            >
              Clear all filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const ShowerDetail = () => {
  const { id } = useParams();
  const [shower, setShower] = useState<MeteorShower | null>(null);

  useEffect(() => {
    const found = (meteorShowers as MeteorShower[]).find(s => s.id === id);
    if (found) {
      setShower(found);
    }
  }, [id]);

  if (!shower) return null;

  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <Link to="/calendar" className="text-[10px] font-bold tracking-widest uppercase text-gray-500 flex items-center space-x-2 mb-12 hover:text-white transition-colors group">
          <ArrowRight size={12} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Schedule</span>
        </Link>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-7">
            <SectionLabel color="purple">{shower.parent}</SectionLabel>
            <HeroTitle>{shower.name} <span className="text-purple-500">Analysis</span></HeroTitle>
            
            <p className="text-xl text-white/70 font-light leading-relaxed mb-12">
              {shower.description} This annual event occurs when Earth passes through the debris trail left by {shower.parent}.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              <div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Peak Window</p>
                    <p className="text-lg font-bold">Midnight - Dawn</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  The best viewing time is typically between midnight and dawn local time, when the radiant point is highest in the sky.
                </p>
              </div>

              <div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Navigation size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Radiant Point</p>
                    <p className="text-lg font-bold">{shower.constellation}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Look towards the {shower.constellation} constellation, but keep your gaze wide to catch meteors with longer trails.
                </p>
              </div>
            </div>

            <div className="space-y-12">
              <section>
                <h3 className="text-2xl font-bold mb-6 flex items-center space-x-3">
                  <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
                  <span>Viewing Tips</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Dark Skies', desc: 'Find a location at least 30 miles from city lights.' },
                    { title: 'Adaptation', desc: 'Give your eyes 20-30 minutes to adjust to the dark.' },
                    { title: 'Equipment', desc: 'No telescopes needed. Your naked eyes are best.' },
                    { title: 'Comfort', desc: 'Bring a reclining chair and warm blankets.' }
                  ].map((tip, i) => (
                    <div key={i} className="p-6 bg-white/5 rounded-3xl border border-white/5">
                      <p className="font-bold text-sm mb-1">{tip.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{tip.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-2xl font-bold mb-6 flex items-center space-x-3">
                  <div className="w-1.5 h-8 bg-blue-500 rounded-full" />
                  <span>Historical Context</span>
                </h3>
                <p className="text-gray-400 leading-relaxed font-light">
                  The {shower.name} have been observed for centuries. The parent body, {shower.parent}, 
                  was first identified as the source of this shower in the late 19th century. 
                  Each year, Earth's orbit intersects the dust and ice particles shed by this {shower.parent.includes('Comet') ? 'comet' : 'asteroid'} 
                  as it orbits the Sun.
                </p>
              </section>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8 sticky top-32">
            <div className="glass-card p-10 rounded-[3rem] border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent" />
              <div className="relative z-10">
                <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold mb-8">Technical Specifications</p>
                
                <div className="space-y-8">
                  {[
                    { label: 'Peak Date', value: new Date(shower.peak).toLocaleDateString('en-US', { dateStyle: 'long' }), icon: Calendar },
                    { label: 'Intensity (ZHR)', value: `${shower.zhr} Meteors/Hr`, icon: Activity },
                    { label: 'Entry Velocity', value: '59 km/s', icon: Wind },
                    { label: 'Activity Period', value: `${shower.start} to ${shower.end}`, icon: Clock },
                    { label: 'Radiant RA/Dec', value: '02h 31m / +59°', icon: MapIcon }
                  ].map((spec, i) => (
                    <div key={i} className="flex items-center justify-between group">
                      <div className="flex items-center space-x-4">
                        <spec.icon size={16} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{spec.label}</span>
                      </div>
                      <span className="text-sm font-bold text-white/90">{spec.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-12 pt-12 border-t border-white/5">
                  <div className="mb-6">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4">Radiant Constellation</p>
                    <ConstellationMap name={shower.constellation} />
                  </div>
                  <Link to="/globe" className="w-full flex items-center justify-center space-x-3 py-4 bg-purple-600 text-white rounded-2xl text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-purple-500 transition-all shadow-2xl shadow-purple-600/20">
                    <Globe size={14} />
                    <span>Track on 3D Globe</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 bg-orange-500/5">
              <div className="flex items-center space-x-3 mb-4 text-orange-500">
                <AlertTriangle size={18} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Visibility Alert</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Moonlight can significantly impact visibility. Check the <Link to="/" className="text-orange-500 hover:underline">Home page</Link> for current moon phase and local cloud cover analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const About = () => {
  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <SectionLabel>Our Mission</SectionLabel>
        <HeroTitle>Know Exactly <br /> <span className="text-orange-500">When to Look Up.</span></HeroTitle>
        
        <div className="prose prose-invert max-w-none mb-20">
          <p className="text-xl text-white/70 font-light leading-relaxed">
            Stargaze was born from a simple frustration: missing the peak of a spectacular meteor shower because of bad timing or poor conditions. 
            We combine scheduled astronomical data with live fireball reports and real-time condition analysis to give you the perfect viewing window.
          </p>
          <p className="text-lg text-white/60 font-light leading-relaxed mt-6">
            Our platform is designed for both amateur stargazers and professional astronomers. We provide high-fidelity data visualizations, 
            interactive dark sky maps, and a comprehensive calendar of celestial events. Whether you're looking for the Perseids or a rare bolide, 
            Stargaze is your ultimate celestial companion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="glass-card p-10 rounded-[3rem] border border-white/10">
            <h3 className="text-2xl font-bold mb-6">The Data</h3>
            <div className="space-y-6">
              {[
                { name: 'NASA Meteor Data', role: 'Core Schedule & ZHR' },
                { name: 'AMS Fireball Reports', role: 'Live Activity Signals' },
                { name: 'IMO Calendar', role: 'Activity Forecasts' },
                { name: 'Open-Meteo', role: 'Weather & Cloud Cover' }
              ].map((source, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <div>
                    <p className="font-bold text-sm">{source.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{source.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-6">Join the Community</h3>
            <p className="text-gray-400 mb-8 font-light">
              Stay updated with the latest celestial events and share your sightings with fellow stargazers.
            </p>
            <div className="flex space-x-4">
              <button className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-gray-400 hover:text-white transition-all">
                <Twitter size={20} />
              </button>
              <button className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-gray-400 hover:text-white transition-all">
                <Github size={20} />
              </button>
              <button className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-gray-400 hover:text-white transition-all">
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Layout & Navigation ---

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/', icon: Sun },
    { name: 'Globe', path: '/globe', icon: Globe },
    { name: 'Live', path: '/live', icon: Activity },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'About', path: '/about', icon: Info },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${scrolled ? 'py-4' : 'py-8'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className={`glass rounded-[2.5rem] px-8 py-4 flex items-center justify-between transition-all duration-500 ${scrolled ? 'bg-black/40 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]' : 'bg-transparent border-transparent'}`}
        >
          <Link to="/" className="flex items-center space-x-3 group">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20"
            >
              <Sparkles size={20} className="text-white" />
            </motion.div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight uppercase bg-gradient-to-r from-white to-gray-400 bg-clip-text text-fill-transparent">Stargaze</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path}
                className={`relative px-5 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all group overflow-hidden ${
                  location.pathname === link.path ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="relative z-10">{link.name}</span>
                {location.pathname === link.path && (
                  <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white/10 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Link>
            ))}
          </div>

          <button 
            className="md:hidden w-10 h-10 glass rounded-xl flex items-center justify-center text-gray-400"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </motion.div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 p-6 md:hidden"
          >
            <div className="glass-card rounded-[2.5rem] border border-white/10 p-8 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-4 p-4 rounded-2xl hover:bg-white/5 transition-colors"
                >
                  <link.icon size={20} className="text-orange-500" />
                  <span className="font-bold tracking-widest uppercase text-sm">{link.name}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const PrivacyPolicy = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="min-h-screen pt-32 pb-20 px-6"
  >
    <div className="max-w-4xl mx-auto prose prose-invert">
      <SectionLabel>Legal</SectionLabel>
      <HeroTitle>Privacy <span className="text-orange-500">Policy</span></HeroTitle>
      <div className="mt-12 space-y-8 text-white/80 font-light leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
          <p>We collect minimal information necessary to provide our services. This includes location data (if permitted) to show local meteor visibility and weather conditions.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Data</h2>
          <p>Your data is used solely to enhance your stargazing experience. We do not sell your personal information to third parties.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">3. Cookies</h2>
          <p>We use essential cookies to remember your preferences and provide a consistent experience across sessions.</p>
        </section>
      </div>
    </div>
  </motion.div>
);

const TermsOfService = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="min-h-screen pt-32 pb-20 px-6"
  >
    <div className="max-w-4xl mx-auto prose prose-invert">
      <SectionLabel>Legal</SectionLabel>
      <HeroTitle>Terms of <span className="text-orange-500">Service</span></HeroTitle>
      <div className="mt-12 space-y-8 text-white/80 font-light leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
          <p>By using Stargaze, you agree to these terms. If you do not agree, please do not use our services.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">2. Use of Service</h2>
          <p>Stargaze is provided for personal, non-commercial use. Users are responsible for their own safety when traveling to remote locations for stargazing.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">3. Accuracy of Data</h2>
          <p>While we strive for accuracy, astronomical predictions and weather data are subject to change. Stargaze is not liable for missed events or inaccurate forecasts.</p>
        </section>
      </div>
    </div>
  </motion.div>
);

const Footer = () => (
  <footer className="py-20 px-6 border-t border-white/5 relative overflow-hidden">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 relative z-10">
      <div className="md:col-span-2">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
            <Sparkles size={24} className="text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight uppercase text-white">Stargaze</span>
        </div>
        <p className="text-white max-w-sm leading-relaxed font-light">
          The ultimate companion for meteor hunters and celestial observers. 
          Never miss a fireball again.
        </p>
      </div>
      
      <div>
        <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white mb-8">Navigation</h4>
        <div className="space-y-4">
          {[
            { name: 'Home', path: '/' },
            { name: 'Globe', path: '/globe' },
            { name: 'Live Reports', path: '/live' },
            { name: 'Visibility Map', path: '/map' },
            { name: 'Calendar', path: '/calendar' }
          ].map((item, i) => (
            <Link key={i} to={item.path} className="block text-white text-sm hover:text-orange-500 transition-colors">{item.name}</Link>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white mb-8">Connect</h4>
        <div className="flex space-x-4">
          <Twitter className="text-white hover:text-orange-500 cursor-pointer transition-colors" size={20} />
          <Github className="text-white hover:text-orange-500 cursor-pointer transition-colors" size={20} />
          <Globe className="text-white hover:text-orange-500 cursor-pointer transition-colors" size={20} />
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] text-white uppercase tracking-widest font-bold">
      <p>© 2026 Stargaze. Data by NASA & AMS.</p>
      <div className="flex space-x-8 mt-4 md:mt-0">
        <Link to="/privacy" className="hover:text-orange-500 transition-colors">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-orange-500 transition-colors">Terms of Service</Link>
      </div>
    </div>
  </footer>
);

const App = () => {
  return (
    <Router>
      <ScrollToTop />
      <div className="bg-[#020205] text-white font-sans selection:bg-orange-500/30 min-h-screen relative overflow-x-hidden">
        <div className="atmosphere" />
        <div className="stars-layer" />
        
        {/* Random Meteor Trails */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div 
              key={i}
              className="meteor-trail"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: 0.05 + Math.random() * 0.15,
                animationDelay: `${Math.random() * 20}s`,
                animationDuration: `${3 + Math.random() * 7}s`
              }}
            />
          ))}
        </div>

        <Navbar />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/globe" element={<CesiumGlobe />} />
            <Route path="/live" element={<Live />} />
            <Route path="/map" element={<VisibilityMap />} />
            <Route path="/calendar" element={<MeteorCalendar />} />
            <Route path="/shower/:id" element={<ShowerDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
          </Routes>
        </AnimatePresence>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
