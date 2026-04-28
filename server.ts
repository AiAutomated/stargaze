import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Cache object for TLE data
  const cache: Record<string, { data: string, timestamp: number }> = {};
  const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

  // TLE Proxy Route with multi-source fallback
  app.get("/api/tle", async (req, res) => {
    const group = req.query.group || "active";
    const format = req.query.format || "tle";
    const catnr = req.query.catnr;
    
    const userAgents = [
      'curl/7.81.0',
      'Wget/1.21.2',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    ];

    const baseUrls = [
      "https://celestrak.org/NORAD/elements/gp.php",
      "https://celestrak.com/NORAD/elements/gp.php",
      "https://www.celestrak.com/NORAD/elements/gp.php",
      "https://tle.mountainway.space/gp.php",
      "https://amsat.org.ar/keps.txt",
      "https://db.satnogs.org/api/tles/" // Primary mirror
    ];

    // Map common groups to fallback static text files
    const groupMap: Record<string, string> = {
      'active': 'active.txt',
      'debris': 'debris.txt',
      'visual': 'visual.txt',
      'stations': 'stations.txt',
      'starlink': 'starlink.txt',
      'amateur': 'amateur.txt',
      'weather': 'weather.txt',
      'noaa': 'noaa.txt'
    };

    let lastError = null;

    // Retry logic with SatNOGS Fallback
    const fetchWithTimeout = async (url: string, options: any, timeout = 8000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e: any) {
        clearTimeout(id);
        throw e;
      }
    };

    // Try primary GP API sources
    for (const baseUrl of baseUrls) {
      const isSatNogs = baseUrl.includes('satnogs');
      const url = isSatNogs 
        ? baseUrl 
        : (catnr 
            ? `${baseUrl}?CATNR=${catnr}&FORMAT=${format}`
            : `${baseUrl}?GROUP=${group}&FORMAT=${format}`);

      // Check Cache
      if (cache[url] && (Date.now() - cache[url].timestamp < CACHE_TTL)) {
        return res.send(cache[url].data);
      }

      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

      try {
        console.log(`[Proxy] Attempting TLE fetch: ${url}`);
        const response = await fetchWithTimeout(url, {
          headers: {
            'User-Agent': randomUA,
            'Accept': isSatNogs ? 'application/json' : '*/*',
            'Connection': 'keep-alive'
          }
        });

        if (!response.ok) {
          console.warn(`[Proxy Warning] ${url} failed with status: ${response.status}`);
          continue;
        }

        let data = '';
        if (isSatNogs) {
          const json = await response.json() as any[];
          if (Array.isArray(json)) {
            data = json.map(s => `${s.tle0}\n${s.tle1}\n${s.tle2}`).join('\n');
          }
        } else {
          data = await response.text();
        }

        if (data && data.length > 50) {
          cache[url] = { data, timestamp: Date.now() };
          return res.send(data);
        }
      } catch (error: any) {
        console.warn(`[Proxy Warning] ${url} failed: ${error.message}`);
        lastError = error;
      }
    }

    // --- SECONDARY FALLBACK: SatNOGS (JSON to TLE reconstruction) ---
    if (group === 'active' || group === 'stations') {
      try {
        const satNogsUrl = 'https://db.satnogs.org/api/tles/';
        console.log(`[Proxy] Trying SatNOGS fallback: ${satNogsUrl}`);
        const response = await fetchWithTimeout(satNogsUrl, {
          headers: { 'User-Agent': 'Satellite-Tracker-App/1.0' }
        });
        
        if (response.ok) {
          const json = await response.json() as any[];
          if (Array.isArray(json) && json.length > 0) {
            const reconstructed = json.map(s => `${s.tle0}\n${s.tle1}\n${s.tle2}`).join('\n');
            return res.send(reconstructed);
          }
        }
      } catch (e) {
        console.warn(`[Proxy Warning] SatNOGS fallback failed`);
      }
    }

    // Try multiple fallback domains for static files
    const fallbackDomains = [
      "https://celestrak.org/NORAD/elements",
      "https://celestrak.com/NORAD/elements",
      "https://www.celestrak.com/NORAD/elements",
      "http://celestrak.org/NORAD/elements",
      "http://celestrak.com/NORAD/elements"
    ];

    if (!catnr && groupMap[group as string]) {
      for (const domain of fallbackDomains) {
        const fallbackUrl = `${domain}/${groupMap[group as string]}`;
        try {
          console.log(`[Proxy] Fetching Fallback TLE from: ${fallbackUrl}`);
          const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
          const response = await fetchWithTimeout(fallbackUrl, {
            headers: { 'User-Agent': randomUA }
          });
          if (response.ok) {
            const data = await response.text();
            if (data && data.length > 50) {
              cache[fallbackUrl] = { data, timestamp: Date.now() };
              return res.send(data);
            }
          }
        } catch (e) {
          console.warn(`[Proxy Warning] Fallback failed: ${fallbackUrl}`);
        }
      }

      // Final fallback to AMSAT or direct ISS API for active/ISS
      if (group === 'active' || catnr === '25544') {
        const emergencyUrls = [
          'https://www.amsat.org/amsat/ftp/keps/nodisplay/nasabare.txt',
          'https://live.ariss.org/tle/' // ISS specific 
        ];
        
        for (const emergencyUrl of emergencyUrls) {
          try {
             console.log(`[Proxy] Fetching Emergency Fallback TLE from: ${emergencyUrl}`);
             const response = await fetchWithTimeout(emergencyUrl, { 
               headers: { 'User-Agent': 'curl/7.81.0' } 
             });
             if (response.ok) {
               const data = await response.text();
               if (data && data.length > 50) return res.send(data);
             }
          } catch (e) {
             console.warn(`[Proxy Warning] Emergency fallback failed: ${emergencyUrl}`);
          }
        }
      }
    }

    console.error(`[Proxy Error] All sources failed: ${lastError?.message}`);
    res.status(502).json({ error: "Could not fetch satellite data from any source. Celestrak might be rate-limiting requests." });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
