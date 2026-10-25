import Lenis from 'lenis';

// ─── Scroll integration: Lenis + ScrollTrigger (R-005) ────
// Single animation loop: Lenis.update(dt) + ScrollTrigger.checkAll()
// 5 scenes mapped to scroll positions.

const SECTION_IDS = ['hero', 'morph', 'flow', 'palette', 'contact'];

let lenis = null;
let scrollTriggers = [];
let sectionOffsets = [];
let scrollHeight = 0;

export function initScroll() {
    // Initialize Lenis with smooth scrolling
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        smoothTouch: false,
    });

    // Register GSAP ScrollTrigger with Lenis
    if (typeof gsap !== 'undefined' && gsap.plugins && gsap.plugins.scrollTrigger) {
        // Already registered by GSAP init
    }

    // Build section offset map
    sectionOffsets = SECTION_IDS.map(id => {
        const el = document.getElementById(id);
        return el ? el.offsetTop : 0;
    });

    scrollHeight = window.innerHeight;

    return {
        getCurrentScene,
        updateScrollPosition,
        render,
    };
}

function getCurrentScene() {
    const scrollY = lenis ? lenis.scroll : 0;
    let sceneIndex = 0;
    let sceneProgress = 0;

    for (let i = SECTION_IDS.length - 1; i >= 0; i--) {
        const offset = sectionOffsets[i];
        if (scrollY >= offset) {
            sceneIndex = i;
            const nextOffset = i < SECTION_IDS.length - 1 ? sectionOffsets[i + 1] : offset + scrollHeight;
            const sceneHeight = nextOffset - offset;
            sceneProgress = sceneHeight > 0 ? (scrollY - offset) / sceneHeight : 0;
            break;
        }
    }

    return { sceneIndex, sceneProgress };
}

function updateScrollPosition(target) {
    if (lenis) {
        lenis.scrollTo(target, { immediate: true });
    }
}

function render() {
    if (lenis) {
        lenis.render();
    }
}

// ─── GSAP ScrollTrigger setup (R-005) ────────────────────
// Triggers for each scene section — used for scene detection.
export function setupScrollTrigger() {
    if (typeof gsap === 'undefined') return;

    const ScrollTrigger = gsap.plugins?.scrollTrigger;
    if (!ScrollTrigger) return;

    ScrollTrigger.create({
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        onEnter: () => {},
        onEnterBack: () => {},
        onUpdate: (self) => {},
    });

    ScrollTrigger.create({
        trigger: '#morph',
        start: 'top top',
        end: 'bottom top',
    });

    ScrollTrigger.create({
        trigger: '#flow',
        start: 'top top',
        end: 'bottom top',
    });

    ScrollTrigger.create({
        trigger: '#palette',
        start: 'top top',
        end: 'bottom top',
    });

    ScrollTrigger.create({
        trigger: '#contact',
        start: 'top top',
        end: 'bottom top',
    });
}
