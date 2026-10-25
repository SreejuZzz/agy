import './styles/main.css';
import { AntigravityParticles } from './antigravity-particles.js';
import { GalaxyWorld, RS_KPC } from './galaxy-world.js';
import { initTransitions } from './transitions.js';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { MOTION, spring } from './motion.js';
import { createMinimap } from './minimap.js';
import { createAmbient } from './ambient.js';
import { createTerminal } from './terminal.js';
import { createWaves } from './waves.js';
import { createOrbits } from './orbits.js';
import { createThrowables } from './throw.js';
import { createComets } from './comet.js';

// Reveal the document once main JS and styles have loaded
document.documentElement.style.visibility = 'visible';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.innerWidth <= 768;

// ─── Headings: each word slides up from behind a mask, one after another ───
function splitWords(el) {
    if (el.dataset.split) return [...el.querySelectorAll('.reveal-word')];
    el.dataset.split = 'true';
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    el.setAttribute('aria-label', words.join(' '));
    return words.map((word, i) => {
        const mask = document.createElement('span');
        mask.className = 'reveal-mask';
        mask.setAttribute('aria-hidden', 'true');
        const span = document.createElement('span');
        span.className = 'reveal-word';
        span.textContent = word;
        mask.appendChild(span);
        el.appendChild(mask);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        return span;
    });
}

function revealHeading(el) {
    const words = splitWords(el);
    if (reducedMotion) return;
    gsap.fromTo(words,
        { yPercent: 110 },
        { yPercent: 0, duration: MOTION.enter, ease: MOTION.ease, stagger: 0.04, overwrite: true });
}

// ─── Body text: each line slides up from behind its own mask, like the headings ───
gsap.registerPlugin(SplitText);
// (not the last page's subtitle: the black hole shreds that one into characters instead)
const LINE_TEXT = '.section-subtitle:not(#portal-contact *), .card--plain .card-text';
const lineSplits = new Map();
if (!reducedMotion) {
    document.querySelectorAll(LINE_TEXT).forEach(el => {
        // autoSplit re-splits when fonts load or the width changes
        lineSplits.set(el, SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true }));
    });
}

function revealLines(el) {
    const split = lineSplits.get(el);
    if (!split) return;
    gsap.fromTo(split.lines,
        { yPercent: 105 },
        { yPercent: 0, duration: MOTION.enter, ease: MOTION.ease, stagger: MOTION.stagger, overwrite: true });
}

// ─── Hero: original particle ring ───
const particlesContainer = document.querySelector('.particles-bg');
let particles = null;
if (particlesContainer) {
    // WebGL may be unavailable (old GPU, disabled in browser) — don't let that break the rest of the page
    try {
        particles = new AntigravityParticles(particlesContainer, {
            density:          isMobile ? 65 : 246,    // Optimized for mobile WebGL performance
            particlesScale:   isMobile ? 1.5 : 0.75,   // scaled up for crisp visibility on mobile
            cameraZoom:       isMobile ? 3.5 : 3.1,    // zoom out slightly on mobile so the ring fits perfectly on the screen
            ringWidth:        isMobile ? 0.20 : 0.15,  // wider ring on mobile to stand out
            ringWidth2:       isMobile ? 0.08 : 0.05,
            ringDisplacement: isMobile ? 0.20 : 0.15,
            interactive:      true,   // ring follows mouse cursor / touch
        });
    } catch {
        particlesContainer.remove();
    }
}

// ─── The Milky Way (everything after the hero) ───
const worldCanvas = document.getElementById('world-canvas');
let world = null;
if (worldCanvas) {
    try {
        world = new GalaxyWorld(worldCanvas, { mobile: isMobile, reducedMotion });
    } catch {
        world = null; // the plain dark backdrop still shows
    }
}

// ─── Physics on the page: waves, the pointer's lens, comets ───
const waves = createWaves({ world, reducedMotion });
const comets = world && !reducedMotion ? createComets({ world, container: document.getElementById('world') }) : null;
let throwables = null;   // the contact chips (set up below, once the page is built)

// The pointer is a small mass: it lenses the Galaxy behind it (pointers that hover only)
if (world && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') world.setCursor(e.clientX, e.clientY); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => world.setCursor(null));
    window.addEventListener('blur', () => world.setCursor(null));
}

// ─── Header: active chapter, gliding underline, scroll progress ───
const header = document.getElementById('main-header');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
const indicator = document.querySelector('.nav-indicator');
const sectionIds = ['home', ...[...document.querySelectorAll('.world-section')].map(s => s.id)];
let activeIndex = -1;

