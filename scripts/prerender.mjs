/**
 * Stargaze prerender script
 * Runs after `vite build`. Generates static, crawlable HTML for SEO-critical
 * routes (shower pages, calendar, and every other route) so search engines
 * see real content instead of an empty SPA shell. The React app takes over
 * on load (it replaces #root content on mount).
 *
 * Output: dist/<route>.html  (served extensionless via .htaccess rewrite)
 * Also regenerates dist/sitemap.xml with lastmod dates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://stargaze.io';

const showers = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/meteorShowers.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events2026.json'), 'utf8'));
const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtDate = (iso, opts = {}) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric', ...opts })
    .format(new Date(iso));

const fmtTime = (iso) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/* Minimal visible styling for the pre-hydration content (React replaces it on mount). */
const WRAP_STYLE = 'font-family:Inter,system-ui,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;color:#cbd5e1;background:#030014;line-height:1.65';
const H_STYLE = 'color:#f1f5f9';
const A_STYLE = 'color:#a5b4fc';

const navLinks = () => `
  <nav aria-label="Site">
    <a style="${A_STYLE}" href="/">Home</a> ·
    <a style="${A_STYLE}" href="/calendar">Meteor Shower Calendar</a> ·
    <a style="${A_STYLE}" href="/aurora">Aurora Forecast</a> ·
    <a style="${A_STYLE}" href="/planets">Planets Tonight</a> ·
    <a style="${A_STYLE}" href="/iss">ISS Tracker</a> ·
    <a style="${A_STYLE}" href="/gear">Telescope &amp; Gear Guide</a>
  </nav>`;

const showerLinkList = (excludeId = null) => `
  <h2 style="${H_STYLE}">All 2026 Meteor Showers</h2>
  <ul>
    ${showers.filter(s => s.id !== excludeId).map(s =>
      `<li><a style="${A_STYLE}" href="/shower/${s.id}">${esc(s.name)} — peaks ${fmtDate(s.peak, { year: undefined })}</a></li>`
    ).join('\n    ')}
  </ul>`;

function renderPage({ urlPath, title, description, jsonLd = [], body }) {
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${SITE}${urlPath}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${SITE}${urlPath}$2`);
  if (jsonLd.length) {
    const scripts = jsonLd.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
    html = html.replace('</head>', `${scripts}\n</head>`);
  }
  html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root"><div style="${WRAP_STYLE}">${body}${navLinks()}</div></div>`);

  const outFile = urlPath === '/' ? path.join(DIST, 'index.html') : path.join(DIST, `${urlPath.slice(1)}.html`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  return urlPath;
}

const breadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({
    '@type': 'ListItem', position: i + 1, name, item: `${SITE}${url}`,
  })),
});

const written = [];

