/**
 * Galaxy world — the Milky Way behind every page, built from real data.
 *
 * Units are kiloparsecs, centred on Sagittarius A*; the Galactic plane is xz and +y is
 * the North Galactic Pole. The Sun sits at R0 = 8.178 kpc (GRAVITY 2019), 20.8 pc above
 * the plane; from the Sun, the centre is −x and the direction of rotation (l = 90°) is +z.
 *
 * What is drawn:
 *   - From inside the disk: the real sky. ESO's all-sky panorama (S. Brunier) is in
 *     Galactic coordinates, so it is mapped by (l, b) with l = 0 toward the Galactic centre.
 *   - From outside: ESA's Gaia-based face-on map of the Galaxy (Stefan Payne-Wardenaar),
 *     placed at its true scale (calibrated from the labelled version: 40.2 kpc across,
 *     centred on Sgr A*, the Sun 8.2 kpc toward 6 o'clock). It is drawn as a stack of
 *     slices with a sech² vertical profile, so the disk has thickness when seen at an angle.
 *   - The bar and bulge (27° to the Sun–centre line), the nuclear disk and the nuclear star
 *     cluster as triaxial Gaussian volumes, integrated exactly along each ray (closed form),
 *     so they are smooth and sharp at any distance.
 *   - Stars as points, sampled from the same map (more where it is brighter, colour from
 *     the map), with a sech² height profile — thin for young blue stars, thicker for old —
 *     and a heavy-tailed luminosity function; brightness falls off as 1/d². Pin-sharp at any
 *     resolution. No twinkling: that is Earth's atmosphere.
 *   - Finale: the camera spirals into Sgr A* (4.3 × 10⁶ M☉). Every pixel's light is traced
 *     back through Schwarzschild spacetime (photon orbit x'' = −3/2·h²·x/r⁵, rs = 1), so the
 *     lensing, the shadow, the photon ring and the far side of the disk arching over the
 *     hole all come out of the integration. The disk is a thin Keplerian disk from the
 *     innermost stable orbit (3 rs) outwards with the zero-torque temperature profile
 *     T ∝ r^−¾(1 − √(3/r))^¼; each point's light is shifted by g = gravitational × Doppler,
 *     which sets its colour (blackbody at gT) and brightness (∝ g⁴T⁴). Its turbulence orbits
 *     at Ω = √(M/r³), sped up about 500× (a real orbit at 3 rs takes ~32 minutes).
 *
 * Rendering is on demand (nothing is drawn while the camera is still) and every layer is
 * a texture lookup or closed-form maths, so scrolling stays at the display's frame rate.
 */

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  HalfFloatType,
  ImageBitmapLoader,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Matrix3,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Timer,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';

const clamp01 = v => Math.min(Math.max(v, 0), 1);
const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const ASSETS = `${import.meta.env.BASE_URL}galaxy/`;

// ─── Measured numbers ────────────────────────────────────────────────────────
const KPC_M = 3.0857e19;
export const RS_KPC = (2 * 6.674e-11 * 4.3e6 * 1.989e30 / (2.998e8 ** 2)) / KPC_M;   // Sgr A* Schwarzschild radius
export const MAP_KPC = 40.2;                    // width of the face-on map
export const MAP_CENTRE = [0.4994, 0.4990];     // Sgr A* on the map (u right, v down)
const SUN = new Vector3(8.178, 0.0208, 0);
const BAR_ANGLE = MathUtils.degToRad(27);   // Bland-Hawthorn & Gerhard 2016: 27° ± 2°

// Camera stations: position and look target (kpc), field of view, exposure
export const STATIONS = [
  { pos: [14, 15, 22],           target: [0, 0, 0],         fov: 42, exposure: 1.0 },  // 0 arrival: the whole Milky Way
  { pos: SUN.toArray(),          target: [0, 0.4, -0.9],    fov: 62, exposure: 1.0 },  // 1 the Sun: the real sky
  { pos: [12.5, 7.0, 6.0],       target: [2.5, 0, -1.5],    fov: 42, exposure: 1.0 },  // 2 above the Sun's neighbourhood
  { pos: [12.3, 2.8, -12.6],     target: [3.9, 0, -5.0],    fov: 40, exposure: 1.0 },  // 3 along the Scutum–Centaurus arm (R ≈ 6.3 kpc on the map)
  { pos: [2.2, 4.6, 6.0],        target: [0, 0, 0],         fov: 42, exposure: 0.45 }, // 4 over the bar
  { pos: [6.0, 1.1, 4.4],        target: [0, 0.2, 0],       fov: 34, exposure: 0.55 }, // 5 the bulge rising from the disk
  { pos: [0.004, 0.0016, 0.003], target: [0, 0, 0],         fov: 50, exposure: 0.5 },  // 6 5 pc from Sgr A*
];

// One step of a critically damped spring (ω = 3 /s): x'' = ω²(target − x) − 2ω x'.
// Integrated exactly over the step, so it is stable at any frame rate; snaps to rest when settled.
const OMEGA = 3;
function followSpring(x, v, target, dt) {
  const d = x - target, e = Math.exp(-OMEGA * dt);
  const c = v + OMEGA * d;
  const nd = (d + c * dt) * e;
  const nv = (v - OMEGA * c * dt) * e;
  return Math.abs(nd) < 1e-4 && Math.abs(nv) < 1e-4 ? [target, 0] : [target + nd, nv];
}

// Sgr A*'s disk is seen from the fall direction at 80° from face-on: nearly edge-on, so its
// far side is lensed into an arc over the shadow. (From Earth the EHT sees it closer to
// face-on; the camera arrives from elsewhere in the Galactic centre.)
const FALL_DIR = new Vector3(...STATIONS[6].pos).normalize();
const DISK_AXIS = (() => {
  const up = new Vector3(0, 1, 0);
  const perp = up.clone().addScaledVector(FALL_DIR, -up.dot(FALL_DIR)).normalize();
  const i = MathUtils.degToRad(80);
  return FALL_DIR.clone().multiplyScalar(Math.cos(i)).addScaledVector(perp, Math.sin(i)).normalize();
})();
const RS_PER_SECOND = 11.5;   // time-lapse: an orbit at 3 rs (~32 min) takes ~4 s

// How much the real sky replaces the model: only inside the disk, and only near the Sun,
// since the panorama is the sky as seen from here
function insideDisk(p) {
  return smoothstep(0.9, 0.25, Math.abs(p.y)) * smoothstep(3, 1, p.distanceTo(SUN));
}

