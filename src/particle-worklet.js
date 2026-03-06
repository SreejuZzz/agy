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
            "--particle-hue" // Add dynamic theme base color input
        ];
    }

    paint(ctx, size, props) {
        const count = parseInt(props.get("--particle-count").toString()) || 400;
        const baseSize = parseFloat(props.get("--particle-size").toString()) || 4;
        const tick = parseFloat(props.get("--animation-tick").toString()) || 0;



        // Center point with a subtle, slow global drift
        // This ensures the ring is always floating slightly and isn't locked dead-center
        const baseY = parseFloat(props.get("--ring-y").toString()) || size.height / 2;
        const baseX = parseFloat(props.get("--ring-x").toString()) || size.width / 2;

        const driftX = Math.sin(tick * 0.002) * 80;
        const driftY = Math.cos(tick * 0.0015) * 50;

        const ringX = baseX + driftX;
        const ringY = baseY + driftY;

        // Mouse coordinates (Instantaneous pure bypass)
        const mouseX = parseFloat(props.get("--mouse-x-instant").toString()) || 0;
        const mouseY = parseFloat(props.get("--mouse-y-instant").toString()) || 0;

        const maxRadius = parseFloat(props.get("--ring-radius").toString()) || 500;
        // Massive influence radius to stretch the entire hemisphere of the ring deeply toward the cursor
        const influenceRadius = 1000;

        // Define concentric rings
        const rawRows = props.get("--particle-rows");
        const numRows = rawRows ? parseInt(rawRows.toString()) : 12; // 12 distinct rings

        // Calculate proportional particle counts (fewer in inner rings, more in outer)
        // Using Math.sqrt creates a much smoother, beautiful gradual transition in density
        // instead of a harsh linear ramp, ensuring the outer rings don't become too sparse with fewer particles.
        let totalWeight = 0;
        for (let r = 0; r < numRows; r++) {
            totalWeight += Math.sqrt(r + 1);
        }

        const rowCounts = [];
        for (let r = 0; r < numRows; r++) {
            const weight = Math.sqrt(r + 1);
            rowCounts.push(Math.floor(count * (weight / totalWeight)));
        }

        const particleConfigs = [];
        for (let r = 0; r < numRows; r++) {
            const numP = rowCounts[r];
            for (let p = 0; p < numP; p++) {
                particleConfigs.push({ rowIndex: r, particleIndexInRow: p, particlesInThisRow: numP });
            }
        }

        // Pre-calculate perfectly uniform distances for the rings
        const ringDistances = [];
        const innerRadius = maxRadius * 0.25; // Clean defined hollow center
        for (let r = 0; r < numRows; r++) {
            const fraction = r / (numRows - 1 || 1);
            ringDistances.push(innerRadius + fraction * (maxRadius - innerRadius));
        }
        ringDistances.sort((a, b) => a - b);

        // Cache heavy math functions outside loop for performance
        const mSin = Math.sin;
        const mCos = Math.cos;

        for (let i = 0; i < count; i++) {
            // --- 1. Structured Distribution & Motion ---
            if (i >= particleConfigs.length) continue;
            const { rowIndex, particleIndexInRow, particlesInThisRow } = particleConfigs[i];

            const dist = ringDistances[rowIndex];
            const distanceFactor = 1 - (dist / maxRadius);

            const orbitSpeed = 0.0002;
            const currentAngle = ((particleIndexInRow / particlesInThisRow) * Math.PI * 2) + (tick * orbitSpeed);

            // Perfect geometric circles
            const p1x = mCos(currentAngle) * dist;
            const p1y = mSin(currentAngle) * dist;

            // Instead of a ripple, we tilt the entire ring structure slowly like a spinning galaxy or a coin.
            // The tilt axis slowly rotates around the center.
            const tiltAxisAngle = tick * 0.003;
            const angleFromTiltAxis = currentAngle - tiltAxisAngle;

            // The tilt displaces the Z axis smoothly from one side to the other.
            // High tilt to ensure deep Z penetration without zooming the camera.
            const maxTiltZ = 350;
            let p1z = mSin(angleFromTiltAxis) * maxTiltZ * (dist / maxRadius);

            // Add a very gentle breathing wave that sweeps across the ring
            // This replaces the chaotic 'oceanic' waves
            const breathingWave = mSin(dist * 0.02 - tick * 0.01) * 30;
            p1z += breathingWave;

            // Add an elegant, subtle, diagonal "silk in the breeze" wave
            // This is a slow, sweeping motion that moves gently across the whole structure to feel more premium.
            const windX = p1x * 0.004;
            const windY = p1y * 0.002;
            const silkWave = mSin(windX + windY - tick * 0.006) * 50;
            p1z += silkWave;

            // Dampen the depth displacement near the strictly dead center focal point
            p1z *= dist < 80 ? (dist / 80) : 1;

            // Uniform Expanding & Shrinking animation (Breathe Effect)
            const uniformScale = 1 + mSin(tick * 0.05) * 0.15;

            // --- 3. Perspective Projection ---
            // Reverted camera values to maintain the original, clean ring size globally.
            const focalLength = 600;
            const zDepth = 800 + p1z;

            if (zDepth <= 10) continue;
            const geometricScale = (focalLength / zDepth) * uniformScale;

            // Optical scaling for volume and thickness
            const opticalScale = focalLength / Math.max(10, zDepth);

            let screenX = ringX + (p1x * geometricScale);
            let screenY = ringY + (p1y * geometricScale);

            // --- 4. INDIVIDUAL Particle Mouse Interaction ---
            const dxMouse = mouseX - screenX;
            const dyMouse = mouseY - screenY;
            const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

            let localVelocity = orbitSpeed * 1000 * opticalScale;

            if (distMouse < influenceRadius) {
                // Highly elastic, sweeping continuous gravity pull
                // Deeper power curve creates a giant wide teardrop shape stretching heavily into the mouse
                const force = Math.pow(1 - (distMouse / influenceRadius), 1.8);

                // Pure spring-snap into the cursor. Reduced by 50% per request.
                const pullStrength = force * 0.475; // Was 0.95, now halved for less intense rubber-banding

                screenX += dxMouse * pullStrength;
                screenY += dyMouse * pullStrength;
                localVelocity += pullStrength * 50; // Vastly enhances visual velocity stretching thickness
            }

            const angleToCenter = Math.atan2(screenY - ringY, screenX - ringX);

            // --- 5. Color & Shading ---
            let normalizedAngle = ((angleToCenter + Math.PI) / (Math.PI * 2) + tick * 0.0002) % 1;
            if (normalizedAngle < 0) normalizedAngle += 1;

            const baseHue = parseFloat(props.get("--particle-hue")?.toString() || 224);
            let hue = baseHue + mSin(normalizedAngle * Math.PI * 2) * 15;

            // --- MULTI-WAVE COLOR SPREADING ---
            const timeSpeed = tick * 0.005;

            // Wave 1: Blue (sweeps Top-Left to Bottom-Right)
            const blueIntensity = (mSin((p1x * 0.707 + p1y * 0.707) * 0.005 - timeSpeed) + 1) / 2;

            // Wave 2: Orange (sweeps Right to Left)
            const orangeIntensity = (mSin((p1x * -1.0) * 0.006 - timeSpeed * 0.8 + 2.0) + 1) / 2;

            // Wave 3: Red (sweeps Bottom-Left to Top-Right)
            const redIntensity = (mSin((p1x * 0.707 + p1y * -0.707) * 0.004 - timeSpeed * 1.2 + 4.0) + 1) / 2;

            const pBlue = blueIntensity * blueIntensity;
            const pOrange = orangeIntensity * orangeIntensity;
            const pRed = redIntensity * redIntensity;

            const maxIntensity = Math.max(pBlue, pOrange, pRed);
            if (maxIntensity === pBlue) {
                hue = 224; // Vibrant Navy
            } else if (maxIntensity === pOrange) {
                hue = 25; // Vibrant Orange
            } else {
                hue = 355; // Vibrant Red
            }

            const totalIntensity = pBlue + pOrange + pRed || 1;

            // Create a shining gradient spreading from one side
            const shineFactor = (mSin(normalizedAngle * Math.PI * 2) + 1) / 2;

            // Maintain high saturation everywhere so all 3 colors stay vibrant
            let saturation = lerp(80, 100, shineFactor);

            // Exaggerate depth fading for 3D illusion
            const depthFactor = Math.max(0, Math.min(1, (p1z + 350) / 700));
            const alpha = lerp(0.95, 0.05, depthFactor);

            // Adjust lightness for the depth (darker far away) and the shine gradient (brighter on one side)
            let baseLightness = lerp(40, 75, shineFactor);
            // Ensure the vibrant peaks of the Red and Orange waves stay luminous
            const maxWarmIntensity = Math.max(pOrange, pRed);
            baseLightness = lerp(baseLightness, 65, maxWarmIntensity / totalIntensity);

            // The 3D depth wave pushes the lightness down drastically when elements sink far backward
            const lightness = lerp(baseLightness, 5, depthFactor);

            ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;

            // --- 7. Final Particle Rendering ---
            // Allow size to gently build visual volume based strictly on depth context (opticalScale)
            const sizeScale = Math.min(opticalScale, 2.5);
            let lineThickness = Math.max(0.5, baseSize * sizeScale);

            // Create a non-uniform shrinking wave that rolls across the ring
            // The wave is based on the particle's angle and distance, moving over time
            const wavePhase = (currentAngle * 2) + (dist * 0.01) - (tick * 0.02);
            // Math.sin returns -1 to 1. We want it to be 0 to 1, where 0 is shrunk and 1 is full size
            const waveFactor = (mSin(wavePhase) + 1) / 2;

            // Apply shrinking: particles shrink to 10% of their size at the bottom of the wave
            const shrinkMultiplier = lerp(0.1, 1.0, waveFactor);
            lineThickness = lineThickness * shrinkMultiplier;

            // Add slight gentle expansion based strictly on local fluid velocity
            const expansionBonus = Math.min(localVelocity * 0.05, 1.5) * shrinkMultiplier;
            const finalThickness = lineThickness + expansionBonus;

            ctx.save();
            ctx.translate(screenX, screenY);

            // Re-introduce the stretch effect by rotating the particle towards the center
            ctx.rotate(angleToCenter);

            ctx.lineCap = "round";
            ctx.lineWidth = finalThickness;
            ctx.beginPath();
            ctx.moveTo(0, 0);

            // Calculate stretch length: Particles stretch visually only when expanding near the camera 
            // and positioned in the outer rings.
            const rawStretch = dist / maxRadius;
            const positionAllowance = rawStretch < 0.3 ? 0 : Math.pow(rawStretch, 1.5);
            const phaseAllowance = Math.max(0, (uniformScale - 1) / 0.15);

            const stretchLength = (positionAllowance * phaseAllowance) > 0 ?
                Math.max(0.1, (localVelocity * 0.7) * (positionAllowance * phaseAllowance)) : 0.1;

            ctx.lineTo(stretchLength, 0);
            ctx.stroke();
            ctx.restore();
        }
    }
});