// Smooth scrolling (set once the scroll choreography starts, at the end of this file)
let lenis = null;
function scrollToSection(selector) {
    const target = document.querySelector(selector);
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { duration: 2, easing: spring });
    else target.scrollIntoView();
}

// The underline moves to the active chapter on the shared spring (and hides on the hero)
function placeIndicator(immediate = false) {
    if (!indicator) return;
    const link = [...navAnchors].find(a => a.classList.contains('active'));
    const target = link ? { x: link.offsetLeft, width: link.offsetWidth, opacity: 1 } : { opacity: 0 };
    gsap.to(indicator, { ...target, duration: immediate ? 0 : MOTION.update, ease: MOTION.ease, overwrite: true });
}
window.addEventListener('resize', () => placeIndicator(true), { passive: true });

function onStation(u) {
    const index = Math.min(Math.round(u), sectionIds.length - 1);
    if (index !== activeIndex) {
        activeIndex = index;
        navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${sectionIds[index]}`));
        placeIndicator();
        minimap?.setActive(index - 1);
    }
    inWorld = u > 0.5;
    updateMinimap();
    const progress = (maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0).toFixed(3);
    if (header && progress !== lastProgress) {
        lastProgress = progress;
        header.style.setProperty('--progress', progress);
    }
}

// Scroll length is measured only when the page changes size, never during scrolling
let lastProgress = '';
let maxScroll = 0;
const measureScroll = () => { maxScroll = document.documentElement.scrollHeight - window.innerHeight; };
measureScroll();
new ResizeObserver(measureScroll).observe(document.body);

// ─── Chapters: in each open stretch, the place the camera has arrived at ───
const CHAPTERS = [
    { name: 'Orion Spur', data: 'The Sun · 8.18 kpc from the Galactic centre · 20.8 pc above the plane' },
    { name: 'Above the disk', data: '7.0 kpc north of the Galactic plane · the Sun’s side of the disk below' },
    { name: 'Scutum–Centaurus Arm', data: 'One of the Galaxy’s two major arms · ≈ 6 kpc from the centre' },
    { name: 'The Galactic bar', data: 'Inclined 27° to the Sun–centre line · half-length ≈ 5 kpc' },
    { name: 'The bulge', data: 'Mostly stars older than 8 billion years · seen from 7.5 kpc' },
    { name: 'Sagittarius A*', data: '4.3 million solar masses · 26,700 light-years from the Sun' },
];
const worldEl = document.getElementById('world');
let lastDim = '';
const chapter = document.getElementById('chapter');
const chapterIndex = document.getElementById('chapter-index');
const chapterName = document.getElementById('chapter-name');
const chapterData = document.getElementById('chapter-data');
let chapterShown = -1;
let lastShown = '';

// ─── Mini-map: wide screens keep it in the margin; narrower ones show it between pages ───
const wideMargin = window.matchMedia('(min-width: 1600px)');
let inWorld = false, openK = 0, finaleK = 0;
const minimap = world ? createMinimap({ chapters: CHAPTERS, sectionIds: sectionIds.slice(1), onSelect: scrollToSection }) : null;
function updateMinimap() {
    minimap?.setVisible(inWorld && finaleK < 0.02 && (wideMargin.matches || openK > 0.5));
}

function onOpenStretch(k, index, finale) {
    openK = k;
    finaleK = finale;
    ambient.update({ finale });
    // Physics is quiet over a page being read and full strength between pages
    world?.setLensStrength(0.35 + 0.65 * k);
    comets?.setOpen(finale > 0 ? 0 : k);
    if (finale > 0.055) throwables?.reset();   // just before the page itself starts to fall (gravity starts at 0.06)
    // Dim the scene behind a page while it is read; full brightness between pages and in the finale
    // Set on #world itself (its ::after uses it), so only that element restyles
    const dim = (1 - Math.max(k, finale)).toFixed(3);
    if (worldEl && dim !== lastDim) {
        lastDim = dim;
        worldEl.style.setProperty('--world-dim', dim);
    }
    if (!chapter) return;
    if (index >= 0 && index !== chapterShown && CHAPTERS[index]) {
        // Arriving at a new place: a gentle gravitational wave from the middle of the screen
        if (chapterShown !== -1 && k > 0.3) waves.emit(window.innerWidth / 2, window.innerHeight / 2, 0.7, { page: false });
        chapterShown = index;
        chapterIndex.textContent = `${String(index + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`;
        chapterName.textContent = CHAPTERS[index].name;
        chapterData.textContent = CHAPTERS[index].data;
    }
    const shown = (index >= 0 ? k : 0).toFixed(3);
    if (shown === lastShown) return;
    lastShown = shown;
    chapter.style.opacity = shown;
    chapter.style.transform = `translate3d(0, ${((1 - shown) * 12).toFixed(1)}px, 0)`;
}

// ─── Menu (phones): a full-screen sheet of chapters ───
const menuButton = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');

if (menuButton && navLinks) {
    const setMenu = open => {
        navLinks.classList.toggle('active', open);
        header.classList.toggle('menu-open', open);
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        document.body.style.overflow = open ? 'hidden' : '';
    };
    menuButton.addEventListener('click', () => setMenu(!navLinks.classList.contains('active')));
    [...navLinks.querySelectorAll('a'), header.querySelector('.brand')].forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && navLinks.classList.contains('active')) setMenu(false);
    });
}

// ─── Readout: the camera's real distance to Sgr A*, in the unit that suits it, and the time ───
const readout = document.getElementById('readout-value');
const readoutExtra = document.getElementById('readout-extra');
const AU_PER_KPC = 2.0626e8;
function formatDistance(kpc) {
    if (kpc >= 1) return `${kpc.toFixed(2)} kpc`;
    if (kpc >= 0.001) return `${(kpc * 1000).toFixed(kpc >= 0.01 ? 0 : 1)} pc`;
    if (kpc >= 50 * RS_KPC) {
        const au = kpc * AU_PER_KPC;
        return `${au >= 100 ? Math.round(au).toLocaleString('en') : au.toFixed(1)} AU`;
    }
    return `${(kpc / RS_KPC).toFixed(1)} rs`;
}
// Time since "now" (at the Sun), or near Sgr A* how fast a clock held still there runs
function formatExtra(myr, clock) {
    if (clock !== null) return `clock ×${clock < 0.995 ? clock.toFixed(2) : clock.toFixed(4)}`;
    if (Math.abs(myr) < 0.5) return 'now';
    return `t ${myr > 0 ? '+' : '−'}${Math.abs(myr).toFixed(0)} million years`;
}
const ambient = createAmbient();
if (world && readout) {
    let shown = '', shownExtra = '';
    world.onReadout = ({ x, z, kpc, myr, clock }) => {
        const text = formatDistance(kpc), extra = formatExtra(myr, clock);
        if (text !== shown) readout.textContent = shown = text;
        if (readoutExtra && extra !== shownExtra) readoutExtra.textContent = shownExtra = extra;
        minimap?.setPosition(x, z);
        ambient.update({ kpc });
    };
}

// ─── Sound: off until asked for ───
const soundBtn = document.getElementById('sound-toggle');
const syncSound = () => {
    soundBtn.setAttribute('aria-pressed', String(ambient.on));
    soundBtn.setAttribute('aria-label', ambient.on ? 'Mute ambient sound' : 'Play ambient sound');
};
if (soundBtn && window.AudioContext) {
    soundBtn.addEventListener('click', () => { ambient.setOn(!ambient.on); syncSound(); });
} else {
    soundBtn?.remove();
}

// ─── Instrument panels: a soft light follows the cursor ───
if (window.matchMedia('(hover: hover)').matches) {
    let lit = null;
    document.addEventListener('pointermove', e => {
        const panel = e.target.closest?.('.card:not(.card--plain)');
        if (lit && lit !== panel) {
            lit.style.removeProperty('--mx');
            lit.style.removeProperty('--my');
        }
        lit = panel;
        if (!panel) return;
        const box = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', `${e.clientX - box.left}px`);
        panel.style.setProperty('--my', `${e.clientY - box.top}px`);
    }, { passive: true });
}

// ─── Theme Toggle with Circular Clip-Path Transition (hero) ───
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', (event) => {
        const isDark = !document.body.classList.contains('light-mode');
        const nextTheme = isDark ? 'light' : 'dark';

        // Detect support for View Transitions and prefers-reduced-motion preference
        const useTransition = document.startViewTransition && !reducedMotion;

        if (!useTransition) {
            document.body.classList.toggle('light-mode');
            try { localStorage.setItem('theme', nextTheme); } catch { /* storage unavailable */ }
            return;
        }

        // Get starting coordinates from click event or fallback to the button's center
        const rect = themeBtn.getBoundingClientRect();
        const x = event.clientX ?? (rect.left + rect.width / 2);
        const y = event.clientY ?? (rect.top + rect.height / 2);

        // Compute the maximum radius needed to fully sweep the entire screen viewport
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
        document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);
        document.documentElement.style.setProperty('--theme-toggle-r', `${endRadius}px`);

        // Disable standard transitions during theme switch to prevent reflow lag
        document.documentElement.classList.add('switching-theme');

        const transition = document.startViewTransition(() => {
            document.body.classList.toggle('light-mode');
            try { localStorage.setItem('theme', nextTheme); } catch { /* storage unavailable */ }
        });

        transition.finished.finally(() => {
            document.documentElement.classList.remove('switching-theme');
        });
    });
}

// ─── Experience: the flight path, oldest role first ───
const MILESTONE_DATA = [
    {
        title: 'Network Administrator',
        company: 'SDC Networks, Kaloor',
        period: '2018 — 2020',
        status: 'Learning',
        description: 'Where it started: real network problems, on real hardware, with users waiting.',
        achievements: [
            'Maintained the primary LAN/WAN routing tables',
            'Configured secure remote-access VPN tunnels',
            'Kept systems available through L2/L3 triage',
        ],
        tools: ['BGP', 'OSPF', 'VLANs', 'pfSense', 'Cisco ASA', 'MikroTik'],
    },
    {
        title: 'Linux Administrator',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2020 — 2022',
        status: 'Scaling',
        description: 'More than 100 bare-metal and virtual servers, and a rule: anything done twice gets scripted.',
        achievements: [
            'Managed 100+ bare-metal and VM servers',
            'Cut deployment time by 70% with automation',
            'Hardened every OS: zero breaches',
        ],
        tools: ['RHEL', 'CentOS', 'Ubuntu', 'SELinux', 'iptables', 'Bash', 'Ansible'],
    },
    {
        title: 'Cloud Engineer',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2022 — 2024',
        status: 'Transitioning',
        description: 'Moving workloads to the cloud without anyone noticing, and paying less for it.',
        achievements: [
            'Led 20+ zero-downtime cloud migrations',
            'Cut infrastructure costs by 40%',
            'Designed high-availability, multi-AZ infrastructure',
        ],
        tools: ['AWS', 'GCP', 'VPC', 'EC2', 'RDS', 'Route 53', 'Auto Scaling'],
    },
    {
        title: 'Junior DevOps Engineer',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2024 — 2025',
        status: 'Automating',
        description: 'From servers to containers, and from manual releases to pipelines.',
        achievements: [
            'Migrated legacy bare-metal systems to Docker',
            'Automated infrastructure monitoring and alerts',
            'Sped up the CI/CD build pipelines',
        ],
        tools: ['Docker', 'Jenkins', 'Prometheus', 'Grafana'],
    },
    {
        title: 'Senior DevOps & Cloud Architect',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2025 — Present',
        status: 'Architecting',
        description: 'Running AWS architecture across more than 20 accounts, and teaching the next engineers how.',
        achievements: [
            'Directing AWS architecture across 20+ accounts',
            'Running a 99.99% uptime production cluster',
            'Mentored 700+ engineers in cloud technologies',
        ],
        tools: ['AWS Multi-Region', 'EKS', 'Terraform', 'GitHub Actions', 'ArgoCD'],
    },
];

// A sideways swipe on a touch screen: dir is +1 for next (swiped left), −1 for previous.
// Vertical swipes are left alone, so the page still scrolls
function onSwipe(el, fn) {
    let start = null;
    el.addEventListener('touchstart', e => { start = e.touches[0]; }, { passive: true });
    el.addEventListener('touchend', e => {
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.clientX, dy = t.clientY - start.clientY;
        start = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) fn(dx < 0 ? 1 : -1);
    }, { passive: true });
}

// Count a number up from zero on the shared spring curve
function countUp(el, target, ms, format = n => n) {
    const t0 = performance.now();
    (function tick(now) {
        const p = Math.min((now - t0) / ms, 1);
        el.textContent = format(Math.round(spring(p) * target));
        if (p < 1) requestAnimationFrame(tick);
    })(t0);
}

// The path: five identical curves end to end, so each role sits at an equal fraction of its length
const flightTrack = document.querySelector('.flight-track');
const FLIGHT_POINTS = MILESTONE_DATA.map((_, i) => [70 + i * 215, 132 - i * 26]);
const flightD = FLIGHT_POINTS.map(([x, y], i) => {
    if (i === 0) return `M${x} ${y}`;
    const [px, py] = FLIGHT_POINTS[i - 1];
    return `C${px + 100} ${py} ${x - 100} ${y} ${x} ${y}`;
}).join(' ');
const flightBase = document.querySelector('.flight-path-base');
const flightLit = document.querySelector('.flight-path-lit');
const flightCraft = document.querySelector('.flight-craft');
const flightStops = document.querySelector('.flight-stops');
const flightDetail = document.getElementById('flight-detail');
let activeMilestone = -1;

function renderMilestone(data) {
    const q = sel => flightDetail.querySelector(sel);
    q('.flight-status').textContent = data.status;
    q('.flight-title').textContent = data.title;
    q('.flight-meta').textContent = `${data.company} · ${data.period}`;
    q('.flight-description').textContent = data.description;
    q('.flight-achievements').replaceChildren(...data.achievements.map(text => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
    }));
    q('.flight-tools').textContent = data.tools.join(' · ');
}

const flightCount = document.querySelector('.flight-count');
const flightPrev = document.querySelector('.flight-prev');
const flightNext = document.querySelector('.flight-next');
const lastMilestone = MILESTONE_DATA.length - 1;
const craft = { frac: 0 };

function selectMilestone(milestone, { instant = false } = {}) {
    milestone = Math.min(Math.max(milestone, 0), lastMilestone);
    if (milestone === activeMilestone) return;
    const first = activeMilestone === -1;
    activeMilestone = milestone;
    [...flightStops.children].forEach((stop, i) => {
        stop.classList.toggle('active', i === milestone);
        stop.classList.toggle('passed', i < milestone);
        stop.setAttribute('aria-selected', String(i === milestone));
        stop.tabIndex = i === milestone ? 0 : -1;
    });
    flightCount.textContent = `${String(milestone + 1).padStart(2, '0')} / ${String(lastMilestone + 1).padStart(2, '0')}`;
    flightPrev.disabled = milestone === 0;
    flightNext.disabled = milestone === lastMilestone;

    // The craft flies along the path to the role, on the shared spring
    const frac = milestone / lastMilestone;
    if (instant || reducedMotion) {
        gsap.killTweensOf(craft);
        craft.frac = frac;
        placeCraft(frac);
    } else {
        gsap.to(craft, { frac, duration: MOTION.enter, ease: MOTION.ease, overwrite: true, onUpdate: () => placeCraft(craft.frac) });
    }

    const data = MILESTONE_DATA[milestone];
    if (first || instant || reducedMotion) return renderMilestone(data);
    // Content cross-fades in place: out softly, swap, back in with the shared rise
    const parts = flightDetail.children;
    gsap.timeline()
        .to(parts, { autoAlpha: 0, y: -8, duration: MOTION.exit / 3, ease: MOTION.ease, stagger: 0.02, overwrite: true, onComplete: () => renderMilestone(data) })
        .to(parts, { autoAlpha: 1, y: 0, duration: MOTION.update, ease: MOTION.ease, stagger: MOTION.stagger });
}

// Where the craft is along the path (0 → 1), lit up to there. It moves with a transform (no
// layout); the path's box is measured only when it changes size
let flightLength = 0, flightW = 0, flightH = 0;
const flightBox = document.querySelector('.flight');
if (flightBox) {
    new ResizeObserver(([entry]) => {
        flightW = entry.contentRect.width;
        flightH = entry.contentRect.height;
        placeCraft(craft.frac);
    }).observe(flightBox);
}
function placeCraft(frac) {
    if (!flightLength) return;
    const p = flightBase.getPointAtLength(frac * flightLength);
    flightCraft.style.transform = `translate3d(${((p.x / 1000) * flightW).toFixed(1)}px, ${((p.y / 160) * flightH).toFixed(1)}px, 0)`;
    // The lit stretch is traced point by point (a dash would be measured in the stretched
    // drawing's units and stop short)
    const n = Math.ceil(frac * 120);
    const pts = [];
    for (let k = 0; k <= n; k++) {
        const q = flightBase.getPointAtLength((k / Math.max(n, 1)) * frac * flightLength);
        pts.push(`${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
    }
    flightLit.setAttribute('d', frac > 0 ? `M${pts.join('L')}` : '');
}

// When the page arrives, the whole career is flown once: from 2018 to now, in a couple of seconds
let flownIn = false;
function flyIn() {
    if (flownIn || reducedMotion) return;
    flownIn = true;
    craft.frac = 0;
    placeCraft(0);
    gsap.to(craft, { frac: 1, duration: 2.4, ease: 'power2.inOut', delay: 0.3, overwrite: true, onUpdate: () => placeCraft(craft.frac) });
}

if (flightTrack && flightStops) {
    flightBase.setAttribute('d', flightD);
    flightLength = flightBase.getTotalLength();

    MILESTONE_DATA.forEach((data, i) => {
        const [x, y] = FLIGHT_POINTS[i];
        const stop = document.createElement('button');
        stop.type = 'button';
        stop.className = 'flight-stop';
        stop.style.left = `${x / 10}%`;
        stop.style.top = `${(y / 160) * 100}%`;
        stop.setAttribute('role', 'tab');
        stop.setAttribute('aria-controls', 'flight-detail');
        stop.innerHTML = '<span class="flight-stop-year"></span><span class="flight-stop-role"></span>';
        stop.children[0].textContent = data.period.slice(0, 4);
        stop.children[1].textContent = data.title;
        stop.addEventListener('click', () => selectMilestone(i));
        stop.addEventListener('keydown', e => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (!step) return;
            e.preventDefault();
            selectMilestone(activeMilestone + step);
            flightStops.children[activeMilestone].focus({ preventScroll: true });
        });
        flightStops.appendChild(stop);
    });
    flightPrev.addEventListener('click', () => selectMilestone(activeMilestone - 1));
    flightNext.addEventListener('click', () => selectMilestone(activeMilestone + 1));

    // Phones: swipe the role sideways to move along the path (vertical swipes still scroll)
    onSwipe(flightDetail, dir => selectMilestone(activeMilestone + dir));

    // Opens on the current role, the path drawn all the way
    selectMilestone(lastMilestone, { instant: true });
    if (!reducedMotion) placeCraft(0);   // until the page arrives and flies it in
}

// ─── Skills Section ───────────────────────────────────────────────────────────
// Edit this data to update your skills in the future.
const SKILLS_DATA = [
    {
        category: 'Cloud & Infrastructure',
        skills: ['AWS EC2', 'AWS S3', 'AWS VPC', 'AWS RDS', 'AWS IAM', 'AWS CloudWatch', 'Route 53', 'EKS', 'AWS SAA']
    },
    {
        category: 'DevOps & CI/CD',
        skills: ['Kubernetes', 'Docker', 'Jenkins', 'GitHub Actions', 'ArgoCD', 'Terraform', 'Ansible', 'Helm']
    },
    {
        category: 'Monitoring & Security',
        skills: ['Prometheus', 'Grafana', 'Nagios', 'ELK Stack', 'fail2ban', 'SELinux', 'iptables', 'pfSense']
    },
    {
        category: 'OS & Networking',
        skills: ['RHEL', 'CentOS', 'Ubuntu', 'Cisco', 'MikroTik', 'VLAN', 'VPN', 'BGP', 'OSPF', 'Wireshark']
    },
    {
        category: 'Scripting & Automation',
        skills: ['Bash', 'Shell Script', 'Python', 'YAML', 'JSON', 'Makefile', 'Cron', 'Systemd']
    },
    {
        category: 'Certifications',
        skills: ['RHCSA (#250-136-470)', 'AWS SAA (Apr 2026)']
    }
];

// The role in which each skill first came in (index into MILESTONE_DATA), from the tools named
// in each role's manifest above. Skills not listed here show only their category.
const SKILL_FIRST_ROLE = {
    'Cisco': 0, 'MikroTik': 0, 'VLAN': 0, 'VPN': 0, 'BGP': 0, 'OSPF': 0, 'pfSense': 0,
    'RHEL': 1, 'CentOS': 1, 'Ubuntu': 1, 'SELinux': 1, 'iptables': 1, 'Bash': 1, 'Shell Script': 1, 'Ansible': 1,
    'AWS EC2': 2, 'AWS VPC': 2, 'AWS RDS': 2, 'Route 53': 2,
    'Docker': 3, 'Jenkins': 3, 'Prometheus': 3, 'Grafana': 3,
    'Kubernetes': 4, 'EKS': 4, 'Terraform': 4, 'GitHub Actions': 4, 'ArgoCD': 4,
};

// Skills are stars: pointing at one (or tapping it) shows its catalogue entry, and every skill
// picked up in the same role lights up with it
function renderSkills() {
    const grid = document.getElementById('skills-grid');
    const readout = document.getElementById('skill-readout');
    if (!grid) return;

    // Each category is a constellation: its stars zigzag down the chart, joined by faint lines,
    // each named to its right. A star's size is its magnitude: how long the skill has been in use
    const thisYear = new Date().getFullYear();
    const yearsOf = skill => skill in SKILL_FIRST_ROLE
        ? thisYear - parseInt(MILESTONE_DATA[SKILL_FIRST_ROLE[skill]].period, 10)
        : null;
    const rand = (() => { let seed = 11; return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); })();
    const stars = [];
    SKILLS_DATA.forEach((group, g) => {
        const constellation = document.createElement('div');
        constellation.className = 'constellation';
        const label = document.createElement('p');
        label.className = 'constellation-name';
        label.innerHTML = '<span class="cat-id"></span><span></span>';
        label.children[0].textContent = `C${g + 1}`;
        label.children[1].textContent = group.category;

        const chart = document.createElement('div');
        chart.className = 'constellation-chart';
        chart.style.setProperty('--rows', group.skills.length);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        const n = group.skills.length;
        const points = group.skills.map((_, i) => [4 + (i % 2 ? 8 : 0) + rand() * 5, ((i + 0.5) / n) * 100]);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('points', points.map(p => p.join(',')).join(' '));
        svg.appendChild(line);
        chart.appendChild(svg);

        group.skills.forEach((skill, i) => {
            const star = document.createElement('button');
            star.type = 'button';
            star.className = 'skill-star';
            star.style.left = `${points[i][0]}%`;
            star.style.top = `${points[i][1]}%`;
            const years = yearsOf(skill);
            star.dataset.mag = years === null ? 0 : years >= 6 ? 3 : years >= 3 ? 2 : 1;
            star.textContent = skill;
            star.dataset.id = `MW·03-${g + 1}${String(i + 1).padStart(2, '0')}`;
            star.dataset.category = group.category;
            if (skill in SKILL_FIRST_ROLE) star.dataset.role = SKILL_FIRST_ROLE[skill];
            chart.appendChild(star);
            stars.push(star);
        });
        constellation.append(label, chart);
        grid.appendChild(constellation);
    });

    // Phones show one constellation at a time: a chip per category, or a sideways swipe
    const constellations = [...grid.children];
    const tabs = document.createElement('div');
    tabs.className = 'sky-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Skill categories');
    let shownGroup = 0;
    const showGroup = g => {
        shownGroup = (g + constellations.length) % constellations.length;
        constellations.forEach((c, i) => c.classList.toggle('is-shown', i === shownGroup));
        [...tabs.children].forEach((t, i) => {
            t.classList.toggle('active', i === shownGroup);
            t.setAttribute('aria-selected', String(i === shownGroup));
        });
        tabs.children[shownGroup].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };
    SKILLS_DATA.forEach((group, g) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'chip chip--small';
        tab.setAttribute('role', 'tab');
        tab.textContent = group.category;
        tab.addEventListener('click', () => showGroup(g));
        tabs.appendChild(tab);
    });
    grid.before(tabs);
    showGroup(0);
    onSwipe(grid, dir => showGroup(shownGroup + dir));

    if (!readout) return;
    const empty = readout.firstElementChild;
    let pinned = null;
    let shown = null;

    const show = star => {
        if (star === shown) return;
        shown = star;
        stars.forEach(s => {
            s.classList.toggle('is-lit', s === star || (star?.dataset.role !== undefined && s.dataset.role === star.dataset.role));
            s.classList.toggle('is-current', s === star);
        });
        grid.classList.toggle('has-lit', !!star);
        if (!star) {
            readout.classList.remove('is-filled');
            readout.replaceChildren(empty);
            return;
        }
        readout.classList.add('is-filled');
        readout.replaceChildren();
        const head = document.createElement('p');
        head.className = 'skill-readout-head';
        head.innerHTML = `<span class="cat-id"></span><span class="skill-readout-name"></span><span class="skill-readout-cat"></span>`;
        head.children[0].textContent = star.dataset.id;
        head.children[1].textContent = star.textContent;
        head.children[2].textContent = star.dataset.category;
        readout.appendChild(head);

        const body = document.createElement('p');
        body.className = 'skill-readout-body';
        const role = MILESTONE_DATA[star.dataset.role];
        if (role) {
            const since = parseInt(role.period, 10);
            const years = Math.max(1, thisYear - since);
            const lit = stars.filter(s => s.dataset.role === star.dataset.role).length;
            body.append(`In use since ${since}, about ${years} year${years === 1 ? '' : 's'}. First picked up as `);
            const link = document.createElement('button');
            link.type = 'button';
            link.className = 'skill-readout-role';
            link.textContent = role.title;
            link.addEventListener('click', () => {
                selectMilestone(Number(star.dataset.role));
                scrollToSection('#experience');
            });
            body.append(link, ` at ${role.company.split(',')[0]}, along with ${lit - 1} other skill${lit === 2 ? '' : 's'} lit up here.`);
        } else {
            body.textContent = `Part of my ${star.dataset.category.toLowerCase()} toolkit.`;
        }
        readout.appendChild(body);
    };

    const hoverable = window.matchMedia('(hover: hover)').matches;
    stars.forEach(star => {
        if (hoverable) {
            star.addEventListener('pointerenter', () => show(star));
            star.addEventListener('pointerleave', () => show(pinned));
        }
        star.addEventListener('focus', () => show(star));
        // (not when focus moves into the entry itself, to its role link)
        star.addEventListener('blur', e => { if (!readout.contains(e.relatedTarget)) show(pinned); });
        star.addEventListener('click', () => {
            pinned = pinned === star ? null : star;
            star.setAttribute('aria-pressed', String(pinned === star));
            stars.forEach(s => s !== star && s.removeAttribute('aria-pressed'));
            show(pinned ?? (hoverable ? star : null));
        });
    });
}

