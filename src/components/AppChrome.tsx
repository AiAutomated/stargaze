import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/** Skip to main content — accessibility */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-600 focus:text-white focus:text-sm focus:font-semibold"
    >
      Skip to main content
    </a>
  );
}

/** Offline / online status banner */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2 px-4 text-xs font-mono"
          style={{
            background: 'linear-gradient(90deg, rgba(127,29,29,0.95), rgba(153,27,27,0.95))',
            borderBottom: '1px solid rgba(248,113,113,0.35)',
          }}
          role="status"
          aria-live="polite"
        >
          <WifiOff size={13} className="text-red-200" />
          <span className="text-red-100">You're offline — showing cached pages. Live space data will resume when you're back.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** PWA install prompt (Chromium) */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('sg_install_dismissed')) return;
    // Already installed?
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setTimeout(() => setVisible(true), 8000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    if (choice?.outcome === 'dismissed') {
      localStorage.setItem('sg_install_dismissed', '1');
    }
  };

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('sg_install_dismissed', '1');
  };

  return (
    <AnimatePresence>
      {visible && deferred && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 p-4 rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, rgba(18,12,48,0.98), rgba(6,3,20,0.98))',
            border: '1px solid rgba(79,142,247,0.3)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="logo-mark flex-shrink-0" style={{ width: 36, height: 36 }}>
              <Download size={16} className="text-white relative z-10" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold font-space text-white/90">Install Stargaze</p>
              <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">
                Add to your home screen for one-tap access to live space weather and shower alerts.
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={install} className="btn-primary text-[11px] py-2 px-3">
                  <Download size={12} /> Install
                </button>
                <button onClick={dismiss} className="btn-secondary text-[11px] py-2 px-3">
                  Not now
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="text-white/30 hover:text-white/70" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Floating scroll-to-top */
export function ScrollTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-4 z-40 w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors"
          style={{
            background: 'rgba(79,142,247,0.25)',
            border: '1px solid rgba(79,142,247,0.4)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(79,142,247,0.2)',
          }}
          aria-label="Scroll to top"
        >
          <ArrowUp size={16} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Register service worker once */
export function useServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Only in production builds / non-localhost optional — allow all for Hostinger
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }, []);
}
