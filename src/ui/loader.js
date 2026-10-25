// ─── Loading screen (E4 / R-007) ───────────────────────────────────
// Progress bar + percentage label for the fixed #loading-screen.
// main.js drives it via setLoading(pct); hide() fades it out.

const LABELS = [
    [0, 'Preparing the form'],
    [25, 'Igniting the lights'],
    [45, 'Pouring the glass'],
    [70, 'Weaving the surface'],
    [90, 'Almost there'],
];

let bar = null;
let text = null;
let screen = null;
let lastPct = -1;

export function initLoader() {
    screen = document.getElementById('loading-screen');
    bar = document.getElementById('loading-progress');
    text = document.getElementById('loading-text');
    return { setLoading, hide };
}

export function setLoading(pct) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    if (bar) bar.style.width = `${clamped}%`;
    if (text && clamped !== lastPct) {
        lastPct = clamped;
        const label = [...LABELS].reverse().find(([stop]) => clamped >= stop)?.[1] ?? LABELS[0][1];
        text.textContent = `${label} — ${clamped}%`;
    }
}

export function hide() {
    if (screen) screen.classList.add('hidden');
}
