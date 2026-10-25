import * as THREE from 'three';
import { WebGPURenderer, Timer } from 'three/webgpu';
import { createBlobGeometry, createBlobMaterial, createFallbackBlobMaterial, createProceduralEnvironment } from './scene/blob.js';
import { createParticles } from './scene/particles.js';
import { createPostProcessing } from './scene/postprocessing.js';
import { initScroll, setupScrollTrigger } from './scroll/index.js';
import { initCursor } from './ui/cursor.js';
import { initKineticType } from './ui/typography.js';
import { initUIPalette } from './ui/palette.js';
import { initLoader } from './ui/loader.js';
import {
    getAdaptiveDpr,
    recordFrame,
    getCurrentFps,
    getQualityTarget,
    createVisibilityGuard,
    reducedMotion,
    isMobile,
} from './ui/adaptive-quality.js';
import { initAudio, playClick, playHover, playScroll, toggleMute, setMute, enabled as soundEnabled } from './ui/sounds.js';
import { reducedMotion as a11yReducedMotion } from './ui/accessibility.js';
import '@fontsource-variable/space-grotesk';
import './styles/base.css';

// ─── URL Params ───────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const forceWebGL = urlParams.has('renderer') && urlParams.get('renderer') === 'webgl';
const debugMode = urlParams.has('debug');
const quality = urlParams.get('quality') || 'high';

// ─── Debug overlay ────────────────────────────────────────
const debugOverlay = document.getElementById('debug-overlay');
if (debugMode) debugOverlay.classList.add('visible');

function updateDebug(text) {
    if (debugOverlay) debugOverlay.textContent = text;
}

// ─── Quality toggle (E5a / R-008) + adaptive quality (E5b / R-009) ──
let currentQuality = quality; // 'high' | 'low'
let lastQualityDegrade = 0;  // throttling for quality degradation

// E5b: visibility guard for render pause
const visibilityGuard = createVisibilityGuard();
let shouldRender = true;

// E5b: mobile mode detection — simplify rendering
const mobileMode = isMobile || a11yReducedMotion;
if (mobileMode) {
    document.documentElement.classList.add('mobile-mode');
    document.documentElement.dataset.mobile = 'true';
}

function toggleQuality() {
    currentQuality = currentQuality === 'high' ? 'low' : 'high';
    console.info('[Liquid] toggleQuality called, new quality:', currentQuality);

    // Update particles count
    if (particles) {
        const newCount = currentQuality === 'high' ? 2000 : 500;
        // Dispose old geometry
        particles.mesh.geometry.dispose();
        particles.mesh.material.dispose();
        scene.remove(particles.mesh);

        // Create new particles
        particles = createParticles(newCount);
        scene.add(particles.mesh);
    }

    // Update post-processing quality (mobile mode: no PP)
    if (postProcessing) {
        postProcessing.setQuality(currentQuality);
    }

    // Update blob material quality
    if (mesh) {
        // For TSL material, we can't easily change quality mid-flight,
        // but we can note it for the overlay
    }

    // Update debug overlay immediately (not only on FPS tick)
    if (debugOverlay) {
        const particleInfo = isWebGLRenderer ? (currentQuality === 'high' ? 2000 : 500) : 'N/A';
        updateDebug(`FPS: ${fps} | Renderer: ${useFallback ? 'WebGL (fallback)' : (isWebGPU ? 'WebGPU' : 'WebGL 2')} | ${forceWebGL ? '[forced]' : ''} | Quality: ${currentQuality} | Particles: ${particleInfo} | PP: ${postProcessing ? 'ON' : 'OFF'} | Mobile: ${mobileMode} | Motion: ${a11yReducedMotion}`);
    }

    console.info(`[Liquid] Quality switched to: ${currentQuality}`);
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'q' || e.key === 'Q') {
        toggleQuality();
    }
});

// Expose for testing / console access
window.toggleLiquidQuality = toggleQuality;

