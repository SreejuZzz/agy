/**
 * Gravity: in the finale Sgr A* (at the centre of the screen) tears the page apart and eats it,
 * the way a black hole eats a star or a planet — a tidal disruption.
 *
 * - Shredding: text is split into characters. The side nearest the hole feels the strongest
 *   pull, so characters peel away nearest-first and stream in one after another; a box (a chip,
 *   a field, the button, the terminal) is stripped of its letters first, then its empty shell
 *   follows.
 * - Each fragment falls freely from rest (the Newtonian cycloid): r = r₀·(1 + cos η)/2 with time
 *   t ∝ η + sin η, so it starts slowly and accelerates; free-fall time ∝ r₀^1.5.
 * - A little angular momentum: its angle advances faster as it falls, so it spirals in, and it
 *   stays tidally locked, turning to keep facing the hole.
 * - Tides stretch it along the line to the hole and squeeze it across (spaghettification),
 *   keeping its area, more and more as it nears the horizon (tidal force ∝ 1/r³).
 * - Gravitational redshift dims it: brightness ∝ g⁴ with g = √(1 − r_h/r), zero at the horizon.
 *
 * The fragments don't jump with the scroll: they follow it on a slow critically damped spring
 * (the same physics as the camera), so the shredding is smooth and unhurried however the page
 * is scrolled. Scrolling back reassembles the page and restores the original text.
 */

import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

const clamp01 = v => Math.min(Math.max(v, 0), 1);

// Solve η + sin η = π·s for η ∈ [0, π] (fraction s of the free-fall time elapsed)
function freeFallAngle(s) {
    const target = Math.PI * s;
    let eta = target;
    for (let i = 0; i < 6; i++) {
        const slope = 1 + Math.cos(eta);
        if (slope < 1e-6) break;
        eta = Math.min(Math.max(eta - (eta + Math.sin(eta) - target) / slope, 0), Math.PI);
    }
    return eta;
}

const isVisible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/**
 * texts(): elements whose text is shredded into characters
 * shells(): boxes that fall as a whole once their own characters have gone
 * start: finale progress at which the shredding begins; peel: progress over which it spreads
 */
export function createGravity({ texts, shells, start = 0.06, peel = 0.28, onRender }) {
    let bodies = null;
    let splits = [];

    // Shred the text and work out, for every fragment, where it is and when it lets go
    const measure = () => {
        // Words keep their layout (flex gaps fall between words, not letters); letters are the fragments
        splits = texts().filter(isVisible).map(el => SplitText.create(el, { type: 'words,chars' }));
        const chars = splits.flatMap(s => s.chars).filter(c => c.textContent.trim());
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const place = (el, isShell) => {
            const box = el.getBoundingClientRect();
            const x = box.left + box.width / 2 - cx, y = box.top + box.height / 2 - cy;
            return { el, isShell, x, y, r0: Math.max(Math.hypot(x, y), 1), phi0: Math.atan2(y, x), lastS: -1 };
        };
        const list = [...chars.map(c => place(c, false)), ...shells().filter(isVisible).map(s => place(s, true))];
        const rMin = Math.min(...list.map(b => b.r0)), rMax = Math.max(...list.map(b => b.r0), rMin + 1);
        for (const b of list) {
            b.duration = 0.05 + 0.12 * (b.r0 / rMax) ** 1.5;                 // free-fall time ∝ r₀^1.5
            b.release = start + peel * (b.r0 - rMin) / (rMax - rMin);       // nearest lets go first
        }
        // A shell goes only after its last character has gone (so they never move together)
        for (const shell of list.filter(b => b.isShell)) {
            for (const c of list) {
                if (!c.isShell && shell.el.contains(c.el)) shell.release = Math.max(shell.release, c.release + c.duration + 0.01);
            }
        }
        return list;
    };

    const clear = () => {
        if (!bodies) return;
        bodies.forEach(({ el }) => {
            el.style.transform = '';
            el.style.opacity = '';
        });
        splits.forEach(s => s.revert());   // the original text, exactly as it was
        splits = [];
        bodies = null;
    };

    // Draw the shredding at progress p
    const render = p => {
        onRender?.(p, p > start);
        if (p <= start) {
            clear();
            return;
        }
        if (!bodies) bodies = measure();
        const horizon = 0.045 * Math.min(window.innerWidth, window.innerHeight);
        for (const b of bodies) {
            const s = clamp01((p - b.release) / b.duration);
            if (s === b.lastS) continue;     // untouched or already gone: nothing to redraw
            b.lastS = s;
            if (s === 0) {
                b.el.style.transform = '';
                b.el.style.opacity = '';
                continue;
            }
            const r = Math.max(b.r0 * (1 + Math.cos(freeFallAngle(s))) / 2, 0.5);
            const phi = b.phi0 + 0.6 * (Math.sqrt(b.r0 / Math.max(r, horizon * 0.5)) - 1);
            // Tidal stretch: grows from 1 as the fragment falls, about 5× at three horizon radii
            const tide = Math.min(Math.max(3 * horizon / r - 3 * horizon / b.r0, 0), 1.5);
            const stretch = 1 + 4 * tide * tide;
            const shrink = (r / b.r0) ** 0.35;
            const g2 = Math.max(0, 1 - horizon / r);
            const dx = r * Math.cos(phi) - b.x, dy = r * Math.sin(phi) - b.y;
            b.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${phi.toFixed(4)}rad) `
                + `scale(${(stretch * shrink).toFixed(4)}, ${(shrink / Math.sqrt(stretch)).toFixed(4)}) rotate(${(-b.phi0).toFixed(4)}rad)`;
            b.el.style.opacity = (g2 * g2).toFixed(3);
        }
    };

    // Smoothed progress: a critically damped spring (ω = 2.2 /s, settles in about two seconds)
    // chasing the scroll, solved exactly each frame
    const OMEGA = 2.2;
    let target = 0, shown = 0, velocity = 0, running = false;
    const tick = (time, deltaMs) => {
        const dt = Math.min(deltaMs / 1000, 0.1);
        const d = shown - target, e = Math.exp(-OMEGA * dt), c = velocity + OMEGA * d;
        shown = target + (d + c * dt) * e;
        velocity = (velocity - OMEGA * c * dt) * e;
        if (Math.abs(shown - target) < 1e-4 && Math.abs(velocity) < 1e-4) {
            shown = target;
            velocity = 0;
            gsap.ticker.remove(tick);
            running = false;
        }
        render(shown);
    };

    const update = p => {
        target = p;
        if (!running) {
            running = true;
            gsap.ticker.add(tick);
        }
    };

    // Immediately back to the untouched page (after a resize, everything is measured afresh)
    const reset = () => {
        gsap.ticker.remove(tick);
        running = false;
        target = shown = velocity = 0;
        render(0);
    };

    return { update, reset };
}
