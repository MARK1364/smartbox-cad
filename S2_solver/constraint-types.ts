/**
 * constraint-types.ts — trwały model więzów (to, co ląduje w pliku projektu).
 *
 * Różni się od `core/contract.ts` w jednej istotnej rzeczy: kontrakt rdzenia
 * adresuje geometrię surowymi indeksami (`vertA`, `faceA`), a te indeksy w web
 * NIE są stabilne — siatki są regenerowane przy każdej zmianie wymiaru.
 * Dlatego trwale zapisujemy `ConstraintAnchor`, czyli odwołanie po stabilnym
 * `CADNode.id` plus nazwa ściany albo numer narożnika bryły. Mapowanie kotwic
 * na indeksy rdzenia robi `solver-bridge.ts`, świeżo przy każdym solve.
 *
 * Jednostki: milimetry (`groundPosMm`, `offsetMm`).
 */

import { emptyConstraintResidual, type BindType, type ConstraintResidual } from './core/contract.js';
import type { Vec3 } from './core/math3d.js';

/**
 * Rodzaj elementu, do którego przyczepiony jest więz. Dla GROUND ten rodzaj
 * wyznacza zarazem `groundMode` w kontrakcie rdzenia.
 */
export type AnchorKind = 'OBJECT' | 'VERTEX' | 'FACE';

/**
 * Numeracja narożników bryły lokalnej: bit 0 = X, bit 1 = Y, bit 2 = Z,
 * gdzie 0 oznacza minimum, a 1 maksimum danej osi. Narożnik 0 to (min, min, min),
 * narożnik 7 to (max, max, max).
 */
export const CORNER_COUNT = 8;

export interface ConstraintAnchor {
    /**
     * Bryła sztywna, którą rusza solver: korpus SmartFrame, gdy formatka
     * należy do korpusu; sama formatka tylko gdy jest luźna (bez rodzica ASSEMBLY).
     */
    nodeId: string;
    kind: AnchorKind;
    /** Nazwa kanoniczna ściany dla `kind === 'FACE'`, w pozostałych przypadkach ''. */
    faceName: string;
    /** Numer narożnika 0..7 dla `kind === 'VERTEX'`, w pozostałych przypadkach -1. */
    cornerIndex: number;
    /**
     * Formatka, z której wzięto ścianę / naroże, gdy `nodeId` to korpus.
     * Solver rusza korpus; geometria liczona jest z tej formatki.
     */
    sourceNodeId?: string;
    /**
     * Snapshot geometrii w LCS bryły sztywnej [mm] (po mapowaniu z formatki).
     * Dla żywej geometrii punkt jest rzutowany na aktualną nazwaną ścianę, więc
     * kotwica podąża za zmianą wymiarów. Snapshot pozostaje fallbackiem po
     * utracie źródłowej formatki i zachowuje styczne położenie picka.
     */
    localPointMm?: Vec3;
    localNormalMm?: Vec3;
    /** Oś szerokości prostokąta podglądu w LCS bryły sztywnej. */
    localUAxisMm?: Vec3;
    /** Oś wysokości prostokąta podglądu w LCS bryły sztywnej. */
    localVAxisMm?: Vec3;
    /** Środek prostokąta podglądu — środek klikniętej ściany, nie punkt picka. */
    quadCenterMm?: Vec3;
    quadWidthMm?: number;
    quadHeightMm?: number;
}

export interface SolverConstraint {
    id: string;
    bindType: BindType;
    enabled: boolean;
    anchorA: ConstraintAnchor | null;
    anchorB: ConstraintAnchor | null;
    /**
     * Punkt uziemienia [mm, WCS]. `null` znaczy „zatrzaśnij tam, gdzie element
     * jest teraz" — bridge dopisuje wtedy aktualną pozycję przy pierwszym solve.
     * Blender używał w tej roli sentinela (0,0,0), co uniemożliwiało uziemienie
     * w rzeczywistym początku układu.
     */
    groundPosMm: Vec3 | null;
    /** Normalna uziemienia [WCS] dla trybu FACE. `null` — jak wyżej. */
    groundNormal: Vec3 | null;
    /** Dystans między płaszczyznami dla COPLANAR/FLUSH [mm]. */
    offsetMm: number;
    /** Runtime: więz wygaszony jako sprzeczny. Nie jest serializowany. */
    conflict: boolean;
    /** Runtime: reszta błędu po ostatnim solve. Nie jest serializowana. */
    residual: ConstraintResidual;
}

export function makeAnchor(init: Partial<ConstraintAnchor> & { nodeId: string; kind: AnchorKind }): ConstraintAnchor {
    return {
        faceName: '',
        cornerIndex: -1,
        ...init,
    };
}

export function makeSolverConstraint(
    init: Partial<SolverConstraint> & { id: string; bindType: BindType },
): SolverConstraint {
    return {
        enabled: true,
        anchorA: null,
        anchorB: null,
        groundPosMm: null,
        groundNormal: null,
        offsetMm: 0,
        conflict: false,
        residual: emptyConstraintResidual(),
        ...init,
    };
}

/** Kotwice uzupełnione — więz można rozwiązywać / odrzucić jako sprzeczny. */
export function constraintHasGeometry(constraint: SolverConstraint): boolean {
    if (constraint.bindType === 'GROUND') {
        return Boolean(constraint.anchorA);
    }
    return Boolean(constraint.anchorA && constraint.anchorB);
}

/** Zbiera identyfikatory węzłów, do których odwołuje się więz. */
export function constraintNodeIds(constraint: SolverConstraint): string[] {
    const ids: string[] = [];
    if (constraint.anchorA) ids.push(constraint.anchorA.nodeId);
    if (constraint.anchorB) ids.push(constraint.anchorB.nodeId);
    return ids;
}
