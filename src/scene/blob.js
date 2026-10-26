import * as THREE from 'three';
import { MeshPhysicalNodeMaterial, PMREMGenerator, TSL } from 'three/webgpu';

// ─── Fallback material for WebGL (no TSL nodes) ───────────
// Used when WebGPU/WebGL 2 backend is unavailable.
export function createFallbackBlobMaterial(quality = 'high') {
    const isLow = quality === 'low';

    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x1a0a30),
        metalness: 0.92,
        roughness: 0.08,
        transmission: isLow ? 0.0 : 0.75,
        ior: 1.52,
        thickness: isLow ? 0.0 : 1.2,
        attenuationDistance: isLow ? 0.0 : 3.0,
        attenuationColor: new THREE.Color(isLow ? 1.0 : 0.6, isLow ? 1.0 : 0.8, isLow ? 1.0 : 1.0),
        clearcoat: 0.8,
        clearcoatRoughness: 0.05,
        iridescence: isLow ? 0.0 : 0.6,
        iridescenceIOR: 1.3,
        iridescenceThickness: isLow ? 0.0 : 0.3,
        sheen: isLow ? 0.0 : 0.15,
        sheenRoughness: isLow ? 1.0 : 0.4,
        dispersion: isLow ? 0.0 : 0.08,
        transparent: true,
        side: THREE.DoubleSide,
    });

    // ─── Palette interface (E4 / R-006) ─────────────────────
    // Fallback material: body color + emissive tint from the gradient stops.
    const _fallbackColor = new THREE.Color();
    const _fallbackEmissive = new THREE.Color();
    material.setPalette = function (stopsHex) {
        if (!Array.isArray(stopsHex) || stopsHex.length < 3) return;
        _fallbackColor.setHex(stopsHex[1]);
        _fallbackEmissive.setHex(stopsHex[2]);
        material.color.copy(_fallbackColor);
        material.emissive.copy(_fallbackEmissive).multiplyScalar(0.25);
    };

    return material;
}

const {
    float, vec3, uniform,
    mx_fractal_noise_float,
    positionLocal, normalLocal,
    normalize, max, pow, mix, smoothstep, sin, cos, dot, abs, exp,
    cameraPosition, modelViewPosition, normalView,
} = TSL;

