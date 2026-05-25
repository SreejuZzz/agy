/*
  Canvas 2D Fallback — Organic Cloud Particles
  Replicates the CSS Houdini Paint Worklet (particle-worklet.js) identically.

  - Geometry: 3D Swarm with sqrt-weighted ring density
  - Motion: Independent 3D orbits, tilt, breathing, silk waves
  - Interaction: Mouse follow (lerp-smoothed) + differential pull
  - Depth: Perspective projection (scale + alpha)
  - Color: Multi-wave hue snapping (blue/orange/red)

  Exported function: initCanvasFallback()
*/

// ─── Utility ────────────────────────────────────────────────────────
function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

// ─── Main Entry ─────────────────────────────────────────────────────
export function initCanvasFallback() {
  // ── Canvas Setup ────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // ── State ───────────────────────────────────────────────────────
  let width = 0;
  let height = 0;

  // Mouse tracking (raw & lerp-smoothed ring center)
  let mouseX = 0;
  let mouseY = 0;
  let ringBaseX = 0; // lerp-smoothed target for ring center
  let ringBaseY = 0;
  let mouseInitialized = false;

  // Animation state
  let tick = 0;
  let lastTime = 0;
  let paused = false;
  let frameCount = 0;

  // CSS custom-property cache (re-read periodically)
  let maxRadius = 570;
  let particleCount = 600;
  let numRows = 45;
  let baseSize = 3;
  let baseHue = 224;

  // Pre-computed per-config arrays (rebuilt when config changes)
  let rowIndices = null;
  let particleInRow = null;
  let particlesPerRow = null;
  let ringDistances = null;
  let actualCount = 0;
  let innerRadius = 0;
  let invMaxRadius = 0;

  // Lerp constant: framerate-independent base
  const LERP_BASE = 0.012;
  const LERP_REF_DT = 16.667; // ms — reference frame time (60 fps)

  // ── Read CSS Custom Properties ──────────────────────────────────
  function readCSSProps() {
    const s = getComputedStyle(document.documentElement);
    const parse = (name, fallback) => {
      const raw = s.getPropertyValue(name).trim();
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : fallback;
    };
    maxRadius = parse("--ring-radius", 570);
    particleCount = Math.round(parse("--particle-count", 600));
    numRows = Math.round(parse("--particle-rows", 45));
    baseSize = parse("--particle-size", 3);
    baseHue = parse("--particle-hue", 224);
  }

  // ── Build Particle Layout Arrays (mirrors worklet exactly) ──────
  function buildLayout() {
    // sqrt-weighted density distribution across rings
    let totalWeight = 0;
    for (let r = 0; r < numRows; r++) {
      totalWeight += Math.sqrt(r + 1);
    }
    const invTotalWeight = 1 / totalWeight;

    rowIndices = new Int32Array(particleCount);
    particleInRow = new Int32Array(particleCount);
    particlesPerRow = new Int32Array(particleCount);
    let idx = 0;

    for (let r = 0; r < numRows; r++) {
      const weight = Math.sqrt(r + 1);
      const numP = Math.floor(particleCount * (weight * invTotalWeight));
      for (let p = 0; p < numP && idx < particleCount; p++) {
        rowIndices[idx] = r;
        particleInRow[idx] = p;
        particlesPerRow[idx] = numP;
        idx++;
      }
    }
    actualCount = idx;

    // Ring distances (inner → outer)
    ringDistances = new Float64Array(numRows);
    innerRadius = maxRadius * 0.25;
    const radiusRange = maxRadius - innerRadius;
    const invNumRowsM1 = 1 / (numRows - 1 || 1);
    for (let r = 0; r < numRows; r++) {
      ringDistances[r] = innerRadius + (r * invNumRowsM1) * radiusRange;
    }
    invMaxRadius = 1 / maxRadius;
  }

  // ── Resize Handler ──────────────────────────────────────────────
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Re-center ring if mouse hasn't been set yet
    if (!mouseInitialized) {
      ringBaseX = width / 2;
      ringBaseY = height / 2;
      mouseX = width / 2;
      mouseY = height / 2;
    }
  }

  // ── Event Listeners ─────────────────────────────────────────────
  window.addEventListener("resize", resize, { passive: true });

  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!mouseInitialized) {
        // Snap ring center to first known mouse position to avoid an
        // initial lerp-from-center animation.
        ringBaseX = mouseX;
        ringBaseY = mouseY;
        mouseInitialized = true;
      }
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      paused = true;
    } else {
      paused = false;
      lastTime = 0; // reset so next delta isn't huge
    }
  });

  // ── Core Render Frame ───────────────────────────────────────────
  function frame(timestamp) {
    requestAnimationFrame(frame);
    if (paused) return;

    // Delta-time calculation (ms)
    if (lastTime === 0) lastTime = timestamp;
    const dt = Math.min(timestamp - lastTime, 100); // cap at 100ms to avoid huge jumps
    lastTime = timestamp;

    // Advance tick (matches worklet's --animation-tick)
    tick += dt;

    // Frame-rate-independent lerp for ring following mouse
    // lerp factor = 1 - (1 - LERP_BASE)^(dt / refDt)
    const lerpFactor = 1 - Math.pow(1 - LERP_BASE, dt / LERP_REF_DT);
    ringBaseX = lerp(ringBaseX, mouseX, lerpFactor);
    ringBaseY = lerp(ringBaseY, mouseY, lerpFactor);

    // Periodically re-read CSS props (handles light-mode toggles, media queries)
    frameCount++;
    if (frameCount % 60 === 0) {
      const prevRadius = maxRadius;
      const prevCount = particleCount;
      const prevRows = numRows;
      readCSSProps();
      if (
        maxRadius !== prevRadius ||
        particleCount !== prevCount ||
        numRows !== prevRows
      ) {
        buildLayout();
      }
    }

    // ── Pre-compute tick-derived constants ───────────────────────
    const tickDrift1 = tick * 0.002;
    const tickDrift2 = tick * 0.0015;
    const tickTilt = tick * 0.003;
    const tickOrbit = tick * 0.0002;
    const tickBreath = tick * 0.01;
    const tickSilk = tick * 0.006;
    const tickUniform = tick * 0.05;
    const tickWave = tick * 0.02;
    const tickColor = tick * 0.005;
    const tickAngleShift = tick * 0.0002;

    // Organic drift
    const driftX = Math.sin(tickDrift1) * 80;
    const driftY = Math.cos(tickDrift2) * 50;

    const ringX = ringBaseX + driftX;
    const ringY = ringBaseY + driftY;

    const influenceRadius = 1000;
    const invInfluenceRadius = 1 / influenceRadius;

    const tiltAxisAngle = tickTilt;
    const uniformScale = 1 + Math.sin(tickUniform) * 0.15;
    const focalLength = 600;

    // Cache Math
    const mSin = Math.sin;
    const mCos = Math.cos;

    // ── Clear Canvas ────────────────────────────────────────────
    // Reset transform, clear, then restore DPR transform
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineCap = "round";

    // ── Particle Loop (mirrors worklet exactly) ─────────────────
    for (let i = 0; i < actualCount; i++) {
      const rowIndex = rowIndices[i];
      const pInRow = particleInRow[i];
      const pCount = particlesPerRow[i];

      const dist = ringDistances[rowIndex];
      const distRatio = dist * invMaxRadius;

      const orbitSpeed = 0.0002;
      const currentAngle = (pInRow / pCount) * Math.PI * 2 + tickOrbit;

      const p1x = mCos(currentAngle) * dist;
      const p1y = mSin(currentAngle) * dist;

      // Tilt displacement
      const angleFromTiltAxis = currentAngle - tiltAxisAngle;
      const maxTiltZ = 350;
      let p1z = mSin(angleFromTiltAxis) * maxTiltZ * distRatio;

      // Breathing wave
      p1z += mSin(dist * 0.02 - tickBreath) * 30;

      // Silk wave
      p1z += mSin(p1x * 0.004 + p1y * 0.002 - tickSilk) * 50;

      // Dampen center
      if (dist < 80) p1z *= dist / 80;

      // Perspective projection
      const zDepth = 800 + p1z;
      if (zDepth <= 10) continue;

      const invZDepth = 1 / zDepth;
      const geometricScale = focalLength * invZDepth * uniformScale;
      const opticalScale = focalLength * invZDepth;

      let screenX = ringX + p1x * geometricScale;
      let screenY = ringY + p1y * geometricScale;

      // Mouse interaction
      const dxMouse = mouseX - screenX;
      const dyMouse = mouseY - screenY;
      const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;

      let localVelocity = orbitSpeed * 1000 * opticalScale;

      if (distMouseSq < influenceRadius * influenceRadius) {
        const distMouse = Math.sqrt(distMouseSq);
        const force = Math.pow(1 - distMouse * invInfluenceRadius, 1.8);
        const pullStrength = force * 0.475;

        screenX += dxMouse * pullStrength;
        screenY += dyMouse * pullStrength;
        localVelocity += pullStrength * 50;
      }

      const angleToCenter = Math.atan2(screenY - ringY, screenX - ringX);

      // ── Color & Shading (exact worklet math) ────────────────
      let normalizedAngle =
        ((angleToCenter + Math.PI) / (Math.PI * 2) + tickAngleShift) % 1;
      if (normalizedAngle < 0) normalizedAngle += 1;

      let hue = baseHue + mSin(normalizedAngle * Math.PI * 2) * 15;

      // Multi-wave color spreading
      const blueIntensity =
        (mSin((p1x * 0.707 + p1y * 0.707) * 0.005 - tickColor) + 1) * 0.5;
      const orangeIntensity =
        (mSin(p1x * -0.006 - tickColor * 0.8 + 2.0) + 1) * 0.5;
      const redIntensity =
        (mSin((p1x * 0.707 + p1y * -0.707) * 0.004 - tickColor * 1.2 + 4.0) +
          1) *
        0.5;

      const pBlue = blueIntensity * blueIntensity;
      const pOrange = orangeIntensity * orangeIntensity;
      const pRed = redIntensity * redIntensity;

      const maxIntensity = Math.max(pBlue, pOrange, pRed);
      if (maxIntensity === pBlue) {
        hue = 224;
      } else if (maxIntensity === pOrange) {
        hue = 25;
      } else {
        hue = 355;
      }

      const totalIntensity = pBlue + pOrange + pRed || 1;

      const shineFactor = (mSin(normalizedAngle * Math.PI * 2) + 1) * 0.5;
      const saturation = lerp(80, 100, shineFactor);

      // Depth fading
      const depthFactor = Math.max(0, Math.min(1, (p1z + 350) / 700));
      const alpha = lerp(0.95, 0.05, depthFactor);

      let baseLightness = lerp(40, 75, shineFactor);
      const maxWarmIntensity = Math.max(pOrange, pRed);
      baseLightness = lerp(baseLightness, 65, maxWarmIntensity / totalIntensity);
      const lightness = lerp(baseLightness, 5, depthFactor);

      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;

      // ── Particle Sizing ─────────────────────────────────────
      const sizeScale = Math.min(opticalScale, 2.5);
      let lineThickness = Math.max(0.5, baseSize * sizeScale);

      // Non-uniform shrinking wave
      const wavePhase = currentAngle * 2 + dist * 0.01 - tickWave;
      const waveFactor = (mSin(wavePhase) + 1) * 0.5;
      const shrinkMultiplier = lerp(0.1, 1.0, waveFactor);
      lineThickness *= shrinkMultiplier;

      const expansionBonus =
        Math.min(localVelocity * 0.05, 1.5) * shrinkMultiplier;
      const finalThickness = lineThickness + expansionBonus;

      // ── Render (manual transform — matches worklet) ─────────
      ctx.setTransform(dpr, 0, 0, dpr, screenX * dpr, screenY * dpr);
      const cos = mCos(angleToCenter);
      const sin = mSin(angleToCenter);
      ctx.transform(cos, sin, -sin, cos, 0, 0);

      ctx.lineWidth = finalThickness;
      ctx.beginPath();
      ctx.moveTo(0, 0);

      // Stretch calculation
      const rawStretch = distRatio;
      const positionAllowance =
        rawStretch < 0.3 ? 0 : Math.pow(rawStretch, 1.5);
      const phaseAllowance = Math.max(0, (uniformScale - 1) / 0.15);

      const stretchLength =
        positionAllowance * phaseAllowance > 0
          ? Math.max(
              0.1,
              localVelocity * 0.7 * (positionAllowance * phaseAllowance)
            )
          : 0.1;

      ctx.lineTo(stretchLength, 0);
      ctx.stroke();
    }

    // Reset transform at end of frame
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  readCSSProps();
  buildLayout();
  resize();
  requestAnimationFrame(frame);
}
