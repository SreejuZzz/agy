/**
 * Antigravity.google Particle System — Exact Port
 *
 * Faithfully replicates the n7/aI + lI classes from antigravity.google.
 *
 * Scene defaults (from the main hero component):
 *   theme            = 'dark'   (your site is dark-mode)
 *   ringWidth        = 0.15
 *   ringWidth2       = 0.05
 *   ringDisplacement = 0.15
 *   density          = 200
 *   particlesScale   = 0.75
 *   interactive      = true     → ring follows cursor
 *   cameraZoom       = 3.1
 *
 * Mouse behavior (exact from source):
 *   - isIntersecting → ringPos lerps to (intersectionPoint × 0.175 + noise × 0.1)  at 0.02/frame
 *   - !isIntersecting → ringPos lerps to noise drift (noise × 0.2, noise × 0.1)    at 0.01/frame
 *   - Raycasting runs every other frame (skipFrame toggle)
 *
 * Colors (dark mode from source):
 *   color1 = #7189ff  (blue-violet)
 *   color2 = #3074f9  (blue)
 *   color3 = #000000  (black)
 */

import * as THREE from 'three';

// ─── Simplex noise GLSL (Ashima Arts) ────────────────────────────────────────
const SIMPLEX_GLSL = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.,i1.z,i2.z,1.))
    +i.y+vec4(0.,i1.y,i2.y,1.))
    +i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

// ─── Sim shaders ─────────────────────────────────────────────────────────────
const SIM_VERT = `void main(){gl_Position=vec4(position,1.0);}`;

const buildSimFrag = (size) => /* glsl */`
  precision highp float;

  uniform sampler2D uPosition;
  uniform sampler2D uPosRefs;
  uniform vec2  uRingPos;
  uniform float uTime;
  uniform float uDeltaTime;
  uniform float uRingRadius;
  uniform float uRingWidth;
  uniform float uRingWidth2;
  uniform float uRingDisplacement;

  ${SIMPLEX_GLSL}

  void main() {
    vec2 simUV   = gl_FragCoord.xy / vec2(${size.toFixed(1)}, ${size.toFixed(1)});
    vec4 pFrame  = texture2D(uPosition, simUV);

    float scale    = pFrame.z;
    float velocity = pFrame.w;
    vec2  refPos   = texture2D(uPosRefs, simUV).xy;

    float time      = uTime * 0.5;
    vec2  curentPos = refPos;

    vec2 pos = pFrame.xy;
    pos *= 0.8;

    float dist   = distance(curentPos.xy, uRingPos);
    float noise0 = snoise(vec3(curentPos.xy * 0.2 + vec2(18.4924, 72.9744), time * 0.5));
    float dist1  = distance(curentPos.xy + (noise0 * 0.005), uRingPos);

    float t  = smoothstep(uRingRadius - (uRingWidth  * 2.0), uRingRadius, dist)
             - smoothstep(uRingRadius, uRingRadius + uRingWidth,  dist1);
    float t2 = smoothstep(uRingRadius - (uRingWidth2 * 2.0), uRingRadius, dist)
             - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
    float t3 = smoothstep(uRingRadius + uRingWidth2, uRingRadius, dist);

    t  = pow(t,  2.0);
    t2 = pow(t2, 3.0);

    t += t2 * 3.0;
    t += t3 * 0.4;
    t += snoise(vec3(curentPos.xy * 30.0 + vec2(11.4924, 12.9744), time * 0.5)) * t3 * 0.5;

    float nS = snoise(vec3(curentPos.xy * 2.0 + vec2(18.4924, 72.9744), time * 0.5));
    t += pow((nS + 1.5) * 0.5, 2.0) * 0.6;

    float noise1 = snoise(vec3(curentPos.xy * 4.0  + vec2(88.494,   32.4397), time * 0.35));
    float noise2 = snoise(vec3(curentPos.xy * 4.0  + vec2(50.904,  120.947),  time * 0.35));
    float noise3 = snoise(vec3(curentPos.xy * 20.0 + vec2(18.4924,  72.9744), time * 0.5));
    float noise4 = snoise(vec3(curentPos.xy * 20.0 + vec2(50.904,  120.947),  time * 0.5));

    vec2 disp  = vec2(noise1, noise2) * 0.03;
    disp      += vec2(noise3, noise4) * 0.005;
    disp.x    += sin((refPos.x * 20.0) + (time * 4.0)) * 0.02 * clamp(dist, 0.0, 1.0);
    disp.y    += cos((refPos.y * 20.0) + (time * 3.0)) * 0.02 * clamp(dist, 0.0, 1.0);

    pos -= (uRingPos - (curentPos + disp)) * pow(t2, 0.75) * uRingDisplacement;

    float scaleDiff = t - scale;
    scaleDiff *= 0.2;
    scale += scaleDiff;

    vec2 finalPos = curentPos + disp + (pos * 0.25);

    velocity *= 0.5;
    velocity += scale * 0.25;

    gl_FragColor = vec4(finalPos, scale, velocity);
  }
`;

