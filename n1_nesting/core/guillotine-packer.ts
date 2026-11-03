/**
 * Silnik rozkroju GILOTYNOWEGO pod piłę panelową (formatyzacja).
 *
 * Arkusz dzielony jest w pierwszej kolejności na PASY pełnej długości
 * (pierwszy przejazd piły), a dopiero w obrębie pasa umieszczane są formatki
 * (drugi przejazd). Dzięki temu rozkrój jest ZAWSZE wykonalny na pile
 * panelowej — każde cięcie biegnie od krawędzi do krawędzi (cięcie gilotynowe).
 *
 * Uwaga: wszystkie wymiary w nanometrach (nm). Rozmiary formatek (w_nm/h_nm)
 * są już powiększone o rzaz (kerf), co daje poprawny odstęp między detalami.
 */

export interface GuillotineRect {
    id: string;
    partId: string;
    originalName: string;
    sourceNodeId?: string;
    containerId?: string;
    blokId?: string;
    furnitureName?: string;
    material?: string;
    thickness?: number;
    thickness_nm?: number;
    w_nm: number;       // z rzazem w nm
    h_nm: number;       // z rzazem w nm
    realW_nm: number;   // bez rzazu w nm
    realH_nm: number;   // bez rzazu w nm
    canRotate: boolean;
    area_nm2: number;
}

/** Kierunek pasów: poziome (pełna szerokość) lub pionowe (pełna wysokość). */
export type ShelfAxis = 'horizontal' | 'vertical';

/** Heurystyka kolejności formatek przed rozkrojem. */
export type ShelfOrder = 'stack' | 'area' | 'along' | 'longest' | 'perimeter' | 'min_dim' | 'aspect' | 'random';

export type AnchorPref = 'auto' | 'max_stack' | 'min_stack';

export interface GuillotinePlacement {
    rect: GuillotineRect;
    x_nm: number;       // pozycja X (bez marginesu obcięcia)
    y_nm: number;       // pozycja Y (bez marginesu obcięcia)
    w_nm: number;       // rzeczywisty wymiar X (bez rzazu)
    h_nm: number;       // rzeczywisty wymiar Y (bez rzazu)
    rotated: boolean;   // czy formatka obrócona o 90° względem orientacji wejściowej
    band: number;       // indeks pasa w obrębie arkusza (0-based)
}

interface Oriented {
    along: number;
    stack: number;
    rotated: boolean;
}

interface RawPlacement {
    rect: GuillotineRect;
    posAlong: number;
    posStack: number;
    alongSize: number;
    stackSize: number;
    rotated: boolean;
    band: number;
}

function shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/**
 * Dobiera orientację formatki tak, aby zmieściła się w polu (maxAlong x maxStack).
 * Gdy targetStack jest określony, preferuje orientację minimalizującą odpad wysokości w pasie.
 */
function orient(
    rect: GuillotineRect,
    axis: ShelfAxis,
    maxAlong: number,
    maxStack: number,
    randomize: boolean,
    targetStack?: number,
    anchorPref: AnchorPref = 'auto'
): Oriented | null {
    // 'horizontal': pas biegnie wzdłuż X (along = szerokość, stack = wysokość)
    // 'vertical':   pas biegnie wzdłuż Y (along = wysokość,  stack = szerokość)
    const normal: Oriented = axis === 'horizontal'
        ? { along: rect.w_nm, stack: rect.h_nm, rotated: false }
        : { along: rect.h_nm, stack: rect.w_nm, rotated: false };
    const rotated: Oriented = axis === 'horizontal'
        ? { along: rect.h_nm, stack: rect.w_nm, rotated: true }
        : { along: rect.w_nm, stack: rect.h_nm, rotated: true };

    const normalFits = normal.along <= maxAlong && normal.stack <= maxStack;
    const rotatedFits = rect.canRotate && rotated.along <= maxAlong && rotated.stack <= maxStack;

    if (normalFits && rotatedFits) {
        if (randomize && Math.random() > 0.5) return rotated;
        if (targetStack !== undefined) {
            // Dopasowanie do istniejącego pasa: minimalizuj pustą przestrzeń w pasie (shelfStack - stack)
            const diffNormal = Math.abs(targetStack - normal.stack);
            const diffRotated = Math.abs(targetStack - rotated.stack);
            if (diffRotated < diffNormal) return rotated;
            if (diffNormal < diffRotated) return normal;
            // Przy remisie: wybierz tę orientację, która zajmuje mniej długości pasa (oszczędza X dla kolejnych detali)
            return rotated.along <= normal.along ? rotated : normal;
        }
        if (anchorPref === 'min_stack') {
            return normal.stack <= rotated.stack ? normal : rotated;
        }
        if (anchorPref === 'max_stack') {
            return normal.stack >= rotated.stack ? normal : rotated;
        }
        return normal;
    }
    if (normalFits) return normal;
    if (rotatedFits) return rotated;
    return null;
}

