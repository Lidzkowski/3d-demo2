// ─── Adaptive Quality & Render Pause (E5b / R-009) ─────────────
// FPS-based quality auto-downgrade, DPR capping, and render pause
// when the canvas is off-screen or the tab is hidden.

// ── Reduced-motion preference ──────────────────────────────────
let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    reducedMotion = e.matches;
});

// ── Mobile / coarse-pointer detection ──────────────────────────
let isMobile = window.matchMedia('(pointer: coarse)').matches
    || window.innerWidth < 768;
window.addEventListener('resize', () => {
    isMobile = window.matchMedia('(pointer: coarse)').matches
        || window.innerWidth < 768;
}, { passive: true });

// ── DPR capping ────────────────────────────────────────────────
function getAdaptiveDpr(dpr) {
    if (reducedMotion || isMobile) return Math.min(dpr, 1.5);
    return Math.min(dpr, 2);
}

// ── FPS monitor ────────────────────────────────────────────────
// Tracks frames-per-second over a moving window.
// Returns 'low' or 'high' quality target based on performance.
const FPS_WINDOW = 2000; // ms
const FPS_LOW_THRESHOLD = 30;
const FPS_HIGH_THRESHOLD = 45;

let fpsSamples = [];       // { time, count }
let fpsFrameCount = 0;
let fpsLastTick = performance.now();

function recordFrame(now) {
    fpsFrameCount++;
    if (now - fpsLastTick >= 100) {
        fpsSamples.push({ time: now, count: fpsFrameCount });
        fpsFrameCount = 0;
        fpsLastTick = now;
    }
}

function getCurrentFps() {
    const now = performance.now();
    // Discard samples older than FPS_WINDOW
    while (fpsSamples.length && fpsSamples[0].time < now - FPS_WINDOW) {
        fpsSamples.shift();
    }
    if (!fpsSamples.length) return 60; // assume good if no data
    const oldest = fpsSamples[0].time;
    const totalFrames = fpsSamples.reduce((sum, s) => sum + s.count, 0);
    const elapsed = now - oldest;
    return elapsed > 0 ? (totalFrames / elapsed) * 1000 : 60;
}

function getQualityTarget(fps) {
    if (fps < FPS_LOW_THRESHOLD) return 'low';
    if (fps >= FPS_HIGH_THRESHOLD) return 'high';
    return null; // no change needed
}

// ── Visibility / intersection observer ─────────────────────────
let isOffscreen = false;
let isVisible = !document.hidden;

function createVisibilityGuard() {
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            isOffscreen = entry.intersectionRatio < 0.01;
        }
    }, { threshold: [0, 0.01, 0.5] });

    const canvas = document.getElementById('webgl-canvas');
    if (canvas) observer.observe(canvas);

    document.addEventListener('visibilitychange', () => {
        isVisible = !document.hidden;
    }, { passive: true });

    return {
        shouldRender() {
            return isVisible && !isOffscreen && !reducedMotion;
        },
        isReducedMotion() {
            return reducedMotion;
        }
    };
}

// ── Export ─────────────────────────────────────────────────────
export {
    reducedMotion,
    isMobile,
    getAdaptiveDpr,
    recordFrame,
    getCurrentFps,
    getQualityTarget,
    createVisibilityGuard,
};
