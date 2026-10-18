/**
 * Plan cięcia dla rozkroju GILOTYNOWEGO (piła panelowa).
 *
 * Na podstawie gotowego arkusza (PackedBoard z `band` na formatkach i
 * `shelfAxis`) odtwarza uporządkowaną sekwencję cięć wykonalnych na pile:
 *   1) przycięcie 4 marginesów,
 *   2) cięcia rozdzielające pasy (pierwszy przejazd),
 *   3) cięcia poprzeczne w pasie (drugi przejazd) + docięcia zwalniające
 *      formatki niższe niż wysokość pasa.
 *
 * Każde cięcie biegnie od krawędzi do krawędzi (cięcie gilotynowe). Kolejność
 * cięć pozwala odtworzyć animację: „piła" przejeżdża przez arkusz, a formatki
 * odcinają się jedna po drugiej. Wszystkie wymiary w mm.
 */

import { PackedBoard, PackedPart } from './nesting-types';

export type CutKind = 'trim' | 'rip' | 'cross';
export type CutAxis = 'horizontal' | 'vertical';
export type ShelfAxis = 'horizontal' | 'vertical';

export interface CutStep {
    order: number;          // numer kroku (1-based) — kolejność na maszynie
    kind: CutKind;          // 'trim' | 'rip' (wzdłuż pasa) | 'cross' (poprzeczne)
    dir: CutAxis;           // 'horizontal' = linia pozioma (stałe Y), 'vertical' = stała X
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label: string;          // opis dla operatora
    band: number;           // numer pasa (1-based, 0 = przycięcie marginesu)
    releases: string[];     // instanceId formatek uwolnionych po tym cięciu
    partKey?: string;       // instanceId formatki, której dotyczy cięcie (cross / docięcie)
}

/** Klucz instancji formatki — unikalny dla każdej sztuki. */
export function partInstanceKey(p: PackedPart): string {
    return p.instanceId || p.partId;
}

export interface BoardCutPlan {
    boardIndex: number;
    axis: ShelfAxis;
    usableX: number;
    usableY: number;
    usableW: number;
    usableH: number;
    bands: number;
    totalCuts: number;
    partsCount: number;
    steps: CutStep[];
}

const EPS = 0.5; // mm — tolerancja porównania wymiarów

function r1(v: number): number {
    return Math.round(v * 10) / 10;
}

/**
 * Buduje plan cięcia dla arkusza. Zwraca null dla arkusza bez struktury pasów
 * (np. rozkrój CNC / MaxRects), który nie jest gilotynowy.
 */
