import * as THREE from 'three';
import { MeshPhysicalNodeMaterial, PMREMGenerator, TSL } from 'three/webgpu';

const {
    float, vec3,
    mx_fractal_noise_float, mx_timer,
    positionLocal, normalLocal,
    normalize, max, pow, mix, smoothstep, sin, dot,
    cameraPosition, modelViewPosition, normalView,
} = TSL;

// ─── TSL Node Material: 3D noise displacement + glass-metal hybrid ──
export function createBlobMaterial() {
    const material = new MeshPhysicalNodeMaterial();

    // ─── Displacement: multi-octave TSL fractal noise ───
    const pos = positionLocal;
    const time = TSL.time;

    const noise1 = mx_fractal_noise_float(
        pos.mul(float(0.8)).add(time.mul(float(0.25))),
        float(4), float(2.0), float(0.5)
    );

    const detailNoise = mx_fractal_noise_float(
        pos.mul(float(2.0)).add(time.mul(float(0.4))),
        float(2), float(2.0), float(0.5)
    );

    const displacement = noise1.mul(float(0.35)).add(detailNoise.mul(float(0.08)));

    // Position node: base + normal * displacement (TSL, no GLSL)
    material.positionNode = pos.add(normalLocal.normalize().mul(displacement));

    // ─── Base color: displacement-based gradient (purple/teal/violet) ───
    const t = displacement.mul(float(1.5)).add(float(0.5));
    const color1 = vec3(float(0.102), float(0.039), float(0.18));   // #1a0a2e
    const color2 = vec3(float(0.051), float(0.309), float(0.431));   // #0d4f6e
    const color3 = vec3(float(0.176), float(0.106), float(0.412));   // #2d1b69

    const baseColor = mix(color1, color2, smoothstep(float(0.0), float(0.5), t));
    const finalColor = mix(baseColor, color3, smoothstep(float(0.5), float(1.0), t));

    material.colorNode = finalColor;

    // ─── Glass-metal hybrid properties (TSL nodes) ───
    material.metalnessNode = float(0.9);
    material.roughnessNode = float(0.15);
    material.transmissionNode = float(0.3);
    material.iorNode = float(1.5);
    material.clearcoatNode = float(0.5);
    material.clearcoatRoughnessNode = float(0.1);

    // ─── Fresnel rim glow (TSL, no GLSL) ───
    const viewDir = normalize(cameraPosition.sub(modelViewPosition).xyz).toVar();
    const fresnel = pow(float(1.0).sub(max(float(0.0), dot(normalView, viewDir))), float(3.0));

    // ─── Iridescence from displacement ───
    const iridPhase = sin(displacement.mul(float(8.0)).add(time.mul(float(0.5)))).mul(float(0.5)).add(float(0.5));
    const iridColor = vec3(float(0.1), float(0.05), float(0.15)).mul(iridPhase);

    // ─── Emissive: glass-metal hybrid with fresnel rim + iridescence ───
    const glassColor = mix(finalColor, vec3(float(1.0)), fresnel.mul(float(0.6)));
    const emissiveColor = glassColor.add(iridColor.mul(fresnel));

    material.emissiveNode = emissiveColor;

    // ─── Regular material properties (fallback) ───
    material.metalness = 0.9;
    material.roughness = 0.15;
    material.transmission = 0.3;
    material.ior = 1.5;
    material.clearcoat = 0.5;
    material.clearcoatRoughness = 0.1;
    material.transparent = true;
    material.side = THREE.DoubleSide;

    return material;
}

// ─── Geometry: high-poly icosahedron ─────────────────────────
export function createBlobGeometry(detail = 64) {
    return new THREE.IcosahedronGeometry(1.8, detail);
}

// ─── Procedural environment: equirectangular canvas → PMREM cubemap ──
export function createProceduralEnvironment(renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Dark gradient sky with subtle stars
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#050510');
    gradient.addColorStop(0.3, '#0a0a1a');
    gradient.addColorStop(0.5, '#0f0f1a');
    gradient.addColorStop(0.7, '#0a0a15');
    gradient.addColorStop(1.0, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle stars for environment reflections
    for (let i = 0; i < 300; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height * 0.5;
        const brightness = Math.random() * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.fillRect(x, y, 1, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;

    const pmremGenerator = new PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    texture.dispose();
    pmremGenerator.dispose();

    return envMap;
}
