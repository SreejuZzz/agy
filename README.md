# personal portfolio

My portfolio site. Built it because I wanted to try GPU particle simulations in the browser and kept putting it off. It turned into a trip through the Milky Way, from the Sun to the black hole at the centre, with as much real physics as I could fit in.

Live: https://sreejuzzz.github.io/agy

---

## The journey

**The opening shot.** The hero runs a particle ring with Three.js: the particles are simulated on the GPU (ping-pong render targets + GLSL), drift on their own and follow the cursor. Scroll, and the ring collapses in free fall, inner particles first, heating to white, into a single point of light. That point is the Milky Way seen from 1.5 Mpc away; the camera flies in until it fills the view, then dives to the Sun. One take, no cuts.

**The Galaxy** (`src/galaxy-world.js`) is built from real data at true scale (kiloparsecs, centred on Sagittarius A*). From the Sun you see the real sky: ESO's all-sky panorama, mapped by Galactic longitude and latitude. From outside you see ESA's Gaia-based map, calibrated to 40.2 kpc across with the Sun 8.2 kpc from the centre, with the bar and bulge as 3D volumes and 300,000 stars sampled from the map. Each page sits at a real place: the Sun, above the disk, the Scutum–Centaurus arm, the bar, the bulge, and Sgr A*. Between pages, a chapter title names where the camera has arrived.

Scrolling is also time ("now" at the Sun, 10 million years per chapter): stars orbit on a flat 230 km/s rotation curve and each is drawn as the streak it makes during the frame. The header reads out the camera's real distance to Sgr A*, and near the hole how slowly a clock there runs. Colours across the site are blackbody temperatures (10,000 K for anything interactive, 4,000 K for highlights).

**The finale.** Past the last page, Sgr A* swallows the site (`src/gravity.js`): the page is torn into letters that fall in nearest-first (free fall, spiralling with angular momentum, stretched by tides, dimmed by redshift), then the camera follows. Every pixel's light is traced through Schwarzschild spacetime past an orbiting accretion disk, so the lensed arch of the disk, the photon ring and the shadow are computed, not drawn; the disk's colour and brightness follow its temperature, Doppler beaming and gravitational redshift. "Escape to the top" warps you out.

## The pages

- **About**: 7 years in infrastructure. Started at SDC Networks in Kaloor doing real network troubleshooting, then Linux admin → Cloud Engineer → DevOps at Synnefo Solutions in Ernakulam. RHCSA and AWS SAA certified, and 700+ students mentored across networking, Linux, cloud and DevOps.
- **Experience**: a flight path from 2018 to now that flies itself in when the page arrives. Tap a year, use Earlier/Later, swipe, or use the arrow keys to move between roles.
- **Skills**: a star chart. Each category is a constellation; the brighter the star, the longer I've used it. Pick a star and a leader line runs down to its catalogue entry (since when, which role it came with), and the skills from that role light up together.
- **Work**: three case studies (context, what I did, result, with an architecture diagram each), switched by their headline numbers, plus my public repos (devops-tasks, linux-tasks, shell).
- **Education** and **Contact**: the address up front, a row of channels, and a message form that opens on request.

## The physics

All of it switches off with reduced motion, and stays quiet while a page is being read.

- **Warp navigation** (`src/warp.js`): jumping more than one chapter, the camera accelerates hard towards half the speed of light. The view bends forward with relativistic aberration, the real scene smears along the line of travel like a fast dolly on film, and a hint of Doppler shift tints it, then it settles into the new chapter.
- **Pages that form like stars**: each page's title condenses out of a cloud as it arrives, its letters falling in on spiralling free-fall paths and heating from dull red to white. The mirror of the finale.
- **The pointer bends light**: between pages it's a small mass that lenses the Galaxy behind it (arcs, magnification, an Einstein ring).
- **Gravitational waves** (`src/waves.js`): a ring of strain through the Galaxy on arriving at a chapter and when something is swallowed; "Escape to the top" sets off a black-hole merger chirp, and the page itself stretches and squeezes.
- **Orbiting skills** (`src/orbits.js`): every star moves on a small Kepler ellipse (Kepler's equation and third law, inner stars faster); a constellation stops under the pointer.
- **Throwable links** (`src/throw.js`): the contact links hang on springs. Drag one and it wobbles back; throw it hard and Sgr A* pulls it in early, then it re-forms.
- **Comets** (`src/comet.js`): now and then one crosses between pages, its ion tail pointing straight away from the Sun and its dust tail curving back along its track.

## Things to find

- **Terminal** (`src/terminal.js`): press `~` anywhere, or Terminal in Contact. Try `help`, `kubectl get pods`, `cd skills`.
- **Sound** (`src/ambient.js`): off by default. The speaker in the header turns on a drone, synthesised live, that deepens as you fall towards Sgr A* and goes silent at the horizon.

## Performance and accessibility

- Frames are drawn only while something moves. Moving frames render the Galaxy at reduced resolution (the motion hides it) and one crisp frame replaces them when the camera stops; the pointer, waves and warp only redraw a cheap final pass, never the 300,000 stars.
- The full-resolution images download only once you're past the hero.
- Reduced motion gets its own version: no flights (the camera cuts between chapters, links jump straight there), no streaks, orbits, warps or collapsing text, and the black hole's disk holds still.
- Keyboard: skip link, focus states, arrow keys on the Experience path and the case-study tabs, and the terminal is a proper modal dialog.

## Project layout

```
src/
  main.js                 page logic: sections, skills, contact, wiring
  transitions.js          scroll choreography (GSAP ScrollTrigger + Lenis)
  galaxy-world.js         the Milky Way, the black hole, and the final screen pass
  antigravity-particles.js  the hero particle ring
  gravity.js              the finale: the page falling into Sgr A*
  warp.js  waves.js  orbits.js  throw.js  comet.js   the physics above
  terminal.js  ambient.js  the extras
  motion.js               one spring-based motion language for everything
  styles/                 tokens, hero, nav, sections, overlays
public/galaxy/            the imagery (see credits)
```

## Stack

- Vanilla JS
- Three.js (WebGL, GLSL ray tracing)
- GSAP + ScrollTrigger, SplitText
- Lenis (smooth scrolling)
- Web Audio API
- Vite
- Inter, Outfit and JetBrains Mono

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

Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).

---

[LinkedIn](https://www.linkedin.com/in/sreejith-sreenivas-110bb217a/) · [GitHub](https://github.com/SreejuZzz) · sreejithmsreenivas@gmail.com

## Image credits

- Milky Way face-on map: [ESA/Gaia/DPAC, Stefan Payne-Wardenaar](https://www.esa.int/ESA_Multimedia/Images/2025/01/The_best_Milky_Way_map_by_Gaia), [CC BY-SA 3.0 IGO](https://creativecommons.org/licenses/by-sa/3.0/igo/) — re-encoded to WebP (`public/galaxy/faceon-*`)
- Share image (`public/og-image.jpg`): made from the face-on map above, so the same licence applies
- All-sky panorama: [ESO/S. Brunier](https://www.eso.org/public/images/eso0932a/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — re-encoded to WebP (`public/galaxy/sky-*`)
