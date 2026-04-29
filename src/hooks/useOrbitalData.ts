import { useState, useEffect, useCallback } from 'react';
import { parseTLE, SatelliteData } from '../utils/orbital';
import tleBackup from '../data/tleBackup.json';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  thumbnail: string | null;
}

export const useOrbitalData = () => {
  const [loading, setLoading] = useState(true);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [debris, setDebris] = useState<SatelliteData[]>([]);
  const [issData, setIssData] = useState<SatelliteData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const fetchTLE = async (url: string, timeout = 15000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
        clearTimeout(id);
        return response;
      } catch (e: any) {
        clearTimeout(id);
        throw e;
      }
    };

    try {
      const [issRes, satRes, debrisRes] = await Promise.allSettled([
        fetchTLE('/api/tle?catnr=25544'),
        fetchTLE('/api/tle?group=active'),
        fetchTLE('/api/tle?group=debris')
      ]);

      if (issRes.status === 'fulfilled' && issRes.value.ok) {
        const text = await issRes.value.text();
        const parsed = parseTLE(text);
        if (parsed.length > 0) setIssData(parsed[0]);
      } else {
        setIssData(tleBackup.find(s => s.name.includes('ISS')) as any);
      }

      if (satRes.status === 'fulfilled' && satRes.value.ok) {
        const satText = await satRes.value.text();
        if (satText && satText.length > 100) {
          setSatellites(parseTLE(satText));
        }
      } else if (satellites.length === 0) {
        setSatellites(tleBackup.slice(0, 200) as any);
      }

      if (debrisRes.status === 'fulfilled' && debrisRes.value.ok) {
        const debrisText = await debrisRes.value.text();
        if (debrisText && debrisText.length > 100) {
          setDebris(parseTLE(debrisText));
        }
      }
      
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Critical orbital data fetch error:', error);
      if (satellites.length === 0) {
        setSatellites(tleBackup as any);
        setFetchError('Limited satellite data available (offline mode).');
      }
    } finally {
      setLoading(false);
    }
  }, [satellites.length]);

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch('/api/feed');
      if (res.ok) {
        const data = await res.json();
        setNews(data);
      }
    } catch (e) {
      console.error('News fetch failed:', e);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchNews();
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData, fetchNews]);

  return { loading, satellites, debris, issData, news, newsLoading, lastUpdated, fetchError, refresh: fetchData };
};
