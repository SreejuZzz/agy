/**
 * Warp navigation. Jumping to a chapter more than one away doesn't scroll through everything in
 * between: the page fades, the camera accelerates hard towards half the speed of light — the view
 * bends forward and the scene smears along the line of travel, like a fast dolly on film —
 * crosses the Galaxy, and settles softly into the new chapter, whose page then arrives as usual.
 * Neighbouring chapters are a smooth scroll.
 *
 * The scroll itself jumps in one step while the page is hidden; the camera's flight is the
 * camera's own spring (quickened during the warp), so it takes the real path between stations.
 */

import gsap from 'gsap';
import { spring } from './motion.js';

export function createWarp({ world, reducedMotion, getLenis, order, getIndex }) {
    const root = document.documentElement;
    const state = { k: 0 };
    let warping = false;

    const jump = el => {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(el, { immediate: true, force: true });
        else el.scrollIntoView();
    };
    const glide = el => {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(el, { duration: 1.4, easing: spring });
        else el.scrollIntoView();
    };

    function go(target) {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el || warping) return;
        const to = order.indexOf(el.id), from = getIndex();
        if (reducedMotion || !world || to < 0) return jump(el);
        if (Math.abs(to - from) < 2) return glide(el);

        warping = true;
        const dir = to > from ? 1 : -1;
        root.classList.add('is-warping');
        const setWarp = () => world.setWarp(state.k, dir);
        // Spool up
        gsap.to(state, { k: 1, duration: 0.45, ease: 'power3.in', overwrite: true, onUpdate: setWarp });
        // With the page faded, jump; the camera then crosses the Galaxy on its own
        setTimeout(() => {
            jump(el);
            const t0 = performance.now();
            const arrive = () => {
                const t = performance.now() - t0;
                // Brake once the camera is nearly there (or, whatever happens, after 4 s)
                if (t < 450 || (world.remaining > 0.35 && t < 4000)) return;
                gsap.ticker.remove(arrive);
                gsap.to(state, {
                    k: 0, duration: 1.1, ease: 'power3.out', overwrite: true, onUpdate: setWarp,
                    onComplete: () => {
                        warping = false;
                        root.classList.remove('is-warping');
                    },
                });
            };
            gsap.ticker.add(arrive);
        }, 300);
    }

    return { go, isWarping: () => warping };
}
