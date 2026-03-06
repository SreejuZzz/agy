import './styles/tokens.css';
import './styles/main.css';

// Register Paint Worklet
if ('paintWorklet' in CSS) {
    // Remove development cache bypass for production performance
    CSS.paintWorklet.addModule(new URL('./particle-worklet.js', import.meta.url));
}

// Animation Loop for Particles
let tick = 0;
const tickSpeed = 0.3;

// State for Ring Position
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;

// Caching values to avoid redundant CSS variable DOM writes
let lastMouseX = -1;
let lastMouseY = -1;
let lastRingX = -1;
let lastRingY = -1;

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

const particlesBg = document.querySelector('.particles-bg');

function animate() {
    tick += tickSpeed;

    if (particlesBg) {
        // Tick always updates
        particlesBg.style.setProperty('--animation-tick', tick.toString());

        // Only update and write Ring DOM properties if the ring is physically moving to the mouse
        if (Math.abs(ringX - mouseX) > 0.1 || Math.abs(ringY - mouseY) > 0.1) {
            ringX = lerp(ringX, mouseX, 0.012);
            ringY = lerp(ringY, mouseY, 0.012);

            // Round precision to 1 decimal to avoid microscopic float updates
            let roundRingX = Math.round(ringX * 10) / 10;
            let roundRingY = Math.round(ringY * 10) / 10;

            if (roundRingX !== lastRingX) {
                particlesBg.style.setProperty('--ring-x', roundRingX.toString());
                lastRingX = roundRingX;
            }
            if (roundRingY !== lastRingY) {
                particlesBg.style.setProperty('--ring-y', roundRingY.toString());
                lastRingY = roundRingY;
            }
        }

        // Only update and write Mouse DOM properties when cursor actively moves
        if (mouseX !== lastMouseX) {
            particlesBg.style.setProperty('--mouse-x-instant', mouseX.toString());
            lastMouseX = mouseX;
        }
        if (mouseY !== lastMouseY) {
            particlesBg.style.setProperty('--mouse-y-instant', mouseY.toString());
            lastMouseY = mouseY;
        }
    }

    requestAnimationFrame(animate);
}

// Mouse Tracking for Interaction - Set to passive for performance
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
}, { passive: true });

animate();


// Theme Toggle Logic
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', (e) => {
        const isDark = !document.body.classList.contains('light-mode');

        // Target colors based on our design tokens
        const oldColor = isDark ? '#050505' : '#e0e0e0';
        const targetColor = isDark ? '#e0e0e0' : '#050505';

        // Get the accurate center position of the theme button
        const rect = themeBtn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // Calculate the distance to the furthest corner
        const endRadius = Math.hypot(
            Math.max(x, innerWidth - x),
            Math.max(y, innerHeight - y)
        );

        // Create the ripple DOM element
        const ripple = document.createElement('div');
        ripple.className = 'theme-ripple';

        // The expanding ripple color should be the target mode's background
        ripple.style.backgroundColor = targetColor;
        document.body.appendChild(ripple);

        // Lock the body background to the old color so it doesn't instantly jump
        document.body.style.backgroundColor = oldColor;

        // Toggle the theme class *now* so text variables start their smooth CSS transitions immediately
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');

        // Since the ripple covers the screen in the *new* color, 
        // we start it at 0px and grow it.
        const animation = ripple.animate(
            [
                { clipPath: `circle(0px at ${x}px ${y}px)` },
                { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }
            ],
            {
                duration: 800,
                easing: 'ease-in-out',
                fill: 'forwards'
            }
        );

        // Wait for the ripple to fully cover the screen, then instantly swap the 
        // real background/theme underneath, and remove the ripple.
        animation.onfinish = () => {
            document.body.style.backgroundColor = ''; // Unlock fallback bg
            ripple.remove();
        };
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
}

