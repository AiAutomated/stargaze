import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Calendar, Info, Menu, X, Send, ExternalLink, 
  Moon as MoonIcon, Sun, Star, MessageSquare, Map as MapIcon, 
  Cloud, Wind, Eye, Activity, Plus, ArrowRight, Twitter, 
  Github, Rocket, Zap, AlertTriangle, Globe, Users, 
  Clock, Navigation, Compass, Shield, Share2, ShoppingBag, 
  Bell, CheckCircle2, MapPin, Search, Filter
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { useInView } from 'react-intersection-observer';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import Markdown from 'react-markdown';
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

const StargazeGuide = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: "Clear skies! I'm your Stargaze Guide. Ask me when to look up or how to spot the next fireball!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', text: messageText }]);
    if (!text) setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messageText,
        config: {
          systemInstruction: "You are the Stargaze Guide, an expert in meteor showers and fireballs from Stargaze. You help people know when and where to look for meteors. Keep answers concise, inspiring, and focused on meteor activity. Use markdown for formatting."
        }
      });
      setMessages(prev => [...prev, { role: 'ai', text: response.text || "The stars are silent right now. Try again later!" }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      let errorMsg = "I'm having trouble connecting to the celestial network.";
      if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        errorMsg = "The celestial network is currently at peak capacity. Please try again in a few minutes.";
      }
      setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, y: 40, filter: 'blur(10px)' }}
            className="glass-card w-[350px] sm:w-[400px] h-[600px] mb-6 rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/10"
          >
            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Zap size={20} className="text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#020205] rounded-full" />
                </div>
                <div>
                  <p className="font-display font-bold text-sm tracking-widest uppercase">STARGAZE GUIDE</p>
                  <p className="text-[10px] text-orange-400 font-mono tracking-widest uppercase">Live Tracking Online</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 glass rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.map((msg, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 rounded-tr-none' 
                      : 'glass-card text-gray-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="glass-card p-4 rounded-3xl rounded-tl-none space-x-1.5 flex items-center">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </motion.div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 bg-white/5">
              <div className="relative flex items-center">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask about meteor showers..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-gray-600"
                />
                <button 
                  onClick={() => sendMessage()} 
                  disabled={!input.trim()}
                  className="absolute right-2 p-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-600/20"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-gradient-to-br from-orange-600 to-red-700 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-orange-600/30 group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Zap className="text-white group-hover:rotate-12 transition-transform" size={28} />
      </motion.button>
    </div>
  );
};

