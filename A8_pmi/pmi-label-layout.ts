/**
 * Rozsuwanie nachodzących etykiet PMI na ekranie.
 *
 * Billboardy są płaskie w widoku kamery, więc nakładanie wykrywamy
 * po prostokątach 2D (środek + szerokość/wysokość w pikselach).
 */

export interface ScreenLabel {
    id: string;
    /** Środek na ekranie [px]. */
    x: number;
    y: number;
    w: number;
    h: number;
}

export const LABEL_OVERLAP_PAD_PX = 10;

export function boxesOverlap(a: ScreenLabel, b: ScreenLabel, pad = LABEL_OVERLAP_PAD_PX): boolean {
    return Math.abs(a.x - b.x) * 2 < a.w + b.w + pad
        && Math.abs(a.y - b.y) * 2 < a.h + b.h + pad;
}

function overlapAmounts(a: ScreenLabel, b: ScreenLabel, pad: number): { x: number; y: number } {
    return {
        x: (a.w + b.w + pad) / 2 - Math.abs(a.x - b.x),
        y: (a.h + b.h + pad) / 2 - Math.abs(a.y - b.y),
    };
}

/**
 * Przesuwa etykiety tak, by prostokąty nie nachodziły.
 * Każda etykieta startuje od swojej preferowanej pozycji; późniejsze
 * (niżej / bardziej w prawo) ustępują wcześniejszym.
 */
export function resolveLabelOverlaps(
    labels: ScreenLabel[],
    pad = LABEL_OVERLAP_PAD_PX,
): ScreenLabel[] {
    if (labels.length < 2) return labels.map(l => ({ ...l }));

    const out = labels.map(l => ({ ...l }));
    out.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));

    for (let i = 1; i < out.length; i++) {
        const cur = out[i];
        for (let guard = 0; guard < 48; guard++) {
            let hit: ScreenLabel | null = null;
            for (let j = 0; j < i; j++) {
                if (boxesOverlap(cur, out[j], pad)) {
                    hit = out[j];
                    break;
                }
            }
            if (!hit) break;

            const overlap = overlapAmounts(cur, hit, pad);
            if (overlap.y <= overlap.x + 0.5) {
                const gap = (hit.h + cur.h + pad) / 2;
                cur.y = cur.y >= hit.y ? hit.y + gap : hit.y - gap;
            } else {
                const gap = (hit.w + cur.w + pad) / 2;
                cur.x = cur.x >= hit.x ? hit.x + gap : hit.x - gap;
            }
        }
    }

    return out;
}
