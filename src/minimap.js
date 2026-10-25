/**
 * Mini-map: the face-on Milky Way (the same Gaia-based map the Galaxy is built from) with
 * "you are here" — the camera's real position projected onto the Galactic plane — and a
 * marker where the camera parks for each chapter. A marker takes you to its chapter.
 *
 * Wide screens keep it in the margin the whole way; narrower ones show it only in the open
 * stretches between pages, so it never covers the text being read.
 */

import { MAP_KPC, MAP_CENTRE, STATIONS } from './galaxy-world.js';

const ASSETS = `${import.meta.env.BASE_URL}galaxy/`;

// World (x, z) in kpc → position on the map, as fractions of its width (left) and height (top)
const toMap = (x, z) => [MAP_CENTRE[0] - z / MAP_KPC, MAP_CENTRE[1] + x / MAP_KPC];
const pct = v => `${(v * 100).toFixed(2)}%`;

export function createMinimap({ chapters, sectionIds, onSelect }) {
    const root = document.createElement('nav');
    root.className = 'minimap';
    root.setAttribute('aria-label', 'Map of the Milky Way');
    root.innerHTML = `
        <div class="minimap-plate">
            <img class="minimap-image" src="${ASSETS}faceon-sample.jpg" alt="" width="512" height="512" decoding="async" loading="lazy">
            <span class="minimap-you" aria-hidden="true"></span>
        </div>
        <p class="minimap-caption" aria-hidden="true"><span class="cat-id"></span><span class="minimap-name"></span></p>
    `;
    const plate = root.querySelector('.minimap-plate');
    const you = root.querySelector('.minimap-you');
    const captionId = root.querySelector('.cat-id');
    const captionName = root.querySelector('.minimap-name');

    // One marker per chapter, where the camera stops for it (stations 1–6; 0 is the arrival view)
    const markers = chapters.map((chapter, i) => {
        const [left, top] = toMap(STATIONS[i + 1].pos[0], STATIONS[i + 1].pos[2]);
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'minimap-marker';
        marker.style.left = pct(left);
        marker.style.top = pct(top);
        marker.dataset.label = String(i + 1).padStart(2, '0');
        marker.setAttribute('aria-label', `Go to ${String(i + 1).padStart(2, '0')}, ${chapter.name}`);
        marker.addEventListener('click', () => onSelect(`#${sectionIds[i]}`));
        const preview = () => setCaption(i);
        marker.addEventListener('pointerenter', preview);
        marker.addEventListener('focus', preview);
        marker.addEventListener('pointerleave', () => setCaption(active));
        marker.addEventListener('blur', () => setCaption(active));
        plate.appendChild(marker);
        return marker;
    });

    let active = -1;
    function setCaption(i) {
        captionId.textContent = i >= 0 ? `MW·${String(i + 1).padStart(2, '0')}` : 'MW';
        captionName.textContent = i >= 0 ? chapters[i].name : 'The Milky Way';
    }
    setCaption(-1);

    document.body.appendChild(root);

    // The dot moves with a transform (no layout): the plate's size is measured only when it changes
    let plateW = 0, plateH = 0, lastX = 0.5, lastY = 0.5, lastTransform = '';
    const place = () => {
        const t = `translate3d(${(lastX * plateW).toFixed(1)}px, ${(lastY * plateH).toFixed(1)}px, 0)`;
        if (t !== lastTransform) you.style.transform = lastTransform = t;
    };
    new ResizeObserver(([entry]) => {
        plateW = entry.contentRect.width;
        plateH = entry.contentRect.height;
        place();
    }).observe(plate);
    let visible = false;
    return {
        // Camera position in kpc
        setPosition(x, z) {
            const [left, top] = toMap(x, z);
            // Off the map (the arrival view is above it): pin to the edge
            lastX = Math.min(Math.max(left, 0.02), 0.98);
            lastY = Math.min(Math.max(top, 0.02), 0.98);
            place();
        },
        setActive(i) {
            if (i === active) return;
            active = i;
            markers.forEach((m, k) => m.classList.toggle('active', k === i));
            setCaption(i);
        },
        setVisible(v) {
            if (v === visible) return;
            visible = v;
            root.classList.toggle('is-visible', v);
            // Hidden markers leave the tab order
            markers.forEach(m => { m.tabIndex = v ? 0 : -1; });
        },
    };
}
