import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { parseStringPromise } from "xml2js";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Cache object for TLE and Feed data
  const cache: Record<string, { data: any, timestamp: number }> = {};
  const CACHE_TTL = 1000 * 60 * 15; // 15 minutes
  const FEED_CACHE_TTL = 1000 * 60 * 60; // 1 hour for news

  // Feed Proxy Route
  app.get("/api/feed", async (req, res) => {
    const feedUrl = "https://www.nasa.gov/news-release/feed/";
    
    if (cache[feedUrl] && (Date.now() - cache[feedUrl].timestamp < FEED_CACHE_TTL)) {
      return res.json(cache[feedUrl].data);
    }

    try {
      console.log(`[Feed] Attempting to fetch: ${feedUrl}`);
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Vite-Dev-Server)' }
      });
      if (!response.ok) {
        console.warn(`[Proxy Warning] ${feedUrl} failed with status: ${response.status}`);
        throw new Error(`Failed to fetch feed: ${response.status}`);
      }
      const xml = await response.text();
      const result = await parseStringPromise(xml);
      
      const items = (result.rss.channel[0].item || []).map((item: any) => ({
        title: item.title ? item.title[0] : 'Untitled',
        link: item.link ? item.link[0] : '#',
        pubDate: item.pubDate ? item.pubDate[0] : new Date().toISOString(),
        description: item.description ? item.description[0].replace(/<[^>]*>?/gm, '').substring(0, 200) + '...' : '',
        thumbnail: item["media:content"] ? item["media:content"][0].$.url : null
      }));

      cache[feedUrl] = { data: items, timestamp: Date.now() };
      res.json(items);
    } catch (error: any) {
      console.error("[Feed Error]", error.message);
      // Return empty array instead of 500 to keep client happy
      res.json([]);
    }
  });

  // TLE Proxy Route with multi-source fallback
  app.get("/api/tle", async (req, res) => {
    const group = req.query.group || "active";
    const format = req.query.format || "tle";
    const catnr = req.query.catnr;
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];

    const baseUrls = [
      "https://celestrak.org/NORAD/elements/gp.php",
      "https://raw.githubusercontent.com/Ivan-Vanish/TLE-Mirror/main/active.txt",
      "https://db.satnogs.org/api/tles/",
      "https://tle.mountainway.space/gp.php",
      "https://amsat.org.ar/keps.txt",
      "https://www.amsat.org/amsat/ftp/keps/nodisplay/nasabare.txt"
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
    const fetchWithTimeout = async (url: string, options: any, timeout = 10000) => {
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

    // Try primary TLE sources
    for (const baseUrl of baseUrls) {
      const isSatNogs = baseUrl.includes('satnogs');
      const isTxt = baseUrl.endsWith('.txt');
      const isMirror = baseUrl.includes('githubusercontent');
      
      let url: string;
      if (isSatNogs) {
        // SatNOGS DB API structure: https://db.satnogs.org/api/tles/?norad_cat_id=25544
        const params = new URLSearchParams();
        if (catnr) {
          params.append('norad_cat_id', catnr.toString());
        }
        params.append('items', '100'); // Increase items returned
        url = `${baseUrl}?${params.toString()}`;
      } else if (isTxt) {
        // Mirrored or static files
        if (isMirror && group !== 'active') {
          // If mirror and not active, try to swap the filename if possible
          const mirrorFile = groupMap[group as string] || 'active.txt';
          url = baseUrl.replace('active.txt', mirrorFile);
        } else {
          url = baseUrl;
        }
      } else {
        const params = new URLSearchParams();
        if (catnr) {
          params.append('CATNR', catnr.toString());
        } else {
          params.append('GROUP', (group as string) || 'active');
        }
        params.append('FORMAT', 'TLE');
        url = `${baseUrl}?${params.toString()}`;
      }

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
            'Accept': isSatNogs ? 'application/json' : 'text/plain, */*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) {
          console.warn(`[Proxy Warning] ${url} failed with status: ${response.status}`);
          continue;
        }

        let data = '';
        if (isSatNogs || (response.headers.get('content-type')?.includes('application/json'))) {
          const json = await response.json() as any;
          const resultArray = Array.isArray(json) ? json : json.results || [];
          if (Array.isArray(resultArray) && resultArray.length > 0) {
            data = resultArray.map((s: any) => `${s.tle0 || s.name || 'UNKNOWN'}\n${s.tle1}\n${s.tle2}`).join('\n');
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

    // --- SECONDARY FALLBACK: SatNOGS Reconstruction ---
    if (group === 'active' || group === 'stations') {
      try {
        const satNogsUrl = 'https://db.satnogs.org/api/tles/?format=json';
        const response = await fetchWithTimeout(satNogsUrl, {
          headers: { 'User-Agent': userAgents[0], 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const json = await response.json() as any[];
          if (Array.isArray(json) && json.length > 0) {
            return res.send(json.map(s => `${s.tle0}\n${s.tle1}\n${s.tle2}`).join('\n'));
          }
        }
      } catch (e) {}
    }

    // Try alternate mirrors
    const emergencyUrls = [
      'https://raw.githubusercontent.com/Ivan-Vanish/TLE-Mirror/main/active.txt',
      'https://www.amsat.org/amsat/ftp/keps/nodisplay/nasabare.txt',
      'https://live.ariss.org/tle/' 
    ];

    for (const emergencyUrl of emergencyUrls) {
      if (group !== 'active' && !emergencyUrl.includes('active')) continue;
      try {
        const response = await fetchWithTimeout(emergencyUrl, { headers: { 'User-Agent': userAgents[0] } });
        if (response.ok) {
          const data = await response.text();
          if (data && data.length > 50) return res.send(data);
        }
      } catch (e) {}
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
