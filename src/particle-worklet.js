/*
  CSS Houdini Organic Cloud Particles
  - Geometry: 3D Swarm
  - Motion: Independent 3D Orbits
  - Interaction: Differential Mouse Follow (3D-Aware)
  - Depth: Perspective Projection (Scaling size and opacity)
*/

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

registerPaint("ring-particles", class {
    static get inputProperties() {
        return [
            "--ring-radius",
            "--particle-count",
            "--particle-size",
            "--animation-tick",
            "--ring-x",
            "--ring-y",
            "--mouse-x-instant",
            "--mouse-y-instant",
            "--particle-hue"
        ];
    }

    paint(ctx, size, props) {
        const count = parseInt(props.get("--particle-count").toString()) || 400;
        const baseSize = parseFloat(props.get("--particle-size").toString()) || 4;
        const tick = parseFloat(props.get("--animation-tick").toString()) || 0;

        const baseY = parseFloat(props.get("--ring-y").toString()) || size.height / 2;
        const baseX = parseFloat(props.get("--ring-x").toString()) || size.width / 2;

        // Pre-compute tick-derived constants (outside particle loop)
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

        const driftX = Math.sin(tickDrift1) * 80;
        const driftY = Math.cos(tickDrift2) * 50;

        const ringX = baseX + driftX;
        const ringY = baseY + driftY;

        const mouseX = parseFloat(props.get("--mouse-x-instant").toString()) || 0;
        const mouseY = parseFloat(props.get("--mouse-y-instant").toString()) || 0;

        const maxRadius = parseFloat(props.get("--ring-radius").toString()) || 500;
        const influenceRadius = 1000;
        const invInfluenceRadius = 1 / influenceRadius;
        const invMaxRadius = 1 / maxRadius;

        const rawRows = props.get("--particle-rows");
        const numRows = rawRows ? parseInt(rawRows.toString()) : 12;

        // Calculate proportional particle counts per ring (sqrt-weighted density)
        let totalWeight = 0;
        for (let r = 0; r < numRows; r++) {
            totalWeight += Math.sqrt(r + 1);
        }
        const invTotalWeight = 1 / totalWeight;

        // Build flat parallel arrays instead of object array (avoids per-particle destructuring)
        const rowIndices = new Int32Array(count);
        const particleInRow = new Int32Array(count);
        const particlesPerRow = new Int32Array(count);
        let idx = 0;

        for (let r = 0; r < numRows; r++) {
            const weight = Math.sqrt(r + 1);
            const numP = Math.floor(count * (weight * invTotalWeight));
            for (let p = 0; p < numP && idx < count; p++) {
                rowIndices[idx] = r;
                particleInRow[idx] = p;
                particlesPerRow[idx] = numP;
                idx++;
            }
        }
        const actualCount = idx;

        // Pre-compute ring distances (already sorted by construction — no sort needed)
        const ringDistances = new Float64Array(numRows);
        const innerRadius = maxRadius * 0.25;
        const radiusRange = maxRadius - innerRadius;
        const invNumRowsM1 = 1 / (numRows - 1 || 1);
        for (let r = 0; r < numRows; r++) {
            ringDistances[r] = innerRadius + (r * invNumRowsM1) * radiusRange;
        }

        // Pre-compute tilt and uniform scale
        const tiltAxisAngle = tickTilt;
        const uniformScale = 1 + Math.sin(tickUniform) * 0.15;
        const focalLength = 600;

        // Cache math functions
        const mSin = Math.sin;
        const mCos = Math.cos;

        const baseHue = parseFloat(props.get("--particle-hue")?.toString() || 224);

        // Set lineCap once (constant across all particles)
        ctx.lineCap = "round";

        for (let i = 0; i < actualCount; i++) {
            const rowIndex = rowIndices[i];
            const pInRow = particleInRow[i];
            const pCount = particlesPerRow[i];

            const dist = ringDistances[rowIndex];
            const distRatio = dist * invMaxRadius;

            const orbitSpeed = 0.0002;
            const currentAngle = ((pInRow / pCount) * Math.PI * 2) + tickOrbit;

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

            let screenX = ringX + (p1x * geometricScale);
            let screenY = ringY + (p1y * geometricScale);

            // Mouse interaction
            const dxMouse = mouseX - screenX;
            const dyMouse = mouseY - screenY;
            const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;

            let localVelocity = orbitSpeed * 1000 * opticalScale;

            if (distMouseSq < influenceRadius * influenceRadius) {
                const distMouse = Math.sqrt(distMouseSq);
                const force = Math.pow(1 - (distMouse * invInfluenceRadius), 1.8);
                const pullStrength = force * 0.475;

                screenX += dxMouse * pullStrength;
                screenY += dyMouse * pullStrength;
                localVelocity += pullStrength * 50;
            }

            const angleToCenter = Math.atan2(screenY - ringY, screenX - ringX);

            // Color & Shading
            let normalizedAngle = ((angleToCenter + Math.PI) / (Math.PI * 2) + tickAngleShift) % 1;
            if (normalizedAngle < 0) normalizedAngle += 1;

            let hue = baseHue + mSin(normalizedAngle * Math.PI * 2) * 15;

            // Multi-wave color spreading
            const blueIntensity = (mSin((p1x * 0.707 + p1y * 0.707) * 0.005 - tickColor) + 1) * 0.5;
            const orangeIntensity = (mSin(p1x * -0.006 - tickColor * 0.8 + 2.0) + 1) * 0.5;
            const redIntensity = (mSin((p1x * 0.707 + p1y * -0.707) * 0.004 - tickColor * 1.2 + 4.0) + 1) * 0.5;

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

            // Particle sizing
            const sizeScale = Math.min(opticalScale, 2.5);
            let lineThickness = Math.max(0.5, baseSize * sizeScale);

            // Non-uniform shrinking wave
            const wavePhase = (currentAngle * 2) + (dist * 0.01) - tickWave;
            const waveFactor = (mSin(wavePhase) + 1) * 0.5;
            const shrinkMultiplier = lerp(0.1, 1.0, waveFactor);
            lineThickness *= shrinkMultiplier;

            const expansionBonus = Math.min(localVelocity * 0.05, 1.5) * shrinkMultiplier;
            const finalThickness = lineThickness + expansionBonus;

            // Render — manual transform instead of save/restore (faster)
            ctx.setTransform(1, 0, 0, 1, screenX, screenY);
            const cos = mCos(angleToCenter);
            const sin = mSin(angleToCenter);
            ctx.transform(cos, sin, -sin, cos, 0, 0);

            ctx.lineWidth = finalThickness;
            ctx.beginPath();
            ctx.moveTo(0, 0);

            // Stretch calculation
            const rawStretch = distRatio;
            const positionAllowance = rawStretch < 0.3 ? 0 : Math.pow(rawStretch, 1.5);
            const phaseAllowance = Math.max(0, (uniformScale - 1) / 0.15);

            const stretchLength = (positionAllowance * phaseAllowance) > 0 ?
                Math.max(0.1, (localVelocity * 0.7) * (positionAllowance * phaseAllowance)) : 0.1;

            ctx.lineTo(stretchLength, 0);
            ctx.stroke();
        }

        // Reset transform at end
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
});
