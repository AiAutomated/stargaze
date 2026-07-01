import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useSpaceData, NewsArticle } from '../hooks/useSpaceData';

const SOURCES: Record<string, string> = {
  'NASA':            '#0b3d91',
  'SpaceNews':       '#1a56db',
  'Spaceflight Now': '#7c3aed',
  'Ars Technica':    '#e8562a',
  'The Verge':       '#f43f5e',
  'NASASpaceFlight': '#0891b2',
  'Space.com':       '#2563eb',
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NewsPage() {
  const { news, loading } = useSpaceData();
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? news : news.slice(0, 6);

  return (
    <>
      <title>Space News | Latest Space &amp; Astronomy Headlines | Stargaze</title>
      <meta name="description" content="Latest space news, rocket launches, astronomy discoveries, and NASA mission updates. Curated from top space journalism sources." />
      <link rel="canonical" href="https://stargaze.io/news" />
    <div className="relative z-10 max-w-7xl mx-auto px-4 pt-28 pb-16">

      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
          style={{ background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.25)' }}>
          <span className="live-dot" />
          <span className="text-xs font-mono text-blue-300/80 tracking-wider">LIVE FEED · UPDATES EVERY 15 MIN</span>
        </div>
        <h1 className="hero-title hero-gradient-text mb-4">Space News</h1>
        <p className="text-white/50 max-w-xl mx-auto leading-relaxed">
          The latest from NASA, ESA, SpaceX, and the astronomy community — curated from leading space journalism.
        </p>
      </motion.div>

      {loading && news.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
              <div className="h-44 shimmer" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-white/8 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-full" />
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-20">
          <RefreshCw size={28} className="text-blue-400/30 mx-auto mb-3" />
          <p className="text-white/40">Unable to load news. Check your connection.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {displayed.map((article: NewsArticle, i) => {
              const srcColor = Object.entries(SOURCES).find(([k]) => article.news_site.includes(k))?.[1] ?? '#4f8ef7';
              return (
                <motion.a key={article.id}
                  href={article.url} target="_blank" rel="noopener noreferrer"
                  initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: Math.min(i * 0.07, 0.5) }}
                  className="glass-card rounded-2xl overflow-hidden group flex flex-col hover:ring-1 hover:ring-blue-500/30 transition-all">
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden bg-gray-900/60 flex-shrink-0">
                    {article.image_url ? (
                      <img src={article.image_url} alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">🚀</div>
                    )}
                    {/* Source badge */}
                    <div className="absolute bottom-2 left-2 text-[9px] px-2 py-0.5 rounded font-mono font-bold text-white"
                      style={{ background: srcColor + 'cc' }}>
                      {article.news_site}
                    </div>
                    {/* Time */}
                    <div className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full font-mono"
                      style={{ background:'rgba(0,0,0,0.6)', color:'rgba(255,255,255,0.6)' }}>
                      {timeAgo(article.published_at)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h2 className="text-sm font-bold leading-snug mb-2 group-hover:text-blue-300 transition-colors line-clamp-3">
                      {article.title}
                    </h2>
                    <p className="text-[11px] text-white/40 leading-relaxed line-clamp-3 flex-1">
                      {article.summary}
                    </p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-blue-400/60 group-hover:text-blue-400 transition-colors">
                      Read more <ExternalLink size={9} />
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>

          {!showAll && news.length > 6 && (
            <div className="text-center">
              <button onClick={() => setShowAll(true)}
                className="btn-secondary text-sm">
                Show {news.length - 6} more articles
              </button>
            </div>
          )}
        </>
      )}

      {/* Source attribution */}
      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-[10px] text-white/25 font-mono">
          Powered by SpaceFlight News API · Updates every 15 minutes
        </p>
        <a href="https://api.spaceflightnewsapi.net/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-blue-400/50 hover:text-blue-400 transition-colors font-mono">
          SpaceflightNewsAPI <ExternalLink size={8} />
        </a>
      </div>
    </div>
    </>
  );
}
