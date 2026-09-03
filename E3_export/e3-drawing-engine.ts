/**
 * E3_export - e3-drawing-engine.ts
 * Silnik arkusza CAD dla Eksport 3: zarządzanie rzutami, niezależna orientacja,
 * wektory 2D/3D z krawędziami CAD, wymiarami PMI, ramką ISO 7200 i eksportem SVG/JPG/PDF.
 */

import {
    E3PaperFormat,
    E3_PAPER_FORMATS,
    E3LibraryItem,
    E3PlacedView,
    E3ProjectionAngle,
    E3TitleBlock,
} from './e3-library-types';

export const MARGIN_LEFT = 20;
export const MARGIN_RIGHT = 5;
export const MARGIN_TOP = 5;
export const MARGIN_BOTTOM = 5;
export const TITLE_BLOCK_WIDTH = 120;
export const TITLE_BLOCK_HEIGHT = 30;

function v(n: number): string {
    return Number(n).toFixed(2);
}

export class E3DrawingEngine {
    private static _instance: E3DrawingEngine;

    public paperFormat: E3PaperFormat = 'A4_LANDSCAPE';
    public placedViews: E3PlacedView[] = [];
    public activeViewId: string | null = null;

    public titleBlock: E3TitleBlock = {
        projectName: 'Projekt Mebla CAD',
        furnitureName: 'Korpus Meblowy',
        author: 'SmartBox CAD',
        date: new Date().toISOString().split('T')[0],
        scale: '1:10',
        sheetNumber: '1/1',
        drawingNumber: 'SB-E3-001',
        remarks: '',
    };

    private _listeners: Set<() => void> = new Set();

    public static get instance(): E3DrawingEngine {
        if (!E3DrawingEngine._instance) {
            E3DrawingEngine._instance = new E3DrawingEngine();
        }
        return E3DrawingEngine._instance;
    }

    public subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _notify(): void {
        this._listeners.forEach((fn) => fn());
    }

    public setPaperFormat(format: E3PaperFormat): void {
        this.paperFormat = format;
        this._notify();
    }

    public setTitleBlock(info: Partial<E3TitleBlock>): void {
        this.titleBlock = { ...this.titleBlock, ...info };
        this._notify();
    }

    public setActiveViewId(id: string | null): void {
        this.activeViewId = id;
        this._notify();
    }

    /**
     * Dodaje nowy rzut modelu na arkusz.
     */
    public addViewFromLibraryItem(item: E3LibraryItem, angle: E3ProjectionAngle = 'front'): E3PlacedView {
        const dims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        
        // Oblicz optymalną domyślną skalę
        const maxDim = Math.max(item.width, item.height, item.depth, 100);
        let scale = 0.1; // 1:10
        if (maxDim > 1200) scale = 0.05; // 1:20
        else if (maxDim < 400) scale = 0.2; // 1:5

        // Wylicz pozycję na arkuszu tak, by kolejne rzuty nie nachodziły na siebie
        const count = this.placedViews.length;
        const col = count % 2;
        const row = Math.floor(count / 2);

        const defaultX = MARGIN_LEFT + 25 + col * 110;
        const defaultY = MARGIN_TOP + 30 + row * 80;

        const newView: E3PlacedView = {
            id: 'e3_view_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            sourceItemId: item.id,
            sourceItemName: item.name,
            itemType: item.type,
            dimX: item.width,
            dimY: item.height,
            dimZ: item.depth,
            sheetX: Math.min(defaultX, dims.width - 60),
            sheetY: Math.min(defaultY, dims.height - 60),
            angle,
            scale,
            showPMI: true,
            showCNC: true,
            showHiddenEdges: false,
            colorHex: item.colorHex || '#d97706',
            materialName: item.materialName || 'Laminat 18mm',
        };

        this.placedViews.push(newView);
        this.activeViewId = newView.id;
        this._notify();
        return newView;
    }

    public updateViewAngle(viewId: string, angle: E3ProjectionAngle): void {
        const v = this.placedViews.find((view) => view.id === viewId);
        if (v) {
            v.angle = angle;
            this._notify();
        }
    }

