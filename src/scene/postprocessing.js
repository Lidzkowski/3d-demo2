import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// ─── Chromatic Aberration Shader ─────────────────────────────
// Subtle RGB channel separation, stronger at edges.
const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        uIntensity: { value: 0.002 },
        uResolution: { value: new THREE.Vector2() },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uIntensity;
        uniform vec2 uResolution;
        varying vec2 vUv;

        void main() {
            vec2 center = vUv - 0.5;
            float dist = length(center);
            vec2 direction = normalize(center) * dist * uIntensity;

            // RGB channel offsets
            float r = texture2D(tDiffuse, vUv + direction * 1.5).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - direction * 1.5).b;

            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `,
};

// ─── Post-Processing Setup ───────────────────────────────────
export function createPostProcessing(renderer, scene, camera, width, height, quality = 'high') {
    const composer = new EffectComposer(renderer);

    // Base scene render
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom: subtle glow
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        quality === 'high' ? 0.6 : 0.3,   // strength
        quality === 'high' ? 0.4 : 0.2,   // radius
        quality === 'high' ? 0.85 : 0.7   // threshold
    );
    composer.addPass(bloomPass);

    // Chromatic aberration (only high quality)
    let caPass = null;
    if (quality === 'high') {
        caPass = new ShaderPass(ChromaticAberrationShader);
        caPass.uniforms.uResolution.value.set(width, height);
        composer.addPass(caPass);
    }

    return {
        composer,
        bloomPass,
        caPass,
        setQuality(quality) {
            // Update bloom
            bloomPass.strength = quality === 'high' ? 0.6 : 0.3;
            bloomPass.radius = quality === 'high' ? 0.4 : 0.2;
            bloomPass.threshold = quality === 'high' ? 0.85 : 0.7;

            // Toggle chromatic aberration
            if (caPass) {
                if (quality === 'low') {
                    composer.removePass(caPass);
                    caPass = null;
                }
            } else if (quality === 'high') {
                caPass = new ShaderPass(ChromaticAberrationShader);
                caPass.uniforms.uResolution.value.set(width, height);
                composer.addPass(caPass);
            }
        },
        setSize(w, h) {
            composer.setSize(w, h);
            if (caPass) {
                caPass.uniforms.uResolution.value.set(w, h);
            }
        },
        getPasses() {
            return { bloomPass, caPass };
        },
        dispose() {
            composer.dispose();
        },
    };
}
