/**
 * Twarda Blokada Kolizji i Clamping (Hard Collision Blocking) dla modułu Nestingu
 * Uniemożliwia fizyczne najechanie formatki na formatkę lub wyjechanie za arkusz,
 * gwarantując zachowanie dokładnego rzazu (kerf) i marginesów cięcia w osiach X i Y,
 * z pełną obsługą obrotu pod dowolnym kątem (0°, 90°, 180°, 270°, 15° itp.).
 *
 * Obsługuje precyzyjne obliczenia w nanometrach (nm, 1 mm = 1 000 000 nm)
 * oraz w milimetrach (mm) dla warstwy widoku SVG.
 */

import { PackedPart } from './nesting-types';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units';

export interface PartAABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    w: number;
    h: number;
}

/**
 * Oblicza prostokąt otaczający (AABB) formatki w przestrzeni arkusza
 * z uwzględnieniem kąta obrotu wokół jej środka.
 */
export function getPartAABB(
    p: PackedPart,
    overrideX?: number,
    overrideY?: number
): PartAABB {
    const posX = overrideX !== undefined ? overrideX : p.x;
    const posY = overrideY !== undefined ? overrideY : p.y;
    const w = p.w;
    const h = p.h;
    const angle = p.rotationAngle ?? 0;

    const angleNorm = ((angle % 360) + 360) % 360;
    if (angleNorm === 0 || angleNorm === 180) {
        return {
            minX: posX,
            minY: posY,
            maxX: posX + w,
            maxY: posY + h,
            w,
            h
        };
    }

    if (angleNorm === 90 || angleNorm === 270) {
        const cx = posX + w / 2;
        const cy = posY + h / 2;
        return {
            minX: cx - h / 2,
            minY: cy - w / 2,
            maxX: cx + h / 2,
            maxY: cy + w / 2,
            w: h,
            h: w
        };
    }

    const angleRad = (angleNorm * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));

    const effW = Math.round((w * cos + h * sin) * 1e6) / 1e6;
    const effH = Math.round((w * sin + h * cos) * 1e6) / 1e6;

    const cx = posX + w / 2;
    const cy = posY + h / 2;

    const minX = cx - effW / 2;
    const minY = cy - effH / 2;
    const maxX = cx + effW / 2;
    const maxY = cy + effH / 2;

    return {
        minX,
        minY,
        maxX,
        maxY,
        w: effW,
        h: effH
    };
}

/**
 * Oblicza AABB formatki w nanometrach (nm)
 */
export function getPartAABBNm(
    p: PackedPart,
    overrideXNm?: number,
    overrideYNm?: number
): PartAABB {
    const posX = overrideXNm !== undefined ? overrideXNm : (p.x_nm ?? mmToNm(p.x));
    const posY = overrideYNm !== undefined ? overrideYNm : (p.y_nm ?? mmToNm(p.y));
    const w = p.w_nm ?? mmToNm(p.w);
    const h = p.h_nm ?? mmToNm(p.h);
    const angle = p.rotationAngle ?? 0;

    const angleNorm = ((angle % 360) + 360) % 360;
    if (angleNorm === 0 || angleNorm === 180) {
        return {
            minX: posX,
            minY: posY,
            maxX: posX + w,
            maxY: posY + h,
            w,
            h
        };
    }

    if (angleNorm === 90 || angleNorm === 270) {
        const cx = posX + Math.round(w / 2);
        const cy = posY + Math.round(h / 2);
        return {
            minX: cx - Math.round(h / 2),
            minY: cy - Math.round(w / 2),
            maxX: cx + Math.round(h / 2),
            maxY: cy + Math.round(w / 2),
            w: h,
            h: w
        };
    }

    const angleRad = (angleNorm * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));

    const effW = Math.round(w * cos + h * sin);
    const effH = Math.round(w * sin + h * cos);

    const cx = posX + Math.round(w / 2);
    const cy = posY + Math.round(h / 2);

    const minX = cx - Math.round(effW / 2);
    const minY = cy - Math.round(effH / 2);
    const maxX = cx + Math.round(effW / 2);
    const maxY = cy + Math.round(effH / 2);

    return {
        minX,
        minY,
        maxX,
        maxY,
        w: effW,
        h: effH
    };
}

/**
 * Sprawdza czy dwa prostokąty nachodzą na siebie (z uwzględnieniem rzazu kerf).
 * Używa tolerancji numerycznej eps (domyślnie 0.05 mm), aby idealny styk z rzazem kerf
 * nie był błędnie kwalifikowany jako kolizja / nakładanie.
 */
export function checkPartsOverlap(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number,
    kerf: number = 0,
    eps: number = 0.05
): boolean {
    const effectiveKerf = Math.max(0, kerf - eps);
    return (
        x1 < x2 + w2 + effectiveKerf &&
        x1 + w1 + effectiveKerf > x2 &&
        y1 < y2 + h2 + effectiveKerf &&
        y1 + h1 + effectiveKerf > y2
    );
}