// ─── TSL Node Material: 3D noise displacement + glass-metal hybrid ──
export function createBlobMaterial(quality = 'high') {
    const material = new MeshPhysicalNodeMaterial();

    // Quality flag: disable transmission on weaker devices
    const isLow = quality === 'low';

    // ─── Displacement: multi-octave TSL fractal noise ───
    // Smoother, more organic displacement
    const pos = positionLocal;
    const time = TSL.time;

    // Primary wave — slow, large undulations
    const noise1 = mx_fractal_noise_float(
        pos.mul(float(0.6)).add(time.mul(float(0.15))),
        float(5), float(2.2), float(0.5)
    );

    // Secondary detail — finer, faster movement
    const noise2 = mx_fractal_noise_float(
        pos.mul(float(1.5)).add(time.mul(float(0.3))),
        float(3), float(2.0), float(0.5)
    );

    // Surface micro-detail — subtle texture
    const microNoise = mx_fractal_noise_float(
        pos.mul(float(3.5)).add(time.mul(float(0.1))),
        float(2), float(1.8), float(0.5)
    );

    // Combined displacement — smoother, more organic
    const displacement = noise1.mul(float(0.22)).add(
        noise2.mul(float(0.08)).add(microNoise.mul(float(0.03)))
    );

    // Position node: base + normal * displacement (TSL, no GLSL)
    material.positionNode = pos.add(normalLocal.normalize().mul(displacement));

    // ─── Mouse proximity displacement (R-004) ───────────────
    // Uniforms for mouse interaction — guard against missing uniforms
    const mouseUniform = material.uniforms;
    if (mouseUniform) {
        if (!mouseUniform.mouse) {
            mouseUniform.mouse = { value: new THREE.Vector2(0, 0) };
        }
        const mousePos = mouseUniform.mouse.value;

        // Use positionLocal (base vertex, no displacement) to avoid
        // circular dependency: modelViewPosition depends on positionNode.
        const baseVert = pos;
        const mouseInfluence = float(1.2);
        const mouseFalloff = float(0.5);
        // Project mouse to 3D at vertex depth using base vertex
        const mvBase = cameraPosition.add(cameraPosition.z.mul(vec3(mousePos.x, mousePos.y, float(1.0))));
        const vertView = cameraPosition.add(cameraPosition.z.mul(vec3(baseVert.x, baseVert.y, float(1.0))));
        const mouseDist = vertView.sub(mvBase).length();
        const mouseDisp = pow(exp(float(-mouseDist.mul(float(1.0)).div(mouseFalloff).pow(float(2.0)))), float(1.0)).mul(mouseInfluence);

        // ─── Click impulse wave (R-004) ─────────────────────────
        // impulse uniform: float 0-1, set from main.js on click
        if (!mouseUniform.impulse) {
            mouseUniform.impulse = { value: 0 };
        }
        const impulseVal = mouseUniform.impulse.value;
        const impulseWave = sin(mouseDist.sub(impulseVal.mul(float(3.0)))).mul(impulseVal).mul(float(0.4));

        // Add mouse + impulse to base positionNode (don't replace)
        material.positionNode = material.positionNode.add(normalLocal.normalize().mul(mouseDisp.add(impulseWave)));
    }

    // ─── Base color: displacement-based gradient, palette-driven (E4) ───
    // Three uniform stops (interior → mid → peaks), initialized to the
    // E2 gradient. initUIPalette() eases them via setPalette() while the
    // Palette scene is active.
    const t = displacement.mul(float(2.0)).add(float(0.5));
    const _paletteColor = new THREE.Color();
    const paletteStops = [0x080214, 0x0d4f6e, 0x2d1b69].map((hex) => {
        _paletteColor.setHex(hex);
        return uniform(new THREE.Vector3(_paletteColor.r, _paletteColor.g, _paletteColor.b));
    });

    const baseColor = mix(paletteStops[0], paletteStops[1], smoothstep(float(0.0), float(0.5), t));
    const finalColor = mix(baseColor, paletteStops[2], smoothstep(float(0.5), float(1.0), t));

    material.colorNode = finalColor;

    // ─── Glass-metal hybrid properties (TSL nodes) ───
    material.metalnessNode = float(0.92);
    material.roughnessNode = float(0.08);

    // Transmission + thickness for glass refraction
    if (!isLow) {
        material.transmissionNode = float(0.75);
        material.thicknessNode = float(1.2);
        material.iorNode = float(1.52);
        material.attenuationDistanceNode = float(3.0);
        material.attenuationColorNode = vec3(float(0.6), float(0.8), float(1.0));
    } else {
        material.transmissionNode = float(0.0);
        material.thicknessNode = float(0.0);
        material.attenuationDistanceNode = float(0.0);
        material.attenuationColorNode = vec3(float(1.0));
    }

    // Clearcoat for sharp highlights
    material.clearcoatNode = float(0.8);
    material.clearcoatRoughnessNode = float(0.05);

    // Iridescence for oil-slick rainbow shift
    if (!isLow) {
        material.iridescenceNode = float(0.7);
        material.iridescenceIORNode = float(1.4);
        material.iridescenceThicknessNode = float(0.4);
    } else {
        material.iridescenceNode = float(0.0);
        material.iridescenceIORNode = float(1.0);
        material.iridescenceThicknessNode = float(0.0);
    }

    // Sheen for fabric-like edge glow (subtle purple sheen)
    if (!isLow) {
        material.sheenNode = vec3(float(0.2), float(0.08), float(0.35));
        material.sheenRoughnessNode = float(0.3);
    } else {
        material.sheenNode = vec3(float(0.0));
        material.sheenRoughnessNode = float(1.0);
    }

    // Dispersion for prism-like rainbow splitting (high quality only)
    if (!isLow) {
        material.dispersionNode = float(0.1);
    } else {
        material.dispersionNode = float(0.0);
    }

    // ─── Fresnel rim glow (TSL, no GLSL) ───
    // Stronger, wider rim with color variation
    const viewDir = normalize(cameraPosition.sub(modelViewPosition).xyz).toVar();
    const fresnel = pow(float(1.0).sub(max(float(0.0), dot(normalView, viewDir))), float(3.5));

    // ─── Internal subsurface-like glow ──────────────────────
    // Simulates light passing through translucent material
    // Uses a combination of fresnel and noise for depth
    const glowIntensity = pow(fresnel, float(1.5)).mul(float(0.6));
    const glowColor = mix(paletteStops[1], vec3(float(1.0), float(1.0), float(1.0)), float(0.3));
    const internalGlow = glowColor.mul(glowIntensity);

    // ─── Iridescence from displacement ──────────────────────
    const iridPhase = sin(displacement.mul(float(10.0)).add(time.mul(float(0.4)))).mul(float(0.5)).add(float(0.5));
    const iridColor = vec3(float(0.15), float(0.08), float(0.25)).mul(iridPhase);

    // ─── Emissive: glass-metal hybrid with fresnel rim + iridescence ───
    // Brighter rim (0.9), internal glow, iridescence at edges
    const glassColor = mix(finalColor, vec3(float(1.0)), fresnel.mul(float(0.9)));
    const emissiveColor = glassColor.add(iridColor.mul(fresnel)).add(internalGlow);

    material.emissiveNode = emissiveColor;

    // ─── Regular material properties (fallback) ───
    material.metalness = 0.92;
    material.roughness = 0.08;
    material.transmission = isLow ? 0.0 : 0.75;
    material.ior = 1.52;
    material.clearcoat = 0.8;
    material.clearcoatRoughness = 0.05;
    material.iridescence = isLow ? 0.0 : 0.7;
    material.iridescenceIOR = 1.4;
    material.iridescenceThickness = isLow ? 0.0 : 0.4;
    material.sheen = isLow ? 0.0 : 0.2;
    material.sheenRoughness = isLow ? 1.0 : 0.3;
    material.dispersion = isLow ? 0.0 : 0.1;
    material.attenuationDistance = isLow ? 0.0 : 3.0;
    material.attenuationColor = isLow ? new THREE.Color(1.0) : new THREE.Color(0.6, 0.8, 1.0);
    material.transparent = true;
    material.side = THREE.DoubleSide;

    // ─── Palette interface (E4 / R-006) ─────────────────────
    // setPalette([hex1, hex2, hex3]) — gradient stops for the base color.
    const _stopColor = new THREE.Color();
    material.setPalette = function (stopsHex) {
        if (!Array.isArray(stopsHex) || stopsHex.length < 3) return;
        for (let i = 0; i < 3; i++) {
            _stopColor.setHex(stopsHex[i]);
            paletteStops[i].value.set(_stopColor.r, _stopColor.g, _stopColor.b);
        }
    };

    // ─── Cursor interaction helpers (R-004) ─────────────────
    // setMouse(nx, ny) — normalized device coords [-1, 1]
    if (mouseUniform) {
        material.setMouse = function(nx, ny) {
            mouseUniform.mouse.value.set(nx, ny);
        };
        // setImpulse(v) — click impulse 0→1, decays in main.js
        material.setImpulse = function(v) {
            mouseUniform.impulse.value = v;
        };
    }

    return material;
}

