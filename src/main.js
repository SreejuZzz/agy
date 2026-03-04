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

function animate() {
    tick += tickSpeed;

    // Tick always updates
    document.documentElement.style.setProperty('--animation-tick', tick.toString());

    // Only update and write Ring DOM properties if the ring is physically moving to the mouse
    if (Math.abs(ringX - mouseX) > 0.1 || Math.abs(ringY - mouseY) > 0.1) {
        ringX = lerp(ringX, mouseX, 0.012);
        ringY = lerp(ringY, mouseY, 0.012);

        // Round precision to 1 decimal to avoid microscopic float updates
        let roundRingX = Math.round(ringX * 10) / 10;
        let roundRingY = Math.round(ringY * 10) / 10;

        if (roundRingX !== lastRingX) {
            document.documentElement.style.setProperty('--ring-x', roundRingX.toString());
            lastRingX = roundRingX;
        }
        if (roundRingY !== lastRingY) {
            document.documentElement.style.setProperty('--ring-y', roundRingY.toString());
            lastRingY = roundRingY;
        }
    }

    // Only update and write Mouse DOM properties when cursor actively moves
    if (mouseX !== lastMouseX) {
        document.documentElement.style.setProperty('--mouse-x-instant', mouseX.toString());
        lastMouseX = mouseX;
    }
    if (mouseY !== lastMouseY) {
        document.documentElement.style.setProperty('--mouse-y-instant', mouseY.toString());
        lastMouseY = mouseY;
    }

    requestAnimationFrame(animate);
}

// Mouse Tracking for Interaction - Set to passive for performance
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
}, { passive: true });

animate();

// Unused Demo code removed to save payload

// Theme Toggle Logic
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        // Optional: Save preference to localStorage
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
}
