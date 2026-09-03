/**
 * Algorytm pakowania 2D Maximal Rectangles (MaxRects)
 * Standard branżowy dla rozkroju płyt i nestingu CNC.
 * Oparty na heurystyce BSSF (Best Short Side Fit).
 */

import { Rect2D } from './nesting-types';

export interface InsertResult {
    node: Rect2D | null;
    rotated: boolean;
}

export class BinPacker {
    public readonly width: number;
    public readonly height: number;
    public freeRects: Rect2D[];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
    }

    /**
     * Wstawia prostokąt o wymiarach w x h.
     * @param w Szerokość formatki (wraz z rzazem)
     * @param h Wysokość formatki (wraz z rzazem)
     * @param canRotate Czy dopuszcza się obrót o 90 stopni
     */
    public insert(w: number, h: number, canRotate: boolean): InsertResult {
        let bestNode: Rect2D | null = null;
        let bestScore1 = Infinity;
        let bestScore2 = Infinity;
        let rotated = false;

        const tryFit = (fw: number, fh: number, isRotated: boolean, fr: Rect2D) => {
            if (fw <= fr.w && fh <= fr.h) {
                const leftoverW = fr.w - fw;
                const leftoverH = fr.h - fh;
                const shortSide = Math.min(leftoverW, leftoverH);
                const areaFit = fr.w * fr.h - fw * fh;

                // Szukamy najlepszego dopasowania po krótszym boku (BSSF)
                if (shortSide < bestScore1 || (shortSide === bestScore1 && areaFit < bestScore2)) {
                    bestScore1 = shortSide;
                    bestScore2 = areaFit;
                    bestNode = { x: fr.x, y: fr.y, w: fw, h: fh };
                    rotated = isRotated;
                }
            }
        };

        // Przeszukaj wszystkie dostępne "wolne" prostokąty
        for (let i = 0; i < this.freeRects.length; i++) {
            const fr = this.freeRects[i];
            tryFit(w, h, false, fr);
            if (canRotate) {
                tryFit(h, w, true, fr);
            }
        }

        if (!bestNode) {
            return { node: null, rotated: false };
        }

        // Podziel wszystkie przecinające się wolne prostokąty
        let numRectsToProcess = this.freeRects.length;
        for (let i = 0; i < numRectsToProcess; i++) {
            if (this.splitFreeNode(this.freeRects[i], bestNode)) {
                this.freeRects.splice(i, 1);
                i--;
                numRectsToProcess--;
            }
        }

        this.pruneFreeList();
        return { node: bestNode, rotated };
    }

    /**
     * Dzieli wolny prostokąt, jeśli nakłada się z zajętym węzłem.
     */
    private splitFreeNode(freeNode: Rect2D, usedNode: Rect2D): boolean {
        // Sprawdź czy następuje kolizja
        if (
            usedNode.x >= freeNode.x + freeNode.w ||
            usedNode.x + usedNode.w <= freeNode.x ||
            usedNode.y >= freeNode.y + freeNode.h ||
            usedNode.y + usedNode.h <= freeNode.y
        ) {
            return false;
        }

        // Podział w osi pionowej
        if (usedNode.x < freeNode.x + freeNode.w && usedNode.x + usedNode.w > freeNode.x) {
            if (usedNode.y > freeNode.y && usedNode.y < freeNode.y + freeNode.h) {
                const newNode: Rect2D = { ...freeNode };
                newNode.h = usedNode.y - newNode.y;
                this.freeRects.push(newNode);
            }
            if (usedNode.y + usedNode.h < freeNode.y + freeNode.h) {
                const newNode: Rect2D = { ...freeNode };
                newNode.y = usedNode.y + usedNode.h;
                newNode.h = freeNode.y + freeNode.h - (usedNode.y + usedNode.h);
                this.freeRects.push(newNode);
            }
        }

        // Podział w osi poziomej
        if (usedNode.y < freeNode.y + freeNode.h && usedNode.y + usedNode.h > freeNode.y) {
            if (usedNode.x > freeNode.x && usedNode.x < freeNode.x + freeNode.w) {
                const newNode: Rect2D = { ...freeNode };
                newNode.w = usedNode.x - newNode.x;
                this.freeRects.push(newNode);
            }
            if (usedNode.x + usedNode.w < freeNode.x + freeNode.w) {
                const newNode: Rect2D = { ...freeNode };
                newNode.x = usedNode.x + usedNode.w;
                newNode.w = freeNode.x + freeNode.w - (usedNode.x + usedNode.w);
                this.freeRects.push(newNode);
            }
        }

        return true;
    }

    /**
     * Usuwa wolne prostokąty, które zawierają się w innych wolnych prostokątach.
     */
    private pruneFreeList(): void {
        for (let i = 0; i < this.freeRects.length; i++) {
            for (let j = i + 1; j < this.freeRects.length; j++) {
                if (this.isContainedIn(this.freeRects[i], this.freeRects[j])) {
                    this.freeRects.splice(i, 1);
                    i--;
                    break;
                }
                if (this.isContainedIn(this.freeRects[j], this.freeRects[i])) {
                    this.freeRects.splice(j, 1);
                    j--;
                }
            }
        }
    }

    /**
     * Sprawdza czy prostokąt 'a' w całości mieści się w prostokącie 'b'.
     */
    private isContainedIn(a: Rect2D, b: Rect2D): boolean {
        return (
            a.x >= b.x &&
            a.y >= b.y &&
            a.x + a.w <= b.x + b.w &&
            a.y + a.h <= b.y + b.h
        );
    }
}
