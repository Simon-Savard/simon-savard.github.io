// Adaptation vanilla JS du composant <ClickSpark /> de React Bits.
// Utilisation : new ClickSpark({ sparkColor: '#fff', shape: 'line', sparkCount: 8 });
// Toutes les props du composant d'origine sont acceptées (voir DEFAULTS).
//
// Différences avec la version React :
// - Pas de wrapper autour du contenu : une couche plein écran fixe (comme SplashCursor)
//   est ajoutée au <body> et on écoute les clics sur `target` (par défaut : toute la page).
// - Le « ref.spark(x, y) » devient la méthode instance.spark(x, y), en px depuis le coin
//   supérieur gauche de la fenêtre (centre de l'écran si x et y sont omis).
// - Les autres méthodes : instance.update({ ...options }) et instance.destroy().

const DEFAULTS = {
  sparkColor: '#e400c6', // string | string[] : une liste mélange les couleurs dans chaque éclat
  sparkSize: 14,
  sparkRadius: 30,
  sparkCount: 8,
  sparkWidth: 2,
  duration: 500,
  easing: 'ease-out', // 'ease-out' | 'ease-in-out' | 'ease-in' | 'linear' | 'spring'
  extraScale: 1,
  shape: 'line', // 'line' | 'streak' | 'dot' | 'star'
  randomness: 0.2,
  gravity: 0,
  spread: 360,
  direction: 0,
  glow: 0,
  ring: false,
  layer: 'front', // 'front' : par-dessus la page | 'back' : derrière le contenu
  disabled: false,
  target: document, // élément (ou document) sur lequel écouter les clics
};

const EASINGS = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - Math.pow(1 - t, 3),
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  spring: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
};

const SHAPES = ['line', 'streak', 'dot', 'star'];
const MAX_BURSTS = 32;
const GRAVITY = 500;
const REDUCED_MS = 320;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const toColors = (value) => {
  const list = (Array.isArray(value) ? value : [value]).filter(Boolean);
  return list.length ? list : ['#ffffff'];
};

const starPath = (ctx, x, y, radius, rotation) => {
  const pinch = radius * 0.16;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(rotation) * radius, y + Math.sin(rotation) * radius);
  for (let i = 1; i <= 4; i++) {
    const a = rotation + (i * Math.PI) / 2;
    const mid = a - Math.PI / 4;
    ctx.quadraticCurveTo(
      x + Math.cos(mid) * pinch,
      y + Math.sin(mid) * pinch,
      x + Math.cos(a) * radius,
      y + Math.sin(a) * radius
    );
  }
  ctx.closePath();
};

