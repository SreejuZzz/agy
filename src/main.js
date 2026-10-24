import './styles/main.css';
import { AntigravityParticles } from './antigravity-particles.js';
import { GalaxyWorld, RS_KPC } from './galaxy-world.js';
import { initTransitions } from './transitions.js';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { MOTION, spring } from './motion.js';

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
        world = new GalaxyWorld(worldCanvas, { mobile: isMobile });
    } catch {
        world = null; // the plain dark backdrop still shows
    }
}

// ─── Header: active chapter, gliding underline, scroll progress ───
const header = document.getElementById('main-header');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
const indicator = document.querySelector('.nav-indicator');
const sectionIds = ['home', ...[...document.querySelectorAll('.world-section')].map(s => s.id)];
let activeIndex = -1;

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
    }
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

function onOpenStretch(k, index, finale) {
    // Dim the scene behind a page while it is read; full brightness between pages and in the finale
    // Set on #world itself (its ::after uses it), so only that element restyles
    const dim = (1 - Math.max(k, finale)).toFixed(3);
    if (worldEl && dim !== lastDim) {
        lastDim = dim;
        worldEl.style.setProperty('--world-dim', dim);
    }
    if (!chapter) return;
    if (index >= 0 && index !== chapterShown && CHAPTERS[index]) {
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
if (world && readout) {
    let shown = '', shownExtra = '';
    world.onReadout = ({ kpc, myr, clock }) => {
        const text = formatDistance(kpc), extra = formatExtra(myr, clock);
        if (text !== shown) readout.textContent = shown = text;
        if (readoutExtra && extra !== shownExtra) readoutExtra.textContent = shownExtra = extra;
    };
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

// ─── DevOps Console: Experience Cloud Topology ───
const MILESTONE_DATA = [
    {
        title: 'Network Administrator',
        company: 'SDC Networks, Kaloor',
        period: '2018 — 2020',
        status: 'Learning',
        efficiency: '88',
        focusAreas: [
            { name: 'Physical Networking', val: 85 },
            { name: 'Firewalls & Sec', val: 75 },
            { name: 'Support & Triage', val: 65 }
        ],
        bento1: { label: 'Environment', val: 'On-Premises' },
        bento2: { label: 'Key Challenge', val: 'Hardware Routing' },
        description: 'Maintained primary LAN/WAN routing tables, configured secure remote-access VPN tunnels, and maximized system availability through L2/L3 triage.',
        yaml: `apiVersion: sreejith.devops/v1
kind: CareerMilestone
metadata:
  name: network-administrator
  company: "SDC Networks, Kaloor"
  period: "2018-2020"
spec:
  role: "Network Administrator"
  routingProtocols: ["BGP", "OSPF", "VLANs"]
  firewallSystems: ["pfSense", "Cisco ASA"]
  hardwareVendor: ["Cisco", "MikroTik"]
  achievements:
    - "Maintained primary LAN/WAN routing tables"
    - "Configured secure remote-access VPN tunnel"
    - "Maximized system availability, L2/L3 triage"`
    },
    {
        title: 'Linux Administrator',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2020 — 2022',
        status: 'Scaling',
        efficiency: '92',
        focusAreas: [
            { name: 'Linux OS Mgmt', val: 90 },
            { name: 'Bash Scripting', val: 80 },
            { name: 'Issue Resolution', val: 75 }
        ],
        bento1: { label: 'Server Count', val: '100+ Nodes' },
        bento2: { label: 'Key Challenge', val: 'System Hardening' },
        description: 'Managed 100+ bare-metal & VM servers, reducing system deployment times by 70% through automation. Hardened operating systems resulting in zero breaches.',
        yaml: `apiVersion: sreejith.devops/v1
kind: CareerMilestone
metadata:
  name: linux-administrator
  company: "Synnefo Solutions"
  period: "2020-2022"
spec:
  role: "Linux Administrator"
  distributions: ["RHEL", "CentOS", "Ubuntu"]
  securityPolicies: ["SELinux", "iptables"]
  automation: "Bash Scripting & Ansible"
  achievements:
    - "Managed 100+ bare-metal & VM servers"
    - "Reduced system deployment times by 70%"
    - "Hardened operating systems, zero breaches"`
    },
    {
        title: 'Cloud Engineer',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2022 — 2024',
        status: 'Transitioning',
        efficiency: '95',
        focusAreas: [
            { name: 'Cloud Architecture', val: 92 },
            { name: 'Migration Work', val: 85 },
            { name: 'Cost Optimization', val: 78 }
        ],
        bento1: { label: 'Cloud Focus', val: 'AWS & GCP' },
        bento2: { label: 'Key Challenge', val: 'Zero-Downtime' },
        description: 'Led 20+ zero-downtime cloud migrations and cut platform infrastructure costs by 40% while designing high-availability infrastructure.',
        yaml: `apiVersion: sreejith.devops/v1
kind: CareerMilestone
metadata:
  name: cloud-engineer
  company: "Synnefo Solutions"
  period: "2022-2024"
spec:
  role: "Cloud Engineer"
  platforms: ["AWS", "GCP"]
  components: ["VPC", "EC2", "RDS", "Route53"]
  redundancy: "Multi-AZ & Auto-Scaling"
  achievements:
    - "Led 20+ zero-downtime cloud migrations"
    - "Cut platform infrastructure costs by 40%"
    - "Designed high-availability infrastructure"`
    },
    {
        title: 'Junior DevOps Engineer',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2024 — 2025',
        status: 'Automating',
        efficiency: '96',
        focusAreas: [
            { name: 'CI/CD Pipelines', val: 88 },
            { name: 'Docker Containers', val: 85 },
            { name: 'Monitoring Alerts', val: 82 }
        ],
        bento1: { label: 'Deployments', val: 'Fully Dockerized' },
        bento2: { label: 'Key Challenge', val: 'Pipeline Speed' },
        description: 'Migrated legacy bare-metal systems to containerized Docker environments. Automated infrastructure monitoring alerts and optimized CI/CD pipelines.',
        yaml: `apiVersion: sreejith.devops/v1
kind: CareerMilestone
metadata:
  name: junior-devops-engineer
  company: "Synnefo Solutions"
  period: "2024-2025"
spec:
  role: "Junior DevOps Engineer"
  containerization: "Docker"
  continuousIntegration: "Jenkins Pipelines"
  monitoringStack: "Prometheus & Grafana"
  achievements:
    - "Migrated legacy bare-metal to Docker pods"
    - "Automated infrastructure monitoring alerts"
    - "Optimized build pipelines, reducing latency"`
    },
    {
        title: 'Senior DevOps & Cloud Architect',
        company: 'Synnefo Solutions, Ernakulam',
        period: '2025 — Present',
        status: 'Architecting',
        efficiency: '98',
        focusAreas: [
            { name: 'Infrastruct as Code', val: 95 },
            { name: 'Kubernetes/EKS', val: 90 },
            { name: 'Team Mentorship', val: 85 }
        ],
        bento1: { label: 'Architecture', val: 'Multi-Region' },
        bento2: { label: 'Key Challenge', val: 'Resilience' },
        description: 'Directing AWS architecture across 20+ accounts and orchestrating a 99.99% uptime production cluster. Mentored over 700 engineers.',
        yaml: `apiVersion: sreejith.devops/v1
kind: CareerMilestone
metadata:
  name: senior-devops-engineer
  company: "Synnefo Solutions"
  period: "2025-Present"
spec:
  role: "Senior DevOps & Cloud Architect"
  architecture: "AWS Multi-Region / EKS"
  infrastructureAsCode: "Terraform"
  pipelineEngine: "GitHub Actions & ArgoCD"
  achievements:
    - "Directing AWS architecture across 20+ accounts"
    - "Orchestrated 99.99% uptime production cluster"
    - "Mentored 700+ engineers in cloud technologies"`
    }
];

const topoNodes = document.querySelectorAll('.html-topo-node');
const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
let yamlTypingInterval = null;

function highlightYAML(line) {
    let escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    if (escaped.trim().startsWith('#')) {
        return `<span class="yaml-comment">${escaped}</span>`;
    }

    escaped = escaped.replace(/^([ \t]*)([^#:\n]+)(:)/g, (match, indent, key, colon) => {
        return `${indent}<span class="yaml-key">${key}</span>${colon}`;
    });

    escaped = escaped.replace(/(:\s+)([^#\n]+)/g, (match, colon, val) => {
        const trimmedVal = val.trim();
        if (trimmedVal.startsWith('"') && trimmedVal.endsWith('"')) {
            return `${colon}<span class="yaml-val">${val}</span>`;
        }
        if (trimmedVal.startsWith('[') && trimmedVal.endsWith(']')) {
            return `${colon}<span class="yaml-arr">${val}</span>`;
        }
        if (trimmedVal === 'true' || trimmedVal === 'false' || !isNaN(trimmedVal)) {
            return `${colon}<span class="yaml-class">${val}</span>`;
        }
        return `${colon}<span class="yaml-val">${val}</span>`;
    });

    escaped = escaped.replace(/^([ \t]*-\s+)([^#\n]+)/g, (match, hyphen, val) => {
        return `${hyphen}<span class="yaml-arr">${val}</span>`;
    });

    if (escaped.includes('CareerMilestone')) {
        escaped = escaped.replace('CareerMilestone', '<span class="yaml-class">CareerMilestone</span>');
    }

    return escaped;
}

function typeYAML(yamlText) {
    const codeContainer = document.getElementById('yaml-manifest-code');
    if (!codeContainer) return;

    if (yamlTypingInterval) clearInterval(yamlTypingInterval);
    codeContainer.innerHTML = '';
    codeContainer.classList.add('yaml-typing');

    const lines = yamlText.split('\n');
    let lineIdx = 0;

    yamlTypingInterval = setInterval(() => {
        if (lineIdx < lines.length) {
            const highlighted = highlightYAML(lines[lineIdx]);
            const div = document.createElement('div');
            div.innerHTML = highlighted;
            codeContainer.appendChild(div);

            const body = codeContainer.closest('.code-body');
            if (body) body.scrollTop = body.scrollHeight;

            lineIdx++;
        } else {
            clearInterval(yamlTypingInterval);
            codeContainer.classList.remove('yaml-typing');
        }
    }, 25);
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

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function updateTelemetry(milestone) {
    const data = MILESTONE_DATA[milestone];
    if (!data) return;

    const applyData = () => {
        setText('inspector-title', data.title);
        setText('inspector-company', data.company);
        setText('inspector-period', data.period);
        setText('inspector-description', data.description);
        setText('inspector-status', data.status);

        // Gauge ring
        const gaugeFill = document.getElementById('sla-gauge-fill');
        const percentageText = document.getElementById('sla-percentage');
        if (percentageText) countUp(percentageText, parseInt(data.efficiency, 10), MOTION.enter * 1000, n => `${n}%`);
        if (gaugeFill) {
            const circumference = 213.6;
            const offset = circumference * (1 - parseFloat(data.efficiency) / 100);
            gaugeFill.style.strokeDashoffset = offset;
        }

        // Focus Area sliders
        data.focusAreas.forEach((area, idx) => {
            const sliderName = document.getElementById(`comp-name-${idx}`);
            const sliderVal = document.getElementById(`comp-val-${idx}`);
            const sliderFill = document.getElementById(`comp-fill-${idx}`);
            if (sliderName) sliderName.textContent = area.name;
            if (sliderVal) countUp(sliderVal, area.val, MOTION.enter * 1000, n => `${n}%`);
            if (sliderFill) {
                sliderFill.style.width = '0%';
                setTimeout(() => {
                    sliderFill.style.width = `${area.val}%`;
                }, 50);
            }
        });

        // Bento stats
        setText('bento-label-1', data.bento1.label);
        setText('metric-bento-scale', data.bento1.val);
        setText('bento-label-2', data.bento2.label);
        setText('metric-bento-highlight', data.bento2.val);

        // Run YAML type stream
        typeYAML(data.yaml);
    };

    // Content cross-fades in place: out softly, swap, back in with the shared rise
    const blocks = ['.inspector-header', '.inspector-metrics', '.telemetry-panel .code-window'];
    gsap.timeline()
        .to(blocks, { opacity: 0, y: -8, duration: MOTION.exit / 2, ease: MOTION.ease, stagger: 0.03, overwrite: true, onComplete: applyData })
        .to(blocks, { opacity: 1, y: 0, duration: MOTION.update, ease: MOTION.ease, stagger: MOTION.stagger });
}

function selectMilestone(milestone) {
    // Sync topo SVG nodes
    topoNodes.forEach(node => {
        const currentMilestone = parseInt(node.dataset.milestone, 10);
        node.classList.toggle('active', currentMilestone === milestone);
    });

    // Sync mobile navigation backup pills
    mobileNavBtns.forEach(btn => {
        const currentMilestone = parseInt(btn.dataset.milestone, 10);
        btn.classList.toggle('active', currentMilestone === milestone);
        btn.setAttribute('aria-selected', currentMilestone === milestone ? 'true' : 'false');
    });

    // Load Telemetry Dashboard elements
    updateTelemetry(milestone);
}

// Topology nodes and their mobile tab equivalents select a milestone
[...topoNodes, ...mobileNavBtns].forEach(el => {
    el.addEventListener('click', () => selectMilestone(parseInt(el.dataset.milestone, 10)));
});

// Attach Copy Spec listener
const copyBtn = document.getElementById('yaml-copy-btn');
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const activeNode = document.querySelector('.html-topo-node.active');
        const milestone = activeNode ? parseInt(activeNode.dataset.milestone, 10) : 4;
        const rawYAML = MILESTONE_DATA[milestone].yaml;

        navigator.clipboard.writeText(rawYAML).then(() => {
            copyBtn.classList.add('active');
            copyBtn.querySelector('.copy-text').textContent = 'Copied';
            setTimeout(() => {
                copyBtn.classList.remove('active');
                copyBtn.querySelector('.copy-text').textContent = 'Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    });
}

// Initialise experience dashboard (Default to Senior role - milestone 4)
if (topoNodes.length > 0) {
    selectMilestone(4);
}

// ─── Contact Form ───
const contactForm = document.getElementById('contact-form');
const contactTerminal = document.getElementById('contact-terminal-output');
const submitBtn = document.getElementById('submit-btn');

function validateField(input, errorEl) {
    if (!input.value.trim()) {
        input.classList.add('invalid');
        errorEl.textContent = 'This field is required.';
        return false;
    }
    if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
        input.classList.add('invalid');
        errorEl.textContent = 'Please enter a valid email.';
        return false;
    }
    input.classList.remove('invalid');
    errorEl.textContent = '';
    return true;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function typeContactTerminal(lines) {
    if (!contactTerminal) return;
    contactTerminal.innerHTML = '';

    lines.forEach((line, i) => {
        setTimeout(() => {
            const lineEl = document.createElement('div');
            lineEl.className = 'terminal-line';

            if (line.type === 'cmd') {
                lineEl.innerHTML = `<span class="prompt">$</span> <span class="cmd">${escapeHtml(line.text)}</span>`;
            } else {
                lineEl.innerHTML = `<span class="${line.type}">${escapeHtml(line.text)}</span>`;
            }

            contactTerminal.appendChild(lineEl);
            contactTerminal.scrollTop = contactTerminal.scrollHeight;

            // On the final line, add a blinking cursor and reset the button
            if (i === lines.length - 1) {
                const cursorLine = document.createElement('div');
                cursorLine.className = 'terminal-line terminal-cursor-blink';
                cursorLine.innerHTML = '<span class="prompt">$</span> ';
                contactTerminal.appendChild(cursorLine);

                // Reset button after success animation
                if (submitBtn) {
                    setTimeout(() => {
                        submitBtn.classList.remove('loading', 'success');
                        submitBtn.querySelector('.btn-text').textContent = 'Send message';
                    }, 3000);
                }
            }
        }, 80 + i * 100);
    });
}

if (contactForm && submitBtn) {
    // Clear validation on input
    contactForm.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('invalid');
            const errorEl = input.parentElement.querySelector('.field-error');
            if (errorEl) errorEl.textContent = '';
        });
    });

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('contact-name');
        const emailInput = document.getElementById('contact-email');
        const msgInput = document.getElementById('contact-message');
        const nameError = document.getElementById('name-error');
        const emailError = document.getElementById('email-error');
        const msgError = document.getElementById('message-error');

        const isNameValid = validateField(nameInput, nameError);
        const isEmailValid = validateField(emailInput, emailError);
        const isMsgValid = validateField(msgInput, msgError);

        if (!isNameValid || !isEmailValid || !isMsgValid) return;

        // Start "deploying" animation
        submitBtn.classList.add('loading');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        typeContactTerminal([
            { type: 'cmd', text: 'kubectl apply -f message-payload.yaml' },
            { type: 'output', text: `Packaging payload from ${name} <${email}>...` },
            { type: 'output', text: 'Validating SMTP route configuration...' },
            { type: 'success', text: '[ ok ] route validated: smtp-gateway.sreejith.cloud' },
            { type: 'output', text: 'Provisioning message container...' },
            { type: 'success', text: '[ ok ] container deployed: msg-relay-pod-7x3k2' },
            { type: 'output', text: 'Encrypting payload with TLS 1.3...' },
            { type: 'success', text: '[ ok ] payload encrypted and sealed' },
            { type: 'output', text: 'Deploying to message queue...' },
            { type: 'success', text: '[ ok ] message deployed' },
            { type: 'output', text: '' },
            { type: 'info', text: 'Thank you. I\'ll reply within 24 hours.' },
        ]);

        // Show success on button
        setTimeout(() => {
            submitBtn.classList.remove('loading');
            submitBtn.classList.add('success');
            submitBtn.querySelector('.btn-text').textContent = 'Sent';
            contactForm.reset();
        }, 1400);
    });
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

function renderSkills() {
    const grid = document.getElementById('skills-grid');
    if (!grid) return;

    SKILLS_DATA.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'card skill-group';

        groupEl.innerHTML = `
            <p class="card-label">${group.category}</p>
            <div class="tag-list">
                ${group.skills.map(s => `<span class="tag">${s}</span>`).join('')}
            </div>
        `;
        grid.appendChild(groupEl);
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
initTransitions({
    world,
    particles,
    reducedMotion,
    onStation,
    onReveal: el => {
        el.querySelectorAll('[data-reveal]').forEach(revealHeading);
        (el.matches(LINE_TEXT) ? [el] : [...el.querySelectorAll(LINE_TEXT)]).forEach(revealLines);
    },
    onOpenStretch,
});

// Split headings up front so the first reveal doesn't reflow
document.querySelectorAll('[data-reveal]').forEach(splitWords);