// ─── Render shaders ───────────────────────────────────────────────────────────
const RENDER_VERT = /* glsl */`
  precision highp float;
  attribute vec4 seeds;

  uniform sampler2D uPosition;
  uniform float uTime;
  uniform float uParticleScale;
  uniform float uPixelRatio;
  uniform int   uColorScheme;

  varying vec4  vSeeds;
  varying float vVelocity;
  varying vec2  vLocalPos;
  varying vec2  vScreenPos;
  varying float vScale;

  void main() {
    vec4 pos  = texture2D(uPosition, uv);
    vSeeds    = seeds;
    vVelocity = pos.w;
    vScale    = pos.z;
    vLocalPos = pos.xy;

    vec4 viewSpace = modelViewMatrix * vec4(vec3(pos.xy, 0.0), 1.0);
    gl_Position    = projectionMatrix * viewSpace;
    vScreenPos     = gl_Position.xy;

    gl_PointSize = (vScale * 5.5) * (uPixelRatio * 0.5) * uParticleScale;
  }
`;

const RENDER_FRAG = /* glsl */`
  precision highp float;

  varying vec4  vSeeds;
  varying vec2  vScreenPos;
  varying vec2  vLocalPos;
  varying float vScale;
  varying float vVelocity;

  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform vec2  uRingPos;
  uniform vec2  uRez;
  uniform float uAlpha;
  uniform float uTime;
  uniform int   uColorScheme;

  ${SIMPLEX_GLSL}

  float sdRoundBox(in vec2 p, in vec2 b, in vec4 r) {
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    r.x  = (p.y > 0.0) ? r.x  : r.y;
    vec2 q = abs(p) - b + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }

  vec2 rotate(vec2 v, float a) {
    float s = sin(a); float c = cos(a);
    return mat2(c, s, -s, c) * v;
  }

  void main() {
    float ratio = uRez.x / uRez.y;

    float noiseAngle = snoise(vec3(vLocalPos * 10.0 + vec2(18.4924, 72.9744), uTime * 0.85));
    float noiseColor = snoise(vec3(vLocalPos * 2.0  + vec2(74.664,  91.556),  uTime * 0.5));
    noiseColor = (noiseColor + 1.0) * 0.5;

    float angle = atan(vLocalPos.y - uRingPos.y, vLocalPos.x - uRingPos.x);

    vec2 uv = gl_PointCoord.xy - vec2(0.5);
    uv.y *= -1.0;
    uv = rotate(uv, -angle + (noiseAngle * 0.5));

    float h        = 0.8;
    float progress = smoothstep(0.0, 0.75, pow(noiseColor, 2.0));
    vec3 col = mix(
      mix(uColor1, uColor2, progress / h),
      mix(uColor2, uColor3, (progress - h) / (1.0 - h)),
      step(h, progress)
    );

    float rounded = sdRoundBox(uv, vec2(0.5, 0.2), vec4(0.25));
    rounded = smoothstep(0.1, 0.0, rounded);

    float a = uAlpha * rounded * smoothstep(0.1, 0.2, vScale);
    if (a < 0.01) discard;

    col = clamp(col, 0.0, 1.0);
    col = mix(col, col * clamp(vVelocity, 0.0, 1.0), float(uColorScheme));

    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

// ─── Poisson disk sampling (JS) ───────────────────────────────────────────────
function poissonDisk(width, height, minDist, maxDist, tries = 20) {
  const cellSize = minDist / Math.SQRT2;
  const gridW    = Math.ceil(width  / cellSize);
  const gridH    = Math.ceil(height / cellSize);
  const grid     = new Array(gridW * gridH).fill(null);
  const active   = [];
  const points   = [];

  const addPoint = (x, y) => {
    const pt = [x, y];
    points.push(pt);
    active.push(pt);
    grid[Math.floor(y / cellSize) * gridW + Math.floor(x / cellSize)] = pt;
  };
  const isFar = (x, y) => {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        const pt = grid[ny * gridW + nx];
        if (!pt) continue;
        if ((pt[0] - x) ** 2 + (pt[1] - y) ** 2 < minDist * minDist) return false;
      }
    }
    return true;
  };

  addPoint(Math.random() * width, Math.random() * height);
  while (active.length) {
    const idx  = Math.floor(Math.random() * active.length);
    const base = active[idx];
    let found  = false;
    for (let k = 0; k < tries; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = minDist + Math.random() * (maxDist - minDist);
      const nx = base[0] + Math.cos(a) * r;
      const ny = base[1] + Math.sin(a) * r;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && isFar(nx, ny)) {
        addPoint(nx, ny);
        found = true;
        break;
      }
    }
    if (!found) active.splice(idx, 1);
  }
  return points;
}

// mapRange: identical to the e7 function extracted from the source
const mapRange = (v, inMin, inMax, outMin, outMax) =>
  ((v - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;

// ─── Main exported class ──────────────────────────────────────────────────────
export class AntigravityParticles {
  constructor(container, options = {}) {
    this.container        = container;
    this.theme            = options.theme            ?? 'dark';
    this.density          = options.density          ?? 200;
    this.particlesScale   = options.particlesScale   ?? 0.75;  // exact hero default
    this.cameraZoom       = options.cameraZoom       ?? 3.1;
    this.ringWidth        = options.ringWidth        ?? 0.15;   // exact hero default
    this.ringWidth2       = options.ringWidth2       ?? 0.05;
    this.ringDisplacement = options.ringDisplacement ?? 0.15;
    this.interactive      = options.interactive      ?? true;   // ring follows cursor

    // Colors — vivid light palette used for both dark AND light mode
    this.colorControls = {
      color1: '#2c64ed',  // vivid blue
      color2: '#f84242',  // vivid red
      color3: '#ffcf03',  // vivid yellow
    };

    this.time     = 0;
    this.lastTime = 0;
    this.loaded   = false;
    this.destroyed = false;

    // Mouse / raycasting state
    this._mouse            = new THREE.Vector2(0, 0);
    this._intersectionPoint = new THREE.Vector3(0, 0, 0);
    this._isIntersecting   = false;
    this._mouseIsOver      = false;
    this._skipFrame        = false;  // alternates each frame (exact from source)

    // Ring movement state
    this._ringPos   = new THREE.Vector2(0, 0);
    this._cursorPos = new THREE.Vector2(0, 0);

    this._init();
  }

  _init() {
    // Canvas (full viewport — element is position:fixed)
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Canvas (created separately so we control it, not renderer.domElement)
    this.canvas = document.createElement('canvas');
    this.canvas.width  = w;
    this.canvas.height = h;
    this.container.appendChild(this.canvas);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas:                this.canvas,
      antialias:             true,
      alpha:                 true,
      powerPreference:       'high-performance',
      preserveDrawingBuffer: true,
      stencil:               false,
      precision:             'highp',
    });
    this.pixelRatio = window.devicePixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.renderer.autoClear = false;

    // Camera — exact values from source
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
    this.camera.position.z = this.cameraZoom;

    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    // Raycaster + invisible plane for mouse intersection (12.5×12.5 — exact from source)
    this.raycaster  = new THREE.Raycaster();
    this.raycastPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 12.5),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.raycastPlane);

    this._buildParticles();
    this._bindEvents();

    this.loaded = true;
    this._loop();
  }

  _buildParticles() {
    // Exact Poisson disk params from source:  mapRange(density, 0,300, 10,2) / 11,3
    const minDist = mapRange(this.density, 0, 300, 10, 2);
    const maxDist = mapRange(this.density, 0, 300, 11, 3);

    const rawPts = poissonDisk(500, 500, minDist, maxDist, 20);
    this._pointsData = [];
    for (const pt of rawPts) {
      this._pointsData.push(pt[0] - 250, pt[1] - 250);
    }
    this._count = this._pointsData.length / 2;

    // GPGPU texture
    const SIM_SIZE  = 256;
    this._simSize   = SIM_SIZE;
    this._simLength = SIM_SIZE * SIM_SIZE;

    // Build position DataTexture — only first `count` slots filled
    const posData = new Float32Array(this._simLength * 4);
    for (let i = 0; i < this._count; i++) {
      const o = i * 4;
      posData[o]     = this._pointsData[i * 2]     * (1 / 250);
      posData[o + 1] = this._pointsData[i * 2 + 1] * (1 / 250);
      // z (scale) and w (velocity) start at 0 — invisible until ring reaches them
    }
    this._posTex = new THREE.DataTexture(
      posData, SIM_SIZE, SIM_SIZE, THREE.RGBAFormat, THREE.FloatType
    );
    this._posTex.needsUpdate = true;

    // Ping-pong render targets
    const rtOpts = {
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,   magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat, type: THREE.FloatType,
      depthBuffer: false, stencilBuffer: false,
    };
    this._rt1 = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, rtOpts);
    this._rt2 = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, rtOpts);

    // Sim scene (full-screen quad)
    this._simScene    = new THREE.Scene();
    this._simCamera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition:         { value: this._posTex },
        uPosRefs:          { value: this._posTex },
        uRingPos:          { value: new THREE.Vector2(0, 0) },
        uRingRadius:       { value: 0.2 },
        uDeltaTime:        { value: 0 },
        uRingWidth:        { value: this.ringWidth },
        uRingWidth2:       { value: this.ringWidth2 },
        uRingDisplacement: { value: this.ringDisplacement },
        uTime:             { value: 0 },
      },
      vertexShader:   SIM_VERT,
      fragmentShader: buildSimFrag(SIM_SIZE),
    });
    this._simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._simMaterial));

    // Clear RTs
    this.renderer.setRenderTarget(this._rt1);
    this.renderer.setClearColor(0, 0); this.renderer.clear();
    this.renderer.setRenderTarget(this._rt2);
    this.renderer.setClearColor(0, 0); this.renderer.clear();
    this.renderer.setRenderTarget(null);
    this._everRendered = false;

    // Point-cloud geometry — only `count` verts (not simLength)
    const uvArr    = new Float32Array(this._count * 2);
    const seedsArr = new Float32Array(this._count * 4);
    const posArr   = new Float32Array(this._count * 3);  // dummy zeros

    for (let i = 0; i < this._count; i++) {
      const col = i % SIM_SIZE;
      const row = Math.floor(i / SIM_SIZE);
      uvArr[i * 2]     = col / SIM_SIZE;
      uvArr[i * 2 + 1] = row / SIM_SIZE;
      seedsArr[i * 4]     = Math.random();
      seedsArr[i * 4 + 1] = Math.random();
      seedsArr[i * 4 + 2] = Math.random();
      seedsArr[i * 4 + 3] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr,   3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvArr,    2));
    geo.setAttribute('seeds',    new THREE.BufferAttribute(seedsArr, 4));

    this._renderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition:     { value: this._posTex },
        uTime:         { value: 0 },
        uColor1:       { value: new THREE.Color(this.colorControls.color1) },
        uColor2:       { value: new THREE.Color(this.colorControls.color2) },
        uColor3:       { value: new THREE.Color(this.colorControls.color3) },
        uAlpha:        { value: 1 },
        uRingPos:      { value: new THREE.Vector2(0, 0) },
        uRez:          { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uParticleScale:{ value: this._getParticleScale() },
        uPixelRatio:   { value: this.pixelRatio },
        uColorScheme:  { value: 1 },   // velocity-mix mode — best with vivid light palette
      },
      vertexShader:   RENDER_VERT,
      fragmentShader: RENDER_FRAG,
      transparent:   true,
      depthTest:     false,
      depthWrite:    false,
      blending:      THREE.AdditiveBlending,  // dark=transparent, bright colors glow
    });

    this._mesh = new THREE.Points(geo, this._renderMaterial);
    this._mesh.position.set(0, 0, 0);
    this._mesh.scale.set(5, 5, 5);  // exact from source
    this.scene.add(this._mesh);
  }

  _getParticleScale() {
    // Exact formula from source:  canvas.width / pixelRatio / 2000 * particlesScale
    // Enhanced: Ensure particle sizes remain perfectly readable and premium on both mobile and desktop.
    // By avoiding the harsh pixelRatio division on mobile viewports, we maintain excellent contrast.
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      return Math.max((window.innerWidth / 1500) * this.particlesScale, 0.4);
    }
    return (window.innerWidth / this.pixelRatio / 2000) * this.particlesScale;
  }


  _bindEvents() {
    // Resize
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.canvas.width  = w;
      this.canvas.height = h;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this._renderMaterial.uniforms.uRez.value.set(w, h);
    };
    window.addEventListener('resize', this._onResize, { passive: true });

    // Mouse — track raw client coords
    this._onMouseMove = (e) => {
      this._rawMouse = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', this._onMouseMove, { passive: true });

    // Pause when tab hidden
    this._onVisibility = () => {
      if (document.hidden) this.clock.stop();
      else this.clock.start();
    };
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  // ── Raycasting — runs every other frame (skipFrame), exact from source ──────
  _updateRaycast() {
    if (!this.interactive || !this._rawMouse) {
      this._isIntersecting = false;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    // Normalise to NDC: exact logic from source
    let mx = (this._rawMouse.x - rect.left) / rect.width  * 2 - 1;
    let my = -((this._rawMouse.y - rect.top)  / rect.height) * 2 + 1;

    this._mouseIsOver = mx >= -1 && mx <= 1 && my >= -1 && my <= 1;

    this.raycaster.setFromCamera({ x: mx, y: my }, this.camera);
    const hits = this.raycaster.intersectObject(this.raycastPlane);
    if (hits.length > 0 && this._mouseIsOver) {
      this._intersectionPoint.copy(hits[0].point);
      this._isIntersecting = true;
    } else {
      this._isIntersecting = false;
    }
  }

  _loop() {
    if (this.destroyed) return;
    requestAnimationFrame(() => this._loop());

    const elapsed = this.clock.getElapsedTime();
    const dt      = Math.min(elapsed - this.lastTime, 0.05);
    this.lastTime = elapsed;
    this.time    += dt;

    // ── Autonomous noise drift — smooth multi-frequency sinusoids ─────
    // Approximates the Simplex noise.getVal() from the original
    const t = this.time;
    const nx = Math.sin(t * 0.56 * 0.847 + 94.234) * 0.6
             + Math.sin(t * 0.264  + 17.81) * 0.25
             + Math.sin(t * 0.11  + 44.2)  * 0.15;
    const ny = Math.cos(t * 0.638 * 0.916 + 21.028) * 0.6
             + Math.cos(t * 0.349  + 33.5)  * 0.25
             + Math.cos(t * 0.162  + 61.9)  * 0.15;

    // ── Raycasting (every other frame — exact from source) ────────────
    this._skipFrame = !this._skipFrame;
    if (!this._skipFrame) {
      this._updateRaycast();
    }

    // ── Ring position update — exact from source ──────────────────────
    if (this._isIntersecting) {
      // Mouse is over canvas → ring follows cursor + light noise overlay
      this._cursorPos.set(
        this._intersectionPoint.x * 0.175 + nx * 0.1,
        this._intersectionPoint.y * 0.175 + ny * 0.1
      );
      this._ringPos.x += (this._cursorPos.x - this._ringPos.x) * 0.02;
      this._ringPos.y += (this._cursorPos.y - this._ringPos.y) * 0.02;
    } else {
      // Mouse not over → pure noise drift
      this._cursorPos.set(nx * 0.2, ny * 0.1);
      this._ringPos.x += (this._cursorPos.x - this._ringPos.x) * 0.01;
      this._ringPos.y += (this._cursorPos.y - this._ringPos.y) * 0.01;
    }

    // Oscillating ring radius (exact from source)
    const ringRadius = 0.175 + Math.sin(this.time) * 0.03 + Math.cos(this.time * 3) * 0.02;

    // Particle scale (recomputed each frame in case of resize)
    const particleScale = this._getParticleScale();

    // ── GPGPU sim pass ────────────────────────────────────────────────
    this._simMaterial.uniforms.uPosition.value         = this._everRendered ? this._rt1.texture : this._posTex;
    this._simMaterial.uniforms.uTime.value             = elapsed;
    this._simMaterial.uniforms.uDeltaTime.value        = dt;
    this._simMaterial.uniforms.uRingRadius.value       = ringRadius;
    this._simMaterial.uniforms.uRingPos.value.copy(this._ringPos);
    this._simMaterial.uniforms.uRingWidth.value        = this.ringWidth;
    this._simMaterial.uniforms.uRingWidth2.value       = this.ringWidth2;
    this._simMaterial.uniforms.uRingDisplacement.value = this.ringDisplacement;

    this.renderer.setRenderTarget(this._rt2);
    this.renderer.clear();
    this.renderer.render(this._simScene, this._simCamera);
    this.renderer.setRenderTarget(null);

    // ── Render pass ───────────────────────────────────────────────────
    this._renderMaterial.uniforms.uPosition.value      = this._everRendered ? this._rt2.texture : this._posTex;
    this._renderMaterial.uniforms.uTime.value          = elapsed;
    this._renderMaterial.uniforms.uRingPos.value.copy(this._ringPos);
    this._renderMaterial.uniforms.uParticleScale.value = particleScale;

    this.renderer.autoClear = false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // ── Ping-pong swap ────────────────────────────────────────────────
    const tmp = this._rt1;
    this._rt1 = this._rt2;
    this._rt2 = tmp;
    this._everRendered = true;
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('resize',      this._onResize);
    window.removeEventListener('mousemove',   this._onMouseMove);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._rt1.dispose(); this._rt2.dispose();
    this._posTex.dispose();
    this._simMaterial.dispose();
    this._renderMaterial.dispose();
    this._mesh.geometry.dispose();
    this.renderer.dispose();
    if (this.canvas.parentElement) this.canvas.parentElement.removeChild(this.canvas);
  }
}