// Convertit n'importe quelle couleur CSS en [r, g, b] en passant par le canvas
const channels = (ctx, color) => {
  ctx.fillStyle = color;
  const normal = String(ctx.fillStyle);
  const hex = /^#([0-9a-f]{6})$/i.exec(normal);
  if (hex) {
    const value = parseInt(hex[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(normal);
  if (rgb) {
    return rgb[1]
      .split(',')
      .slice(0, 3)
      .map((part) => parseFloat(part));
  }
  return [0, 0, 0];
};

const drop = (s, seconds) => 0.5 * s.gravity * GRAVITY * seconds * seconds;

const position = (burst, spark, distance, seconds) => [
  burst.x + Math.cos(spark.angle) * distance,
  burst.y + Math.sin(spark.angle) * distance + drop(burst.settings, seconds),
];

export default class ClickSpark {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.bursts = [];
    this.raf = 0;
    this.lastPress = { time: -1e9, x: 0, y: 0 };

    this.frame = this.frame.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onClick = this.onClick.bind(this);

    this.init();
  }

  init() {
    // Couche plein écran fixe qui ne bloque pas les clics (même principe que SplashCursor)
    this.layer = document.createElement('div');
    this.layer.setAttribute('aria-hidden', 'true');
    Object.assign(this.layer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    this.applyLayer();
    document.body.appendChild(this.layer);

    this.target = this.options.target || document;
    this.target.addEventListener('pointerdown', this.onPointerDown);
    this.target.addEventListener('click', this.onClick);
  }

  // Au-dessus de SplashCursor (z-index 50) devant, ou derrière le contenu
  applyLayer() {
    this.layer.style.zIndex = this.options.layer === 'back' ? '-1' : '51';
  }

  // Les options sont relues à chaque éclat : update() s'applique au prochain clic
  update(options = {}) {
    this.options = { ...this.options, ...options };
    this.applyLayer();
  }

  getSettings() {
    const o = this.options;
    return {
      colors: toColors(o.sparkColor),
      size: Math.max(0, o.sparkSize),
      radius: Math.max(0, o.sparkRadius) * Math.max(0, o.extraScale),
      count: clamp(Math.round(o.sparkCount), 1, 64),
      width: Math.max(0.5, o.sparkWidth),
      duration: Math.max(60, o.duration),
      ease: EASINGS[o.easing] ?? EASINGS['ease-out'],
      shape: SHAPES.includes(o.shape) ? o.shape : 'line',
      randomness: clamp(o.randomness, 0, 1),
      gravity: Math.max(0, o.gravity),
      spread: clamp(o.spread, 0, 360),
      direction: o.direction,
      glow: clamp(o.glow, 0, 1),
      ring: o.ring,
      disabled: o.disabled,
    };
  }

  // Déclenche un éclat depuis le code (x et y en px depuis le coin supérieur gauche de la fenêtre)
  spark(x, y) {
    this.spawn(x ?? window.innerWidth / 2, y ?? window.innerHeight / 2);
  }

  drawSpark(ctx, burst, spark, elapsed) {
    const s = burst.settings;
    const reduced = this.reduced;
    const life = reduced ? REDUCED_MS : s.duration * spark.life;
    const p = elapsed / life;
    if (p >= 1) return false;
    const e = reduced ? 0.55 : s.ease(clamp(p, 0, 1));
    const seconds = reduced ? 0 : elapsed / 1000;
    const distance = s.radius * spark.reach * e;
    const width = s.width * spark.scale;
    const fade = reduced ? 1 - p : 1 - smoothstep(s.shape === 'line' ? 0.55 : 0.7, 1, p);
    if (fade <= 0) return true;
    ctx.strokeStyle = spark.color;
    ctx.fillStyle = spark.color;

    if (s.shape === 'line') {
      const length = s.size * spark.scale * (reduced ? 0.5 : Math.pow(1 - p, 1.6));
      const [x1, y1] = position(burst, spark, distance, seconds);
      const [x2, y2] = position(burst, spark, distance + Math.max(0.01, length), seconds);
      ctx.lineCap = 'round';
      if (spark.glow > 0) {
        ctx.globalAlpha = fade * 0.14 * spark.glow;
        ctx.lineWidth = width * 4.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = fade;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return true;
    }

    if (s.shape === 'streak') {
      const lag = reduced ? 0 : Math.min(elapsed, 70 + s.size * 4 * spark.scale);
      const back = reduced ? 0.4 : s.ease(clamp((elapsed - lag) / life, 0, 1));
      const [hx, hy] = position(burst, spark, distance, seconds);
      const [tx, ty] = position(burst, spark, s.radius * spark.reach * back, Math.max(0, seconds - lag / 1000));
      const dx = hx - tx;
      const dy = hy - ty;
      const length = Math.hypot(dx, dy) || 1;
      const nx = (-dy / length) * width * 0.5;
      const ny = (dx / length) * width * 0.5;
      const paint = (spreadWidth, alpha) => {
        const gradient = ctx.createLinearGradient(tx, ty, hx, hy);
        gradient.addColorStop(0, spark.clear);
        gradient.addColorStop(1, spark.color);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx + nx * spreadWidth, hy + ny * spreadWidth);
        ctx.lineTo(hx - nx * spreadWidth, hy - ny * spreadWidth);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(hx, hy, width * 0.5 * spreadWidth, 0, Math.PI * 2);
        ctx.fill();
      };
      if (spark.glow > 0) paint(3.2, fade * 0.16 * spark.glow);
      paint(1, fade);
      return true;
    }

    if (s.shape === 'dot') {
      const [x, y] = position(burst, spark, distance, seconds);
      const radius = width * 1.25 * (1 - 0.5 * e);
      if (spark.glow > 0) {
        ctx.globalAlpha = fade * 0.18 * spark.glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }

    // star
    const [x, y] = position(burst, spark, distance, seconds);
    const twinkle = reduced ? 1 - p : Math.pow(Math.sin(Math.PI * clamp(p * 1.1, 0, 1)), 0.7);
    const radius = s.size * 0.6 * spark.scale * twinkle;
    const rotation = spark.angle + spark.spin * p * Math.PI * 0.5;
    if (radius <= 0.05) return true;
    if (spark.glow > 0) {
      ctx.globalAlpha = fade * 0.2 * spark.glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = fade;
    starPath(ctx, x, y, radius, rotation);
    ctx.fill();
    return true;
  }

  drawRing(ctx, burst, elapsed) {
    const s = burst.settings;
    const life = this.reduced ? REDUCED_MS : s.duration * 0.8;
    const p = elapsed / life;
    if (p >= 1) return false;
    const radius = 2 + s.radius * 0.6 * (this.reduced ? 0.6 : EASINGS['ease-out'](p));
    ctx.globalAlpha = Math.pow(1 - p, 2) * 0.7;
    ctx.strokeStyle = burst.sparks[0]?.color ?? s.colors[0];
    ctx.lineWidth = Math.max(0.5, s.width * (1 - p) * 0.9);
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    return true;
  }

  remove(burst) {
    burst.canvas.remove();
    const index = this.bursts.indexOf(burst);
    if (index >= 0) this.bursts.splice(index, 1);
  }

  frame(now) {
    this.raf = 0;
    for (const burst of [...this.bursts]) {
      const elapsed = now - burst.start;
      const ctx = burst.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, burst.canvas.width, burst.canvas.height);
      ctx.setTransform(burst.ratio, 0, 0, burst.ratio, -burst.left * burst.ratio, -burst.top * burst.ratio);
      let alive = false;
      if (burst.settings.ring && this.drawRing(ctx, burst, elapsed)) alive = true;
      for (const spark of burst.sparks) {
        if (this.drawSpark(ctx, burst, spark, elapsed)) alive = true;
      }
      ctx.globalAlpha = 1;
      if (!alive) this.remove(burst);
    }
    if (this.bursts.length) this.raf = requestAnimationFrame(this.frame);
  }

  spawn(clientX, clientY) {
    const s = this.getSettings();
    if (s.disabled) return;

    const offset = Math.floor(Math.random() * s.colors.length);
    const full = s.spread >= 359.5;
    const arc = (s.spread * Math.PI) / 180;
    const heading = ((s.direction - 90) * Math.PI) / 180;
    const step = full ? (Math.PI * 2) / s.count : s.count > 1 ? arc / (s.count - 1) : 0;

    const sparks = Array.from({ length: s.count }, (_, i) => {
      const base = full ? heading + step * i : s.count > 1 ? heading - arc / 2 + step * i : heading;
      const jitter = (Math.random() - 0.5) * s.randomness;
      return {
        angle: base + jitter * (step || arc || 1) * 0.9,
        reach: 1 + (Math.random() - 0.5) * 0.7 * s.randomness,
        scale: 1 + (Math.random() - 0.5) * 0.8 * s.randomness,
        life: 1 + (Math.random() - 0.5) * 0.5 * s.randomness,
        spin: Math.random() - 0.5,
        color: s.colors[(i + offset) % s.colors.length],
        clear: '',
        glow: 0,
      };
    });

    // Un petit canvas par éclat, juste assez grand pour contenir l'animation
    const longest = s.duration * (1 + 0.25 * s.randomness);
    const fall = drop(s, longest / 1000);
    const reach =
      s.radius * (1 + 0.35 * s.randomness) * (s.ease === EASINGS.spring ? 1.15 : 1) +
      s.size * (1 + 0.4 * s.randomness) +
      s.width * (s.glow > 0 ? 6 : 2) +
      6;
    const box = {
      left: Math.max(clientX - reach, 0),
      top: Math.max(clientY - reach, 0),
      right: Math.min(clientX + reach, window.innerWidth),
      bottom: Math.min(clientY + reach + fall, window.innerHeight),
    };
    if (box.right - box.left < 1 || box.bottom - box.top < 1) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((box.right - box.left) * ratio);
    canvas.height = Math.ceil((box.bottom - box.top) * ratio);
    // La couche est fixe et collée au coin de la fenêtre : les coordonnées client suffisent
    Object.assign(canvas.style, {
      position: 'absolute',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.right - box.left}px`,
      height: `${box.bottom - box.top}px`,
      display: 'block',
      pointerEvents: 'none',
    });
    canvas.setAttribute('aria-hidden', 'true');
    this.layer.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }

    for (const spark of sparks) {
      const [r, g, b] = channels(ctx, spark.color);
      spark.clear = `rgba(${r}, ${g}, ${b}, 0)`;
      spark.glow = s.glow * (0.35 + 0.65 * ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
    }

    this.bursts.push({
      x: clientX,
      y: clientY,
      start: performance.now(),
      sparks,
      settings: { ...s },
      canvas,
      ctx,
      ratio,
      left: box.left,
      top: box.top,
    });
    while (this.bursts.length > MAX_BURSTS) this.remove(this.bursts[0]);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  // Souris : l'éclat part dès l'appui
  onPointerDown(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    this.lastPress = { time: performance.now(), x: event.clientX, y: event.clientY };
    this.spawn(event.clientX, event.clientY);
  }

  // Tactile et clavier : l'éclat part au « click » (au centre de l'élément si activé au clavier)
  onClick(event) {
    if ('pointerType' in event && event.pointerType === 'mouse') return;

    if (event.detail === 0) {
      const target = event.target instanceof Element ? event.target : document.documentElement;
      const rect = target.getBoundingClientRect();
      this.spawn(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return;
    }

    // Évite un doublon si l'appui vient déjà d'être traité par pointerdown
    const recent =
      performance.now() - this.lastPress.time < 700 &&
      Math.hypot(event.clientX - this.lastPress.x, event.clientY - this.lastPress.y) < 12;
    if (!recent) this.spawn(event.clientX, event.clientY);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('click', this.onClick);
    for (const burst of [...this.bursts]) this.remove(burst);
    this.layer.remove();
  }
}