/**
 * Sprawdza czy dwa prostokąty nachodzą na siebie w nanometrach (nm)
 */
export function checkPartsOverlapNm(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number,
    kerfNm: number = 0,
    epsNm: number = 50_000 // 0.05 mm = 50 000 nm
): boolean {
    const effectiveKerf = Math.max(0, kerfNm - epsNm);
    return (
        x1 < x2 + w2 + effectiveKerf &&
        x1 + w1 + effectiveKerf > x2 &&
        y1 < y2 + h2 + effectiveKerf &&
        y1 + h1 + effectiveKerf > y2
    );
}

/**
 * Sprawdza czy formatka na pozycji (posX, posY) koliduje z inną płytą lub wystaje za arkusz
 */
export function isPositionColliding(
    draggedPart: PackedPart,
    posX: number,
    posY: number,
    otherParts: PackedPart[],
    boardW: number,
    boardH: number,
    kerf: number = 4,
    trimMargin: number = 10,
    eps: number = 0.05
): boolean {
    const draggedAABB = getPartAABB(draggedPart, posX, posY);

    // 1. Granice arkusza (z tolerancją eps)
    if (draggedAABB.minX < trimMargin - eps || draggedAABB.maxX > boardW - trimMargin + eps) return true;
    if (draggedAABB.minY < trimMargin - eps || draggedAABB.maxY > boardH - trimMargin + eps) return true;

    // 2. Inne formatki z uwzględnieniem rzazu kerf i tolerancji
    for (const other of otherParts) {
        if (other.partId === draggedPart.partId) continue;
        const otherAABB = getPartAABB(other);
        if (checkPartsOverlap(
            draggedAABB.minX, draggedAABB.minY, draggedAABB.w, draggedAABB.h,
            otherAABB.minX, otherAABB.minY, otherAABB.w, otherAABB.h,
            kerf,
            eps
        )) {
            return true;
        }
    }

    return false;
}

/**
 * Znajduje maksymalną dozwoloną pozycję w osi X przy stałym Y
 */
function findValidX(
    startX: number,
    destX: number,
    fixedY: number,
    draggedPart: PackedPart,
    others: PackedPart[],
    boardW: number,
    boardH: number,
    kerf: number,
    trimMargin: number
): number {
    const draggedAABB = getPartAABB(draggedPart);
    const effW = draggedAABB.w;
    const effH = draggedAABB.h;
    const offsetX = (draggedPart.w - effW) / 2;
    const offsetY = (draggedPart.h - effH) / 2;

    const minPosX = trimMargin - offsetX;
    const maxPosX = Math.max(minPosX, boardW - trimMargin - effW - offsetX);

    let target = Math.max(minPosX, Math.min(maxPosX, destX));

    if (!isPositionColliding(draggedPart, target, fixedY, others, boardW, boardH, kerf, trimMargin)) {
        return target;
    }

    const curMinX = startX + offsetX;

    for (const other of others) {
        if (other.partId === draggedPart.partId) continue;
        const otherAABB = getPartAABB(other);
        const overlapsY = (fixedY + offsetY < otherAABB.maxY + kerf) && (fixedY + offsetY + effH + kerf > otherAABB.minY);
        if (!overlapsY) continue;

        if (target > startX) {
            // Ruch w prawo -> zatrzymaj się przed przeszkodą po prawej
            if (otherAABB.minX >= curMinX + effW) {
                const stopAABBMinX = otherAABB.minX - effW - kerf;
                const stopX = stopAABBMinX - offsetX;
                if (stopX >= startX && stopX < target) {
                    target = stopX;
                }
            }
        } else if (target < startX) {
            // Ruch w lewo -> zatrzymaj się za przeszkodą po lewej
            if (otherAABB.maxX <= curMinX) {
                const stopAABBMinX = otherAABB.maxX + kerf;
                const stopX = stopAABBMinX - offsetX;
                if (stopX <= startX && stopX > target) {
                    target = stopX;
                }
            }
        }
    }

    target = Math.max(minPosX, Math.min(maxPosX, target));
    if (!isPositionColliding(draggedPart, target, fixedY, others, boardW, boardH, kerf, trimMargin)) {
        return target;
    }
    return startX;
}

/**
 * Znajduje maksymalną dozwoloną pozycję w osi Y przy stałym X
 */
