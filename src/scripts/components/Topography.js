import { Renderer, Program, Mesh, Triangle } from "ogl";

// Adaptation vanilla JS du composant <Topography /> de React Bits.
// Utilisation : <div class="topography" data-component="Topography"></div>
// Chaque option peut être surchargée avec un attribut data-*, ex. : data-low-color="#000" data-glow="2"

const DEFAULTS = {
  lowColor: "#37002b",
  midColor: "#6e0060",
  highColor: "#ba00a1",
  speed: 0.6,
  morphAmount: 0.5,
  morphSpeed: 0.2,
  bands: 2.0,
  thickness: 0.2,
  scale: 0.8,
  pixelSize: 1.0,
  glow: 1.5,
  colorMode: "elevation", // 'elevation' | 'uniform' | 'alternating'
  contrast: 3.0,
  brightness: 0.4,
  fillBands: false,
  opacity: 1.0,
  grain: false,
  grainIntensity: 0,
  mouseInteraction: true,
  mouseRadius: 0.5,
  mouseStrength: 1.5,
  lightMode: false,
  // Si true, une seule image fixe est affichée quand l'OS demande moins d'animations
  respectReducedMotion: false,
};

const CTRL_INDICES = [
  [1, -2, 3, -4],
  [9, -8, 7, -6],
  [5, 2, 5, -5],
  [-1, -3, 8, 9],
];

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uMorphAmount;
uniform float uBands;
uniform float uThickness;
uniform float uScale;
uniform float uPixelSize;
uniform float uGlow;
uniform float uColorMode;
uniform float uContrast;
uniform float uBrightness;
uniform float uFillBands;
uniform float uOpacity;
uniform float uLightMode;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec2 uMouse;
uniform float uMouseEnabled;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uMouseActive;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec4 uCtrlA;
uniform vec4 uCtrlB;
uniform vec4 uCtrlC;
uniform vec4 uCtrlD;
out vec4 fragColor;

float bez(float t, vec4 c) {
  float w = 6.2831853 * t;
  return 0.5 * (c.x * sin(w) + c.y * cos(w) + c.z * sin(2.0 * w) + c.w * cos(2.0 * w));
}

float field(vec2 uv) {
  vec2 a = vec2(bez(uv.x, uCtrlA), bez(uv.x, uCtrlB));
  vec2 b = vec2(bez(uv.y, uCtrlC), bez(uv.y, uCtrlD));
  return distance(a, b);
}

vec3 elevationColor(float e) {
  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.5, e));
  c = mix(c, uHigh, smoothstep(0.5, 1.0, e));
  return c;
}

