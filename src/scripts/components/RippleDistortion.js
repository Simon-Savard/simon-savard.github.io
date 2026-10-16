import { Renderer, Program, Mesh, Geometry, Triangle, Texture, RenderTarget } from "ogl";

// Adaptation vanilla JS du composant <RippleDistortion /> de React Bits.
// Utilisation : un conteneur qui contient une <img>
//   <div class="card_media" data-component="RippleDistortion"> <img src="..." alt="..."> </div>
// L'image reste dans le DOM (accessibilité / SEO) ; un canvas WebGL est affiché par-dessus.
// Chaque option peut être surchargée avec un attribut data-*, ex. : data-strength="0.1" data-tint="#ff0000"

const DEFAULTS = {
  brushSize: 150,
  strength: 0.1,
  swirl: 0.5,
  rings: 1,
  spread: 5,
  fade: 3,
  spacing: 6,
  dispersion: 0,
  glint: 0,
  tint: "#e400c6",
  tintAmount: 0.1,
  highlightColor: "#ffffff",
  grayscale: false,
  trigger: "hover", // 'hover' | 'click' | 'both'
  clickStrength: 2,
  quality: "low", // 'low' | 'medium' | 'high'
  enabled: true,
};

const MAX_WAVES = 100;
const QUALITY_SCALE = { low: 0.4, medium: 0.7, high: 1 };
const START_SCALE = 1.5;
const LIFE_CONSTANT = Math.log(500);

const waveVertex = `
precision highp float;

attribute vec2 position;
attribute vec2 uv;
attribute vec2 iOffset;
attribute vec2 iScale;
attribute float iOpacity;

varying vec2 vUv;
varying float vOpacity;

void main() {
  vUv = uv;
  vOpacity = iOpacity;
  gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);
}
`;

const waveFragment = `
precision highp float;

varying vec2 vUv;
varying float vOpacity;

uniform float uRings;

const float PI = 3.141592653589793;
const float EDGE = 0.006737947;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;

  float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);

  brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);

  gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);
}
`;

const screenVertex = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const compositeFragment = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform vec2 uTexel;
uniform vec3 uTint;
uniform vec3 uHighlight;
uniform float uStrength;
uniform float uSwirl;
uniform float uDispersion;
uniform float uGlint;
uniform float uTintAmount;
uniform float uGrayscale;

const float TAU = 6.283185307179586;

