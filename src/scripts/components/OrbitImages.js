import { MOBILE_QUERY } from "../utils/Breakpoints.js";

// Adaptation vanilla JS du composant <OrbitImages /> de React Bits (créé par Dominik Koch).
// Utilisation : un conteneur qui contient des blocs avec une <img> et (optionnellement) un <p> pour le nom
//   <div class="logi-lang" data-component="OrbitImages" data-radius-x="520" data-radius-y="130">
//     <div class="logi"><img src="..." alt="Logo VSCode"><p>VSCode</p></div>
//     ...
//   </div>
// Sans JavaScript, le contenu reste une grille de logos (le HTML n'est pas modifié tant que la composante n'a pas démarré).
// Chaque option peut être surchargée avec un attribut data-*, ex. : data-duration="30" data-depth="1"
// Valeurs du mode mobile : data-mobile-radius-x, data-mobile-radius-y, data-mobile-rotation, data-mobile-item-size

const DEFAULTS = {
  shape: "ellipse", // 'ellipse' | 'circle' | 'square' | 'rectangle' | 'triangle' | 'star' | 'heart' | 'infinity' | 'wave' | 'custom'
  customPath: undefined,
  baseWidth: 1400,
  radiusX: 520,
  radiusY: 130,
  radius: 300,
  starPoints: 5,
  starInnerRatio: 0.5,
  rotation: -8,
  duration: 40,
  itemSize: 90,
  direction: "normal", // 'normal' | 'reverse'
  fill: true,
  depth: 0.8,
  alignToPath: false,
  itemRadius: 0,
  shadow: 0,
  hoverScale: 1.15,
  hoverSpeed: 0.3,
  draggable: true,
  clickToFront: true,
  showPath: true,
  pathColor: "rgba(228, 0, 198, 0.35)",
  pathWidth: 2,
  pathDash: 0,
  easing: "linear", // 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  paused: false,
  intro: true,
  // Affiche au centre le nom du logo au premier plan (ou survolé)
  showLabel: true,
  // Valeurs utilisées en mode mobile (400px et moins) : l'orbite est un ovale vertical incliné et les logos plus grands
  mobileRadiusX: 170,
  mobileRadiusY: 350,
  mobileRotation: 25, // positif = le haut de l'ovale penche vers la droite
  mobileItemSize: 80,
};

const SAMPLES = 720;
const FRONT_GROW = 0.3;
const BACK_SHRINK = 0.45;
const BACK_DIM = 0.55;
const INTRO_SPREAD = 1.3;
const INTRO_FADE = 0.45;
const DRAG_THRESHOLD = 5;

let uid = 0;

function generateEllipsePath(cx, cy, rx, ry) {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
}

function generateCirclePath(cx, cy, r) {
  return generateEllipsePath(cx, cy, r, r);
}

function generateSquarePath(cx, cy, size) {
  const h = size / 2;
  return `M ${cx - h} ${cy - h} L ${cx + h} ${cy - h} L ${cx + h} ${cy + h} L ${cx - h} ${cy + h} Z`;
}

function generateRectanglePath(cx, cy, w, h) {
  const hw = w / 2;
  const hh = h / 2;
  return `M ${cx - hw} ${cy - hh} L ${cx + hw} ${cy - hh} L ${cx + hw} ${cy + hh} L ${cx - hw} ${cy + hh} Z`;
}

function generateTrianglePath(cx, cy, size) {
  const height = (size * Math.sqrt(3)) / 2;
  const hs = size / 2;
  return `M ${cx} ${cy - height / 1.5} L ${cx + hs} ${cy + height / 3} L ${cx - hs} ${cy + height / 3} Z`;
}

function generateStarPath(cx, cy, outerR, innerR, points) {
  const step = Math.PI / points;
  let path = "";
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return path + " Z";
}