// ─── E5b: Sound gesture & toggle ──────────────────────────────
let soundGestureHandled = false;
const soundToggleBtn = document.getElementById('sound-toggle');

function handleSoundGesture() {
    if (soundGestureHandled) return;
    soundGestureHandled = true;
    initAudio();
}

// First user gesture enables sound
document.addEventListener('click', handleSoundGesture, { once: true, passive: true });
document.addEventListener('touchstart', handleSoundGesture, { once: true, passive: true });
document.addEventListener('keydown', handleSoundGesture, { once: true, passive: true });

// Sound toggle button
if (soundToggleBtn) {
    soundToggleBtn.classList.add('is-mute'); // default: muted off (no sound until gesture)

    soundToggleBtn.addEventListener('click', () => {
        if (!soundEnabled) return;
        const newMuted = toggleMute();
        soundToggleBtn.classList.toggle('is-mute', newMuted);
        soundToggleBtn.setAttribute('aria-label', newMuted ? 'Enable UI sounds' : 'Disable UI sounds');
    }, { passive: true });
}

// ─── Loading screen ───────────────────────────────────────
const { setLoading, hide: hideLoader } = initLoader();

// ─── Renderer ─────────────────────────────────────────────
let renderer;
let scene, camera, mesh;
let animFrameId;
let isWebGPU = false;
let useFallback = false;

// ─── Cursor state (R-004) ─────────────────────────────────
let mouseX = 0, mouseY = 0;       // normalized device coords [-1, 1]
let impulse = 0;                  // click impulse 0→1, decays each frame

// ─── Scroll state (R-005) ─────────────────────────────────
let scrollModule = null;
let currentScene = { sceneIndex: 0, sceneProgress: 0 };

// ─── UI state (R-006, R-007) ──────────────────────────────
let uiPalette = null;
let kineticType = null;

// ─── Particles & Post-processing (E5a / R-008) ────────────
let particles = null;
let postProcessing = null;

// ─── Mouse tracking (R-004) ───────────────────────────────
window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
}, { passive: true });

// E5b: hover sound — throttled
let lastHoverSound = 0;
window.addEventListener('mouseover', (e) => {
    const now = performance.now();
    if (now - lastHoverSound < 300) return;
    lastHoverSound = now;
    const el = e.target;
    if (el.closest('a, button, .palette-card, input, textarea')) {
        playHover();
    }
}, { passive: true });

// Click impulse (R-004) — set impulse to 1, decays in animation loop
// E5b: also trigger click sound
window.addEventListener('click', () => {
    impulse = 1;
    playClick();
}, { passive: true });