const SectionLabel = ({ children, color = "orange" }: { children: React.ReactNode, color?: string }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    className="flex items-center space-x-3 mb-6"
  >
    <div className={`w-8 h-[1px] bg-${color}-500/50`} />
    <span className={`text-[10px] font-bold tracking-[0.4em] uppercase text-${color}-500 font-mono`}>{children}</span>
  </motion.div>
);

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

  return (
    <div className="relative min-h-screen pt-32 pb-20 px-6 overflow-hidden">
      <div className="atmosphere" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7">
            <SectionLabel>Next Meteor Shower</SectionLabel>
            <HeroTitle>
              {nextShower?.name || "No Showers Found"} <br />
              <span className="text-orange-500 italic">Visible from your region</span>
            </HeroTitle>
            
            <p className="text-xl text-gray-400 font-light max-w-xl mb-12 leading-relaxed">
              {nextShower?.description || "Stay tuned for the next celestial event."}
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <div className="glass-card px-8 py-4 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Peak Date</p>
                <p className="text-lg font-bold">{nextShower ? new Date(nextShower.peak).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '---'}</p>
              </div>
              <div className="glass-card px-8 py-4 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Meteors/Hour</p>
                <p className="text-lg font-bold">{nextShower?.zhr || '---'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <Link to="/calendar" className="px-10 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-orange-500 transition-all shadow-2xl shadow-orange-600/20 flex items-center space-x-3 group">
                <span>View Full Calendar</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <div className="flex items-center space-x-3 text-orange-500 animate-pulse">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Live Activity Detected</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-10 rounded-[3rem] border border-white/10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Clock size={120} />
              </div>
              
              <div className="relative z-10">
                <SectionLabel color="white">Countdown to Peak</SectionLabel>
                
                <div className="grid grid-cols-4 gap-4 mb-10">
                  {[
                    { label: 'Days', value: timeLeft?.days ?? 0 },
                    { label: 'Hours', value: timeLeft?.hours ?? 0 },
                    { label: 'Mins', value: timeLeft?.minutes ?? 0 },
                    { label: 'Secs', value: timeLeft?.seconds ?? 0 }
                  ].map((unit, i) => (
                    <div key={i} className="text-center">
                      <p className="text-4xl md:text-5xl font-mono font-bold tracking-tighter mb-1">
                        {unit.value.toString().padStart(2, '0')}
                      </p>
                      <p className="text-[8px] text-gray-500 uppercase tracking-widest">{unit.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <div className="flex items-center space-x-4 mb-3">
                      <Eye size={18} className="text-orange-400" />
                      <p className="text-[10px] font-bold tracking-widest uppercase">Viewing Conditions</p>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed italic">
                      "{conditionMessage}"
                    </p>
                  </div>

                  <div className="p-6 bg-orange-600/10 rounded-3xl border border-orange-500/20">
                    <div className="flex items-center space-x-4 mb-3">
                      <Navigation size={18} className="text-orange-400" />
                      <p className="text-[10px] font-bold tracking-widest uppercase">Best Time Tonight</p>
                    </div>
                    <p className="text-xl font-bold text-white">
                      {weather ? "1:40 AM – 4:30 AM" : "Calculating..."}
                    </p>
                    <p className="text-[10px] text-orange-400 mt-1 uppercase tracking-widest">Local Time</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="mt-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 group hover:border-orange-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-6">
                <Activity size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Live Fireball Reports</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">Increased activity reported in the last hour near your region.</p>
              <Link to="/live" className="text-[10px] font-bold tracking-widest uppercase text-orange-500 flex items-center space-x-2 group-hover:translate-x-2 transition-transform">
                <span>View Reports</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 group hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                <MapIcon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Visibility Map</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">Find the darkest skies and best visibility zones in your area.</p>
              <Link to="/map" className="text-[10px] font-bold tracking-widest uppercase text-blue-500 flex items-center space-x-2 group-hover:translate-x-2 transition-transform">
                <span>Open Map</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 group hover:border-purple-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-6">
                <Calendar size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Yearly Calendar</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">Plan your year with our comprehensive meteor shower schedule.</p>
              <Link to="/calendar" className="text-[10px] font-bold tracking-widest uppercase text-purple-500 flex items-center space-x-2 group-hover:translate-x-2 transition-transform">
                <span>View Schedule</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Live = () => {
  const [reports, setReports] = useState<SightingReport[]>([]);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    setReports([
      { id: '1', time: '14:20', location: 'Brighton, UK', magnitude: -4.2, duration: '2.5s', type: 'Fireball', verified: true },
      { id: '2', time: '13:45', location: 'London, UK', magnitude: -3.1, duration: '1.8s', type: 'Meteor', verified: true },
      { id: '3', time: '12:10', location: 'Oxford, UK', magnitude: -5.5, duration: '4.1s', type: 'Bolide', verified: true },
      { id: '4', time: '11:30', location: 'Cambridge, UK', magnitude: -2.8, duration: '1.2s', type: 'Meteor', verified: true },
    ]);
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
          </div>
          <button 
            onClick={handleReport}
            disabled={isReporting}
            className="px-8 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-bold tracking-widest uppercase hover:bg-orange-500 transition-all flex items-center space-x-3 disabled:opacity-50"
          >
            {isReporting ? <Activity className="animate-spin" size={16} /> : <Zap size={16} />}
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
                    <Zap size={24} />
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
        <HeroTitle>Find the <span className="text-blue-500">Darkest</span> Spots</HeroTitle>
        
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
  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <SectionLabel>2026 Schedule</SectionLabel>
        <HeroTitle>The Yearly <span className="text-purple-500">Rhythm</span></HeroTitle>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(meteorShowers as MeteorShower[]).map((shower) => (
            <motion.div 
              key={shower.id}
              whileHover={{ y: -10 }}
              className="glass-card p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Star size={80} />
              </div>
              
              <div className="relative z-10">
                <p className="text-purple-500 font-mono text-[10px] tracking-widest uppercase mb-2">{new Date(shower.peak).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                <h3 className="text-2xl font-bold mb-4 group-hover:text-purple-400 transition-colors">{shower.name}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-8 line-clamp-3">{shower.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-3 bg-white/5 rounded-2xl">
                    <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Peak ZHR</p>
                    <p className="text-sm font-bold">{shower.zhr}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-2xl">
                    <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Parent Body</p>
                    <p className="text-sm font-bold truncate">{shower.parent}</p>
                  </div>
                </div>

                <Link to={`/shower/${shower.id}`} className="w-full block text-center py-3 glass rounded-xl text-[9px] font-bold tracking-widest uppercase border border-white/5 hover:bg-white/10 transition-colors">
                  View Deep Dive
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ShowerDetail = () => {
  const { id } = useParams();
  const [shower, setShower] = useState<MeteorShower | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const found = (meteorShowers as MeteorShower[]).find(s => s.id === id);
    if (found) {
      setShower(found);
      fetchDetails(found);
    }
  }, [id]);

  const fetchDetails = async (s: MeteorShower) => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a deep-dive guide for the ${s.name} meteor shower. Include its history, best viewing constellations, photography tips, and what makes it unique. Use markdown.`,
      });
      setDetails(response.text || "No details found.");
    } catch (e) {
      console.error(e);
      setDetails("Failed to load celestial insights.");
    } finally {
      setLoading(false);
    }
  };

  if (!shower) return null;

  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/calendar" className="text-[10px] font-bold tracking-widest uppercase text-gray-500 flex items-center space-x-2 mb-8 hover:text-white transition-colors">
          <ArrowRight size={12} className="rotate-180" />
          <span>Back to Calendar</span>
        </Link>
        
        <SectionLabel color="purple">{shower.parent}</SectionLabel>
        <HeroTitle>{shower.name} <span className="text-purple-500">Guide</span></HeroTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="glass-card p-6 rounded-3xl border border-white/5">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Peak Date</p>
            <p className="text-lg font-bold">{new Date(shower.peak).toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
          </div>
          <div className="glass-card p-6 rounded-3xl border border-white/5">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Intensity</p>
            <p className="text-lg font-bold">{shower.zhr} Meteors/Hr</p>
          </div>
          <div className="glass-card p-6 rounded-3xl border border-white/5">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Velocity</p>
            <p className="text-lg font-bold">59 km/s</p>
          </div>
        </div>

        <div className="glass-card p-10 rounded-[3rem] border border-white/10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="w-12 h-12 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-gray-500 font-mono text-[10px] tracking-widest uppercase animate-pulse">Consulting the star charts...</p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none prose-purple">
              <Markdown>{details || ""}</Markdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GearHub = () => {
  const gear = [
    { name: 'Celestron Skymaster 15x70', category: 'Binoculars', price: '$99', link: '#', desc: 'Perfect entry-level for meteor watching and moon details.' },
    { name: 'Red Light Headlamp', category: 'Essential', price: '$15', link: '#', desc: 'Preserve your night vision while navigating the dark.' },
    { name: 'Sky-Watcher Heritage 130p', category: 'Telescope', price: '$250', link: '#', desc: 'The best portable telescope for hobbyists.' },
    { name: 'Warm Observation Suit', category: 'Apparel', price: '$120', link: '#', desc: 'Stay warm during long winter observation sessions.' },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <SectionLabel color="orange">Monetization Hub</SectionLabel>
        <HeroTitle>Recommended <span className="text-orange-500">Gear</span></HeroTitle>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {gear.map((item, i) => (
            <div key={i} className="glass-card p-8 rounded-[2.5rem] border border-white/5 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-6">
                <ShoppingBag size={24} />
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{item.category}</p>
              <h3 className="text-xl font-bold mb-4">{item.name}</h3>
              <p className="text-gray-500 text-xs leading-relaxed mb-8 flex-grow">{item.desc}</p>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-lg font-bold">{item.price}</span>
                <a href={item.link} className="p-3 glass rounded-xl text-orange-500 hover:bg-orange-500/10 transition-colors">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 glass-card p-12 rounded-[3rem] border border-orange-500/20 text-center max-w-3xl mx-auto">
          <Bell size={48} className="mx-auto mb-6 text-orange-500" />
          <h3 className="text-3xl font-bold mb-4">Never Miss a Peak</h3>
          <p className="text-gray-400 mb-8 font-light">Get SMS or Email alerts when meteor activity is high in your region.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-orange-500/50 transition-all sm:w-80"
            />
            <button className="px-10 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-bold tracking-widest uppercase hover:bg-orange-500 transition-all">
              Notify Me
            </button>
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
          <p className="text-xl text-gray-400 font-light leading-relaxed">
            Stargaze was born from a simple frustration: missing the peak of a spectacular meteor shower because of bad timing or poor conditions. 
            We combine scheduled astronomical data with live fireball reports and AI-driven condition analysis to give you the perfect viewing window.
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
    { name: 'Live', path: '/live', icon: Activity },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Gear', path: '/gear', icon: ShoppingBag },
    { name: 'About', path: '/about', icon: Info },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled ? 'py-4' : 'py-8'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className={`glass-card rounded-[2rem] border border-white/10 px-8 py-4 flex items-center justify-between transition-all ${scrolled ? 'bg-black/40 backdrop-blur-2xl' : 'bg-transparent'}`}>
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:rotate-12 transition-transform">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight uppercase">Stargaze</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path}
                className={`px-5 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all ${
                  location.pathname === link.path ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <button 
            className="md:hidden w-10 h-10 glass rounded-xl flex items-center justify-center text-gray-400"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
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

const Footer = () => (
  <footer className="py-20 px-6 border-t border-white/5 relative overflow-hidden">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 relative z-10">
      <div className="md:col-span-2">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
            <Zap size={24} className="text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight uppercase">Stargaze</span>
        </div>
        <p className="text-gray-500 max-w-sm leading-relaxed font-light">
          The ultimate companion for meteor hunters and celestial observers. 
          Never miss a fireball again.
        </p>
      </div>
      
      <div>
        <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white mb-8">Navigation</h4>
        <div className="space-y-4">
          {['Home', 'Live Reports', 'Visibility Map', 'Calendar', 'Gear Hub'].map((item, i) => (
            <p key={i} className="text-gray-500 text-sm hover:text-orange-500 cursor-pointer transition-colors">{item}</p>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white mb-8">Connect</h4>
        <div className="flex space-x-4">
          <Twitter className="text-gray-500 hover:text-white cursor-pointer transition-colors" size={20} />
          <Github className="text-gray-500 hover:text-white cursor-pointer transition-colors" size={20} />
          <Globe className="text-gray-500 hover:text-white cursor-pointer transition-colors" size={20} />
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-600 uppercase tracking-widest font-bold">
      <p>© 2026 Stargaze. Data by NASA & AMS.</p>
      <div className="flex space-x-8 mt-4 md:mt-0">
        <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
        <span className="hover:text-white cursor-pointer transition-colors">Terms of Service</span>
      </div>
    </div>
  </footer>
);

const App = () => {
  return (
    <Router>
      <div className="bg-[#020205] text-white font-sans selection:bg-orange-500/30">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Live />} />
          <Route path="/map" element={<VisibilityMap />} />
          <Route path="/calendar" element={<MeteorCalendar />} />
          <Route path="/shower/:id" element={<ShowerDetail />} />
          <Route path="/gear" element={<GearHub />} />
          <Route path="/about" element={<About />} />
        </Routes>
        <Footer />
        <StargazeGuide />
      </div>
    </Router>
  );
};

export default App;
