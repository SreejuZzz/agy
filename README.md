# personal portfolio

My portfolio site. Built it because I wanted to try the CSS Houdini Paint API and kept putting it off.

Live: https://sreejuzzz.github.io/agy

---

## What's in it

The hero background runs a particle ring using a CSS Houdini Paint Worklet — meaning it runs off the main thread entirely. Mouse interaction stretches the particles toward the cursor with a rubber-band physics feel. Colors are navy, orange, and red, with each particle snapping to its dominant wave so they don't blend into mud.

The rest is fairly standard — scroll-driven animations, glassmorphism cards, dark/light toggle, Inter + Outfit fonts. All design tokens live in `tokens.css` so I'm not hunting through stylesheets to change a spacing value.

The About/Experience/Skills sections have my actual background: 7 years in infrastructure, started at SDC Networks in Kaloor doing real network troubleshooting, moved through Linux admin → Cloud Engineer → DevOps at Synnefo Solutions in Ernakulam. RHCSA and AWS SAA certified. Also been mentoring 700+ students across networking, Linux, cloud, and DevOps at Synnefo — which is what I spend most of my time on now.

Work section links to my public repos (devops-tasks, linux-tasks, shell).

## Stack

- Vanilla JS
- CSS Houdini Paint API
- Vite
- HTML

## Run it locally

```bash
npm install
npm run dev
# opens at http://localhost:5173
```

```bash
npm run build
# output → /dist
```

---

[LinkedIn](https://www.linkedin.com/in/sreejith-sreenivas-110bb217a/) · [GitHub](https://github.com/SreejuZzz) · sreejithmsreenivas@gmail.com
