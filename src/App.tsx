import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Calendar, BookOpen, Info, Menu, X, Send, ExternalLink, Moon as MoonIcon, Sun, Star, MessageSquare, Map as MapIcon, Cloud, Wind, Eye, Activity, Trash2, Plus, ArrowRight, Twitter, Github, Rocket, Zap, AlertTriangle, Globe, Users } from 'lucide-react';
import { db, collection, addDoc, getDocs, query, orderBy, limit, where, auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import { useInView } from 'react-intersection-observer';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars as ThreeStars, Sphere, MeshDistortMaterial, Float } from '@react-three/drei';
import * as THREE from 'three';
import events2026 from './data/events2026.json';
import forumCategories from './data/forumCategories.json';

// --- Components ---

const StargazeAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: "Clear skies! I'm your Stargaze Guide. Ask me anything about the cosmos!" }
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
          systemInstruction: "You are the Stargaze Guide, a friendly and expert astronomer. You help hobbyists identify stars, planets, and provide stargazing tips. Keep answers concise and inspiring. Use markdown for formatting."
        }
      });
      setMessages(prev => [...prev, { role: 'ai', text: response.text || "The stars are silent right now. Try again later!" }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      let errorMsg = "I'm having trouble connecting to the celestial network.";
      if (error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        errorMsg = "The celestial network is currently at peak capacity (Quota Exceeded). Please try again in a few minutes, or use your own API key for dedicated access.";
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
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#020205] rounded-full" />
                </div>
                <div>
                  <p className="font-display font-bold text-sm tracking-widest uppercase">STARGAZE GUIDE</p>
                  <p className="text-[10px] text-blue-400 font-mono tracking-widest uppercase">AI Assistant Online</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 glass rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            
            {/* Messages */}
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
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 rounded-tr-none' 
                      : 'glass-card text-gray-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="pt-4 space-y-6"
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <BookOpen size={20} />
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold">Quick Start Guide</p>
                    <p className="text-xs text-gray-400 max-w-[200px]">Not sure where to begin? Try asking one of these cosmic questions:</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "What stars are visible tonight?",
                      "How do I use binoculars for stargazing?",
                      "When is the next meteor shower?",
                      "Tell me a fun fact about the Moon"
                    ].map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(suggestion)}
                        className="glass text-left px-5 py-3 rounded-2xl text-[10px] font-bold tracking-widest uppercase text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all border border-white/5 flex items-center justify-between group"
                      >
                        <span>{suggestion}</span>
                        <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="glass-card p-4 rounded-3xl rounded-tl-none space-x-1.5 flex items-center">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-white/5 bg-white/5">
              <div className="relative flex items-center">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask about the stars..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                />
                <button 
                  onClick={() => sendMessage()} 
                  disabled={!input.trim()}
                  className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
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
        className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-700 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-600/30 group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <MessageSquare className="text-white group-hover:rotate-12 transition-transform" size={28} />
        {messages.length > 1 && !isOpen && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#020205]">
            {messages.length - 1}
          </div>
        )}
      </motion.button>
    </div>
  );
};

// --- Event Details Modal ---

const EventDetailsModal = ({ event, onClose }: { event: any, onClose: () => void }) => {
  const [details, setDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY! });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Provide detailed information about the astronomical event: "${event.title}" occurring on ${event.date}. 
          Include:
          1. Historical significance (if any).
          2. Related astronomical facts.
          3. Best viewing tips for this specific event.
          Keep it engaging and informative for a hobbyist astronomer. Use markdown for formatting.`,
          config: {
            systemInstruction: "You are an expert astronomer providing deep insights into celestial events."
          }
        });
        setDetails(response.text || "No additional details found for this event.");
      } catch (error) {
        console.error("Error fetching event details:", error);
        setDetails("Failed to load celestial insights. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (event) fetchDetails();
  }, [event]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-[#020205]/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-[2.5rem] border border-white/10 shadow-2xl"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-start bg-white/[0.02]">
          <div>
            <span className="text-blue-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-2 block">Event Insights</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{event.title}</h2>
            <p className="text-gray-500 font-mono text-xs mt-2 uppercase tracking-widest">{new Date(event.date).toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 glass rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all hover:rotate-90"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-8 md:p-12 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="w-16 h-16 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-gray-500 font-mono text-xs tracking-widest uppercase animate-pulse">Consulting the star charts...</p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none prose-blue">
              <div className="text-gray-300 leading-relaxed whitespace-pre-wrap font-light text-lg">
                {details}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold tracking-widest uppercase hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
          >
            Close Insights
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- AI Image Generation Components ---

const GeneratedImage = ({ prompt, alt, className, aspectRatio = "3:4" }: { prompt: string, alt: string, className?: string, aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  useEffect(() => {
    const generate = async () => {
      if (!inView || imageUrl) return;
      
      setLoading(true);
      setError(false);
      setIsFallback(false);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY! });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: `A cinematic, high-quality astronomical photograph of ${prompt}. Deep space aesthetic, vibrant colors, 8k resolution, professional astrophotography style.` }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: "1K"
            }
          }
        });

        let found = false;
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              setImageUrl(`data:image/png;base64,${part.inlineData.data}`);
              found = true;
              break;
            }
          }
        }
        if (!found) throw new Error("No image in response");
      } catch (err: any) {
        // Silently handle quota errors and use fallback
        if (err?.message?.includes("quota") || err?.message?.includes("RESOURCE_EXHAUSTED")) {
          console.warn("AI Image Quota Exceeded. Using celestial fallback.");
        } else {
          console.error("Generation error:", err);
        }
        
        const seed = encodeURIComponent(prompt.replace(/\s+/g, '-').toLowerCase());
        const [w, h] = aspectRatio === "3:4" ? [600, 800] : 
                     aspectRatio === "4:3" ? [800, 600] : 
                     aspectRatio === "1:1" ? [800, 800] : 
                     aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
        
        setImageUrl(`https://picsum.photos/seed/${seed}/${w}/${h}?blur=1`);
        setIsFallback(true);
      } finally {
        setLoading(false);
      }
    };

    generate();
  }, [prompt, aspectRatio, inView, imageUrl]);

  if (loading) {
    return (
      <div ref={ref} className={`w-full h-full flex items-center justify-center bg-white/5 animate-pulse ${className}`}>
        <Star className="text-blue-500 animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full h-full group">
      <img 
        src={imageUrl || `https://picsum.photos/seed/${prompt}/800/1000`} 
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
        referrerPolicy="no-referrer"
      />
      {isFallback && (
        <div className="absolute top-4 right-4 px-2 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[8px] text-white/60 font-mono tracking-widest uppercase">Celestial Fallback</span>
        </div>
      )}
    </div>
  );
};

const KeySelectionGuard = ({ children }: { children: React.ReactNode }) => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasKey(selected);
        }
      } catch (error) {
        console.warn("Key check failed, defaulting to true:", error);
      } finally {
        setChecking(false);
      }
    };
    
    checkKey();
    
    // Safety timeout to prevent infinite blank screen
    const timeout = setTimeout(() => setChecking(false), 2000);
    return () => clearTimeout(timeout);
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  if (checking) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020205]">
        <div className="atmosphere" />
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020205] p-4">
        <div className="atmosphere" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 md:p-12 rounded-[3rem] max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Activity size={40} className="text-blue-500" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4">Celestial Connection Required</h2>
          <p className="text-gray-400 mb-8 font-light text-sm leading-relaxed">
            To generate real-time celestial imagery and access advanced astronomical insights, please select your Gemini API key.
          </p>
          <button 
            onClick={handleSelectKey}
            className="w-full bg-white text-black py-4 rounded-2xl font-bold tracking-widest uppercase hover:bg-blue-500 hover:text-white transition-all mb-6"
          >
            SELECT API KEY
          </button>
          <div className="flex flex-col space-y-2">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-gray-500 hover:text-blue-400 underline tracking-widest uppercase transition-colors"
            >
              Learn about billing
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

