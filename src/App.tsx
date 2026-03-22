import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Calendar, BookOpen, Info, Menu, X, Send, ExternalLink, Moon as MoonIcon, Sun, Star, MessageSquare, Map as MapIcon, Cloud, Wind, Eye, Activity, Trash2, Plus, ArrowRight, Twitter, Github } from 'lucide-react';
import { db, collection, addDoc, getDocs, query, orderBy, limit, where, auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messageText,
        config: {
          systemInstruction: "You are the Stargaze Guide, a friendly and expert astronomer. You help hobbyists identify stars, planets, and provide stargazing tips. Keep answers concise and inspiring. Use markdown for formatting."
        }
      });
      setMessages(prev => [...prev, { role: 'ai', text: response.text || "The stars are silent right now. Try again later!" }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'ai', text: "I'm having trouble connecting to the celestial network." }]);
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
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
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

  useEffect(() => {
    const generate = async () => {
      setLoading(true);
      setError(false);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
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
      } catch (err) {
        console.error("Generation error:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (prompt) generate();
  }, [prompt, aspectRatio]);

  if (loading) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-white/5 animate-pulse ${className}`}>
        <Star className="text-blue-500 animate-spin" size={24} />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <img 
        src={`https://picsum.photos/seed/${prompt}/800/1000`} 
        alt={alt} 
        className={className} 
        referrerPolicy="no-referrer" 
      />
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={alt} 
      className={className} 
      referrerPolicy="no-referrer" 
    />
  );
};

