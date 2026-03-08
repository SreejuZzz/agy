import './styles/tokens.css';
import './styles/main.css';

// Register Paint Worklet
if ('paintWorklet' in CSS) {
    CSS.paintWorklet.addModule(new URL('./particle-worklet.js', import.meta.url));
}

// ─── Animation Loop for Particles ───
let tick = 0;
// 0.3 units/frame at 60fps (~16.6ms) → 0.018 tick units per millisecond
const tickPerMs = 0.018;
let lastTime = 0;

// Ring position state
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;

// Cache values to avoid redundant CSS variable DOM writes
let lastMouseX = -1;
let lastMouseY = -1;
let lastRingX = -1;
let lastRingY = -1;

// Frame-rate-independent lerp
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

const particlesBg = document.querySelector('.particles-bg');

// Lerp smoothing constant — designed for 60fps baseline
const LERP_BASE = 0.012;
const LERP_FRAME_MS = 16.667; // 60fps reference frame time

let animationId = null;

function animate(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Delta-time tick: identical visual speed at 60/90/120/165Hz
    tick += deltaTime * tickPerMs;

    if (particlesBg) {
        particlesBg.style.setProperty('--animation-tick', tick.toString());

        // Frame-rate-independent lerp: 1 - (1-base)^(dt/16.667)
        if (Math.abs(ringX - mouseX) > 0.1 || Math.abs(ringY - mouseY) > 0.1) {
            const lerpAmt = 1 - Math.pow(1 - LERP_BASE, deltaTime / LERP_FRAME_MS);
            ringX = lerp(ringX, mouseX, lerpAmt);
            ringY = lerp(ringY, mouseY, lerpAmt);

            const roundRingX = Math.round(ringX * 10) / 10;
            const roundRingY = Math.round(ringY * 10) / 10;

            if (roundRingX !== lastRingX) {
                particlesBg.style.setProperty('--ring-x', roundRingX.toFixed(1));
                lastRingX = roundRingX;
            }
            if (roundRingY !== lastRingY) {
                particlesBg.style.setProperty('--ring-y', roundRingY.toFixed(1));
                lastRingY = roundRingY;
            }
        }

        if (mouseX !== lastMouseX) {
            particlesBg.style.setProperty('--mouse-x-instant', mouseX.toFixed(1));
            lastMouseX = mouseX;
        }
        if (mouseY !== lastMouseY) {
            particlesBg.style.setProperty('--mouse-y-instant', mouseY.toFixed(1));
            lastMouseY = mouseY;
        }
    }

    animationId = requestAnimationFrame(animate);
}

// Passive mouse tracking
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
}, { passive: true });

// Pause animation when tab is hidden to save CPU/GPU
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    } else {
        lastTime = 0; // Reset so delta doesn't spike
        animationId = requestAnimationFrame(animate);
    }
});

// Start animation
animationId = requestAnimationFrame(animate);


// ─── Mobile Navigation Toggle ───
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        const isActive = navLinks.classList.toggle('active');
        hamburger.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', isActive);
        document.body.style.overflow = isActive ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });
}

// ─── Theme Toggle ───
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('light-mode');
        const oldColor = isDark ? '#050505' : '#e0e0e0';
        const targetColor = isDark ? '#e0e0e0' : '#050505';

        const rect = themeBtn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const endRadius = Math.hypot(
            Math.max(x, innerWidth - x),
            Math.max(y, innerHeight - y)
        );

        const ripple = document.createElement('div');
        ripple.className = 'theme-ripple';
        ripple.style.backgroundColor = targetColor;
        document.body.appendChild(ripple);
        document.body.style.backgroundColor = oldColor;

        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');

        const animation = ripple.animate(
            [
                { clipPath: `circle(0px at ${x}px ${y}px)` },
                { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }
            ],
            { duration: 800, easing: 'ease-in-out', fill: 'forwards' }
        );

        animation.onfinish = () => {
            document.body.style.backgroundColor = '';
            ripple.remove();
        };
    });

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
}

// ─── Removed Experience Traverse ───

// Removing portal read/write logic

// Empty scroll/resize functions since Traverse code is gone

// ─── Card Mouse Tracking for Glow Effect ───
// Optimize via event delegation and avoiding getBoundingClientRect during mousemove
document.addEventListener('mousemove', e => {
    // Only process if moving over a tracked element
    const card = e.target.closest('.bento-card, .traverse-card');
    if (!card) return;

    // Instead of forcing layout recalculation via getBoundingClientRect, 
    // extract coordinates dynamically assuming the card is relatively positioned.
    // Modern approach: use clientX/clientY minus the element's offset relative to viewport
    // Since getBoundingClientRect forces layout, we'll cache it conditionally or rely on bounding logic 
    // that only recalculates occasionally. For now, reading rect here is okay if limited to hovered element, 
    // but caching it during scroll would be better. Let's apply a rapid cache approach:

    if (!card._rectCache || e.timeStamp - (card._rectTime || 0) > 500) {
        card._rectCache = card.getBoundingClientRect();
        card._rectTime = e.timeStamp;
    }

    const rect = card._rectCache;
    // We do write directly to style which is fast if batched or updating CSS var isolated
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
}, { passive: true });