void main() {
  vec2 res = iResolution.xy;
  vec2 uv = gl_FragCoord.xy / res;

  vec2 suv = (uv - 0.5) / max(uScale, 0.001) + 0.5;

  vec2 sampleUv = suv;
  if (uPixelSize > 1.0) {
    vec2 px = res / uPixelSize;
    sampleUv = (floor(suv * px) + 0.5) / px;
  }

  float fv = field(sampleUv);

  if (uMouseEnabled > 0.5) {
    vec2 d = uv - uMouse;
    d.x *= res.x / max(res.y, 1.0);
    float r = max(uMouseRadius, 0.001);
    float bump = exp(-dot(d, d) / (r * r)) * uMouseStrength * uMouseActive;
    fv += bump;
  }

  float f = fv * uBands;
  float frac = fract(f);
  float lineDist = min(frac, 1.0 - frac);

  float aa = fwidth(f) + 0.0001;
  float mask = 1.0 - smoothstep(uThickness - aa, uThickness + aa, lineDist);

  float glowR = uThickness + uGlow * 0.5 + aa;
  float glow = (1.0 - smoothstep(uThickness, glowR, lineDist)) * step(0.0001, uGlow);

  float elev = clamp(fv / (uMorphAmount * 2.5 + 0.001), 0.0, 1.0);

  vec3 lineCol;
  if (uColorMode < 0.5) {
    lineCol = elevationColor(elev);
  } else if (uColorMode < 1.5) {
    lineCol = uMid;
  } else {
    float parity = mod(floor(f), 2.0);
    lineCol = mix(uMid, uHigh, parity);
  }

  float coverage = clamp(mask + glow * 0.55, 0.0, 1.0);
  coverage = pow(coverage, max(uContrast, 0.001));

  vec3 outColor = lineCol;
  float outAlpha = coverage;

  if (uFillBands > 0.5) {
    vec3 fillCol = elevationColor(elev);
    float fillA = 0.1 * elev;
    outColor = mix(fillCol, lineCol, coverage);
    outAlpha = clamp(coverage + fillA, 0.0, 1.0);
  }

  if (uGrain > 0.5) {
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453);
    outAlpha += (g - 0.5) * uGrainIntensity;
  }

  outColor *= uBrightness;
  outColor = clamp(outColor, 0.0, 1.0);

  float a = clamp(outAlpha, 0.0, 1.0) * uOpacity;
  if (uLightMode > 0.5) {
    float peak = max(outColor.r, max(outColor.g, outColor.b));
    vec3 chroma = pow(clamp(outColor / max(peak, 0.0001), 0.0, 1.0), vec3(1.18));
    fragColor = vec4(mix(vec3(1.0), chroma, a * 0.94), 1.0);
  } else {
    fragColor = vec4(outColor * a, a);
  }
}
`;

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};

const colorModeToFloat = (mode) => {
  if (mode === "uniform") return 1.0;
  if (mode === "alternating") return 2.0;
  return 0.0;
};

export default class Topography {
  constructor(element) {
    this.element = element;
    this.options = this.readOptions();

    this.raf = 0;
    this.isVisible = true;
    this.isPageVisible = !document.hidden;
    this.reducedMotion =
      this.options.respectReducedMotion &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.currentMouse = [0.5, 0.5];
    this.targetMouse = [0.5, 0.5];
    this.mouseActive = 0;
    this.mouseActiveTarget = 0;

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
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });

    this.gl = this.renderer.gl;

    // WebGL2 non supporté : on laisse simplement le fond de la page
    if (!this.gl) return;

    this.gl.clearColor(0, 0, 0, 0);
    this.canvas = this.gl.canvas;
    this.element.appendChild(this.canvas);

    this.createMesh();
    this.setUniforms();

    this.resizeObserver = new ResizeObserver(this.onResize.bind(this));
    this.resizeObserver.observe(this.element);
    this.onResize();

    if (this.reducedMotion) {
      // Une seule image fixe, pas d'animation
      this.update(0);
      return;
    }

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.loop = this.loop.bind(this);

    // Le canvas est derrière le contenu du hero (z-index négatif) :
    // on écoute donc la fenêtre et on calcule la position par rapport au canvas.
    window.addEventListener("mousemove", this.onMouseMove);
    document.documentElement.addEventListener("mouseleave", this.onMouseLeave);
    document.addEventListener("visibilitychange", this.onVisibility);

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        this.isVisible ? this.start() : this.stop();
      },
      { threshold: 0 }
    );
    this.intersectionObserver.observe(this.element);

    this.t0 = performance.now();
    this.start();
  }

  createMesh() {
    const gl = this.gl;

    this.program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uMorphAmount: { value: 0 },
        uBands: { value: 0 },
        uThickness: { value: 0 },
        uScale: { value: 1 },
        uPixelSize: { value: 1 },
        uGlow: { value: 0 },
        uColorMode: { value: 0 },
        uContrast: { value: 1 },
        uBrightness: { value: 1 },
        uFillBands: { value: 0 },
        uOpacity: { value: 1 },
        uLightMode: { value: 0 },
        uGrain: { value: 0 },
        uGrainIntensity: { value: 0 },
        uLow: { value: new Float32Array([1, 1, 1]) },
        uMid: { value: new Float32Array([1, 1, 1]) },
        uHigh: { value: new Float32Array([1, 1, 1]) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseEnabled: { value: 0 },
        uMouseRadius: { value: 0.3 },
        uMouseStrength: { value: 0.4 },
        uMouseActive: { value: 0 },
        uCtrlA: { value: new Float32Array(4) },
        uCtrlB: { value: new Float32Array(4) },
        uCtrlC: { value: new Float32Array(4) },
        uCtrlD: { value: new Float32Array(4) },
      },
    });

    this.mesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: this.program,
    });

    this.ctrlArrays = [
      this.program.uniforms.uCtrlA.value,
      this.program.uniforms.uCtrlB.value,
      this.program.uniforms.uCtrlC.value,
      this.program.uniforms.uCtrlD.value,
    ];
  }

  setUniforms() {
    const o = this.options;
    const u = this.program.uniforms;

    u.uMorphAmount.value = o.morphAmount;
    u.uBands.value = o.bands;
    u.uThickness.value = o.thickness;
    u.uScale.value = o.scale;
    u.uPixelSize.value = o.pixelSize;
    u.uGlow.value = o.glow;
    u.uColorMode.value = colorModeToFloat(o.colorMode);
    u.uContrast.value = o.contrast;
    u.uBrightness.value = o.brightness;
    u.uFillBands.value = o.fillBands ? 1.0 : 0.0;
    u.uOpacity.value = o.opacity;
    u.uLightMode.value = o.lightMode ? 1.0 : 0.0;
    u.uGrain.value = o.grain ? 1.0 : 0.0;
    u.uGrainIntensity.value = o.grainIntensity;
    u.uLow.value = new Float32Array(hexToRgb(o.lowColor));
    u.uMid.value = new Float32Array(hexToRgb(o.midColor));
    u.uHigh.value = new Float32Array(hexToRgb(o.highColor));
    u.uMouseEnabled.value = o.mouseInteraction ? 1.0 : 0.0;
    u.uMouseRadius.value = o.mouseRadius;
    u.uMouseStrength.value = o.mouseStrength;
  }

  onResize() {
    const rect = this.element.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    this.renderer.setSize(w, h);

    const res = this.program.uniforms.iResolution.value;
    res[0] = this.gl.drawingBufferWidth;
    res[1] = this.gl.drawingBufferHeight;

    this.renderer.render({ scene: this.mesh });
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!inside) {
      this.mouseActiveTarget = 0;
      return;
    }

    this.targetMouse[0] = (e.clientX - rect.left) / rect.width;
    this.targetMouse[1] = 1.0 - (e.clientY - rect.top) / rect.height;
    this.mouseActiveTarget = 1;
  }

  onMouseLeave() {
    this.mouseActiveTarget = 0;
  }

  onVisibility() {
    this.isPageVisible = !document.hidden;
    this.isPageVisible ? this.start() : this.stop();
  }

  start() {
    if (this.isVisible && this.isPageVisible && this.raf === 0) {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    if (this.raf !== 0) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  loop(t) {
    this.update((t - this.t0) * 0.001);
    this.raf = requestAnimationFrame(this.loop);
  }

  update(time) {
    const { speed, morphAmount, morphSpeed } = this.options;
    const u = this.program.uniforms;

    u.iTime.value = time;

    for (let g = 0; g < 4; g++) {
      const arr = this.ctrlArrays[g];
      const idx = CTRL_INDICES[g];
      for (let j = 0; j < 4; j++) {
        const i = idx[j];
        arr[j] = morphAmount * Math.sin(time * speed * Math.sin(i * morphSpeed) + i);
      }
    }

    this.currentMouse[0] += 0.05 * (this.targetMouse[0] - this.currentMouse[0]);
    this.currentMouse[1] += 0.05 * (this.targetMouse[1] - this.currentMouse[1]);
    u.uMouse.value[0] = this.currentMouse[0];
    u.uMouse.value[1] = this.currentMouse[1];

    this.mouseActive += 0.05 * (this.mouseActiveTarget - this.mouseActive);
    u.uMouseActive.value = this.mouseActive;

    this.renderer.render({ scene: this.mesh });
  }

  destroy() {
    this.stop();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("mousemove", this.onMouseMove);
    document.documentElement.removeEventListener("mouseleave", this.onMouseLeave);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas?.remove();
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
