import './styles/tokens.css';
import './styles/main.css';
import { AntigravityParticles } from './antigravity-particles.js';

// ─── Antigravity.google WebGL Particle System ───
const particlesContainer = document.querySelector('.particles-bg');
if (particlesContainer) {
    const isMobile = window.innerWidth <= 768;
    const particles = new AntigravityParticles(particlesContainer, {
        theme:            'dark',  // always use the vivid dark palette
        density:          isMobile ? 282 : 246,    // ~12% less than original (320/280)
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

// ═══════════════════════════════════════════════════════════════
// OPTION 2 — DEPTH CARD · About Section Interactions
// ═══════════════════════════════════════════════════════════════

(function initAboutSection() {
    const aboutSection  = document.getElementById('about');
    const mistEl        = document.getElementById('about-mist');
    const glassCard     = document.getElementById('about-glass-card');
    const chargeLine    = document.getElementById('about-charge-line');
    const statNumbers   = document.querySelectorAll('.stat-number');

    if (!aboutSection) return;

    // ── 1. Mist drifts with mouse (inside the section) ──────────
    let mistRaf = null;
    let targetMistX = 60, targetMistY = 40;
    let targetMistX2 = 30, targetMistY2 = 70;
    let currentMistX = 60, currentMistY = 40;
    let currentMistX2 = 30, currentMistY2 = 70;

    function lerpMist() {
        const ease = 0.045;
        currentMistX  += (targetMistX  - currentMistX)  * ease;
        currentMistY  += (targetMistY  - currentMistY)  * ease;
        currentMistX2 += (targetMistX2 - currentMistX2) * ease;
        currentMistY2 += (targetMistY2 - currentMistY2) * ease;

        if (mistEl) {
            mistEl.style.setProperty('--mist-x',  `${currentMistX.toFixed(2)}%`);
            mistEl.style.setProperty('--mist-y',  `${currentMistY.toFixed(2)}%`);
            mistEl.style.setProperty('--mist-x2', `${currentMistX2.toFixed(2)}%`);
            mistEl.style.setProperty('--mist-y2', `${currentMistY2.toFixed(2)}%`);
        }

        mistRaf = requestAnimationFrame(lerpMist);
    }
    mistRaf = requestAnimationFrame(lerpMist);

    document.addEventListener('mousemove', (e) => {
        const rect = aboutSection.getBoundingClientRect();
        // Only react while the about section is visible
        if (rect.top > window.innerHeight || rect.bottom < 0) return;

        const relX = ((e.clientX - rect.left) / rect.width)  * 100;
        const relY = ((e.clientY - rect.top)  / rect.height) * 100;

        targetMistX  = relX;
        targetMistY  = relY;
        targetMistX2 = 100 - relX * 0.7;
        targetMistY2 = 100 - relY * 0.6;
    }, { passive: true });

    // ── 2. Glass card 3D tilt flattens as section scrolls to centre ──
    function updateCardTilt() {
        if (!glassCard) return;
        const rect = aboutSection.getBoundingClientRect();
        const centre = rect.top + rect.height / 2;
        const viewCentre = window.innerHeight / 2;
        // -1 (top) → 0 (centre) → +1 (bottom)
        const progress = Math.max(-1, Math.min(1, (viewCentre - centre) / (rect.height * 0.6)));
        // Tilt from 6deg (entering from top) → 0deg (at centre) → -2deg (past centre)
        const tilt = progress < 0
            ? 6 * (1 + progress)      // 6 → 0 as it scrolls to centre
            : -2 * progress;           // 0 → -2 as it scrolls past

        glassCard.style.setProperty('--card-tilt', `${tilt.toFixed(2)}deg`);
        glassCard.style.transform = `perspective(900px) rotateX(${tilt.toFixed(2)}deg)`;
    }

    window.addEventListener('scroll', updateCardTilt, { passive: true });
    updateCardTilt(); // init

    // ── 3. Charge line fires when about section enters view ──────
    let chargeTriggered = false;
    const chargeObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !chargeTriggered) {
            chargeTriggered = true;
            // Small delay so the card entrance animation completes first
            setTimeout(() => {
                if (chargeLine) chargeLine.classList.add('charged');
            }, 600);
        }
    }, { threshold: 0.3 });

    if (aboutSection) chargeObserver.observe(aboutSection);

    // ── 4. Stat counter animation — counts up from 0 on enter ───
    let statsTriggered = false;

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function animateCounter(el, target, duration = 1400) {
        const start = performance.now();
        function tick(now) {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);
            const value = Math.round(easeOutQuart(t) * target);
            el.textContent = value;
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = target;
        }
        requestAnimationFrame(tick);
    }

    const statsObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !statsTriggered) {
            statsTriggered = true;
            statNumbers.forEach((el, i) => {
                const target = parseInt(el.dataset.target, 10);
                setTimeout(() => animateCounter(el, target, 1400), i * 120);
            });
        }
    }, { threshold: 0.4 });

    const statsRow = document.querySelector('.about-stats-row');
    if (statsRow) statsObserver.observe(statsRow);

})();
