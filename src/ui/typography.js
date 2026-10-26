// ─── Kinetic typography (E4 / R-007) ───────────────────────────────
// GSAP + ScrollTrigger (loaded here, in the UI layer).
//  - Hero title: character split, staged reveal after the loader,
//    then scroll-scrubbed drift + tracking in the hero scene.
//  - Section labels/titles/copy: clip-reveal on enter, subtle parallax.
// Splitting is manual (no SplitText plugin): each word → .kin-line,
// each char → .kin-char.
// E5b: skip animations when prefers-reduced-motion.

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function split(el) {
    const text = el.textContent;
    el.textContent = '';
    const words = text.split(/\s+/).filter(Boolean);
    words.forEach((word, wi) => {
        const line = document.createElement('span');
        line.className = 'kin-line';
        [...word].forEach((ch) => {
            const c = document.createElement('span');
            c.className = 'kin-char';
            c.textContent = ch;
            line.append(c);
        });
        el.append(line);
        if (wi < words.length - 1) el.append(document.createTextNode(' '));
    });
    return el.querySelectorAll('.kin-char');
}

export function initKineticType() {
    let revealed = false;

    // E5b: skip GSAP animations when reduced-motion is preferred
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
        // Ensure all kinetic elements are immediately visible
        document.querySelectorAll('[data-kinetic]').forEach((el) => {
            el.style.opacity = '';
            el.style.transform = '';
        });
        const heroTitle = document.getElementById('hero-title');
        if (heroTitle) {
            heroTitle.style.opacity = '';
            heroTitle.style.transform = '';
        }
        return { reveal: () => {} };
    }

    const heroTitle = document.getElementById('hero-title');
    const heroChars = heroTitle ? split(heroTitle) : [];

    // Scroll-scrubbed hero drift (runs whenever the hero scrolls out)
    if (heroTitle) {
        gsap.fromTo(
            heroTitle,
            { yPercent: 0, letterSpacing: '-0.02em' },
            {
                yPercent: -18,
                letterSpacing: '0em',
                ease: 'none',
                scrollTrigger: {
                    trigger: '#hero',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: 1,
                },
            }
        );
    }

    // Reveal on enter for every [data-kinetic] block
    document.querySelectorAll('[data-kinetic]').forEach((el) => {
        if (el === heroTitle) return; // handled by reveal()
        gsap.fromTo(
            el,
            { yPercent: 60, opacity: 0 },
            {
                yPercent: 0,
                opacity: 1,
                duration: 0.9,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 82%',
                    toggleActions: 'play none none reverse',
                },
            }
        );
    });

    // Subtle parallax on section titles
    document.querySelectorAll('.section-title').forEach((el) => {
        gsap.fromTo(
            el,
            { yPercent: 8 },
            {
                yPercent: -8,
                ease: 'none',
                scrollTrigger: {
                    trigger: el.closest('.section') || el,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 1,
                },
            }
        );
    });

    function reveal() {
        if (revealed) return;
        revealed = true;
        if (heroChars.length) {
            gsap.fromTo(
                heroChars,
                { yPercent: 110 },
                { yPercent: 0, duration: 1.1, stagger: 0.045, ease: 'power4.out' }
            );
        }
        gsap.fromTo(
            '.hero-label, .hero-sub',
            { yPercent: 40, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 1, stagger: 0.12, delay: 0.25, ease: 'power3.out' }
        );
    }

    return { reveal };
}
