/**
 * Skills that orbit. Each star in a constellation moves on a small Kepler ellipse about its place
 * on the chart: its period follows Kepler's third law (T ∝ a^1.5, with a its distance from the
 * constellation's centre, so the inner stars go round faster), and along the ellipse it moves
 * as a real orbit does — fastest at pericentre — from Kepler's equation M = E − e·sin E.
 *
 * The orbits are a few pixels across, so the names stay readable; a constellation stops while
 * the pointer is on it (or a star in it has focus), and nothing runs while the chart is off screen
 * or while the page is scrolling (so the scroll always has the whole frame to itself).
 */

// Solve Kepler's equation for the eccentric anomaly E (Newton's method)
function eccentricAnomaly(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 4; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
}

export function createOrbits(chart) {
    let seed = 5;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const groups = [...chart.querySelectorAll('.constellation-chart')].map(el => {
        const stars = [...el.querySelectorAll('.skill-star')];
        const anchors = stars.map(s => [parseFloat(s.style.left), parseFloat(s.style.top)]);
        const cx = anchors.reduce((a, p) => a + p[0], 0) / anchors.length;
        const cy = anchors.reduce((a, p) => a + p[1], 0) / anchors.length;
        const dist = anchors.map(([x, y]) => Math.hypot(x - cx, (y - cy) * 2));
        const dmax = Math.max(...dist, 1);
        const group = {
            el,
            line: el.querySelector('polyline'),
            anchors,
            paused: false,
            stars: stars.map((star, i) => {
                const a = 2 + 3.5 * (dist[i] / dmax);                          // semi-major axis, px
                return {
                    star,
                    a,
                    e: 0.25 + rand() * 0.3,
                    tilt: rand() * Math.PI,
                    period: 9 * Math.pow(a / 5.5, 1.5),                        // seconds (Kepler's third law)
                    phase: rand() * Math.PI * 2,
                    x: 0, y: 0,
                };
            }),
        };
        const pause = v => () => { group.paused = v; };
        el.addEventListener('pointerenter', pause(true));
        el.addEventListener('pointerleave', pause(false));
        el.addEventListener('focusin', pause(true));
        el.addEventListener('focusout', pause(false));
        return group;
    });

    let raf = 0, visible = false, last = 0, scrolledAt = 0;
    window.addEventListener('scroll', () => { scrolledAt = performance.now(); }, { passive: true });
    function frame(now) {
        const dt = Math.min((now - (last || now)) / 1000, 0.1);
        last = now;
        if (now - scrolledAt < 250) {
            raf = visible ? requestAnimationFrame(frame) : 0;
            return;
        }
        groups.forEach(g => {
            if (g.paused) return;
            const w = g.el.clientWidth, h = g.el.clientHeight;
            if (!w || !h) return;   // a constellation hidden on phones
            g.stars.forEach(o => {
                o.phase = (o.phase + (Math.PI * 2 / o.period) * dt) % (Math.PI * 2);   // mean anomaly
                const E = eccentricAnomaly(o.phase, o.e);
                const px = o.a * (Math.cos(E) - o.e), py = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
                const c = Math.cos(o.tilt), s = Math.sin(o.tilt);
                o.x = px * c - py * s;
                o.y = px * s + py * c;
                o.star.style.translate = `${o.x.toFixed(2)}px ${o.y.toFixed(2)}px`;
            });
            g.line?.setAttribute('points', g.stars.map((o, i) =>
                `${(g.anchors[i][0] + (o.x / w) * 100).toFixed(3)},${(g.anchors[i][1] + (o.y / h) * 100).toFixed(3)}`).join(' '));
        });
        raf = visible ? requestAnimationFrame(frame) : 0;
    }

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    }).observe(chart);
}
