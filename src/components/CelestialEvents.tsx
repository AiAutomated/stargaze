import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Moon, Sparkles, Eye, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import eventsData from '../data/events2026.json';

interface CelestialEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  location: string;
  type: string;
  visibility: string;
}

const events = eventsData as CelestialEvent[];

const TYPE_META: Record<string, { icon: typeof Moon; color: string }> = {
  'Meteor Shower': { icon: Sparkles, color: '#c084fc' },
  'Moon Phase': { icon: Moon, color: '#fde047' },
  Eclipse: { icon: Eye, color: '#f97316' },
  'Lunar Eclipse': { icon: Eye, color: '#f97316' },
  'Solar Eclipse': { icon: Eye, color: '#fb923c' },
  Conjunction: { icon: Sparkles, color: '#60a5fa' },
  Opposition: { icon: Eye, color: '#34d399' },
  default: { icon: Calendar, color: '#93c5fd' },
};

function metaFor(type: string) {
  if (TYPE_META[type]) return TYPE_META[type];
  const key = Object.keys(TYPE_META).find(k => type.toLowerCase().includes(k.toLowerCase()));
  return TYPE_META[key ?? 'default'];
}

function formatEventDate(iso: string) {
  return new Date(iso + (iso.length <= 10 ? 'T12:00:00Z' : '')).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

/** Compact strip of upcoming events for Home */
export function UpcomingEventsStrip({ limit = 5 }: { limit?: number }) {
  const upcoming = useMemo(() => {
    const now = Date.now() - 86400000; // include yesterday
    return events
      .filter(e => new Date(e.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
  }, [limit]);

  if (upcoming.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="section-icon bg-cyan-500/12 border border-cyan-500/22">
            <Calendar size={12} className="text-cyan-400" />
          </div>
          <h2 className="text-lg font-bold font-space">Upcoming Celestial Events</h2>
        </div>
        <Link to="/calendar" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
          Full calendar <ChevronRight size={11} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {upcoming.map((e, i) => {
          const m = metaFor(e.type);
          const Icon = m.icon;
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-3.5 rounded-2xl min-w-[200px] max-w-[240px] snap-start flex-shrink-0"
              style={{ borderTop: `2px solid ${m.color}40` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} style={{ color: m.color }} />
                <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: m.color }}>{e.type}</span>
              </div>
              <p className="text-xs font-bold text-white/85 leading-snug mb-1 line-clamp-2">{e.title}</p>
              <p className="text-[10px] text-white/35 font-mono">{formatEventDate(e.date)}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Full events section for Calendar page */
export function CelestialEventsPanel() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'moon' | 'other'>('upcoming');

  const filtered = useMemo(() => {
    const now = Date.now() - 86400000;
    let list = [...events];
    if (filter === 'upcoming') list = list.filter(e => new Date(e.date).getTime() >= now);
    if (filter === 'moon') list = list.filter(e => e.type.toLowerCase().includes('moon') || e.type.toLowerCase().includes('eclipse'));
    if (filter === 'other') list = list.filter(e => !e.type.toLowerCase().includes('meteor') && !e.type.toLowerCase().includes('moon'));
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filter]);

  const filters = [
    { id: 'upcoming' as const, label: 'Upcoming' },
    { id: 'all' as const, label: 'All 2026' },
    { id: 'moon' as const, label: 'Moon & Eclipses' },
    { id: 'other' as const, label: 'Other' },
  ];

  return (
    <div className="mt-12 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <p className="section-label text-cyan-400 mb-1">Beyond Showers</p>
          <h2 className="text-2xl font-bold font-space">2026 Celestial Events</h2>
          <p className="text-xs text-white/40 mt-1">Moons, eclipses, and notable sky events alongside the meteor calendar</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-space font-semibold transition-all ${
                filter === f.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-white/40 hover:text-white/70 border border-transparent hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, 18).map((e, i) => {
          const m = metaFor(e.type);
          const Icon = m.icon;
          const isPast = new Date(e.date).getTime() < Date.now() - 86400000;
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
              className="glass-card p-4 rounded-2xl"
              style={{ opacity: isPast ? 0.55 : 1, borderLeft: `2px solid ${m.color}50` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1" style={{ color: m.color }}>
                  <Icon size={11} /> {e.type}
                </span>
                <span className="text-[10px] font-mono text-white/30">{formatEventDate(e.date)}</span>
              </div>
              <h3 className="text-sm font-bold font-space text-white/90 mb-1.5">{e.title}</h3>
              <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2">{e.description}</p>
              {e.visibility && e.visibility !== 'N/A' && (
                <p className="text-[9px] font-mono text-white/25 mt-2">Visibility: {e.visibility}</p>
              )}
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-10 text-white/30 text-sm">No events in this filter</div>
      )}
    </div>
  );
}
