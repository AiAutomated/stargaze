// ─── Stargaze App + Router ────────────────────────────────────────────────────
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#4a8fff",
  "showNames": true,
  "density": "Normal"
}/*EDITMODE-END*/;

function useHashRoute() {
  const getPage = () => {
    const h = window.location.hash.replace('#', '') || '/';
    return h;
  };
  const [page, setPage] = useState(getPage);
  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const navigate = (to) => { window.location.hash = to; window.scrollTo({ top: 0 }); };
  return { page, navigate };
}

function App() {
  const { page, navigate } = useHashRoute();
  const [tweaks, setTweaks] = useState(() => {
    try { return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem('sg_tweaks') || '{}') }; }
    catch { return TWEAK_DEFAULTS; }
  });
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sg_tweaks', JSON.stringify(tweaks));
    document.documentElement.style.setProperty('--sg-accent', tweaks.accent);
  }, [tweaks]);

  // Tweaks host protocol
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
      if (e.data?.type === '__edit_mode_set_keys' && e.data.edits) {
        setTweaks(t => ({ ...t, ...e.data.edits }));
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const persistTweak = (edits) => {
    setTweaks(t => ({ ...t, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  };

  // Parse shower id from page like /shower/perseids
  const showerMatch = page.match(/^\/shower\/(.+)$/);
  const showerId = showerMatch ? showerMatch[1] : null;

  const renderPage = () => {
    if (showerId)        return <ShowerPage id={showerId} navigate={navigate} />;
    if (page === '/calendar') return <CalendarPage navigate={navigate} />;
    if (page === '/live')     return <LivePage />;
    if (page === '/globe')    return <GlobePage navigate={navigate} />;
    if (page === '/about')    return <AboutPage navigate={navigate} />;
    return <HomePage navigate={navigate} tweaks={tweaks} />;
  };

  return (
    <div>
      <Nav page={page} navigate={navigate} />
      <main>{renderPage()}</main>
      <Footer navigate={navigate} />
      {tweaksOpen && <TweaksPanel tweaks={tweaks} setTweaks={persistTweak} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