// Seeded random numbers, so the stars are the same on every visit
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable multi-scale noise: fine structure for the map where it is magnified
function makeDetailTexture(size = 256) {
  const rand = mulberry32(7);
  const layer = period => {
    const g = Float32Array.from({ length: period * period }, rand);
    return (x, y) => {
      const fx = (x / size) * period, fy = (y / size) * period;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const at = (i, j) => g[((j % period) * period) + (i % period)];
      return lerp(lerp(at(x0, y0), at(x0 + 1, y0), tx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
    };
  };
  const a = [8, 16, 32, 64, 128].map(layer), b = [8, 16, 32, 64, 128].map(layer);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let na = 0, nb = 0, amp = 0.5, sum = 0;
      for (let o = 0; o < a.length; o++) { na += a[o](x, y) * amp; nb += b[o](x, y) * amp; sum += amp; amp *= 0.6; }
      const i = (y * size + x) * 4;
      data[i] = Math.round((na / sum) * 255);
      data[i + 1] = Math.round((nb / sum) * 255);
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// ─── Shaders ─────────────────────────────────────────────────────────────────
const MAP_GLSL = /* glsl */`
  const float MAP_KPC = ${MAP_KPC.toFixed(3)};
  const vec2 MAP_CENTRE = vec2(${MAP_CENTRE[0]}, ${MAP_CENTRE[1]});
  // World xz (kpc) → map uv (three.js convention: v up)
  vec2 mapUv(vec3 p) { return vec2(MAP_CENTRE.x - p.z / MAP_KPC, 1.0 - (MAP_CENTRE.y + p.x / MAP_KPC)); }
`;

// The real sky from inside the disk, mapped by Galactic longitude and latitude
const SkyShader = {
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tSky;
    uniform vec2 uForward;    // direction of l = 0 (toward the Galactic centre) in xz
    uniform float uOpacity;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      vec2 side = vec2(uForward.y, -uForward.x);              // l = 90°
      float l = atan(dot(d.xz, side), dot(d.xz, uForward));
      float b = asin(clamp(d.y, -1.0, 1.0));
      vec2 uv = vec2(0.5 - l / 6.2831853, 0.5 + b / 3.1415927);
      gl_FragColor = vec4(texture2D(tSky, uv).rgb * uOpacity, 1.0);
    }
  `,
};

// One slice of the disk: the face-on map at height h, softer further from the mid-plane
const DiskShader = {
  vertexShader: /* glsl */`
    varying vec3 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tMap, tDetail;
    uniform vec3 uCam;
    uniform float uWeight, uBias, uOpacity, uTexSize;
    varying vec3 vWorld;
    ${MAP_GLSL}
    void main() {
      vec2 uv = mapUv(vWorld);
      float r = length(uv - vec2(MAP_CENTRE.x, 1.0 - MAP_CENTRE.y)) * 2.0;
      if (r > 1.0) discard;
      vec3 c = texture2D(tMap, uv, uBias).rgb;

      // Texels per screen pixel: below 1 the map is magnified, so fine structure is added
      float tpp = length(fwidth(uv * uTexSize));
      float n = texture2D(tDetail, uv * 41.0).r * 0.55 + texture2D(tDetail, uv * 173.0).g * 0.45;
      c *= mix(1.0, 0.45 + 1.1 * n, 0.45 * smoothstep(1.0, 0.25, tpp) * step(uBias, 0.5));

      // Seen edge-on the disk gives way to the sky
      vec3 v = uCam - vWorld;
      float mu = abs(v.y) / length(v);
      c *= uWeight * smoothstep(0.02, 0.1, mu);
      c *= smoothstep(1.0, 0.82, r) * smoothstep(0.05, 0.12, tpp) * uOpacity;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

// Bar, bulge, nuclear disk and nuclear star cluster: Gaussian volumes integrated exactly
const BulgeShader = {
  vertexShader: /* glsl */`
    varying vec2 vNdc;
    void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform mat4 uCamWorld;
    uniform vec2 uProjScale;   // projection matrix [0][0], [1][1]
    uniform vec3 uCam;
    uniform float uOpacity, uOuter, uCluster;
    varying vec2 vNdc;
    const vec3 BAR_X = vec3(${Math.cos(BAR_ANGLE).toFixed(6)}, 0.0, ${Math.sin(BAR_ANGLE).toFixed(6)});
    const vec3 BAR_Z = vec3(${(-Math.sin(BAR_ANGLE)).toFixed(6)}, 0.0, ${Math.cos(BAR_ANGLE).toFixed(6)});

    float erfcPos(float x) {   // Abramowitz & Stegun 7.1.26, x >= 0
      float t = 1.0 / (1.0 + 0.3275911 * x);
      return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * exp(-x * x);
    }
    float erfc_(float x) { return x >= 0.0 ? erfcPos(x) : 2.0 - erfcPos(-x); }

    // ∫₀^∞ exp(-|S⁻¹(o + t d)|² / 2) dt, in kpc
    float lineGauss(vec3 o, vec3 d, vec3 sigma) {
      o /= sigma; d /= sigma;
      float a = dot(d, d), b = dot(o, d);
      // Squared distance of closest approach, computed directly (never negative, no cancellation)
      vec3 closest = o - d * (b / a);
      return exp(-0.5 * dot(closest, closest)) * sqrt(1.5707963 / a) * erfc_(b / sqrt(2.0 * a));
    }

    void main() {
      vec3 rd = normalize(mat3(uCamWorld) * vec3(vNdc / uProjScale, -1.0));
      vec3 o = vec3(dot(uCam, BAR_X), uCam.y, dot(uCam, BAR_Z));
      vec3 d = vec3(dot(rd, BAR_X), rd.y, dot(rd, BAR_Z));
      // Near the centre the large-scale glow is hidden by the Central Molecular Zone's dust
      float I = uOuter * (0.04 * lineGauss(o, d, vec3(1.7, 0.42, 0.62))   // long bar
                        + 0.16 * lineGauss(o, d, vec3(0.55, 0.38, 0.48))  // bulge
                        + 1.0 * lineGauss(o, d, vec3(0.12, 0.035, 0.12))) // nuclear stellar disk
              + 5.0 * uCluster * lineGauss(o, d, vec3(0.004, 0.0035, 0.004)); // nuclear star cluster
      gl_FragColor = vec4(vec3(1.0, 0.74, 0.5) * I * uOpacity, 1.0);
    }
  `,
};

// Stars: brightness ∝ luminosity / d²; size grows only for the brightest.
// They orbit: a flat rotation curve v(R) = 230 km/s · (1 − e^(−R / 0.9 kpc)), seen in the frame
// that turns with the spiral pattern (Ω_p ≈ 28 km/s/kpc), so the map's arms stay put while stars
// inside corotation stream ahead of them and stars outside fall behind. The Sun (Ω ≈ 28) is
// almost at corotation. Each star is drawn as the streak it makes during the frame, as a camera
// shutter would record it, with its light spread along the streak.
const StarShader = {
  vertexShader: /* glsl */`
    attribute vec3 color;
    attribute float lum;
    uniform float uBright, uDpr, uOpacity;
    uniform float uOrbit;                    // 1 for the Galaxy's stars, 0 for the far background
    uniform float uMyr, uPrevMyr;            // time, in millions of years, now and at the previous frame
    uniform mat4 uPrevViewProj, uPrevModel;
    uniform vec2 uResolution;
    varying vec3 vColor;
    varying float vAlpha;
    varying vec2 vStreak;                    // the streak, in sprite coordinates
    varying float vCore;                     // star radius, in sprite coordinates

    vec3 orbit(vec3 p, float myr) {
      float R = length(p.xz);
      float omega = 230.0 * (1.0 - exp(-R / 0.9)) / max(R, 1e-3);     // km/s/kpc
      // 1 km/s/kpc = 1.0227e-3 rad/Myr; the Galaxy turns clockwise seen from the north (−y)
      float a = -(omega - 28.0) * 1.0227e-3 * myr * uOrbit * step(0.05, R);
      float c = cos(a), s = sin(a);
      return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
    }

    void main() {
      vec4 mv = modelViewMatrix * vec4(orbit(position, uMyr), 1.0);
      vec4 clip = projectionMatrix * mv;
      vec4 prev = uPrevViewProj * uPrevModel * vec4(orbit(position, uPrevMyr), 1.0);
      vec2 delta = (clip.xy / clip.w - prev.xy / prev.w) * 0.5 * uResolution;
      if (prev.w <= 0.0 || clip.w <= 0.0) delta = vec2(0.0);
      float E = lum * uBright / (dot(mv.xyz, mv.xyz) + 1e-8);
      float s = clamp(sqrt(E) * 1.6, 1.0, 4.0);
      float alpha = min(E / (s * s), 1.0);
      // Only stars bright enough to see leave a visible streak (a faint one's light spread
      // along a streak would vanish); stars too faint to change a pixel are skipped entirely
      float len = alpha > 0.05 ? min(length(delta), 24.0) : 0.0;
      if (alpha * uOpacity < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
      float size = s * 2.0 * uDpr + len;
      vAlpha = alpha / (1.0 + len / (s * uDpr));
      vColor = color;
      vStreak = len > 0.0 ? normalize(delta) * vec2(1.0, -1.0) * (len / size) : vec2(0.0);
      vCore = s * uDpr / size;
      gl_PointSize = size;
      gl_Position = clip;
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vAlpha;
    varying vec2 vStreak;
    varying float vCore;
    void main() {
      // Distance to the streak's segment, centred in the sprite
      vec2 p = gl_PointCoord - 0.5, a = -0.5 * vStreak, ab = vStreak;
      float t = dot(ab, ab) > 0.0 ? clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0) : 0.5;
      vec2 d = (p - (a + ab * t)) / vCore;
      float g = exp(-dot(d, d) * 6.0);   // ~0 by the sprite's edge, so no square corners
      gl_FragColor = vec4(vColor * vAlpha * g * uOpacity, 1.0);
    }
  `,
};

// Final pass: exposure and highlight roll-off; in the finale, every pixel's light is traced
// back through Schwarzschild spacetime past Sgr A* and its accretion disk
const FinalShader = {
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene;
    uniform float uExposure, uFade;
    uniform float uLens;       // 1 while Sgr A* is close enough to bend light visibly
    uniform vec3 uCamRs;       // camera position in Schwarzschild radii (rs = 1, c = 1)
    uniform mat3 uViewRot;     // camera → world rotation
    uniform vec3 uDiskAxis;    // the disk's spin axis
    uniform float uTime;       // coordinate time in units of rs / c
    uniform vec2 uProjScale;   // projection matrix [0][0], [1][1]
    uniform float uAspect;     // width / height
    uniform float uMargin;     // how much wider than the screen the scene was rendered (tan ratio)
    uniform vec3 uCursor;      // the pointer as a lens: xy in uv, z its Einstein radius (screen heights)
    uniform float uBeta;       // the camera's speed as a fraction of c; + forward, − back
    uniform vec4 uRipples[4];  // gravitational waves: xy origin (uv), z age (s), w strain amplitude
    varying vec2 vUv;

    #ifndef BH_STEPS
      #define BH_STEPS 220
    #endif

    const float R_ISCO = 3.0;   // innermost stable circular orbit, 3 rs
    const float R_OUT = 18.0;

    // View-space direction through a screen point, and back (perspective, no depth needed)
    vec3 viewDir(vec2 uv) { return normalize(vec3((uv * 2.0 - 1.0) / uProjScale, -1.0)); }
    // The scene may be rendered wider than the screen shows (uMargin ≥ 1, see aberration)
    vec2 toUv(vec3 d) { return (d.xy / -d.z) * (uProjScale / uMargin) * 0.5 + 0.5; }
    float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float noise(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
                 mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
    }

    vec3 blackbody(float t) {
      t = clamp(t, 1000.0, 40000.0) / 100.0;
      float r = t <= 66.0 ? 1.0 : clamp(1.29293618606 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
      float g = t <= 66.0 ? clamp(0.390081578769 * log(t) - 0.631841443788, 0.0, 1.0) : clamp(1.12989086089 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
      float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.543206789110 * log(t - 10.0) - 1.19625408914, 0.0, 1.0));
      return pow(vec3(r, g, b), vec3(2.2));
    }

    // The surroundings in a given world direction: the rendered scene, mirrored back into
    // the frame where the light comes from outside it (the surroundings are statistically alike)
    vec3 sceneAt(vec3 dirWorld) {
      vec3 v = dirWorld * uViewRot;
      vec2 suv = toUv(vec3(v.xy, -abs(v.z)));
      suv = 1.0 - abs(1.0 - mod(suv, 2.0));
      return texture2D(tScene, suv).rgb;
    }

    // Turbulence carried round at the Keplerian rate Ω = √(M / r³) (M = 1/2 when rs = 1).
    // Two phases of the pattern are cross-faded so the differential shear never winds up forever.
    float turbulence(float r, float phi) {
      float omega = sqrt(0.5 / (r * r * r));
      const float PERIOD = 140.0;            // about three orbits at the innermost stable orbit
      float n = 0.0;
      for (int k = 0; k < 2; k++) {
        float t = mod(uTime + float(k) * PERIOD * 0.5, PERIOD);
        float w = 1.0 - abs(2.0 * t / PERIOD - 1.0);
        float a = phi - omega * t;
        vec3 q = vec3(cos(a), sin(a), log(r) * 7.0);
        float v = noise(vec3(q.xy * 2.5, q.z)) * 0.6 + noise(vec3(q.xy * 6.0, q.z * 2.6) + 4.0) * 0.4;
        n += v * w;
      }
      return n;
    }

    // Light emitted at a point of the disk, as received along a ray travelling direction -v
    vec3 diskLight(vec3 pc, vec3 v) {
      float r = length(pc);
      vec3 radial = pc / r;
      vec3 orbit = normalize(cross(uDiskAxis, radial));       // prograde circular orbit
      float beta = sqrt(0.5 / (r - 1.0));                      // orbital speed seen by a static observer
      float gamma = inversesqrt(1.0 - beta * beta);
      float cosTheta = dot(orbit, -normalize(v));              // between the gas's motion and the photon's
      float g = sqrt(1.0 - 1.0 / r) / (gamma * (1.0 - beta * cosTheta));   // gravitational × Doppler shift
      // Thin-disk temperature with zero torque at the innermost stable orbit, peaking near 4.1 rs
      float T = 32700.0 * pow(r, -0.75) * pow(max(1.0 - sqrt(R_ISCO / r), 0.0), 0.25);
      float Tobs = g * T;                                       // the spectrum shifts with g …
      float I = pow(Tobs / 7000.0, 4.0);                        // … and bolometric intensity goes as g⁴T⁴
      vec3 e1 = normalize(cross(uDiskAxis, vec3(0.3, 0.1, 0.9)));
      float phi = atan(dot(radial, cross(uDiskAxis, e1)), dot(radial, e1));
      return blackbody(Tobs) * I * (0.35 + 1.3 * turbulence(r, phi)) * 2.7;
    }

    vec3 traceBlackHole(vec3 dir) {
      vec3 p = uCamRs, v = dir;
      vec3 hv = cross(p, v);
      float h2 = dot(hv, hv);
      float r0 = length(p);
      // Rays that pass far from the hole: weak-field deflection 2 rs / b, no stepping needed
      vec3 closest = p - v * dot(p, v);
      float b = length(closest);
      if (b > 60.0 && r0 > 60.0) {
        float bend = dot(p, v) < 0.0 ? 2.0 / b : 0.0;
        return sceneAt(normalize(v - normalize(closest) * bend));
      }
      vec3 col = vec3(0.0);
      float trans = 1.0;
      float hPrev = dot(p, uDiskAxis);
      for (int i = 0; i < BH_STEPS; i++) {
        float r = length(p);
        if (r < 1.0) return col;                                   // crossed the horizon
        if (r > max(r0 * 1.05, 60.0) && dot(p, v) > 0.0) break;    // escaping
        float dt = r > 10.0 ? 0.08 * r : max(0.04 * r, 0.02);
        v += -1.5 * h2 * p / (r * r * r * r * r) * dt;             // Schwarzschild photon orbit (rs = 1)
        vec3 pn = p + v * dt;
        float hn = dot(pn, uDiskAxis);
        if (hPrev * hn < 0.0) {                                    // crossed the disk plane
          vec3 pc = mix(p, pn, hPrev / (hPrev - hn));
          float rc = length(pc);
          if (rc > R_ISCO && rc < R_OUT) {
            float a = 0.9 * smoothstep(R_OUT, R_OUT * 0.7, rc);
            col += trans * a * diskLight(pc, v);
            trans *= 1.0 - a;
            if (trans < 0.02) return col;
          }
        }
        hPrev = hn;
        p = pn;
      }
      return col + trans * sceneAt(normalize(v));
    }

    // Mirror coordinates that fall outside the frame back into it
    vec2 fold(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }

    // Gravitational waves: a ring expanding at the speed of light (scaled to the screen), carrying
    // a plus-polarised strain h — space stretches along x while it squeezes along y, then the
    // other way — so every point moves by ½·h·(x, −y) from the source. Each wave fades as it spreads
    vec2 gravitationalWaves(vec2 uv) {
      vec2 off = vec2(0.0);
      for (int i = 0; i < 4; i++) {
        vec4 w = uRipples[i];
        if (w.w <= 0.0) continue;
        vec2 q = (uv - w.xy) * vec2(uAspect, 1.0);
        float x = length(q) - w.z * 0.85;                    // distance behind the wavefront
        float h = w.w * exp(-x * x / 0.01) * sin(x * 70.0) * exp(-w.z * 0.8);
        off += 0.5 * h * vec2(q.x, -q.y) / vec2(uAspect, 1.0);
      }
      return off;
    }

    // The pointer as a point mass: the lens equation β = θ − θE²/θ. Each pixel shows the light
    // from where the lens bent it from, so the stars around the cursor are pushed out into arcs
    // and brightened by the magnification μ = 1 / (1 − (θE/θ)⁴), most of all on the Einstein ring.
    // (Inside the ring, the faint inverted second image is left out: the middle stays dark.)
    vec2 cursorLens(vec2 uv, out float gain) {
      gain = 1.0;
      if (uCursor.z <= 0.0) return uv;
      vec2 q = (uv - uCursor.xy) * vec2(uAspect, 1.0);
      float r = max(length(q) / uCursor.z, 1e-3);           // in Einstein radii
      float r4 = r * r * r * r;
      gain = min(1.0 / abs(1.0 - 1.0 / r4), 2.2);
      if (r < 1.0) gain *= smoothstep(0.55, 1.0, r);
      vec2 b = q * (1.0 - 1.0 / (r * r));
      return uCursor.xy + b / vec2(uAspect, 1.0);
    }

    // Moving at speed β, light arrives from further forward (aberration):
    // cos θ_rest = (cos θ − β) / (1 − β cos θ). The scene was rendered at rest, so each pixel
    // looks up where its light came from in that frame
    vec3 aberrate(vec3 d, float beta) {
      float c = -d.z;
      float cr = (c - beta) / (1.0 - beta * c);
      float s = length(d.xy);
      vec2 xy = s > 1e-5 ? d.xy / s * sqrt(max(1.0 - cr * cr, 0.0)) : vec2(0.0);
      return vec3(xy, -cr);
    }

    void main() {
      float gain;
      vec2 uv = cursorLens(vUv + gravitationalWaves(vUv), gain);
      vec3 col;
      if (uLens > 0.0) {
        col = traceBlackHole(uViewRot * viewDir(uv));
      } else if (abs(uBeta) > 1e-3) {
        vec3 d = viewDir(uv);
        vec3 r = aberrate(d, uBeta);
        col = texture2D(tScene, fold(toUv(vec3(r.xy, -abs(r.z))))).rgb;
        // Doppler factor D = 1 / γ(1 − β cos θ): ahead the light is blueshifted and brighter
        // (∝ D³ for a spectrum like the stars'), behind it is redshifted and dimmer
        float D = sqrt(1.0 - uBeta * uBeta) / (1.0 - uBeta * -d.z);
        col *= pow(vec3(D), vec3(1.0, 1.8, 2.8));
      } else {
        col = texture2D(tScene, fold(0.5 + (uv - 0.5) / uMargin)).rgb;
      }
      col *= gain;
      col *= uExposure;
      // Highlights roll off smoothly instead of clipping
      float m = max(col.r, max(col.g, col.b));
      if (m > 0.7) col *= (0.7 + 0.3 * (1.0 - exp(-(m - 0.7) / 0.3))) / m;
      vec2 q = vUv - 0.5;
      col *= (1.0 - 0.28 * smoothstep(0.1, 0.55, dot(q, q))) * uFade;
      col = mix(col * 12.92, 1.055 * pow(max(col, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
      col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// ─── Main class ──────────────────────────────────────────────────────────────
export class GalaxyWorld {
  constructor(container, { mobile = false, reducedMotion = false } = {}) {
    this.mobile = mobile;
    this.reducedMotion = reducedMotion;

    this.u = 0;
    this.uSmooth = 0;
    this.uVelocity = 0;
    this.intro = 0;
    this.finale = 0;
    this.finaleSmooth = 0;
    this.finaleVelocity = 0;
    this.diskTime = 0;
    this.active = false;
    this.ready = 0;             // 0 → 1 as the imagery arrives
    this.loaded = { sky: false, map: false, stars: false };
    this.drawnState = this.drawnScene = '';
    this.stillFor = 0;
    this.slowFrames = 0;

    // Physics on the screen: the pointer as a lens, gravitational waves, the camera's speed
    this.cursor = { x: 0.5, y: 0.5 };   // in uv (kept where it was when the pointer leaves, so the lens fades in place)
    this.cursorOn = false;
    this.lensStrength = 1;       // 0 → 1: how much of its mass the pointer has (less over a page)
    this.lensRadius = 0;         // current Einstein radius, eased towards its target
    this.ripples = [];           // { x, y, age, amp }
    this.beta = 0;

    // Shared by the star materials: time and the previous frame's camera (for light streaks)
    this.time = { myr: { value: 0 }, prevMyr: { value: 0 } };
    this.prevViewProj = { value: new Matrix4() };
    this.resolution = { value: new Vector2(1, 1) };
    this.prevCamPos = new Vector3();
    this.hasPrev = false;

    this.timer = new Timer();
    this._initRenderer(container);
    this._initScene();
    this._load();
    this._bindEvents();

    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  }

  _initRenderer(container) {
    const r = (this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }));
    this.baseDpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    r.setPixelRatio(this.baseDpr);
    r.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(r.domElement);
    this.target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
    // Dynamic resolution: while the camera moves the scene is drawn into a smaller target (the
    // motion streaks hide it), and once it comes to rest one full-resolution frame replaces it
    this.targetFast = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
    this._sizeTarget();
  }

  _sizeTarget() {
    const size = this.renderer.getDrawingBufferSize(new Vector2());
    this.target.setSize(size.x, size.y);
    this.fastScale = this.renderer.getPixelRatio() > 1.25 ? 0.5 : 0.7;
    this.targetFast.setSize(Math.max(1, Math.round(size.x * this.fastScale)), Math.max(1, Math.round(size.y * this.fastScale)));
    this.hasPrev = false;
  }

  // Point the star shaders at the target about to be drawn: its size, and its pixels per CSS pixel
  _useTarget(target, scale) {
    this.resolution.value.set(target.width, target.height);
    const dpr = this.renderer.getPixelRatio() * scale;
    this.background.material.uniforms.uDpr.value = dpr;
    if (this.stars) this.stars.material.uniforms.uDpr.value = dpr;
    this.final.uniforms.tScene.value = target.texture;
  }

  _initScene() {
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1e-9, 1e5);
    const additive = { blending: AdditiveBlending, depthTest: false, depthWrite: false, transparent: true };

    // Sky (from inside the disk)
    this.sky = new Mesh(
      new SphereGeometry(100, 64, 32),
      new ShaderMaterial({
        uniforms: { tSky: { value: null }, uForward: { value: new Vector2(-1, 0) }, uOpacity: { value: 0 } },
        vertexShader: SkyShader.vertexShader, fragmentShader: SkyShader.fragmentShader,
        side: BackSide, ...additive,
      }),
    );
    this.sky.renderOrder = 0;
    this.sky.frustumCulled = false;
    this.sky.visible = false;
    this.scene.add(this.sky);

    // Faint background stars (outside the disk)
    this.background = this._makeBackgroundStars(this.mobile ? 2500 : 6000);
    this.background.renderOrder = 1;
    this.scene.add(this.background);

    // Disk: the map itself in the mid-plane, sharp, plus heavily blurred halo layers above
    // and below that give it thickness without repeating any of its features
    const detail = makeDetailTexture();
    const geometry = new PlaneGeometry(MAP_KPC, MAP_KPC).rotateX(-Math.PI / 2);
    const layers = [
      { h: 0, weight: 1, bias: 0 },
      { h: 0.22, weight: 0.1, bias: 5 }, { h: -0.22, weight: 0.1, bias: 5 },
      { h: 0.5, weight: 0.04, bias: 7 }, { h: -0.5, weight: 0.04, bias: 7 },
    ];
    this.diskShared = { tMap: { value: null }, tDetail: { value: detail }, uCam: { value: new Vector3() }, uOpacity: { value: 0 }, uTexSize: { value: 1 } };
    this.slices = layers.map(({ h, weight, bias }) => {
      const mesh = new Mesh(geometry, new ShaderMaterial({
        uniforms: { ...this.diskShared, uWeight: { value: weight }, uBias: { value: bias } },
        vertexShader: DiskShader.vertexShader, fragmentShader: DiskShader.fragmentShader,
        side: DoubleSide, ...additive,
      }));
      mesh.position.y = h;
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    });

    // Bar, bulge and nuclear components
    this.bulge = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
      uniforms: { uProjScale: { value: new Vector2(1, 1) }, uCamWorld: { value: new Matrix4() }, uCam: { value: new Vector3() }, uOpacity: { value: 0 }, uOuter: { value: 1 }, uCluster: { value: 1 } },
      vertexShader: BulgeShader.vertexShader, fragmentShader: BulgeShader.fragmentShader,
      ...additive,
    }));
    this.bulge.renderOrder = 3;
    this.bulge.frustumCulled = false;
    this.scene.add(this.bulge);

    // Final pass
    this.final = new ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture }, uExposure: { value: 1 }, uFade: { value: 0 },
        uLens: { value: 0 }, uCamRs: { value: new Vector3() }, uViewRot: { value: new Matrix3() },
        uDiskAxis: { value: DISK_AXIS }, uTime: { value: 0 }, uProjScale: { value: new Vector2(1, 1) },
        uAspect: { value: 1 }, uMargin: { value: 1 }, uCursor: { value: new Vector3() }, uBeta: { value: 0 },
        uRipples: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
      },
      defines: this.mobile ? { BH_STEPS: 140 } : {},
      vertexShader: FinalShader.vertexShader, fragmentShader: FinalShader.fragmentShader,
      depthTest: false, depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.final);
    quad.frustumCulled = false;
    this.finalScene = new Scene();
    this.finalScene.add(quad);
    this.finalCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  _starMaterial(bright, orbit) {
    return new ShaderMaterial({
      uniforms: {
        uBright: { value: bright }, uDpr: { value: this.renderer.getPixelRatio() }, uOpacity: { value: 0 },
        uOrbit: { value: orbit ? 1 : 0 }, uMyr: this.time.myr, uPrevMyr: this.time.prevMyr,
        uPrevViewProj: this.prevViewProj, uPrevModel: { value: new Matrix4() }, uResolution: this.resolution,
      },
      vertexShader: StarShader.vertexShader, fragmentShader: StarShader.fragmentShader,
      blending: AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
  }

  _makeBackgroundStars(n) {
    const rand = mulberry32(11);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), lum = new Float32Array(n);
    const c = new Color();
    for (let i = 0; i < n; i++) {
      const z = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      pos.set([s * Math.cos(a) * 50, z * 50, s * Math.sin(a) * 50], i * 3);
      c.setHSL(rand() < 0.8 ? 0.08 + rand() * 0.05 : 0.6, 0.35, 0.75);
      col.set([c.r, c.g, c.b], i * 3);
      lum[i] = Math.min(0.15 * Math.pow(1 - rand(), -1.1), 6);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setAttribute('lum', new BufferAttribute(lum, 1));
    const points = new Points(g, this._starMaterial(2500 * 0.4, false));
    points.frustumCulled = false;
    return points;
  }

  // Stars sampled from the face-on map: where it is brighter there are more stars
  _makeGalaxyStars(image) {
    const W = image.width, H = image.height, px = image.data;
    const toLinear = v => Math.pow(v / 255, 2.2);
    const cdf = new Float64Array(W * H);
    let acc = 0;
    for (let i = 0; i < W * H; i++) {
      const L = 0.2126 * toLinear(px[i * 4]) + 0.7152 * toLinear(px[i * 4 + 1]) + 0.0722 * toLinear(px[i * 4 + 2]);
      acc += Math.pow(L, 0.6);
      cdf[i] = acc;
    }
    const rand = mulberry32(42);
    const nDisk = this.mobile ? 110000 : 300000, nCluster = this.mobile ? 6000 : 15000;
    const n = nDisk + nCluster;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), lum = new Float32Array(n);
    const atanh = x => 0.5 * Math.log((1 + x) / (1 - x));
    for (let k = 0; k < nDisk; k++) {
      // Binary search the cumulative brightness
      const x = rand() * acc;
      let lo = 0, hi = W * H - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < x) lo = mid + 1; else hi = mid; }
      const u = ((lo % W) + rand()) / W, v = (Math.floor(lo / W) + rand()) / H;
      const X = (v - MAP_CENTRE[1]) * MAP_KPC, Z = (MAP_CENTRE[0] - u) * MAP_KPC;
      const r = toLinear(px[lo * 4]), g = toLinear(px[lo * 4 + 1]), b = toLinear(px[lo * 4 + 2]);
      const L = Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-4);
      const R = Math.hypot(X, Z);
      const young = b / (r + 1e-4) > 1.0 && R > 3;
      const h = R < 2.5 ? 0.3 : young ? 0.07 : 0.22;
      const Y = h * atanh(Math.min(Math.max(rand() * 2 - 1, -0.996), 0.996));
      pos.set([X, Y, Z], k * 3);
      // Map colour, a little more saturated, varied per star
      const sat = 1.5, jitter = 0.85 + rand() * 0.3;
      const cr = Math.pow(r / L, sat), cg = Math.pow(g / L, sat), cb = Math.pow(b / L, sat);
      const cl = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
      col.set([cr / cl * jitter, cg / cl, cb / cl / jitter], k * 3);
      lum[k] = Math.min(0.3 * Math.pow(1 - rand(), -1.25), 80);
    }
    // Nuclear star cluster around Sgr A* (Plummer sphere, scale 4 pc)
    for (let k = nDisk; k < n; k++) {
      const a = 0.004, rr = Math.min(a / Math.sqrt(Math.pow(Math.max(rand(), 1e-6), -2 / 3) - 1), 0.05);
      const z = rand() * 2 - 1, phi = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      pos.set([rr * s * Math.cos(phi), rr * z * 0.85, rr * s * Math.sin(phi)], k * 3);
      col.set([1.15, 0.92, 0.75], k * 3);
      lum[k] = Math.min(6e-5 * Math.pow(1 - rand(), -1.3), 8e-3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('lum', new BufferAttribute(lum, 1));
    const points = new Points(geo, this._starMaterial(1.6, true));
    points.frustumCulled = false;
    points.renderOrder = 4;
    return points;
  }

  // The smaller images first, so the Galaxy appears quickly; large screens then swap in the
  // full-resolution ones — fetched only once the Galaxy is on screen (a visitor who never leaves
  // the hero doesn't download them) and uploaded only while the camera is still, so it never
  // costs a scrolling frame
  _load() {
    const big = !this.mobile && this.renderer.capabilities.maxTextureSize >= 8192;
    const loader = new ImageBitmapLoader();
    loader.setOptions({ imageOrientation: 'flipY' });
    const texture = (bitmap, mipmaps) => {
      const t = new Texture(bitmap);
      t.flipY = false;
      t.colorSpace = SRGBColorSpace;
      t.generateMipmaps = mipmaps;
      t.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
      t.needsUpdate = true;
      return t;
    };
    const setSky = bitmap => {
      const t = texture(bitmap, false);
      t.wrapS = RepeatWrapping;   // seamless where longitude wraps
      this.renderer.initTexture(t);
      this.sky.material.uniforms.tSky.value?.dispose();
      this.sky.material.uniforms.tSky.value = t;
      this.loaded.sky = true;
      this.drawnState = this.drawnScene = '';
    };
    const setMap = bitmap => {
      const t = texture(bitmap, true);
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.renderer.initTexture(t);
      this.diskShared.tMap.value?.dispose();
      this.diskShared.tMap.value = t;
      this.diskShared.uTexSize.value = bitmap.width;
      this.loaded.map = true;
      this.drawnState = this.drawnScene = '';
    };
    this.pendingUploads = [];
    this.pendingFetches = [];
    loader.load(`${ASSETS}sky-4k.webp`, bitmap => {
      setSky(bitmap);
      if (big) this.pendingFetches.push(() => loader.load(`${ASSETS}sky-6k.webp`, full => this.pendingUploads.push(() => setSky(full))));
    });
    loader.load(`${ASSETS}faceon-2k.webp`, bitmap => {
      setMap(bitmap);
      if (big) this.pendingFetches.push(() => loader.load(`${ASSETS}faceon-5k.webp`, full => this.pendingUploads.push(() => setMap(full))));
    });
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      this.stars = this._makeGalaxyStars(ctx.getImageData(0, 0, c.width, c.height));
      this.scene.add(this.stars);
      this.loaded.stars = true;
    };
    img.src = `${ASSETS}faceon-sample.jpg`;
  }

  setStation(u) { this.u = u; }

  // True once the camera has (nearly) come to rest at its station
  get settled() { return Math.abs(this.u - this.uSmooth) < 0.03 && Math.abs(this.uVelocity) < 0.05; }

  setIntro(k) { this.intro = k; }

  // 0 → 1 after the last page: a logarithmic fall from parsecs to the event horizon
  setFinale(p) { this.finale = p; }

  // The pointer, in CSS pixels (null when it leaves the window)
  setCursor(x, y) {
    this.cursorOn = x !== null;
    if (this.cursorOn) this.cursor = { x: x / window.innerWidth, y: 1 - y / window.innerHeight };
  }

  setLensStrength(k) { this.lensStrength = k; }

  // A gravitational wave from a point on the screen (CSS pixels); amp is the strain
  addRipple(x, y, amp) {
    if (this.reducedMotion) return;
    if (this.ripples.length >= 4) this.ripples.shift();
    this.ripples.push({ x: x / window.innerWidth, y: 1 - y / window.innerHeight, age: 0, amp });
  }

  // The direction of the Sun on screen (uv, y up) and whether it is in front of the camera,
  // for the comets' tails
  sunOnScreen() {
    const v = SUN.clone().project(this.camera);
    return { x: (v.x + 1) / 2, y: (v.y + 1) / 2, ahead: v.z < 1 };
  }

  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    this.drawnState = this.drawnScene = '';
    if (active) this._fetchFullResolution();
  }

  // Start the full-resolution downloads when the browser is next idle (and again for any
  // whose smaller version arrives later)
  _fetchFullResolution() {
    const run = () => {
      while (this.pendingFetches.length) this.pendingFetches.shift()();
      if (!this.loaded.sky || !this.loaded.map) setTimeout(run, 1000);
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 500);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize(), { passive: true });
    this.timer.connect(document);   // pauses across hidden tabs
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this._sizeTarget();
    const dpr = this.renderer.getPixelRatio();
    this.background.material.uniforms.uDpr.value = dpr;
    if (this.stars) this.stars.material.uniforms.uDpr.value = dpr;
    this.drawnState = this.drawnScene = '';
  }

  // Interpolate between stations: direction and log-distance from the centre, so the
  // camera moves evenly from tens of kiloparsecs down to parsecs
  _pose(u) {
    const n = STATIONS.length;
    const i = Math.min(Math.floor(u), n - 2), t = clamp01(u - i);
    const A = STATIONS[i], B = STATIONS[i + 1];
    const pa = new Vector3(...A.pos), pb = new Vector3(...B.pos);
    const ra = pa.length(), rb = pb.length();
    const da = pa.clone().normalize(), db = pb.clone().normalize();
    const turn = new Quaternion().slerp(new Quaternion().setFromUnitVectors(da, db), t);
    const pos = da.applyQuaternion(turn).multiplyScalar(Math.exp(lerp(Math.log(ra), Math.log(rb), t)));
    const target = new Vector3(...A.target).lerp(new Vector3(...B.target), t);
    return {
      pos, target,
      fov: lerp(A.fov, B.fov, t),
      exposure: Math.exp(lerp(Math.log(A.exposure), Math.log(B.exposure), t)),
    };
  }

  _loop() {
    this.raf = requestAnimationFrame(this._loop);
    if (document.hidden) return;
    this.timer.update();
    const rawDt = this.timer.getDelta();
    const dt = Math.min(rawDt, 0.1);

    if (this.reducedMotion) {
      // Reduced motion: no flight between places. The camera cuts from one station to the next
      // halfway through each open stretch, and follows the finale exactly with the scroll
      this.uSmooth = Math.round(this.u);
      this.uVelocity = 0;
      this.finaleSmooth = this.finale;
      this.finaleVelocity = 0;
    } else {
      // The camera has inertia: it follows the scroll position on a critically damped spring
      [this.uSmooth, this.uVelocity] = followSpring(this.uSmooth, this.uVelocity, this.u, dt);
      [this.finaleSmooth, this.finaleVelocity] = followSpring(this.finaleSmooth, this.finaleVelocity, this.finale, dt);
    }
    const f = this.finaleSmooth;

    const allLoaded = this.loaded.sky && this.loaded.map && this.loaded.stars;
    if (allLoaded && this.ready < 1) this.ready = Math.min(1, this.ready + dt / 1.2);

    const { pos, target, fov, exposure } = this._pose(this.uSmooth);
    let fovNow = fov;
    const up = new Vector3(0, 1, 0);
    if (f > 0) {
      // Fall into Sgr A*: logarithmic in distance, from 5 pc to just outside the photon sphere,
      // spiralling about the disk's axis as a body with angular momentum would; the camera
      // turns so the disk lies level
      // (the parsecs go by quickly; most of the scroll is spent near the hole)
      const fall = 1 - Math.pow(1 - clamp01((f - 0.05) / 0.9), 2.2);
      const dist = Math.exp(lerp(Math.log(pos.length()), Math.log(RS_KPC * 2.2), fall));
      pos.setLength(dist).applyAxisAngle(DISK_AXIS, this.reducedMotion ? 0 : 1.4 * Math.pow(smoothstep(0.4, 1.0, f), 2));
      target.set(0, 0, 0);
      up.lerp(DISK_AXIS, smoothstep(0.05, 0.4, f)).normalize();
      // The lens widens at the end, so the shadow (45° across at 3 rs) is seen swallowing the ring
      fovNow = lerp(lerp(fov, 40, smoothstep(0, 0.6, f)), 100, smoothstep(0.6, 0.92, f));
    }
    const look = new Matrix4().lookAt(pos, target, up);
    const quat = new Quaternion().setFromRotationMatrix(look);

    // Near the hole the disk keeps orbiting, so frames are drawn continuously there
    const rsDist = pos.length() / RS_KPC;
    const lensing = f > 0 && rsDist < 5000;
    this.diskTime += lensing && !this.reducedMotion ? dt * RS_PER_SECOND : 0;   // reduced motion: the disk holds still
    // The pointer's lens grows in and out; none in the fall (Sgr A* is the lens there)
    const lensTarget = this.cursorOn && f === 0 && !this.reducedMotion ? (this.mobile ? 0.04 : 0.05) * this.lensStrength : 0;
    this.lensRadius += (lensTarget - this.lensRadius) * (1 - Math.exp(-8 * dt));
    if (Math.abs(this.lensRadius - lensTarget) < 2e-4) this.lensRadius = lensTarget;
    // Speed from the camera's flight between chapters, capped at a quarter of c
    this.beta = this.reducedMotion || f > 0 ? 0 : 0.25 * Math.tanh(this.uVelocity * 0.7);
    if (Math.abs(this.beta) < 2e-3) this.beta = 0;
    this.ripples.forEach(r => { r.age += dt; });
    this.ripples = this.ripples.filter(r => r.age < 4);

    // Moving forward, aberration pulls in light from beyond the screen's edge: render the scene
    // that much wider. The screen's corner at θ shows light from θ' with
    // tan(θ'/2) = √((1+β)/(1−β))·tan(θ/2), so the frame is widened by tan θ' / tan θ
    const cam = this.camera;
    const halfTan = Math.tan(MathUtils.degToRad(fovNow) / 2);
    let margin = 1;
    if (this.beta > 0) {
      const corner = Math.atan(halfTan * Math.hypot(1, cam.aspect));
      const seen = 2 * Math.atan(Math.sqrt((1 + this.beta) / (1 - this.beta)) * Math.tan(corner / 2));
      margin = Math.min(Math.tan(seen) / Math.tan(corner), 1.6);
    }

    // Two things can need drawing: the 3D scene (only when the camera has moved) and the final
    // pass over it (also for the pointer's lens, the waves and the fade). The pointer and the
    // waves only ever redraw the final pass, which is one cheap full-screen shader
    const key = values => values.map(v => (typeof v === 'number' ? v.toPrecision(7) : v)).join(',');
    const sceneState = key([pos.x, pos.y, pos.z, quat.x, quat.y, quat.z, quat.w, fovNow, margin, this.ready, this.active]);
    const postState = key([this.intro, f, this.ready, lensing && f < 0.99 ? this.diskTime : 0,
      this.lensRadius, this.lensRadius ? this.cursor.x : 0, this.lensRadius ? this.cursor.y : 0, this.beta,
      this.ripples.length ? this.timer.getElapsed() : 0]);
    const state = sceneState + '|' + postState;
    // After moving frames (drawn at reduced resolution), one crisp frame once the camera has been
    // still for a moment (the pointer's lens and the waves don't count: they don't move the camera)
    this.sceneStill = sceneState === this.drawnScene ? (this.sceneStill || 0) + dt : 0;
    const crisp = this.crispPending && this.sceneStill > 0.15;
    if (!this.active || (state === this.drawnState && !crisp)) {
      // Hidden or still: a good moment for one deferred upload of a full-resolution image
      this.stillFor += dt;
      if (this.stillFor > 0.5 && this.pendingUploads.length) {
        this.pendingUploads.shift()();
        this.stillFor = 0;
      }
      return;
    }
    this.stillFor = 0;
    this.drawnState = state;
    let sceneMoved = sceneState !== this.drawnScene || crisp;
    this.drawnScene = sceneState;

    // If moving frames are consistently slow, lower the resolution a step (never below 1×)
    if (sceneMoved) {
      if (rawDt > 1 / 45) this.slowFrames += 1; else this.slowFrames = Math.max(0, this.slowFrames - 1);
    }
    if (this.slowFrames > 40 && this.baseDpr > 1) {
      this.baseDpr = Math.max(1, this.baseDpr - 0.25);
      this.slowFrames = 0;
    }
    // Every pixel of the fall into Sgr A* is ray-traced: there, one pixel per CSS pixel is plenty
    const dprNow = lensing ? Math.min(this.baseDpr, this.mobile ? 0.75 : 1) : this.baseDpr;
    if (dprNow !== this.renderer.getPixelRatio()) {
      this.renderer.setPixelRatio(dprNow);
      this._resize();
      this.drawnState = state;
      this.drawnScene = sceneState;
      sceneMoved = true;   // the targets were just reallocated: draw into them now
    }

    // Scroll is time: "now" at the Sun, 10 million years per chapter
    const myr = (this.uSmooth - 1) * 10;
    this.onReadout?.({
      x: pos.x,
      z: pos.z,
      kpc: pos.length(),
      myr,
      clock: rsDist < 1e4 ? Math.sqrt(Math.max(0, 1 - 1 / rsDist)) : null,   // a static clock's rate here
    });

    // Camera
    cam.position.copy(pos);
    cam.quaternion.copy(quat);
    cam.fov = MathUtils.radToDeg(2 * Math.atan(halfTan * margin));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // Layers: the real sky inside the disk, the model outside
    const inside = insideDisk(pos);
    const model = 1 - inside;
    this.sky.position.copy(pos);
    this.sky.visible = inside > 0.001;
    this.sky.material.uniforms.uOpacity.value = inside;
    this.sky.material.uniforms.uForward.value.set(-pos.x, -pos.z).normalize();
    this.background.position.copy(pos);
    this.background.material.uniforms.uOpacity.value = model;

    // The map means nothing at parsec scales: it gives way to the nuclear star cluster
    const disk = model * smoothstep(0.05, 0.5, pos.length());
    this.diskShared.uCam.value.copy(pos);
    this.diskShared.uOpacity.value = disk;
    this.slices.forEach(s => { s.visible = disk > 0.001; });
    const bu = this.bulge.material.uniforms;
    bu.uProjScale.value.set(cam.projectionMatrix.elements[0], cam.projectionMatrix.elements[5]);
    bu.uCamWorld.value.copy(cam.matrixWorld);
    bu.uCam.value.copy(pos);
    bu.uOpacity.value = model;
    bu.uOuter.value = smoothstep(0.03, 0.4, pos.length());
    bu.uCluster.value = 1 - smoothstep(0, 0.35, f);   // the cluster's haze falls behind as the camera dives
    this.bulge.visible = model > 0.001;
    if (this.stars) {
      this.stars.material.uniforms.uOpacity.value = model;
      this.stars.visible = model > 0.001;
    }

    // Final pass; near Sgr A* it traces each pixel's light through curved spacetime
    const fu = this.final.uniforms;
    fu.uExposure.value = exposure;
    fu.uFade.value = this.intro * this.ready * (1 - smoothstep(0.92, 0.99, f));
    fu.uLens.value = lensing ? 1 : 0;
    fu.uProjScale.value.set(cam.projectionMatrix.elements[0] * margin, cam.projectionMatrix.elements[5] * margin);   // the screen's
    fu.uMargin.value = margin;
    fu.uAspect.value = window.innerWidth / window.innerHeight;
    fu.uCursor.value.set(this.cursor.x, this.cursor.y, this.lensRadius);
    fu.uBeta.value = this.beta;
    fu.uRipples.value.forEach((v, i) => {
      const r = this.ripples[i];
      if (r) v.set(r.x, r.y, r.age, r.amp); else v.set(0, 0, 0, 0);
    });
    if (lensing) {
      fu.uCamRs.value.copy(pos).divideScalar(RS_KPC);
      fu.uViewRot.value.setFromMatrix4(cam.matrixWorld);
      fu.uTime.value = this.diskTime;
    }

    // Streaks: where everything was at the previous frame (none after a pause or resize, and
    // none with reduced motion, where the stars also stop orbiting)
    if (this.reducedMotion) this.hasPrev = false;
    this.time.myr.value = this.reducedMotion ? 0 : myr;
    if (!this.hasPrev) {
      this.prevViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.time.prevMyr.value = this.time.myr.value;
      this.prevCamPos.copy(pos);
    }
    this.background.material.uniforms.uPrevModel.value.makeTranslation(this.prevCamPos);

    if (sceneMoved) {
      // Moving: the smaller target. Still (or cutting, with reduced motion): full resolution
      const full = crisp || this.reducedMotion;
      const target = full ? this.target : this.targetFast;
      this.crispPending = !full;
      this._useTarget(target, full ? 1 : this.fastScale);
      this.renderer.setRenderTarget(target);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.renderer.render(this.scene, cam);
      this.renderer.setRenderTarget(null);
      this.prevViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.time.prevMyr.value = this.time.myr.value;
      this.prevCamPos.copy(pos);
      this.hasPrev = true;
    }
    this.renderer.render(this.finalScene, this.finalCamera);
  }
}