    public updateViewPosition(viewId: string, sheetX: number, sheetY: number): void {
        const v = this.placedViews.find((view) => view.id === viewId);
        if (v) {
            v.sheetX = sheetX;
            v.sheetY = sheetY;
            this._notify();
        }
    }

    public updateViewScale(viewId: string, scale: number): void {
        const v = this.placedViews.find((view) => view.id === viewId);
        if (v) {
            v.scale = Math.max(0.01, Math.min(1.0, scale));
            this._notify();
        }
    }

    public removeView(viewId: string): void {
        this.placedViews = this.placedViews.filter((view) => view.id !== viewId);
        if (this.activeViewId === viewId) {
            this.activeViewId = this.placedViews[0]?.id || null;
        }
        this._notify();
    }

    public clearAllViews(): void {
        this.placedViews = [];
        this.activeViewId = null;
        this._notify();
    }

    // ─── Generowanie Wektorowego Rysunku SVG ───

    public generateSvg(): string {
        const dims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const paperW = dims.width;
        const paperH = dims.height;

        const frameX = MARGIN_LEFT;
        const frameY = MARGIN_TOP;
        const frameW = paperW - MARGIN_LEFT - MARGIN_RIGHT;
        const frameH = paperH - MARGIN_TOP - MARGIN_BOTTOM;

        const parts: string[] = [];

        parts.push(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
            `width="${paperW}mm" height="${paperH}mm" viewBox="0 0 ${paperW} ${paperH}" ` +
            `style="background:#ffffff; font-family: 'Segoe UI', Arial, sans-serif;">`
        );

        // Białe tło
        parts.push(`<rect width="${v(paperW)}" height="${v(paperH)}" fill="#ffffff"/>`);

        // Ramka zewnętrzna (0.7 mm)
        parts.push(`<rect x="${v(frameX)}" y="${v(frameY)}" width="${v(frameW)}" height="${v(frameH)}" fill="none" stroke="#000000" stroke-width="0.7"/>`);

        // Ramka wewnętrzna (0.25 mm)
        const inset = 1.0;
        parts.push(`<rect x="${v(frameX + inset)}" y="${v(frameY + inset)}" width="${v(frameW - 2 * inset)}" height="${v(frameH - 2 * inset)}" fill="none" stroke="#000000" stroke-width="0.25"/>`);

        // ─── Rzutowanie każdego umieszczonego modelu ───
        for (const pv of this.placedViews) {
            parts.push(this._renderPlacedViewSvg(pv));
        }

        // ─── Tabelka Rysunkowa ISO 7200 ───
        parts.push(this._renderTitleBlockSvg(frameX + frameW - TITLE_BLOCK_WIDTH, frameY + frameH - TITLE_BLOCK_HEIGHT));

        parts.push('</svg>');
        return parts.join('\n');
    }

