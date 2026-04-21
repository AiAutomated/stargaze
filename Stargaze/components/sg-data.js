// ─── Stargaze Data & Utilities ───────────────────────────────────────────────

window.SG = window.SG || {};

SG.SHOWERS = [
  { id: 'quadrantids', name: 'Quadrantids', peak: '2026-01-04T06:00:00Z', start: '2025-12-28', end: '2026-01-12', zhr: 120, speed: 41, parent: 'Asteroid 2003 EH1', constellation: 'Boötes', description: 'One of the strongest annual showers, producing over 100 meteors per hour at peak. The peak window is narrow — just 6–12 hours. Known for bright, long-duration fireballs.' },
  { id: 'lyrids', name: 'Lyrids', peak: '2026-04-22T22:00:00Z', start: '2026-04-14', end: '2026-04-30', zhr: 18, speed: 49, parent: 'Comet C/1861 G1 (Thatcher)', constellation: 'Lyra', description: 'One of the oldest known showers, observed for over 2,700 years. Swift, bright meteors that occasionally leave persistent glowing trains. Sporadic outbursts make it unpredictable.' },
  { id: 'eta-aquariids', name: 'Eta Aquariids', peak: '2026-05-06T08:00:00Z', start: '2026-04-19', end: '2026-05-28', zhr: 50, speed: 66, parent: 'Comet 1P/Halley', constellation: 'Aquarius', description: 'Debris from Halley\'s Comet. Known for very fast meteors and long, glowing trains that can persist for several minutes. Particularly favored in the Southern Hemisphere.' },
  { id: 'perseids', name: 'Perseids', peak: '2026-08-12T08:00:00Z', start: '2026-07-17', end: '2026-08-24', zhr: 100, speed: 59, parent: 'Comet 109P/Swift-Tuttle', constellation: 'Perseus', description: 'The most popular meteor shower of the year, peaking in warm August nights. Reliable rates of 50–100 meteors per hour with frequent bright fireballs. Excellent for casual observers.' },
  { id: 'orionids', name: 'Orionids', peak: '2026-10-21T10:00:00Z', start: '2026-10-02', end: '2026-11-07', zhr: 20, speed: 66, parent: 'Comet 1P/Halley', constellation: 'Orion', description: 'A second gift from Halley\'s Comet. Fast meteors with persistent trains, radiating near the bright star Betelgeuse. Often produces bright fireballs during outburst years.' },
  { id: 'leonids', name: 'Leonids', peak: '2026-11-17T20:00:00Z', start: '2026-11-06', end: '2026-11-30', zhr: 15, speed: 71, parent: 'Comet 55P/Tempel-Tuttle', constellation: 'Leo', description: 'The fastest known meteor shower at 71 km/s. Historically produced legendary meteor storms (1833, 1966). Modern years are quieter but fireballs are spectacular.' },
  { id: 'geminids', name: 'Geminids', peak: '2026-12-14T02:00:00Z', start: '2026-12-04', end: '2026-12-20', zhr: 150, speed: 35, parent: 'Asteroid 3200 Phaethon', constellation: 'Gemini', description: 'The strongest shower of the year with up to 150 meteors per hour. Uniquely sourced from an asteroid. Slower meteors produce vivid colors — yellow, blue, and white streaks.' },
  { id: 'ursids', name: 'Ursids', peak: '2026-12-22T10:00:00Z', start: '2026-12-17', end: '2026-12-26', zhr: 10, speed: 33, parent: 'Comet 8P/Tuttle', constellation: 'Ursa Minor', description: 'A modest but reliable shower peaking near the winter solstice. Occasional outbursts can push rates above 50 ZHR. Best viewed from the Northern Hemisphere near Polaris.' },
];

