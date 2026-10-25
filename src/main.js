import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createBlobGeometry, createBlobMaterial } from './scene/blob.js';

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

// ─── Renderer selection ───────────────────────────────────
let renderer;
let scene, camera, mesh;
let animFrameId;
let isWebGPU = false;

async function init() {
  setLoading(10);

  const canvas = document.getElementById('webgl-canvas');
  const dpr = Math.min(window.devicePixelRatio, 2);

  // Try WebGPU first, fallback to WebGL 2
  try {
    if (!forceWebGL && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();
        const context = canvas.getContext('webgpu');
        if (context) {
          const format = navigator.gpu.getPreferredCanvasFormat();
          context.configure({
            device,
            format,
            alphaMode: 'premultiplied'
          });
          renderer = new WebGPURenderer({ canvas, context, format });
          isWebGPU = true;
        }
      }
    }
  } catch (e) {
    // WebGPU not available or failed, continue to WebGL fallback
    console.info('[Liquid] WebGPU not available, falling back to WebGL 2.', e);
  }

  // WebGL 2 fallback
  if (!renderer) {
    const glContext = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (glContext) {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: glContext,
        antialias: true,
        alpha: false
      });
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight);
      isWebGPU = false;
    } else {
      throw new Error('WebGL 2 not supported on this device.');
    }
  }

  setLoading(30);

  // ─── Scene ──────────────────────────────────────────────
  const blobScene = new THREE.Scene();
  blobScene.background = new THREE.Color('#0a0a0a');

  // Subtle lights for shader interaction
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  blobScene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x4488ff, 2, 15);
  pointLight1.position.set(3, 2, 3);
  blobScene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xff4488, 1.5, 15);
  pointLight2.position.set(-3, -1, 2);
  blobScene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0x44ff88, 1, 15);
  pointLight3.position.set(0, 3, -3);
  blobScene.add(pointLight3);

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  // ─── Generative blob: 3D noise displacement + TSL material ─
  const geometry = createBlobGeometry(64);
  const material = createBlobMaterial();
  mesh = new THREE.Mesh(geometry, material);
  blobScene.add(mesh);

  // Use blob scene as main scene
  scene = blobScene;

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

    // Animate blob (noise displacement + gentle rotation)
    const elapsed = clock.getElapsedTime();
    mesh.material.uniforms.uTime.value = elapsed;
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
  if (renderer.capabilities) {
    console.info(`[Liquid] GL Renderer: ${renderer.capabilities.renderer ?? 'N/A'}`);
  }
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
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#f44;font-family:system-ui;padding:2rem;text-align:center;">WebGL 2 is not supported on this device.<br>Please try Chrome or Safari.</div>`;
});
