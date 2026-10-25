import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

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
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0a0a');

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  // ─── Test geometry: rotating icosahedron ─────────────────
  const geometry = new THREE.IcosahedronGeometry(1.5, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    wireframe: true
  });
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // ─── Lights (for WebGL rendering) ───────────────────────
  const ambientLight = new THREE.AmbientLight(0x404040, 1);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(2, 3, 4);
  scene.add(directionalLight);

  setLoading(50);

  // ─── Resize handler ─────────────────────────────────────
  window.addEventListener('resize', onResize);

  setLoading(70);

  // ─── Start render loop ──────────────────────────────────
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

    // Rotate test mesh
    mesh.rotation.x += 0.003;
    mesh.rotation.y += 0.005;

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