const AuthButton = ({ user, setUser }: { user: any, setUser: any }) => {
  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      // Initialize profile if not exists
      const userDoc = doc(db, 'users', result.user.uid);
      const snapshot = await getDoc(userDoc);
      if (!snapshot.exists()) {
        await setDoc(userDoc, {
          displayName: result.user.displayName,
          favorites: []
        });
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = () => signOut(auth);

  if (user) {
    return (
      <div className="flex items-center space-x-4">
        <div className="flex flex-col items-end hidden sm:flex">
          <span className="text-[10px] font-bold text-white leading-none">WELCOME</span>
          <span className="text-[9px] font-mono text-blue-400/60 uppercase mt-1">{user.displayName?.split(' ')[0]}</span>
        </div>
        <button 
          onClick={logout} 
          className="glass hover:bg-red-500/20 hover:text-red-400 px-5 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all duration-300 border border-white/5"
        >
          LOGOUT
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={login} 
      className="group relative glass hover:bg-blue-500/10 px-6 py-2 rounded-full text-[10px] font-bold tracking-widest flex items-center space-x-2 transition-all duration-500 border border-white/5"
    >
      <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <Sparkles size={14} className="text-blue-400 group-hover:rotate-12 transition-transform" />
      <span className="relative z-10">CONNECT</span>
    </button>
  );
};

const Stars = () => {
  const [stars, setStars] = useState<{ id: number, top: string, left: string, size: string, duration: string, color: string }[]>([]);

  useEffect(() => {
    const newStars = Array.from({ length: 150 }).map((_, i) => {
      const colors = ['#ffffff', '#ffffff', '#ffffff', '#60a5fa', '#a78bfa'];
      return {
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: `${Math.random() * 2 + 1}px`,
        duration: `${2 + Math.random() * 4}s`,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });
    setStars(newStars);
  }, []);

  return (
    <div className="stars-container">
      {stars.map(star => (
        <div
          key={star.id}
          className="star"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            background: star.color,
            boxShadow: star.color !== '#ffffff' ? `0 0 10px ${star.color}` : 'none',
            '--duration': star.duration
          } as any}
        />
      ))}
    </div>
  );
};

const Logo = () => (
  <Link to="/" className="flex items-center space-x-4 group relative">
    <div className="relative">
      <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-1000" />
      <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center border border-white/10 group-hover:border-blue-500/50 transition-all duration-700 group-hover:rotate-[360deg]">
        <Sparkles size={22} className="text-blue-400 group-hover:text-white transition-colors" />
      </div>
    </div>
    <div className="flex flex-col">
      <span className="font-display text-2xl font-bold tracking-tighter uppercase leading-none group-hover:text-blue-400 transition-colors">STAR<span className="text-blue-500">GAZE</span></span>
      <span className="text-[8px] font-mono tracking-[0.5em] text-gray-600 uppercase leading-none mt-2">Cosmic Portal</span>
    </div>
  </Link>
);

const Navbar = ({ user, setUser }: { user: any, setUser: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/', icon: Sparkles },
    { name: 'Daily', path: '/#daily', icon: Sun },
    { name: 'Sky', path: '/sky', icon: Star },
    { name: 'Moon', path: '/moon', icon: MoonIcon },
    { name: 'Explorer', path: '/explorer', icon: Rocket },
    { name: 'Events', path: '/events', icon: Calendar },
    { name: 'Forum', path: '/forum', icon: Menu },
    { name: 'Journal', path: '/journal', icon: BookOpen },
    { name: 'About', path: '/about', icon: Info },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (path.startsWith('/#')) {
      e.preventDefault();
      const id = path.split('#')[1];
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-700 ${
      scrolled ? 'py-4' : 'py-10'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`glass-nav rounded-[2rem] px-8 transition-all duration-700 ${
          scrolled ? 'py-3 shadow-2xl shadow-black/50 border-white/10' : 'py-5 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <Logo />

            {/* Desktop Menu */}
            <div className="hidden lg:block">
              <div className="flex items-center space-x-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={(e) => handleNavClick(e, link.path)}
                    className={`px-4 py-2 rounded-full text-[9px] font-bold tracking-[0.25em] uppercase transition-all duration-500 relative group/link ${
                      location.pathname === link.path
                        ? 'text-white'
                        : 'text-gray-500 hover:text-blue-400'
                    }`}
                  >
                    <span className="relative z-10">{link.name}</span>
                    {location.pathname === link.path && (
                      <motion.div 
                        layoutId="nav-active"
                        className="absolute inset-0 bg-blue-500/10 rounded-full border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                ))}
                <div className="ml-6 border-l border-white/10 pl-6">
                  <AuthButton user={user} setUser={setUser} />
                </div>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center space-x-4">
              <AuthButton user={user} setUser={setUser} />
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none transition-colors"
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="lg:hidden px-4 mt-4"
          >
            <div className="glass-card rounded-[2rem] p-4 overflow-hidden">
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={(e) => {
                      handleNavClick(e, link.path);
                      setIsOpen(false);
                    }}
                    className={`flex items-center space-x-4 px-4 py-4 rounded-2xl text-sm font-bold tracking-widest uppercase transition-all ${
                      location.pathname === link.path
                        ? 'text-white bg-white/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <link.icon size={18} className="text-blue-400" />
                    <span>{link.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Footer = () => (
  <footer className="glass border-t border-white/5 py-32 mt-40 relative overflow-hidden">
    <div className="absolute inset-0 z-0 opacity-10">
      <div className="nebula top-0 left-1/2 -translate-x-1/2 w-full h-full blur-[150px]" />
    </div>
    
    <div className="max-w-7xl mx-auto px-4 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
        <div className="col-span-1 md:col-span-2">
          <Logo />
          <p className="text-gray-500 text-lg mt-8 max-w-md leading-relaxed font-light">
            Where clarity meets the cosmos. We bring the wonders of the universe to your screen through data, community, and AI-powered reimagination.
          </p>
        </div>
        <div>
          <h4 className="section-label mb-8 block">Navigation</h4>
          <div className="grid grid-cols-1 gap-4">
            {['Home', 'Daily', 'Sky', 'Moon', 'Explorer', 'Events'].map((item) => (
              <Link 
                key={item}
                to={item === 'Home' ? '/' : item === 'Daily' ? '/#daily' : `/${item.toLowerCase()}`} 
                className="text-[10px] font-bold tracking-[0.3em] text-gray-500 hover:text-blue-400 transition-colors uppercase"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="section-label mb-8 block">Community</h4>
          <div className="grid grid-cols-1 gap-4">
            {['Forum', 'Journal', 'About', 'Tips'].map((item) => (
              <Link 
                key={item}
                to={`/${item.toLowerCase()}`} 
                className="text-[10px] font-bold tracking-[0.3em] text-gray-500 hover:text-blue-400 transition-colors uppercase"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
        <p className="text-gray-600 text-[9px] tracking-[0.5em] uppercase font-mono">© 2026 STARGAZE.IO • THE INFINITE PORTAL</p>
        <div className="flex space-x-8">
          <a href="#" className="text-gray-600 hover:text-white transition-all hover:scale-110"><Twitter size={18} /></a>
          <a href="#" className="text-gray-600 hover:text-white transition-all hover:scale-110"><Github size={18} /></a>
        </div>
      </div>
    </div>
  </footer>
);

// --- Pages ---

const Home = () => {
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
  const [apod, setApod] = useState<any>(null);
  const [reimagine, setReimagine] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      const q = query(collection(db, 'events'), orderBy('date', 'asc'), limit(3));
      const snapshot = await getDocs(q);
      setFeaturedEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const fetchApod = async () => {
      try {
        const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        if (!res.ok) {
          // If limit reached, we don't want to throw an error that bubbles up as a "failed" fetch in a scary way
          // instead we handle it gracefully with a fallback.
          const fallbackData = {
            title: "The Pillars of Creation",
            explanation: "While our connection to NASA's daily feed is currently limited, we invite you to marvel at this iconic view of the Pillars of Creation. These towering tendrils of cosmic gas and dust are part of the Eagle Nebula, a star-forming region 6,500 light-years away. Even when the data stream pauses, the universe's beauty remains constant.",
            url: "https://images-assets.nasa.gov/image/PIA23645/PIA23645~orig.jpg",
            copyright: "NASA/ESA/Hubble",
            isFallback: true
          };
          setApod(fallbackData);
          return;
        }
        const data = await res.json();
        setApod(data);
      } catch (e) {
        // Log as info/warning instead of error if it's a known limitation
        console.warn("NASA APOD fetch encountered a limitation, using celestial fallback.");
        setApod({
          title: "The Infinite Cosmos",
          explanation: "The universe is a vast and mysterious place, filled with wonders beyond our imagination. While we couldn't reach NASA's servers right now, we can still marvel at the beauty of the stars through our AI-generated interpretations.",
          url: "https://picsum.photos/seed/nebula/1920/1080?blur=2",
          copyright: "Stargaze Archive",
          isFallback: true
        });
      }
    };

    fetchEvents();
    fetchApod();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-24"
    >
      {/* Hero Section - Recipe 2: Editorial */}
      <section className="relative min-h-screen flex items-center justify-center px-4 text-center overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="nebula top-0 left-0 scale-150 blur-[100px]" />
          <div className="nebula bottom-0 right-0 scale-150 blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)' }} />
        </div>
        
        <div className="max-w-7xl mx-auto z-10 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <span className="section-label px-8 py-3 rounded-full glass border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
              EST. 2026 • THE INFINITE PORTAL
            </span>
          </motion.div>
          
          <h1 className="hero-title animate-slam text-glow mb-12">
            STAR<span className="text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-indigo-600">GAZE</span>
          </h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xl md:text-3xl text-gray-400 mb-16 max-w-3xl mx-auto font-light leading-tight tracking-tight"
          >
            Where clarity meets the cosmos. Real-time telemetry, 3D exploration, and AI-guided discovery.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-8"
          >
            <Link to="/sky" className="group relative bg-white text-black px-12 py-5 rounded-2xl text-[11px] font-bold tracking-[0.3em] uppercase overflow-hidden transition-all duration-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              <span className="relative z-10">LAUNCH SKY MAP</span>
              <div className="absolute inset-0 bg-blue-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            </Link>
            <Link to="/events" className="glass px-12 py-5 rounded-2xl text-[11px] font-bold tracking-[0.3em] uppercase hover:bg-white/5 transition-all duration-500 border border-white/10 hover:border-white/20">
              VIEW CALENDAR
            </Link>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-6"
        >
          <span className="text-[9px] font-bold tracking-[0.6em] text-gray-600 uppercase">SCROLL TO EXPLORE</span>
          <div className="w-[1px] h-20 bg-gradient-to-b from-blue-500/50 to-transparent" />
        </motion.div>
      </section>

      {/* Featured Events - Recipe 1: Technical Grid */}
      <section className="max-w-7xl mx-auto px-4 py-40">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
          <div>
            <span className="section-label mb-4 block">01 / DISCOVER</span>
            <h2 className="font-display text-5xl md:text-7xl font-bold tracking-tight uppercase">Upcoming <span className="text-blue-500">Highlights</span></h2>
          </div>
          <Link to="/events" className="text-[10px] font-bold tracking-[0.4em] text-gray-500 hover:text-white transition-all flex items-center space-x-4 group border-b border-white/10 pb-2">
            <span>VIEW ALL EVENTS</span>
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-500" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {featuredEvents.length > 0 ? featuredEvents.map((event, idx) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              className="glass-card rounded-[3rem] overflow-hidden flex flex-col group border border-white/5 hover:border-blue-500/30"
            >
              <div className="h-80 bg-gray-900 relative overflow-hidden">
                <GeneratedImage 
                  prompt={`${event.title} - ${event.description}`}
                  alt={event.title}
                  aspectRatio="16:9"
                  className="w-full h-full object-cover opacity-40 group-hover:scale-110 group-hover:opacity-60 transition-all duration-[2s]"
                />
                <div className="absolute top-8 left-8 glass px-6 py-2 rounded-full text-[9px] font-bold tracking-[0.3em] uppercase border border-white/10">
                  {event.type}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-transparent opacity-80" />
              </div>
              <div className="p-12 flex-grow relative">
                <div className="absolute top-0 right-12 -translate-y-1/2 w-14 h-14 rounded-2xl glass flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all duration-700 shadow-2xl">
                  <Calendar size={24} />
                </div>
                <p className="text-blue-400 font-mono text-[10px] tracking-[0.3em] mb-6 uppercase">{new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <h3 className="font-display text-3xl mb-8 group-hover:text-blue-400 transition-colors leading-tight font-bold">{event.title}</h3>
                <p className="text-gray-400 text-base leading-relaxed line-clamp-3 font-light opacity-80">{event.description}</p>
              </div>
              <div className="px-12 pb-12">
                <Link to="/events" className="w-full glass py-5 rounded-[1.5rem] text-[10px] font-bold tracking-[0.4em] flex items-center justify-center space-x-4 group/btn hover:bg-blue-600 hover:text-white transition-all duration-700 border border-white/10">
                  <span>EXPLORE EVENT</span>
                  <ArrowRight size={16} className="group-hover/btn:translate-x-2 transition-transform duration-500" />
                </Link>
              </div>
            </motion.div>
          )) : (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card h-[32rem] rounded-[3rem] animate-pulse" />
            ))
          )}
        </div>
      </section>

      {/* APOD Section - Recipe 7: Atmospheric */}
      <section id="daily" className="max-w-7xl mx-auto px-4 py-40">
        <div className="glass-card rounded-[4rem] overflow-hidden relative border border-white/5">
          <div className="absolute inset-0 z-0 opacity-20">
            <div className="nebula top-0 left-0 blur-[120px]" />
            <div className="nebula bottom-0 right-0 blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%)' }} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 relative z-10">
            <div className="p-12 md:p-24 flex flex-col justify-center">
              <span className="section-label mb-6 block text-pink-500">02 / DAILY WONDER</span>
              <h2 className="hero-title text-glow mb-12 text-5xl md:text-8xl">NASA <span className="text-pink-500">POTD</span></h2>
              {apod ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1 }}
                >
                  <h3 className="text-3xl font-bold mb-8 text-blue-400 tracking-tight">{apod.title}</h3>
                  <p className="text-gray-400 text-xl leading-relaxed mb-12 font-light opacity-90">
                    {apod.explanation}
                  </p>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center space-x-6">
                      <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center border border-white/10 shadow-xl">
                        <Star size={24} className="text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-1">Copyright</p>
                        <p className="text-base font-bold text-white">{apod.copyright || 'NASA Public Domain'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setReimagine(!reimagine)}
                      className={`px-8 py-4 rounded-2xl text-[10px] font-bold tracking-[0.3em] uppercase transition-all duration-700 flex items-center space-x-3 border ${
                        reimagine ? 'bg-blue-600 text-white border-blue-500 shadow-2xl shadow-blue-600/20' : 'glass text-blue-400 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <Sparkles size={16} />
                      <span>{reimagine ? 'SHOW ORIGINAL' : 'AI REIMAGINE'}</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <div className="h-10 bg-white/5 rounded-full w-3/4 animate-pulse" />
                  <div className="h-48 bg-white/5 rounded-[2rem] w-full animate-pulse" />
                </div>
              )}
            </div>
            <div className="relative min-h-[500px] lg:min-h-full overflow-hidden group">
              {apod && (
                reimagine || apod.isFallback ? (
                  <GeneratedImage 
                    prompt={apod.title + " " + apod.explanation.substring(0, 100)}
                    alt={apod.title}
                    aspectRatio="16:9"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110"
                  />
                ) : (
                  <img 
                    src={apod.url} 
                    alt={apod.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                )
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-transparent lg:bg-gradient-to-l lg:from-[#020205] lg:via-transparent lg:to-transparent opacity-60" />
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

const Events = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
  const [user, setUser] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      const q = query(collection(db, 'events'), orderBy('date', 'asc'));
      const snapshot = await getDocs(q);
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchEvents();

    let unsubSnapshot: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        unsubSnapshot = onSnapshot(doc(db, 'users', u.uid), (doc) => {
          if (doc.exists()) setFavorites(doc.data().favorites || []);
        });
      } else {
        setFavorites([]);
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = undefined;
        }
      }
    });
    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const toggleFavorite = async (eventId: string) => {
    if (!user) return alert("Please login to save favorites!");
    const userRef = doc(db, 'users', user.uid);
    const isFav = favorites.includes(eventId);
    await updateDoc(userRef, {
      favorites: isFav ? arrayRemove(eventId) : arrayUnion(eventId)
    });
  };

  const filteredEvents = events.filter(e => {
    const matchesType = filter === 'All' || e.type === filter;
    const matchesVisibility = visibilityFilter === 'All' || e.visibility === visibilityFilter;
    return matchesType && matchesVisibility;
  });

  const types = ['All', 'Meteor Shower', 'Eclipse', 'Moon Phase', 'Planetary Conjunction'];
  const visibilities = ['All', 'Excellent', 'High', 'Moderate', 'Low', 'N/A'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="pt-32 max-w-7xl mx-auto px-4"
    >
      <div className="text-center mb-20">
        <span className="text-blue-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-4 block">Celestial Calendar</span>
        <h1 className="font-display text-5xl md:text-8xl font-bold mb-6 tracking-tighter text-glow uppercase">2026 <span className="text-blue-500">EVENTS</span></h1>
        <p className="text-gray-400 max-w-2xl mx-auto font-light text-xl">Plan your nights under the stars with our curated list of cosmic phenomena.</p>
      </div>

      {/* Filters */}
      <div className="space-y-6 mb-16">
        <div className="flex flex-col items-center space-y-4">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Filter by Type</span>
          <div className="flex flex-wrap justify-center gap-3">
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${
                  filter === t 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'glass hover:bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Filter by Visibility</span>
          <div className="flex flex-wrap justify-center gap-3">
            {visibilities.map(v => (
              <button
                key={v}
                onClick={() => setVisibilityFilter(v)}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${
                  visibilityFilter === v 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : 'glass hover:bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-20">
        {filteredEvents.length > 0 ? filteredEvents.map((event, idx) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-card rounded-[2rem] overflow-hidden group"
          >
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-3 p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center bg-white/[0.02]">
                <p className="text-blue-400 font-mono text-xs mb-1 uppercase tracking-widest">
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                </p>
                <p className="text-4xl font-display font-bold mb-1">
                  {new Date(event.date).toLocaleDateString('en-US', { day: '2-digit' })}
                </p>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest">
                  {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <button 
                  onClick={() => toggleFavorite(event.id)}
                  className={`mt-6 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all ${
                    favorites.includes(event.id) 
                      ? 'bg-pink-500/20 text-pink-500 border border-pink-500/30' 
                      : 'glass hover:bg-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <Star size={14} fill={favorites.includes(event.id) ? "currentColor" : "none"} />
                  <span>{favorites.includes(event.id) ? 'SAVED' : 'SAVE'}</span>
                </button>
              </div>
              
              <div className="md:col-span-6 p-8 flex flex-col justify-center">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="glass px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase text-blue-400">
                    {event.type}
                  </span>
                </div>
                <h3 className="font-display text-2xl mb-3 group-hover:text-blue-400 transition-colors">{event.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 font-light">{event.description}</p>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Location</p>
                    <p className="text-xs text-gray-300 font-medium">{event.location}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Visibility</p>
                    <p className="text-xs text-gray-300 font-medium">{event.visibility}</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 p-8 bg-white/[0.01] flex flex-col justify-center">
                <div className="aspect-video glass rounded-2xl overflow-hidden relative group/img mb-4">
                   <GeneratedImage 
                    prompt={`${event.title} ${event.type}`}
                    alt={event.title}
                    aspectRatio="16:9"
                    className="w-full h-full object-cover opacity-20 group-hover/img:opacity-40 transition-opacity duration-500"
                   />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <MapIcon size={24} className="text-white/20 group-hover/img:text-blue-400/50 transition-colors" />
                   </div>
                </div>
                <button 
                  onClick={() => setSelectedEvent(event)}
                  className="w-full glass py-3 rounded-xl text-[10px] font-bold tracking-widest uppercase hover:bg-white/5 transition-all"
                >
                  View Details
                </button>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="py-20 text-center glass-card rounded-[3rem]">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mx-auto mb-6 text-gray-500">
              <Calendar size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">No events found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your filters to find more celestial wonders.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <EventDetailsModal 
            event={selectedEvent} 
            onClose={() => setSelectedEvent(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Explorer = () => {
  const [activeTab, setActiveTab] = useState<'mars' | 'neo' | 'spacex' | 'weather'>('mars');

  const tabs = [
    { id: 'mars', name: 'Mars Rover', icon: Globe },
    { id: 'neo', name: 'Asteroid Watch', icon: AlertTriangle },
    { id: 'spacex', name: 'SpaceX Launches', icon: Rocket },
    { id: 'weather', name: 'Space Weather', icon: Zap },
  ] as const;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-48 max-w-7xl mx-auto px-4 pb-48"
    >
      <div className="text-center mb-24">
        <span className="section-label mb-6 block">DEEP SPACE EXPLORER</span>
        <h1 className="hero-title text-glow mb-8">COSMIC <span className="text-blue-500">DATA</span></h1>
        <p className="text-gray-400 max-w-3xl mx-auto font-light text-2xl leading-relaxed">Real-time telemetry and imagery from across the solar system.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap justify-center gap-6 mb-24">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-10 py-5 rounded-[1.5rem] text-[10px] font-bold tracking-[0.3em] uppercase transition-all duration-700 flex items-center space-x-4 border ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.2)]' 
                : 'glass border-white/5 text-gray-500 hover:text-white hover:border-white/20'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {activeTab === 'mars' && <MarsRoverGallery />}
          {activeTab === 'neo' && <NeoTracker />}
          {activeTab === 'spacex' && <SpaceXLaunches />}
          {activeTab === 'weather' && <SpaceWeather />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

const MarsRoverGallery = () => {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMars = async () => {
      try {
        const res = await fetch('https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/photos?sol=1000&api_key=DEMO_KEY');
        const data = await res.json();
        setPhotos((data.photos || []).slice(0, 12));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchMars();
  }, []);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-8">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card h-80 rounded-[2rem] animate-pulse" />)}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {photos.map((photo) => (
        <motion.div 
          key={photo.id}
          whileHover={{ y: -10 }}
          className="glass-card rounded-[2.5rem] overflow-hidden group border border-white/5"
        >
          <div className="h-64 overflow-hidden relative">
            <img 
              src={photo.img_src} 
              alt={`Mars by ${photo.rover.name}`} 
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-4 right-4 glass px-4 py-1.5 rounded-full text-[8px] font-bold tracking-widest uppercase">
              {photo.camera.full_name}
            </div>
          </div>
          <div className="p-8">
            <span className="text-blue-400 font-mono text-[10px] tracking-widest uppercase mb-2 block">{photo.rover.name} Rover</span>
            <h3 className="text-xl font-bold mb-2">Sol {photo.sol}</h3>
            <p className="text-gray-500 text-xs uppercase tracking-widest">{photo.earth_date}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const NeoTracker = () => {
  const [neos, setNeos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNeo = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=DEMO_KEY`);
        const data = await res.json();
        const dailyNeos = (data.near_earth_objects || {})[today] || [];
        setNeos(dailyNeos);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchNeo();
  }, []);

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-24 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold uppercase tracking-tight">Potentially Hazardous Objects</h3>
            <p className="text-gray-500 text-sm">Monitoring asteroids in close proximity to Earth's orbit.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {neos.map((neo) => (
          <div key={neo.id} className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center space-x-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${neo.is_potentially_hazardous_asteroid ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                <Star size={20} fill="currentColor" />
              </div>
              <div>
                <h4 className="text-lg font-bold group-hover:text-blue-400 transition-colors">{neo.name}</h4>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest">ID: {neo.id}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-grow max-w-2xl">
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Diameter (Max)</p>
                <p className="text-sm font-mono">{neo.estimated_diameter.kilometers.estimated_diameter_max.toFixed(2)} KM</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Velocity</p>
                <p className="text-sm font-mono">{parseFloat(neo.close_approach_data[0].relative_velocity.kilometers_per_hour).toLocaleString()} KM/H</p>
              </div>
              <div className="hidden md:block">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Miss Distance</p>
                <p className="text-sm font-mono">{parseFloat(neo.close_approach_data[0].miss_distance.kilometers).toLocaleString()} KM</p>
              </div>
            </div>

            <div className={`px-4 py-2 rounded-xl text-[8px] font-bold tracking-widest uppercase border ${
              neo.is_potentially_hazardous_asteroid ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              {neo.is_potentially_hazardous_asteroid ? 'Hazardous' : 'Safe'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SpaceXLaunches = () => {
  const [launches, setLaunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpaceX = async () => {
      try {
        const res = await fetch('https://api.spacexdata.com/v4/launches/upcoming');
        const data = await res.json();
        setLaunches(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchSpaceX();
  }, []);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-64 rounded-[2.5rem] animate-pulse" />)}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {launches.map((launch) => (
        <div key={launch.id} className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Rocket size={120} />
          </div>
          
          <div className="relative z-10">
            <span className="text-blue-400 font-mono text-[10px] tracking-[0.3em] uppercase mb-4 block">Flight #{launch.flight_number}</span>
            <h3 className="text-3xl font-bold mb-6 group-hover:text-blue-400 transition-colors">{launch.name}</h3>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-center space-x-4">
                <Calendar size={16} className="text-gray-500" />
                <p className="text-sm text-gray-300">{new Date(launch.date_utc).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
              </div>
              <div className="flex items-center space-x-4">
                <MapIcon size={16} className="text-gray-500" />
                <p className="text-sm text-gray-300">Launchpad ID: {launch.launchpad}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="glass px-4 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase border border-white/5">
                Upcoming
              </div>
              <a 
                href={launch.links.reddit.campaign || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="glass px-4 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase border border-white/5 hover:bg-white/10 transition-colors flex items-center space-x-2"
              >
                <span>Reddit Thread</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SpaceWeather = () => {
  const [flares, setFlares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const start = monthAgo.toISOString().split('T')[0];
        
        const res = await fetch(`https://api.nasa.gov/DONKI/FLR?startDate=${start}&endDate=${today}&api_key=DEMO_KEY`);
        const data = await res.json();
        setFlares(Array.isArray(data) ? data.reverse().slice(0, 10) : []);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchWeather();
  }, []);

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card h-20 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 text-center">
          <Zap size={32} className="mx-auto mb-4 text-yellow-400" />
          <h4 className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-2">Solar Activity</h4>
          <p className="text-2xl font-bold">{flares.length > 0 ? 'Active' : 'Quiet'}</p>
        </div>
        <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 text-center">
          <Activity size={32} className="mx-auto mb-4 text-blue-400" />
          <h4 className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-2">Recent Flares</h4>
          <p className="text-2xl font-bold">{flares.length}</p>
        </div>
        <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 text-center">
          <Info size={32} className="mx-auto mb-4 text-purple-400" />
          <h4 className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-2">Alert Status</h4>
          <p className="text-2xl font-bold">Normal</p>
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/5">
        <div className="p-8 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-xl font-bold uppercase tracking-tight">Solar Flare Log</h3>
          <p className="text-gray-500 text-xs">Recent electromagnetic events detected by NASA DONKI.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold tracking-widest uppercase text-gray-500">
                <th className="p-8">Event ID</th>
                <th className="p-8">Start Time</th>
                <th className="p-8">Peak Time</th>
                <th className="p-8">Class</th>
                <th className="p-8">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {flares.map((flare) => (
                <tr key={flare.flrID} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-8 font-mono text-xs text-blue-400">{flare.flrID}</td>
                  <td className="p-8 text-sm text-gray-300">{new Date(flare.beginTime).toLocaleString()}</td>
                  <td className="p-8 text-sm text-gray-300">{new Date(flare.peakTime).toLocaleString()}</td>
                  <td className="p-8">
                    <span className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-500 text-[10px] font-bold tracking-widest uppercase border border-yellow-500/20">
                      {flare.classType}
                    </span>
                  </td>
                  <td className="p-8 text-sm text-gray-500">{flare.sourceLocation || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Tips = () => {
  const guides = [
    {
      id: '01',
      title: 'Best Binoculars for Beginners',
      icon: Star,
      description: 'The first step into the cosmos doesn\'t require a telescope. A good pair of binoculars can reveal the craters of the Moon and the moons of Jupiter.',
      content: [
        'Look for 7x50 or 10x50 models for a good balance of magnification and light gathering.',
        'Porro prism binoculars often offer better depth perception for stargazing.',
        'Check for multi-coated lenses to reduce reflections and improve clarity.',
        'Consider a tripod adapter for steady viewing during long sessions.'
      ]
    },
    {
      id: '02',
      title: 'Finding Dark Sky Locations',
      icon: MoonIcon,
      description: 'Light pollution is the enemy of the astronomer. Learn how to find the darkest corners of the world for the clearest views.',
      content: [
        'Use light pollution maps (like DarkSiteFinder) to locate Bortle 1-3 zones.',
        'National parks and remote coastal areas are often the best bets.',
        'Higher altitudes usually mean thinner, clearer air.',
        'Wait for a New Moon phase for the absolute darkest conditions.'
      ]
    },
    {
      id: '03',
      title: 'Photographing Meteor Showers',
      icon: Sun,
      description: 'Capture the fleeting beauty of a falling star. Astrophotography is an art that requires patience and the right technique.',
      content: [
        'Use a sturdy tripod and a wide-angle lens (14mm to 24mm).',
        'Set your camera to Manual mode with a wide aperture (f/2.8 or lower).',
        'Use a high ISO (1600-3200) and long exposures (15-30 seconds).',
        'Use an intervalometer to take continuous shots throughout the night.'
      ]
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-32 pb-20"
    >
      <div className="max-w-7xl mx-auto px-4 mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <span className="text-blue-500 font-mono text-[10px] tracking-[0.5em] uppercase mb-6 block">Masterclass</span>
            <h1 className="font-display text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] mb-8">Hobbyist<br />Guides</h1>
            <p className="text-gray-400 text-xl font-light leading-relaxed max-w-md">
              Expert techniques for the modern astronomer. From equipment selection to deep-sky photography.
            </p>
          </div>
          <div className="relative aspect-square">
            <div className="absolute inset-0 atmosphere opacity-30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border border-white/10 rounded-full animate-spin-slow flex items-center justify-center">
                <div className="w-48 h-48 border border-white/20 rounded-full flex items-center justify-center">
                  <Star size={48} className="text-blue-500 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 space-y-32">
        {guides.map((guide, idx) => (
          <motion.section
            key={guide.title}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
          >
            <div className="lg:col-span-1">
              <span className="font-display text-7xl md:text-8xl font-bold text-white/10 leading-none">{guide.id}</span>
            </div>
            
            <div className="lg:col-span-5">
              <div className="glass px-4 py-1.5 rounded-full inline-flex items-center space-x-2 mb-8">
                <guide.icon size={14} className="text-blue-400" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Essential Guide</span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-8 tracking-tight leading-tight">{guide.title}</h2>
              <p className="text-gray-400 text-lg font-light leading-relaxed mb-12">{guide.description}</p>
              
              <div className="relative aspect-video rounded-[2rem] overflow-hidden glass-card">
                <img 
                  src={`https://picsum.photos/seed/${guide.title}/800/450`} 
                  alt={guide.title}
                  className="w-full h-full object-cover opacity-40 grayscale hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="lg:col-span-6 lg:pt-20">
              <div className="glass-card rounded-[3rem] p-10 md:p-16">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-10 block">Key Takeaways</h3>
                <ul className="space-y-10">
                  {guide.content.map((item, i) => (
                    <li key={i} className="flex items-start space-x-8 group">
                      <span className="font-mono text-blue-500 text-xs mt-1">0{i + 1}</span>
                      <p className="text-gray-300 text-lg leading-relaxed font-light group-hover:text-white transition-colors">{item}</p>
                    </li>
                  ))}
                </ul>
                <button className="mt-16 w-full glass py-5 rounded-2xl text-[10px] font-bold tracking-[0.3em] uppercase hover:bg-white/5 transition-all">
                  Download PDF Guide
                </button>
              </div>
            </div>
          </motion.section>
        ))}
      </div>
    </motion.div>
  );
};

const Sky = () => {
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [iss, setIss] = useState<any>(null);
  const [manualLocation, setManualLocation] = useState(false);
  const [tempCoords, setTempCoords] = useState({ lat: 51.5074, lng: -0.1278 }); // Default London

  useEffect(() => {
    const getInitialLocation = () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setCoords({ lat: latitude, lng: longitude });
            fetchWeather(latitude, longitude);
          },
          (err) => {
            console.warn("Geolocation failed or denied:", err.message);
            const defaultCoords = { lat: 51.5074, lng: -0.1278 };
            setCoords(defaultCoords);
            fetchWeather(defaultCoords.lat, defaultCoords.lng);
          },
          { timeout: 10000 }
        );
      } else {
        const defaultCoords = { lat: 51.5074, lng: -0.1278 };
        setCoords(defaultCoords);
        fetchWeather(defaultCoords.lat, defaultCoords.lng);
      }
    };

    getInitialLocation();

    const fetchIss = async () => {
      try {
        const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        const data = await res.json();
        setIss(data);
      } catch (e) { console.error("ISS Fetch Error:", e); }
    };

    fetchIss();
    const interval = setInterval(fetchIss, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=cloudcover,relativehumidity_2m,surface_pressure&forecast_days=1`);
      const data = await res.json();
      setWeather(data.hourly);
    } catch (e) { console.error("Weather Fetch Error:", e); }
  };

  const handleManualUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setCoords(tempCoords);
    fetchWeather(tempCoords.lat, tempCoords.lng);
    setManualLocation(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-48 min-h-screen flex flex-col pb-24 relative"
    >
      {/* Immersive Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[160px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[140px] translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto px-4 w-full mb-20 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div className="max-w-2xl">
            <motion.span 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="section-label mb-6 block"
            >
              TELEMETRY DASHBOARD
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="hero-title text-glow mb-6"
            >
              CELESTIAL <span className="text-blue-500">HUB</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 font-light text-xl leading-relaxed"
            >
              Real-time sky mapping and atmospheric data for your exact coordinates.
            </motion.p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="glass px-6 py-3 rounded-2xl flex items-center space-x-4 border border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-500">System Live</span>
            </div>
            <div className="glass px-6 py-3 rounded-2xl flex items-center space-x-6 border border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">LAT: {coords?.lat.toFixed(4) || '0.0000'}</span>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">LNG: {coords?.lng.toFixed(4) || '0.0000'}</span>
              </div>
              <button 
                onClick={() => setManualLocation(!manualLocation)}
                className="glass px-4 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase hover:bg-white/10 transition-all border border-white/10 text-blue-400"
              >
                {manualLocation ? 'CLOSE' : 'OVERRIDE'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {manualLocation && (
        <div className="max-w-7xl mx-auto px-4 w-full mb-12 relative z-10">
          <motion.form 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onSubmit={handleManualUpdate}
            className="glass p-10 rounded-[2.5rem] flex flex-wrap items-end gap-8 border border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.1)]"
          >
            <div className="flex-1 min-w-[240px]">
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-3 block font-mono">Latitude Override</label>
              <input 
                type="number" 
                step="0.0001"
                value={tempCoords.lat}
                onChange={e => setTempCoords({...tempCoords, lat: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 font-mono text-sm transition-all"
              />
            </div>
            <div className="flex-1 min-w-[240px]">
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-3 block font-mono">Longitude Override</label>
              <input 
                type="number" 
                step="0.0001"
                value={tempCoords.lng}
                onChange={e => setTempCoords({...tempCoords, lng: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 font-mono text-sm transition-all"
              />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-all shadow-lg shadow-blue-600/20 h-[58px]">
              Update Coordinates
            </button>
          </motion.form>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 w-full grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
        {/* Sky Map - Main Instrument */}
        <div className="lg:col-span-8">
          <div className="glass-card rounded-[3rem] overflow-hidden h-[700px] relative border border-white/5 shadow-2xl group">
            <div className="absolute top-8 left-8 z-10 flex items-center space-x-4">
              <div className="glass px-5 py-2.5 rounded-full flex items-center space-x-3 backdrop-blur-2xl border border-white/10">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Stellarium Core v1.4</span>
              </div>
            </div>
            {coords ? (
              <iframe 
                src={`https://stellarium-web.org/skymap?lat=${coords.lat}&lng=${coords.lng}`}
                className="w-full h-full border-none grayscale-[0.1] contrast-[1.05] brightness-[0.9]"
                title="Sky Map"
                allow="geolocation"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020205]">
                <div className="w-20 h-20 border-2 border-blue-500/10 border-t-blue-500 rounded-full animate-spin mb-8" />
                <p className="text-gray-500 font-mono text-[10px] tracking-[0.5em] uppercase animate-pulse">Aligning with the stars...</p>
              </div>
            )}
            <div className="absolute bottom-8 right-8 z-10">
              <button className="glass px-8 py-4 rounded-2xl text-[10px] font-bold tracking-widest uppercase hover:bg-white/10 transition-all border border-white/10">
                Full Screen Mode
              </button>
            </div>
            {/* Decorative Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[24px] border-black/20 rounded-[3rem]" />
          </div>
        </div>

        {/* Sidebar - Hardware Widgets */}
        <div className="lg:col-span-4 space-y-10">
          {/* Weather / Conditions Widget */}
          <div className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-700">
              <Cloud size={160} />
            </div>
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-blue-400 border border-white/10">
                  <Cloud size={24} />
                </div>
                <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase">Atmospherics</h3>
              </div>
              <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">REF: O-MEO</span>
            </div>
            
            {weather ? (
              <div className="space-y-10">
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">Cloud Density</span>
                    <span className="font-mono text-2xl text-blue-400">{weather.cloudcover[0]}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${weather.cloudcover[0]}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="glass p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
                    <Wind size={20} className="mb-4 text-purple-400" />
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-2">Pressure</p>
                    <p className="text-xl font-display font-bold">{weather.surface_pressure ? `${Math.round(weather.surface_pressure[0])} hPa` : 'N/A'}</p>
                  </div>
                  <div className="glass p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
                    <Activity size={20} className="mb-4 text-emerald-400" />
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-2">Humidity</p>
                    <p className="text-xl font-display font-bold">{weather.relativehumidity_2m ? `${weather.relativehumidity_2m[0]}%` : 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] animate-pulse">Scanning Atmosphere...</p>
              </div>
            )}
          </div>

          {/* ISS Tracker Widget */}
          <div className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-700">
              <Rocket size={160} />
            </div>
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-orange-400 border border-white/10">
                  <Rocket size={24} />
                </div>
                <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase">ISS Telemetry</h3>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span className="text-[9px] font-mono font-bold text-orange-500 tracking-widest">LIVE</span>
              </div>
            </div>

            {iss ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-2">Latitude</p>
                    <p className="font-mono text-sm text-white">{iss.latitude.toFixed(4)}°</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-2">Longitude</p>
                    <p className="font-mono text-sm text-white">{iss.longitude.toFixed(4)}°</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-2">Altitude</p>
                    <p className="font-mono text-sm text-white">{iss.altitude.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-2">Velocity</p>
                    <p className="font-mono text-sm text-orange-400">{(iss.velocity / 3600).toFixed(2)} km/s</p>
                  </div>
                </div>
                <div className="pt-6">
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-1/2 h-full bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] animate-pulse">Establishing Uplink...</p>
              </div>
            )}
          </div>

          {/* Dark Sky Finder */}
          <a 
            href="https://www.lightpollutionmap.info/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="glass-card p-10 rounded-[3rem] border border-white/5 flex items-center justify-between group hover:bg-white/[0.02] transition-all duration-500"
          >
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 rounded-[1.5rem] glass flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-500 border border-white/10">
                <MapIcon size={28} />
              </div>
              <div>
                <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase mb-1.5">Dark Sky Finder</h3>
                <p className="text-[10px] text-gray-600 font-light tracking-widest uppercase">Locate Bortle 1-3 zones</p>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full glass flex items-center justify-center text-gray-600 group-hover:text-white group-hover:bg-white/10 transition-all duration-500 border border-white/5">
              <ExternalLink size={18} />
            </div>
          </a>
        </div>
      </div>
    </motion.div>
  );
};

// --- Moon Phase Calculation ---
const getMoonPhase = (date: Date) => {
  const lp = 2551443; 
  const now = new Date(date);
  const newMoon = new Date(1970, 0, 7, 20, 35, 0);
  const phase = ((now.getTime() - newMoon.getTime()) / 1000) % lp;
  const age = Math.floor(phase / (24 * 3600)) + 1;
  
  if (age < 1.84566) return { name: 'New Moon', illumination: 0, icon: MoonIcon };
  if (age < 5.53699) return { name: 'Waxing Crescent', illumination: 25, icon: MoonIcon };
  if (age < 9.22831) return { name: 'First Quarter', illumination: 50, icon: MoonIcon };
  if (age < 12.91963) return { name: 'Waxing Gibbous', illumination: 75, icon: MoonIcon };
  if (age < 16.61096) return { name: 'Full Moon', illumination: 100, icon: MoonIcon };
  if (age < 20.30228) return { name: 'Waning Gibbous', illumination: 75, icon: MoonIcon };
  if (age < 23.99361) return { name: 'Last Quarter', illumination: 50, icon: MoonIcon };
  if (age < 27.68493) return { name: 'Waning Crescent', illumination: 25, icon: MoonIcon };
  return { name: 'New Moon', illumination: 0, icon: MoonIcon };
};

const MoonExplorer = () => {
  const [moonData, setMoonData] = useState(getMoonPhase(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setMoonData(getMoonPhase(new Date()));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const MoonModel = () => {
    const mesh = React.useRef<THREE.Mesh>(null!);
    const texture = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg');
    
    useFrame((state) => {
      mesh.current.rotation.y += 0.002;
    });

    return (
      <mesh ref={mesh}>
        <sphereGeometry args={[2.4, 128, 128]} />
        <meshStandardMaterial map={texture} roughness={1} metalness={0.1} />
      </mesh>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-screen flex flex-col relative overflow-hidden bg-[#020205]"
    >
      {/* Recipe 7: Atmospheric Background */}
      <div className="absolute inset-0 z-0 atmosphere opacity-80" />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-blue-900/5 to-black/40" />
      
      <div className="absolute inset-0 z-10">
        <Canvas camera={{ position: [0, 0, 7] }}>
          <ambientLight intensity={0.3} />
          <pointLight position={[15, 15, 15]} intensity={2.5} />
          <spotLight position={[-15, 15, 15]} angle={0.2} penumbra={1} intensity={2} />
          <React.Suspense fallback={null}>
            <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.4}>
              <MoonModel />
            </Float>
            <ThreeStars radius={120} depth={60} count={10000} factor={6} saturation={0} fade speed={1} />
          </React.Suspense>
          <OrbitControls enableZoom={true} autoRotate={false} minDistance={4} maxDistance={15} />
        </Canvas>
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-4 w-full h-full pointer-events-none flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="section-label mb-8 block">CELESTIAL BODY 01</span>
            <h1 className="hero-title text-glow mb-10 leading-[0.85] tracking-tighter">
              THE <br />
              <span className="text-blue-500">MOON</span>
            </h1>
            <p className="text-gray-400 text-2xl font-light mb-16 leading-relaxed max-w-xl">
              Explore our celestial neighbor in high-fidelity 3D. A silent witness to human history, waiting for our return.
            </p>
            
            {/* Recipe 7: Glass Morphism Widget */}
            <div className="glass-card p-10 rounded-[3rem] pointer-events-auto max-w-md backdrop-blur-3xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] group">
              <h3 className="text-[11px] font-bold tracking-[0.4em] uppercase mb-8 flex items-center space-x-4 text-blue-400">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
                <span>Current Phase Telemetry</span>
              </h3>
              <div className="flex items-center space-x-8">
                <div className="w-24 h-24 rounded-full glass flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <moonData.icon size={48} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                </div>
                <div>
                  <p className="text-4xl font-display font-bold text-white mb-2 uppercase tracking-tight">{moonData.name}</p>
                  <div className="flex flex-col space-y-1">
                    <p className="text-[10px] text-gray-500 font-mono tracking-[0.2em] uppercase">{moonData.illumination}% Illuminated</p>
                    <p className="text-[10px] text-gray-400 font-mono tracking-[0.2em] uppercase">Age: {Math.floor(Math.random() * 28)} Days</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right side stats or info could go here, or keep it clean */}
          <div className="hidden lg:flex flex-col items-end space-y-12">
            <div className="text-right">
              <p className="text-[10px] text-gray-600 uppercase tracking-[0.5em] mb-4">Distance from Earth</p>
              <p className="text-6xl font-display font-light tracking-tighter">384,400 <span className="text-2xl text-gray-600 uppercase">km</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-600 uppercase tracking-[0.5em] mb-4">Orbital Period</p>
              <p className="text-6xl font-display font-light tracking-tighter">27.3 <span className="text-2xl text-gray-600 uppercase">days</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe 7: Gradient Mask for UI edges */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
        <motion.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center space-y-6"
        >
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.5em]">Interact to Explore</span>
          <div className="w-px h-16 bg-gradient-to-b from-blue-500 to-transparent" />
        </motion.div>
      </div>

      <div className="absolute top-1/2 right-12 -translate-y-1/2 z-20 pointer-events-none hidden lg:block">
        <p className="text-[11px] text-gray-600 uppercase tracking-[0.6em] vertical-text font-bold">Drag to Rotate • Scroll to Zoom</p>
      </div>
    </motion.div>
  );
};

const Journal = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    location: '',
    bortle: 4,
    equipment: '',
    notes: ''
  });

  useEffect(() => {
    let unsubSnapshot: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const q = query(collection(db, 'observation_logs'), where('userId', '==', u.uid), orderBy('createdAt', 'desc'));
        unsubSnapshot = onSnapshot(q, (snapshot) => {
          setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      } else {
        setLogs([]);
        if (unsubSnapshot) {
          unsubSnapshot();
          unsubSnapshot = undefined;
        }
      }
    });
    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const saveLog = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'observation_logs'), {
        ...newLog,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewLog({ date: new Date().toISOString().split('T')[0], location: '', bortle: 4, equipment: '', notes: '' });
    } catch (e) { console.error(e); }
  };

  const deleteLog = async (id: string) => {
    if (window.confirm("Delete this memory?")) {
      await deleteDoc(doc(db, 'observation_logs', id));
    }
  };

  if (!user) {
    return (
      <div className="pt-64 max-w-7xl mx-auto px-4 text-center pb-64">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-20 rounded-[4rem] inline-block border border-white/5 shadow-2xl"
        >
          <div className="w-24 h-24 rounded-full glass flex items-center justify-center mx-auto mb-10 text-blue-500 border border-white/10">
            <BookOpen size={48} />
          </div>
          <h1 className="hero-title text-5xl mb-8">OBSERVATION <span className="text-blue-500">JOURNAL</span></h1>
          <p className="text-gray-400 mb-12 max-w-md mx-auto font-light text-xl leading-relaxed">Login to start recording your journey through the stars. Your logs are private and secure.</p>
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} 
            className="bg-white text-black px-12 py-5 rounded-full font-bold tracking-[0.2em] uppercase hover:bg-blue-500 hover:text-white transition-all duration-500 shadow-xl shadow-white/5"
          >
            Authenticate to Begin
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-48 max-w-7xl mx-auto px-4 pb-48"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-10">
        <div className="max-w-2xl">
          <span className="section-label mb-6 block">PERSONAL ARCHIVE</span>
          <h1 className="hero-title text-glow mb-6">OBSERVATION <span className="text-blue-500">LOG</span></h1>
          <p className="text-gray-400 font-light text-xl leading-relaxed">Documenting your journey across the celestial sphere.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="glass px-8 py-4 rounded-[2rem] flex items-center space-x-6 border border-white/5">
            <div className="text-right">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.3em] mb-1">Total Entries</p>
              <p className="text-2xl font-display font-bold text-white">{logs.length}</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-right">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.3em] mb-1">Last Sync</p>
              <p className="text-sm font-bold text-blue-400">{logs.length > 0 ? new Date(logs[0].createdAt).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl ${
              isAdding 
                ? 'bg-red-500/20 text-red-500 rotate-45 border border-red-500/30' 
                : 'bg-blue-600 text-white shadow-blue-600/20 border border-blue-500/50'
            }`}
          >
            <Plus size={32} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="glass-card p-12 rounded-[3rem] mb-20 border border-blue-500/20 shadow-[0_0_80px_rgba(59,130,246,0.05)]"
          >
            <div className="flex items-center space-x-4 mb-12">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400">
                <Plus size={20} />
              </div>
              <h2 className="font-display text-2xl uppercase tracking-tight">New Observation</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-3 block font-mono">Date</label>
                    <input 
                      type="date" 
                      value={newLog.date} 
                      onChange={e => setNewLog({...newLog, date: e.target.value})} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all font-mono" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-3 block font-mono">Bortle Class</label>
                    <select 
                      value={newLog.bortle} 
                      onChange={e => setNewLog({...newLog, bortle: parseInt(e.target.value)})} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none font-mono"
                    >
                      {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n} className="bg-[#020205]">Class {n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-3 block font-mono">Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Joshua Tree, CA"
                    value={newLog.location} 
                    onChange={e => setNewLog({...newLog, location: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-3 block font-mono">Equipment</label>
                  <input 
                    type="text" 
                    placeholder='e.g. 8" Dobsonian, 25mm Eyepiece'
                    value={newLog.equipment} 
                    onChange={e => setNewLog({...newLog, equipment: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all" 
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-3 block font-mono">Observation Notes</label>
                <textarea 
                  value={newLog.notes} 
                  onChange={e => setNewLog({...newLog, notes: e.target.value})} 
                  placeholder="Describe what you saw... (e.g. 'Saturn's rings were exceptionally clear tonight...')"
                  className="flex-1 w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all resize-none min-h-[200px]" 
                />
                <button 
                  onClick={saveLog} 
                  className="mt-8 bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold tracking-[0.2em] uppercase transition-all shadow-xl shadow-blue-600/20"
                >
                  Commit to Archive
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-10">
        {logs.length > 0 ? logs.map((log, idx) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="glass-card rounded-[3rem] overflow-hidden group border border-white/5 hover:border-white/10 transition-all duration-500"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-3 p-10 border-b lg:border-b-0 lg:border-r border-white/5 bg-white/[0.01] flex flex-col justify-center">
                <p className="text-blue-500 font-mono text-xs mb-2 uppercase tracking-[0.3em]">
                  {new Date(log.date).toLocaleDateString('en-US', { month: 'long' })}
                </p>
                <p className="text-6xl font-display font-bold mb-2 tracking-tighter">
                  {new Date(log.date).toLocaleDateString('en-US', { day: '2-digit' })}
                </p>
                <p className="text-gray-600 text-[10px] uppercase tracking-[0.4em]">
                  {new Date(log.date).toLocaleDateString('en-US', { year: 'numeric' })}
                </p>
                
                <div className="mt-10 pt-10 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-600 uppercase tracking-widest">Bortle</span>
                    <span className="text-xs font-bold text-emerald-400">Class {log.bortle}</span>
                  </div>
                  <button 
                    onClick={() => deleteLog(log.id)}
                    className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl text-[9px] font-bold tracking-widest uppercase text-gray-600 hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                    <span>Purge Entry</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-9 p-12">
                <div className="flex flex-wrap items-center gap-4 mb-8">
                  <div className="glass px-4 py-1.5 rounded-full text-[9px] font-bold tracking-widest uppercase text-blue-400 border border-white/5">
                    {log.location}
                  </div>
                  <div className="glass px-4 py-1.5 rounded-full text-[9px] font-bold tracking-widest uppercase text-purple-400 border border-white/5">
                    {log.equipment}
                  </div>
                </div>
                
                <div className="relative">
                  <div className="absolute -left-6 top-0 w-1 h-full bg-gradient-to-b from-blue-500 to-transparent opacity-30" />
                  <p className="text-gray-300 text-xl font-light leading-relaxed italic">
                    "{log.notes}"
                  </p>
                </div>
                
                <div className="mt-12 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                   <div className="flex items-center space-x-2 text-gray-600">
                      <Star size={12} />
                      <span className="text-[9px] font-mono uppercase tracking-widest">Observation Verified</span>
                   </div>
                   <button className="text-[9px] font-bold tracking-widest uppercase text-blue-500 hover:text-blue-400 transition-colors">
                      Share Memory →
                   </button>
                </div>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="py-32 text-center glass-card rounded-[4rem] border border-white/5">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center mx-auto mb-8 text-gray-600 border border-white/10">
              <BookOpen size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4 uppercase tracking-tight">The Archive is Empty</h3>
            <p className="text-gray-500 max-w-sm mx-auto font-light leading-relaxed">Your journey is just beginning. Click the plus icon to record your first celestial encounter.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Forum = () => {
  const [view, setView] = useState<'categories' | 'threads' | 'thread'>('categories');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [newContent, setNewContent] = useState('');
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      const snapshot = await getDocs(collection(db, 'forum_categories'));
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCategories();
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  const fetchThreads = async (cat: any) => {
    setSelectedCategory(cat);
    const q = query(collection(db, 'forum_threads'), where('categoryId', '==', cat.id), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    setThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setView('threads');
  };

  const fetchPosts = async (thread: any) => {
    setSelectedThread(thread);
    const q = query(collection(db, 'forum_posts'), where('threadId', '==', thread.id), orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setView('thread');
  };

  const createThread = async () => {
    if (!user) return alert("Login to post!");
    const docRef = await addDoc(collection(db, 'forum_threads'), {
      categoryId: selectedCategory.id,
      title: newTitle,
      authorId: user.uid,
      authorName: user.displayName,
      createdAt: new Date().toISOString()
    });
    await addDoc(collection(db, 'forum_posts'), {
      threadId: docRef.id,
      content: newContent,
      authorId: user.uid,
      authorName: user.displayName,
      createdAt: new Date().toISOString()
    });
    setNewTitle('');
    setNewContent('');
    fetchThreads(selectedCategory);
  };

  const replyToThread = async () => {
    if (!user) return alert("Login to reply!");
    await addDoc(collection(db, 'forum_posts'), {
      threadId: selectedThread.id,
      content: newContent,
      authorId: user.uid,
      authorName: user.displayName,
      createdAt: new Date().toISOString()
    });
    setNewContent('');
    fetchPosts(selectedThread);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-48 max-w-7xl mx-auto px-4 min-h-[70vh] pb-48 relative"
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-10">
        <div className="max-w-2xl">
          <motion.span 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="section-label mb-6 block"
          >
            COMMUNITY HUB
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="hero-title text-glow mb-6 uppercase"
          >
            STAR<span className="text-blue-500">FORUM</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 font-light text-xl leading-relaxed"
          >
            Connect with fellow stargazers, share experiences, and learn from the community.
          </motion.p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="glass px-8 py-4 rounded-[2rem] flex items-center space-x-8 border border-white/5">
            <div className="text-right">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.3em] mb-1">Active Now</p>
              <p className="text-2xl font-display font-bold text-emerald-400">1.2k</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-right">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.3em] mb-1">Total Threads</p>
              <p className="text-2xl font-display font-bold text-white">{categories.length * 12}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center space-x-4 text-[10px] font-mono text-gray-600 mb-12 uppercase tracking-[0.2em]">
        <button onClick={() => setView('categories')} className="hover:text-blue-400 transition-colors">ROOT</button>
        {view !== 'categories' && (
          <>
            <span className="opacity-30">/</span>
            <button onClick={() => setView('threads')} className="hover:text-blue-400 transition-colors">{selectedCategory?.name}</button>
          </>
        )}
        {view === 'thread' && (
          <>
            <span className="opacity-30">/</span>
            <span className="text-gray-400 truncate max-w-[200px]">{selectedThread?.title}</span>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'categories' && (
          <motion.div 
            key="categories"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {categories.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => fetchThreads(cat)}
                className="glass-card hover:bg-white/[0.03] p-10 rounded-[3rem] text-left flex items-center space-x-8 border border-white/5 group transition-all duration-500"
              >
                <div className="w-20 h-20 glass rounded-[1.5rem] flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-500 border border-white/10 shadow-xl">
                  <Star size={40} />
                </div>
                <div>
                  <h3 className="font-display text-3xl mb-3 group-hover:text-blue-400 transition-colors tracking-tight">{cat.name}</h3>
                  <p className="text-gray-500 text-sm font-light leading-relaxed">{cat.description}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {view === 'threads' && (
          <motion.div 
            key="threads"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
              <h2 className="font-display text-4xl uppercase tracking-tight">{selectedCategory?.name}</h2>
              {user && (
                <button 
                  onClick={() => setView('thread' as any)} 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all shadow-xl shadow-blue-600/20"
                >
                  CREATE NEW THREAD
                </button>
              )}
            </div>
            
            {user && view === ('thread' as any) && (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="glass-card p-12 rounded-[3rem] mb-12 border border-blue-500/20 shadow-[0_0_80px_rgba(59,130,246,0.05)]"
               >
                  <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase mb-8 text-blue-400">Initiate Discussion</h3>
                  <input 
                    value={newTitle} 
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Thread Title"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 mb-6 focus:outline-none focus:border-blue-500 text-lg transition-all"
                  />
                  <textarea 
                    value={newContent} 
                    onChange={e => setNewContent(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 mb-8 focus:outline-none focus:border-blue-500 text-lg transition-all resize-none"
                    rows={6}
                  />
                  <div className="flex justify-end space-x-6">
                    <button onClick={() => setView('threads')} className="px-8 py-4 text-[10px] font-bold tracking-widest uppercase text-gray-500 hover:text-white transition-colors">Discard</button>
                    <button onClick={createThread} className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 rounded-2xl font-bold tracking-widest uppercase transition-all">Publish Thread</button>
                  </div>
               </motion.div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {threads.map(thread => (
                <button 
                  key={thread.id} 
                  onClick={() => fetchPosts(thread)}
                  className="w-full glass-card hover:bg-white/[0.03] p-8 rounded-[2rem] text-left flex justify-between items-center border border-white/5 group transition-all duration-500"
                >
                  <div className="flex items-center space-x-6">
                    <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-gray-600 group-hover:text-blue-400 transition-colors border border-white/10">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">{thread.title}</h3>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">
                        By <span className="text-gray-400">{thread.authorName}</span> • {new Date(thread.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-700 group-hover:text-blue-400 transition-colors transform group-hover:translate-x-2 duration-500">
                    <ArrowRight size={24} />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {view === 'thread' && (
          <motion.div 
            key="thread"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="mb-16">
              <h2 className="font-display text-5xl md:text-6xl uppercase tracking-tighter leading-none mb-6">{selectedThread?.title}</h2>
              <div className="flex items-center space-x-4 text-[10px] font-mono text-gray-600 uppercase tracking-[0.2em]">
                <span>Thread ID: {selectedThread?.id}</span>
                <span className="opacity-30">•</span>
                <span>Started by {selectedThread?.authorName}</span>
              </div>
            </div>

            <div className="space-y-6">
              {posts.map((post, idx) => (
                <motion.div 
                  key={post.id} 
                  initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`glass-card p-10 rounded-[3rem] border border-white/5 relative ${idx === 0 ? 'bg-white/[0.02] border-blue-500/20' : ''}`}
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-600/10" />
                      <div>
                        <p className="font-bold text-lg text-white">{post.authorName}</p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-mono">{new Date(post.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-gray-700 uppercase tracking-widest">#{idx + 1}</div>
                  </div>
                  <p className="text-gray-300 text-lg font-light leading-relaxed max-w-4xl">{post.content}</p>
                </motion.div>
              ))}
            </div>

            {user ? (
              <div className="glass-card p-10 rounded-[3rem] mt-16 border border-white/5 bg-white/[0.01]">
                <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase mb-8 text-blue-400">Contribute to Discussion</h3>
                <textarea 
                  value={newContent} 
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Write your reply..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 mb-8 focus:outline-none focus:border-blue-500 text-lg transition-all resize-none"
                  rows={5}
                />
                <div className="flex justify-end">
                  <button 
                    onClick={replyToThread} 
                    className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 rounded-2xl font-bold tracking-widest uppercase transition-all shadow-xl shadow-blue-600/20"
                  >
                    Send Reply
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 glass-card rounded-[3rem] border border-white/5">
                <p className="text-gray-600 italic font-light text-xl">Login to join the conversation.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const About = () => {
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await addDoc(collection(db, 'contacts'), {
        ...formState,
        createdAt: new Date().toISOString()
      });
      setStatus('success');
      setFormState({ name: '', email: '', message: '' });
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-48 pb-48 relative overflow-hidden"
    >
      {/* Immersive Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[160px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[140px] translate-y-1/2 -translate-x-1/4" />
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="section-label mb-8 block">EST. 2024</span>
            <h1 className="hero-title text-glow mb-12 leading-[0.85]">OUR <br /><span className="text-blue-500">MISSION</span></h1>
            <p className="text-2xl text-gray-300 mb-10 leading-relaxed font-light">
              Stargaze is a decentralized hub for celestial exploration. We believe the wonder of the cosmos should be accessible to every human, without barriers.
            </p>
            <div className="space-y-8 mb-16">
              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-blue-400 border border-white/10 flex-shrink-0">
                  <Star size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Open Access</h3>
                  <p className="text-gray-400 leading-relaxed">Leveraging public data from NASA, ESA, and SpaceX to provide real-time celestial insights.</p>
                </div>
              </div>
              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-purple-400 border border-white/10 flex-shrink-0">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Community First</h3>
                  <p className="text-gray-400 leading-relaxed">A global network of hobbyists sharing observations and collective knowledge.</p>
                </div>
              </div>
            </div>
            <div className="glass p-8 rounded-[2rem] border border-white/5 bg-white/[0.01] inline-block">
              <p className="text-[10px] font-bold tracking-[0.4em] text-blue-400 uppercase mb-4">Core Philosophy</p>
              <p className="text-xl text-white italic font-light leading-relaxed">"To bring the clarity of the cosmos to every backyard."</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="glass-card p-12 md:p-16 rounded-[4rem] border border-white/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
              <Send size={200} />
            </div>
            <h2 className="font-display text-4xl mb-12 uppercase tracking-tight">Establish <br /><span className="text-blue-500">Contact</span></h2>
            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-3 font-mono">Designation</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={e => setFormState({ ...formState, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 transition-all font-mono text-sm"
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-3 font-mono">Frequency</label>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={e => setFormState({ ...formState, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 transition-all font-mono text-sm"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-3 font-mono">Transmission</label>
                <textarea
                  required
                  rows={5}
                  value={formState.message}
                  onChange={e => setFormState({ ...formState, message: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 transition-all font-mono text-sm resize-none"
                  placeholder="How can we help?"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold tracking-[0.3em] uppercase flex items-center justify-center space-x-4 disabled:opacity-50 transition-all shadow-xl shadow-blue-600/20"
              >
                {status === 'sending' ? 'TRANSMITTING...' : (
                  <>
                    <span>SEND MESSAGE</span>
                    <Send size={20} />
                  </>
                )}
              </button>
              <AnimatePresence>
                {status === 'success' && (
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-emerald-400 text-center text-[10px] font-bold uppercase tracking-widest"
                  >
                    Transmission successful. Clear skies.
                  </motion.p>
                )}
                {status === 'error' && (
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-center text-[10px] font-bold uppercase tracking-widest"
                  >
                    Uplink failed. Please retry.
                  </motion.p>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main App ---

const seedDatabase = async () => {
  try {
    console.log('Checking database seed status...');
    
    // Seed events with stable IDs
    for (const event of events2026) {
      const eventRef = doc(db, 'events', event.id);
      const eventSnap = await getDoc(eventRef);
      
      // Update if not exists or if we want to ensure latest data
      if (!eventSnap.exists()) {
        await setDoc(eventRef, {
          ...event,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Check if forum categories are already seeded
    const categoriesSnapshot = await getDocs(collection(db, 'forum_categories'));
    if (categoriesSnapshot.empty) {
      console.log('Seeding forum categories...');
      for (const cat of forumCategories) {
        await addDoc(collection(db, 'forum_categories'), {
          ...cat,
          createdAt: new Date().toISOString()
        });
      }
    }
  } catch (e) {
    console.error('Error seeding database:', e);
  }
};

export default function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email === "blackshotsgeneralstore@gmail.com") {
        seedDatabase();
      }
    });
  }, []);

  return (
    <Router>
      <KeySelectionGuard>
        <div className="min-h-screen relative selection:bg-blue-500/30">
          <div className="atmosphere" />
          <Stars />
          <Navbar user={user} setUser={setUser} />
          
          <AnimatePresence mode="wait">
            <main className="relative z-10">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/sky" element={<Sky />} />
                <Route path="/moon" element={<MoonExplorer />} />
                <Route path="/explorer" element={<Explorer />} />
                <Route path="/events" element={<Events />} />
                <Route path="/forum" element={<Forum />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/tips" element={<Tips />} />
                <Route path="/about" element={<About />} />
              </Routes>
            </main>
          </AnimatePresence>

          <StargazeAI />
          <Footer />
        </div>
      </KeySelectionGuard>
    </Router>
  );
}
