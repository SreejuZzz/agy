/**
 * Now and then, in the open stretches between pages, a comet crosses the screen.
 *
 * Its tails point away from the Sun, not back along its path: the blue ion tail is gas blown
 * straight out by the solar wind; the pale dust tail is pushed more gently by sunlight, so it
 * lags and curves back towards the comet's track. The Sun's direction is the real one, projected
 * from the camera (a comet near the Sun, wherever the camera is looking).
 */

const clamp01 = v => Math.min(Math.max(v, 0), 1);

export function createComets({ world, container }) {
    const canvas = document.createElement('canvas');
    canvas.className = 'comet-layer';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let open = 0, comet = null, raf = 0;
    let nextAt = performance.now() + 5000;

    const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener('resize', size, { passive: true });

    function spawn() {
        const w = window.innerWidth, h = window.innerHeight;
        const fromLeft = Math.random() < 0.5;
        // Enter high on one side, leave lower on the other, on a gently curved track
        const p0 = { x: fromLeft ? -80 : w + 80, y: h * (0.08 + Math.random() * 0.35) };
        const p2 = { x: fromLeft ? w + 80 : -80, y: h * (0.35 + Math.random() * 0.4) };
        const p1 = { x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: Math.min(p0.y, p2.y) - h * 0.12 };
        comet = { p0, p1, p2, t0: performance.now(), duration: 4200 + Math.random() * 1800, fade: 1 };
    }

    const bezier = (c, t) => ({
        x: (1 - t) * (1 - t) * c.p0.x + 2 * (1 - t) * t * c.p1.x + t * t * c.p2.x,
        y: (1 - t) * (1 - t) * c.p0.y + 2 * (1 - t) * t * c.p1.y + t * t * c.p2.y,
    });

    function draw(now) {
        raf = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!comet) return;
        const t = (now - comet.t0) / comet.duration;
        if (t >= 1) { comet = null; return; }
        // If a page starts to come in, the comet fades rather than crossing the text
        comet.fade = Math.min(comet.fade, clamp01(open * 1.6 - 0.2));
        const alpha = comet.fade * clamp01(t * 6) * clamp01((1 - t) * 6);
        if (alpha <= 0.01 && open < 0.3) { comet = null; return; }

        const head = bezier(comet, t);
        const ahead = bezier(comet, Math.min(t + 0.01, 1));
        const vx = ahead.x - head.x, vy = ahead.y - head.y, vl = Math.hypot(vx, vy) || 1;

        // Away from the Sun (behind the camera, its projection points the other way)
        const sun = world.sunOnScreen();
        let ax = head.x - sun.x * window.innerWidth, ay = head.y - (1 - sun.y) * window.innerHeight;
        if (!sun.ahead) { ax = -ax; ay = -ay; }
        const al = Math.hypot(ax, ay) || 1;
        ax /= al; ay /= al;

        ctx.globalCompositeOperation = 'lighter';
        // Dust tail: broad and pale, curving from anti-sunward back towards the track
        const L = 190;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        const steps = 24;
        const pts = [];
        for (let i = 1; i <= steps; i++) {
            const s = i / steps;
            pts.push({
                x: head.x + ax * L * s - (vx / vl) * L * 0.45 * s * s,
                y: head.y + ay * L * s - (vy / vl) * L * 0.45 * s * s,
                w: 1 + 9 * s,
            });
        }
        pts.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.w, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 226, 190, ${(alpha * 0.07 * (1 - i / steps)).toFixed(3)})`;
            ctx.fill();
        });
        // Ion tail: thin, blue, straight out from the Sun
        const ion = ctx.createLinearGradient(head.x, head.y, head.x + ax * L * 1.5, head.y + ay * L * 1.5);
        ion.addColorStop(0, `rgba(160, 200, 255, ${(alpha * 0.55).toFixed(3)})`);
        ion.addColorStop(1, 'rgba(160, 200, 255, 0)');
        ctx.strokeStyle = ion;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(head.x + ax * L * 1.5, head.y + ay * L * 1.5);
        ctx.stroke();
        // Coma and nucleus
        const coma = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 14);
        coma.addColorStop(0, `rgba(235, 245, 255, ${alpha.toFixed(3)})`);
        coma.addColorStop(0.25, `rgba(190, 220, 255, ${(alpha * 0.5).toFixed(3)})`);
        coma.addColorStop(1, 'rgba(190, 220, 255, 0)');
        ctx.fillStyle = coma;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        raf = requestAnimationFrame(draw);
    }

    function maybeSpawn() {
        const now = performance.now();
        if (!comet && open > 0.85 && now > nextAt && !document.hidden) {
            spawn();
            nextAt = now + 14000 + Math.random() * 14000;
        }
        if (comet && !raf) raf = requestAnimationFrame(draw);
    }
    // Someone resting between pages still sees one now and then
    setInterval(maybeSpawn, 2000);

    return {
        // How open the current stretch is (0 while a page is read, 1 between pages)
        setOpen(k) {
            open = k;
            maybeSpawn();
        },
        spawnNow() { nextAt = 0; maybeSpawn(); },
    };
}
