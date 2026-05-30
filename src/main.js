import './styles/tokens.css';
import './styles/main.css';
import './styles/loader-about.css';
import { AntigravityParticles } from './antigravity-particles.js';

// Reveal the document once main JS and styles have loaded
document.documentElement.style.visibility = 'visible';

// ─── Antigravity.google WebGL Particle System ───
const particlesContainer = document.querySelector('.particles-bg');
if (particlesContainer) {
    const isMobile = window.innerWidth <= 768;
    const particles = new AntigravityParticles(particlesContainer, {
        theme:            'dark',  // always use the vivid dark palette
        density:          isMobile ? 65 : 246,    // Optimized for mobile WebGL performance
        particlesScale:   isMobile ? 1.5 : 0.75,   // scaled up for crisp visibility on mobile
        cameraZoom:       isMobile ? 3.5 : 3.1,    // zoom out slightly on mobile so the ring fits perfectly on the screen
        ringWidth:        isMobile ? 0.20 : 0.15,  // wider ring on mobile to stand out
        ringWidth2:       isMobile ? 0.08 : 0.05,
        ringDisplacement: isMobile ? 0.20 : 0.15,
        interactive:      true,   // ring follows mouse cursor / touch
    });


    // Same vivid blue-violet gradient in both light AND dark mode
    // No theme sync needed for colors — palette is identical in both modes

    // ── Smooth scroll-based fade: particles visible only on hero ─────────────
    // Maps the hero's exit progress linearly to canvas opacity for pixel-perfect
    // smoothness — no threshold jumps, no CSS transition delays.
    const heroSection = document.getElementById('home');
    if (heroSection) {
        // Fade starts when hero bottom is 80 % of viewport height from top,
        // and completes when hero bottom reaches 20 % of viewport height.
        const FADE_START = 0.80; // fraction of vh — hero bottom crossing this triggers fade
        const FADE_END   = 0.20; // fraction of vh — fully transparent here

        let rafId = null;

        const updateParticleOpacity = () => {
            rafId = null;
            const rect   = heroSection.getBoundingClientRect();
            const vh     = window.innerHeight;

            // heroBottom as a 0→1 fraction of viewport height (1 = at bottom edge, 0 = at top)
            const heroBottom = rect.bottom / vh;

            let opacity;
            if (heroBottom >= FADE_START) {
                opacity = 1;  // hero fully (or mostly) visible — full opacity
            } else if (heroBottom <= FADE_END) {
                opacity = 0;  // hero has scrolled well past — fully hidden
            } else {
                // Linear interpolation between FADE_START and FADE_END
                opacity = (heroBottom - FADE_END) / (FADE_START - FADE_END);
            }

            particlesContainer.style.opacity = opacity;
        };

        const onScroll = () => {
            if (!rafId) rafId = requestAnimationFrame(updateParticleOpacity);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        // Run once on load so initial state is correct
        updateParticleOpacity();
    }
}


// ─── Nav: scroll-state pill glow ───
const mainHeader = document.querySelector('.main-header');
if (mainHeader) {
    const onNavScroll = () => mainHeader.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onNavScroll, { passive: true });
    onNavScroll();
}

// ─── Nav: active-section link highlight ───
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
const pageSections = [...navAnchors]
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