renderSkills();

// ─── About: count up the stats once they scroll into view ───
const stats = document.getElementById('about-stats');
if (stats) {
    const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        stats.querySelectorAll('.stat-num').forEach((el, i) => {
            setTimeout(() => countUp(el, parseInt(el.dataset.target, 10), 1600), i * 120);
        });
    }, { threshold: 0.3 });
    observer.observe(stats);
}

// ─── Scroll choreography: hero → world, page transitions, camera stations ───
({ lenis } = initTransitions({
    world,
    particles,
    reducedMotion,
    onStation,
    onReveal: el => {
        if (el.matches('.flight')) flyIn();
        el.querySelectorAll('[data-reveal]').forEach(revealHeading);
        (el.matches(LINE_TEXT) ? [el] : [...el.querySelectorAll(LINE_TEXT)]).forEach(revealLines);
    },
    onOpenStretch,
}));

// ─── Work: one case at a time; the three headline numbers are the switch ───
const caseList = document.querySelector('.case-studies');
if (caseList) {
    const cases = [...caseList.querySelectorAll('.case-study')];
    const tabs = document.createElement('div');
    tabs.className = 'case-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Case studies');
    let shown = -1;
    const showCase = (i, instant = false) => {
        i = (i + cases.length) % cases.length;
        if (i === shown) return;
        const prev = cases[shown];
        shown = i;
        [...tabs.children].forEach((t, k) => {
            t.classList.toggle('active', k === i);
            t.setAttribute('aria-selected', String(k === i));
            t.tabIndex = k === i ? 0 : -1;
        });
        const swap = () => cases.forEach((c, k) => { c.hidden = k !== i; });
        if (instant || reducedMotion || !prev) return swap();
        gsap.timeline()
            .to(prev, { autoAlpha: 0, y: -8, duration: MOTION.exit / 3, ease: MOTION.ease, overwrite: true, onComplete: swap })
            .fromTo(cases[i], { autoAlpha: 0, y: MOTION.rise }, { autoAlpha: 1, y: 0, duration: MOTION.update, ease: MOTION.ease });
    };
    cases.forEach((c, i) => {
        c.id = `case-${i + 1}`;
        c.setAttribute('role', 'tabpanel');
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'case-tab';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', c.id);
        tab.innerHTML = '<span class="case-tab-value"></span><span class="case-tab-label"></span>';
        tab.children[0].textContent = c.querySelector('.case-metric-value').textContent;
        tab.children[1].textContent = c.querySelector('h3').textContent;
        tab.addEventListener('click', () => showCase(i));
        tab.addEventListener('keydown', e => {
            const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            if (!step) return;
            e.preventDefault();
            showCase(shown + step);
            tabs.children[shown].focus();
        });
        tabs.appendChild(tab);
    });
    caseList.before(tabs);
    showCase(0, true);
    onSwipe(caseList, dir => showCase(shown + dir));
}

