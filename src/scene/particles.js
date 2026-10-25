import * as THREE from 'three';

// ─── GPU Particle System ─────────────────────────────────────
// Particles float around the blob, influenced by scroll scene.
// Custom shader for performance (no per-frame JS updates).

export function createParticles(count = 2000) {
    const isLow = count < 1000;
    const geometry = new THREE.BufferGeometry();

    // Per-particle attributes
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);   // random offsets (x,y,z)
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);         // orbital phase offset

    for (let i = 0; i < count; i++) {
        // Distribute in a spherical shell around the blob (radius 2.5–5)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2.5 + Math.random() * 2.5;

        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        randoms[i * 3]     = (Math.random() - 0.5) * 2;
        randoms[i * 3 + 1] = (Math.random() - 0.5) * 2;
        randoms[i * 3 + 2] = (Math.random() - 0.5) * 2;

        sizes[i] = isLow
            ? 0.5 + Math.random() * 1.0
            : 0.8 + Math.random() * 2.0;

        phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    // ─── Shader Material ─────────────────────────────────────
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSceneIndex: { value: 0 },
            uSceneProgress: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
            uColor1: { value: new THREE.Color(0x6b3fa0) },  // purple
            uColor2: { value: new THREE.Color(0x3a8fd6) },  // blue
            uColor3: { value: new THREE.Color(0xff6b9d) },  // pink
        },
        vertexShader: /* glsl */ `
            attribute vec3 aRandom;
            attribute float aSize;
            attribute float aPhase;

            uniform float uTime;
            uniform int uSceneIndex;
            uniform float uSceneProgress;
            uniform float uPixelRatio;

            varying float vAlpha;
            varying vec3 vColor;

            // Simple hash for pseudo-random
            float hash(float n) {
                return fract(sin(n) * 43758.5453123);
            }

            void main() {
                vec3 pos = position;
                float t = uTime * 0.15;

                // Orbital motion around center
                float angle = t * (0.3 + aRandom.x * 0.2) + aPhase;
                float cosA = cos(angle * 0.1);
                float sinA = sin(angle * 0.1);
                vec3 orbitPos = pos;
                orbitPos.x = pos.x * cosA - pos.z * sinA;
                orbitPos.z = pos.x * sinA + pos.z * cosA;

                // Gentle vertical drift
                orbitPos.y += sin(t * 0.5 + aPhase) * 0.3;

                // Scroll scene influence
                float sceneFactor = float(uSceneIndex) * 0.15 + uSceneProgress * 0.2;
                orbitPos *= 1.0 + sceneFactor * 0.3;

                // Noise-like displacement
                float nx = sin(orbitPos.x * 0.5 + t) * cos(orbitPos.y * 0.3 + t * 0.7);
                float ny = cos(orbitPos.y * 0.4 + t * 0.6) * sin(orbitPos.z * 0.5 + t);
                float nz = sin(orbitPos.z * 0.6 + t * 0.8) * cos(orbitPos.x * 0.4 + t);
                orbitPos += vec3(nx, ny, nz) * 0.2;

                vec4 mvPosition = modelViewMatrix * vec4(orbitPos, 1.0);

                // Size attenuation
                float size = aSize * uPixelRatio * (120.0 / -mvPosition.z);
                gl_PointSize = max(size, 1.0);

                gl_Position = projectionMatrix * mvPosition;

                // Alpha based on distance to camera
                float dist = length(mvPosition.xyz);
                vAlpha = smoothstep(12.0, 3.0, dist) * 0.6;

                // Color mix based on position and scene
                float colorT = hash(aPhase + float(uSceneIndex)) + uSceneProgress * 0.3;
                vec3 c1 = mix(vec3(0.42, 0.25, 0.63), vec3(0.23, 0.56, 0.84), colorT);
                vec3 c2 = mix(vec3(1.0, 0.42, 0.62), vec3(0.23, 0.56, 0.84), colorT * 0.5);
                vColor = mix(c1, c2, sin(aPhase + t * 0.3) * 0.5 + 0.5);
            }
        `,
        fragmentShader: /* glsl */ `
            varying float vAlpha;
            varying vec3 vColor;

            void main() {
                // Soft circle
                vec2 center = gl_PointCoord - 0.5;
                float dist = length(center);
                if (dist > 0.5) discard;

                float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    return {
        mesh: points,
        uniforms: material.uniforms,
        setUniforms(sceneIndex, sceneProgress) {
            material.uniforms.uSceneIndex.value = sceneIndex;
            material.uniforms.uSceneProgress.value = sceneProgress;
        },
        updateTime(time) {
            material.uniforms.uTime.value = time;
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}