    private _renderPlacedViewSvg(pv: E3PlacedView): string {
        const { dimX, dimY, dimZ, scale, angle, sheetX, sheetY, sourceItemName, showPMI } = pv;

        // Obliczenie rzutu 2D/3D w mm w zależności od kąta
        let w = dimX * scale;
        let h = dimY * scale;
        let angleLabel = 'PRZÓD';

        switch (angle) {
            case 'front':
                w = dimX * scale;
                h = dimY * scale;
                angleLabel = 'RZUT Z PRZODU';
                break;
            case 'top':
                w = dimX * scale;
                h = dimZ * scale;
                angleLabel = 'RZUT Z GÓRY';
                break;
            case 'right':
                w = dimZ * scale;
                h = dimY * scale;
                angleLabel = 'RZUT Z PRAWEJ STRONY';
                break;
            case 'left':
                w = dimZ * scale;
                h = dimY * scale;
                angleLabel = 'RZUT Z LEWEJ STRONY';
                break;
            case 'back':
                w = dimX * scale;
                h = dimY * scale;
                angleLabel = 'RZUT Z TYŁU';
                break;
            case 'isometric':
                // Aksonometria CAD
                w = (dimX * 0.866 + dimZ * 0.866) * scale;
                h = (dimY + (dimX + dimZ) * 0.5) * scale * 0.75;
                angleLabel = 'WIDOK AKSONOMETRYCZNY (3D)';
                break;
        }

        const lines: string[] = [];
        lines.push(`<!-- KADR: ${sourceItemName} (${angleLabel}) -->`);
        lines.push(`<g transform="translate(${v(sheetX)}, ${v(sheetY)})">`);

        // Podpis rzutu
        lines.push(`<text x="0" y="-4" font-size="2.4" font-weight="bold" fill="#1e293b" font-family="'Segoe UI', sans-serif">${sourceItemName} • ${angleLabel}</text>`);
        lines.push(`<text x="0" y="-1.5" font-size="1.6" fill="#64748b" font-family="'Segoe UI', sans-serif">Skala 1:${Math.round(1 / scale)}</text>`);

        if (angle === 'isometric') {
            // Rysunek aksonometryczny CAD (bryła 3D)
            const sx = dimX * scale * 0.866;
            const sz = dimZ * scale * 0.866;
            const sy = dimY * scale * 0.85;

            const p0 = { x: sz, y: 0 };
            const p1 = { x: sz + sx, y: sx * 0.5 };
            const p2 = { x: sx, y: sy + sx * 0.5 };
            const p3 = { x: 0, y: sy };
            const p4 = { x: sz, y: sy + (sx + sz) * 0.25 };

            lines.push(`<polygon points="${v(p0.x)},${v(p0.y)} ${v(p1.x)},${v(p1.y)} ${v(p4.x)},${v(p4.y)} ${v(p3.x)},${v(p3.y)}" fill="#f8fafc" stroke="#0f172a" stroke-width="0.5"/>`);
            lines.push(`<line x1="${v(p0.x)}" y1="${v(p0.y)}" x2="${v(p4.x)}" y2="${v(p4.y)}" stroke="#0f172a" stroke-width="0.35"/>`);
        } else {
            // Rysunek ortogonalny 2D z wyrazistymi krawędziami CAD
            lines.push(`<rect x="0" y="0" width="${v(w)}" height="${v(h)}" fill="#f8fafc" stroke="#0f172a" stroke-width="0.5" rx="0.5"/>`);

            // Wewnętrzne linie konstrukcyjne mebla (np. boki o grubości 18mm)
            const wallThick = 18 * scale;
            if (w > wallThick * 3 && h > wallThick * 3 && pv.itemType === 'CONTAINER') {
                lines.push(`<rect x="${v(wallThick)}" y="${v(wallThick)}" width="${v(w - 2 * wallThick)}" height="${v(h - 2 * wallThick)}" fill="none" stroke="#64748b" stroke-width="0.25" stroke-dasharray="2,1"/>`);
            }
        }

        // Linie wymiarowe PMI (rzutowane automatycznie)
        if (showPMI && angle !== 'isometric') {
            const dimOffset = 5.0;

            // Wymiar poziomy (Szerokość)
            const realW = angle === 'right' || angle === 'left' ? dimZ : dimX;
            const dimYPos = h + dimOffset;
            lines.push(`<line x1="0" y1="${v(dimYPos)}" x2="${v(w)}" y2="${v(dimYPos)}" stroke="#2563eb" stroke-width="0.3"/>`);
            lines.push(`<line x1="0" y1="${v(h)}" x2="0" y2="${v(dimYPos + 1.5)}" stroke="#2563eb" stroke-width="0.2" stroke-dasharray="1,1"/>`);
            lines.push(`<line x1="${v(w)}" y1="${v(h)}" x2="${v(w)}" y2="${v(dimYPos + 1.5)}" stroke="#2563eb" stroke-width="0.2" stroke-dasharray="1,1"/>`);
            lines.push(`<circle cx="0" cy="${v(dimYPos)}" r="0.4" fill="#2563eb"/>`);
            lines.push(`<circle cx="${v(w)}" cy="${v(dimYPos)}" r="0.4" fill="#2563eb"/>`);
            lines.push(`<text x="${v(w / 2)}" y="${v(dimYPos - 1.2)}" font-size="2.0" font-weight="bold" fill="#2563eb" text-anchor="middle">${realW} mm</text>`);

            // Wymiar pionowy (Wysokość)
            const realH = angle === 'top' ? dimZ : dimY;
            const dimXPos = -dimOffset;
            lines.push(`<line x1="${v(dimXPos)}" y1="0" x2="${v(dimXPos)}" y2="${v(h)}" stroke="#2563eb" stroke-width="0.3"/>`);
            lines.push(`<line x1="0" y1="0" x2="${v(dimXPos - 1.5)}" y2="0" stroke="#2563eb" stroke-width="0.2" stroke-dasharray="1,1"/>`);
            lines.push(`<line x1="0" y1="${v(h)}" x2="${v(dimXPos - 1.5)}" y2="${v(h)}" stroke="#2563eb" stroke-width="0.2" stroke-dasharray="1,1"/>`);
            lines.push(`<circle cx="${v(dimXPos)}" cy="0" r="0.4" fill="#2563eb"/>`);
            lines.push(`<circle cx="${v(dimXPos)}" cy="${v(h)}" r="0.4" fill="#2563eb"/>`);
            lines.push(`<text x="${v(dimXPos - 1.2)}" y="${v(h / 2)}" font-size="2.0" font-weight="bold" fill="#2563eb" text-anchor="middle" transform="rotate(-90, ${v(dimXPos - 1.2)}, ${v(h / 2)})">${realH} mm</text>`);
        }

        lines.push('</g>');
        return lines.join('\n');
    }

