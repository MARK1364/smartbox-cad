/**
 * D1_draw - draw-dimensions.ts
 * Automatyczne wymiarowanie 2D CAD oraz renderer wektorowy wymiarów SVG.
 */

import { Draw2DDimension, Draw2DView } from './draw-types';
import type { CabinetGeometryPart } from '../A3_smartframe/smartframe-engine';

export class DrawDimensionsEngine {
    /**
     * Generuje automatyczną siatkę wymiarów CAD dla rzutów.
     */
    public static generateAutoDimensions(
        views: Draw2DView[],
        cabinetW: number,
        cabinetH: number,
        cabinetD: number,
        parts: CabinetGeometryPart[]
    ): void {
        for (const view of views) {
            view.dimensions = [];

            if (view.projection === 'FRONT') {
                this._addFrontDimensions(view, cabinetW, cabinetH, parts);
            } else if (view.projection === 'TOP') {
                this._addTopDimensions(view, cabinetW, cabinetD, parts);
            } else if (view.projection === 'RIGHT') {
                this._addSideDimensions(view, cabinetD, cabinetH, parts);
            }
        }
    }

    /**
     * Wymiary dla rzutu z przodu:
     * 1. Gabaryt szerokości na dole (0, H -> W, H)
     * 2. Gabaryt wysokości po lewej (0, 0 -> 0, H)
     * 3. Wymiary cząstkowe stref / półek po prawej
     */
    private static _addFrontDimensions(
        view: Draw2DView,
        w: number,
        h: number,
        parts: CabinetGeometryPart[]
    ): void {
        // 1. Główny wymiar szerokości (na dole)
        view.dimensions.push({
            id: 'dim_front_overall_w',
            x1: 0,
            y1: h,
            x2: w,
            y2: h,
            valueMm: w,
            text: `${Math.round(w)}`,
            offsetMm: 12,
            orientation: 'HORIZONTAL',
            isAuto: true,
        });

        // 2. Główny wymiar wysokości (po lewej stronie)
        view.dimensions.push({
            id: 'dim_front_overall_h',
            x1: 0,
            y1: 0,
            x2: 0,
            y2: h,
            valueMm: h,
            text: `${Math.round(h)}`,
            offsetMm: -12,
            orientation: 'VERTICAL',
            isAuto: true,
        });

        // 3. Wymiary podziału wewnętrznego (półki i wieńce)
        const shelves = parts
            .filter((p) => p.role === 'SHELF' || p.name?.toLowerCase().includes('półka') || p.name?.toLowerCase().includes('wieniec'))
            .map((p) => ({
                name: p.name,
                y: (h / 2) - p.loc.y,
                thickness: p.thickness || 18,
            }))
            .sort((a, b) => a.y - b.y);

        if (shelves.length > 0) {
            let prevY = 0;
            shelves.forEach((shelf, idx) => {
                const shelfTopY = shelf.y - shelf.thickness / 2;
                const dist = shelfTopY - prevY;
                if (dist > 30) {
                    view.dimensions.push({
                        id: `dim_front_shelf_${idx}`,
                        x1: w,
                        y1: prevY,
                        x2: w,
                        y2: shelfTopY,
                        valueMm: Math.round(dist),
                        text: `${Math.round(dist)}`,
                        offsetMm: 12,
                        orientation: 'VERTICAL',
                        isAuto: true,
                    });
                }
                prevY = shelf.y + shelf.thickness / 2;
            });

            // Ostatni segment od ostatniej półki do dołu
            if (h - prevY > 30) {
                view.dimensions.push({
                    id: `dim_front_shelf_bottom`,
                    x1: w,
                    y1: prevY,
                    x2: w,
                    y2: h,
                    valueMm: Math.round(h - prevY),
                    text: `${Math.round(h - prevY)}`,
                    offsetMm: 12,
                    orientation: 'VERTICAL',
                    isAuto: true,
                });
            }
        }
    }

    /**
     * Wymiary dla rzutu z góry:
     * - Szerokość W (na dole)
     * - Głębokość D (po lewej)
     */
    private static _addTopDimensions(
        view: Draw2DView,
        w: number,
        d: number,
        parts: CabinetGeometryPart[]
    ): void {
        view.dimensions.push({
            id: 'dim_top_overall_w',
            x1: 0,
            y1: d,
            x2: w,
            y2: d,
            valueMm: w,
            text: `${Math.round(w)}`,
            offsetMm: 10,
            orientation: 'HORIZONTAL',
            isAuto: true,
        });

        view.dimensions.push({
            id: 'dim_top_overall_d',
            x1: 0,
            y1: 0,
            x2: 0,
            y2: d,
            valueMm: d,
            text: `${Math.round(d)}`,
            offsetMm: -10,
            orientation: 'VERTICAL',
            isAuto: true,
        });
    }

    /**
     * Wymiary dla rzutu z boku:
     * - Głębokość D (na dole)
     * - Wysokość H (po prawej)
     */
    private static _addSideDimensions(
        view: Draw2DView,
        d: number,
        h: number,
        parts: CabinetGeometryPart[]
    ): void {
        view.dimensions.push({
            id: 'dim_side_overall_d',
            x1: 0,
            y1: h,
            x2: d,
            y2: h,
            valueMm: d,
            text: `${Math.round(d)}`,
            offsetMm: 10,
            orientation: 'HORIZONTAL',
            isAuto: true,
        });

        view.dimensions.push({
            id: 'dim_side_overall_h',
            x1: d,
            y1: 0,
            x2: d,
            y2: h,
            valueMm: h,
            text: `${Math.round(h)}`,
            offsetMm: 10,
            orientation: 'VERTICAL',
            isAuto: true,
        });
    }

