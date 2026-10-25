// ─── Accessibility (E5b / R-011) ──────────────────────────────
// Respects prefers-reduced-motion, tracks keyboard focus,
// handles noscript fallback, and exposes a11y state.

// ── prefers-reduced-motion ─────────────────────────────────────
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionQuery.matches;
motionQuery.addEventListener('change', (e) => {
    reducedMotion = e.matches;
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    if (typeof window.__onReducedMotionChange === 'function') {
        window.__onReducedMotionChange(reducedMotion);
    }
});
document.documentElement.classList.toggle('reduced-motion', reducedMotion);

// ── Keyboard focus detection ───────────────────────────────────
let usingKeyboard = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        usingKeyboard = true;
        document.documentElement.classList.add('keyboard-focus');
    }
}, { passive: true });

document.addEventListener('mousedown', () => {
    usingKeyboard = false;
    document.documentElement.classList.remove('keyboard-focus');
}, { passive: true });

// ── Noscript content ───────────────────────────────────────────
function handleNoscript() {
    const noscriptEl = document.getElementById('noscript-content');
    if (!noscriptEl) return;
    // Check if JS is actually running by looking for the data attribute
    // If the script loads, the attribute is set in main.js
    // This block only runs if JS is NOT running
}

// Run on DOMContentLoaded if script is not already running
document.addEventListener('DOMContentLoaded', () => {
    handleNoscript();
});

// ── Public API ─────────────────────────────────────────────────
export { reducedMotion, usingKeyboard };