/* ── Shower pages ─────────────────────────────────────────────────────── */
for (const s of showers) {
  const year = new Date(s.peak).getUTCFullYear();
  const peakDate = fmtDate(s.peak);
  const peakTime = fmtTime(s.peak);
  const title = `${s.name} Meteor Shower ${year}: Peak Date, Times & Viewing Guide | Stargaze`;
  const description = `The ${s.name} peak on ${peakDate} with up to ${s.zhr} meteors/hour. Active ${fmtDate(s.start)} – ${fmtDate(s.end)}. Peak times, where to look, and viewing tips.`;

  const faqs = [
    [`When do the ${s.name} peak in ${year}?`,
     `The ${s.name} peak on ${peakDate} at around ${peakTime} UTC. The shower is active from ${fmtDate(s.start)} to ${fmtDate(s.end)}.`],
    [`How many meteors can I see during the ${s.name}?`,
     `Under dark skies at peak you can expect up to ${s.zhr} meteors per hour (ZHR). Light pollution and moonlight reduce that figure.`],
    [`Where should I look to see the ${s.name}?`,
     `The radiant lies in the constellation ${s.constellation}, but meteors appear across the whole sky. ${s.viewingTips}`],
  ];

  const body = `
    <p><a style="${A_STYLE}" href="/">Stargaze</a> › <a style="${A_STYLE}" href="/calendar">Meteor Showers</a> › ${esc(s.name)}</p>
    <h1 style="${H_STYLE}">${esc(s.name)} Meteor Shower ${year}</h1>
    <p><strong>Peak:</strong> ${peakDate}, around ${peakTime} UTC<br>
       <strong>Active:</strong> ${fmtDate(s.start)} – ${fmtDate(s.end)}<br>
       <strong>Rate at peak:</strong> up to ${s.zhr} meteors/hour (ZHR)<br>
       <strong>Speed:</strong> ${s.speed} km/s ·
       <strong>Parent body:</strong> ${esc(s.parent)} ·
       <strong>Radiant:</strong> ${esc(s.constellation)}</p>
    <p>${esc(s.description)}</p>
    <h2 style="${H_STYLE}">How to watch</h2>
    <p>${esc(s.viewingTips)}</p>
    <h2 style="${H_STYLE}">Visibility</h2>
    <p>${esc(s.historicalVisibility)}</p>
    <h2 style="${H_STYLE}">History &amp; outbursts</h2>
    <p>${esc(s.historicalStorms)}</p>
    <h2 style="${H_STYLE}">FAQ</h2>
    ${faqs.map(([q, a]) => `<h3 style="${H_STYLE}">${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}
    ${showerLinkList(s.id)}`;

  written.push(renderPage({
    urlPath: `/shower/${s.id}`,
    title, description, body,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Event',
        name: `${s.name} Meteor Shower ${year}`,
        startDate: s.start, endDate: s.end,
        description,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: { '@type': 'Place', name: 'Night sky (worldwide)', address: { '@type': 'PostalAddress', addressCountry: 'Worldwide' } },
        organizer: { '@type': 'Organization', name: 'Stargaze', url: SITE },
        isAccessibleForFree: true,
      },
      {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({
          '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
      breadcrumb([['Home', '/'], ['Meteor Shower Calendar', '/calendar'], [`${s.name} ${year}`, `/shower/${s.id}`]]),
    ],
  }));
}

/* ── Calendar page ────────────────────────────────────────────────────── */
{
  const byMonth = {};
  for (const e of events) {
    const m = fmtDate(e.date, { day: undefined });
    (byMonth[m] ||= []).push(e);
  }
  const body = `
    <h1 style="${H_STYLE}">Meteor Shower Calendar 2026</h1>
    <p>Every major meteor shower and celestial event in 2026 — peak dates, expected rates, and what's worth staying up for.</p>
    <h2 style="${H_STYLE}">2026 Meteor Showers at a Glance</h2>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #334155;color:#f1f5f9">Shower</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #334155;color:#f1f5f9">Peak</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #334155;color:#f1f5f9">Rate (ZHR)</th>
      </tr></thead>
      <tbody>
        ${showers.map(s => `<tr>
          <td style="padding:6px;border-bottom:1px solid #1e293b"><a style="${A_STYLE}" href="/shower/${s.id}">${esc(s.name)}</a></td>
          <td style="padding:6px;border-bottom:1px solid #1e293b">${fmtDate(s.peak)}</td>
          <td style="padding:6px;border-bottom:1px solid #1e293b">${s.zhr}/hr</td>
        </tr>`).join('\n')}
      </tbody>
    </table>
    ${Object.entries(byMonth).map(([month, list]) => `
      <h2 style="${H_STYLE}">${esc(month)}</h2>
      <ul>${list.map(e => `<li><strong>${fmtDate(e.date, { year: undefined })}</strong> — ${esc(e.title)}: ${esc(e.description)}</li>`).join('\n')}</ul>`).join('\n')}`;

  written.push(renderPage({
    urlPath: '/calendar',
    title: 'Meteor Shower Calendar 2026 | Dates, Peak Times & Forecasts | Stargaze',
    description: 'Complete 2026 meteor shower calendar: Perseids, Geminids, Quadrantids and every major shower with peak dates, ZHR rates, moon phases, and viewing forecasts.',
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: '2026 Meteor Showers',
        itemListElement: showers.map((s, i) => ({
          '@type': 'ListItem', position: i + 1, name: `${s.name} — peaks ${fmtDate(s.peak)}`,
          url: `${SITE}/shower/${s.id}`,
        })),
      },
      breadcrumb([['Home', '/'], ['Meteor Shower Calendar', '/calendar']]),
    ],
  }));
}

/* ── Homepage (enrich the root index.html) ────────────────────────────── */
{
  const upcoming = [...showers].filter(s => new Date(s.end) >= new Date())
    .sort((a, b) => new Date(a.peak) - new Date(b.peak)).slice(0, 4);
  const body = `
    <h1 style="${H_STYLE}">Stargaze — Live Space Weather, Meteor Showers, Asteroids &amp; Aurora Tracker</h1>
    <p>Real-time aurora alerts, meteor shower forecasts, asteroid close approaches, government fireball data, ISS tracking, and NASA imagery — all free, all live.</p>
    <h2 style="${H_STYLE}">Next meteor showers</h2>
    <ul>
      ${(upcoming.length ? upcoming : showers.slice(0, 4)).map(s =>
        `<li><a style="${A_STYLE}" href="/shower/${s.id}">${esc(s.name)}</a> — peaks ${fmtDate(s.peak)} (up to ${s.zhr}/hr)</li>`).join('\n')}
    </ul>
    ${showerLinkList()}`;

  written.push(renderPage({
    urlPath: '/',
    title: 'Stargaze — Live Space Weather, Meteor Showers, Asteroids & Aurora Tracker',
    description: 'Free live space dashboard: tonight’s meteor showers, aurora forecast with real-time Kp index, asteroid close approaches, ISS tracking, and the 2026 celestial calendar.',
    body,
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'WebApplication',
      name: 'Stargaze', url: SITE,
      description: 'Live meteor shower tracker, aurora forecast, asteroid close approaches, ISS tracker, and 2026 celestial event calendar.',
      applicationCategory: 'EducationApplication', operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    }],
  }));
}

/* ── Remaining routes: unique meta + short crawlable intro ────────────── */
const staticRoutes = [
  ['/aurora', 'Aurora Forecast & Solar Weather | Real-Time Kp Index | Stargaze',
   'Live aurora forecast with real-time Kp index, NOAA aurora oval maps for both hemispheres, solar flare and CME activity, and viewing latitude guide.',
   'Aurora Forecast & Solar Weather', 'Live Kp index, NOAA OVATION aurora ovals updated every 5 minutes, solar flares, and coronal mass ejection alerts.'],
  ['/planets', 'Planet Visibility Tonight | Planets in the Night Sky | Stargaze',
   'Which planets are visible tonight? Real-time positions, rise and set times, and viewing guidance for Mercury, Venus, Mars, Jupiter, Saturn and more.',
   'Planets Visible Tonight', 'Real-time planet positions computed from Keplerian orbital elements — see which planets are up right now and where to find them.'],
  ['/iss', 'ISS Tracker | Live International Space Station Position | Stargaze',
   'Track the International Space Station live: current position, altitude, speed, ground track map, and upcoming visible passes over your location.',
   'Live ISS Tracker', 'The ISS orbits at ~420 km altitude travelling 27,500+ km/h. Track its live position and find the next visible pass over your location.'],
  ['/news', 'Space News | Latest Space & Astronomy Headlines | Stargaze',
   'The latest space and astronomy news: launches, discoveries, missions, and night-sky events, updated continuously.',
   'Space News', 'Latest launches, discoveries and mission updates from across the space industry.'],
  ['/gear', 'Best Telescopes & Astronomy Gear 2026 | UK & US Buying Guide | Stargaze',
   'Hand-picked telescopes, binoculars and stargazing gear for every level and budget — with UK and US buying options and honest recommendations.',
   'Telescopes & Stargazing Gear Guide 2026', 'From first binoculars to serious astrophotography rigs — 17 hand-picked products with UK and US buying links.'],
  ['/sky', "Tonight's Night Sky | Live Star Map & Meteor Radiant Finder | Stargaze",
   'Interactive live star map: see constellations, planets, and active meteor shower radiants for your location tonight.',
   "Tonight's Night Sky", 'A live star map showing constellations, planets and active meteor shower radiants for your location.'],
  ['/live', 'Live Meteor Sighting Reports | Submit Your Fireball & Meteor Sightings | Stargaze',
   'Live worldwide meteor and fireball sighting reports. See what others are spotting right now and submit your own sightings.',
   'Live Meteor Sightings', 'Real-time fireball and meteor reports from observers worldwide.'],
  ['/globe', '3D Solar System & Live Satellite Tracker | Stargaze',
   'Interactive 3D globe with live satellite positions, orbital debris, meteor shower radiants, and real-time TLE orbital data.',
   '3D Globe & Satellite Tracker', 'Live satellites, debris, and meteor radiants on an interactive 3D globe powered by real orbital data.'],
  ['/about', 'About Stargaze | Free Meteor Shower Tracker Built for Stargazers',
   'Stargaze is a free, real-time meteor shower tracker and celestial event guide, built for stargazers of all levels. No paywalls, no ads on live data.',
   'About Stargaze', 'Free, real-time meteor shower tracking and celestial event calendar. Open to all stargazers.'],
];

for (const [urlPath, title, description, h1, intro] of staticRoutes) {
  written.push(renderPage({
    urlPath, title, description,
    jsonLd: [breadcrumb([['Home', '/'], [h1, urlPath]])],
    body: `<h1 style="${H_STYLE}">${esc(h1)}</h1><p>${esc(intro)}</p>${showerLinkList()}`,
  }));
}

/* ── Sitemap ──────────────────────────────────────────────────────────── */
{
  const today = new Date().toISOString().slice(0, 10);
  const priorities = { '/': '1.0', '/calendar': '0.9', '/aurora': '0.9', '/gear': '0.8' };
  const urls = written.map(p => `  <url>
    <loc>${SITE}${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p === '/' || p === '/aurora' || p === '/news' ? 'daily' : 'weekly'}</changefreq>
    <priority>${priorities[p] || (p.startsWith('/shower/') ? '0.8' : '0.6')}</priority>
  </url>`).join('\n');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

console.log(`Prerendered ${written.length} routes:\n${written.map(p => `  ${p}`).join('\n')}\nSitemap written with ${written.length} URLs.`);
