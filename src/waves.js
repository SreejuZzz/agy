/**
 * Gravitational waves. A wave carries a strain h: space stretches by ½h along one axis while it
 * squeezes by ½h along the other, then the other way round, at the wave's frequency.
 *
 * - In the Galaxy the waves are drawn by the final pass (a ring expanding from the source,
 *   see gravitationalWaves() in galaxy-world.js).
 * - The page feels them too (from a click or the merger): while the wave passes, the page on
 *   screen is scaled by (1 + h, 1 − h) — on its own compositor layer, so nothing is repainted.
 * - emit(): a short burst, damped like a ringing bell (a click, arriving at a chapter).
 * - merger(): two black holes spiralling together — a chirp whose frequency and strain rise to
 *   the merger, then ring down.
 */

const TAU = Math.PI * 2;

export function createWaves({ world, reducedMotion }) {
    const contents = [...document.querySelectorAll('.world-section > .content')];
    const bursts = [];
    let raf = 0;
    let strained = [];   // the page content on screen when the wave arrived

    function strainAt(b, t) {
        if (b.chirp) {
            // Inspiral: f and h grow as the orbit shrinks (f ∝ (t_c − t)^(−3/8)); then ringdown
            const tc = 1.1;
            if (t < tc) {
                const left = Math.max(tc - t, 0.02);
                const phase = -TAU * 1.6 * (8 / 5) * Math.pow(left, 5 / 8) / Math.pow(tc, -3 / 8);
                return b.amp * Math.pow(left / tc, -1 / 4) * 0.35 * Math.sin(phase);
            }
            const r = t - tc;
            return b.amp * Math.exp(-r / 0.35) * Math.sin(TAU * 7 * r);
        }
        return b.amp * Math.exp(-t / 0.45) * Math.sin(TAU * 3.2 * t);
    }

    function tick(now) {
        let h = 0;
        for (let i = bursts.length - 1; i >= 0; i--) {
            const t = (now - bursts[i].start) / 1000;
            if (t > bursts[i].length) { bursts.splice(i, 1); continue; }
            h += strainAt(bursts[i], t);
        }
        h = Math.max(-0.03, Math.min(0.03, h));
        if (bursts.length) {
            const scale = `${(1 + h / 2).toFixed(5)} ${(1 - h / 2).toFixed(5)}`;
            strained.forEach(el => { el.style.scale = scale; });
            raf = requestAnimationFrame(tick);
        } else {
            strained.forEach(el => { el.style.scale = ''; el.style.willChange = ''; });
            strained = [];
            raf = 0;
        }
    }

    function start(burst) {
        if (reducedMotion) return;
        if (!strained.length) {
            strained = contents.filter(el => {
                const box = el.getBoundingClientRect();
                return box.bottom > 0 && box.top < window.innerHeight;
            });
            strained.forEach(el => { el.style.willChange = 'transform'; });
        }
        bursts.push({ ...burst, start: performance.now() });
        if (!raf) raf = requestAnimationFrame(tick);
    }

    return {
        // x, y in CSS pixels; strength 0 → 1. page: whether the page itself feels it
        emit(x, y, strength = 1, { page = true } = {}) {
            world?.addRipple(x, y, 0.12 * strength);
            if (page) start({ amp: 0.006 * strength, length: 2.2 });
        },
        merger(x, y) {
            world?.addRipple(x, y, 0.2);
            setTimeout(() => world?.addRipple(x, y, 0.35), 1100);   // the merger itself
            start({ amp: 0.02, length: 2.6, chirp: true });
        },
    };
}
