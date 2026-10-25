// ─── Palettes (E4 / R-006) ─────────────────────────────────────────
// Three palettes switched inside the Palette scene (scene index 3).
// Owns the UI accent colors (CSS custom properties) and the blob
// color stops (scene material palette interface — see blob.js setPalette).
// Deterministic: palette = f(current scene). Outside the Palette scene
// the interface rests on the default palette.

import * as THREE from 'three';

export const PALETTES = [
    {
        id: 'p0',
        name: 'Violet Drift',
        // Blob gradient stops: [interior, mid, peaks] — matches E2 default
        blob: [0x080214, 0x0d4f6e, 0x2d1b69],
    },
    {
        id: 'p1',
        name: 'Ember Glass',
        blob: [0x120503, 0x7c2d12, 0x86198f],
    },
    {
        id: 'p2',
        name: 'Glacier',
        blob: [0x03121f, 0x0e7490, 0x312e81],
    },
];

const PALETTE_SCENE_INDEX = 3; // '#palette' in the scene map

const _color = new THREE.Color();
const _target = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _current = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

export function initUIPalette(getScene, applyBlobColors) {
    let active = 0;

    function setStop(v, hex) {
        _color.setHex(hex);
        v.set(_color.r, _color.g, _color.b);
    }

    function select(index) {
        if (index === active || index < 0 || index >= PALETTES.length) return;
        active = index;
        const palette = PALETTES[index];
        // UI accents — CSS variables, transitioned by the stylesheet
        document.documentElement.dataset.palette = palette.id;
        for (let i = 0; i < 3; i++) setStop(_target[i], palette.blob[i]);
        // Palette cards — highlight the current one
        document.querySelectorAll('[data-palette-card]').forEach((el) => {
            el.classList.toggle('is-active', Number(el.dataset.paletteCard) === index);
        });
    }

    // Initialize current AND target at the default palette.
    // (select() early-returns when the index is unchanged, so it must
    // not be the only thing initializing _target.)
    for (let i = 0; i < 3; i++) {
        setStop(_current[i], PALETTES[0].blob[i]);
        setStop(_target[i], PALETTES[0].blob[i]);
    }
    document.documentElement.dataset.palette = PALETTES[0].id;
    document.querySelectorAll('[data-palette-card]').forEach((el) => {
        el.classList.toggle('is-active', Number(el.dataset.paletteCard) === 0);
    });

    // Call once per frame (dt in seconds): re-derive target from the scene,
    // ease the blob stops toward it, apply while moving.
    function update(dt) {
        const scene = getScene();
        let target = 0;
        if (scene && scene.sceneIndex === PALETTE_SCENE_INDEX) {
            const p = Math.min(1, Math.max(0, scene.sceneProgress ?? 0));
            target = Math.min(PALETTES.length - 1, Math.floor(p * PALETTES.length));
        }
        select(target);

        // Exponential ease of the blob stops toward the target
        const k = 1 - Math.exp(-dt * 4);
        let moving = false;
        for (let i = 0; i < 3; i++) {
            const c = _current[i];
            if (c.distanceTo(_target[i]) > 0.0015) {
                c.lerp(_target[i], k);
                moving = true;
            }
        }
        if (moving && typeof applyBlobColors === 'function') {
            const stops = _current.map((v) => _color.setRGB(v.r, v.g, v.b).getHex());
            applyBlobColors(stops);
        }
    }

    select(0);
    return { update, select };
}
