import * as THREE from 'three';
import { GameAudio } from './audio';

export type GamePhase = 'title' | 'briefing' | 'playing' | 'paused' | 'victory' | 'defeat';

export interface SectorInfo {
  id: string;
  name: string;
  color: string;
  status: 'locked' | 'hostile' | 'capturing' | 'allied';
  capture: number; // 0-100
}

export interface HudState {
  phase: GamePhase;
  hull: number;
  shield: number;
  energy: number;
  velocity: number;
  score: number;
  wave: number;
  kills: number;
  objective: string;
  capturing: string | null;
  capturePct: number;
  sectors: SectorInfo[];
  hostileAlert: string | null;
  message: string | null;
}

type Listener = (h: HudState) => void;

const SECTOR_DEFS = [
  { id: 'aurora', name: 'AURORA PRIME', color: '#60a5fa' },
  { id: 'crimson', name: 'CRIMSON REACH', color: '#f87171' },
  { id: 'verdant', name: 'VERDANT IX', color: '#4ade80' },
  { id: 'obsidian', name: 'OBSIDIAN', color: '#a78bfa' },
  { id: 'glacier', name: 'GLACIER IX', color: '#67e8f9' },
  { id: 'dominion', name: 'DOMINION THRONE', color: '#fbbf24' },
];

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Build a low-poly capital / interceptor ship */
function makePlayerShip(): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x8b9bb4, metalness: 0.75, roughness: 0.35 });
  const mid = new THREE.MeshStandardMaterial({ color: 0x5a6a82, metalness: 0.8, roughness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xc45c4a, metalness: 0.5, roughness: 0.4, emissive: 0x3a1010, emissiveIntensity: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.2, roughness: 0.1, emissive: 0x2266aa, emissiveIntensity: 0.5 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x44aaff, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });

  // Main hull
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 3.2), dark);
  body.position.z = 0.1;
  g.add(body);

  // Nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 6), mid);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.9;
  g.add(nose);

  // Wings
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.0), mid);
  wingL.position.set(-1.0, 0, 0.4);
  wingL.rotation.z = 0.12;
  g.add(wingL);
  const wingR = wingL.clone();
  wingR.position.x = 1.0;
  wingR.rotation.z = -0.12;
  g.add(wingR);

  // Engine pods
  const podGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.4, 8);
  const podL = new THREE.Mesh(podGeo, dark);
  podL.rotation.x = Math.PI / 2;
  podL.position.set(-0.7, -0.15, 1.3);
  g.add(podL);
  const podR = podL.clone();
  podR.position.x = 0.7;
  g.add(podR);

  // Engine glow
  const egL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), glow);
  egL.position.set(-0.7, -0.15, 2.05);
  g.add(egL);
  const egR = egL.clone();
  egR.position.x = 0.7;
  g.add(egR);
  (g as any).engines = [egL, egR];

  // Cockpit
  const cock = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), glass);
  cock.position.set(0, 0.22, -0.5);
  cock.scale.set(1, 0.7, 1.3);
  g.add(cock);

  // Accent stripes
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 2.4), accent);
  stripe.position.set(0.35, 0.24, 0.1);
  g.add(stripe);
  const stripe2 = stripe.clone();
  stripe2.position.x = -0.35;
  g.add(stripe2);

  // Turret nubs
  const tur = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 6), accent);
  tur.position.set(0, 0.3, 0.8);
  g.add(tur);

  g.scale.setScalar(1.35);
  g.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function makeEnemyShip(kind: 'fighter' | 'capital' = 'fighter'): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: kind === 'capital' ? 0x6b3030 : 0x884444, metalness: 0.7, roughness: 0.4, emissive: 0x220808, emissiveIntensity: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff4422, emissive: 0xff2200, emissiveIntensity: 0.6 });

  if (kind === 'capital') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 6), mat);
    g.add(hull);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 1.5), mat);
    fin.position.z = 0.5;
    g.add(fin);
    const eng = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), accent);
    eng.position.z = 3.2;
    g.add(eng);
    g.scale.setScalar(2.2);
  } else {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 5), mat);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.5), mat);
    wing.position.z = 0.2;
    g.add(wing);
    const eng = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), accent);
    eng.position.z = 0.95;
    g.add(eng);
    g.scale.setScalar(1.1);
  }
  return g;
}

