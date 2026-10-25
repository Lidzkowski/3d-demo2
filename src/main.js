import * as THREE from 'three';
import { WebGPURenderer, Timer } from 'three/webgpu';
import { createBlobGeometry, createBlobMaterial, createFallbackBlobMaterial, createProceduralEnvironment } from './scene/blob.js';
import { initScroll, setupScrollTrigger } from './scroll/index.js';
import { initCursor } from './ui/cursor.js';
import { initKineticType } from './ui/typography.js';
import { initUIPalette } from './ui/palette.js';
import { initLoader } from './ui/loader.js';
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

// ─── Mouse tracking (R-004) ───────────────────────────────
window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Click impulse (R-004) — set impulse to 1, decays in animation loop
window.addEventListener('click', () => {
    impulse = 1;
});

// ─── Renderer ─────────────────────────────────────────────
async function init() {
    setLoading(10);

    const canvas = document.getElementById('webgl-canvas');
    const dpr = Math.min(window.devicePixelRatio, 2);

    // Try WebGPU renderer first
    try {
        renderer = new WebGPURenderer({
            canvas,
            antialias: true,
            alpha: false,
            forceWebGL: forceWebGL,
        });

        isWebGPU = !forceWebGL;
        renderer.setPixelRatio(dpr);
        renderer.setSize(window.innerWidth, window.innerHeight);
        await renderer.init();
    } catch (webgpuError) {
        console.warn('[Liquid] WebGPU/WebGL 2 unavailable, falling back to WebGL renderer.', webgpuError.message);

        // Fallback: standard WebGLRenderer + MeshPhysicalMaterial (no TSL nodes)
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
        });
        renderer.setPixelRatio(dpr);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor('#0a0a0a', 1);
        useFallback = true;
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

    function animate(time) {
        animFrameId = requestAnimationFrame(animate);

        // FPS counter
        frameCount++;
        if (time - lastTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastTime = time;
            updateDebug(`FPS: ${fps} | Renderer: ${useFallback ? 'WebGL (fallback)' : (isWebGPU ? 'WebGPU' : 'WebGL 2')} | ${forceWebGL ? '[forced]' : ''} | Quality: ${quality} | Scene: ${currentScene.sceneIndex}`);
        }

        // Update timer (replaces THREE.Clock)
        timer.update(time);

        // ── Lenis update (single animation loop) ───────────
        if (scrollModule) {
            scrollModule.render(time);
            currentScene = scrollModule.getCurrentScene();
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

        // Scene-based camera offset (scroll morph R-005)
        const si = currentScene.sceneIndex;
        const sp = currentScene.sceneProgress;
        camera.position.y = si * 0.15 + Math.sin(sp * Math.PI) * 0.3;
        camera.position.x = Math.sin(si * 0.8 + sp * 0.5) * 0.2;

        renderer.render(scene, camera);
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
}

// ─── Start ────────────────────────────────────────────────
init().catch(err => {
    const msg = err?.message || String(err);
    console.error('[Liquid] Rendering failed — no WebGPU or WebGL 2 available.', msg);
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#f44;font-family:system-ui;padding:2rem;text-align:center;max-width:600px;line-height:1.6;">Rendering not supported on this device.<br>Please try the latest Chrome or Safari.<br><br><span style="color:#888;font-size:13px;">Error: ${msg}</span></div>`;
});
