import * as THREE from 'three';

// ─── 3D Simplex Noise (compact GLSL implementation) ───────────
const simplexNoiseGLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a cube
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

// ─── Shader Material: 3D noise displacement + glass-metal TSL ─
export function createBlobMaterial() {
  const vertexShader = `
    uniform float uTime;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;

    ${simplexNoiseGLSL}

    void main() {
      vUv = uv;
      vNormal = normal;

      // Multi-octave noise for organic displacement
      float noiseVal = snoise(position * 0.8 + uTime * 0.25);
      float displacement = noiseVal * 0.35;

      // Second octave for detail
      float detail = snoise(position * 2.0 + uTime * 0.4) * 0.08;
      displacement += detail;

      vDisplacement = displacement;
      vec3 newPosition = position + normal * displacement;
      vPosition = newPosition;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vPosition);

      // Fresnel effect
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

      // Displacement-based color blending
      float t = vDisplacement * 1.5 + 0.5;
      vec3 baseColor = mix(uColor1, uColor2, smoothstep(0.0, 0.5, t));
      baseColor = mix(baseColor, uColor3, smoothstep(0.5, 1.0, t));

      // Glass-metal hybrid: fresnel adds rim glow, base is dark metallic
      vec3 glassColor = mix(baseColor, vec3(1.0), fresnel * 0.6);

      // Subtle iridescence from displacement
      float iridescence = sin(vDisplacement * 8.0 + uTime * 0.5) * 0.5 + 0.5;
      glassColor += vec3(0.1, 0.05, 0.15) * iridescence * fresnel;

      gl_FragColor = vec4(glassColor, 0.92);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#1a0a2e') },  // Deep purple
      uColor2: { value: new THREE.Color('#0d4f6e') },  // Teal
      uColor3: { value: new THREE.Color('#2d1b69') },  // Violet
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  return material;
}

// ─── Geometry: high-poly icosahedron ────────────────────────
export function createBlobGeometry(detail = 64) {
  return new THREE.IcosahedronGeometry(1.8, detail);
}

// ─── Scene setup: blob + lights ─────────────────────────────
export function createBlobScene() {
  const scene = new THREE.Scene();
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

  return scene;
}

// ─── Animation helpers ──────────────────────────────────────
export function animateBlob(mesh, clock) {
  const elapsed = clock.getElapsedTime();

  // Update shader time
  mesh.material.uniforms.uTime.value = elapsed;

  // Gentle rotation
  mesh.rotation.y = elapsed * 0.1;
  mesh.rotation.x = Math.sin(elapsed * 0.07) * 0.1;
}