function generateHeartPath(cx, cy, size) {
  const s = size / 30;
  return `M ${cx} ${cy + 12 * s} C ${cx - 20 * s} ${cy - 5 * s}, ${cx - 12 * s} ${cy - 18 * s}, ${cx} ${cy - 8 * s} C ${cx + 12 * s} ${cy - 18 * s}, ${cx + 20 * s} ${cy - 5 * s}, ${cx} ${cy + 12 * s}`;
}

function generateInfinityPath(cx, cy, w, h) {
  const hw = w / 2;
  const hh = h / 2;
  return `M ${cx} ${cy} C ${cx + hw * 0.5} ${cy - hh}, ${cx + hw} ${cy - hh}, ${cx + hw} ${cy} C ${cx + hw} ${cy + hh}, ${cx + hw * 0.5} ${cy + hh}, ${cx} ${cy} C ${cx - hw * 0.5} ${cy + hh}, ${cx - hw} ${cy + hh}, ${cx - hw} ${cy} C ${cx - hw} ${cy - hh}, ${cx - hw * 0.5} ${cy - hh}, ${cx} ${cy}`;
}

function generateWavePath(cx, cy, w, amplitude, waves) {
  const pts = [];
  const segs = waves * 20;
  const hw = w / 2;
  for (let i = 0; i <= segs; i++) {
    const x = cx - hw + (w * i) / segs;
    const y = cy + Math.sin((i / segs) * waves * 2 * Math.PI) * amplitude;
    pts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  for (let i = segs; i >= 0; i--) {
    const x = cx - hw + (w * i) / segs;
    const y = cy - Math.sin((i / segs) * waves * 2 * Math.PI) * amplitude;
    pts.push(`L ${x} ${y}`);
  }
  return pts.join(" ") + " Z";
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const wrapSigned = (value) => value - Math.round(value);

const cubicBezier = (x1, y1, x2, y2) => {
  const sample = (a1, a2, t) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
  const slope = (a1, a2, t) => 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
  return (x) => {
    if (x <= 0 || x >= 1) return x;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(x1, x2, t);
      if (Math.abs(s) < 1e-6) break;
      t = clamp(t - (sample(x1, x2, t) - x) / s, 0, 1);
    }
    return sample(y1, y2, t);
  };
};

const EASINGS = {
  linear: (t) => t,
  easeIn: cubicBezier(0.42, 0, 1, 1),
  easeOut: cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
};

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

const estimateAspect = ({ shape, radiusX, radiusY, radius, itemSize }) => {
  const wide = shape === "ellipse" || shape === "rectangle" || shape === "infinity" || shape === "wave";
  const w = (wide ? radiusX : radius) * 2 + itemSize * 1.6;
  const h = (wide ? radiusY : radius) * 2 + itemSize * 1.6;
  return w > 0 && h > 0 ? w / h : 1;
};

// Lit les options depuis les attributs data-* (data-radius-x => radiusX)
function readOptions(element) {
  const options = { ...DEFAULTS };
  const keys = Object.keys(DEFAULTS);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const raw = element.dataset[key];
    if (raw === undefined) continue;

    const base = DEFAULTS[key];
    if (typeof base === "boolean") options[key] = raw !== "false" && raw !== "0";
    else if (typeof base === "number") options[key] = Number(raw);
    else options[key] = raw;
  }

  return options;
}

export default class OrbitImages {
  constructor(element) {
    this.element = element;
    this.options = readOptions(element);
    this.mobileQuery = window.matchMedia(MOBILE_QUERY);
    this.reducedQuery =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    this.items = this.readItems();

    if (!this.items.length) return;

    this.clipId = `orbit-clip-${++uid}`;
    this.measuredAspect = null;
    this.destroyed = false;

    this.onMobileChange = this.onMobileChange.bind(this);

    this.build();
    this.initEngine();

    this.mobileQuery.addEventListener("change", this.onMobileChange);
  }