// ─── Skills orbit; contact chips can be thrown into the hole ───
const skyChart = document.getElementById('skills-grid');
if (skyChart && !reducedMotion) createOrbits(skyChart);
throwables = reducedMotion ? null : createThrowables([...document.querySelectorAll('#portal-contact .social-link')], {
    onEaten: (x, y) => waves.emit(x, y, 1.4),
});

// ─── Gravitational waves: from every click in the Galaxy, and a merger to escape ───
document.addEventListener('click', e => {
    if (!header.classList.contains('is-world') || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, dialog, .finale-escape')) return;
    waves.emit(e.clientX, e.clientY);
});
document.querySelector('.finale-escape')?.addEventListener('click', e => {
    const box = e.currentTarget.getBoundingClientRect();
    waves.merger(box.left + box.width / 2, box.top + box.height / 2);
});

// ─── Terminal (press ~) ───
const terminal = createTerminal({
    milestones: MILESTONE_DATA,
    skills: SKILLS_DATA,
    sections: sectionIds.slice(1).map(id => ({ id, dir: id === 'portal-contact' ? 'contact' : id })),
    onNavigate: scrollToSection,
    ambient: window.AudioContext ? {
        get on() { return ambient.on; },
        setOn(v) { ambient.setOn(v); syncSound(); },
    } : null,
    lenis,
});
document.getElementById('terminal-open')?.addEventListener('click', () => terminal.open());

// Split headings up front so the first reveal doesn't reflow
document.querySelectorAll('[data-reveal]').forEach(splitWords);
