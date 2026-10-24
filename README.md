# personal portfolio

My portfolio site. Built it because I wanted to try GPU particle simulations in the browser and kept putting it off.

Live: https://sreejuzzz.github.io/agy

---

## What's in it

The hero background runs a particle ring with Three.js — the particle positions are simulated on the GPU (ping-pong render targets + GLSL shaders), so it stays smooth even with thousands of particles. The ring drifts on its own and follows the cursor when you move the mouse. Colors are blue, red, and yellow.

Scroll past the hero and it dissolves into the Milky Way (`src/galaxy-world.js`), built from real data and placed at true scale (kiloparsecs, centred on Sagittarius A*). From the Sun you see the real sky: ESO's all-sky panorama, mapped by Galactic longitude and latitude. From outside you see ESA's Gaia-based map of the Galaxy, calibrated to 40.2 kpc across with the Sun 8.2 kpc from the centre, with the bar and bulge as 3D volumes and 300,000 stars sampled from the map. The journey visits the Sun, the space above the disk, the Scutum–Centaurus arm, the bar and the bulge, and ends with Sgr A* swallowing the page: its components fall in under gravity (free fall, spiralling with angular momentum, stretched by tides, dimmed by redshift; `src/gravity.js`), then the camera follows in a spiralling fall: every pixel's light is traced through Schwarzschild spacetime past an orbiting accretion disk, so the lensed arch of the disk, the photon ring and the shadow are computed, and the disk's colour and brightness follow its temperature, Doppler beaming and gravitational redshift.

Scrolling is also time ("now" at the Sun, 10 million years per chapter): stars orbit on a flat 230 km/s rotation curve, streaming past the spiral arms inside corotation and lagging outside it, and each star is drawn as the streak it makes during the frame. The header reads out the camera's real distance to Sgr A*, and near the hole how slowly a clock there runs. Colours across the site are blackbody temperatures (10,000 K for anything interactive, 4,000 K for highlights).

Every layer is a texture lookup or closed-form maths, and frames are drawn only while the camera moves, so scrolling stays at the display's frame rate. Page transitions use GSAP ScrollTrigger and Lenis smooth scrolling (`src/transitions.js`), with one shared motion language (`src/motion.js`). Inter + Outfit + JetBrains Mono fonts; design tokens live in `tokens.css`.

The About/Experience/Skills sections have my actual background: 7 years in infrastructure, started at SDC Networks in Kaloor doing real network troubleshooting, moved through Linux admin → Cloud Engineer → DevOps at Synnefo Solutions in Ernakulam. RHCSA and AWS SAA certified. Also been mentoring 700+ students across networking, Linux, cloud, and DevOps at Synnefo — which is what I spend most of my time on now.

Work section links to my public repos (devops-tasks, linux-tasks, shell).

## Stack

- Vanilla JS
- Three.js (WebGL, GLSL ray marching)
- GSAP + ScrollTrigger
- Lenis (smooth scrolling)
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

## Image credits

- Milky Way face-on map: [ESA/Gaia/DPAC, Stefan Payne-Wardenaar](https://www.esa.int/ESA_Multimedia/Images/2025/01/The_best_Milky_Way_map_by_Gaia), [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/) — re-encoded to WebP (`public/galaxy/faceon-*`)
- All-sky panorama: [ESO/S. Brunier](https://www.eso.org/public/images/eso0932a/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — re-encoded to WebP (`public/galaxy/sky-*`)