  // Récupère les logos du HTML d'origine : image + nom
  readItems() {
    const blocks = Array.from(this.element.children);
    const items = [];

    for (let i = 0; i < blocks.length; i++) {
      const img = blocks[i].querySelector("img");
      if (!img) continue;
      const name = blocks[i].querySelector("p")?.textContent.trim() || img.alt;
      items.push({ src: img.getAttribute("src"), alt: img.alt, name });
    }

    return items;
  }

  // Valeurs actives selon le mode (bureau ou mobile)
  get config() {
    const o = this.options;
    const mobile = this.mobileQuery.matches;
    return {
      ...o,
      radiusX: mobile ? o.mobileRadiusX : o.radiusX,
      radiusY: mobile ? o.mobileRadiusY : o.radiusY,
      rotation: mobile ? o.mobileRotation : o.rotation,
      itemSize: mobile ? o.mobileItemSize : o.itemSize,
    };
  }

  getPath(cfg) {
    const c = cfg.baseWidth / 2;
    switch (cfg.shape) {
      case "circle":
        return generateCirclePath(c, c, cfg.radius);
      case "square":
        return generateSquarePath(c, c, cfg.radius * 2);
      case "rectangle":
        return generateRectanglePath(c, c, cfg.radiusX * 2, cfg.radiusY * 2);
      case "triangle":
        return generateTrianglePath(c, c, cfg.radius * 2);
      case "star":
        return generateStarPath(c, c, cfg.radius, cfg.radius * cfg.starInnerRatio, cfg.starPoints);
      case "heart":
        return generateHeartPath(c, c, cfg.radius * 2);
      case "infinity":
        return generateInfinityPath(c, c, cfg.radiusX * 2, cfg.radiusY * 2);
      case "wave":
        return generateWavePath(c, c, cfg.radiusX * 2, cfg.radiusY, 3);
      case "custom":
        return cfg.customPath || generateCirclePath(c, c, cfg.radius);
      case "ellipse":
      default:
        return generateEllipsePath(c, c, cfg.radiusX, cfg.radiusY);
    }
  }

  build() {
    const cfg = this.config;
    const center = cfg.baseWidth / 2;
    const path = this.getPath(cfg);
    const layered = cfg.depth > 0 && cfg.showLabel;
    const svgNs = "http://www.w3.org/2000/svg";

    // Le HTML d'origine est remplacé par la structure de l'orbite
    this.element.textContent = "";
    this.element.classList.remove("logi-lang");
    this.element.classList.add("orbit-container", "orbit-images");
    this.element.setAttribute("role", "group");
    this.element.setAttribute("aria-label", "Logiciels et langages");

    const makePathSvg = (zIndex, hidden, withDefs) => {
      const svg = document.createElementNS(svgNs, "svg");
      svg.setAttribute("class", "orbit-path-svg");
      svg.setAttribute("data-orbit-svg", "");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");
      svg.style.zIndex = String(zIndex);
      if (hidden) svg.style.visibility = "hidden";

      const stroke = document.createElementNS(svgNs, "path");
      stroke.setAttribute("data-orbit-stroke", "");
      stroke.setAttribute("d", path);
      stroke.setAttribute("fill", "none");
      stroke.setAttribute("stroke", cfg.pathColor);
      stroke.setAttribute("stroke-linecap", "round");
      stroke.setAttribute("transform", `rotate(${cfg.rotation} ${center} ${center})`);

      if (!withDefs) {
        stroke.setAttribute("data-orbit-path", "");
        svg.appendChild(stroke);
        return svg;
      }

      // Deuxième tracé (devant le contenu central) : seule la moitié avant de l'orbite est dessinée
      const defs = document.createElementNS(svgNs, "defs");
      const clipPath = document.createElementNS(svgNs, "clipPath");
      clipPath.setAttribute("id", this.clipId);
      clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
      const rect = document.createElementNS(svgNs, "rect");
      rect.setAttribute("data-orbit-clip", "");
      clipPath.appendChild(rect);
      defs.appendChild(clipPath);
      svg.appendChild(defs);

      const g = document.createElementNS(svgNs, "g");
      g.setAttribute("clip-path", `url(#${this.clipId})`);
      g.appendChild(stroke);
      svg.appendChild(g);
      return svg;
    };

    this.element.appendChild(makePathSvg(0, !cfg.showPath, false));
    if (cfg.showPath && layered) this.element.appendChild(makePathSvg(105, false, true));

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const el = document.createElement("div");
      el.className = "orbit-item";
      el.setAttribute("data-orbit-item", String(i));
      if (cfg.clickToFront) el.setAttribute("data-clickable", "");

      const inner = document.createElement("div");
      inner.className = "orbit-item-inner";

      const img = document.createElement("img");
      img.className = "orbit-image";
      img.src = item.src;
      img.alt = item.alt;
      img.draggable = false;
      img.decoding = "async";

      inner.appendChild(img);
      el.appendChild(inner);
      this.element.appendChild(el);
    }