SG.EVENTS = [
  { id: 'e1',  title: 'Quadrantids Peak',        date: '2026-01-04', type: 'Meteor Shower', visibility: 'Excellent',   description: 'Up to 120 meteors/hr. Narrow 6-12hr peak window.' },
  { id: 'e2',  title: 'Full Moon',                date: '2026-01-14', type: 'Moon Phase',    visibility: 'Excellent',   description: 'Wolf Moon. Full illumination at 09:11 UTC.' },
  { id: 'e3',  title: 'Total Lunar Eclipse',      date: '2026-03-03', type: 'Eclipse',       visibility: 'Excellent',   description: 'Visible from Americas, Europe, and Africa. Totality lasts ~65 minutes.' },
  { id: 'e4',  title: 'Lyrids Peak',              date: '2026-04-22', type: 'Meteor Shower', visibility: 'Good',        description: 'Radiant in Lyra near Vega. Best after midnight.' },
  { id: 'e5',  title: 'Eta Aquariids Peak',       date: '2026-05-06', type: 'Meteor Shower', visibility: 'Excellent',   description: 'Halley\'s Comet debris. Up to 50 ZHR, Southern Hemisphere favored.' },
  { id: 'e6',  title: 'Mercury at Greatest Elongation', date: '2026-05-28', type: 'Planetary', visibility: 'Good',     description: 'Mercury visible low on the western horizon after sunset.' },
  { id: 'e7',  title: 'Total Solar Eclipse',      date: '2026-08-12', type: 'Eclipse',       visibility: 'Excellent',   description: 'Path of totality crosses Greenland, Iceland, and Spain. Duration up to 2m 18s.' },
  { id: 'e8',  title: 'Perseids Peak',            date: '2026-08-12', type: 'Meteor Shower', visibility: 'Excellent',   description: 'Most-watched shower of the year. Up to 100 ZHR from Swift-Tuttle debris.' },
  { id: 'e9',  title: 'Jupiter at Opposition',    date: '2026-09-21', type: 'Planetary',     visibility: 'Excellent',   description: 'Jupiter rises at sunset and is visible all night. Closest approach of 2026.' },
  { id: 'e10', title: 'Orionids Peak',            date: '2026-10-21', type: 'Meteor Shower', visibility: 'Good',        description: 'Fast meteors from Halley\'s Comet. Radiant near Betelgeuse in Orion.' },
  { id: 'e11', title: 'Partial Lunar Eclipse',    date: '2026-10-29', type: 'Eclipse',       visibility: 'Good',        description: 'Visible from Europe, Africa, Asia, and Australia. ~90% of Moon in umbra.' },
  { id: 'e12', title: 'Leonids Peak',             date: '2026-11-17', type: 'Meteor Shower', visibility: 'Fair',        description: 'Fastest shower at 71 km/s. Moderate rates, spectacular fireballs.' },
  { id: 'e13', title: 'Geminids Peak',            date: '2026-12-14', type: 'Meteor Shower', visibility: 'Excellent',   description: 'Strongest shower of the year — 150 ZHR. Colorful, slow meteors from asteroid 3200 Phaethon.' },
  { id: 'e14', title: 'Winter Solstice',          date: '2026-12-21', type: 'Seasonal',      visibility: 'N/A',         description: 'Longest night of the year in the Northern Hemisphere.' },
  { id: 'e15', title: 'Ursids Peak',              date: '2026-12-22', type: 'Meteor Shower', visibility: 'Fair',        description: 'Modest shower near Polaris. Occasional outbursts.' },
];

// ─── Utility Functions ────────────────────────────────────────────────────────
SG.getShowerStatus = function(shower) {
  const now = new Date();
  const start = new Date(shower.start);
  const end = new Date(shower.end);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'past';
};

SG.getDaysUntil = function(dateStr) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
};

SG.getNextShower = function() {
  const now = new Date();
  return SG.SHOWERS
    .filter(s => new Date(s.peak) > now)
    .sort((a, b) => new Date(a.peak) - new Date(b.peak))[0] || SG.SHOWERS[SG.SHOWERS.length - 1];
};

SG.formatDate = function(dateStr, opts) {
  return new Date(dateStr).toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
};

SG.formatShortDate = function(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

SG.formatCountdown = function(ms) {
  if (ms <= 0) return { days: '00', hours: '00', mins: '00', secs: '00' };
  const s = Math.floor(ms / 1000);
  return {
    days:  String(Math.floor(s / 86400)).padStart(2, '0'),
    hours: String(Math.floor((s % 86400) / 3600)).padStart(2, '0'),
    mins:  String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    secs:  String(s % 60).padStart(2, '0'),
  };
};

SG.getMoonPhase = function() {
  const known = new Date('2000-01-06T18:14:00Z');
  const diff = (Date.now() - known.getTime()) / 86400000;
  const cycle = 29.53058770576;
  const pos = ((diff % cycle) + cycle) % cycle;
  const illum = Math.round((1 - Math.abs(pos - cycle / 2) / (cycle / 2)) * 100);
  const phases = [
    [1.85, 'New Moon', '●'],
    [7.38, 'Waxing Crescent', '◑'],
    [9.22, 'First Quarter', '◑'],
    [14.77,'Waxing Gibbous', '◕'],
    [16.61,'Full Moon', '○'],
    [22.15,'Waning Gibbous', '◔'],
    [23.99,'Last Quarter', '◔'],
    [Infinity,'Waning Crescent', '◑'],
  ];
  const [,phase, symbol] = phases.find(([limit]) => pos < limit);
  return { phase, illumination: illum, symbol };
};

SG.EVENT_COLORS = {
  'Meteor Shower': '#4a8fff',
  'Eclipse':       '#c8993a',
  'Moon Phase':    '#a78bfa',
  'Planetary':     '#22d3ee',
  'Seasonal':      '#4ade80',
};

SG.ZHR_COLOR = function(zhr) {
  if (zhr >= 100) return '#4a8fff';
  if (zhr >= 50)  return '#c8993a';
  if (zhr >= 20)  return '#a78bfa';
  return 'rgba(255,255,255,0.4)';
};
