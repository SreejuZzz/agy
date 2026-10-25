/**
 * Contact chips on springs. Drag one with the mouse and let go: it springs back on an
 * underdamped spring (Hooke's law with friction), wobbling into place. Throw it hard and it
 * escapes the spring and falls into Sgr A* early: pulled towards the centre of the screen with
 * a force ∝ 1/r², it spirals in, is stretched along its fall, dims with the redshift and is gone
 * at the horizon, sending out a gravitational wave. A moment later it re-forms in its place.
 *
 * Mouse and pen only: on touch screens dragging scrolls the page.
 */

const K = 160;                  // spring stiffness, 1/s²
const DAMP = 2 * Math.sqrt(K) * 0.3;   // underdamped: it wobbles
const ESCAPE = 1600;            // px/s: thrown faster than this, it breaks free
const GM = 1.6e9;               // the hole's pull, px³/s²: strong enough to capture a throw
const HORIZON = 30;             // px

export function createThrowables(chips, { onEaten } = {}) {
    const bodies = chips.map(el => ({ el, x: 0, y: 0, vx: 0, vy: 0, state: 'rest' }));
    let raf = 0, last = 0;

    const apply = b => {
        if (b.state === 'falling') return;
        b.el.style.translate = b.x || b.y ? `${b.x.toFixed(1)}px ${b.y.toFixed(1)}px` : '';
    };

    function frame(now) {
        const elapsed = Math.min((now - (last || now)) / 1000, 0.1);
        last = now;
        // Small fixed sub-steps, so the motion keeps real time even when frames are slow
        const n = Math.max(1, Math.ceil(elapsed / (1 / 240)));
        const dt = elapsed / n;
        let busy = false;
        bodies.forEach(b => {
            if (b.state === 'spring') {
                for (let i = 0; i < n; i++) {
                    const ax = -K * b.x - DAMP * b.vx, ay = -K * b.y - DAMP * b.vy;
                    b.vx += ax * dt; b.vy += ay * dt;
                    b.x += b.vx * dt; b.y += b.vy * dt;
                }
                if (Math.abs(b.x) + Math.abs(b.y) < 0.3 && Math.abs(b.vx) + Math.abs(b.vy) < 5) {
                    b.x = b.y = b.vx = b.vy = 0;
                    b.state = 'rest';
                }
                apply(b);
                busy = true;
            } else if (b.state === 'falling') {
                // Position relative to the hole at the centre of the screen
                const hx = window.innerWidth / 2, hy = window.innerHeight / 2;
                let rx, ry, rn = Infinity;
                for (let i = 0; i < n && rn >= HORIZON; i++) {
                    rx = b.px - hx; ry = b.py - hy;
                    const r = Math.max(Math.hypot(rx, ry), 1);
                    const a = GM / (r * r);
                    b.vx += -a * (rx / r) * dt; b.vy += -a * (ry / r) * dt;
                    // Light can't go faster: cap the speed so a close pass stays on screen
                    const v = Math.hypot(b.vx, b.vy);
                    if (v > 6000) { b.vx *= 6000 / v; b.vy *= 6000 / v; }
                    b.px += b.vx * dt; b.py += b.vy * dt;
                    rn = Math.hypot(b.px - hx, b.py - hy);
                }
                rx = b.px - hx; ry = b.py - hy;
                if (rn < HORIZON || b.fallTime > 4) {
                    b.state = 'gone';
                    b.el.style.opacity = '0';
                    b.el.style.transform = '';
                    onEaten?.(hx, hy);
                    setTimeout(() => reform(b), 1600);
                    return;
                }
                b.fallTime += elapsed;
                // Redshift dims it (g⁴, g = √(1 − r_h / r)); tides stretch it along the fall
                const g = Math.sqrt(Math.max(1 - HORIZON / rn, 0));
                const stretch = 1 + Math.min(240 / rn, 3);
                const angle = Math.atan2(ry, rx);
                b.el.style.translate = `${(b.px - b.homeX).toFixed(1)}px ${(b.py - b.homeY).toFixed(1)}px`;
                b.el.style.transform = `rotate(${angle}rad) scale(${stretch}, ${1 / stretch}) rotate(${-angle}rad)`;
                b.el.style.opacity = String(Math.pow(g, 4));
                busy = true;
            }
        });
        raf = busy ? requestAnimationFrame(frame) : 0;
        if (!busy) last = 0;
    }
    const run = () => { if (!raf) raf = requestAnimationFrame(frame); };

    function reform(b) {
        if (b.state !== 'gone') return;   // already put back (the page fell in meanwhile)
        b.x = b.y = b.vx = b.vy = 0;
        b.state = 'rest';
        b.el.style.translate = '';
        b.el.style.transform = '';
        b.el.style.transition = 'opacity 0.8s var(--ease-out)';
        b.el.style.opacity = '';
        setTimeout(() => { b.el.style.transition = ''; }, 900);
    }

    bodies.forEach(b => {
        let drag = null;
        b.el.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch' || e.button !== 0 || b.state === 'falling' || b.state === 'gone') return;
            drag = { id: e.pointerId, sx: e.clientX - b.x, sy: e.clientY - b.y, ox: e.clientX, oy: e.clientY, moved: false, hist: [] };
        });
        b.el.addEventListener('pointermove', e => {
            if (!drag || e.pointerId !== drag.id) return;
            if (!drag.moved && Math.hypot(e.clientX - drag.ox, e.clientY - drag.oy) < 6) return;
            if (!drag.moved) {
                drag.moved = true;
                b.el.setPointerCapture(e.pointerId);
                b.el.classList.add('is-dragging');
                b.state = 'drag';
            }
            // Keep the last 80 ms of the drag: the throw's velocity is measured over it
            const now = performance.now();
            drag.hist.push({ x: e.clientX, y: e.clientY, t: now });
            while (drag.hist.length > 2 && now - drag.hist[0].t > 80) drag.hist.shift();
            b.x = e.clientX - drag.sx;
            b.y = e.clientY - drag.sy;
            apply(b);
        });
        const release = e => {
            if (!drag || e.pointerId !== drag.id) return;
            const moved = drag.moved;
            const h = drag.hist, first = h[0], lastPt = h[h.length - 1];
            const span = first && lastPt ? (lastPt.t - first.t) / 1000 : 0;
            b.vx = span > 0 ? (lastPt.x - first.x) / span : 0;
            b.vy = span > 0 ? (lastPt.y - first.y) / span : 0;
            drag = null;
            if (!moved) return;
            b.el.classList.remove('is-dragging');
            // A drag is not a click: swallow the click that follows
            b.el.addEventListener('click', ev => { ev.preventDefault(); ev.stopImmediatePropagation(); }, { capture: true, once: true });
            if (Math.hypot(b.vx, b.vy) > ESCAPE) {
                const box = b.el.getBoundingClientRect();
                b.homeX = box.left + box.width / 2 - b.x;
                b.homeY = box.top + box.height / 2 - b.y;
                b.px = box.left + box.width / 2;
                b.py = box.top + box.height / 2;
                b.fallTime = 0;
                b.state = 'falling';
                b.el.style.transition = 'none';   // the chip's own hover transition would lag the fall
            } else {
                b.state = 'spring';
            }
            run();
        };
        b.el.addEventListener('pointerup', release);
        b.el.addEventListener('pointercancel', release);
        // Links and images drag natively; that would fight the spring
        b.el.addEventListener('dragstart', e => e.preventDefault());
    });

    return {
        // Put everything back at once (before the page itself falls into the hole)
        reset() {
            bodies.forEach(b => {
                if (b.state === 'rest') return;
                b.x = b.y = b.vx = b.vy = 0;
                b.state = 'rest';
                b.el.classList.remove('is-dragging');
                b.el.style.translate = '';
                b.el.style.transform = '';
                b.el.style.opacity = '';
                b.el.style.transition = '';
            });
        },
    };
}