// ─── Renderer ─────────────────────────────────────────────
async function init() {
    setLoading(10);

    const canvas = document.getElementById('webgl-canvas');
    const dpr = getAdaptiveDpr(window.devicePixelRatio);

    // Try WebGPU renderer first, but only if WebGPU is actually available.
    // We check for a real adapter AND device (not just a stub).
    let hasWebGPU = false;
    if (!forceWebGL && typeof navigator !== 'undefined') {
        try {
            const adapter = await navigator.gpu?.requestAdapter();
            if (adapter) {
                // Verify with device request (stub adapters fail here)
                const device = await adapter.requestDevice();
                hasWebGPU = !!device;
            }
        } catch {
            hasWebGPU = false;
        }
    }

    if (hasWebGPU) {
        try {
            renderer = new WebGPURenderer({
                canvas,
                antialias: true,
                alpha: false,
                forceWebGL: forceWebGL,
            });

            isWebGPU = true;
            renderer.setPixelRatio(dpr);
            renderer.setSize(window.innerWidth, window.innerHeight);
            await renderer.init();
        } catch (webgpuError) {
            console.warn('[Liquid] WebGPU init failed, falling back to WebGL renderer.', webgpuError.message);
            renderer = null;
        }
    }

    // Use standard WebGLRenderer if WebGPU was unavailable or failed
    if (!renderer) {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
        });
        renderer.setPixelRatio(dpr);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor('#0a0a0a', 1);
        useFallback = true;
        isWebGPU = false;
    }

    setLoading(30);

    // ─── Scene ──────────────────────────────────────────────
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0a');

    // Subtle lights for TSL material interaction
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x4488ff, 2, 15);
    pointLight1.position.set(3, 2, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff4488, 1.5, 15);
    scene.add(pointLight2);
    pointLight2.position.set(-3, -1, 2);

    const pointLight3 = new THREE.PointLight(0x44ff88, 1, 15);
    scene.add(pointLight3);
    pointLight3.position.set(0, 3, -3);

    // Camera: z=6 gives comfortable margin around blob (radius ~2.2 max)
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    // ─── Procedural environment for glass-metal reflections ──
    // (Only needed for TSL node material; fallback uses direct material properties)
    if (!useFallback) {
        const envMap = createProceduralEnvironment(renderer);
        scene.environment = envMap;
    }

    // ─── Generative blob: TSL displacement + glass-metal (or fallback) ───
    const geometry = createBlobGeometry(64);
    const material = useFallback
        ? createFallbackBlobMaterial(quality)
        : createBlobMaterial(quality);
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // ─── Post-processing: bloom + chromatic aberration (E5a) ──
    // EffectComposer / UnrealBloomPass / ShaderPass są WebGL-only.
    // Działają tylko gdy renderer to WebGLRenderer (fallback).
    // E5b / R-012: mobile mode — no post-processing
    const isWebGLRenderer = renderer instanceof THREE.WebGLRenderer;

    // ─── Particles (E5a / R-008) — ShaderMaterial = WebGL-only ──
    // E5b / R-012: mobile mode — drastically fewer particles
    let particleCount = quality === 'high' ? 2000 : 500;
    if (mobileMode) {
        particleCount = 250;
    }
    if (isWebGLRenderer) {
        particles = createParticles(particleCount);
        scene.add(particles.mesh);
    }

    if (isWebGLRenderer && !mobileMode) {
        postProcessing = createPostProcessing(
            renderer, scene, camera, window.innerWidth, window.innerHeight, quality
        );
    }

    // ─── UI: palettes (R-006) driven by the current scene ─────
    uiPalette = initUIPalette(
        () => currentScene,
        (stops) => {
            if (typeof mesh.material.setPalette === 'function') {
                mesh.material.setPalette(stops);
            }
        }
    );

    // ─── UI: magnetic cursor + kinetic typography (R-007) ─────
    initCursor();
    kineticType = initKineticType();

    setLoading(50);

    // ─── Resize handler ─────────────────────────────────────
    window.addEventListener('resize', onResize);

    setLoading(70);

    // ─── Scroll integration (R-005) ─────────────────────────
    scrollModule = initScroll();
    setupScrollTrigger();

    setLoading(80);

    // ─── Start render loop ──────────────────────────────────
    const timer = new Timer();
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 0;
    let frameSkip = 0; // frame skipping when offscreen

    function animate(time) {
        animFrameId = requestAnimationFrame(animate);

        // E5b / R-009: pause rendering when tab hidden or canvas off-screen
        shouldRender = visibilityGuard.shouldRender();
        if (!shouldRender) {
            return; // skip entire frame
        }

        // E5b: record frame for adaptive quality monitoring
        recordFrame(time);

        // FPS counter
        frameCount++;
        if (time - lastTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastTime = time;

            // E5b: adaptive quality — degrade if FPS too low
            const currentFps = getCurrentFps();
            const qualityTarget = getQualityTarget(currentFps);
            if (qualityTarget && qualityTarget !== currentQuality) {
                const now = performance.now();
                if (now - lastQualityDegrade > 5000) { // throttle 5s
                    lastQualityDegrade = now;
                    currentQuality = qualityTarget;
                    console.info(`[Liquid] Adaptive quality → ${currentQuality} (FPS: ${Math.round(currentFps)})`);

                    // Rebuild particles with new count
                    if (particles && isWebGLRenderer) {
                        particles.mesh.geometry.dispose();
                        particles.mesh.material.dispose();
                        scene.remove(particles.mesh);
                        particles = createParticles(
                            currentQuality === 'high' ? 2000 : 500
                        );
                        scene.add(particles.mesh);
                    }

                    // Update post-processing quality
                    if (postProcessing) {
                        postProcessing.setQuality(currentQuality);
                    }
                }
            }

            updateDebug(`FPS: ${fps} | Renderer: ${useFallback ? 'WebGL (fallback)' : (isWebGPU ? 'WebGPU' : 'WebGL 2')} | ${forceWebGL ? '[forced]' : ''} | Quality: ${currentQuality} | ${currentFps > 0 ? 'Adaptive: ' + Math.round(currentFps) + 'fps' : ''} | Particles: ${isWebGLRenderer ? (currentQuality === 'high' ? 2000 : 500) : 'N/A'} | PP: ${postProcessing ? 'ON' : 'OFF'} | Mobile: ${mobileMode} | Motion: ${a11yReducedMotion} | Scene: ${currentScene.sceneIndex}`);
        }

        // Update timer (replaces THREE.Clock)
        timer.update(time);

        // ── Lenis update (single animation loop) ───────────
        if (scrollModule) {
            scrollModule.render(time);
            currentScene = scrollModule.getCurrentScene();
            // E5b: scroll sound (throttled inside playScroll)
            if (isWebGLRenderer) playScroll();
        }

        // ── Palette update (R-006) ──────────────────────────
        if (uiPalette) {
            uiPalette.update(timer.getDelta());
        }

        // ── Cursor interaction (R-004) ─────────────────────
        // Decay impulse (click pulse fades over ~1.5s)
        const delta = timer.getDelta();
        impulse *= Math.max(0, 1 - delta * 0.8);

        // Update material with mouse + impulse (only on TSL node material)
        if (typeof mesh.material.setMouse === 'function') {
            mesh.material.setMouse(mouseX, mouseY);
        }
        if (typeof mesh.material.setImpulse === 'function') {
            mesh.material.setImpulse(impulse);
        }

        // Animate blob (TSL displacement + gentle rotation)
        const elapsed = timer.getElapsed();
        mesh.rotation.y = elapsed * 0.1;
        mesh.rotation.x = Math.sin(elapsed * 0.07) * 0.1;

        // ── Particles update (E5a / R-008) — WebGL-only ──────
        const si = currentScene.sceneIndex;
        const sp = currentScene.sceneProgress;
        if (isWebGLRenderer && particles) {
            particles.setUniforms(si, sp);
            particles.updateTime(elapsed);
        }

        // Scene-based camera offset (scroll morph R-005)
        camera.position.y = si * 0.15 + Math.sin(sp * Math.PI) * 0.3;
        camera.position.x = Math.sin(si * 0.8 + sp * 0.5) * 0.2;

        // ── Render: composer (with post-processing) or direct ──
        if (postProcessing) {
            postProcessing.composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }

    setLoading(100);

    // Hide loading screen, then run the kinetic reveal
    setTimeout(() => {
        hideLoader();
        if (kineticType) kineticType.reveal();
    }, 500);

    animate(performance.now());

    // Log renderer info
    console.info(`[Liquid] Renderer: ${useFallback ? 'WebGL (fallback)' : (isWebGPU ? 'WebGPU' : 'WebGL 2')} | Force: ${forceWebGL} | Debug: ${debugMode}`);
}

function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (postProcessing) {
        postProcessing.setSize(w, h);
    }
}

// ─── Start ────────────────────────────────────────────────
init().catch(err => {
    const msg = err?.message || String(err);
    console.error('[Liquid] Rendering failed — no WebGPU or WebGL 2 available.', msg);
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#f44;font-family:system-ui;padding:2rem;text-align:center;max-width:600px;line-height:1.6;">Rendering not supported on this device.<br>Please try the latest Chrome or Safari.<br><br><span style="color:#888;font-size:13px;">Error: ${msg}</span></div>`;
});
