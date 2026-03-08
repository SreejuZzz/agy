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
                particlesBg.style.setProperty('--ring-x', roundRingX.toString());
                lastRingX = roundRingX;
            }
            if (roundRingY !== lastRingY) {
                particlesBg.style.setProperty('--ring-y', roundRingY.toString());
                lastRingY = roundRingY;
            }
        }

        if (mouseX !== lastMouseX) {
            particlesBg.style.setProperty('--mouse-x-instant', mouseX.toString());
            lastMouseX = mouseX;
        }
        if (mouseY !== lastMouseY) {
            particlesBg.style.setProperty('--mouse-y-instant', mouseY.toString());
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

// ─── Z-Axis Experience Scroll + Portal ───
const traverseSection = document.getElementById('experience');
const portalSection = document.getElementById('portal-contact');

// Traverse setup
let traverseTicking = false;
let isTraverseVisible = false;
let cards = null;

if (traverseSection) {
    cards = traverseSection.querySelectorAll('.traverse-card');

    const traverseObserver = new IntersectionObserver((entries) => {
        isTraverseVisible = entries[0].isIntersecting;
    }, { rootMargin: '1000px 0px' });
    traverseObserver.observe(traverseSection);

    // Initial calculation
    updateTraverse();
}

// Portal setup
let portalTicking = false;
let isPortalVisible = false;
let portalWrapper = null;
let portalContent = null;

if (portalSection) {
    portalWrapper = portalSection.querySelector('.portal-wrapper');
    portalContent = portalSection.querySelector('.portal-content');

    const portalObserver = new IntersectionObserver((entries) => {
        isPortalVisible = entries[0].isIntersecting;
    }, { rootMargin: '1000px 0px' });
    portalObserver.observe(portalSection);

    updatePortal();
}

function updateTraverse() {
    const windowHeight = window.innerHeight;
    const rect = traverseSection.getBoundingClientRect();
    const scrollable = traverseSection.offsetHeight - windowHeight;

    let rawProgress = -rect.top / scrollable;
    rawProgress = Math.max(0, Math.min(1, rawProgress));

    // Staircase progress: create a "pause" plateau at each card's readable state.
    // Each card gets an equal segment of the raw scroll. Within each segment:
    //   - First 30%: smooth transition IN (cubic ease)
    //   - Middle 40%: flat plateau (card is perfectly readable, progress frozen)
    //   - Last 30%: smooth transition OUT (cubic ease)
    const cardCount = cards.length;
    const n = cardCount;
    const segmentSize = 1 / n; // Each card owns 1/n of the total scroll

    // Map raw linear progress → staircase progress with plateaus
    const segmentIndex = Math.min(Math.floor(rawProgress / segmentSize), n - 1);
    const segmentProgress = (rawProgress - segmentIndex * segmentSize) / segmentSize;

    const transIn = 0.30;  // 30% transition in
    const plateau = 0.40;  // 40% readable pause
    const transOut = 0.30;  // 30% transition out

    let mappedSegmentValue;
    if (segmentProgress <= transIn) {
        // Ease-in: cubic from 0 → 1 over the transition-in zone
        const t = segmentProgress / transIn;
        mappedSegmentValue = t * t * (3 - 2 * t); // smoothstep
    } else if (segmentProgress <= transIn + plateau) {
        // Plateau: frozen at 1 (card is fully readable)
        mappedSegmentValue = 1;
    } else {
        // Ease-out: cubic from 1 → 2 over the transition-out zone
        const t = (segmentProgress - transIn - plateau) / transOut;
        mappedSegmentValue = 1 + t * t * (3 - 2 * t);
    }

    // Final progress maps each card from index 0 to (n-1)
    const progress = (segmentIndex + mappedSegmentValue * 0.5) / (n - 1 || 1);
    const clampedProgress = Math.max(0, Math.min(1, progress));

    for (let i = 0; i < cardCount; i++) {
        const card = cards[i];
        const diff = (clampedProgress * (cardCount - 1)) - i;
        const absDiff = Math.abs(diff);

        let scale, opacity, zIndex, blur;

        if (diff > 0) {
            const pastDiff = Math.max(0, diff - 0.15);
            scale = 1 + Math.pow(pastDiff, 2.5) * 15;
            opacity = 1 - (pastDiff * 4);
            blur = Math.min(pastDiff * 25, 12);
            zIndex = cardCount - i + 10;
        } else {
            const comingDiff = Math.max(0, absDiff - 0.15);
            scale = Math.max(0.01, 1 - Math.pow(comingDiff, 1.2) * 0.4);
            opacity = 1 - (comingDiff * 1.5);
            blur = Math.min(comingDiff * 8, 12);
            zIndex = cardCount - i;
        }

        opacity = Math.max(0, Math.min(1, opacity));

        if (opacity <= 0.01) {
            card.style.visibility = 'hidden';
        } else {
            card.style.visibility = 'visible';
            card.style.transform = `scale(${scale})`;
            card.style.opacity = opacity;
            card.style.zIndex = zIndex;
            card.style.filter = `blur(${Math.max(0, blur)}px) brightness(${Math.max(0.1, 1 - absDiff * 0.8)})`;
        }
    }
}

function updatePortal() {
    const rect = portalSection.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    let progress = (windowHeight - rect.top) / windowHeight;
    progress = Math.max(0, Math.min(1, progress - 0.2));

    const easedProgress = Math.pow(progress, 2);
    const rotateX = easedProgress * 75;
    const scale = 1 - (easedProgress * 0.2);

    portalWrapper.style.transform = `rotateX(${rotateX}deg) scale(${scale})`;

    if (progress > 0.8) {
        portalContent.classList.add('active');
    } else {
        portalContent.classList.remove('active');
    }
}

// ─── Consolidated scroll listener ───
window.addEventListener('scroll', () => {
    if (isTraverseVisible && !traverseTicking) {
        requestAnimationFrame(() => {
            updateTraverse();
            traverseTicking = false;
        });
        traverseTicking = true;
    }
    if (isPortalVisible && !portalTicking) {
        requestAnimationFrame(() => {
            updatePortal();
            portalTicking = false;
        });
        portalTicking = true;
    }
}, { passive: true });

// ─── Consolidated resize listener ───
window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
        if (traverseSection) updateTraverse();
        if (portalSection) updatePortal();
    });
}, { passive: true });

// ─── Card Mouse Tracking for Glow Effect ───
document.querySelectorAll('.bento-card, .traverse-card').forEach(card => {
    let mouseTicking = false;
    card.addEventListener('mousemove', e => {
        if (!mouseTicking) {
            requestAnimationFrame(() => {
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                mouseTicking = false;
            });
            mouseTicking = true;
        }
    });
});
