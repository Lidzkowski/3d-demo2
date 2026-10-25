// ─── UI Sounds (E5b / R-010) ─────────────────────────────────
// Procedural Web Audio sounds triggered by UI gestures.
// Disabled by default. Enabled after first user gesture.
// Mute toggle via toggleMute() / isMuted property.
// No files, no microphone.

let audioCtx = null;
let enabled = false;
let muted = false;
let isInitialized = false;

// Gain node shared across all sounds
let masterGain = null;

// ── Initialise AudioContext on user gesture ────────────────────
function initAudio() {
    if (isInitialized) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = muted ? 0 : 0.12;
        masterGain.connect(audioCtx.destination);
        enabled = true;
        isInitialized = true;
    } catch {
        // Web Audio not available — graceful no-op
        console.warn('[Liquid] Web Audio not available');
    }
}

// ── Click sound — short percussive blip ────────────────────────
export function playClick() {
    if (!enabled || muted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.12);
}

// ── Hover sound — very soft high harmonic ──────────────────────
export function playHover() {
    if (!enabled || muted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.08);
}

// ── Scroll sound — low sweep (triggered every 500ms throttle) ──
let lastScrollSound = 0;
export function playScroll() {
    if (!enabled || muted || !audioCtx) return;
    const now = performance.now();
    if (now - lastScrollSound < 500) return;
    lastScrollSound = now;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.25);
}

// ── Toggle mute ────────────────────────────────────────────────
export function toggleMute() {
    muted = !muted;
    if (masterGain) {
        masterGain.gain.setValueAtTime(muted ? 0 : 0.12, audioCtx.currentTime);
    }
    return muted;
}

export function setMute(value) {
    muted = value;
    if (masterGain) {
        masterGain.gain.setValueAtTime(muted ? 0 : 0.12, audioCtx.currentTime);
    }
}

// ── Public API ─────────────────────────────────────────────────
export { initAudio, enabled, muted };