vec2 coverUV(vec2 uv) {
  vec2 safe = max(uTextureSize, vec2(1.0));
  vec2 s = uResolution / safe;
  vec2 scaledSize = safe * max(s.x, s.y);
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  float amount = texture2D(uDisplacement, vUv).r;
  vec2 base = coverUV(vUv);

  float theta = amount * uSwirl * TAU;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 push = dir * amount * uStrength;

  vec3 color;
  if (uDispersion > 0.001) {
    float split = uDispersion * 0.25;
    color.r = texture2D(uTexture, base + push * (1.0 + split)).r;
    color.g = texture2D(uTexture, base + push).g;
    color.b = texture2D(uTexture, base + push * (1.0 - split)).b;
  } else {
    color = texture2D(uTexture, base + push).rgb;
  }

  if (uGrayscale > 0.001) {
    color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), uGrayscale);
  }

  if (uTintAmount > 0.001) {
    color = mix(color, color * uTint * 1.9, clamp(amount * 1.6, 0.0, 1.0) * uTintAmount);
  }

  if (uGlint > 0.001) {
    float ex = texture2D(uDisplacement, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDisplacement, vUv - vec2(uTexel.x, 0.0)).r;
    float ey = texture2D(uDisplacement, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDisplacement, vUv - vec2(0.0, uTexel.y)).r;
    vec3 normal = normalize(vec3(-ex * 26.0, -ey * 26.0, 1.0));
    vec3 light = normalize(vec3(-0.35, 0.55, 1.0));
    float raw = pow(max(dot(normal, light), 0.0), 22.0);
    float flatSpec = pow(max(light.z, 0.0), 22.0);
    color += uHighlight * clamp((raw - flatSpec) / max(1.0 - flatSpec, 0.0001), 0.0, 1.0) * uGlint;
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

const hexToRGB = (hex) => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export default class RippleDistortion {
  constructor(element) {
    this.element = element;
    this.sourceImage = element.querySelector("img");
    this.options = this.readOptions();

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.raf = 0;
    this.isVisible = true;
    this.isPageVisible = !document.hidden;
    this.needsRender = true;
    this.previousTime = 0;
    this.previousX = 0;
    this.previousY = 0;
    this.current = 0;
    this.width = 1;
    this.height = 1;
    this.disposed = false;

    // Sans image ou avec « moins d'animations » : on laisse l'image d'origine
    if (!this.sourceImage || this.reducedMotion) return;

    this.init();
  }

  // Les valeurs par défaut sont surchargées par les attributs data-* de l'élément
  readOptions() {
    const options = { ...DEFAULTS };

    for (const key in DEFAULTS) {
      if (!(key in this.element.dataset)) continue;

      const raw = this.element.dataset[key];
      const type = typeof DEFAULTS[key];

      if (type === "number") options[key] = parseFloat(raw);
      else if (type === "boolean") options[key] = raw === "true";
      else options[key] = raw;
    }

    return options;
  }

  init() {
    this.renderer = new Renderer({
      alpha: false,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.gl = this.renderer.gl;
    if (!this.gl) return;

    const gl = this.gl;
    gl.clearColor(0, 0, 0, 1);

    this.canvas = gl.canvas;
    this.canvas.classList.add("ripple-distortion_canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.element.classList.add("ripple-distortion");
    this.element.appendChild(this.canvas);

    this.createTexture();
    this.createWaves();
    this.createComposite();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.element);
    this.onResize();

    this.onMove = this.onMove.bind(this);
    this.onDown = this.onDown.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.loop = this.loop.bind(this);

    // Le canvas est recouvert par des dégradés / textes (cartes) : on écoute la fenêtre
    // et on calcule la position du pointeur par rapport au conteneur.
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerdown", this.onDown, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        this.isVisible ? this.start() : this.stop();
      },
      { threshold: 0 }
    );
    this.intersectionObserver.observe(this.element);

    this.start();
  }

  createTexture() {
    const gl = this.gl;

    this.imageTexture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      if (this.disposed) return;
      this.imageTexture.image = image;
      this.compositeUniforms.uTextureSize.value = [image.naturalWidth || 1, image.naturalHeight || 1];
      this.needsRender = true;
      // L'image d'origine est cachée seulement une fois le canvas prêt
      this.element.classList.add("is-ready");
    };
    image.src = this.sourceImage.currentSrc || this.sourceImage.src;
  }

  createWaves() {
    const gl = this.gl;

    this.offsets = new Float32Array(MAX_WAVES * 2);
    this.scales = new Float32Array(MAX_WAVES * 2);
    this.opacities = new Float32Array(MAX_WAVES);

    this.waves = Array.from({ length: MAX_WAVES }, () => ({
      x: 0,
      y: 0,
      scale: START_SCALE,
      target: START_SCALE,
      size: 1,
      opacity: 0,
    }));

    this.geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]) },
      uv: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]) },
      iOffset: { instanced: 1, size: 2, data: this.offsets },
      iScale: { instanced: 1, size: 2, data: this.scales },
      iOpacity: { instanced: 1, size: 1, data: this.opacities },
    });

    this.waveUniforms = { uRings: { value: this.options.rings } };

    const waveProgram = new Program(gl, {
      vertex: waveVertex,
      fragment: waveFragment,
      uniforms: this.waveUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    });
    waveProgram.setBlendFunc(gl.ONE, gl.ONE);

    this.waveMesh = new Mesh(gl, { geometry: this.geometry, program: waveProgram, frustumCulled: false });

    this.displacementTarget = new RenderTarget(gl, {
      width: 2,
      height: 2,
      depth: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });
  }

  createComposite() {
    const gl = this.gl;
    const o = this.options;

    this.compositeUniforms = {
      uTexture: { value: this.imageTexture },
      uDisplacement: { value: this.displacementTarget.texture },
      uResolution: { value: [1, 1] },
      uTextureSize: { value: [1, 1] },
      uTexel: { value: [1, 1] },
      uTint: { value: hexToRGB(o.tint) },
      uHighlight: { value: hexToRGB(o.highlightColor) },
      uStrength: { value: o.strength },
      uSwirl: { value: o.swirl },
      uDispersion: { value: o.dispersion },
      uGlint: { value: o.glint },
      uTintAmount: { value: o.tintAmount },
      uGrayscale: { value: o.grayscale ? 1 : 0 },
    };

    this.compositeMesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, {
        vertex: screenVertex,
        fragment: compositeFragment,
        uniforms: this.compositeUniforms,
        depthTest: false,
        depthWrite: false,
      }),
    });
  }

  onResize() {
    this.width = Math.max(1, this.element.clientWidth);
    this.height = Math.max(1, this.element.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.compositeUniforms.uResolution.value = [this.width, this.height];

    const scale = QUALITY_SCALE[this.options.quality] || QUALITY_SCALE.high;
    const fieldW = Math.max(2, Math.round(this.width * scale));
    const fieldH = Math.max(2, Math.round(this.height * scale));
    this.displacementTarget.setSize(fieldW, fieldH);
    this.compositeUniforms.uTexel.value = [1 / fieldW, 1 / fieldH];

    // setSize efface le canvas : il faut redessiner
    this.needsRender = true;
  }

  // Position du pointeur dans le conteneur (origine en bas à gauche), ou null si en dehors
  localPoint(clientX, clientY) {
    const rect = this.element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    return [clientX - rect.left, rect.height - (clientY - rect.top)];
  }

  setNewWave(x, y, power) {
    const o = this.options;
    const wave = this.waves[this.current];
    this.current = (this.current + 1) % MAX_WAVES;
    wave.x = x;
    wave.y = y;
    wave.scale = START_SCALE * power;
    wave.target = START_SCALE * Math.max(1, o.spread) * power;
    wave.size = Math.max(1, o.brushSize);
    wave.opacity = 1;
    this.needsRender = true;
  }

  onMove(event) {
    const o = this.options;
    if (!o.enabled || !this.isVisible || o.trigger === "click") return;

    const point = this.localPoint(event.clientX, event.clientY);
    if (!point) return;

    const step = Math.max(1, o.spacing);
    if (Math.abs(point[0] - this.previousX) > step || Math.abs(point[1] - this.previousY) > step) {
      this.setNewWave(point[0], point[1], 1);
      this.previousX = point[0];
      this.previousY = point[1];
    }
  }

  onDown(event) {
    const o = this.options;
    if (!o.enabled || !this.isVisible || o.trigger === "hover") return;

    const point = this.localPoint(event.clientX, event.clientY);
    if (!point) return;

    this.setNewWave(point[0], point[1], Math.max(1, o.clickStrength));
  }

  onVisibility() {
    this.isPageVisible = !document.hidden;
    this.isPageVisible && this.isVisible ? this.start() : this.stop();
  }

  start() {
    if (this.raf || !this.isPageVisible || !this.isVisible) return;
    this.previousTime = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);

    const o = this.options;
    const delta = this.previousTime ? Math.min(0.05, (now - this.previousTime) / 1000) : 0;
    this.previousTime = now;

    const growth = 1 - Math.exp(-delta * 1.09);
    const decay = Math.exp((-delta * LIFE_CONSTANT) / Math.max(0.15, o.fade));

    let alive = false;

    for (let i = 0; i < MAX_WAVES; i += 1) {
      const wave = this.waves[i];
      if (wave.opacity <= 0) {
        this.opacities[i] = 0;
        continue;
      }

      wave.opacity *= decay;
      wave.scale += (wave.target - wave.scale) * growth;

      if (wave.opacity < 0.002) {
        wave.opacity = 0;
        this.opacities[i] = 0;
        continue;
      }

      alive = true;
      const half = (wave.scale * wave.size) / 2;
      this.offsets[i * 2] = (wave.x / this.width) * 2 - 1;
      this.offsets[i * 2 + 1] = (wave.y / this.height) * 2 - 1;
      this.scales[i * 2] = (half / this.width) * 2;
      this.scales[i * 2 + 1] = (half / this.height) * 2;
      this.opacities[i] = wave.opacity;
    }

    // Au repos (aucune vague) on ne redessine pas : économise le GPU
    if (!alive && !this.needsRender) return;

    this.geometry.attributes.iOffset.needsUpdate = true;
    this.geometry.attributes.iScale.needsUpdate = true;
    this.geometry.attributes.iOpacity.needsUpdate = true;

    this.renderer.render({ scene: this.waveMesh, target: this.displacementTarget, clear: true });
    this.renderer.render({ scene: this.compositeMesh });

    // Une dernière image est dessinée quand la dernière vague disparaît (alive = false mais needsRender = true)
    this.needsRender = alive;
  }

  destroy() {
    this.disposed = true;
    this.stop();

    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerdown", this.onDown);
    document.removeEventListener("visibilitychange", this.onVisibility);

    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.intersectionObserver) this.intersectionObserver.disconnect();

    if (this.canvas && this.canvas.parentNode === this.element) {
      this.element.removeChild(this.canvas);
    }

    const ext = this.gl && this.gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();

    this.element.classList.remove("ripple-distortion", "is-ready");
  }
}