    /**
     * Renderuje wymiar do kodu SVG w układzie arkusza (z uwzględnieniem skali i pozycji rzutu).
     */
    public static renderDimensionSVG(
        dim: Draw2DDimension,
        viewX: number,
        viewY: number,
        scale: number
    ): string {
        const sx1 = viewX + dim.x1 * scale;
        const sy1 = viewY + dim.y1 * scale;
        const sx2 = viewX + dim.x2 * scale;
        const sy2 = viewY + dim.y2 * scale;

        const offset = dim.offsetMm; // w mm arkusza
        const extOverhang = 2.0;    // wystawienie linii pomocniczej za linię wymiaru w mm
        const arrowLen = 2.5;       // długość strzałki w mm
        const arrowW = 0.8;         // połowa szerokości strzałki w mm

        const lines: string[] = [];

        if (dim.orientation === 'HORIZONTAL') {
            const dy = sy1 + offset;
            const extYStart = Math.min(sy1, dy);
            const extYEnd = Math.max(sy1, dy) + (offset > 0 ? extOverhang : -extOverhang);

            // Linie pomocnicze (extension lines)
            lines.push(`<line x1="${sx1.toFixed(2)}" y1="${sy1.toFixed(2)}" x2="${sx1.toFixed(2)}" y2="${extYEnd.toFixed(2)}" stroke="#64748b" stroke-width="0.25"/>`);
            lines.push(`<line x1="${sx2.toFixed(2)}" y1="${sy2.toFixed(2)}" x2="${sx2.toFixed(2)}" y2="${extYEnd.toFixed(2)}" stroke="#64748b" stroke-width="0.25"/>`);

            // Główna linia wymiarowa
            lines.push(`<line x1="${sx1.toFixed(2)}" y1="${dy.toFixed(2)}" x2="${sx2.toFixed(2)}" y2="${dy.toFixed(2)}" stroke="#0284c7" stroke-width="0.35"/>`);

            // Groty strzałek (trójkąty)
            lines.push(`<polygon points="${sx1.toFixed(2)},${dy.toFixed(2)} ${(sx1 + arrowLen).toFixed(2)},${(dy - arrowW).toFixed(2)} ${(sx1 + arrowLen).toFixed(2)},${(dy + arrowW).toFixed(2)}" fill="#0284c7"/>`);
            lines.push(`<polygon points="${sx2.toFixed(2)},${dy.toFixed(2)} ${(sx2 - arrowLen).toFixed(2)},${(dy - arrowW).toFixed(2)} ${(sx2 - arrowLen).toFixed(2)},${(dy + arrowW).toFixed(2)}" fill="#0284c7"/>`);

            // Etykieta tekstu
            const midX = (sx1 + sx2) / 2;
            lines.push(`<text x="${midX.toFixed(2)}" y="${(dy - 1.2).toFixed(2)}" font-size="2.6" font-family="'Segoe UI', Arial, sans-serif" font-weight="600" text-anchor="middle" fill="#0369a1">${dim.text}</text>`);
        } else if (dim.orientation === 'VERTICAL') {
            const dx = sx1 + offset;
            const extXEnd = Math.max(sx1, dx) + (offset > 0 ? extOverhang : -extOverhang);

            // Linie pomocnicze
            lines.push(`<line x1="${sx1.toFixed(2)}" y1="${sy1.toFixed(2)}" x2="${extXEnd.toFixed(2)}" y2="${sy1.toFixed(2)}" stroke="#64748b" stroke-width="0.25"/>`);
            lines.push(`<line x1="${sx2.toFixed(2)}" y1="${sy2.toFixed(2)}" x2="${extXEnd.toFixed(2)}" y2="${sy2.toFixed(2)}" stroke="#64748b" stroke-width="0.25"/>`);

            // Główna linia wymiarowa
            lines.push(`<line x1="${dx.toFixed(2)}" y1="${sy1.toFixed(2)}" x2="${dx.toFixed(2)}" y2="${sy2.toFixed(2)}" stroke="#0284c7" stroke-width="0.35"/>`);

            // Groty strzałek
            lines.push(`<polygon points="${dx.toFixed(2)},${sy1.toFixed(2)} ${(dx - arrowW).toFixed(2)},${(sy1 + arrowLen).toFixed(2)} ${(dx + arrowW).toFixed(2)},${(sy1 + arrowLen).toFixed(2)}" fill="#0284c7"/>`);
            lines.push(`<polygon points="${dx.toFixed(2)},${sy2.toFixed(2)} ${(dx - arrowW).toFixed(2)},${(sy2 - arrowLen).toFixed(2)} ${(dx + arrowW).toFixed(2)},${(sy2 - arrowLen).toFixed(2)}" fill="#0284c7"/>`);

            // Etykieta tekstu obrócona o 90 stopni
            const midY = (sy1 + sy2) / 2;
            const textX = offset < 0 ? dx - 1.2 : dx + 3.0;
            lines.push(`<text x="${textX.toFixed(2)}" y="${midY.toFixed(2)}" font-size="2.6" font-family="'Segoe UI', Arial, sans-serif" font-weight="600" text-anchor="middle" transform="rotate(-90, ${textX.toFixed(2)}, ${midY.toFixed(2)})" fill="#0369a1">${dim.text}</text>`);
        }

        return lines.join('\n');
    }
}