// ─── Geometry: high-poly icosahedron ─────────────────────────
export function createBlobGeometry(detail = 4) {
    return new THREE.IcosahedronGeometry(1.8, detail);
}

// ─── Procedural environment: equirectangular canvas → PMREM cubemap ──
// Enhanced with gradients and soft light panels for richer reflections
export function createProceduralEnvironment(renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Deep dark gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#08081a');
    bgGrad.addColorStop(0.5, '#050512');
    bgGrad.addColorStop(1, '#030310');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Soft gradient panels for smooth reflections (studio lighting)
    function addGradientPanel(x, y, w, h, color1, color2, angle = 0) {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(angle);
        const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
    }

    // Top-left cool blue panel (large, soft)
    addGradientPanel(0, 0, canvas.width * 0.3, canvas.height * 0.35,
        'rgba(30, 60, 180, 0.6)', 'rgba(10, 20, 60, 0.1)', 0.3);

    // Top-right warm pink/rose panel
    addGradientPanel(canvas.width * 0.65, 0, canvas.width * 0.35, canvas.height * 0.35,
        'rgba(200, 50, 120, 0.5)', 'rgba(80, 10, 50, 0.1)', -0.2);

    // Center bright key light (narrow, intense)
    addGradientPanel(canvas.width * 0.38, 0, canvas.width * 0.24, canvas.height * 0.12,
        'rgba(255, 255, 255, 0.5)', 'rgba(200, 220, 255, 0.2)', 0);

    // Upper center warm highlight
    addGradientPanel(canvas.width * 0.35, canvas.height * 0.05, canvas.width * 0.15, canvas.height * 0.08,
        'rgba(255, 200, 150, 0.4)', 'rgba(255, 150, 100, 0.1)', 0.1);

    // Bottom-left cyan/green accent
    addGradientPanel(canvas.width * 0.2, canvas.height * 0.65, canvas.width * 0.25, canvas.height * 0.35,
        'rgba(30, 180, 140, 0.35)', 'rgba(10, 80, 70, 0.1)', -0.4);

    // Bottom-right purple/violet accent
    addGradientPanel(canvas.width * 0.55, canvas.height * 0.65, canvas.width * 0.3, canvas.height * 0.35,
        'rgba(120, 40, 200, 0.4)', 'rgba(40, 10, 80, 0.1)', 0.3);

    // Bottom edge subtle warm fill
    addGradientPanel(canvas.width * 0.1, canvas.height * 0.9, canvas.width * 0.8, canvas.height * 0.1,
        'rgba(180, 100, 60, 0.2)', 'rgba(100, 50, 30, 0.05)', 0);

    // Side fill lights (narrow vertical strips)
    addGradientPanel(canvas.width * 0.02, canvas.height * 0.3, canvas.width * 0.06, canvas.height * 0.4,
        'rgba(40, 80, 160, 0.3)', 'rgba(20, 40, 100, 0.05)', 0.5);

    addGradientPanel(canvas.width * 0.92, canvas.height * 0.3, canvas.width * 0.06, canvas.height * 0.4,
        'rgba(160, 40, 100, 0.3)', 'rgba(80, 20, 60, 0.05)', -0.5);

    // Small bright specular highlights
    function addSpecular(x, y, radius, color) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(0.3, color.replace(/[0-9.]+\)$/, '0.3)'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    addSpecular(canvas.width * 0.5, canvas.height * 0.08, 80, 'rgba(255, 255, 255, 0.7)');
    addSpecular(canvas.width * 0.15, canvas.height * 0.15, 50, 'rgba(100, 150, 255, 0.4)');
    addSpecular(canvas.width * 0.85, canvas.height * 0.15, 50, 'rgba(255, 100, 150, 0.4)');

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;

    const pmremGenerator = new PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    texture.dispose();
    pmremGenerator.dispose();

    return envMap;
}