function findValidY(
    startY: number,
    destY: number,
    fixedX: number,
    draggedPart: PackedPart,
    others: PackedPart[],
    boardW: number,
    boardH: number,
    kerf: number,
    trimMargin: number
): number {
    const draggedAABB = getPartAABB(draggedPart);
    const effW = draggedAABB.w;
    const effH = draggedAABB.h;
    const offsetX = (draggedPart.w - effW) / 2;
    const offsetY = (draggedPart.h - effH) / 2;

    const minPosY = trimMargin - offsetY;
    const maxPosY = Math.max(minPosY, boardH - trimMargin - effH - offsetY);

    let target = Math.max(minPosY, Math.min(maxPosY, destY));

    if (!isPositionColliding(draggedPart, fixedX, target, others, boardW, boardH, kerf, trimMargin)) {
        return target;
    }

    const curMinY = startY + offsetY;

    for (const other of others) {
        if (other.partId === draggedPart.partId) continue;
        const otherAABB = getPartAABB(other);
        const overlapsX = (fixedX + offsetX < otherAABB.maxX + kerf) && (fixedX + offsetX + effW + kerf > otherAABB.minX);
        if (!overlapsX) continue;

        if (target > startY) {
            // Ruch w dół (rosnące Y)
            if (otherAABB.minY >= curMinY + effH) {
                const stopAABBMinY = otherAABB.minY - effH - kerf;
                const stopY = stopAABBMinY - offsetY;
                if (stopY >= startY && stopY < target) {
                    target = stopY;
                }
            }
        } else if (target < startY) {
            // Ruch w górę (malejące Y)
            if (otherAABB.maxY <= curMinY) {
                const stopAABBMinY = otherAABB.maxY + kerf;
                const stopY = stopAABBMinY - offsetY;
                if (stopY <= startY && stopY > target) {
                    target = stopY;
                }
            }
        }
    }

    target = Math.max(minPosY, Math.min(maxPosY, target));
    if (!isPositionColliding(draggedPart, fixedX, target, others, boardW, boardH, kerf, trimMargin)) {
        return target;
    }
    return startY;
}

/**
 * Twarda blokada kolizji (Hard Collision Clamping):
 * Zatrzymuje formatkę dokładnie na krawędzi przeszkody z rzazem kerf
 * oraz pozwala na płynny, symetryczny ślizg w osi X i Y,
 * w pełni uwzględniając aktualny kąt obrotu formatki (0°, 90°, 180°, 270°, 15° itp.).
 */
export function resolveClampedMovePosition(
    draggedPart: PackedPart,
    targetX: number,
    targetY: number,
    currX: number,
    currY: number,
    otherParts: PackedPart[],
    boardW: number,
    boardH: number,
    kerf: number = 4,
    trimMargin: number = 10
): { x: number; y: number } {
    const aabb = getPartAABB(draggedPart);
    const offsetX = (draggedPart.w - aabb.w) / 2;
    const offsetY = (draggedPart.h - aabb.h) / 2;

    const minX = trimMargin - offsetX;
    const maxX = Math.max(minX, boardW - trimMargin - aabb.w - offsetX);
    const minY = trimMargin - offsetY;
    const maxY = Math.max(minY, boardH - trimMargin - aabb.h - offsetY);

    const clampedTargetX = Math.max(minX, Math.min(maxX, targetX));
    const clampedTargetY = Math.max(minY, Math.min(maxY, targetY));

    // Jeśli pozycja docelowa jest bezkolizyjna -> natychmiastowa akceptacja
    if (!isPositionColliding(draggedPart, clampedTargetX, clampedTargetY, otherParts, boardW, boardH, kerf, trimMargin)) {
        return { x: clampedTargetX, y: clampedTargetY };
    }

    // Wypróbuj ścieżkę X -> Y oraz Y -> X
    const x1 = findValidX(currX, clampedTargetX, currY, draggedPart, otherParts, boardW, boardH, kerf, trimMargin);
    const y1 = findValidY(currY, clampedTargetY, x1, draggedPart, otherParts, boardW, boardH, kerf, trimMargin);

    const y2 = findValidY(currY, clampedTargetY, currX, draggedPart, otherParts, boardW, boardH, kerf, trimMargin);
    const x2 = findValidX(currX, clampedTargetX, y2, draggedPart, otherParts, boardW, boardH, kerf, trimMargin);

    const dist1 = Math.hypot(clampedTargetX - x1, clampedTargetY - y1);
    const dist2 = Math.hypot(clampedTargetX - x2, clampedTargetY - y2);

    const bestCandidate = dist1 <= dist2 ? { x: x1, y: y1 } : { x: x2, y: y2 };

    if (!isPositionColliding(draggedPart, bestCandidate.x, bestCandidate.y, otherParts, boardW, boardH, kerf, trimMargin)) {
        return bestCandidate;
    }

    if (!isPositionColliding(draggedPart, x1, currY, otherParts, boardW, boardH, kerf, trimMargin)) {
        return { x: x1, y: currY };
    }

    if (!isPositionColliding(draggedPart, currX, y2, otherParts, boardW, boardH, kerf, trimMargin)) {
        return { x: currX, y: y2 };
    }

    return { x: currX, y: currY };
}