function makePlanet(radius: number, color: number, opts?: { rings?: boolean; ice?: boolean; gas?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(radius, 48, 48);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.gas ? 0.55 : 0.75,
    metalness: 0.05,
    emissive: color,
    emissiveIntensity: 0.06,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  // Atmosphere shell
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.06, 32, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.BackSide }),
  );
  g.add(atmo);

  if (opts?.rings) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.35, radius * 2.1, 64),
      new THREE.MeshStandardMaterial({
        color: 0xc9b896,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        roughness: 0.8,
      }),
    );
    ring.rotation.x = Math.PI / 2.3;
    g.add(ring);
  }

  // Simple continent noise via vertex colors for earth-like
  if (!opts?.gas && !opts?.ice) {
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(color);
    const land = new THREE.Color(0x2d5a27);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = Math.sin(x * 3.1 + y * 2.7) * Math.cos(z * 2.3) + Math.sin(y * 5.1);
      const col = n > 0.15 ? land : c;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    mat.vertexColors = true;
  }

  return g;
}

function makeAsteroid(r: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  // Distort
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    v.multiplyScalar(0.75 + Math.random() * 0.45);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.9, metalness: 0.15, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

interface Body {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  kind: 'player' | 'enemy' | 'asteroid' | 'bullet' | 'ebullet' | 'planet';
  hp: number;
  maxHp: number;
  radius: number;
  sectorId?: string;
  enemyKind?: 'fighter' | 'capital';
  cool?: number;
  spin?: THREE.Vector3;
  capture?: number;
}

export class VoidArmadaGame {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private audio = new GameAudio();
  private running = false;
  private raf = 0;
  private keys: Record<string, boolean> = {};
  private mouse = { x: 0, y: 0, dx: 0, dy: 0, locked: false };
  private listeners: Listener[] = [];

  private player!: THREE.Group;
  private playerBody!: Body;
  private bodies: Body[] = [];
  private bullets: Body[] = [];
  private planets: { body: Body; sectorId: string; name: string }[] = [];
  private stars!: THREE.Points;

  private yaw = 0;
  private pitch = 0;
  private camDist = 14;
  private boost = 0;

  private phase: GamePhase = 'title';
  private hull = 100;
  private shield = 100;
  private energy = 100;
  private score = 0;
  private wave = 1;
  private kills = 0;
  private spawnT = 0;
  private invuln = 0;
  private message: string | null = null;
  private messageT = 0;
  private hostileAlert: string | null = null;
  private sectors: SectorInfo[] = [];
  private currentSector = 0;
  private thrusterSfxT = 0;

  private container: HTMLElement;
  private onPointerLockChange: () => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onResize: () => void;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setClearColor(0x020208);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.tabIndex = 0;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050510, 0.0018);

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 4000);

    // Lights
    const amb = new THREE.AmbientLight(0x334466, 0.55);
    this.scene.add(amb);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
    sun.position.set(80, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    this.scene.add(sun);
    const rim = new THREE.PointLight(0x4488ff, 0.8, 400);
    rim.position.set(-60, 20, -40);
    this.scene.add(rim);

    this.buildStarfield();
    this.initSectors();
    this.buildWorld();

    // Input
    this.onKeyDown = (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.phase === 'playing') this.setPhase('paused');
        else if (this.phase === 'paused') this.setPhase('playing');
      }
      if (e.code === 'KeyC') {
        this.camDist = this.camDist > 12 ? 8 : 16;
      }
      if (e.code === 'KeyM') this.audio.muted = !this.audio.muted;
    };
    this.onKeyUp = (e) => { this.keys[e.code] = false; };
    this.onMouseMove = (e) => {
      if (!this.mouse.locked || this.phase !== 'playing') return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    };
    this.onPointerLockChange = () => {
      this.mouse.locked = document.pointerLockElement === this.renderer.domElement;
    };
    this.onResize = () => {
      const w = this.container.clientWidth;
      const h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('resize', this.onResize);

    this.renderer.domElement.addEventListener('click', () => {
      this.audio.resume();
      if (this.phase === 'playing') {
        this.renderer.domElement.requestPointerLock();
      }
    });

    this.bindMouseButtons();
    this.emit();
  }

  setMuted(m: boolean) {
    this.audio.muted = m;
  }

  isMuted() {
    return this.audio.muted;
  }

  onHud(fn: Listener) {
    this.listeners.push(fn);
    fn(this.hud());
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  private emit() {
    const h = this.hud();
    for (const l of this.listeners) l(h);
  }

  private hud(): HudState {
    const capturing = this.planets.find(p => p.body.capture && p.body.capture > 0 && p.body.capture < 100);
    return {
      phase: this.phase,
      hull: Math.round(this.hull),
      shield: Math.round(this.shield),
      energy: Math.round(this.energy),
      velocity: Math.round(this.playerBody?.vel.length() ?? 0),
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      objective: this.objectiveText(),
      capturing: capturing ? capturing.name : null,
      capturePct: capturing ? Math.round(capturing.body.capture || 0) : 0,
      sectors: this.sectors.map(s => ({ ...s })),
      hostileAlert: this.hostileAlert,
      message: this.message,
    };
  }

  private objectiveText() {
    const left = this.sectors.filter(s => s.status !== 'allied').length;
    if (left === 0) return 'Galaxy secured. All sectors allied.';
    if (this.phase === 'title') return 'Pilot fleets. Hold orbit. Conquer every world.';
    return `Secure ${left} remaining sector${left === 1 ? '' : 's'}. Destroy hostiles, hold orbit.`;
  }

  private initSectors() {
    this.sectors = SECTOR_DEFS.map((s, i) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      status: i === 0 ? 'hostile' : i < 3 ? 'hostile' : 'locked' as const,
      capture: 0,
    }));
  }

  private buildStarfield() {
    const n = 4000;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 200 + Math.random() * 1800;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.3, 0.6 + Math.random() * 0.4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: true }));
    this.scene.add(this.stars);
  }

  private buildWorld() {
    // Clear dynamic bodies except lights/stars
    for (const b of this.bodies) this.scene.remove(b.mesh);
    this.bodies = [];
    this.bullets = [];
    this.planets = [];

    // Player
    this.player = makePlayerShip();
    this.player.position.set(0, 8, 40);
    this.scene.add(this.player);
    this.playerBody = {
      mesh: this.player,
      vel: new THREE.Vector3(),
      kind: 'player',
      hp: 100,
      maxHp: 100,
      radius: 2.2,
    };
    this.bodies.push(this.playerBody);
    this.yaw = 0;
    this.pitch = 0.05;

    // Planets for first 3 open sectors, rest further out
    const layouts: { pos: THREE.Vector3; r: number; color: number; opts?: any; sector: number }[] = [
      { pos: new THREE.Vector3(0, 0, -40), r: 18, color: 0x3a7bd5, opts: {}, sector: 0 },
      { pos: new THREE.Vector3(70, -5, -30), r: 12, color: 0xc45c3e, opts: {}, sector: 1 },
      { pos: new THREE.Vector3(-55, 10, -70), r: 14, color: 0x3d8b5a, opts: {}, sector: 2 },
      { pos: new THREE.Vector3(30, -15, -140), r: 16, color: 0x4a3a5a, opts: {}, sector: 3 },
      { pos: new THREE.Vector3(-90, 5, -160), r: 15, color: 0xa8d4e6, opts: { ice: true }, sector: 4 },
      { pos: new THREE.Vector3(20, 20, -220), r: 22, color: 0xd4b48c, opts: { gas: true, rings: true }, sector: 5 },
    ];

    for (const L of layouts) {
      const p = makePlanet(L.r, L.color, L.opts);
      p.position.copy(L.pos);
      this.scene.add(p);
      const body: Body = {
        mesh: p,
        vel: new THREE.Vector3(),
        kind: 'planet',
        hp: 9999,
        maxHp: 9999,
        radius: L.r,
        sectorId: SECTOR_DEFS[L.sector].id,
        capture: 0,
      };
      this.bodies.push(body);
      this.planets.push({ body, sectorId: SECTOR_DEFS[L.sector].id, name: SECTOR_DEFS[L.sector].name });
    }

    // Asteroid belt
    for (let i = 0; i < 80; i++) {
      const r = 0.6 + Math.random() * 2.4;
      const a = makeAsteroid(r);
      const ang = Math.random() * Math.PI * 2;
      const rad = 35 + Math.random() * 90;
      a.position.set(
        Math.cos(ang) * rad + (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 30,
        -40 + Math.sin(ang) * rad * 0.4 - Math.random() * 40,
      );
      a.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.scene.add(a);
      this.bodies.push({
        mesh: a,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02),
        kind: 'asteroid',
        hp: r * 3,
        maxHp: r * 3,
        radius: r,
        spin: new THREE.Vector3(Math.random() * 0.01, Math.random() * 0.01, Math.random() * 0.01),
      });
    }

    // Initial enemies near first planet
    this.spawnEnemies(6, new THREE.Vector3(15, 5, -30));
  }

  private spawnEnemies(n: number, around: THREE.Vector3) {
    for (let i = 0; i < n; i++) {
      const capital = i === 0 && n > 4;
      const ship = makeEnemyShip(capital ? 'capital' : 'fighter');
      ship.position.set(
        around.x + (Math.random() - 0.5) * 50,
        around.y + (Math.random() - 0.5) * 20,
        around.z + (Math.random() - 0.5) * 40,
      );
      this.scene.add(ship);
      this.bodies.push({
        mesh: ship,
        vel: new THREE.Vector3(),
        kind: 'enemy',
        hp: capital ? 80 : 20,
        maxHp: capital ? 80 : 20,
        radius: capital ? 5 : 1.5,
        enemyKind: capital ? 'capital' : 'fighter',
        cool: Math.random() * 2,
      });
    }
    this.hostileAlert = `${n} hostile contact${n > 1 ? 's' : ''} in sector`;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  setPhase(p: GamePhase) {
    this.phase = p;
    if (p === 'playing') {
      this.audio.resume();
      this.audio.ui();
      try { this.renderer.domElement.requestPointerLock(); } catch { /* ignore */ }
    }
    if (p === 'paused' || p === 'title') {
      if (document.pointerLockElement) document.exitPointerLock();
    }
    this.emit();
  }

  launch() {
    this.audio.resume();
    this.audio.ui();
    this.resetRun();
    this.setPhase('playing');
  }

  private resetRun() {
    this.hull = 100;
    this.shield = 100;
    this.energy = 100;
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.spawnT = 8;
    this.invuln = 2;
    this.initSectors();
    this.sectors[0].status = 'hostile';
    this.buildWorld();
    this.message = 'Weapons free. Clear hostiles and hold orbit.';
    this.messageT = 4;
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.phase === 'playing') this.updatePlaying(dt);
    else this.updateIdle(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateIdle(dt: number) {
    // slow planet spin on title
    for (const p of this.planets) {
      p.body.mesh.rotation.y += dt * 0.05;
    }
    for (const b of this.bodies) {
      if (b.kind === 'asteroid' && b.spin) {
        b.mesh.rotation.x += b.spin.x;
        b.mesh.rotation.y += b.spin.y;
      }
    }
    // cinematic orbit camera on title
    if (this.phase === 'title' || this.phase === 'briefing') {
      const t = performance.now() * 0.00015;
      this.camera.position.set(Math.cos(t) * 55, 18 + Math.sin(t * 0.7) * 6, 45 + Math.sin(t) * 20);
      this.camera.lookAt(0, 0, -40);
    }
  }

  private updatePlaying(dt: number) {
    // Mouse look
    this.yaw -= this.mouse.dx * 0.0022;
    this.pitch -= this.mouse.dy * 0.0022;
    this.pitch = clamp(this.pitch, -1.2, 1.2);
    this.mouse.dx = 0;
    this.mouse.dy = 0;

    // Orientation from yaw/pitch
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.player.quaternion.copy(q);

    // Thrust
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const wish = new THREE.Vector3();
    if (this.keys.KeyW || this.keys.ArrowUp) wish.add(forward);
    if (this.keys.KeyS || this.keys.ArrowDown) wish.sub(forward);
    if (this.keys.KeyD || this.keys.ArrowRight) wish.add(right);
    if (this.keys.KeyA || this.keys.ArrowLeft) wish.sub(right);
    if (this.keys.KeyR || this.keys.Space) wish.add(up.clone().multiplyScalar(0.6));
    if (this.keys.KeyF || this.keys.ControlLeft) wish.sub(up.clone().multiplyScalar(0.6));

    const boosting = this.keys.ShiftLeft || this.keys.ShiftRight;
    if (boosting && this.energy > 0) {
      this.boost = 1;
      this.energy = Math.max(0, this.energy - 18 * dt);
    } else {
      this.boost = 0;
      this.energy = Math.min(100, this.energy + 12 * dt);
    }

    const accel = (boosting && this.energy > 0 ? 42 : 22);
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(accel * dt);
      this.playerBody.vel.add(wish);
      this.thrusterSfxT -= dt;
      if (this.thrusterSfxT <= 0) {
        this.audio.thruster();
        this.thrusterSfxT = 0.12;
      }
    }

    // Drag
    this.playerBody.vel.multiplyScalar(1 - 1.8 * dt);
    // Max speed
    const maxSp = boosting && this.energy > 0 ? 55 : 32;
    if (this.playerBody.vel.length() > maxSp) this.playerBody.vel.setLength(maxSp);

    this.player.position.addScaledVector(this.playerBody.vel, dt);

    // Engine glow intensity
    const engs = (this.player as any).engines as THREE.Mesh[] | undefined;
    if (engs) {
      const thr = wish.lengthSq() > 0 ? 1.5 : 0.4;
      for (const e of engs) {
        const m = e.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = thr + this.boost * 1.2 + Math.sin(performance.now() * 0.02) * 0.2;
      }
    }

    // Fire — hold J/Z/E or left mouse
    if (this.keys.KeyJ || this.keys.KeyZ || this.keys.KeyE || this.keys.Mouse0) {
      this.tryFire();
    }

    if (this.invuln > 0) this.invuln -= dt;
    if (this.messageT > 0) {
      this.messageT -= dt;
      if (this.messageT <= 0) this.message = null;
    }

    // Shield regen
    if (this.shield < 100) this.shield = Math.min(100, this.shield + 4 * dt);

    // Update asteroids
    for (const b of this.bodies) {
      if (b.kind === 'asteroid') {
        b.mesh.position.addScaledVector(b.vel, dt * 60);
        if (b.spin) {
          b.mesh.rotation.x += b.spin.x;
          b.mesh.rotation.y += b.spin.y;
          b.mesh.rotation.z += b.spin.z;
        }
      }
      if (b.kind === 'planet') {
        b.mesh.rotation.y += dt * 0.08;
      }
    }

    // Enemies AI
    this.updateEnemies(dt);

    // Bullets
    this.updateBullets(dt);

    // Collisions player-asteroid / player-enemy
    this.playerCollisions();

    // Capture
    this.updateCapture(dt);

    // Waves
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const hostiles = this.bodies.filter(b => b.kind === 'enemy').length;
      if (hostiles < 3 + this.wave) {
        const targetPlanet = this.planets[Math.min(this.wave - 1, this.planets.length - 1)];
        this.spawnEnemies(2 + Math.floor(this.wave / 2), targetPlanet.body.mesh.position.clone().add(new THREE.Vector3(20, 10, 20)));
        this.wave += 1;
        this.audio.ui();
      }
      this.spawnT = 14;
    }

    // Unlock sectors when previous allied
    for (let i = 1; i < this.sectors.length; i++) {
      if (this.sectors[i].status === 'locked' && this.sectors[i - 1].status === 'allied') {
        this.sectors[i].status = 'hostile';
        this.message = `Sector unlocked: ${this.sectors[i].name}`;
        this.messageT = 3;
        this.audio.captureDone();
      }
    }

    // Victory
    if (this.sectors.every(s => s.status === 'allied')) {
      this.setPhase('victory');
      this.audio.captureDone();
    }

    // Defeat
    if (this.hull <= 0) {
      this.hull = 0;
      this.setPhase('defeat');
      this.audio.explode();
    }

    this.emit();
  }

  private fireCool = 0;
  private tryFire() {
    if (this.fireCool > 0) return;
    if (this.energy < 3) return;
    this.fireCool = 0.12;
    this.energy -= 3;
    this.audio.laser();

    const q = this.player.quaternion;
    const origin = this.player.position.clone().add(new THREE.Vector3(0, 0, -2.5).applyQuaternion(q));
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q);

    // dual cannons
    for (const side of [-0.5, 0.5]) {
      const o = origin.clone().add(new THREE.Vector3(side, 0, 0).applyQuaternion(q));
      const geo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0x66eeff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      mesh.position.copy(o);
      this.scene.add(mesh);
      const vel = dir.clone().multiplyScalar(120).add(this.playerBody.vel);
      this.bullets.push({
        mesh,
        vel,
        kind: 'bullet',
        hp: 1,
        maxHp: 1,
        radius: 0.3,
      });
    }
  }

  private updateEnemies(dt: number) {
    const playerPos = this.player.position;
    for (const b of this.bodies) {
      if (b.kind !== 'enemy') continue;
      const toPlayer = playerPos.clone().sub(b.mesh.position);
      const dist = toPlayer.length();
      const dir = toPlayer.normalize();

      // Face player
      const look = new THREE.Matrix4().lookAt(b.mesh.position, playerPos, new THREE.Vector3(0, 1, 0));
      const targetQ = new THREE.Quaternion().setFromRotationMatrix(look);
      b.mesh.quaternion.slerp(targetQ, 2 * dt);

      // Strafe + approach
      const speed = b.enemyKind === 'capital' ? 8 : 16;
      if (dist > 25) {
        b.vel.lerp(dir.clone().multiplyScalar(speed), 2 * dt);
      } else if (dist < 12) {
        b.vel.lerp(dir.clone().multiplyScalar(-speed * 0.5), 2 * dt);
      } else {
        // circle
        const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        b.vel.lerp(side.multiplyScalar(speed * 0.7), 1.5 * dt);
      }
      b.mesh.position.addScaledVector(b.vel, dt);

      // Shoot
      b.cool = (b.cool ?? 0) - dt;
      if (b.cool <= 0 && dist < 90) {
        b.cool = b.enemyKind === 'capital' ? 0.8 : 1.2;
        const geo = new THREE.SphereGeometry(0.2, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff4422 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(b.mesh.position);
        this.scene.add(mesh);
        const v = dir.clone().multiplyScalar(55);
        this.bullets.push({ mesh, vel: v, kind: 'ebullet', hp: 1, maxHp: 1, radius: 0.4 });
      }
    }
  }

  private updateBullets(dt: number) {
    this.fireCool = Math.max(0, this.fireCool - dt);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.addScaledVector(b.vel, dt);
      // lifetime via distance from origin-ish — remove far ones
      if (b.mesh.position.distanceTo(this.player.position) > 400) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.kind === 'bullet') {
        // hit enemies / asteroids
        for (let j = this.bodies.length - 1; j >= 0; j--) {
          const t = this.bodies[j];
          if (t.kind !== 'enemy' && t.kind !== 'asteroid') continue;
          if (b.mesh.position.distanceTo(t.mesh.position) < t.radius + 0.8) {
            t.hp -= b.kind === 'bullet' ? 10 : 5;
            this.scene.remove(b.mesh);
            this.bullets.splice(i, 1);
            this.audio.hit();
            this.spawnHitFX(b.mesh.position, 0x66eeff);
            if (t.hp <= 0) {
              this.destroyBody(j);
            }
            break;
          }
        }
      } else if (b.kind === 'ebullet') {
        if (this.invuln <= 0 && b.mesh.position.distanceTo(this.player.position) < 2.5) {
          this.damagePlayer(12);
          this.scene.remove(b.mesh);
          this.bullets.splice(i, 1);
        }
      }
    }
  }

  private destroyBody(index: number) {
    const t = this.bodies[index];
    this.spawnHitFX(t.mesh.position, t.kind === 'enemy' ? 0xff6633 : 0xaaaaaa, true);
    this.scene.remove(t.mesh);
    if (t.kind === 'enemy') {
      this.kills += 1;
      this.score += t.enemyKind === 'capital' ? 500 : 100;
      this.audio.explode();
    } else {
      this.score += 25;
      this.audio.hit();
    }
    this.bodies.splice(index, 1);
  }

  private spawnHitFX(pos: THREE.Vector3, color: number, big = false) {
    const n = big ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(big ? 0.25 : 0.12, 4, 4),
        new THREE.MeshBasicMaterial({ color }),
      );
      m.position.copy(pos);
      this.scene.add(m);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(big ? 12 : 6);
      // simple fade via timeout removal
      const start = performance.now();
      const step = () => {
        const t = (performance.now() - start) / 400;
        if (t > 1) {
          this.scene.remove(m);
          return;
        }
        m.position.addScaledVector(vel, 0.016);
        m.scale.multiplyScalar(0.96);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }

  private damagePlayer(amount: number) {
    if (this.invuln > 0) return;
    this.audio.damage();
    this.invuln = 0.8;
    let dmg = amount;
    if (this.shield > 0) {
      const s = Math.min(this.shield, dmg);
      this.shield -= s;
      dmg -= s;
    }
    if (dmg > 0) this.hull -= dmg;
    this.spawnHitFX(this.player.position, 0xff8844);
  }

  private playerCollisions() {
    if (this.invuln > 0) return;
    for (const b of this.bodies) {
      if (b.kind !== 'asteroid' && b.kind !== 'enemy') continue;
      const d = this.player.position.distanceTo(b.mesh.position);
      if (d < b.radius + this.playerBody.radius) {
        this.damagePlayer(b.kind === 'enemy' ? 18 : 10);
        // bounce
        const push = this.player.position.clone().sub(b.mesh.position).normalize();
        this.playerBody.vel.add(push.multiplyScalar(12));
        if (b.kind === 'enemy') {
          b.hp -= 5;
        }
      }
    }
  }

  private updateCapture(dt: number) {
    // nearest planet
    let nearest: typeof this.planets[0] | null = null;
    let best = 40;
    for (const p of this.planets) {
      const d = this.player.position.distanceTo(p.body.mesh.position) - p.body.radius;
      if (d < best) {
        best = d;
        nearest = p;
      }
    }

    // reset non-capturing
    for (const p of this.planets) {
      if (p !== nearest) {
        // decay slowly if not allied
        const sec = this.sectors.find(s => s.id === p.sectorId);
        if (sec && sec.status !== 'allied' && (p.body.capture || 0) > 0 && (p.body.capture || 0) < 100) {
          p.body.capture = Math.max(0, (p.body.capture || 0) - 5 * dt);
          sec.capture = p.body.capture;
          if (sec.status === 'capturing') sec.status = 'hostile';
        }
      }
    }

    if (!nearest) return;
    const sec = this.sectors.find(s => s.id === nearest!.sectorId);
    if (!sec || sec.status === 'locked' || sec.status === 'allied') return;

    const dist = this.player.position.distanceTo(nearest.body.mesh.position) - nearest.body.radius;
    const hostilesNear = this.bodies.some(
      b => b.kind === 'enemy' && b.mesh.position.distanceTo(nearest!.body.mesh.position) < nearest!.body.radius + 45,
    );

    if (dist < 22 && !hostilesNear) {
      sec.status = 'capturing';
      nearest.body.capture = (nearest.body.capture || 0) + 12 * dt;
      sec.capture = nearest.body.capture;
      if (Math.random() < 0.05) this.audio.captureTick();
      if (nearest.body.capture >= 100) {
        nearest.body.capture = 100;
        sec.capture = 100;
        sec.status = 'allied';
        this.score += 1000;
        this.message = `${sec.name} secured for the Armada`;
        this.messageT = 4;
        this.audio.captureDone();
        this.hostileAlert = null;
      }
    } else if (dist < 22 && hostilesNear) {
      this.hostileAlert = 'Clear hostiles to capture orbit';
      sec.status = 'hostile';
    }
  }

  private updateCamera(dt: number) {
    if (this.phase !== 'playing' && this.phase !== 'paused' && this.phase !== 'defeat' && this.phase !== 'victory') return;

    const q = this.player.quaternion;
    const back = new THREE.Vector3(0, 0.35, 1).applyQuaternion(q).normalize();
    const target = this.player.position.clone().add(back.multiplyScalar(this.camDist)).add(new THREE.Vector3(0, 3.5, 0));
    this.camera.position.lerp(target, 1 - Math.pow(0.001, dt));
    const look = this.player.position.clone().add(new THREE.Vector3(0, 1.2, 0)).add(
      new THREE.Vector3(0, 0, -12).applyQuaternion(q),
    );
    this.camera.lookAt(look);
  }

  /** Wire mouse buttons */
  bindMouseButtons() {
    const down = (e: MouseEvent) => {
      if (e.button === 0) this.keys.Mouse0 = true;
    };
    const up = (e: MouseEvent) => {
      if (e.button === 0) this.keys.Mouse0 = false;
    };
    this.renderer.domElement.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    (this as any)._mouseDown = down;
    (this as any)._mouseUp = up;
  }
}