function sortRects(rects: GuillotineRect[], axis: ShelfAxis, order: ShelfOrder): GuillotineRect[] {
    const arr = rects.slice();
    const stackKey = (r: GuillotineRect) => (axis === 'horizontal' ? r.h_nm : r.w_nm);
    switch (order) {
        case 'stack':
            arr.sort((a, b) => stackKey(b) - stackKey(a));
            break;
        case 'along':
            arr.sort((a, b) => (axis === 'horizontal' ? b.w_nm - a.w_nm : b.h_nm - a.h_nm));
            break;
        case 'area':
            arr.sort((a, b) => b.area_nm2 - a.area_nm2);
            break;
        case 'longest':
            arr.sort((a, b) => Math.max(b.w_nm, b.h_nm) - Math.max(a.w_nm, a.h_nm));
            break;
        case 'perimeter':
            arr.sort((a, b) => (b.w_nm + b.h_nm) - (a.w_nm + a.h_nm));
            break;
        case 'min_dim':
            arr.sort((a, b) => Math.min(b.w_nm, b.h_nm) - Math.min(a.w_nm, a.h_nm));
            break;
        case 'aspect':
            arr.sort((a, b) => {
                const aspectA = Math.max(a.w_nm, a.h_nm) / Math.max(1, Math.min(a.w_nm, a.h_nm));
                const aspectB = Math.max(b.w_nm, b.h_nm) / Math.max(1, Math.min(b.w_nm, b.h_nm));
                return aspectB - aspectA;
            });
            break;
        case 'random':
            shuffle(arr);
            break;
    }
    return arr;
}

/**
 * Pakuje formatki w serię arkuszy metodą "pas + gilotyna".
 * Zwraca tablicę arkuszy; każdy arkusz to lista rozmieszczeń w układzie arkusza.
 */
export function packGuillotine(
    rects: GuillotineRect[],
    usableW_nm: number,
    usableH_nm: number,
    axis: ShelfAxis,
    order: ShelfOrder,
    randomize: boolean,
    anchorPref: AnchorPref = 'auto'
): GuillotinePlacement[][] {
    if (rects.length === 0) return [];

    const usableAlong = axis === 'horizontal' ? usableW_nm : usableH_nm;
    const usableStack = axis === 'horizontal' ? usableH_nm : usableW_nm;

    const remaining = sortRects(rects, axis, order);
    const sheets: RawPlacement[][] = [];

    let guard = 0;
    while (remaining.length > 0 && guard++ < 100000) {
        const placements: RawPlacement[] = [];
        let usedStack = 0;
        let band = 0;

        while (remaining.length > 0) {
            // Wybierz formatkę-kotwicę pasa
            let anchorIdx = -1;
            let anchorOrient: Oriented | null = null;
            for (let k = 0; k < remaining.length; k++) {
                const o = orient(remaining[k], axis, usableAlong, usableStack - usedStack, randomize, undefined, anchorPref);
                if (o) {
                    anchorIdx = k;
                    anchorOrient = o;
                    break;
                }
            }
            if (anchorIdx === -1) break; // brak miejsca w pionie — zamknij arkusz

            const shelfStack = anchorOrient!.stack;
            const anchor = remaining[anchorIdx];
            let usedAlong = anchorOrient!.along;

            placements.push({
                rect: anchor,
                posAlong: 0,
                posStack: usedStack,
                alongSize: anchorOrient!.along,
                stackSize: anchorOrient!.stack,
                rotated: anchorOrient!.rotated,
                band
            });
            remaining.splice(anchorIdx, 1);

            // Dopełnij pas kolejnymi formatkami przy użyciu Best-Fit (najlepsze dopasowanie do wysokości pasa i długości)
            let shelfDone = false;
            while (!shelfDone && remaining.length > 0) {
                let bestIdx = -1;
                let bestOrient: Oriented | null = null;
                let bestScore = Infinity;

                for (let i = 0; i < remaining.length; i++) {
                    const o = orient(remaining[i], axis, usableAlong - usedAlong, shelfStack, randomize, shelfStack);
                    if (o) {
                        const heightWaste = shelfStack - o.stack;
                        // Score: minimalizuj stratę wysokości pasa, a przy zbliżonej stracie preferuj lepsze wypełnienie długości
                        const lengthLeft = usableAlong - usedAlong - o.along;
                        const score = heightWaste * 1000000 + lengthLeft;
                        if (score < bestScore) {
                            bestScore = score;
                            bestIdx = i;
                            bestOrient = o;
                            if (heightWaste === 0 && lengthLeft === 0) {
                                break;
                            }
                        }
                    }
                }

                if (bestIdx !== -1 && bestOrient) {
                    placements.push({
                        rect: remaining[bestIdx],
                        posAlong: usedAlong,
                        posStack: usedStack,
                        alongSize: bestOrient.along,
                        stackSize: bestOrient.stack,
                        rotated: bestOrient.rotated,
                        band
                    });
                    usedAlong += bestOrient.along;
                    remaining.splice(bestIdx, 1);
                } else {
                    shelfDone = true;
                }
            }

            usedStack += shelfStack;
            band++;
            if (usedStack >= usableStack) break;
        }

        if (placements.length === 0) break; // zabezpieczenie przed pętlą
        sheets.push(placements);
    }

    return sheets.map((sheet) => sheet.map((p) => toPlacement(p, axis)));
}

function toPlacement(p: RawPlacement, axis: ShelfAxis): GuillotinePlacement {
    const realW = p.rotated ? p.rect.realH_nm : p.rect.realW_nm;
    const realH = p.rotated ? p.rect.realW_nm : p.rect.realH_nm;

    if (axis === 'horizontal') {
        return {
            rect: p.rect,
            x_nm: p.posAlong,
            y_nm: p.posStack,
            w_nm: realW,
            h_nm: realH,
            rotated: p.rotated,
            band: p.band
        };
    }

    return {
        rect: p.rect,
        x_nm: p.posStack,
        y_nm: p.posAlong,
        w_nm: realW,
        h_nm: realH,
        rotated: p.rotated,
        band: p.band
    };
}
