# personal portfolio

My portfolio site. Built it because I wanted to try GPU particle simulations in the browser and kept putting it off.

Live: https://sreejuzzz.github.io/agy

---

## What's in it

The hero background runs a particle ring with Three.js — the particle positions are simulated on the GPU (ping-pong render targets + GLSL shaders), so it stays smooth even with thousands of particles. The ring drifts on its own and follows the cursor when you move the mouse. Colors are blue, red, and yellow.

The rest is fairly standard — scroll-driven animations, glassmorphism cards, GSAP transitions in the Experience console, dark/light toggle, Inter + Outfit + JetBrains Mono fonts. All design tokens live in `tokens.css` so I'm not hunting through stylesheets to change a spacing value.

The About/Experience/Skills sections have my actual background: 7 years in infrastructure, started at SDC Networks in Kaloor doing real network troubleshooting, moved through Linux admin → Cloud Engineer → DevOps at Synnefo Solutions in Ernakulam. RHCSA and AWS SAA certified. Also been mentoring 700+ students across networking, Linux, cloud, and DevOps at Synnefo — which is what I spend most of my time on now.

Work section links to my public repos (devops-tasks, linux-tasks, shell).

## Stack

- Vanilla JS
- Three.js (WebGL)
- GSAP
- Vite
- HTML

## Run it locally

```bash
npm install
npm run dev
# opens at http://localhost:5173/agy/
```

```bash
npm run build
# output → /dist
```

---

[LinkedIn](https://www.linkedin.com/in/sreejith-sreenivas-110bb217a/) · [GitHub](https://github.com/SreejuZzz) · sreejithmsreenivas@gmail.com
