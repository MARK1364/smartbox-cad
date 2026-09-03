/**
 * E3_export - drawing-sheet.ts
 * SmartBox CAD Drawing Sheet Generator dla modułu Eksport 3.
 * 
 * Generuje profesjonalny arkusz rysunkowy CAD w formacie SVG
 * ze standardowymi rozmiarami papieru (A4/A3/A2), podwójną ramką,
 * tabelką rysunkową ISO 7200, tabelą BOM i osadzonym rzutem 3D/wektorowym.
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
} from './export-types';

function v(val: number): string {
    return val.toFixed(2);
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
    fontFamily: string = 'Arial, Helvetica, sans-serif',
    fill: string = 'black'
): string {
    const escaped = String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<text x="${v(x)}" y="${v(y)}" font-size="${v(fontSize)}" font-family="${fontFamily}" font-weight="${fontWeight}" text-anchor="${anchor}" fill="${fill}" dominant-baseline="middle">${escaped}</text>`;
}

export class DrawingSheet {
    public paperFormat: PaperFormat;
    public paperW: number;
    public paperH: number;

    // Obszar rysunkowy wewnątrz ramki (mm)
    public frameX: number;
    public frameY: number;
    public frameW: number;
    public frameH: number;

    public titleBlock: TitleBlockInfo;
    private _viewportPng: string | null = null;
    private _vectorSvg: string | null = null;
    private _svgOverlays: string[] = [];
    private _bomRows: BOMRow[] = [];

    constructor(paperFormat: PaperFormat = 'A4_LANDSCAPE') {
        this.paperFormat = paperFormat;
        const dims = PAPER_FORMATS[paperFormat] || PAPER_FORMATS['A4_LANDSCAPE'];
        this.paperW = dims.width;
        this.paperH = dims.height;

        this.frameX = MARGIN_LEFT;
        this.frameY = MARGIN_TOP;
        this.frameW = this.paperW - MARGIN_LEFT - MARGIN_RIGHT;
        this.frameH = this.paperH - MARGIN_TOP - MARGIN_BOTTOM;

        const today = new Date().toISOString().split('T')[0];
        this.titleBlock = {
            projectName: '',
            furnitureName: '',
            author: 'SmartBox CAD',
            date: today,
            scale: '1:10',
            sheetNumber: '1/1',
            drawingNumber: 'SB-001',
            remarks: '',
        };
    }

    public setProjectInfo(info: Partial<TitleBlockInfo>): void {
        this.titleBlock = { ...this.titleBlock, ...info };
    }

    public setViewportImage(base64Png: string | null): void {
        this._viewportPng = base64Png;
        if (base64Png) this._vectorSvg = null;
    }

    public setVectorDrawing(svgCode: string | null): void {
        this._vectorSvg = svgCode;
        if (svgCode) this._viewportPng = null;
    }

    public addSvgOverlay(svgCode: string): void {
        this._svgOverlays.push(svgCode);
    }

    public clearSvgOverlays(): void {
        this._svgOverlays = [];
    }

    public setBomData(rows: BOMRow[]): void {
        this._bomRows = rows || [];
    }

    public getAvailableDrawingArea(): { x: number; y: number; width: number; height: number } {
        const imgMargin = 3;
        const x = this.frameX + imgMargin;
        const y = this.frameY + imgMargin;
        const width = this.frameW - 2 * imgMargin;
        let height = this.frameH - 2 * imgMargin;
        if (height < 10) height = 10;
        return { x, y, width, height };
    }

    public generateSvg(): string {
        const parts: string[] = [];

        // Nagłówek SVG z jednostkami mm i viewBox
        parts.push(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
            `width="${this.paperW}mm" height="${this.paperH}mm" viewBox="0 0 ${this.paperW} ${this.paperH}" ` +
            `style="background:#ffffff; font-family: 'Segoe UI', Arial, sans-serif;">`
        );

        // Białe tło arkusza
        parts.push(`<rect width="${v(this.paperW)}" height="${v(this.paperH)}" fill="#ffffff"/>`);

        // Ramka rysunkowa
        parts.push(this._drawFrame());

        // Widok rastrowy (zrzut z viewportu)
        if (this._viewportPng) {
            parts.push(this._drawViewportImage());
        }

        // Widok wektorowy (jeśli podano)
        if (this._vectorSvg) {
            parts.push(this._vectorSvg);
        }

        // Nakładki wektorowe (np. linie i teksty PMI)
        if (this._svgOverlays.length > 0) {
            parts.push('<!-- NAKŁADKI WEKTOROWE PMI -->');
            parts.push(...this._svgOverlays);
        }

        // Tabela BOM (jeśli są dane)
        if (this._bomRows.length > 0) {
            parts.push(this._drawBomTable());
        }

        // Tabelka rysunkowa ISO 7200
        parts.push(this._drawTitleBlock());

        // Znaczniki składania arkusza
        parts.push(this._drawFoldMarks());

        // Zamknięcie SVG
        parts.push('</svg>');

        return parts.join('\n');
    }

    private _drawFrame(): string {
        const lines: string[] = ['<!-- RAMKA RYSUNKOWA -->'];

        // Gruba ramka zewnętrzna (0.7 mm)
        lines.push(svgRect(this.frameX, this.frameY, this.frameW, this.frameH, '#000000', 0.7));

        // Cienka ramka wewnętrzna (0.25 mm, odsadzona o 1 mm)
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

    private _drawTitleBlock(): string {
        const lines: string[] = ['<!-- TABELKA RYSUNKOWA ISO 7200 -->'];

        const tbX = this.frameX + this.frameW - TITLE_BLOCK_WIDTH;
        const tbY = this.frameY + this.frameH - TITLE_BLOCK_HEIGHT;
        const tbW = TITLE_BLOCK_WIDTH;
        const tbH = TITLE_BLOCK_HEIGHT;

        // Tło tabelki (białe, zakrywa render)
        lines.push(svgRect(tbX, tbY, tbW, tbH, '#000000', 0.7, '#ffffff'));

        const rowHeights = [12, 9, 9];
        const colSplit = 80;

        let curY = tbY;

        // ─── Wiersz 0: Nazwa projektu / mebla | Nr rysunku ───
        const r0H = rowHeights[0];
        lines.push(svgLine(tbX, curY + r0H, tbX + tbW, curY + r0H, '#000000', 0.35));
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + r0H, '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 3, 'Nazwa projektu / mebla', 1.5, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + colSplit + 2, curY + 3, 'Nr rysunku', 1.5, 'start', 'normal', undefined, '#666666'));

        const displayName = this.titleBlock.furnitureName || this.titleBlock.projectName || 'Mebel CAD';
        lines.push(svgText(tbX + 2, curY + 8, displayName, 3.5, 'start', 'bold'));
        lines.push(svgText(tbX + colSplit + 2, curY + 8, this.titleBlock.drawingNumber || 'SB-001', 3.2, 'start', 'bold'));

        curY += r0H;

        // ─── Wiersz 1: Wykonał (Autor) | Data ───
        const r1H = rowHeights[1];
        lines.push(svgLine(tbX, curY + r1H, tbX + tbW, curY + r1H, '#000000', 0.35));
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + r1H, '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 2.5, 'Wykonał', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + colSplit + 2, curY + 2.5, 'Data', 1.2, 'start', 'normal', undefined, '#666666'));

        lines.push(svgText(tbX + 2, curY + 6.5, this.titleBlock.author || 'SmartBox CAD', 2.5));
        lines.push(svgText(tbX + colSplit + 2, curY + 6.5, this.titleBlock.date || '', 2.5));

        curY += r1H;

        // ─── Wiersz 2: Uwagi | Skala | Format ───
        const col2Split = colSplit + 20;
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + rowHeights[2], '#000000', 0.35));
        lines.push(svgLine(tbX + col2Split, curY, tbX + col2Split, curY + rowHeights[2], '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 2.5, 'Uwagi', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + 2, curY + 6.5, this.titleBlock.remarks || '—', 2.4));

        lines.push(svgText(tbX + colSplit + 2, curY + 2.5, 'Skala', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + col2Split + 2, curY + 2.5, 'Format', 1.2, 'start', 'normal', undefined, '#666666'));

        const formatLabel = this.paperFormat.split('_')[0];
        lines.push(svgText(tbX + colSplit + 2, curY + 6.5, this.titleBlock.scale || '1:10', 2.5, 'start', 'bold'));
        lines.push(svgText(tbX + col2Split + 2, curY + 6.5, formatLabel, 2.5, 'start', 'bold'));

        // Branding w rogu tabelki
        lines.push(svgText(tbX + tbW - 2, tbY + tbH - 1.2, 'SmartBox CAD Web', 1.4, 'end', 'normal', undefined, '#999999'));

        return lines.join('\n');
    }

    private _drawViewportImage(): string {
        const lines: string[] = ['<!-- WIDOK 3D (RENDER KADRU) -->'];
        if (!this._viewportPng) return '';

        const area = this.getAvailableDrawingArea();
        const href = this._viewportPng.startsWith('data:') 
            ? this._viewportPng 
            : `data:image/png;base64,${this._viewportPng}`;

        lines.push(
            `<image x="${v(area.x)}" y="${v(area.y)}" width="${v(area.width)}" height="${v(area.height)}" ` +
            `href="${href}" xlink:href="${href}" preserveAspectRatio="xMidYMid meet"/>`
        );
        lines.push(svgRect(area.x, area.y, area.width, area.height, '#e2e8f0', 0.2));

        return lines.join('\n');
    }

    private _drawBomTable(): string {
        if (!this._bomRows || this._bomRows.length === 0) return '';

        const lines: string[] = ['<!-- TABELA ZESTAWIENIA FORMATER (BOM) -->'];
        const rowH = 5.5;
        const headerH = 7.0;
        const numRows = Math.min(this._bomRows.length, 12); // maks. 12 wierszy na arkuszu

        const bomW = TITLE_BLOCK_WIDTH;
        const bomH = headerH + numRows * rowH;

        const bomX = this.frameX + this.frameW - bomW;
        const bomY = this.frameY + this.frameH - TITLE_BLOCK_HEIGHT - bomH - 2;

        lines.push(svgRect(bomX, bomY, bomW, bomH, '#000000', 0.5, '#ffffff'));

        const cols: [string, number][] = [
            ['Lp.', 8],
            ['Nazwa', 32],
            ['Materiał', 28],
            ['Dł.', 14],
            ['Szer.', 14],
            ['Gr.', 10],
            ['Szt.', 14],
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

        // Wiersze danych
        for (let i = 0; i < numRows; i++) {
            const row = this._bomRows[i];
            const ry = bomY + headerH + i * rowH;

            if (i > 0) {
                lines.push(svgLine(bomX, ry, bomX + bomW, ry, '#e2e8f0', 0.15));
            }
            if (i % 2 === 1) {
                lines.push(svgRect(bomX, ry, bomW, rowH, 'none', 0, '#f8fafc'));
            }

            const values = [
                String(i + 1),
                String(row.name || 'Płyta'),
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
                    lines.push(svgText(rowCx + colW / 2, ry + rowH / 2, val, 1.9, 'middle'));
                } else {
                    lines.push(svgText(rowCx + 1.5, ry + rowH / 2, val, 1.9, 'start'));
                }
                rowCx += colW;
            }
        }

        return lines.join('\n');
    }

    private _drawFoldMarks(): string {
        const lines: string[] = ['<!-- ZNACZNIKI SKŁADANIA PAPIERU -->'];
        const markLen = 3;

        // Środek góra i dół
        const cx = this.paperW / 2;
        lines.push(svgLine(cx, 0, cx, markLen, '#cbd5e1', 0.2));
        lines.push(svgLine(cx, this.paperH - markLen, cx, this.paperH, '#cbd5e1', 0.2));

        // Środek lewo i prawo
        const cy = this.paperH / 2;
        lines.push(svgLine(0, cy, markLen, cy, '#cbd5e1', 0.2));
        lines.push(svgLine(this.paperW - markLen, cy, this.paperW, cy, '#cbd5e1', 0.2));

        return lines.join('\n');
    }

    // ─── Metody pomocnicze Eksportu i Pobierania ───

    public async toRasterDataUrl(format: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.95, scale = 2.5): Promise<string> {
        const canvasW = Math.round(this.paperW * 3.7795 * scale);
        const canvasH = Math.round(this.paperH * 3.7795 * scale);
        const scaleFactor = canvasW / this.paperW;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas 2D context unavailable');
        }

        // 1. Białe tło arkusza
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // 2. Rysowanie zrzutu z widoku 3D
        if (this._viewportPng) {
            const area = this.getAvailableDrawingArea();
            const dstX = area.x * scaleFactor;
            const dstY = area.y * scaleFactor;
            const dstW = area.width * scaleFactor;
            const dstH = area.height * scaleFactor;

            const href = this._viewportPng.startsWith('data:')
                ? this._viewportPng
                : `data:image/png;base64,${this._viewportPng}`;

            await new Promise<void>((resolve) => {
                const img3d = new Image();
                img3d.onload = () => {
                    ctx.drawImage(img3d, dstX, dstY, dstW, dstH);
                    resolve();
                };
                img3d.onerror = () => {
                    console.warn('Nie udało się wczytać zrzutu 3D do rasteryzatora');
                    resolve();
                };
                img3d.src = href;
            });
        }

        // 3. Rysujemy wektorową ramkę, stempel ISO 7200, tabelę BOM i wymiary PMI na wierzchu
        const savedViewport = this._viewportPng;
        this._viewportPng = null;
        const vectorOnlySvg = this.generateSvg();
        this._viewportPng = savedViewport;

        const svgBlob = new Blob([vectorOnlySvg], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        await new Promise<void>((resolve, reject) => {
            const svgImg = new Image();
            svgImg.onload = () => {
                ctx.drawImage(svgImg, 0, 0, canvasW, canvasH);
                URL.revokeObjectURL(svgUrl);
                resolve();
            };
            svgImg.onerror = (err) => {
                URL.revokeObjectURL(svgUrl);
                reject(new Error(`Błąd renderowania wektorów SVG: ${err}`));
            };
            svgImg.src = svgUrl;
        });

        return canvas.toDataURL(format, quality);
    }

    public async downloadJpg(filename?: string, quality = 0.95): Promise<void> {
        const name = filename || `Arkusz_CAD_${this.paperFormat}_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
        const dataUrl = await this.toRasterDataUrl('image/jpeg', quality);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    public async downloadPng(filename?: string): Promise<void> {
        const name = filename || `Arkusz_CAD_${this.paperFormat}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        const dataUrl = await this.toRasterDataUrl('image/png', 1.0);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    public copySvgToClipboard(): Promise<void> {
        const svgContent = this.generateSvg();
        return navigator.clipboard.writeText(svgContent);
    }

    public printSvg(): void {
        const svgContent = this.generateSvg();
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Drukuj Arkusz CAD - SmartBox</title>
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
}
