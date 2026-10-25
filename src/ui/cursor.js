// ─── Magnetic cursor (E4 / R-007) ──────────────────────────────────
// Custom cursor: instant dot + lagged ring. Elements marked
// [data-magnet] attract the ring (and lean toward the pointer).
// Desktop only (fine pointer); native cursor otherwise.

export function initCursor() {
    if (!window.matchMedia('(pointer: fine)').matches) return null;

    const dot = document.createElement('div');
    dot.id = 'cursor-dot';
    const ring = document.createElement('div');
    ring.id = 'cursor-ring';
    document.body.append(dot, ring);
    document.body.classList.add('has-custom-cursor');

    let mx = -100, my = -100;      // raw pointer
    let rx = -100, ry = -100;      // ring (eased)
    let seen = false;
    let magnet = null;             // the [data-magnet] element under the pointer, if any

    window.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
        seen = true;
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
        seen = false;
        dot.style.opacity = '0';
        ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
        if (seen) { dot.style.opacity = ''; ring.style.opacity = ''; }
    });

    window.addEventListener('mousedown', () => document.body.classList.add('is-pressing'));
    window.addEventListener('mouseup', () => document.body.classList.remove('is-pressing'));

    // Hover state (ring expands) for interactive elements
    const hoverSel = 'a, button, input, textarea, .palette-card, [data-hover]';
    document.addEventListener('mouseover', (e) => {
        document.body.classList.toggle('is-hovering', !!e.target.closest(hoverSel));
    });

    // Magnetic elements: cursor is pulled toward the element center,
    // the element leans toward the pointer.
    const magnets = [...document.querySelectorAll('[data-magnet]')];
    magnets.forEach((el) => {
        el.addEventListener('mouseenter', () => { magnet = el; });
        el.addEventListener('mouseleave', () => {
            if (magnet === el) magnet = null;
            el.style.transform = '';
        });
        el.addEventListener('mousemove', (e) => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dx = cx - e.clientX;
            const dy = cy - e.clientY;
            // Lean the element toward the pointer (subtle)
            el.style.transform = `translate(${dx * -0.06}px, ${dy * -0.06}px)`;
        });
    });
    const noMagnet = () => { magnet = null; };
    window.addEventListener('scroll', noMagnet, { passive: true });

    function tick() {
        requestAnimationFrame(tick);
        if (!seen) return;

        // Ease the ring toward the pointer
        rx += (mx - rx) * 0.16;
        ry += (my - ry) * 0.16;

        let ox = 0, oy = 0;
        if (magnet) {
            const r = magnet.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            ox = (cx - mx) * 0.35;
            oy = (cy - my) * 0.35;
        }

        dot.style.transform = `translate(${mx + ox * 0.4}px, ${my + oy * 0.4}px) translate(-50%, -50%)`;
        ring.style.transform = `translate(${rx + ox}px, ${ry + oy}px) translate(-50%, -50%)`;
    }
    tick();

    return { dot, ring };
}
