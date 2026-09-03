/**
 * D1_draw - draw-sheet-svg.ts
 * Generator wektorowego arkusza dokumentacji 2D CAD (SVG) z normą ISO 7200 i BOM.
 */

import {
    PaperFormat,
    PAPER_FORMATS,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    MARGIN_BOTTOM,
    TITLE_BLOCK_WIDTH,
    TITLE_BLOCK_HEIGHT,
    TitleBlockInfo,
    BOMRow,
    Draw2DView,
} from './draw-types';
import { DrawDimensionsEngine } from './draw-dimensions';

function v(val: number): string {
    return Number(val).toFixed(2);
}

function svgRect(
    x: number,
    y: number,
    w: number,
    h: number,
    stroke: string = 'black',
    strokeWidth: number = 0.5,
    fill: string = 'none',
    extraAttrs: Record<string, string | number> = {}
): string {
    const extra = Object.entries(extraAttrs)
        .map(([k, val]) => `${k.replace('_', '-')}="${val}"`)
        .join(' ');
    return `<rect x="${v(x)}" y="${v(y)}" width="${v(w)}" height="${v(h)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" ${extra}/>`;
}

function svgLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string = 'black',
    strokeWidth: number = 0.5,
    dashArray?: string
): string {
    const dash = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
    return `<line x1="${v(x1)}" y1="${v(y1)}" x2="${v(x2)}" y2="${v(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}/>`;
}

