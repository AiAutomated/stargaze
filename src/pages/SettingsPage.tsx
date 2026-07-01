import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, BellOff, CheckCircle, Settings, Shield, ExternalLink } from 'lucide-react';
import meteorShowers from '../data/meteorShowers.json';

interface MeteorShower { id: string; name: string; peak: string; zhr: number; }
const showers = meteorShowers as MeteorShower[];

const ONE_SIGNAL_APP_ID = '7f4569af-5192-4e42-b6e0-648b4dde7c4b';

type SubStatus = 'unknown' | 'subscribed' | 'unsubscribed' | 'unsupported';

function useOneSignalStatus() {
  const [status, setStatus] = useState<SubStatus>('unknown');

  useEffect(() => {
    if (!('OneSignal' in window)) { setStatus('unsupported'); return; }
    const OS = (window as any).OneSignal;
    if (typeof OS.isPushNotificationsEnabled === 'function') {
      OS.isPushNotificationsEnabled().then((enabled: boolean) => {
        setStatus(enabled ? 'subscribed' : 'unsubscribed');
      }).catch(() => setStatus('unsupported'));
    } else {
      setStatus('unsupported');
    }
  }, []);

  const subscribe = async () => {
    const OS = (window as any).OneSignal;
    if (!OS) return;
    try {
      await OS.registerForPushNotifications();
      setStatus('subscribed');
    } catch {}
  };

  const unsubscribe = async () => {
    const OS = (window as any).OneSignal;
    if (!OS) return;
    try {
      await OS.setSubscription(false);
      setStatus('unsubscribed');
    } catch {}
  };

  return { status, subscribe, unsubscribe };
}

function useLocalPref<T>(key: string, defaultVal: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem('sg_pref_' + key); return s !== null ? JSON.parse(s) : defaultVal; } catch { return defaultVal; }
  });
  const set = (v: T) => { setVal(v); try { localStorage.setItem('sg_pref_' + key, JSON.stringify(v)); } catch {} };
  return [val, set];
}

const KP_OPTIONS = [
  { value: 3, label: 'Kp ≥ 3 — Unsettled', desc: 'Faint aurora at high latitudes', color: '#a3e635' },
  { value: 4, label: 'Kp ≥ 4 — Active',    desc: 'Visible at 55°+ N',             color: '#fbbf24' },
  { value: 5, label: 'Kp ≥ 5 — G1 Storm',  desc: 'Visible at 50°+ N',             color: '#f97316' },
  { value: 6, label: 'Kp ≥ 6 — G2 Storm',  desc: 'Visible at 45°+ N',             color: '#ef4444' },
  { value: 7, label: 'Kp ≥ 7 — G3+ Storm', desc: 'Visible from mid-latitudes',    color: '#dc2626' },
];