const KeySelectionGuard = ({ children }: { children: React.ReactNode }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  if (hasKey === null) return null;

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
            To generate real-time celestial imagery using the Nano Banana 2 (Gemini 3.1) model, you need to provide a Google Cloud API key with billing enabled.
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

const Logo = () => {
  return (
    <Link to="/" className="flex items-center space-x-2 group relative">
      <motion.div 
        className="relative flex items-center"
        whileHover="hover"
      >
        <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="relative mr-3"
        >
          <Sparkles className="text-blue-400 w-6 h-6" />
          <motion.div 
            className="absolute inset-0 text-white/20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles className="w-6 h-6" />
          </motion.div>
        </motion.div>

        <div className="flex flex-col">
          <motion.span 
            className="font-display text-2xl font-bold tracking-tighter text-white leading-none"
            variants={{
              hover: { letterSpacing: "0.05em" }
            }}
          >
            STARGAZE
          </motion.span>
          <motion.span 
            className="text-[8px] font-mono tracking-[0.4em] text-blue-400/60 uppercase mt-1"
            variants={{
              hover: { color: "#60a5fa", opacity: 1 }
            }}
          >
            Cosmic Clarity
          </motion.span>
        </div>
      </motion.div>
    </Link>
  );
};

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
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
      scrolled ? 'py-4' : 'py-8'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`glass-nav rounded-full px-6 transition-all duration-500 ${
          scrolled ? 'py-3 shadow-2xl' : 'py-4'
        }`}>
          <div className="flex items-center justify-between">
            <Logo />

            {/* Desktop Menu */}
            <div className="hidden lg:block">
              <div className="flex items-center space-x-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={(e) => handleNavClick(e, link.path)}
                    className={`px-5 py-2 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-300 relative group/link ${
                      location.pathname === link.path
                        ? 'text-white'
                        : 'text-gray-500 hover:text-blue-400'
                    }`}
                  >
                    <span className="relative z-10">{link.name}</span>
                    {location.pathname === link.path && (
                      <motion.div 
                        layoutId="nav-active"
                        className="absolute inset-0 bg-blue-500/10 rounded-full border border-blue-500/20"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                ))}
                <div className="ml-4 border-l border-white/10 pl-4">
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
  <footer className="glass border-t border-white/10 py-16 mt-20 relative overflow-hidden">
    <div className="absolute inset-0 z-0 opacity-5">
      <div className="nebula top-0 left-1/2 -translate-x-1/2 w-full h-full" />
    </div>
    
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="flex justify-center mb-8">
        <Logo />
      </div>
      <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">
        Where clarity meets the cosmos. We bring the wonders of the universe to your screen through data, community, and AI-powered reimagination.
      </p>
      <div className="flex justify-center space-x-8 mb-12">
        {['Home', 'Events', 'Sky', 'Moon', 'Forum', 'Journal', 'About'].map((item) => (
          <Link 
            key={item}
            to={item === 'Home' ? '/' : `/${item.toLowerCase()}`} 
            className="text-[10px] font-bold tracking-[0.2em] text-gray-500 hover:text-blue-400 transition-colors uppercase"
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-[10px] tracking-widest uppercase">© 2026 STARGAZE.IO. ALL RIGHTS RESERVED.</p>
        <div className="flex space-x-6">
          <a href="#" className="text-gray-600 hover:text-white transition-colors"><Twitter size={14} /></a>
          <a href="#" className="text-gray-600 hover:text-white transition-colors"><Github size={14} /></a>
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
      <section className="relative min-h-[80vh] flex items-center justify-center px-4 text-center overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
          <div className="nebula top-1/4 left-1/4 scale-150" />
          <div className="nebula bottom-1/4 right-1/4 scale-150" style={{ background: 'radial-gradient(circle, rgba(50, 100, 255, 0.2) 0%, transparent 70%)' }} />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 1.2, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-6xl mx-auto z-10 relative"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8 inline-block"
          >
            <span className="px-6 py-2 rounded-full glass text-[10px] font-bold tracking-[0.4em] text-blue-400 uppercase border border-blue-500/20">
              EST. 2026 • CLEAR SKIES AHEAD
            </span>
          </motion.div>
          
          <h1 className="font-display text-[14vw] md:text-[10vw] leading-[0.8] font-bold mb-10 tracking-tighter text-glow">
            STAR<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">GLAZE</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-400 mb-14 max-w-2xl mx-auto font-light leading-relaxed">
            Your portal to the infinite. Real-time celestial events, 3D exploration, and AI-guided discovery.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/sky" className="bg-white text-black px-10 py-4 rounded-full text-sm font-bold tracking-widest hover:bg-blue-400 hover:text-white transition-all duration-500">
              LAUNCH SKY MAP
            </Link>
            <Link to="/events" className="glass px-10 py-4 rounded-full text-sm font-bold tracking-widest hover:bg-white/10 transition-all duration-500">
              VIEW CALENDAR
            </Link>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-4"
        >
          <span className="text-[8px] font-bold tracking-[0.5em] text-gray-500 uppercase">SCROLL TO EXPLORE</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-blue-500 to-transparent" />
        </motion.div>
      </section>

      {/* Featured Events - Recipe 1: Technical Grid */}
      <section className="max-w-7xl mx-auto px-4 py-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
          <div>
            <span className="text-blue-500 font-mono text-[10px] tracking-[0.3em] uppercase mb-2 block">01 / DISCOVER</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold">Upcoming Highlights</h2>
          </div>
          <Link to="/events" className="text-xs font-bold tracking-widest text-gray-500 hover:text-white transition-colors flex items-center space-x-2 group">
            <span>VIEW ALL EVENTS</span>
            <Plus size={14} className="group-hover:rotate-90 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredEvents.length > 0 ? featuredEvents.map((event, idx) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group border border-white/5 hover:border-blue-500/30 transition-all duration-500"
            >
              <div className="h-72 bg-gray-900 relative overflow-hidden">
                <GeneratedImage 
                  prompt={`${event.title} - ${event.description}`}
                  alt={event.title}
                  aspectRatio="16:9"
                  className="w-full h-full object-cover opacity-30 group-hover:scale-105 group-hover:opacity-50 transition-all duration-1000"
                />
                <div className="absolute top-6 left-6 glass px-5 py-2 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase border border-white/10">
                  {event.type}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-transparent opacity-60" />
              </div>
              <div className="p-10 flex-grow relative">
                <div className="absolute top-0 right-10 -translate-y-1/2 w-12 h-12 rounded-2xl glass flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all duration-500">
                  <Calendar size={20} />
                </div>
                <p className="text-blue-400 font-mono text-[10px] tracking-[0.2em] mb-4 uppercase">{new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <h3 className="font-display text-2xl mb-6 group-hover:text-blue-400 transition-colors leading-tight">{event.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed line-clamp-3 font-light">{event.description}</p>
              </div>
              <div className="px-10 pb-10">
                <Link to="/events" className="w-full glass py-4 rounded-2xl text-[10px] font-bold tracking-[0.3em] flex items-center justify-center space-x-3 group/btn hover:bg-blue-500 hover:text-white transition-all duration-500 border border-white/5">
                  <span>EXPLORE EVENT</span>
                  <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          )) : (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card h-96 rounded-[2rem] animate-pulse" />
            ))
          )}
        </div>
      </section>

      {/* APOD Section - Recipe 7: Atmospheric */}
      <section id="daily" className="max-w-7xl mx-auto px-4 py-32">
        <div className="glass-card rounded-[3rem] overflow-hidden relative">
          <div className="absolute inset-0 z-0 opacity-10">
            <div className="nebula top-0 left-0" />
            <div className="nebula bottom-0 right-0" style={{ background: 'radial-gradient(circle, rgba(255, 50, 100, 0.1) 0%, transparent 70%)' }} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 relative z-10">
            <div className="p-10 md:p-20 flex flex-col justify-center">
              <span className="text-pink-500 font-mono text-[10px] tracking-[0.3em] uppercase mb-4 block">02 / DAILY WONDER</span>
              <h2 className="font-display text-4xl md:text-7xl font-bold mb-8 leading-tight text-glow uppercase">NASA <span className="text-pink-500">POTD</span></h2>
              {apod ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                >
                  <h3 className="text-2xl font-bold mb-6 text-blue-400">{apod.title}</h3>
                  <p className="text-gray-400 text-lg leading-relaxed mb-10 font-light">
                    {apod.explanation}
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
                        <Star size={20} className="text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Copyright</p>
                        <p className="text-sm font-bold">{apod.copyright || 'NASA Public Domain'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setReimagine(!reimagine)}
                      className={`px-6 py-3 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all flex items-center space-x-2 ${
                        reimagine ? 'bg-blue-600 text-white' : 'glass text-blue-400 hover:bg-white/5'
                      }`}
                    >
                      <Sparkles size={14} />
                      <span>{reimagine ? 'SHOW ORIGINAL' : 'AI REIMAGINE'}</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="h-8 bg-white/5 rounded-full w-3/4 animate-pulse" />
                  <div className="h-32 bg-white/5 rounded-2xl w-full animate-pulse" />
                </div>
              )}
            </div>
            <div className="relative min-h-[400px] lg:min-h-full overflow-hidden group">
              {apod && (
                reimagine || apod.isFallback ? (
                  <GeneratedImage 
                    prompt={apod.title + " " + apod.explanation.substring(0, 100)}
                    alt={apod.title}
                    aspectRatio="16:9"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                  />
                ) : (
                  <img 
                    src={apod.url} 
                    alt={apod.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                )
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-transparent lg:bg-gradient-to-l lg:from-[#020205] lg:via-transparent lg:to-transparent" />
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
            // Default to London if geolocation fails
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
      // Using a more standard set of parameters that are widely available
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
      className="pt-24 min-h-screen flex flex-col pb-12"
    >
      <div className="max-w-7xl mx-auto px-4 w-full mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <span className="text-blue-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-4 block">Telemetry Dashboard</span>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tighter text-glow uppercase">CELESTIAL <span className="text-blue-500">HUB</span></h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="glass px-4 py-2 rounded-xl flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-500">System Live</span>
            </div>
            <div className="glass px-4 py-2 rounded-xl flex items-center space-x-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">LAT: {coords?.lat.toFixed(2) || '0.00'}</span>
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">LNG: {coords?.lng.toFixed(2) || '0.00'}</span>
              </div>
              <button 
                onClick={() => setManualLocation(!manualLocation)}
                className="glass px-3 py-1 rounded-lg text-[8px] font-bold tracking-widest uppercase hover:bg-white/10 transition-all border border-white/5"
              >
                {manualLocation ? 'CLOSE' : 'SET LOC'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {manualLocation && (
        <div className="max-w-7xl mx-auto px-4 w-full mb-8">
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleManualUpdate}
            className="glass p-6 rounded-3xl flex flex-wrap items-end gap-6 border border-blue-500/20"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block font-mono">Latitude</label>
              <input 
                type="number" 
                step="0.01"
                value={tempCoords.lat}
                onChange={e => setTempCoords({...tempCoords, lat: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block font-mono">Longitude</label>
              <input 
                type="number" 
                step="0.01"
                value={tempCoords.lng}
                onChange={e => setTempCoords({...tempCoords, lng: parseFloat(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
            <button type="submit" className="glass bg-blue-600/20 hover:bg-blue-600/30 px-8 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase border border-blue-500/30 h-[42px]">
              Update Coordinates
            </button>
          </motion.form>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sky Map - Main Instrument */}
        <div className="lg:col-span-8">
          <div className="glass-card rounded-[3rem] overflow-hidden h-[600px] relative border border-white/5 shadow-2xl">
            <div className="absolute top-6 left-6 z-10 flex items-center space-x-3">
              <div className="glass px-4 py-2 rounded-full flex items-center space-x-2 backdrop-blur-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[9px] font-bold tracking-widest uppercase">Stellarium Core v1.2</span>
              </div>
            </div>
            {coords ? (
              <iframe 
                src={`https://stellarium-web.org/skymap?lat=${coords.lat}&lng=${coords.lng}`}
                className="w-full h-full border-none grayscale-[0.2] contrast-[1.1]"
                title="Sky Map"
                allow="geolocation"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020205]">
                <div className="w-16 h-16 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6" />
                <p className="text-gray-500 font-mono text-xs tracking-widest uppercase animate-pulse">Aligning with the stars...</p>
              </div>
            )}
            <div className="absolute bottom-6 right-6 z-10">
              <button className="glass px-6 py-3 rounded-2xl text-[10px] font-bold tracking-widest uppercase hover:bg-white/5 transition-all">
                Full Screen Mode
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Hardware Widgets */}
        <div className="lg:col-span-4 space-y-8">
          {/* Weather / Conditions Widget - Recipe 3 */}
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Cloud size={120} />
            </div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-blue-400">
                  <Cloud size={20} />
                </div>
                <h3 className="text-xs font-bold tracking-widest uppercase">Atmospherics</h3>
              </div>
              <span className="text-[10px] font-mono text-gray-500">REF: OPEN-METEO</span>
            </div>
            
            {weather ? (
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Cloud Density</span>
                    <span className="font-mono text-xl text-blue-400">{weather.cloudcover[0]}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${weather.cloudcover[0]}%` }}
                      className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full" 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass p-5 rounded-2xl border border-white/5">
                    <Wind size={16} className="mb-3 text-purple-400" />
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Pressure</p>
                    <p className="text-lg font-display font-bold">{weather.surface_pressure ? `${Math.round(weather.surface_pressure[0])} hPa` : 'N/A'}</p>
                  </div>
                  <div className="glass p-5 rounded-2xl border border-white/5">
                    <Activity size={16} className="mb-3 text-emerald-400" />
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Humidity</p>
                    <p className="text-lg font-display font-bold">{weather.relativehumidity_2m ? `${weather.relativehumidity_2m[0]}%` : 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest animate-pulse">Scanning Atmosphere...</p>
              </div>
            )}
          </div>

          {/* ISS Tracker Widget - Recipe 3 */}
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Activity size={120} />
            </div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-orange-400">
                  <Activity size={20} />
                </div>
                <h3 className="text-xs font-bold tracking-widest uppercase">ISS Telemetry</h3>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                <span className="text-[10px] font-mono text-orange-500">LIVE</span>
              </div>
            </div>

            {iss ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Latitude</p>
                    <p className="font-mono text-sm">{iss.latitude.toFixed(4)}°</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Longitude</p>
                    <p className="font-mono text-sm">{iss.longitude.toFixed(4)}°</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Altitude</p>
                    <p className="font-mono text-sm">{iss.altitude.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Velocity</p>
                    <p className="font-mono text-sm text-orange-400">{(iss.velocity / 3600).toFixed(2)} km/s</p>
                  </div>
                </div>
                <div className="pt-4">
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ x: [0, 100, 0] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                      className="w-1/3 h-full bg-orange-500/50"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest animate-pulse">Establishing Uplink...</p>
              </div>
            )}
          </div>

          {/* Dark Sky Finder - Recipe 3 */}
          <a 
            href="https://www.lightpollutionmap.info/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="glass-card p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:bg-white/[0.02] transition-all"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <MapIcon size={24} />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase mb-1">Dark Sky Finder</h3>
                <p className="text-[10px] text-gray-500 font-light">Locate Bortle 1-3 zones</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center text-gray-500 group-hover:text-white group-hover:bg-white/10 transition-all">
              <ExternalLink size={16} />
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
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={1} metalness={0} />
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
      <div className="absolute inset-0 z-0 atmosphere opacity-40" />
      
      <div className="absolute inset-0 z-10">
        <Canvas camera={{ position: [0, 0, 6] }}>
          <ambientLight intensity={0.1} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
          <React.Suspense fallback={null}>
            <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
              <MoonModel />
            </Float>
            <ThreeStars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          </React.Suspense>
          <OrbitControls enableZoom={true} autoRotate={false} />
        </Canvas>
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-4 w-full h-full pointer-events-none flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="max-w-xl"
        >
          <span className="text-blue-500 font-mono text-[10px] tracking-[0.5em] uppercase mb-6 block">Celestial Body 01</span>
          <h1 className="font-display text-7xl md:text-9xl font-bold mb-8 text-white tracking-tighter leading-none text-glow uppercase">THE <span className="text-blue-500">MOON</span></h1>
          <p className="text-gray-400 text-xl font-light mb-12 leading-relaxed">
            Explore our celestial neighbor in high-fidelity 3D. A silent witness to human history, waiting for our return.
          </p>
          
          {/* Recipe 7: Glass Morphism Widget */}
          <div className="glass-card p-8 rounded-[2.5rem] pointer-events-auto max-w-sm backdrop-blur-3xl border border-white/10">
            <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase mb-6 flex items-center space-x-3 text-blue-400">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Current Phase</span>
            </h3>
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 rounded-full glass flex items-center justify-center border border-white/10">
                <moonData.icon size={32} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-white">{moonData.name}</p>
                <p className="text-xs text-gray-500 font-mono tracking-widest uppercase">~{moonData.illumination}% Illuminated</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recipe 7: Gradient Mask for UI edges */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center space-y-4"
        >
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.4em]">Interact to Explore</span>
          <div className="w-px h-12 bg-gradient-to-b from-blue-500 to-transparent" />
        </motion.div>
      </div>

      <div className="absolute top-1/2 right-12 -translate-y-1/2 z-20 pointer-events-none hidden lg:block">
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.5em] vertical-text">Drag to Rotate • Scroll to Zoom</p>
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
      <div className="pt-40 max-w-7xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 rounded-[3rem] inline-block"
        >
          <BookOpen size={48} className="mx-auto mb-6 text-blue-500" />
          <h1 className="font-display text-4xl mb-4">Observation Journal</h1>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Login to start recording your journey through the stars. Your logs are private and secure.</p>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="bg-white text-black px-10 py-4 rounded-full font-bold tracking-widest hover:bg-blue-400 hover:text-white transition-all">LOGIN TO START</button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-32 max-w-7xl mx-auto px-4 pb-20"
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
        <div>
          <span className="text-blue-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-4 block">Personal Archive</span>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tighter text-glow">OBSERVATION <span className="text-blue-500">LOG</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="glass px-6 py-3 rounded-2xl flex items-center space-x-4">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total Entries</p>
              <p className="text-xl font-display font-bold">{logs.length}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Last Update</p>
              <p className="text-sm font-bold">{logs.length > 0 ? new Date(logs[0].createdAt).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              isAdding ? 'bg-red-500/20 text-red-500 rotate-45' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            }`}
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-8 rounded-[2.5rem] mb-12"
          >
            <h2 className="font-display text-xl mb-8 flex items-center space-x-3">
              <Plus size={20} className="text-blue-400" />
              <span>New Entry</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">Date</label>
                    <input type="date" value={newLog.date} onChange={e => setNewLog({...newLog, date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">Bortle Scale</label>
                    <select value={newLog.bortle} onChange={e => setNewLog({...newLog, bortle: parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                      {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n} className="bg-[#020205]">Class {n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">Location</label>
                  <input placeholder="e.g. Joshua Tree, CA" value={newLog.location} onChange={e => setNewLog({...newLog, location: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">Equipment</label>
                  <input placeholder='e.g. 8" Dobsonian, 10x50 Binoculars' value={newLog.equipment} onChange={e => setNewLog({...newLog, equipment: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">Notes</label>
                  <textarea rows={3} placeholder="What did you see? How was the transparency?" value={newLog.notes} onChange={e => setNewLog({...newLog, notes: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                </div>
                <button onClick={saveLog} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold tracking-widest uppercase transition-all shadow-lg shadow-blue-600/20">SAVE OBSERVATION</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {logs.length > 0 ? logs.map((log, idx) => (
          <motion.div 
            key={log.id} 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-card p-8 rounded-[2.5rem] relative group overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => deleteLog(log.id)}
                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-blue-400 font-mono text-[10px] uppercase tracking-widest mb-1">{new Date(log.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                <p className="text-3xl font-display font-bold">{new Date(log.date).toLocaleDateString('en-US', { day: '2-digit' })}</p>
              </div>
              <div className="glass px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase text-gray-400">Bortle {log.bortle}</div>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Location</p>
                <p className="text-sm font-medium text-gray-200">{log.location}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Equipment</p>
                <p className="text-sm font-medium text-gray-200">{log.equipment || 'Naked Eye'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Notes</p>
                <p className="text-gray-400 text-sm leading-relaxed font-light italic leading-relaxed">"{log.notes}"</p>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full glass-card rounded-[3rem] p-20 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen size={32} className="text-gray-600" />
            </div>
            <h3 className="font-display text-xl mb-2">No entries yet</h3>
            <p className="text-gray-500 text-sm">Your astronomical journey starts here. Add your first observation.</p>
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
    <div className="pt-32 max-w-7xl mx-auto px-4 min-h-[70vh] pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
        <div>
          <span className="text-blue-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-4 block">Community Hub</span>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tighter text-glow uppercase">STAR<span className="text-blue-500">FORUM</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="glass px-6 py-3 rounded-2xl flex items-center space-x-4">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Active Users</p>
              <p className="text-xl font-display font-bold">1.2k</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total Threads</p>
              <p className="text-xl font-display font-bold">{categories.length * 12}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-8">
        <button onClick={() => setView('categories')} className="hover:text-white">Forum</button>
        {view !== 'categories' && (
          <>
            <span>/</span>
            <button onClick={() => setView('threads')} className="hover:text-white">{selectedCategory?.name}</button>
          </>
        )}
        {view === 'thread' && (
          <>
            <span>/</span>
            <span className="text-gray-300">{selectedThread?.title}</span>
          </>
        )}
      </div>

      {view === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => fetchThreads(cat)}
              className="glass hover:bg-white/10 p-8 rounded-3xl text-left flex items-center space-x-6"
            >
              <div className="p-4 glass rounded-2xl text-blue-400">
                <Star size={32} />
              </div>
              <div>
                <h3 className="font-display text-2xl mb-2">{cat.name}</h3>
                <p className="text-gray-400 text-sm">{cat.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {view === 'threads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-display text-3xl">{selectedCategory?.name}</h2>
            {user && (
              <button onClick={() => setView('thread' as any)} className="glass hover:bg-white/10 px-6 py-2 rounded-full text-sm font-bold">NEW THREAD</button>
            )}
          </div>
          
          {user && view === ('thread' as any) && (
             <div className="glass p-8 rounded-3xl mb-8">
                <input 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Thread Title"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-blue-500"
                />
                <textarea 
                  value={newContent} 
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-blue-500"
                  rows={4}
                />
                <div className="flex justify-end space-x-4">
                  <button onClick={() => setView('threads')} className="px-6 py-2 text-gray-400">Cancel</button>
                  <button onClick={createThread} className="glass hover:bg-white/10 px-8 py-2 rounded-full font-bold">POST THREAD</button>
                </div>
             </div>
          )}

          {threads.map(thread => (
            <button 
              key={thread.id} 
              onClick={() => fetchPosts(thread)}
              className="w-full glass hover:bg-white/10 p-6 rounded-2xl text-left flex justify-between items-center"
            >
              <div>
                <h3 className="text-xl font-bold mb-1">{thread.title}</h3>
                <p className="text-xs text-gray-500">By {thread.authorName} • {new Date(thread.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-blue-400">
                <ExternalLink size={20} />
              </div>
            </button>
          ))}
        </div>
      )}

      {view === 'thread' && (
        <div className="space-y-6">
          <h2 className="font-display text-3xl mb-8">{selectedThread?.title}</h2>
          {posts.map((post, idx) => (
            <div key={post.id} className={`glass p-6 rounded-2xl ${idx === 0 ? 'border-l-4 border-blue-500' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600" />
                  <div>
                    <p className="font-bold text-sm">{post.authorName}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{new Date(post.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">{post.content}</p>
            </div>
          ))}

          {user ? (
            <div className="glass p-6 rounded-2xl mt-8">
              <textarea 
                value={newContent} 
                onChange={e => setNewContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-blue-500"
                rows={3}
              />
              <div className="flex justify-end">
                <button onClick={replyToThread} className="glass hover:bg-white/10 px-8 py-2 rounded-full font-bold">REPLY</button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 italic">Login to join the conversation.</div>
          )}
        </div>
      )}
    </div>
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
    <div className="pt-32 max-w-7xl mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="text-blue-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-4 block">Our Story</span>
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-10 tracking-tighter text-glow uppercase">ABOUT <span className="text-blue-500">STARGAZE</span></h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed font-light">
            Stargaze is your no-cost hub for real sky events—hobbyists unite. 
            We believe that the wonder of the cosmos should be accessible to everyone, 
            without the need for expensive apps or complex equipment.
          </p>
          <p className="text-gray-400 mb-10">
            Powered by public data from NASA, ESA, and international astronomical unions, 
            we curate the most significant events to ensure you never miss a moment of celestial magic.
          </p>
          <div className="glass p-6 rounded-2xl inline-block">
            <p className="text-sm font-bold tracking-widest text-blue-400 uppercase">Our Mission</p>
            <p className="text-white mt-2 italic">"To bring the clarity of the cosmos to every backyard."</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass p-8 md:p-12 rounded-3xl"
        >
          <h2 className="font-display text-2xl mb-8">Get in Touch</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Name</label>
              <input
                type="text"
                required
                value={formState.name}
                onChange={e => setFormState({ ...formState, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Email</label>
              <input
                type="email"
                required
                value={formState.email}
                onChange={e => setFormState({ ...formState, email: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Message</label>
              <textarea
                required
                rows={4}
                value={formState.message}
                onChange={e => setFormState({ ...formState, message: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="How can we help?"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full glass hover:bg-white/10 py-4 rounded-xl font-bold tracking-widest flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {status === 'sending' ? 'SENDING...' : (
                <>
                  <span>SEND MESSAGE</span>
                  <Send size={18} />
                </>
              )}
            </button>
            {status === 'success' && <p className="text-green-400 text-center text-sm">Message sent successfully! Clear skies.</p>}
            {status === 'error' && <p className="text-red-400 text-center text-sm">Something went wrong. Please try again.</p>}
          </form>
        </motion.div>
      </div>
    </div>
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
