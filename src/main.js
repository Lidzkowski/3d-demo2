import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createBlobGeometry, createBlobMaterial, createProceduralEnvironment } from './scene/blob.js';

// ─── URL Params ───────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const forceWebGL = urlParams.has('renderer') && urlParams.get('renderer') === 'webgl';
const debugMode = urlParams.has('debug');

// ─── Debug overlay ────────────────────────────────────────
const debugOverlay = document.getElementById('debug-overlay');
if (debugMode) debugOverlay.classList.add('visible');

function updateDebug(text) {
    if (debugOverlay) debugOverlay.textContent = text;
}

// ─── Loading screen ───────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');

function setLoading(pct) {
    loadingProgress.style.width = `${pct}%`;
}

// ─── Renderer ─────────────────────────────────────────────
let renderer;
let scene, camera, mesh;
let animFrameId;
let isWebGPU = false;

async function init() {
    setLoading(10);

    const canvas = document.getElementById('webgl-canvas');
    const dpr = Math.min(window.devicePixelRatio, 2);

    // WebGPURenderer (unified renderer handles backend selection)
    // forceWebGL option forces WebGL 2 backend when ?renderer=webgl
    // Both backends use the same TSL node material — no GLSL needed
    renderer = new WebGPURenderer({
        canvas,
        antialias: true,
        alpha: false,
        forceWebGL: forceWebGL,
    });

    isWebGPU = !forceWebGL;
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Initialize the renderer backend (required before any rendering)
    await renderer.init();

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
    pointLight2.position.set(-3, -1, 2);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x44ff88, 1, 15);
    pointLight3.position.set(0, 3, -3);
    scene.add(pointLight3);

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5);

    // ─── Procedural environment for glass-metal reflections ──
    const envMap = createProceduralEnvironment(renderer);
    scene.environment = envMap;

    // ─── Generative blob: TSL displacement + glass-metal ───
    const geometry = createBlobGeometry(64);
    const material = createBlobMaterial();
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    setLoading(50);

    // ─── Resize handler ─────────────────────────────────────
    window.addEventListener('resize', onResize);

    setLoading(70);

    // ─── Start render loop ──────────────────────────────────
    const clock = new THREE.Clock();
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
            updateDebug(`FPS: ${fps} | Renderer: ${isWebGPU ? 'WebGPU' : 'WebGL 2'} | ${forceWebGL ? '[forced]' : ''}`);
        }

        // Animate blob (TSL displacement + gentle rotation)
        const elapsed = clock.getElapsedTime();
        mesh.rotation.y = elapsed * 0.1;
        mesh.rotation.x = Math.sin(elapsed * 0.07) * 0.1;

        renderer.render(scene, camera);
    }

    setLoading(100);

    // Hide loading screen
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 500);

    animate(performance.now());

    // Log renderer info
    console.info(`[Liquid] Renderer: ${isWebGPU ? 'WebGPU' : 'WebGL 2'} | Force: ${forceWebGL} | Debug: ${debugMode}`);
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
    console.error('[Liquid] Initialization failed:', err);
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#f44;font-family:system-ui;padding:2rem;text-align:center;">WebGPU or WebGL 2 is not supported on this device.<br>Please try Chrome or Safari.</div>`;
});