export default function SettingsPage() {
  const { status, subscribe, unsubscribe } = useOneSignalStatus();
  const [watchedShowers, setWatchedShowers] = useLocalPref<string[]>('watched_showers', showers.map(s => s.id));
  const [kpThreshold, setKpThreshold]       = useLocalPref<number>('kp_threshold', 5);
  const [auroraAlerts, setAuroraAlerts]     = useLocalPref<boolean>('aurora_alerts', true);
  const [saved, setSaved] = useState(false);

  const toggleShower = (id: string) => {
    setWatchedShowers(watchedShowers.includes(id)
      ? watchedShowers.filter(s => s !== id)
      : [...watchedShowers, id]
    );
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const isSubscribed = status === 'subscribed';

  return (
    <>
      <title>Notification Settings | Stargaze</title>
      <meta name="description" content="Manage your Stargaze push notification settings. Choose which meteor showers and aurora alerts to receive." />
    <div className="relative z-10 max-w-3xl mx-auto px-4 pt-28 pb-16">

      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
          style={{ background:'rgba(139,92,246,0.10)', border:'1px solid rgba(139,92,246,0.25)' }}>
          <Settings size={12} className="text-purple-400" />
          <span className="text-xs font-mono text-purple-300/80 tracking-wider">NOTIFICATION PREFERENCES</span>
        </div>
        <h1 className="text-3xl font-bold font-space mb-3">Settings</h1>
        <p className="text-white/45 leading-relaxed">
          Control which alerts you receive. Settings are saved locally in your browser.
        </p>
      </motion.div>

      {/* Push notification toggle */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        className="glass-card p-5 rounded-2xl mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSubscribed ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5 border border-white/10'}`}>
              {isSubscribed ? <Bell size={18} className="text-green-400" /> : <BellOff size={18} className="text-white/30" />}
            </div>
            <div>
              <p className="text-sm font-bold text-white/85">Push Notifications</p>
              <p className="text-[11px] text-white/40">
                {status === 'subscribed'   ? 'You\'ll receive alerts before meteor shower peaks' :
                 status === 'unsubscribed' ? 'Currently disabled — click to enable' :
                 status === 'unsupported'  ? 'Not supported in this browser' :
                 'Loading…'}
              </p>
            </div>
          </div>
          {status !== 'unsupported' && (
            <button
              onClick={isSubscribed ? unsubscribe : subscribe}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSubscribed ? 'bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25' : 'bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25'}`}>
              {isSubscribed ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>
        {status === 'unsupported' && (
          <div className="mt-3 px-3 py-2.5 rounded-xl" style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.20)' }}>
            <p className="text-[11px] text-yellow-300/70">
              Push notifications require a modern browser. Try Chrome, Firefox, or Edge. Safari on iOS may require you to "Add to Home Screen" first.
            </p>
          </div>
        )}
      </motion.div>

      {/* Aurora alerts */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
        className="glass-card p-5 rounded-2xl mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-white/85">Aurora / Kp Alerts</p>
            <p className="text-[11px] text-white/40">Get notified when geomagnetic activity spikes</p>
          </div>
          <button
            onClick={() => setAuroraAlerts(!auroraAlerts)}
            className={`relative w-11 h-6 rounded-full transition-all ${auroraAlerts ? 'bg-green-500/40' : 'bg-white/10'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${auroraAlerts ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        {auroraAlerts && (
          <div>
            <p className="text-[11px] text-white/40 mb-3">Alert when Kp reaches:</p>
            <div className="grid grid-cols-1 gap-2">
              {KP_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setKpThreshold(opt.value)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: kpThreshold === opt.value ? `${opt.color}12` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${kpThreshold === opt.value ? opt.color + '40' : 'transparent'}`,
                  }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: kpThreshold === opt.value ? opt.color : 'rgba(255,255,255,0.2)' }} />
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: kpThreshold === opt.value ? opt.color : 'rgba(255,255,255,0.65)' }}>{opt.label}</p>
                    <p className="text-[10px] text-white/30">{opt.desc}</p>
                  </div>
                  {kpThreshold === opt.value && <CheckCircle size={14} style={{ color: opt.color }} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Meteor shower selection */}
      <motion.div initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
        className="glass-card p-5 rounded-2xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-white/85">Meteor Shower Alerts</p>
            <p className="text-[11px] text-white/40">Receive alerts 3 days and 1 day before each peak</p>
          </div>
          <div className="text-[10px] font-mono text-white/30">{watchedShowers.length}/{showers.length} selected</div>
        </div>
        <div className="space-y-1.5">
          {showers.map(s => {
            const active = watchedShowers.includes(s.id);
            const daysUntil = Math.ceil((new Date(s.peak).getTime() - Date.now()) / 86400000);
            const isPast = daysUntil < 0;
            return (
              <button key={s.id} onClick={() => toggleShower(s.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'rgba(79,142,247,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(79,142,247,0.25)' : 'transparent'}`,
                  opacity: isPast ? 0.5 : 1,
                }}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-500/40 border border-blue-500/60' : 'border border-white/20'}`}>
                  {active && <CheckCircle size={10} className="text-blue-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/80">{s.name}</p>
                  <p className="text-[10px] text-white/30 font-mono">
                    {isPast ? 'Past' : `Peak in ${daysUntil}d`} · up to {s.zhr} ZHR
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${saved ? 'bg-green-500/20 text-green-400 border border-green-500/35' : 'bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25'}`}>
          {saved ? <span className="flex items-center justify-center gap-2"><CheckCircle size={14}/>Saved!</span> : 'Save Preferences'}
        </button>
      </div>

      {/* Privacy note */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.35 }}
        className="flex items-start gap-2 mt-6 px-3 py-3 rounded-xl"
        style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
        <Shield size={12} className="text-white/25 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-white/25 leading-relaxed">
          Preferences are stored only in your browser's localStorage — no account required. Push notifications use <a href="https://onesignal.com" target="_blank" rel="noopener noreferrer" className="text-blue-400/60 hover:text-blue-400">OneSignal <ExternalLink size={8} className="inline" /></a>. Stargaze does not collect personal data.
        </p>
      </motion.div>
    </div>
    </>
  );
}