if (pageSections.length) {
    const sectionObserver = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navAnchors.forEach(a =>
                        a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`)
                    );
                }
            });
        },
        { threshold: 0.5 }
    );
    pageSections.forEach(s => sectionObserver.observe(s));
}



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

// ─── Theme Toggle with Circular Clip-Path Transition ───
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', (event) => {
        const isDark = !document.body.classList.contains('light-mode');
        const nextTheme = isDark ? 'light' : 'dark';

        // Detect support for View Transitions and prefers-reduced-motion preference
        const useTransition = document.startViewTransition && 
            !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!useTransition) {
            // Non-supporting browsers utilize ultra-smooth GPU-accelerated CSS color transitions
            document.body.classList.toggle('light-mode');
            localStorage.setItem('theme', nextTheme);
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

        // Feed coordinates into CSS Custom Properties
        document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
        document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);
        document.documentElement.style.setProperty('--theme-toggle-r', `${endRadius}px`);

        // Disable standard transitions during theme switch to prevent reflow lag
        document.documentElement.classList.add('switching-theme');

        const transition = document.startViewTransition(() => {
            document.body.classList.toggle('light-mode');
            localStorage.setItem('theme', nextTheme);
        });

        // Clean up once transition is finished
        transition.finished.finally(() => {
            document.documentElement.classList.remove('switching-theme');
        });
    });

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
}


// ─── Card Mouse Tracking for Glow Effect ───
document.addEventListener('mousemove', e => {
    const card = e.target.closest('.card, .project-card, .bento-card, .traverse-card, .skill-group');
    if (!card) return;

    if (!card._rectCache || e.timeStamp - (card._rectTime || 0) > 500) {
        card._rectCache = card.getBoundingClientRect();
        card._rectTime = e.timeStamp;
    }

    const rect = card._rectCache;
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
}, { passive: true });


// ─── DevOps Console: Experience Timeline ───
const MILESTONE_DATA = [
    {
        command: 'cat /var/log/career/synnefo-senior.log',
        lines: [
            { type: 'info', text: '╔══════════════════════════════════════════════╗' },
            { type: 'info', text: '║  Synnefo Solutions, Ernakulam                ║' },
            { type: 'info', text: '║  Role: Senior DevOps Engineer                ║' },
            { type: 'info', text: '║  Period: 2025 — Present                      ║' },
            { type: 'info', text: '╚══════════════════════════════════════════════╝' },
            { type: 'output', text: '' },
            { type: 'success', text: '✓ Leading cloud architecture & DevOps strategy' },
            { type: 'success', text: '✓ Managing multi-region AWS infrastructure at scale' },
            { type: 'success', text: '✓ CI/CD orchestration: Jenkins, GitHub Actions' },
            { type: 'success', text: '✓ Kubernetes cluster management (production)' },
            { type: 'success', text: '✓ Terraform IaC across 20+ AWS accounts' },
            { type: 'success', text: '✓ 99.99% uptime SLA for critical services' },
            { type: 'output', text: '' },
            { type: 'output', text: 'Stack: AWS | K8s | Terraform | Docker | Jenkins' },
            { type: 'output', text: '       Prometheus | Grafana | Ansible | ArgoCD' },
        ]
    },
    {
        command: 'cat /var/log/career/synnefo-jr-devops.log',
        lines: [
            { type: 'info', text: '╔══════════════════════════════════════════════╗' },
            { type: 'info', text: '║  Synnefo Solutions, Ernakulam                ║' },
            { type: 'info', text: '║  Role: Junior DevOps Engineer                ║' },
            { type: 'info', text: '║  Period: 2024 — 2025                         ║' },
            { type: 'info', text: '╚══════════════════════════════════════════════╝' },
            { type: 'output', text: '' },
            { type: 'success', text: '✓ Built and maintained CI/CD pipelines' },
            { type: 'success', text: '✓ Containerised legacy applications using Docker' },
            { type: 'success', text: '✓ Set up monitoring with Prometheus & Grafana' },
            { type: 'success', text: '✓ Automated infrastructure provisioning with Ansible' },
            { type: 'success', text: '✓ Supported Kubernetes workload migrations' },
            { type: 'output', text: '' },
            { type: 'output', text: 'Stack: Docker | Ansible | Prometheus | Grafana' },
            { type: 'output', text: '       Jenkins | AWS | Git | Linux' },
        ]
    },
    {
        command: 'cat /var/log/career/synnefo-cloud-eng.log',
        lines: [
            { type: 'info', text: '╔══════════════════════════════════════════════╗' },
            { type: 'info', text: '║  Synnefo Solutions, Ernakulam                ║' },
            { type: 'info', text: '║  Role: Cloud Engineer                        ║' },
            { type: 'info', text: '║  Period: 2022 — 2024                         ║' },
            { type: 'info', text: '╚══════════════════════════════════════════════╝' },
            { type: 'output', text: '' },
            { type: 'success', text: '✓ Designed HA architectures (multi-AZ, auto-scaling)' },
            { type: 'success', text: '✓ Led 20+ zero-downtime cloud migrations' },
            { type: 'success', text: '✓ Deployed and managed EC2, RDS, S3, VPC, IAM' },
            { type: 'success', text: '✓ Reduced infra costs by 40% via right-sizing' },
            { type: 'output', text: '' },
            { type: 'output', text: 'Stack: AWS | GCP | Terraform | CloudFormation' },
        ]
    },
    {
        command: 'cat /var/log/career/synnefo-linux-admin.log',
        lines: [
            { type: 'info',    text: '╔══════════════════════════════════════════════╗' },
            { type: 'info',    text: '║  Synnefo Solutions, Ernakulam                ║' },
            { type: 'info',    text: '║  Role: Linux Administrator                   ║' },
            { type: 'info',    text: '║  Period: January 2020 — 2022                 ║' },
            { type: 'info',    text: '╚══════════════════════════════════════════════╝' },
            { type: 'output',  text: '' },
            { type: 'success', text: '✓ Managed 100+ bare-metal & VM Linux servers' },
            { type: 'success', text: '✓ Configured SELinux, iptables & fail2ban' },
            { type: 'success', text: '✓ Automated provisioning with Bash & Ansible' },
            { type: 'success', text: '✓ Built custom monitoring with Nagios + Bash' },
            { type: 'success', text: '✓ Reduced deployment time by 70% via scripting' },
            { type: 'output',  text: '' },
            { type: 'output',  text: 'Stack: RHEL | CentOS | Bash | Ansible | Nagios' },
        ]
    },
    {
        command: 'cat /var/log/career/sdc-networks.log',
        lines: [
            { type: 'info',    text: '╔══════════════════════════════════════════════╗' },
            { type: 'info',    text: '║  SDC Networks, Kaloor                        ║' },
            { type: 'info',    text: '║  Role: Network Administrator                 ║' },
            { type: 'info',    text: '║  Period: 2018 — 2020                         ║' },
            { type: 'info',    text: '╚══════════════════════════════════════════════╝' },
            { type: 'output',  text: '' },
            { type: 'success', text: '✓ Managed routers, switches, firewalls & VPNs' },
            { type: 'success', text: '✓ Built deep troubleshooting skills for L2/L3' },
            { type: 'success', text: '✓ Maintained LAN/WAN infrastructure & cabling' },
            { type: 'success', text: '✓ Network monitoring & incident response' },
            { type: 'success', text: '✓ Configured VLANs, QoS & security policies' },
            { type: 'output',  text: '' },
            { type: 'output',  text: 'Stack: Cisco | MikroTik | pfSense | Wireshark' },
            { type: 'output',  text: '       VLAN | VPN | BGP | OSPF | iptables' },
        ]
    }
];

const terminalOutput = document.getElementById('terminal-output');
const timelineNodes = document.querySelectorAll('.timeline-node');
let currentTypingTimeout = null;
let typingTimeouts = [];

function clearTyping() {
    typingTimeouts.forEach(t => clearTimeout(t));
    typingTimeouts = [];
}

function typeTerminalLines(milestone) {
    clearTyping();
    if (!terminalOutput) return;

    const data = MILESTONE_DATA[milestone];
    if (!data) return;

    // Clear terminal
    terminalOutput.innerHTML = '';

    // Add command prompt
    const cmdLine = document.createElement('div');
    cmdLine.className = 'terminal-line';
    cmdLine.innerHTML = `<span class="prompt">$</span> <span class="cmd">${data.command}</span>`;
    terminalOutput.appendChild(cmdLine);

    // Type out each line with a staggered delay
    data.lines.forEach((line, i) => {
        const timeout = setTimeout(() => {
            const lineEl = document.createElement('div');
            lineEl.className = 'terminal-line';

            if (line.text === '') {
                lineEl.innerHTML = '&nbsp;';
            } else {
                lineEl.innerHTML = `<span class="${line.type}">${escapeHtml(line.text)}</span>`;
            }

            terminalOutput.appendChild(lineEl);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;

            // Add blinking cursor on last line
            if (i === data.lines.length - 1) {
                const cursorLine = document.createElement('div');
                cursorLine.className = 'terminal-line terminal-cursor-blink';
                cursorLine.innerHTML = '<span class="prompt">$</span> ';
                terminalOutput.appendChild(cursorLine);
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
            }
        }, 60 + i * 55);
        typingTimeouts.push(timeout);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initialize timeline
if (timelineNodes.length > 0 && terminalOutput) {
    timelineNodes.forEach(node => {
        node.addEventListener('click', () => {
            // Update active state
            timelineNodes.forEach(n => n.classList.remove('active'));
            node.classList.add('active');

            const milestone = parseInt(node.dataset.milestone, 10);
            typeTerminalLines(milestone);
        });
    });

    // Auto-type the first milestone on load
    typeTerminalLines(0);
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

function typeContactTerminal(lines) {
    if (!contactTerminal) return;
    contactTerminal.innerHTML = '';

    lines.forEach((line, i) => {
        const timeout = setTimeout(() => {
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
                        submitBtn.querySelector('.btn-text').textContent = 'Deploy Message';
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
            { type: 'success', text: '✓ Route validated: smtp-gateway.sreejith.cloud' },
            { type: 'output', text: 'Provisioning message container...' },
            { type: 'success', text: '✓ Container deployed: msg-relay-pod-7x3k2' },
            { type: 'output', text: 'Encrypting payload with TLS 1.3...' },
            { type: 'success', text: '✓ Payload encrypted and sealed' },
            { type: 'output', text: 'Deploying to message queue...' },
            { type: 'success', text: '✓ Message successfully deployed!' },
            { type: 'output', text: '' },
            { type: 'info', text: '📬 Thank you! I\'ll respond within 24 hours.' },
        ]);

        // Show success on button
        setTimeout(() => {
            submitBtn.classList.remove('loading');
            submitBtn.classList.add('success');
            submitBtn.querySelector('.btn-text').textContent = '✓ Deployed';
            contactForm.reset();
        }, 1400);
    });
}

// ─── Skills Section ───────────────────────────────────────────────────────────
// Edit this data to update your skills in the future.
const SKILLS_DATA = [
    {
        category: 'Cloud & Infrastructure',
        icon: '☁️',
        skills: ['AWS EC2', 'AWS S3', 'AWS VPC', 'AWS RDS', 'AWS IAM', 'AWS CloudWatch', 'Route 53', 'EKS', 'AWS SAA']
    },
    {
        category: 'DevOps & CI/CD',
        icon: '🔁',
        skills: ['Kubernetes', 'Docker', 'Jenkins', 'GitHub Actions', 'ArgoCD', 'Terraform', 'Ansible', 'Helm']
    },
    {
        category: 'Monitoring & Security',
        icon: '📊',
        skills: ['Prometheus', 'Grafana', 'Nagios', 'ELK Stack', 'fail2ban', 'SELinux', 'iptables', 'pfSense']
    },
    {
        category: 'OS & Networking',
        icon: '🖧',
        skills: ['RHEL', 'CentOS', 'Ubuntu', 'Cisco', 'MikroTik', 'VLAN', 'VPN', 'BGP', 'OSPF', 'Wireshark']
    },
    {
        category: 'Scripting & Automation',
        icon: '⚙️',
        skills: ['Bash', 'Shell Script', 'Python', 'YAML', 'JSON', 'Makefile', 'Cron', 'Systemd']
    },
    {
        category: 'Certifications',
        icon: '🏅',
        skills: ['RHCSA (#250-136-470)', 'AWS SAA (Apr 2026)']
    }
];

function renderSkills() {
    const grid = document.getElementById('skills-grid');
    if (!grid) return;

    SKILLS_DATA.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'skill-group';

        groupEl.innerHTML = `
            <div class="skill-group-header">
                <span class="skill-group-icon" aria-hidden="true">${group.icon}</span>
                <h3 class="skill-group-title">${group.category}</h3>
            </div>
            <div class="skill-tags">
                ${group.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
            </div>
        `;
        grid.appendChild(groupEl);
    });
}

renderSkills();

// ════════════════════════════════════════════════════════════════════
// IGLOO-INSPIRED ABOUT  ·  www.igloo.inc
// Ice particle constellation canvas, digital text scramble decrypt,
// and coordinated viewport transitions.
// ════════════════════════════════════════════════════════════════════
(function initIglooAbout() {
    const section  = document.querySelector('.beagle-about');
    if (!section) return;

    const rule     = document.getElementById('ba-rule');
    const baCanvas = document.getElementById('ba-canvas');
    const statNums = document.querySelectorAll('.ba-stat-num');
    const statsRow = document.querySelector('.ba-stats');

    const heroBlock  = document.getElementById('ba-hero');
    const cardsBlock = document.getElementById('ba-cards');
    const statsBlock = document.getElementById('ba-stats');
    const approachBlock = document.getElementById('ba-approach');

    // ── Digital Text Scramble Decrypt Engine ───────────────────────────
    const SCRAMBLE_CHARS = "01[]|_x+&%$#@!~?*";

    function scrambleText(el, delay = 0) {
        if (el.dataset.scrambling === "true") return;
        el.dataset.scrambling = "true";

        const originalText = el.textContent;
        const length = originalText.length;
        let frame = 0;
        const maxFrames = 25; // ~400ms at 60fps

        setTimeout(() => {
            (function tick() {
                let currentText = "";
                for (let i = 0; i < length; i++) {
                    if (originalText[i] === " " || originalText[i] === "\n") {
                        currentText += originalText[i];
                        continue;
                    }
                    const revealProgress = frame / maxFrames;
                    if (i / length < revealProgress) {
                        currentText += originalText[i];
                    } else {
                        currentText += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                    }
                }
                el.textContent = currentText;

                if (frame < maxFrames) {
                    frame++;
                    requestAnimationFrame(tick);
                } else {
                    el.textContent = originalText;
                    el.dataset.scrambling = "false";
                }
            })();
        }, delay);
    }

    // ── Stat Counters ──────────────────────────────────────────────────
    let counted = false;
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

    function countUp(el, target, ms, delay) {
        setTimeout(() => {
            const t0 = performance.now();
            (function tick(now) {
                const p = Math.min((now - t0) / ms, 1);
                el.textContent = Math.round(easeOutQuart(p) * target);
                if (p < 1) requestAnimationFrame(tick);
                else el.textContent = target;
            })(performance.now());
        }, delay);
    }

    // ── Coordinated Scroll Entrance Observers ───────────────────────────
    const entryObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;

                if (target === heroBlock && !target.classList.contains('visible')) {
                    target.classList.add('visible');
                    
                    // Trigger text scrambles
                    const eyebrow = target.querySelector('.ba-eyebrow');
                    if (eyebrow) scrambleText(eyebrow, 0);

                    const lines = target.querySelectorAll('.ba-hl-line');
                    lines.forEach((line, i) => scrambleText(line, 150 + i * 120));

                    const subParts = target.querySelectorAll('.ba-sub-part');
                    subParts.forEach((part, i) => scrambleText(part, 350 + i * 150));

                    // Charge neon rule
                    setTimeout(() => rule && rule.classList.add('charged'), 600);
                }

                if (target === cardsBlock && !target.classList.contains('visible')) {
                    target.classList.add('visible');

                    const labels = target.querySelectorAll('.ba-card-label');
                    labels.forEach((label, i) => scrambleText(label, i * 200));
                }

                if (target === statsBlock && !target.classList.contains('visible')) {
                    target.classList.add('visible');

                    const labels = target.querySelectorAll('.ba-stat-lbl');
                    labels.forEach((label, i) => scrambleText(label, i * 150));

                    if (!counted) {
                        counted = true;
                        statNums.forEach((el, i) => {
                            scrambleText(el, i * 100);
                            countUp(el, parseInt(el.dataset.target, 10), 1600, i * 120);
                        });
                    }
                }

                if (target === approachBlock && !target.classList.contains('visible')) {
                    target.classList.add('visible');

                    const labels = target.querySelectorAll('.ba-card-label');
                    labels.forEach((label, i) => scrambleText(label, i * 150));

                    const title = target.querySelector('.ba-approach-title');
                    if (title) scrambleText(title, 200);
                }
            }
        });
    }, { threshold: 0.15 });

    if (heroBlock) entryObserver.observe(heroBlock);
    if (cardsBlock) entryObserver.observe(cardsBlock);
    if (statsBlock) entryObserver.observe(statsBlock);
    if (approachBlock) entryObserver.observe(approachBlock);

    // ── Hover Scramble Triggers ─────────────────────────────────────────
    document.querySelectorAll('.ba-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            const lbl = card.querySelector('.ba-card-label');
            if (lbl) scrambleText(lbl, 0);
        });
    });

    document.querySelectorAll('.ba-stat').forEach(stat => {
        stat.addEventListener('mouseenter', () => {
            const lbl = stat.querySelector('.ba-stat-lbl');
            if (lbl) scrambleText(lbl, 0);
        });
    });

    document.querySelectorAll('.ba-sub-part').forEach(part => {
        part.addEventListener('mouseenter', () => {
            scrambleText(part, 0);
        });
    });

    // ── Interactive Ice Particle Constellation Canvas ───────────────────
    if (!baCanvas) return;
    const ctx = baCanvas.getContext('2d');
    let W, H, particles, rafId;
    
    const isLightMode = () => document.body.classList.contains('light-mode');
    
    // Mouse tracker relative to canvas
    let mouse = { x: null, y: null, active: false };

    section.addEventListener('mousemove', (e) => {
        const rect = baCanvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
    }, { passive: true });

    section.addEventListener('mouseleave', () => {
        mouse.active = false;
    }, { passive: true });

    function resize() {
        W = baCanvas.width  = section.offsetWidth;
        H = baCanvas.height = section.offsetHeight;
    }

    function createParticles() {
        // Dynamic density adjustment based on screen width
        const count = W < 640 ? 45 : 125;
        return Array.from({ length: count }, () => {
            const baseVx = (Math.random() - 0.5) * 0.25;
            const baseVy = (Math.random() - 0.5) * 0.25;
            return {
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.8 + 0.6,
                vx: baseVx,
                vy: baseVy,
                baseVx: baseVx,
                baseVy: baseVy,
                charge: 0 // Velocity-responsive glow
            };
        });
    }

    function renderLoop() {
        ctx.clearRect(0, 0, W, H);
        const light = isLightMode();

        // Color profiles matching Igloo palettes
        const particleBaseColor = light ? [88, 96, 110] : [56, 62, 78];     // Muted steel / slate grey
        const particleActiveColor = light ? [0, 150, 199] : [0, 242, 254];   // Glowing ice-cyan
        const linkColor = light ? "rgba(0, 150, 199, " : "rgba(0, 242, 254, ";

        // 1. Physics update & drawing particles
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Restoring velocity parameters
            p.vx += (p.baseVx - p.vx) * 0.04;
            p.vy += (p.baseVy - p.vy) * 0.04;

            // Proximity parameters to cursor
            if (mouse.active) {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < 180) {
                    // Magnetic attraction/repulsion fluid loop
                    const force = (180 - dist) / 180;
                    const angle = Math.atan2(dy, dx);

                    // Pull particles closer to create dense nodes near the cursor
                    p.vx += Math.cos(angle) * force * 0.24;
                    p.vy += Math.sin(angle) * force * 0.24;
                    p.charge = Math.min(1, p.charge + 0.07);
                } else {
                    p.charge = Math.max(0, p.charge - 0.02);
                }
            } else {
                p.charge = Math.max(0, p.charge - 0.02);
            }

            // Boundary wrap-around
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            if (p.y > H + 10) p.y = -10;

            // Compute velocity-responsive color blending
            const r_c = Math.round(particleBaseColor[0] + (particleActiveColor[0] - particleBaseColor[0]) * p.charge);
            const g_c = Math.round(particleBaseColor[1] + (particleActiveColor[1] - particleBaseColor[1]) * p.charge);
            const b_c = Math.round(particleBaseColor[2] + (particleActiveColor[2] - particleBaseColor[2]) * p.charge);

            ctx.fillStyle = `rgb(${r_c}, ${g_c}, ${b_c})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 2. Proximity web linkages
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];

            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < 95) {
                    const alpha = ((95 - dist) / 95 * 0.13).toFixed(3);
                    ctx.strokeStyle = `${linkColor}${alpha})`;
                    ctx.lineWidth = 0.75;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }

            // Interactive linkages directly to cursor
            if (mouse.active) {
                const dxM = p1.x - mouse.x;
                const dyM = p1.y - mouse.y;
                const distM = Math.sqrt(dxM*dxM + dyM*dyM);

                if (distM < 150) {
                    const alphaM = ((150 - distM) / 150 * 0.16).toFixed(3);
                    ctx.strokeStyle = `${linkColor}${alphaM})`;
                    ctx.lineWidth = 0.9;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
        }

        rafId = requestAnimationFrame(renderLoop);
    }

    // Only run canvas animations while section is actively visible in viewport
    let canvasObserverActive = false;
    new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !canvasObserverActive) {
            canvasObserverActive = true;
            resize();
            particles = createParticles();
            baCanvas.classList.add('visible');
            rafId = requestAnimationFrame(renderLoop);
        } else if (!e.isIntersecting && canvasObserverActive) {
            cancelAnimationFrame(rafId);
            rafId = null;
            canvasObserverActive = false;
        }
    }, { threshold: 0.05 }).observe(section);

    window.addEventListener('resize', () => { 
        if (canvasObserverActive) {
            resize(); 
            particles = createParticles(); 
        }
    }, { passive: true });

})();


// ─── High-Performance Scroll Reveal Intersection Observer (for Mobile & Desktop) ───
(function initScrollReveal() {
    const elements = document.querySelectorAll(
        '.snap-section h2, .snap-section .section-subtitle, .snap-section .work-subtitle, .card, .project-card, .bento-card, .timeline-node, .experience, .social-link, .contact-form, .contact-terminal, .skills-grid, .traverse-card'
    );

    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Once revealed, unobserve to conserve mobile CPU cycles
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.08,               // Trigger when 8% is visible
        rootMargin: '0px 0px -40px 0px' // Reveal slightly before crossing screen line
    });

    elements.forEach(el => observer.observe(el));
})();


