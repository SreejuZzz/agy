import './styles/tokens.css';
import './styles/main.css';
import './styles/loader-about.css';
import { AntigravityParticles } from './antigravity-particles.js';
import { ExperienceScanner } from './devops-bg.js';
import gsap from 'gsap';

// Reveal the document once main JS and styles have loaded
document.documentElement.style.visibility = 'visible';

// Initialize Scanner Background just for the Experience section
const expSection = document.getElementById('experience');
if (expSection) {
    new ExperienceScanner(expSection);
}

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

            const body = codeContainer.closest('.yaml-manifest-body');
            if (body) body.scrollTop = body.scrollHeight;

            lineIdx++;
        } else {
            clearInterval(yamlTypingInterval);
            codeContainer.classList.remove('yaml-typing');
        }
    }, 25);
}

function updateFlowLines(milestone) {
    const connectors = document.querySelectorAll('.rack-connector');
    connectors.forEach((conn) => {
        const connIdx = parseInt(conn.dataset.connector, 10);
        if (connIdx < milestone) {
            conn.classList.add('active');
        } else {
            conn.classList.remove('active');
        }
    });
}

const EXP_SCRAMBLE_CHARS = "01[]|_x+&%$#@!~?*";
function scrambleExpText(el, text, delay = 0) {
    if (!el) return;
    el.textContent = "";
    let frame = 0;
    const maxFrames = 18; // 300ms at 60fps
    
    setTimeout(() => {
        (function tick() {
            let currentText = "";
            for (let i = 0; i < text.length; i++) {
                if (text[i] === " " || text[i] === "\n" || text[i] === "," || text[i] === "—") {
                    currentText += text[i];
                    continue;
                }
                const revealProgress = frame / maxFrames;
                if (i / text.length < revealProgress) {
                    currentText += text[i];
                } else {
                    currentText += EXP_SCRAMBLE_CHARS[Math.floor(Math.random() * EXP_SCRAMBLE_CHARS.length)];
                }
            }
            el.textContent = currentText;

            if (frame < maxFrames) {
                frame++;
                requestAnimationFrame(tick);
            } else {
                el.textContent = text;
            }
        })();
    }, delay);
}

let descriptionInterval = null;
function typewriterExpText(el, text, delay = 0, speed = 8) {
    if (!el) return;
    if (descriptionInterval) {
        clearInterval(descriptionInterval);
    }
    el.textContent = "";
    let i = 0;
    setTimeout(() => {
        descriptionInterval = setInterval(() => {
            if (i < text.length) {
                el.textContent += text[i];
                i++;
            } else {
                clearInterval(descriptionInterval);
            }
        }, speed);
    }, delay);
}

function countUpValue(el, targetVal, duration = 600) {
    if (!el) return;
    let start = 0;
    const startTime = performance.now();
    
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(start + progress * (targetVal - start));
        el.textContent = `${current}%`;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = `${targetVal}%`;
        }
    }
    requestAnimationFrame(update);
}

function initializeExperienceMapAnimation() {
    topoNodes.forEach((node, idx) => {
        const sysLabel = node.querySelector('.node-label-system');
        const roleLabel = node.querySelector('.node-label-role');
        const subLabel = node.querySelector('.node-label-sub');
        
        const mData = MILESTONE_DATA[parseInt(node.dataset.milestone, 10)];
        if (sysLabel) scrambleExpText(sysLabel, mData.company, idx * 100);
        if (roleLabel) scrambleExpText(roleLabel, mData.title, idx * 100 + 40);
        if (subLabel) scrambleExpText(subLabel, mData.period, idx * 100 + 80);
    });
}