    private _renderTitleBlockSvg(tbX: number, tbY: number): string {
        const lines: string[] = ['<!-- TABELKA RYSUNKOWA ISO 7200 -->'];
        const tbW = TITLE_BLOCK_WIDTH;
        const tbH = TITLE_BLOCK_HEIGHT;

        lines.push(`<rect x="${v(tbX)}" y="${v(tbY)}" width="${v(tbW)}" height="${v(tbH)}" fill="#ffffff" stroke="#000000" stroke-width="0.7"/>`);

        const colSplit = 80;
        const rowHeights = [12, 9, 9];
        let curY = tbY;

        // Wiersz 0: Nazwa projektu / mebla | Nr rysunku
        lines.push(`<line x1="${v(tbX)}" y1="${v(curY + rowHeights[0])}" x2="${v(tbX + tbW)}" y2="${v(curY + rowHeights[0])}" stroke="#000000" stroke-width="0.35"/>`);
        lines.push(`<line x1="${v(tbX + colSplit)}" y1="${v(curY)}" x2="${v(tbX + colSplit)}" y2="${v(curY + rowHeights[0])}" stroke="#000000" stroke-width="0.35"/>`);

        lines.push(`<text x="${v(tbX + 2)}" y="${v(curY + 3.5)}" font-size="1.5" fill="#666666">Nazwa projektu / mebla</text>`);
        lines.push(`<text x="${v(tbX + colSplit + 2)}" y="${v(curY + 3.5)}" font-size="1.5" fill="#666666">Nr rysunku</text>`);

        const displayName = this.titleBlock.furnitureName || this.titleBlock.projectName || 'Mebel CAD';
        lines.push(`<text x="${v(tbX + 2)}" y="${v(curY + 8.5)}" font-size="3.4" font-weight="bold" fill="#000000">${displayName}</text>`);
        lines.push(`<text x="${v(tbX + colSplit + 2)}" y="${v(curY + 8.5)}" font-size="3.2" font-weight="bold" fill="#000000">${this.titleBlock.drawingNumber}</text>`);

        curY += rowHeights[0];

        // Wiersz 1: Wykonał | Data
        lines.push(`<line x1="${v(tbX)}" y1="${v(curY + rowHeights[1])}" x2="${v(tbX + tbW)}" y2="${v(curY + rowHeights[1])}" stroke="#000000" stroke-width="0.35"/>`);
        lines.push(`<line x1="${v(tbX + colSplit)}" y1="${v(curY)}" x2="${v(tbX + colSplit)}" y2="${v(curY + rowHeights[1])}" stroke="#000000" stroke-width="0.35"/>`);

        lines.push(`<text x="${v(tbX + 2)}" y="${v(curY + 2.8)}" font-size="1.3" fill="#666666">Wykonał</text>`);
        lines.push(`<text x="${v(tbX + colSplit + 2)}" y="${v(curY + 2.8)}" font-size="1.3" fill="#666666">Data</text>`);

        lines.push(`<text x="${v(tbX + 2)}" y="${v(curY + 6.8)}" font-size="2.4" fill="#000000">${this.titleBlock.author}</text>`);
        lines.push(`<text x="${v(tbX + colSplit + 2)}" y="${v(curY + 6.8)}" font-size="2.4" fill="#000000">${this.titleBlock.date}</text>`);

        curY += rowHeights[1];

        // Wiersz 2: Uwagi | Skala | Format
        const col2Split = colSplit + 20;
        lines.push(`<line x1="${v(tbX + colSplit)}" y1="${v(curY)}" x2="${v(tbX + colSplit)}" y2="${v(curY + rowHeights[2])}" stroke="#000000" stroke-width="0.35"/>`);
        lines.push(`<line x1="${v(tbX + col2Split)}" y1="${v(curY)}" x2="${v(tbX + col2Split)}" y2="${v(curY + rowHeights[2])}" stroke="#000000" stroke-width="0.35"/>`);

        lines.push(`<text x="${v(tbX + 2)}" y="${v(curY + 2.8)}" font-size="1.3" fill="#666666">Uwagi</text>`);
        lines.push(`<text x="${v(tbX + 2)}" y="${v(curY + 6.8)}" font-size="2.2" fill="#000000">${this.titleBlock.remarks || '—'}</text>`);

        lines.push(`<text x="${v(tbX + colSplit + 2)}" y="${v(curY + 2.8)}" font-size="1.3" fill="#666666">Skala</text>`);
        lines.push(`<text x="${v(tbX + colSplit + 2)}" y="${v(curY + 6.8)}" font-size="2.4" font-weight="bold" fill="#000000">${this.titleBlock.scale}</text>`);

        lines.push(`<text x="${v(tbX + col2Split + 2)}" y="${v(curY + 2.8)}" font-size="1.3" fill="#666666">Format</text>`);
        lines.push(`<text x="${v(tbX + col2Split + 2)}" y="${v(curY + 6.8)}" font-size="2.4" font-weight="bold" fill="#000000">${this.paperFormat.split('_')[0]}</text>`);

        // Branding
        lines.push(`<text x="${v(tbX + tbW - 2)}" y="${v(tbY + tbH - 1.2)}" font-size="1.4" text-anchor="end" fill="#999999">SmartBox CAD E3</text>`);

        return lines.join('\n');
    }

    // ─── Eksporty (Drukuj PDF, JPG, SVG) ───

    public printSheet(): void {
        const svgContent = this.generateSvg();
        const dims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Drukuj Arkusz CAD E3 - SmartBox</title>
                <style>
                    @page {
                        size: ${dims.width}mm ${dims.height}mm;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #ffffff;
                    }
                    svg {
                        width: 100vw;
                        height: 100vh;
                        display: block;
                    }
                </style>
            </head>
            <body>
                ${svgContent}
                <script>
                    window.onload = () => {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    public async downloadJpg(filename?: string): Promise<void> {
        const dims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const scale = 2.5;
        const canvasW = Math.round(dims.width * 3.7795 * scale);
        const canvasH = Math.round(dims.height * 3.7795 * scale);

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);

        const svg = this.generateSvg();
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvasW, canvasH);
                URL.revokeObjectURL(url);
                resolve();
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };
            img.src = url;
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename || `Arkusz_E3_${this.paperFormat}_${new Date().toISOString().split('T')[0]}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    public downloadSvg(filename?: string): void {
        const svg = this.generateSvg();
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `Arkusz_E3_${this.paperFormat}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
