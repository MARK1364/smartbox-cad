import { useEffect, useState } from 'react';

const LAYOUT_REGIONS = [
    { id: 'drzewo-obiektow', name: 'Drzewo obiektów' },
    { id: 'belka-widokowa', name: 'Belka widokowa' },
    { id: 'panel-edycji', name: 'Panel edycji' },
] as const;

/** Pas wokół ramki (px) — od strony sceny, nie wnętrze panelu. */
const EDGE_OUTSIDE_PX = 10;
/** Cienki pas na samej ramce (px). */
const EDGE_INSIDE_PX = 3;
const SHOW_DELAY_MS = 420;

function nameAtEdge(x: number, y: number): string | null {
    let hit: string | null = null;
    for (const { id, name } of LAYOUT_REGIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const outside = x < r.left || x > r.right || y < r.top || y > r.bottom;
        if (outside) {
            const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
            const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
            if (Math.hypot(dx, dy) <= EDGE_OUTSIDE_PX) hit = name;
        } else {
            const inward = Math.min(x - r.left, r.right - x, y - r.top, r.bottom - y);
            if (inward <= EDGE_INSIDE_PX) hit = name;
        }
    }
    return hit;
}

/** Podpowiedź szkoleniowa tylko przy krawędzi regionu — nie przy pracy wewnątrz. */
export function useUiRegionEdgeHint(): string | null {
    const [hint, setHint] = useState<string | null>(null);

    useEffect(() => {
        let hover: string | null = null;
        let shown: string | null = null;
        let timer: number | null = null;

        const apply = (next: string | null) => {
            if (next === hover) return;
            hover = next;
            if (timer != null) {
                window.clearTimeout(timer);
                timer = null;
            }
            if (!next) {
                shown = null;
                setHint(null);
                return;
            }
            if (shown === next) return;
            timer = window.setTimeout(() => {
                shown = next;
                setHint(next);
            }, SHOW_DELAY_MS);
        };

        const onMove = (e: MouseEvent) => apply(nameAtEdge(e.clientX, e.clientY));
        window.addEventListener('mousemove', onMove, { passive: true });
        return () => {
            window.removeEventListener('mousemove', onMove);
            if (timer != null) window.clearTimeout(timer);
        };
    }, []);

    return hint;
}