function svgText(
    x: number,
    y: number,
    text: string,
    fontSize: number = 3,
    anchor: 'start' | 'middle' | 'end' = 'start',
    fontWeight: 'normal' | 'bold' | '600' = 'normal',
    fontFamily: string = "'Segoe UI', Arial, sans-serif",
    fill: string = 'black'
): string {
    const escaped = String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<text x="${v(x)}" y="${v(y)}" font-size="${v(fontSize)}" font-family="${fontFamily}" font-weight="${fontWeight}" text-anchor="${anchor}" fill="${fill}" dominant-baseline="middle">${escaped}</text>`;
}

export class DrawSheetSVGGenerator {
    public paperFormat: PaperFormat;
    public paperW: number;
    public paperH: number;

    public frameX: number;
    public frameY: number;
    public frameW: number;
    public frameH: number;

    public titleBlock: TitleBlockInfo;
    public views: Draw2DView[] = [];
    public selectedViewId: string | null = null;
    public bomRows: BOMRow[] = [];
    public showBOM: boolean = true;
    public showDimensions: boolean = true;

    constructor(paperFormat: PaperFormat = 'A3_LANDSCAPE') {
        this.paperFormat = paperFormat;
        const dims = PAPER_FORMATS[paperFormat] || PAPER_FORMATS['A3_LANDSCAPE'];
        this.paperW = dims.width;
        this.paperH = dims.height;

        this.frameX = MARGIN_LEFT;
        this.frameY = MARGIN_TOP;
        this.frameW = this.paperW - MARGIN_LEFT - MARGIN_RIGHT;
        this.frameH = this.paperH - MARGIN_TOP - MARGIN_BOTTOM;

        this.titleBlock = {
            projectName: 'Dokumentacja SmartBox',
            furnitureName: 'Korpus SmartFrame',
            author: 'SmartBox CAD',
            date: new Date().toISOString().split('T')[0],
            scale: '1:10',
            sheetNumber: '1/1',
            drawingNumber: 'DRW-001',
            remarks: '',
        };
    }

    public setPaperFormat(format: PaperFormat): void {
        this.paperFormat = format;
        const dims = PAPER_FORMATS[format] || PAPER_FORMATS['A3_LANDSCAPE'];
        this.paperW = dims.width;
        this.paperH = dims.height;
        this.frameX = MARGIN_LEFT;
        this.frameY = MARGIN_TOP;
        this.frameW = this.paperW - MARGIN_LEFT - MARGIN_RIGHT;
        this.frameH = this.paperH - MARGIN_TOP - MARGIN_BOTTOM;
    }

    public phantomView: {
        x: number;
        y: number;
        widthMm: number;
        heightMm: number;
        angle: DrawProjectionAngle;
        scale: number;
        baseView?: { x: number; y: number; widthMm: number; heightMm: number; scale: number };
    } | null = null;

    public generateSvg(): string {
        const parts: string[] = [];

        // 1. Nagłówek SVG z jednostkami mm
        parts.push(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
            `width="${this.paperW}mm" height="${this.paperH}mm" viewBox="0 0 ${this.paperW} ${this.paperH}" ` +
            `style="background:#ffffff; font-family: 'Segoe UI', Arial, sans-serif;">`
        );

        // Białe tło papieru
        parts.push(`<rect width="${v(this.paperW)}" height="${v(this.paperH)}" fill="#ffffff"/>`);

        // 2. Ramka rysunkowa (gruba zewnętrzna + cienka wewnętrzna)
        parts.push(this._drawFrame());

        // 3. Rzuty 2D
        for (const view of this.views) {
            if (!view.visible) continue;
            parts.push(this._drawView(view));
        }

        // 4. Rzutowanie dynamiczne na żywo (Phantom Projected View z promieniami rzutowania)
        if (this.phantomView) {
            parts.push(this._drawPhantomProjection(this.phantomView));
        }

        // 5. Tabela BOM
        if (this.showBOM && this.bomRows.length > 0) {
            parts.push(this._drawBomTable());
        }

        // 6. Tabelka ISO 7200
        parts.push(this._drawTitleBlock());

        // 7. Znaczniki składania
        parts.push(this._drawFoldMarks());

        // Koniec SVG
        parts.push('</svg>');

        return parts.join('\n');
    }

    private _drawPhantomProjection(p: {
        x: number;
        y: number;
        widthMm: number;
        heightMm: number;
        angle: DrawProjectionAngle;
        scale: number;
        baseView?: { x: number; y: number; widthMm: number; heightMm: number; scale: number };
    }): string {
        const lines: string[] = ['<!-- RZUTOWANIE DYNAMICZNE (PHANTOM PROJECTED VIEW) -->'];
        const pw = p.widthMm * p.scale;
        const ph = p.heightMm * p.scale;

        // Jeśli mamy powiązany widok bazowy, narysuj przerywane promienie rzutowania CAD
        if (p.baseView) {
            const bv = p.baseView;
            const bw = bv.widthMm * bv.scale;
            const bh = bv.heightMm * bv.scale;

            if (p.angle === 'RIGHT' || p.angle === 'LEFT') {
                // Promienie poziome (górna i dolna krawędź)
                lines.push(svgLine(bv.x + (p.angle === 'RIGHT' ? bw : 0), bv.y, p.x + (p.angle === 'RIGHT' ? 0 : pw), p.y, '#3b82f6', 0.25, '3,2'));
                lines.push(svgLine(bv.x + (p.angle === 'RIGHT' ? bw : 0), bv.y + bh, p.x + (p.angle === 'RIGHT' ? 0 : pw), p.y + ph, '#3b82f6', 0.25, '3,2'));
            } else if (p.angle === 'TOP' || p.angle === 'BOTTOM') {
                // Promienie pionowe (lewa i prawa krawędź)
                lines.push(svgLine(bv.x, bv.y + (p.angle === 'BOTTOM' ? bh : 0), p.x, p.y + (p.angle === 'BOTTOM' ? 0 : ph), '#3b82f6', 0.25, '3,2'));
                lines.push(svgLine(bv.x + bw, bv.y + (p.angle === 'BOTTOM' ? bh : 0), p.x + pw, p.y + (p.angle === 'BOTTOM' ? 0 : ph), '#3b82f6', 0.25, '3,2'));
            } else {
                // Promień skośny dla izometrii
                lines.push(svgLine(bv.x + bw, bv.y + bh, p.x, p.y, '#3b82f6', 0.25, '3,2'));
            }
        }

        // Ramka widoku fantomowego
        lines.push(
            `<rect x="${v(p.x)}" y="${v(p.y)}" width="${v(pw)}" height="${v(ph)}" ` +
            `fill="rgba(59, 130, 246, 0.08)" stroke="#2563eb" stroke-width="0.5" stroke-dasharray="4,2" rx="2"/>`
        );

        // Etykieta rzutu
        const labelText = `Rzut: ${p.angle} (Kliknij, aby upuścić)`;
        lines.push(svgText(p.x + pw / 2, p.y + ph / 2, labelText, 3.0, 'middle', 'bold', undefined, '#1d4ed8'));

        return lines.join('\n');
    }

    private _drawFrame(): string {
        const lines: string[] = ['<!-- RAMKA RYSUNKOWA -->'];
        // Gruba ramka zewnętrzna (0.7 mm)
        lines.push(svgRect(this.frameX, this.frameY, this.frameW, this.frameH, '#000000', 0.7));

        // Cienka ramka wewnętrzna (0.25 mm)
        const inset = 1.0;
        lines.push(
            svgRect(
                this.frameX + inset,
                this.frameY + inset,
                this.frameW - 2 * inset,
                this.frameH - 2 * inset,
                '#000000',
                0.25
            )
        );
        return lines.join('\n');
    }

    private _drawView(view: Draw2DView): string {
        const lines: string[] = [`<!-- WIDOK: ${view.title} (${view.projection}) -->`];
        const scale = view.scale;
        const vx = view.x;
        const vy = view.y;
        const isSelected = this.selectedViewId === view.id;

        // Jeśli widok jest zaznaczony, narysuj subtelną ramkę zaznaczenia wokół rzutu
        if (isSelected) {
            const pad = 4;
            const vw = view.widthMm * scale + pad * 2;
            const vh = view.heightMm * scale + pad * 2;
            lines.push(
                `<rect x="${v(vx - pad)}" y="${v(vy - pad - 8)}" width="${v(vw)}" height="${v(vh + 8)}" ` +
                `fill="rgba(59, 130, 246, 0.05)" stroke="#3b82f6" stroke-width="0.35" stroke-dasharray="3,2" rx="1"/>`
            );
        }

        // Tytuł i skala rzutu
        lines.push(svgText(vx, vy - 6, view.title, 3.5, 'start', 'bold', undefined, '#0f172a'));
        lines.push(svgText(vx, vy - 2, `Skala ${view.scaleText}`, 2.2, 'start', 'normal', undefined, '#64748b'));

        // Rysowanie geometrii formatki: jeśli dostępne są wygenerowane odcinki HLR
        if (view.segments && view.segments.length > 0) {
            // Tło pod rzutem
            lines.push(`<rect x="${v(vx)}" y="${v(vy)}" width="${v(view.widthMm * scale)}" height="${v(view.heightMm * scale)}" fill="#ffffff" stroke="none"/>`);
            const segs = [...view.segments].sort((a, b) => (a.isHidden === b.isHidden ? 0 : a.isHidden ? -1 : 1));
            for (const seg of segs) {
                const sx1 = vx + seg.x1 * scale;
                const sy1 = vy + seg.y1 * scale;
                const sx2 = vx + seg.x2 * scale;
                const sy2 = vy + seg.y2 * scale;
                const dash = seg.dashArray || (seg.isHidden ? '2,1.5' : undefined);
                const color = seg.strokeColor || (seg.isHidden ? '#64748b' : '#0f172a');
                const width = seg.strokeWidth || (seg.isHidden ? 0.35 : 0.5);
                lines.push(svgLine(sx1, sy1, sx2, sy2, color, width, dash));
            }
        } else {
            // Prostokąty formatek (rzuty płaskie)
            for (const rect of view.rects) {
                const rx = vx + rect.x * scale;
                const ry = vy + rect.y * scale;
                const rw = rect.width * scale;
                const rh = rect.height * scale;

                lines.push(
                    svgRect(
                        rx,
                        ry,
                        rw,
                        rh,
                        rect.strokeColor || '#0f172a',
                        rect.isBack ? 0.35 : 0.5,
                        rect.fillColor || '#f8fafc',
                        rect.dashArray ? { stroke_dasharray: rect.dashArray } : {}
                    )
                );
            }
        }

        // Otwory (Holes)
        for (const rect of view.rects) {
            const rx = vx + rect.x * scale;
            const ry = vy + rect.y * scale;
            if (rect.holes && rect.holes.length > 0) {
                for (const hole of rect.holes) {
                    const hx = rx + hole.x * scale;
                    const hy = ry + hole.y * scale;
                    const hr = (hole.diameter * scale) / 2;
                    lines.push(`<circle cx="${v(hx)}" cy="${v(hy)}" r="${v(Math.max(hr, 0.6))}" fill="none" stroke="#0284c7" stroke-width="0.25"/>`);
                    // Krzyżyk środka
                    const cl = Math.max(hr + 0.8, 1.2);
                    lines.push(`<line x1="${v(hx - cl)}" y1="${v(hy)}" x2="${v(hx + cl)}" y2="${v(hy)}" stroke="#0284c7" stroke-width="0.15"/>`);
                    lines.push(`<line x1="${v(hx)}" y1="${v(hy - cl)}" x2="${v(hx)}" y2="${v(hy + cl)}" stroke="#0284c7" stroke-width="0.15"/>`);
                }
            }

            // Wpusty (Grooves)
            if (rect.grooves && rect.grooves.length > 0) {
                for (const groove of rect.grooves) {
                    const gx = rx + groove.x * scale;
                    const gy = ry + groove.y * scale;
                    const gw = groove.width * scale;
                    const gh = groove.height * scale;
                    lines.push(`<rect x="${v(gx)}" y="${v(gy)}" width="${v(gw)}" height="${v(gh)}" fill="rgba(100, 116, 139, 0.15)" stroke="#64748b" stroke-width="0.2" stroke-dasharray="1.5,1.5"/>`);
                }
            }
        }

        // Wielokąty izometrii — tylko fallback, gdy HLR nie wygenerował krawędzi
        if ((!view.segments || view.segments.length === 0) && view.polygons && view.polygons.length > 0) {
            const cx = vx + (view.widthMm * scale) / 2;
            const cy = vy + (view.heightMm * scale) / 2;

            for (const poly of view.polygons) {
                const pointsStr = poly.points
                    .map((p) => `${v(cx + p.x * scale)},${v(cy + p.y * scale)}`)
                    .join(' ');
                lines.push(
                    `<polygon points="${pointsStr}" fill="${poly.fillColor || '#e2e8f0'}" stroke="${poly.strokeColor || '#334155'}" stroke-width="${poly.strokeWidth || 0.35}"/>`
                );
            }
        }

        // Wymiary CAD dla rzutu
        if (this.showDimensions && view.dimensions) {
            for (const dim of view.dimensions) {
                lines.push(DrawDimensionsEngine.renderDimensionSVG(dim, vx, vy, scale));
            }
        }

        return lines.join('\n');
    }

    private _drawTitleBlock(): string {
        const lines: string[] = ['<!-- TABELKA RYSUNKOWA ISO 7200 -->'];

        const tbX = this.frameX + this.frameW - TITLE_BLOCK_WIDTH;
        const tbY = this.frameY + this.frameH - TITLE_BLOCK_HEIGHT;
        const tbW = TITLE_BLOCK_WIDTH;
        const tbH = TITLE_BLOCK_HEIGHT;

        // Tło tabelki (białe)
        lines.push(svgRect(tbX, tbY, tbW, tbH, '#000000', 0.7, '#ffffff'));

        const rowHeights = [12, 9, 9];
        const colSplit = 80;

        let curY = tbY;

        // Wiersz 0: Nazwa projektu / mebla | Nr rysunku
        const r0H = rowHeights[0];
        lines.push(svgLine(tbX, curY + r0H, tbX + tbW, curY + r0H, '#000000', 0.35));
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + r0H, '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 3, 'Nazwa projektu / mebla', 1.5, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + colSplit + 2, curY + 3, 'Nr rysunku', 1.5, 'start', 'normal', undefined, '#666666'));

        const displayName = this.titleBlock.furnitureName || this.titleBlock.projectName || 'Mebel SmartFrame';
        lines.push(svgText(tbX + 2, curY + 8, displayName, 3.5, 'start', 'bold'));
        lines.push(svgText(tbX + colSplit + 2, curY + 8, this.titleBlock.drawingNumber || 'DRW-001', 3.2, 'start', 'bold'));

        curY += r0H;

        // Wiersz 1: Wykonał | Data
        const r1H = rowHeights[1];
        lines.push(svgLine(tbX, curY + r1H, tbX + tbW, curY + r1H, '#000000', 0.35));
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + r1H, '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 2.5, 'Wykonał', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + colSplit + 2, curY + 2.5, 'Data', 1.2, 'start', 'normal', undefined, '#666666'));

        lines.push(svgText(tbX + 2, curY + 6.5, this.titleBlock.author || 'SmartBox CAD', 2.5));
        lines.push(svgText(tbX + colSplit + 2, curY + 6.5, this.titleBlock.date || '', 2.5));

        curY += r1H;

        // Wiersz 2: Uwagi | Skala | Format
        const col2Split = colSplit + 20;
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + rowHeights[2], '#000000', 0.35));
        lines.push(svgLine(tbX + col2Split, curY, tbX + col2Split, curY + rowHeights[2], '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 2.5, 'Uwagi', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + 2, curY + 6.5, this.titleBlock.remarks || 'Dokumentacja 2D SmartFrame', 2.2));

        lines.push(svgText(tbX + colSplit + 2, curY + 2.5, 'Skala', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + col2Split + 2, curY + 2.5, 'Format', 1.2, 'start', 'normal', undefined, '#666666'));

        const formatLabel = this.paperFormat.split('_')[0];
        lines.push(svgText(tbX + colSplit + 2, curY + 6.5, this.titleBlock.scale || '1:10', 2.5, 'start', 'bold'));
        lines.push(svgText(tbX + col2Split + 2, curY + 6.5, formatLabel, 2.5, 'start', 'bold'));

        // Branding
        lines.push(svgText(tbX + tbW - 2, tbY + tbH - 1.2, 'SmartBox Draw Module', 1.4, 'end', 'normal', undefined, '#999999'));

        return lines.join('\n');
    }

    private _drawBomTable(): string {
        if (!this.bomRows || this.bomRows.length === 0) return '';

        const lines: string[] = ['<!-- TABELA ZESTAWIENIA FORMATER (BOM) -->'];
        const rowH = 5.0;
        const headerH = 6.5;
        const numRows = Math.min(this.bomRows.length, 14);

        const bomW = TITLE_BLOCK_WIDTH;
        const bomH = headerH + numRows * rowH;

        const bomX = this.frameX + this.frameW - bomW;
        const bomY = this.frameY + this.frameH - TITLE_BLOCK_HEIGHT - bomH - 2;

        lines.push(svgRect(bomX, bomY, bomW, bomH, '#000000', 0.5, '#ffffff'));

        const cols: [string, number][] = [
            ['Lp.', 8],
            ['Nazwa', 34],
            ['Materiał', 28],
            ['Dł.', 14],
            ['Szer.', 14],
            ['Gr.', 10],
            ['Szt.', 12],
        ];

        // Nagłówek tabeli
        lines.push(svgRect(bomX, bomY, bomW, headerH, '#000000', 0.35, '#f1f5f9'));
        lines.push(svgLine(bomX, bomY + headerH, bomX + bomW, bomY + headerH, '#000000', 0.5));

        let cx = bomX;
        for (const [colName, colW] of cols) {
            lines.push(svgText(cx + colW / 2, bomY + headerH / 2, colName, 2.0, 'middle', 'bold'));
            cx += colW;
            if (cx < bomX + bomW) {
                lines.push(svgLine(cx, bomY, cx, bomY + bomH, '#000000', 0.2));
            }
        }

        // Wiersze
        for (let i = 0; i < numRows; i++) {
            const row = this.bomRows[i];
            const ry = bomY + headerH + i * rowH;

            if (i > 0) {
                lines.push(svgLine(bomX, ry, bomX + bomW, ry, '#e2e8f0', 0.15));
            }
            if (i % 2 === 1) {
                lines.push(svgRect(bomX, ry, bomW, rowH, 'none', 0, '#f8fafc'));
            }

            const values = [
                String(i + 1),
                String(row.name || 'Formatka'),
                String(row.material || 'Laminat 18mm'),
                row.length.toFixed(0),
                row.width.toFixed(0),
                row.thickness.toFixed(0),
                String(row.qty || 1),
            ];

            let rowCx = bomX;
            for (let c = 0; c < cols.length; c++) {
                const colW = cols[c][1];
                const val = values[c] || '';
                if (c === 0 || c >= 3) {
                    lines.push(svgText(rowCx + colW / 2, ry + rowH / 2, val, 1.8, 'middle'));
                } else {
                    lines.push(svgText(rowCx + 1.5, ry + rowH / 2, val, 1.8, 'start'));
                }
                rowCx += colW;
            }
        }

        return lines.join('\n');
    }

    private _drawFoldMarks(): string {
        const lines: string[] = ['<!-- ZNACZNIKI SKŁADANIA -->'];
        const markLen = 3;
        const cx = this.paperW / 2;
        const cy = this.paperH / 2;

        lines.push(svgLine(cx, 0, cx, markLen, '#cbd5e1', 0.2));
        lines.push(svgLine(cx, this.paperH - markLen, cx, this.paperH, '#cbd5e1', 0.2));
        lines.push(svgLine(0, cy, markLen, cy, '#cbd5e1', 0.2));
        lines.push(svgLine(this.paperW - markLen, cy, this.paperW, cy, '#cbd5e1', 0.2));

        return lines.join('\n');
    }

    // ─── Eksport i Pobieranie ───

    public async toRasterDataUrl(format: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.95, scale = 2.5): Promise<string> {
        const canvasW = Math.round(this.paperW * 3.7795 * scale);
        const canvasH = Math.round(this.paperH * 3.7795 * scale);

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);

        const svgCode = this.generateSvg();
        const svgBlob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvasW, canvasH);
                URL.revokeObjectURL(svgUrl);
                resolve();
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(svgUrl);
                reject(new Error(`Błąd renderowania SVG: ${err}`));
            };
            img.src = svgUrl;
        });

        return canvas.toDataURL(format, quality);
    }

    public downloadSvg(filename?: string): void {
        const name = filename || `Rysunek_CAD_${this.paperFormat}_${new Date().toISOString().split('T')[0]}.svg`;
        const svgCode = this.generateSvg();
        const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    public async downloadJpg(filename?: string): Promise<void> {
        const name = filename || `Rysunek_CAD_${this.paperFormat}_${new Date().toISOString().split('T')[0]}.jpg`;
        const dataUrl = await this.toRasterDataUrl('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    public printSheet(): void {
        const svgCode = this.generateSvg();
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Drukuj Dokumentację CAD 2D — ${this.titleBlock.drawingNumber}</title>
                <style>
                    @page {
                        size: ${this.paperW}mm ${this.paperH}mm;
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
                ${svgCode}
                <script>
                    window.onload = () => { window.print(); };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}
