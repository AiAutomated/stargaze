# Stargaze.io — Setup Guide

A free, real-time meteor shower tracker and celestial observatory.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 + vite-plugin-cesium |
| 3D Globe | CesiumJS 1.121 |
| Orbital Mechanics | satellite.js |
| Styling | Tailwind CSS 3 |
| Animations | Framer Motion |
| Router | React Router 6 |

## Quick Start

```bash
# 1. Install dependencies (already done if node_modules exists)
npm install --legacy-peer-deps

# 2. Start dev server
npm run dev
# Open http://localhost:5173

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — live conditions, countdown, ISS tracker, NASA APOD |
| `/calendar` | 2026 Meteor Shower Calendar with filter + search |
| `/shower/:id` | Deep dive on individual showers |
| `/live` | Live sighting feed + submit reports |
| `/globe` | 3D CesiumJS globe — satellites, debris, meteors, UFOs |
| `/about` | About page + contact form |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |

## Live Data Sources (All Free)

| Data | API | Cost |
|------|-----|------|
| Weather | Open-Meteo | Free |
| ISS Position | WhereTheISS | Free |
| NASA APOD | NASA API (DEMO_KEY) | Free |
| Satellites/Debris | CelesTrak (TLE) | Free |
| Meteor showers | IMO/NASA (curated JSON) | Free |

## Optional: NASA API Key

The NASA APOD section works with `DEMO_KEY` but is rate-limited.
Get a free key at https://api.nasa.gov and set it in `.env`:

```
VITE_NASA_API_KEY=your_key_here
```

## Deployment

Works on any static host (Netlify, Vercel, Hostinger, etc.):

```bash
npm run build
# Upload dist/ folder
```

For Hostinger: upload the contents of `dist/` to `public_html/`.
Add this `.htaccess` for React Router to work:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## Project Structure

```
Stargaze/
├── index.html           # Entry HTML with SEO meta tags
├── vite.config.ts       # Vite + Cesium plugin config
├── tailwind.config.js   # Tailwind + space theme
├── src/
│   ├── main.tsx         # React entry point
│   ├── App.tsx          # All pages + routing (Home, Calendar, Live, Globe, About)
│   ├── index.css        # Global styles, glassmorphism, animations
│   ├── components/
│   │   └── CesiumGlobe.tsx  # 3D globe with 4 data layers
│   └── data/
│       └── meteorShowers.json  # 2026 shower data (IMO/NASA)
```