// Z-Axis Experience Scroll
const traverseSection = document.getElementById('experience');
if (traverseSection) {
    const cards = traverseSection.querySelectorAll('.traverse-card');

    const updateTraverse = () => {
        // Cache window height to avoid layout thrashing
        const windowHeight = window.innerHeight;
        const rect = traverseSection.getBoundingClientRect();
        // Scrollable area = total height minus one viewport
        const scrollable = traverseSection.offsetHeight - windowHeight;

        // Progress from 0 to 1
        let progress = -rect.top / scrollable;
        progress = Math.max(0, Math.min(1, progress));

        cards.forEach((card, index) => {
            const diff = (progress * (cards.length - 1)) - index;
            const absDiff = Math.abs(diff);

            let scale, opacity, zIndex, blur;

            if (diff > 0) {
                // Card has been scrolled PAST
                // Create a "dead zone" of 0.15 where the card remains perfectly still and readable
                const pastDiff = Math.max(0, diff - 0.15);
                scale = 1 + Math.pow(pastDiff, 2.5) * 15;
                opacity = 1 - (pastDiff * 4); // Fade out extremely fast once it leaves the dead zone
                blur = Math.min(pastDiff * 25, 12);
                zIndex = cards.length - index + 10;
            } else {
                // Card is coming BEHIND from the distance
                const comingDiff = Math.max(0, absDiff - 0.15);
                scale = Math.max(0.01, 1 - Math.pow(comingDiff, 1.2) * 0.4);
                // Heavy fade so background cards do not bleed through the glass
                opacity = 1 - (comingDiff * 1.5);
                blur = Math.min(comingDiff * 8, 12);
                zIndex = cards.length - index;
            }

            opacity = Math.max(0, Math.min(1, opacity));

            // CRITICAL PERFORMANCE FIX: Stop rendering elements that are fully invisible.
            if (opacity <= 0.01) {
                card.style.visibility = 'hidden';
            } else {
                card.style.visibility = 'visible';
                card.style.transform = `scale(${scale})`;
                card.style.opacity = opacity;
                card.style.zIndex = zIndex;
                card.style.filter = `blur(${Math.max(0, blur)}px) brightness(${Math.max(0.1, 1 - absDiff * 0.8)})`;
            }
        });
    };

    let traverseTicking = false;
    let isTraverseVisible = false;

    const traverseObserver = new IntersectionObserver((entries) => {
        isTraverseVisible = entries[0].isIntersecting;
    }, { rootMargin: '1000px 0px' });

    traverseObserver.observe(traverseSection);

    window.addEventListener('scroll', () => {
        if (!isTraverseVisible) return;

        if (!traverseTicking) {
            window.requestAnimationFrame(() => {
                updateTraverse();
                traverseTicking = false;
            });
            traverseTicking = true;
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        window.requestAnimationFrame(updateTraverse);
    }, { passive: true });

    // Initial calculation
    updateTraverse();
}

// Card Mouse Tracking for Glow Effect
document.querySelectorAll('.bento-card, .traverse-card').forEach(card => {
    let mouseTicking = false;
    card.addEventListener('mousemove', e => {
        if (!mouseTicking) {
            window.requestAnimationFrame(() => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
                mouseTicking = false;
            });
            mouseTicking = true;
        }
    });
});

// Igloo.inc 3D Rays Portal Animation
const portalSection = document.getElementById('portal-contact');
if (portalSection) {
    const portalWrapper = portalSection.querySelector('.portal-wrapper');
    const portalContent = portalSection.querySelector('.portal-content');

    const updatePortal = () => {
        const rect = portalSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Start animating when the portal comes into view
        // The portal is 150vh, we animate over the top 50vh scroll
        let progress = (windowHeight - rect.top) / windowHeight;
        progress = Math.max(0, Math.min(1, progress - 0.2)); // Delay start slightly

        // Cubic easing for the "flop down" effect
        const easedProgress = Math.pow(progress, 2);

        // Rotate from 0 (facing camera) to 75deg (flat pedestal)
        const rotateX = easedProgress * 75;
        // Scale down slightly as it lays flat to give depth
        const scale = 1 - (easedProgress * 0.2);

        portalWrapper.style.transform = `rotateX(${rotateX}deg) scale(${scale})`;

        // Fade in the links when the portal has fully laid down (progress > 0.8)
        if (progress > 0.8) {
            portalContent.classList.add('active');
        } else {
            portalContent.classList.remove('active');
        }
    };

    let portalTicking = false;
    let isPortalVisible = false;

    const portalObserver = new IntersectionObserver((entries) => {
        isPortalVisible = entries[0].isIntersecting;
    }, { rootMargin: '1000px 0px' });

    portalObserver.observe(portalSection);

    window.addEventListener('scroll', () => {
        if (!isPortalVisible) return;

        if (!portalTicking) {
            window.requestAnimationFrame(() => {
                updatePortal();
                portalTicking = false;
            });
            portalTicking = true;
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        window.requestAnimationFrame(updatePortal);
    }, { passive: true });
    updatePortal();
}
