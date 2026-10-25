/**
 * Ambient sound: off until the visitor turns it on. A low drone that follows the camera's
 * distance to Sgr A*, synthesised live with the Web Audio API (nothing is downloaded).
 *
 * - Depth s runs from 0 (the whole Galaxy in view, ~25 kpc out) to 1 (just outside the photon
 *   sphere), on a log scale like the camera's flight. As s grows the drone drops an octave,
 *   its filter closes and it grows louder: the deeper in, the deeper the sound.
 * - A slow beat between two detuned voices quickens near the hole, like the disk's orbit.
 * - Moving makes a breath of filtered noise, in proportion to how fast the distance changes.
 * - Past the event horizon, silence: nothing escapes from here.
 */

const FAR = Math.log10(25);           // kpc
const NEAR = Math.log10(9e-10);       // kpc, ≈ 2.2 rs (where the fall ends)
const clamp01 = v => Math.min(Math.max(v, 0), 1);
const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export function createAmbient() {
    let ctx = null, nodes = null, on = false;
    let depth = 0, finale = 0, rush = 0, lastLog = null, lastTime = 0;

    function build() {
        ctx = new AudioContext();
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 0.7;
        filter.connect(master);

        // Drone: a fundamental and two overtones, the second voice slightly detuned so they beat
        const voices = [1, 1, 2, 3].map((harmonic, i) => {
            const osc = ctx.createOscillator();
            osc.type = i === 0 ? 'sine' : 'triangle';
            const gain = ctx.createGain();
            gain.gain.value = [0.5, 0.35, 0.18, 0.08][i];
            osc.connect(gain).connect(filter);
            osc.start();
            return { osc, harmonic };
        });

        // Wind: brown noise through a band-pass, for motion
        const length = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < length; i++) {
            last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
            data[i] = last * 3.5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 400;
        band.Q.value = 0.8;
        const wind = ctx.createGain();
        wind.gain.value = 0;
        noise.connect(band).connect(wind).connect(master);
        noise.start();

        nodes = { master, filter, voices, band, wind };
    }

    // Glide every parameter to where the camera is now
    function apply() {
        if (!nodes) return;
        const t = ctx.currentTime, glide = 0.25;
        const s = depth;
        const f0 = 55 * Math.pow(2, -s);                 // A1 → A0
        const beat = 0.15 + 2.2 * Math.pow(s, 3);        // Hz between the two fundamentals
        nodes.voices.forEach(({ osc, harmonic }, i) => {
            const f = f0 * harmonic + (i === 1 ? beat : 0);
            osc.frequency.setTargetAtTime(f, t, glide);
        });
        nodes.filter.frequency.setTargetAtTime(900 - 700 * s, t, glide);
        nodes.band.frequency.setTargetAtTime(500 - 300 * s, t, glide);
        const silence = 1 - smoothstep(0.93, 0.99, finale);
        const level = on ? (0.06 + 0.1 * s) * silence : 0;
        nodes.master.gain.setTargetAtTime(level, t, on ? 0.6 : 0.3);
        nodes.wind.gain.setTargetAtTime(on ? Math.min(rush, 1) * 0.5 * silence : 0, t, 0.15);
    }

    // The breath of motion dies away once the camera stops (no readouts arrive then)
    let decay = null;
    function settle() {
        clearTimeout(decay);
        decay = setTimeout(() => { rush = 0; apply(); }, 180);
    }

    document.addEventListener('visibilitychange', () => {
        if (!ctx || !on) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    return {
        get on() { return on; },
        // Must be called from a user gesture the first time (browsers block audio until then)
        setOn(value) {
            on = value;
            if (on && !ctx) build();
            if (ctx && on) ctx.resume();
            apply();
            if (ctx && !on) setTimeout(() => { if (!on) ctx.suspend(); }, 800);
        },
        update({ kpc, finale: f }) {
            if (f !== undefined) finale = f;
            if (kpc !== undefined) {
                const log = Math.log10(Math.max(kpc, 1e-12));
                depth = clamp01((FAR - log) / (FAR - NEAR));
                const now = performance.now();
                if (lastLog !== null && now > lastTime) {
                    const speed = Math.abs(log - lastLog) / ((now - lastTime) / 1000);   // decades per second
                    rush = rush * 0.8 + Math.min(speed, 3) / 3 * 0.2;
                }
                lastLog = log;
                lastTime = now;
                settle();
            }
            if (on) apply();
        },
    };
}
