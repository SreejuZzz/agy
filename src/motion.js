/**
 * One motion language for the whole site, built on a physical model: everything that
 * moves on a timer behaves like a critically damped spring released from rest,
 *
 *     x(t) = 1 − (1 + ωt)·e^(−ωt)
 *
 * which starts from zero velocity and settles in the shortest time without overshoot.
 * CSS uses the closest cubic-bezier, cubic-bezier(0.25, 0.25, 0.15, 1) (within 1.6%),
 * as --ease-out in tokens.css.
 */
const OMEGA = 7;                                          // natural frequency, per duration
const SETTLED = 1 - (1 + OMEGA) * Math.exp(-OMEGA);       // x(1), so the curve ends exactly at 1

export const spring = t => (t >= 1 ? 1 : (1 - (1 + OMEGA * t) * Math.exp(-OMEGA * t)) / SETTLED);

export const MOTION = {
    ease: spring,
    enter: 1.4,              // seconds for things arriving
    exit: 0.8,               // seconds for things leaving
    update: 0.6,             // seconds for in-place content changes
    stagger: 0.06,
    rise: 18,                // px an element travels as it fades in
};