function updateTelemetry(milestone) {
    const data = MILESTONE_DATA[milestone];
    if (!data) return;

    // Use GSAP timeline for staggered entry
    const tl = gsap.timeline();

    tl.to('.telemetry-panel', {
        opacity: 0.6,
        duration: 0.15,
        ease: 'power2.inOut',
        onComplete: () => {
            // Title / Company / Period (with glowing digital scramble decrypt)
            const titleEl = document.getElementById('inspector-title');
            const companyEl = document.getElementById('inspector-company');
            const periodEl = document.getElementById('inspector-period');
            
            if (titleEl) scrambleExpText(titleEl, data.title, 0);
            if (companyEl) scrambleExpText(companyEl, data.company, 60);
            if (periodEl) scrambleExpText(periodEl, data.period, 120);

            const descEl = document.getElementById('inspector-description');
            if (descEl) {
                typewriterExpText(descEl, data.description || '', 150, 8);
            }

            // System Status indicator
            const statusEl = document.getElementById('inspector-status');
            if (statusEl) {
                statusEl.className = `system-status status-${data.status}`;
                const indicator = statusEl.querySelector('.status-indicator');
                const text = statusEl.querySelector('.status-text');
                
                if (indicator) {
                    indicator.className = `status-indicator pulsing-${data.status === 'operational' || data.status === 'healthy' ? 'green' : 'yellow'}`;
                }
                if (text) {
                    text.textContent = `Status: ${data.status}`;
                }
            }

            // Gauge ring
            const gaugeFill = document.getElementById('sla-gauge-fill');
            const percentageText = document.getElementById('sla-percentage');
            if (percentageText) {
                countUpValue(percentageText, parseInt(data.efficiency, 10), 800);
            }
            
            if (gaugeFill) {
                const circumference = 213.6;
                const offset = circumference * (1 - parseFloat(data.efficiency) / 100);
                gaugeFill.style.strokeDashoffset = offset;
                
                // Color based on efficiency level
                const colors = ['#00f0ff', '#3b82f6', '#f59e0b', '#d946ef', '#00ff88'];
                gaugeFill.style.stroke = colors[milestone % colors.length];
            }

            // Focus Area sliders
            data.focusAreas.forEach((area, idx) => {
                const sliderName = document.getElementById(`comp-name-${idx}`);
                const sliderVal = document.getElementById(`comp-val-${idx}`);
                const sliderFill = document.getElementById(`comp-fill-${idx}`);
                
                if (sliderName) scrambleExpText(sliderName, area.name, 100 + idx * 40);
                if (sliderVal) countUpValue(sliderVal, area.val, 800);
                if (sliderFill) {
                    sliderFill.style.width = '0%';
                    setTimeout(() => {
                        sliderFill.style.width = `${area.val}%`;
                    }, 50);
                }
            });

            // Bento stats
            const label1 = document.getElementById('bento-label-1');
            const val1 = document.getElementById('metric-bento-scale');
            const label2 = document.getElementById('bento-label-2');
            const val2 = document.getElementById('metric-bento-highlight');
            
            if (label1) label1.textContent = data.bento1.label;
            if (val1) scrambleExpText(val1, data.bento1.val, 150);
            if (label2) label2.textContent = data.bento2.label;
            if (val2) scrambleExpText(val2, data.bento2.val, 200);

            // Scramble active node labels inside left pane to simulate live connection refresh
            const activeNode = document.querySelector(`.html-topo-node[data-milestone="${milestone}"]`);
            if (activeNode) {
                const sysLabel = activeNode.querySelector('.node-label-system');
                const roleLabel = activeNode.querySelector('.node-label-role');
                const subLabel = activeNode.querySelector('.node-label-sub');
                
                if (sysLabel) scrambleExpText(sysLabel, data.company, 0);
                if (roleLabel) scrambleExpText(roleLabel, data.title, 40);
                if (subLabel) scrambleExpText(subLabel, data.period, 80);
            }

            // Flow path highlights
            updateFlowLines(milestone);

            // Run YAML type stream
            typeYAML(data.yaml);
        }
    }).to('.telemetry-panel', {
        opacity: 1,
        duration: 0.1,
        ease: 'power2.inOut'
    });

    // Animate stats popping in
    tl.fromTo(['.inspector-header', '.inspector-metrics', '.yaml-manifest-window'], 
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(1.2)', clearProps: "all" },
        "-=0.1"
    );
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

// Attach event listeners for SVG nodes
if (topoNodes.length > 0) {
    topoNodes.forEach(node => {
        node.addEventListener('click', () => {
            const milestone = parseInt(node.dataset.milestone, 10);
            selectMilestone(milestone);
        });

        node.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const milestone = parseInt(node.dataset.milestone, 10);
                selectMilestone(milestone);
            }
        });
    });
}

// Attach event listeners for Mobile Tab buttons
if (mobileNavBtns.length > 0) {
    mobileNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const milestone = parseInt(btn.dataset.milestone, 10);
            selectMilestone(milestone);
        });
    });
}

// Attach Copy Spec listener
const copyBtn = document.getElementById('yaml-copy-btn');
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const activeNode = document.querySelector('.html-topo-node.active');
        const milestone = activeNode ? parseInt(activeNode.dataset.milestone, 10) : 4;
        const rawYAML = MILESTONE_DATA[milestone].yaml;

        navigator.clipboard.writeText(rawYAML).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.querySelector('.copy-text').textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.querySelector('.copy-text').textContent = 'Copy Spec';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    });
}

// Initialise experience dashboard (Default to Senior role - milestone 4)
if (topoNodes.length > 0) {
    selectMilestone(4);
    initializeExperienceMapAnimation();
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