export function buildBoardCutPlan(board: PackedBoard, onlyPartKey?: string): BoardCutPlan | null {
    if (!board || !board.layout || board.layout.length === 0) return null;
    if (board.shelfAxis !== 'horizontal' && board.shelfAxis !== 'vertical') return null;

    const axis = board.shelfAxis;
    const parts = board.layout;
    const isH = axis === 'horizontal';

    const usableX = Math.min(...parts.map((p) => p.x));
    const usableY = Math.min(...parts.map((p) => p.y));
    const usableW = board.width - 2 * usableX;
    const usableH = board.height - 2 * usableY;

    // Grupowanie formatek w pasy (band)
    const bandMap = new Map<number, PackedPart[]>();
    parts.forEach((p) => {
        const b = typeof p.band === 'number' ? p.band : 0;
        if (!bandMap.has(b)) bandMap.set(b, []);
        bandMap.get(b)!.push(p);
    });
    const bandKeys = Array.from(bandMap.keys()).sort((a, b) => a - b);

    const stackStart = (p: PackedPart) => (isH ? p.y : p.x);
    const stackSize = (p: PackedPart) => (isH ? p.h : p.w);
    const alongStart = (p: PackedPart) => (isH ? p.x : p.y);
    const alongSize = (p: PackedPart) => (isH ? p.w : p.h);

    const steps: CutStep[] = [];
    const push = (s: Omit<CutStep, 'order'>) => steps.push({ order: steps.length + 1, ...s });

    // 1) Przycięcie krawędzi odniesienia — tylko lewa i górna (baza pomiaru).
    //    Odpad z prawej/dolnej strony odpada razem z ostatnim pasem, więc
    //    brzegowanie po stronie odpadu jest zbędne.
    push({ kind: 'trim', dir: 'vertical', x1: usableX, y1: 0, x2: usableX, y2: board.height, label: `Przycięcie krawędzi — lewa (X=${r1(usableX)} mm)`, band: 0, releases: [] });
    push({ kind: 'trim', dir: 'horizontal', x1: usableX, y1: usableY, x2: board.width, y2: usableY, label: `Przycięcie krawędzi — górna (Y=${r1(usableY)} mm)`, band: 0, releases: [] });

    // 2) Pasy + cięcia poprzeczne
    bandKeys.forEach((key, bi) => {
        const bp = bandMap.get(key)!.slice().sort((a, b) => alongStart(a) - alongStart(b));
        const bStart = Math.min(...bp.map(stackStart));
        const bEnd = Math.max(...bp.map((p) => stackStart(p) + stackSize(p)));
        const bandNo = bi + 1;

        // Odcięcie pasa od reszty materiału. Pas ostatni odcina się od odpadu
        // (dolnego/prawego), stąd cięcie wykonujemy dla KAŻDEGO pasa.
        if (isH) {
            push({ kind: 'rip', dir: 'horizontal', x1: usableX, y1: bEnd, x2: board.width, y2: bEnd, label: `Cięcie pasa ${bandNo}/${bandKeys.length} (Y=${r1(bEnd)} mm)`, band: bandNo, releases: [] });
        } else {
            push({ kind: 'rip', dir: 'vertical', x1: bEnd, y1: usableY, x2: bEnd, y2: board.height, label: `Cięcie pasa ${bandNo}/${bandKeys.length} (X=${r1(bEnd)} mm)`, band: bandNo, releases: [] });
        }

        bp.forEach((p, pi) => {
            const aStart = alongStart(p);
            const aEnd = aStart + alongSize(p);

            // Pozycja cięcia — w środku rzazu między sąsiadami.
            let cutAlong = aEnd;
            if (pi < bp.length - 1) {
                const gap = alongStart(bp[pi + 1]) - aEnd;
                if (gap > 0) cutAlong = aEnd + gap / 2;
            }

            const fullStack = Math.abs(stackSize(p) - (bEnd - bStart)) < EPS;

            if (isH) {
                push({
                    kind: 'cross',
                    dir: 'vertical',
                    x1: cutAlong, y1: bStart, x2: cutAlong, y2: bEnd,
                    label: `Cięcie poprzeczne pas ${bandNo}: ${p.name} (X=${r1(cutAlong)} mm)`,
                    band: bandNo,
                    releases: fullStack ? [partInstanceKey(p)] : [],
                    partKey: partInstanceKey(p)
                });
                if (!fullStack) {
                    const sCut = stackStart(p) + stackSize(p);
                    push({
                        kind: 'rip', dir: 'horizontal',
                        x1: aStart, y1: sCut, x2: aEnd, y2: sCut,
                        label: `Docięcie formatki: ${p.name} (Y=${r1(sCut)} mm)`,
                        band: bandNo,
                        releases: [partInstanceKey(p)],
                        partKey: partInstanceKey(p)
                    });
                }
            } else {
                push({
                    kind: 'cross',
                    dir: 'horizontal',
                    x1: bStart, y1: cutAlong, x2: bEnd, y2: cutAlong,
                    label: `Cięcie poprzeczne pas ${bandNo}: ${p.name} (Y=${r1(cutAlong)} mm)`,
                    band: bandNo,
                    releases: fullStack ? [partInstanceKey(p)] : [],
                    partKey: partInstanceKey(p)
                });
                if (!fullStack) {
                    const sCut = stackStart(p) + stackSize(p);
                    push({
                        kind: 'rip', dir: 'vertical',
                        x1: sCut, y1: aStart, x2: sCut, y2: aEnd,
                        label: `Docięcie formatki: ${p.name} (X=${r1(sCut)} mm)`,
                        band: bandNo,
                        releases: [partInstanceKey(p)],
                        partKey: partInstanceKey(p)
                    });
                }
            }
        });
    });

    // Filtr pojedynczej formatki: zostaw tylko cięcia potrzebne do jej odcięcia.
    let finalSteps = steps;
    if (onlyPartKey) {
        const target = parts.find((p) => partInstanceKey(p) === onlyPartKey);
        if (!target) return null;
        const tBandNo = (typeof target.band === 'number' ? target.band : 0) + 1;
        const targetAlong = alongStart(target);

        // Cięcie poprzeczne poprzedzającej formatki = lewa/górna krawędź docelowej.
        let prevCross: CutStep | undefined;
        steps.forEach((s) => {
            if (s.kind !== 'cross' || s.band !== tBandNo || s.partKey === onlyPartKey) return;
            const along = isH ? s.x1 : s.y1;
            if (along > targetAlong + EPS) return;
            const prevAlong = prevCross ? (isH ? prevCross.x1 : prevCross.y1) : -Infinity;
            if (along > prevAlong) prevCross = s;
        });

        const keep = new Set<number>();
        steps.forEach((s) => {
            const isBandCut = s.kind === 'rip' && !s.partKey;
            const keepTrim = s.kind === 'trim';
            const keepBand = isBandCut && (s.band === tBandNo || s.band === tBandNo - 1);
            const keepCross = s.kind === 'cross' && s.band === tBandNo && (s.partKey === onlyPartKey || s === prevCross);
            const keepRip = s.kind === 'rip' && s.partKey === onlyPartKey;
            if (keepTrim || keepBand || keepCross || keepRip) keep.add(s.order);
        });

        finalSteps = steps.filter((s) => keep.has(s.order)).map((s, i) => ({ ...s, order: i + 1 }));
    }

    return {
        boardIndex: board.boardIndex,
        axis,
        usableX,
        usableY,
        usableW,
        usableH,
        bands: bandKeys.length,
        totalCuts: finalSteps.length,
        partsCount: onlyPartKey ? 1 : parts.length,
        steps: finalSteps
    };
}

/**
 * Zbiór formatek uwolnionych po wykonaniu pierwszych `stepCount` kroków.
 */
export function releasedPartIds(plan: BoardCutPlan, stepCount: number): Set<string> {
    const set = new Set<string>();
    const limit = Math.min(stepCount, plan.steps.length);
    for (let i = 0; i < limit; i++) {
        plan.steps[i].releases.forEach((id) => set.add(id));
    }
    return set;
}