    // Nom du logo au premier plan (ou survolé), au centre de l'orbite
    if (cfg.showLabel) {
      const center$ = document.createElement("div");
      center$.className = "orbit-center-content";
      center$.setAttribute("data-orbit-center", "");
      this.label = document.createElement("p");
      this.label.className = "orbit-images_label";
      this.label.setAttribute("aria-hidden", "true");
      center$.appendChild(this.label);
      this.element.appendChild(center$);
    }

    // Liste cachée visuellement : les lecteurs d'écran lisent les noms comme avant
    const list = document.createElement("ul");
    list.className = "orbit-images_sr";
    for (let i = 0; i < this.items.length; i++) {
      const li = document.createElement("li");
      li.textContent = this.items[i].name;
      list.appendChild(li);
    }
    this.element.appendChild(list);

    this.applyContainerStyle();
  }

  applyContainerStyle() {
    const cfg = this.config;
    const style = this.element.style;
    const aspect = this.measuredAspect ?? estimateAspect(cfg);

    style.width = "100%";
    style.aspectRatio = String(aspect);
    style.setProperty(
      "--orbit-radius",
      typeof cfg.itemRadius === "number" ? `${(cfg.itemRadius / Math.max(1, cfg.itemSize)) * 100}%` : cfg.itemRadius
    );
    style.setProperty("--orbit-shadow", String(clamp(cfg.shadow, 0, 1)));
    style.setProperty("--orbit-hover-scale", String(cfg.hoverScale));

    if (cfg.draggable) this.element.setAttribute("data-draggable", "");
    else this.element.removeAttribute("data-draggable");
    if (cfg.intro && !this.engine) this.element.setAttribute("data-intro", "");
  }

  setAspect(aspect) {
    this.measuredAspect = aspect;
    this.element.style.aspectRatio = String(aspect);
  }

  // Passage bureau <-> mobile : on reconstruit l'orbite avec les nouvelles valeurs
  onMobileChange() {
    if (this.destroyed) return;
    this.engine?.destroy();
    this.engine = null;
    this.measuredAspect = null;
    this.build();
    this.initEngine();
  }

  initEngine() {
    this.engine = this.createEngine();
    this.engine.refresh();
  }

  createEngine() {
    const root = this.element;
    const owner = this;
    const query = this.reducedQuery;

    const st = {
      lut: null,
      length: 0,
      front: 0,
      yMid: 0,
      yHalf: 1,
      bbox: [0, 0, 1, 1],
      width: 0,
      height: 0,
      scale: 0,
      size: 0,
      items: [],
      strokes: [],
      lap: 0,
      manual: 0,
      glide: 0,
      speed: 1,
      drag: null,
      seek: null,
      hovered: false,
      hoverIndex: -1,
      frontIndex: -1,
      shownIndex: -2,
      suppressUntil: 0,
      introStart: -1,
      introDone: !this.config.intro,
      visible: typeof IntersectionObserver === "undefined",
      reduced: !!query?.matches,
      raf: 0,
      last: 0,
      destroyed: false,
    };
    st.speed = st.reduced || this.config.paused ? 0 : 1;

    const cfgNow = () => owner.config;

    const collect = () => {
      st.items = Array.from(root.querySelectorAll("[data-orbit-item]")).map((el) => ({ el, t: "", o: "", z: "" }));
      st.strokes = Array.from(root.querySelectorAll("[data-orbit-stroke]"));
    };

    const build = () => {
      const cfg = cfgNow();
      const path = root.querySelector("[data-orbit-path]");
      let length = 0;
      try {
        length = path ? path.getTotalLength() : 0;
      } catch {
        length = 0;
      }
      if (!path || !length || !isFinite(length)) {
        st.lut = null;
        return;
      }
      const lut = new Float32Array(SAMPLES * 2);
      const angle = (cfg.rotation * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const origin = cfg.baseWidth / 2;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      let front = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const point = path.getPointAtLength((i / SAMPLES) * length);
        const dx = point.x - origin;
        const dy = point.y - origin;
        const x = origin + dx * cos - dy * sin;
        const y = origin + dx * sin + dy * cos;
        lut[i * 2] = x;
        lut[i * 2 + 1] = y;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        if (y > lut[front * 2 + 1] + 1e-6) front = i;
      }
      st.lut = lut;
      st.length = length;
      st.front = front / SAMPLES;
      st.yMid = (y0 + y1) / 2;
      st.yHalf = Math.max(1e-3, (y1 - y0) / 2);
      const depth = clamp(cfg.depth, 0, 1);
      const margin = (cfg.itemSize / 2) * (1 + depth * FRONT_GROW) * Math.max(1, cfg.hoverScale) + 2;
      st.bbox = [x0 - margin, y0 - margin, x1 + margin, y1 + margin];
      owner.setAspect((x1 - x0 + margin * 2) / (y1 - y0 + margin * 2));
    };

    const applyDash = (reveal) => {
      const cfg = cfgNow();
      const dash = cfg.pathDash > 0 && st.scale ? cfg.pathDash / st.scale : 0;
      for (const stroke of st.strokes) {
        if (reveal < 1 && !dash) {
          stroke.style.strokeDasharray = `${st.length} ${st.length}`;
          stroke.style.strokeDashoffset = String(st.length * (1 - reveal));
          stroke.style.opacity = "";
        } else {
          stroke.style.strokeDasharray = dash ? `${dash} ${dash * 1.6}` : "";
          stroke.style.strokeDashoffset = "";
          stroke.style.opacity = reveal < 1 ? String(reveal) : "";
        }
      }
    };

    const layout = () => {
      const cfg = cfgNow();
      st.width = root.clientWidth;
      st.height = root.clientHeight;
      if (!st.lut) return;
      const [bx0, by0, bx1, by1] = st.bbox;
      const scale = Math.min(st.width / (bx1 - bx0), st.height / (by1 - by0));
      st.scale = scale > 0 && isFinite(scale) ? scale : 0;
      st.size = cfg.itemSize * st.scale;
      for (const it of st.items) {
        it.el.style.width = `${st.size}px`;
        it.el.style.height = `${st.size}px`;
      }
      if (!st.scale) return;
      const vw = st.width / st.scale;
      const vh = st.height / st.scale;
      const cx = (bx0 + bx1) / 2;
      const cy = (by0 + by1) / 2;
      root.querySelectorAll("[data-orbit-svg]").forEach((svg) => {
        svg.setAttribute("viewBox", `${cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`);
      });
      const clip = root.querySelector("[data-orbit-clip]");
      if (clip) {
        clip.setAttribute("x", String(cx - vw));
        clip.setAttribute("y", String(st.yMid));
        clip.setAttribute("width", String(vw * 2));
        clip.setAttribute("height", String(vh * 2));
      }
      for (const stroke of st.strokes) {
        stroke.style.strokeWidth = String(cfg.pathWidth / st.scale);
      }
      applyDash(1);
    };

    const sample = (u) => {
      const f = (((u % 1) + 1) % 1) * SAMPLES;
      const i0 = Math.floor(f) % SAMPLES;
      const i1 = (i0 + 1) % SAMPLES;
      const t = f - Math.floor(f);
      const lut = st.lut;
      return [
        lut[i0 * 2] + (lut[i1 * 2] - lut[i0 * 2]) * t,
        lut[i0 * 2 + 1] + (lut[i1 * 2 + 1] - lut[i0 * 2 + 1]) * t,
      ];
    };

    const heading = (u) => {
      const a = sample(u - 2 / SAMPLES);
      const b = sample(u + 2 / SAMPLES);
      return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    };

    const progress = () => {
      const cfg = cfgNow();
      const ease = EASINGS[cfg.easing] || EASINGS.linear;
      const whole = Math.floor(st.lap);
      return (whole + ease(st.lap - whole)) * (cfg.direction === "reverse" ? -1 : 1) + st.manual;
    };

    const offsetOf = (index, count) => {
      const cfg = cfgNow();
      if (cfg.fill) return index / Math.max(1, count);
      return (-index * cfg.itemSize * 1.3) / Math.max(1, st.length);
    };

    const write = (it, key, prop, value) => {
      if (it[key] !== value) {
        it[key] = value;
        it.el.style[prop] = value;
      }
    };

    // Affiche le nom du logo survolé, sinon celui du logo au premier plan
    const updateLabel = () => {
      if (!owner.label) return;
      const index = st.hoverIndex >= 0 ? st.hoverIndex : st.frontIndex;
      if (index === st.shownIndex) return;
      st.shownIndex = index;
      owner.label.textContent = index >= 0 ? owner.items[index].name : "";
    };

    const render = (now) => {
      const cfg = cfgNow();
      if (!st.lut || !st.scale) return;
      const p = progress();
      const count = st.items.length;
      const depth = clamp(cfg.depth, 0, 1);
      const [bx0, by0, bx1, by1] = st.bbox;
      const cx = (bx0 + bx1) / 2;
      const cy = (by0 + by1) / 2;
      const half = st.size / 2;
      const introRunning = st.introStart >= 0;
      const elapsed = introRunning ? (now - st.introStart) / 1000 : 0;
      const spread = introRunning ? easeOutQuint(clamp(elapsed / INTRO_SPREAD, 0, 1)) : 1;
      const appear = introRunning ? clamp(elapsed / INTRO_FADE, 0, 1) : 1;
      let frontIndex = -1;
      let frontD = -Infinity;
      for (let i = 0; i < count; i++) {
        const it = st.items[i];
        let u = p + offsetOf(i, count);
        if (introRunning) u = st.front + wrapSigned(u - st.front) * spread;
        const [x, y] = sample(u);
        const d = clamp((y - st.yMid) / st.yHalf, -1, 1);
        if (d > frontD) {
          frontD = d;
          frontIndex = i;
        }
        const w = (d + 1) / 2;
        let scale = 1 + depth * (FRONT_GROW * w - BACK_SHRINK * (1 - w));
        let opacity = 1 - depth * BACK_DIM * (1 - w);
        if (introRunning) {
          scale *= 0.7 + 0.3 * appear;
          opacity *= appear * appear * (3 - 2 * appear);
        }
        const sx = (x - cx) * st.scale + st.width / 2 - half;
        const sy = (y - cy) * st.scale + st.height / 2 - half;
        const rot = cfg.alignToPath ? heading(u) : 0;
        let z = depth > 0 ? (d <= 0 ? 10 + Math.round((d + 1) * 80) : 110 + Math.round(d * 80)) : 1;
        if (i === st.hoverIndex) z += 200;
        write(
          it,
          "t",
          "transform",
          `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0px)${rot ? ` rotate(${rot.toFixed(2)}deg)` : ""} scale(${scale.toFixed(4)})`
        );
        write(it, "o", "opacity", opacity > 0.999 ? "" : opacity.toFixed(3));
        write(it, "z", "zIndex", String(z));
      }
      st.frontIndex = frontIndex;
      updateLabel();
      if (introRunning) applyDash(easeOutQuint(clamp(elapsed / INTRO_SPREAD, 0, 1)));
    };

    const frame = (now) => {
      st.raf = 0;
      if (st.destroyed) return;
      const cfg = cfgNow();
      const dt = st.last ? clamp((now - st.last) / 1000, 0, 0.1) : 0;
      st.last = now;
      let busy = false;
      if (st.lut && st.scale && st.introStart === -1 && !st.introDone && st.visible) {
        if (cfg.intro && !st.reduced) {
          st.introStart = now;
        } else {
          st.introDone = true;
        }
        root.removeAttribute("data-intro");
      }
      if (st.introStart >= 0) {
        if ((now - st.introStart) / 1000 >= INTRO_SPREAD) {
          st.introStart = -2;
          st.introDone = true;
          applyDash(1);
        } else {
          busy = true;
        }
      }
      const want = cfg.paused || st.reduced ? 0 : st.hovered ? clamp(cfg.hoverSpeed, 0, 1) : 1;
      if (st.speed !== want) {
        st.speed += (want - st.speed) * (1 - Math.exp(-dt / 0.35));
        if (Math.abs(st.speed - want) < 0.002) st.speed = want;
        busy = true;
      }
      if (st.speed > 0 && cfg.duration > 0) {
        st.lap += (dt * st.speed) / cfg.duration;
        busy = true;
      }
      if (st.drag?.active) {
        busy = true;
      } else if (st.seek) {
        st.seek.t = Math.min(1, st.seek.t + dt / st.seek.dur);
        const e = st.seek.t < 0.5 ? 4 * st.seek.t ** 3 : 1 - Math.pow(-2 * st.seek.t + 2, 3) / 2;
        st.manual = st.seek.from + st.seek.delta * e;
        if (st.seek.t >= 1) st.seek = null;
        busy = true;
      } else if (st.glide) {
        st.manual += st.glide * dt;
        st.glide *= Math.exp(-dt / 0.7);
        if (Math.abs(st.glide) < 0.0004) st.glide = 0;
        busy = true;
      }
      render(now);
      const whole = Math.floor(st.lap);
      if (whole) st.lap -= whole;
      if (!st.drag && !st.seek) st.manual -= Math.floor(st.manual);
      if (busy && st.visible && !st.destroyed) st.raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (st.raf || st.destroyed || !st.visible) return;
      st.last = 0;
      st.raf = requestAnimationFrame(frame);
    };

    const local = (e) => {
      const r = root.getBoundingClientRect();
      const k = root.offsetWidth ? r.width / root.offsetWidth || 1 : 1;
      return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
    };

    const dragRate = () => {
      if (!st.lut || !st.scale) return 0;
      const a = sample(st.front - 3 / SAMPLES);
      const b = sample(st.front + 3 / SAMPLES);
      const along = ((b[0] - a[0]) / (6 / SAMPLES)) * st.scale;
      const floor = st.length * st.scale * 0.35;
      return Math.abs(along) < floor ? Math.sign(along || 1) * floor : along;
    };

    const itemIndex = (target) => {
      const el = target instanceof Element ? target.closest("[data-orbit-item]") : null;
      return el && root.contains(el) ? Number(el.getAttribute("data-orbit-item")) : -1;
    };

    const bringToFront = (index) => {
      if (!st.lut || index < 0) return;
      const u = progress() + offsetOf(index, st.items.length);
      const delta = wrapSigned(st.front - u);
      st.glide = 0;
      st.seek = { from: st.manual, delta, t: 0, dur: 0.45 + Math.abs(delta) * 1.4 };
      wake();
    };

    const onEnter = () => {
      st.hovered = true;
      wake();
    };

    const onLeave = () => {
      st.hovered = false;
      st.hoverIndex = -1;
      updateLabel();
      wake();
    };

    const onOver = (e) => {
      const index = itemIndex(e.target);
      if (index !== st.hoverIndex) {
        st.hoverIndex = index;
        updateLabel();
        if (st.lut) render(performance.now());
      }
    };

    const onDown = (e) => {
      const cfg = cfgNow();
      if (!cfg.draggable || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.target instanceof Element && e.target.closest("[data-orbit-center]")) return;
      const [x, y] = local(e);
      st.drag = { id: e.pointerId, x, y, active: false, samples: [], rate: dragRate(), anchor: 0, manual: 0 };
    };

    const onMove = (e) => {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      const [x, y] = local(e);
      const along = x - d.x;
      if (!d.active) {
        if (Math.abs(along) < DRAG_THRESHOLD) return;
        if (Math.abs(y - d.y) > Math.abs(along)) {
          st.drag = null;
          return;
        }
        d.active = true;
        d.anchor = along;
        d.manual = st.manual;
        st.seek = null;
        st.glide = 0;
        try {
          root.setPointerCapture(e.pointerId);
        } catch {}
        root.setAttribute("data-dragging", "");
      }
      if (d.rate) st.manual = d.manual + (along - d.anchor) / d.rate;
      const now = performance.now();
      d.samples.push([now, along]);
      while (d.samples.length > 2 && now - d.samples[0][0] > 100) d.samples.shift();
      wake();
    };

    const endDrag = (e, cancelled) => {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      st.drag = null;
      if (!d.active) return;
      root.removeAttribute("data-dragging");
      try {
        root.releasePointerCapture(e.pointerId);
      } catch {}
      const now = performance.now();
      st.suppressUntil = now + 400;
      const s = d.samples;
      if (!cancelled && s.length > 1 && d.rate) {
        const [t0, a0] = s[0];
        const [t1, a1] = s[s.length - 1];
        if (t1 > t0 && now - t1 < 80) st.glide = clamp((((a1 - a0) / (t1 - t0)) * 1000) / d.rate, -3, 3);
      }
      wake();
    };

    const onUp = (e) => endDrag(e, false);
    const onCancel = (e) => endDrag(e, true);

    const activate = (index) => {
      const cfg = cfgNow();
      if (index < 0) return;
      if (cfg.clickToFront) bringToFront(index);
    };

    const onClick = (e) => {
      if (performance.now() < st.suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
        st.suppressUntil = 0;
        return;
      }
      activate(itemIndex(e.target));
    };

    const onMotion = () => {
      st.reduced = !!query?.matches;
      wake();
    };

    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onCancel);
    root.addEventListener("lostpointercapture", onCancel);
    root.addEventListener("click", onClick);
    query?.addEventListener?.("change", onMotion);

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        layout();
        render(performance.now());
        wake();
      });
      resizeObserver.observe(root);
    }

    let intersection = null;
    if (typeof IntersectionObserver !== "undefined") {
      intersection = new IntersectionObserver(
        (entries) => {
          st.visible = entries[entries.length - 1].isIntersecting;
          if (st.visible) wake();
        },
        { threshold: 0.05 }
      );
      intersection.observe(root);
    }

    const onVisibility = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", wake);

    const refresh = () => {
      collect();
      build();
      layout();
      render(performance.now());
      wake();
    };

    const destroy = () => {
      st.destroyed = true;
      if (st.raf) cancelAnimationFrame(st.raf);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onCancel);
      root.removeEventListener("lostpointercapture", onCancel);
      root.removeEventListener("click", onClick);
      query?.removeEventListener?.("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", wake);
      resizeObserver?.disconnect();
      intersection?.disconnect();
    };

    return { refresh, wake, destroy };
  }

  destroy() {
    this.destroyed = true;
    this.mobileQuery?.removeEventListener("change", this.onMobileChange);
    this.engine?.destroy();
    this.engine = null;
  }
}
