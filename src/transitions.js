/**
 * Scroll choreography.
 *
 * - Inertial scrolling (Lenis): the scroll velocity decays exponentially, like friction;
 *   synced with GSAP ScrollTrigger
 * - Hero → galaxy: the hero dissolves to black and the galaxy fades up out of it; in the
 *   header the theme switch fades out with the scroll and the distance readout fades in
 * - Every element on every page arrives with the same spring-driven fade-and-rise as
 *   it enters the viewport (and reverses if you scroll back above it); pages fade out
 *   into the open stretch the same way. Timed rather than scrubbed, so the motion
 *   is smooth whatever the scroll speed. Scroll-linked fades are linear in scroll.
 * - Scroll position → continuous station coordinate for the 3D camera.
 *   Each page is preceded by an open stretch of scroll (see .world-section margin):
 *   the camera leaves as the previous page fades out, arrives early in the open
 *   stretch, and stays parked through the page.
 *   While a page is on screen the scene behind it is dimmed for readability; in the
 *   open stretches a chapter title names the place.
 * - Finale: past the last page, its components and the header fall into Sgr A* under
 *   gravity (see gravity.js) while the camera falls in after them; scrolling back up
 *   rebuilds the page. The distance readout stays to the end.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { MOTION, spring } from './motion.js';
import { createGravity } from './gravity.js';

gsap.registerPlugin(ScrollTrigger);

const clamp01 = v => Math.min(Math.max(v, 0), 1);
const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export function initTransitions({ world, particles, reducedMotion, onStation, onReveal, onOpenStretch, onNavigate, holdReveal, onFinaleStart }) {
    const hero = document.getElementById('home');
    const header = document.getElementById('main-header');
    const sections = [...document.querySelectorAll('.world-section')];
    const lastSection = sections[sections.length - 1];
    let finaleProgress = 0;

    // ── Smooth scrolling ──
    let lenis = null;
    if (!reducedMotion) {
        lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(time => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
    }

    // In-page links: through onNavigate when there is one (warp.js: a warp, a smooth scroll to a
    // neighbour, or with reduced motion an instant jump), otherwise a smooth scroll
    if (onNavigate || lenis) {
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                const target = document.querySelector(a.getAttribute('href'));
                if (!target) return;
                e.preventDefault();
                if (onNavigate) onNavigate(target);
                else lenis.scrollTo(target, { duration: 2, easing: spring });
            });
        });
    }

    // ── Hero → world ──
    gsap.set('#world', { autoAlpha: 0 });
    const lift = reducedMotion ? 0 : -40;

    gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: reducedMotion ? true : 0.8,
            // The opening shot, in one take: the ring collapses into a point of light at the centre
            // of the screen; that point is the Milky Way, seen from 1.5 Mpc away, and the camera
            // flies in until it fills the view (then on to the Sun, below)
            onUpdate: self => {
                const p = self.progress;
                header.classList.toggle('is-world', p > 0.5);
                if (world) {
                    world.setIntro(smoothstep(0.36, 0.6, p));
                    world.setApproach(reducedMotion ? 1 : smoothstep(0.4, 0.92, p));
                    world.setActive(p > 0.3);
                }
                if (particles) {
                    particles.setCollapse(reducedMotion ? 0 : smoothstep(0.02, 0.48, p));
                    particles.setPaused(p > 0.98);
                }
            },
        },
    })
        // The hero's words lift away as the ring falls in; the collapsed point hands over to the Galaxy
        .to('#home .content', { y: lift, autoAlpha: 0, duration: 0.4 }, 0)
        .to('.particles-bg', { autoAlpha: 0, duration: reducedMotion ? 0.5 : 0.14 }, reducedMotion ? 0.05 : 0.44)
        .to('#world', { autoAlpha: 1, duration: reducedMotion ? 0.3 : 0.12 }, reducedMotion ? 0.35 : 0.38)
        .to('#theme-toggle', { autoAlpha: 0, duration: 0.45 }, 0)
        .fromTo('.readout', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.6);

    // ── World pages ──
    const rise = reducedMotion ? 0 : MOTION.rise;
    const items = sections.flatMap(section => [...section.querySelectorAll(
        '.section-head, .card, .stats, .contact-primary, .channels, .approach .subsection-title, ' +
        '.flight, .flight-detail, .sky-tabs, .sky-chart, .case-tabs, .case-studies, .oss'
    )].filter(el => !el.parentElement.closest('.card'))); // panels inside panels move with their parent

    // Content waits for the camera to come (nearly) to rest at its station, so the move and the
    // reveal read as one shot — but never more than 0.7 s
    // (While a warp is under way, it waits however long the flight takes: holdReveal)
    const afterCamera = fn => {
        if (!world || reducedMotion) return fn();
        const t0 = performance.now();
        const check = () => {
            if (holdReveal?.() || (!world.settled && performance.now() - t0 < 700)) return;
            gsap.ticker.remove(check);
            fn();
        };
        gsap.ticker.add(check);
    };
    let revealCount = 0;

    gsap.set(items, { autoAlpha: 0, y: rise });
    ScrollTrigger.batch(items, {
        start: 'top 80%',
        onEnter: batch => {
            const id = String(++revealCount);
            batch.forEach(el => { el.dataset.revealId = id; });
            afterCamera(() => {
                const still = batch.filter(el => el.dataset.revealId === id);   // not scrolled back out meanwhile
                if (!still.length) return;
                gsap.to(still, {
                    autoAlpha: 1, y: 0, duration: MOTION.enter, ease: MOTION.ease,
                    stagger: MOTION.stagger, overwrite: true,
                });
                still.forEach(onReveal);
            });
        },
        onLeaveBack: batch => {
            batch.forEach(el => { el.dataset.revealId = 'out'; });
            gsap.to(batch, { autoAlpha: 0, y: rise, duration: MOTION.exit, ease: MOTION.ease, overwrite: true });
        },
    });

    // Each page (except the last) fades out as it leaves into the open stretch
    sections.slice(0, -1).forEach(section => {
        const inner = section.querySelector('.content');
        ScrollTrigger.create({
            trigger: section,
            start: 'bottom 40%',
            onEnter: () => gsap.to(inner, { autoAlpha: 0, y: -rise, duration: MOTION.exit, ease: MOTION.ease, overwrite: true }),
            onLeaveBack: () => gsap.to(inner, { autoAlpha: 1, y: 0, duration: MOTION.enter, ease: MOTION.ease, overwrite: true }),
        });
    });

    // ── Finale: the page falls into Sgr A*, and the camera after it ──
    const lastInner = lastSection.querySelector('.content');
    let lastShown = false;
    const gravity = reducedMotion ? null : createGravity({
        texts: () => [
            ...lastSection.querySelectorAll('.eyebrow, .galactic-position span, .section-title .reveal-word, .section-subtitle, .contact-address, .contact-action, .social-link, .form-group label, .btn-text, .terminal-line'),
            header.querySelector('.brand'),
            ...header.querySelectorAll('.site-nav a'),
        ],
        shells: () => [
            ...lastSection.querySelectorAll('.social-link, .form-group, .submit-btn, .contact-terminal'),
            ...header.querySelectorAll('.site-nav li'),
        ],
        onRender: (p, falling) => {
            // Once the shredding begins, nothing clips the fragments, and the header's
            // underline and progress line go with it
            lastSection.classList.toggle('is-shredding', falling);
            header.classList.toggle('is-falling', falling);
        },
    });

    ScrollTrigger.create({
        trigger: lastSection,
        start: 'bottom bottom',
        end: '+=190%',
        pin: true,
        invalidateOnRefresh: true,
        onRefresh: () => gravity?.reset(),
        onLeaveBack: () => gravity?.update(0),   // even a fast fling back up rebuilds the page
        onUpdate: self => {
            const p = self.progress;
            finaleProgress = p;
            // Whatever of the last page hasn't faded in yet (a fast scroll to the end) is shown at
            // once, so the black hole has all of it to take: it measures the page as the fall begins
            if (p > 0 && !lastShown) {
                lastShown = true;
                const pending = items.filter(el => lastSection.contains(el));
                pending.forEach(el => { el.dataset.revealId = 'finale'; });   // a queued reveal won't rerun
                gsap.killTweensOf(pending);
                gsap.set(pending, { autoAlpha: 1, y: 0 });
                onFinaleStart?.();
            } else if (p === 0) {
                lastShown = false;
            }
            if (world) world.setFinale(p);
            // The fall has a short dead zone first (gravity's start), so reaching the send button never starts it
            if (gravity) gravity.update(p);
            else gsap.set(lastInner, { autoAlpha: 1 - smoothstep(0.15, 0.4, p) });
            gsap.set('.header-end', { autoAlpha: 1 - smoothstep(0.9, 0.97, p) });
        },
    });

    // ── Closing: "Event horizon — Nothing escapes from here.", held for a beat, then
    // "Event horizon" fades into the name ──
    const closing = gsap.timeline({ paused: true })
        .fromTo('.finale-stage > *', { autoAlpha: 0, y: rise }, {
            autoAlpha: 1, y: 0, duration: MOTION.enter, ease: MOTION.ease, stagger: MOTION.stagger,
        })
        .to('.finale-horizon', { autoAlpha: 0, y: -rise, duration: 1.0, ease: MOTION.ease }, '+=1.0')
        .fromTo('.finale-name', { autoAlpha: 0, y: rise }, { autoAlpha: 1, y: 0, duration: 1.2, ease: MOTION.ease }, '<0.3');
    ScrollTrigger.create({
        trigger: '#event-horizon',
        start: 'top 60%',
        onEnter: () => closing.timeScale(1).play(),
        onLeaveBack: () => closing.timeScale(3).reverse(),
    });

    // ── Scroll → camera station coordinate ──
    let anchors = [];
    let vh = window.innerHeight;
    // Document position of a section; a pinned section is measured by its spacer
    const top = el => {
        const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
        return box.getBoundingClientRect().top + window.scrollY;
    };
    const measure = () => {
        vh = window.innerHeight;
        anchors = sections.map((s, i) => {
            // Bottom of whatever came before: the hero, or the previous page
            const prev = sections[i - 1] || hero;
            const prevBottom = top(prev) + prev.offsetHeight;
            const sTop = top(s);
            const gap = sTop - prevBottom;   // the open stretch (the page's margin-top)
            // The first station is reached early enough for its detailed render to finish
            // before the page arrives; later stations are reached early in their stretch.
            // The chapter title has gone by the time the page's heading is revealed (at 80% of the
            // viewport, see the batch above): the heading sits ~150 px into its section
            const arrive = i === 0 ? prevBottom + gap * 0.27 : prevBottom + Math.min(vh * 0.15, gap * 0.2);
            const depart = sTop + s.offsetHeight - vh * 0.5;
            const openFrom = prevBottom - vh * 0.05;
            const openTo = Math.max(sTop - vh * 0.68, openFrom + vh * 0.3);
            return { start: arrive, end: Math.max(arrive, depart), openFrom, openTo };
        });
    };

    // 1 while no page content is on screen (the open stretches), fading at the edges;
    // also reports which stretch, i.e. which page is coming next
    const overlayFromScroll = y => {
        const fade = vh * 0.12;
        let best = { k: 0, index: -1 };
        anchors.forEach((a, index) => {
            const k = smoothstep(a.openFrom, a.openFrom + fade, y) * (1 - smoothstep(a.openTo - fade, a.openTo, y));
            if (k > best.k) best = { k, index };
        });
        return best;
    };

    const stationFromScroll = y => {
        if (!anchors.length) return 0;
        // Over the hero the camera holds on the whole Galaxy (the opening shot flies in to it),
        // then dives to the first station, the Sun
        if (y <= anchors[0].start) {
            const hold = reducedMotion ? 0 : hero.offsetHeight * 0.92;
            return easeInOutSine(clamp01((y - hold) / Math.max(anchors[0].start - hold, 1)));
        }
        for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i];
            if (y <= a.end) return i + 1;                       // parked on page i
            const next = anchors[i + 1];
            if (!next) return i + 1;
            if (y < next.start) {                              // gliding to the next page
                return i + 1 + easeInOutSine((y - a.end) / (next.start - a.end));
            }
        }
        return anchors.length;
    };

    const update = () => {
        const u = stationFromScroll(window.scrollY);
        if (world) world.setStation(u);
        const open = overlayFromScroll(window.scrollY);
        onOpenStretch(open.k, open.index, finaleProgress);
        onStation(u);
    };

    ScrollTrigger.addEventListener('refresh', () => { measure(); update(); });
    window.addEventListener('scroll', update, { passive: true });
    measure();
    update();

    return { lenis };
}
