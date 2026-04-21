// ─── Stargaze Pages ───────────────────────────────────────────────────────────
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ navigate, tweaks }) {
  const next = SG.getNextShower();
  const upcoming = SG.SHOWERS.filter(s => SG.getDaysUntil(s.peak) > 0).slice(0, 6);

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ position: 'relative', height: '100vh', minHeight: 600, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <ConstellationCanvas showNames={tweaks.showNames} />
        {/* vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 100%, rgba(3,0,16,0.95) 0%, transparent 70%), radial-gradient(ellipse at 50% 0%, rgba(3,0,16,0.5) 0%, transparent 50%)' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1200, margin: '0 auto', padding: '0 24px', width: '100%' }}>
          <div className="sg-fade-up">
            <MonoLabel style={{ display: 'block', marginBottom: 28 }}>Celestial Event Tracker · 2026</MonoLabel>
            <h1 className="sg-display" style={{
              fontSize: 'clamp(4rem, 11vw, 9.5rem)', fontWeight: 800, lineHeight: 0.92,
              letterSpacing: '-0.04em', color: 'white', marginBottom: 32,
              textWrap: 'balance',
            }}>
              The Night<br />
              <span style={{ color: 'var(--sg-accent)' }}>Sky</span> Awaits
            </h1>

            {next && (
              <div style={{ marginBottom: 36 }}>
                <MonoLabel style={{ display: 'block', marginBottom: 14 }}>Next peak — {next.name}</MonoLabel>
                <Countdown targetDate={next.peak} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="sg-btn sg-btn-primary" onClick={() => navigate('/calendar')}>
                View Calendar →
              </button>
              <button className="sg-btn sg-btn-ghost" onClick={() => navigate('/live')}>
                Live Feed
              </button>
            </div>
          </div>
        </div>

        {/* scroll hint */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <MonoLabel>Scroll</MonoLabel>
          <div style={{ width: 1, height: 36, background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)' }} />
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
          {[
            ['08', 'Showers in 2026'],
            ['03', 'Eclipses this year'],
            ['150', 'Peak ZHR (Geminids)'],
            ['365', 'Nights of sky data'],
          ].map(([val, label], i) => (
            <div key={i} style={{ padding: '24px 0', paddingLeft: i > 0 ? 24 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', marginLeft: i > 0 ? 0 : 0 }}>
              <div className="sg-display sg-mono" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700, color: 'white', letterSpacing: '-0.03em' }}>{val}</div>
              <MonoLabel style={{ marginTop: 4 }}>{label}</MonoLabel>
            </div>
          ))}
        </div>
      </section>

      {/* ── Upcoming showers ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <MonoLabel style={{ display: 'block', marginBottom: 10 }}>01 — Meteor Showers</MonoLabel>
            <h2 className="sg-display" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>Upcoming Events</h2>
          </div>
          <button className="sg-btn sg-btn-ghost" onClick={() => navigate('/calendar')} style={{ flexShrink: 0 }}>All Events →</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {upcoming.map((shower, i) => {
            const status = SG.getShowerStatus(shower);
            const days = SG.getDaysUntil(shower.peak);
            const zhrColor = SG.ZHR_COLOR(shower.zhr);
            return (
              <div key={shower.id} className="sg-card sg-card-accent" style={{ padding: 24, cursor: 'pointer' }}
                onClick={() => navigate(`/shower/${shower.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <span className={`sg-badge sg-badge-${status}`}>
                    {status === 'active' && <span className="sg-live-dot" style={{ width: 5, height: 5 }} />}
                    {status}
                  </span>
                  <MonoLabel>{SG.formatShortDate(shower.peak)}</MonoLabel>
                </div>

                <h3 className="sg-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'white', marginBottom: 6 }}>{shower.name}</h3>
                <p className="sg-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 16, letterSpacing: '0.1em' }}>in {shower.constellation}</p>

                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)', lineHeight: 1.6, marginBottom: 20, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {shower.description}
                </p>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div className="sg-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>Peak ZHR</div>
                    <div className="sg-mono" style={{ fontSize: 20, fontWeight: 700, color: zhrColor }}>{shower.zhr}</div>
                  </div>
                  <div>
                    <div className="sg-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>Speed</div>
                    <div className="sg-mono" style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{shower.speed}<span style={{ fontSize: 10 }}> km/s</span></div>
                  </div>
                  {days > 0 && (
                    <div style={{ marginLeft: 'auto' }}>
                      <div className="sg-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>Days away</div>
                      <div className="sg-mono" style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{days}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Featured: Next big event ── */}
      {next && (
        <section style={{ background: 'rgba(74,143,255,0.04)', borderTop: '1px solid rgba(74,143,255,0.1)', borderBottom: '1px solid rgba(74,143,255,0.1)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            <div>
              <MonoLabel style={{ display: 'block', marginBottom: 12 }}>02 — Next Peak Event</MonoLabel>
              <h2 className="sg-display" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, letterSpacing: '-0.04em', color: 'white', lineHeight: 1, marginBottom: 16 }}>
                {next.name}
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 28 }}>{next.description}</p>
              <div style={{ display: 'flex', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
                {[['Parent body', next.parent], ['Constellation', next.constellation], ['Speed', `${next.speed} km/s`]].map(([k, v]) => (
                  <div key={k}>
                    <MonoLabel style={{ display: 'block', marginBottom: 4 }}>{k}</MonoLabel>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{v}</span>
                  </div>
                ))}
              </div>
              <button className="sg-btn sg-btn-ghost" onClick={() => navigate(`/shower/${next.id}`)}>View Details →</button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <MonoLabel style={{ display: 'block', marginBottom: 20 }}>Peak in</MonoLabel>
              <Countdown targetDate={next.peak} />
              <div style={{ marginTop: 20 }}>
                <MonoLabel>{SG.formatDate(next.peak)}</MonoLabel>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Live widgets ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <MonoLabel style={{ display: 'block', marginBottom: 10 }}>03 — Live Data</MonoLabel>
        <h2 className="sg-display" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 32 }}>Right Now</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <ISSWidget />
          <MoonWidget />
        </div>
      </section>
    </div>
  );
}

// ─── CALENDAR PAGE ────────────────────────────────────────────────────────────
function CalendarPage({ navigate }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const types = ['All', 'Meteor Shower', 'Eclipse', 'Planetary', 'Moon Phase', 'Seasonal'];

  const filtered = useMemo(() => SG.EVENTS.filter(e => {
    const matchType = filter === 'All' || e.type === filter;
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  }), [filter, search]);

  // Group by month
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(e => {
      const month = new Date(e.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[month]) groups[month] = [];
      groups[month].push(e);
    });
    return groups;
  }, [filtered]);

  const visColors = { 'Excellent': '#4ade80', 'Good': '#4a8fff', 'Fair': '#c8993a', 'N/A': 'rgba(255,255,255,0.2)' };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px' }}>
      <MonoLabel style={{ display: 'block', marginBottom: 12 }}>Celestial Calendar</MonoLabel>
      <h1 className="sg-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 40, lineHeight: 1 }}>2026 Events</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="sg-input" placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '0 1 220px' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {types.map(t => (
            <button key={t} className="sg-btn" onClick={() => setFilter(t)} style={{
              background: filter === t ? 'var(--sg-accent)' : 'transparent',
              color: filter === t ? '#030010' : 'rgba(255,255,255,0.45)',
              border: filter === t ? 'none' : '1px solid rgba(255,255,255,0.1)',
              padding: '7px 14px', fontSize: 10
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Events by month */}
      {Object.keys(grouped).length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>No events match your filter.</p>
      )}
      {Object.entries(grouped).map(([month, events]) => (
        <div key={month} style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <h2 className="sg-display" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{month}</h2>
            <div className="sg-divider" style={{ flex: 1 }} />
            <MonoLabel>{events.length} event{events.length !== 1 ? 's' : ''}</MonoLabel>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map(e => {
              const typeColor = SG.EVENT_COLORS[e.type] || 'rgba(255,255,255,0.4)';
              const shower = SG.SHOWERS.find(s => s.name === e.title.replace(' Peak', ''));
              return (
                <div key={e.id} className="sg-card" style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 20, alignItems: 'center', cursor: shower ? 'pointer' : 'default' }}
                  onClick={() => shower && navigate(`/shower/${shower.id}`)}
                >
                  <div>
                    <div className="sg-mono" style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
                      {new Date(e.date).toLocaleDateString('en-US', { day: 'numeric' })}
                    </div>
                    <div className="sg-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                      {new Date(e.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>{e.title}</span>
                      <span className="sg-mono" style={{ fontSize: 9, color: typeColor, letterSpacing: '0.1em' }}>{e.type}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>{e.description}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>Visibility</div>
                    <div className="sg-mono" style={{ fontSize: 11, fontWeight: 700, color: visColors[e.visibility] || 'rgba(255,255,255,0.4)' }}>{e.visibility}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── LIVE PAGE ────────────────────────────────────────────────────────────────
function LivePage() {
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ location: '', type: 'meteor', magnitude: '', duration: '' });
  const [submitted, setSubmitted] = useState(false);

  const addReport = () => {
    if (!form.location) return;
    const r = {
      id: Date.now().toString(), time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      location: form.location, magnitude: form.magnitude || '—', duration: form.duration || '—',
      type: form.type, timestamp: Date.now(),
    };
    setReports(prev => [r, ...prev]);
    setForm({ location: '', type: 'meteor', magnitude: '', duration: '' });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px' }}>
      <MonoLabel style={{ display: 'block', marginBottom: 12 }}>Live Data</MonoLabel>
      <h1 className="sg-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 48, lineHeight: 1 }}>Live Feed</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 48 }}>
        <ISSWidget />
        <MoonWidget />
      </div>

      {/* Sighting report */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <MonoLabel style={{ display: 'block', marginBottom: 16 }}>Submit a Sighting</MonoLabel>
          <div className="sg-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="sg-input" placeholder="Your location (city or coords)" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            <select className="sg-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="meteor">Meteor</option>
              <option value="fireball">Fireball</option>
              <option value="bolide">Bolide</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="sg-input" placeholder="Magnitude (e.g. −2)" value={form.magnitude}
                onChange={e => setForm(f => ({ ...f, magnitude: e.target.value }))} />
              <input className="sg-input" placeholder="Duration (e.g. 2s)" value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
            </div>
            <button className="sg-btn sg-btn-primary" onClick={addReport} style={{ marginTop: 4 }}>
              {submitted ? '✓ Submitted' : 'Submit Report'}
            </button>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <MonoLabel>Community Reports</MonoLabel>
            {reports.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="sg-live-dot" />
                <span className="sg-mono" style={{ fontSize: 9, color: '#4ade80' }}>{reports.length} report{reports.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {reports.length === 0 ? (
            <div className="sg-card" style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>No reports yet tonight.</p>
              <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, marginTop: 8 }}>Be the first to report a sighting.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {reports.map(r => (
                <div key={r.id} className="sg-card" style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 14, alignItems: 'center' }}>
                  <div className="sg-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{r.time}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'white', marginBottom: 2 }}>{r.location}</div>
                    <div className="sg-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{r.type} · {r.magnitude} · {r.duration}</div>
                  </div>
                  <span className="sg-badge sg-badge-upcoming" style={{ fontSize: 8 }}>{r.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SHOWER DETAIL PAGE ───────────────────────────────────────────────────────
function ShowerPage({ id, navigate }) {
  const shower = SG.SHOWERS.find(s => s.id === id);
  if (!shower) return <div style={{ padding: '120px 24px', textAlign: 'center' }}><MonoLabel>Shower not found</MonoLabel></div>;

  const status = SG.getShowerStatus(shower);
  const days = SG.getDaysUntil(shower.peak);
  const canvasRef = useRef(null);

  // Mini meteor animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const meteors = [];
    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.08) meteors.push({ x: Math.random() * canvas.width, y: -10, vx: 2.5+Math.random()*2, vy: 3+Math.random()*3, life: 0, maxLife: 50+Math.random()*30 });
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        const a = 1 - m.life / m.maxLife;
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 6, m.y - m.vy * 6);
        g.addColorStop(0, `rgba(255,255,255,${a * 0.8})`); g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8);
        ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();
        m.x += m.vx; m.y += m.vy; m.life++;
        if (m.life >= m.maxLife) meteors.splice(i, 1);
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px' }}>
      <button onClick={() => navigate('/')} className="sg-btn sg-btn-ghost" style={{ marginBottom: 32, fontSize: 10 }}>← Back</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
        <div>
          <span className={`sg-badge sg-badge-${status}`} style={{ marginBottom: 16, display: 'inline-flex' }}>
            {status === 'active' && <span className="sg-live-dot" style={{ width: 5, height: 5 }} />} {status}
          </span>
          <h1 className="sg-display" style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'white', marginBottom: 8 }}>
            {shower.name}
          </h1>
          <p className="sg-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', marginBottom: 28 }}>Radiant in {shower.constellation}</p>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: 32 }}>{shower.description}</p>
          {shower.viewingTips && (
            <div className="sg-card" style={{ padding: 20, borderColor: 'rgba(74,143,255,0.15)' }}>
              <MonoLabel style={{ display: 'block', marginBottom: 10 }}>Viewing Tips</MonoLabel>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{shower.viewingTips}</p>
            </div>
          )}
        </div>

        <div>
          {/* Meteor canvas */}
          <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 20 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="sg-mono" style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 700, color: SG.ZHR_COLOR(shower.zhr), opacity: 0.8 }}>{shower.zhr}<span style={{ fontSize: '0.4em', opacity: 0.6 }}> ZHR</span></div>
            </div>
          </div>

          {/* Stats */}
          <div className="sg-card" style={{ padding: 24 }}>
            {[
              ['Peak Date', SG.formatDate(shower.peak)],
              ['Active Window', `${SG.formatShortDate(shower.start)} — ${SG.formatShortDate(shower.end)}`],
              ['Speed', `${shower.speed} km/s`],
              ['Parent Body', shower.parent],
              ...(shower.orbitalPeriod ? [['Orbital Period', shower.orbitalPeriod]] : []),
              ...(shower.composition ? [['Composition', shower.composition]] : []),
              ...(days > 0 ? [['Days Until Peak', `${days} days`]] : [['Status', 'Past']]),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <MonoLabel>{k}</MonoLabel>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{v}</span>
              </div>
            ))}
          </div>

          {days > 0 && (
            <div style={{ marginTop: 20 }}>
              <MonoLabel style={{ display: 'block', marginBottom: 16 }}>Peak Countdown</MonoLabel>
              <Countdown targetDate={shower.peak} />
            </div>
          )}
        </div>
      </div>

      {shower.historicalStorms && (
        <div style={{ marginTop: 48, padding: '32px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <MonoLabel style={{ display: 'block', marginBottom: 16 }}>Historical Record</MonoLabel>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, maxWidth: 680 }}>{shower.historicalStorms}</p>
        </div>
      )}
    </div>
  );
}

// ─── GLOBE PAGE ───────────────────────────────────────────────────────────────
function GlobePage({ navigate }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px' }}>
      <MonoLabel style={{ display: 'block', marginBottom: 12 }}>3D Visualization</MonoLabel>
      <h1 className="sg-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 48, lineHeight: 1 }}>Interactive Globe</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Globe placeholder */}
        <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 200 200" style={{ width: '70%', opacity: 0.25 }}>
            <circle cx="100" cy="100" r="90" stroke="rgba(74,143,255,0.6)" strokeWidth="1" fill="none" />
            <ellipse cx="100" cy="100" rx="40" ry="90" stroke="rgba(74,143,255,0.3)" strokeWidth="0.5" fill="none" />
            <ellipse cx="100" cy="100" rx="90" ry="36" stroke="rgba(74,143,255,0.3)" strokeWidth="0.5" fill="none" />
            <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(74,143,255,0.2)" strokeWidth="0.5" />
            <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(74,143,255,0.2)" strokeWidth="0.5" />
            <circle cx="100" cy="100" r="4" fill="#4a8fff" opacity="0.8" />
          </svg>
          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center' }}>
            <MonoLabel>3D Globe · Cesium.js</MonoLabel>
          </div>
        </div>

        <div>
          <div className="sg-card" style={{ padding: 28, marginBottom: 16 }}>
            <MonoLabel style={{ display: 'block', marginBottom: 12 }}>About the Globe</MonoLabel>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, marginBottom: 20 }}>
              The interactive 3D globe renders real-time ISS orbital tracks, meteor shower radiant points, and eclipse shadow paths on a photorealistic Earth model powered by Cesium.js and NASA's Blue Marble imagery.
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Real-time ISS orbital track', 'Meteor shower radiant points', 'Eclipse path visualization', 'Night / day terminator line', 'Constellation overlays'].map(item => (
                <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--sg-accent)', flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ISSWidget />
        </div>
      </div>
    </div>
  );
}

// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────
function AboutPage({ navigate }) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '100px 24px 80px' }}>
      <MonoLabel style={{ display: 'block', marginBottom: 12 }}>About</MonoLabel>
      <h1 className="sg-display" style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, marginBottom: 40 }}>
        Built for<br /><span style={{ color: 'var(--sg-accent)' }}>Stargazers</span>
      </h1>
      <div className="sg-divider" style={{ marginBottom: 40 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 64 }}>
        <div>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85, marginBottom: 20 }}>
            Stargaze is a free, open hobbyist portal for tracking meteor showers, eclipses, and celestial events. No accounts, no paywalls — just the sky.
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.85 }}>
            Data is sourced from the International Meteor Organization, NASA's public APIs, Open-Meteo for atmospheric data, CelesTrak for satellite tracking, and WhereTheISS for real-time ISS position.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['IMO', 'Meteor shower data & ZHR rates', 'https://www.imo.net'],
            ['NASA APIs', 'Astronomical event data', 'https://api.nasa.gov'],
            ['CelesTrak', 'Satellite orbital elements', 'https://celestrak.org'],
            ['Open-Meteo', 'Atmospheric & weather data', 'https://open-meteo.com'],
          ].map(([name, desc, href]) => (
            <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="sg-card" style={{ padding: '16px 20px', textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 3 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{desc}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.3 }}>
                  <path d="M2 10L10 2M10 2H4M10 2V8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="sg-divider" style={{ marginBottom: 40 }} />
      <MonoLabel style={{ display: 'block', marginBottom: 20 }}>Disclaimer</MonoLabel>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.8 }}>
        Stargaze is a hobbyist project. All celestial event data is provided for educational and recreational purposes. Actual viewing conditions depend on weather, light pollution, and observer location. Always verify critical observations with professional astronomical sources.
      </p>
    </div>
  );
}

Object.assign(window, { HomePage, CalendarPage, LivePage, ShowerPage, GlobePage, AboutPage });
