/**
 * E2_export - drawing-sheet-multiview.ts
 * Generator arkuszy rysunkowych SVG z obsługą wielu rzutów (Multiview CAD).
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
    MultiViewLayout,
    ViewSlotConfig,
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

export interface SlotBox {
    slotIndex: number;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export class DrawingSheetMultiView {
    public paperFormat: PaperFormat;
    public paperW: number;
    public paperH: number;

    public frameX: number;
    public frameY: number;
    public frameW: number;
    public frameH: number;

    public layout: MultiViewLayout;
    public titleBlock: TitleBlockInfo;
    public slots: ViewSlotConfig[] = [];
    private _bomRows: BOMRow[] = [];
    private _svgOverlays: string[] = [];

    constructor(paperFormat: PaperFormat = 'A4_LANDSCAPE', layout: MultiViewLayout = 'TRIPLE_ISO') {
        this.paperFormat = paperFormat;
        this.layout = layout;
        const dims = PAPER_FORMATS[paperFormat] || PAPER_FORMATS['A4_LANDSCAPE'];
        this.paperW = dims.width;
        this.paperH = dims.height;

        this.frameX = MARGIN_LEFT;
        this.frameY = MARGIN_TOP;
        this.frameW = this.paperW - MARGIN_LEFT - MARGIN_RIGHT;
        this.frameH = this.paperH - MARGIN_TOP - MARGIN_BOTTOM;

        const today = new Date().toISOString().split('T')[0];
        this.titleBlock = {
            projectName: 'Projekt Mebla CAD',
            furnitureName: 'Szafa Korpusowa',
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

    public setBomData(rows: BOMRow[]): void {
        this._bomRows = rows || [];
    }

    public addSvgOverlay(svg: string): void {
        this._svgOverlays.push(svg);
    }

    /**
     * Oblicza geometrię poszczególnych slotów (okienek rzutów) w mm na arkuszu.
     */
    public calculateSlotBoxes(): SlotBox[] {
        const gap = 4; // odstęp między slotami (mm)
        const margin = 2; // odsunięcie od ramki (mm)

        const totalX = this.frameX + margin;
        const totalY = this.frameY + margin;
        const totalW = this.frameW - 2 * margin;

        // Tabelka ISO zajmuje prawy dolny róg
        const tbW = TITLE_BLOCK_WIDTH;
        const tbH = TITLE_BLOCK_HEIGHT;

        const availableH = this.frameH - 2 * margin;

        const boxes: SlotBox[] = [];

        switch (this.layout) {
            case 'SINGLE': {
                boxes.push({
                    slotIndex: 0,
                    label: this.slots[0]?.label || 'Widok Główny',
                    x: totalX,
                    y: totalY,
                    w: totalW,
                    h: availableH,
                });
                break;
            }

            case 'DUAL_HORIZONTAL': {
                const wHalf = (totalW - gap) / 2;
                boxes.push({
                    slotIndex: 0,
                    label: this.slots[0]?.label || 'Widok z przodu',
                    x: totalX,
                    y: totalY,
                    w: wHalf,
                    h: availableH,
                });
                boxes.push({
                    slotIndex: 1,
                    label: this.slots[1]?.label || 'Widok z boku',
                    x: totalX + wHalf + gap,
                    y: totalY,
                    w: wHalf,
                    h: availableH - (tbH > 0 ? tbH * 0.4 : 0),
                });
                break;
            }

            case 'DUAL_VERTICAL': {
                const hHalf = (availableH - gap) / 2;
                boxes.push({
                    slotIndex: 0,
                    label: this.slots[0]?.label || 'Rzut z góry (+Z)',
                    x: totalX,
                    y: totalY,
                    w: totalW,
                    h: hHalf,
                });
                boxes.push({
                    slotIndex: 1,
                    label: this.slots[1]?.label || 'Widok z przodu',
                    x: totalX,
                    y: totalY + hHalf + gap,
                    w: totalW - tbW * 0.8,
                    h: hHalf,
                });
                break;
            }

            case 'TRIPLE_ISO': {
                // Układ 3 rzutów standardu ISO:
                // Lewa kolumna (50% szerokości): Góra (Slot 0) i Przód (Slot 1)
                // Prawa kolumna (50% szerokości): Bok lewy (Slot 2) + Miejsce na tabelkę ISO
                const colW = (totalW - gap) / 2;
                const rowH = (availableH - gap) / 2;

                // Slot 0: Góra
                boxes.push({
                    slotIndex: 0,
                    label: this.slots[0]?.label || 'Rzut z góry (+Z)',
                    x: totalX,
                    y: totalY,
                    w: colW,
                    h: rowH,
                });

                // Slot 1: Przód
                boxes.push({
                    slotIndex: 1,
                    label: this.slots[1]?.label || 'Widok z przodu',
                    x: totalX,
                    y: totalY + rowH + gap,
                    w: colW,
                    h: rowH,
                });

                // Slot 2: Bok
                boxes.push({
                    slotIndex: 2,
                    label: this.slots[2]?.label || 'Widok z boku (lewy)',
                    x: totalX + colW + gap,
                    y: totalY,
                    w: colW,
                    h: availableH - tbH - gap,
                });
                break;
            }

            case 'QUAD_CAD':
            default: {
                // Siatka 2x2:
                // Top-Left: Góra (Slot 0)       Top-Right: Izometria 3D (Slot 3)
                // Bottom-Left: Przód (Slot 1)   Bottom-Right: Bok (Slot 2)
                const colW = (totalW - gap) / 2;
                const rowH = (availableH - gap) / 2;

                // Slot 0: Góra
                boxes.push({
                    slotIndex: 0,
                    label: this.slots[0]?.label || 'Rzut z góry (+Z)',
                    x: totalX,
                    y: totalY,
                    w: colW,
                    h: rowH,
                });

                // Slot 1: Przód
                boxes.push({
                    slotIndex: 1,
                    label: this.slots[1]?.label || 'Widok z przodu',
                    x: totalX,
                    y: totalY + rowH + gap,
                    w: colW,
                    h: rowH,
                });

                // Slot 2: Bok
                boxes.push({
                    slotIndex: 2,
                    label: this.slots[2]?.label || 'Widok z boku',
                    x: totalX + colW + gap,
                    y: totalY + rowH + gap,
                    w: colW - tbW * 0.9,
                    h: rowH,
                });

                // Slot 3: Izometria CAD
                boxes.push({
                    slotIndex: 3,
                    label: this.slots[3]?.label || 'Izometria CAD 3D',
                    x: totalX + colW + gap,
                    y: totalY,
                    w: colW,
                    h: rowH,
                });
                break;
            }
        }

        return boxes;
    }

    public generateSvg(): string {
        const parts: string[] = [];

        // Nagłówek SVG
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

        // Sloty i rzuty CAD
        const boxes = this.calculateSlotBoxes();
        for (const box of boxes) {
            const slotData = this.slots[box.slotIndex];
            parts.push(this._drawSlot(box, slotData));
        }

        // Nakładki wektorowe PMI (jeśli są)
        if (this._svgOverlays.length > 0) {
            parts.push('<!-- NAKŁADKI WEKTOROWE PMI -->');
            parts.push(...this._svgOverlays);
        }

        // Tabela BOM (jeśli są pozycje)
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

    private _drawSlot(box: SlotBox, slotData?: ViewSlotConfig): string {
        const lines: string[] = [`<!-- SLOT ${box.slotIndex + 1}: ${box.label} -->`];

        // Ramka slotu
        lines.push(svgRect(box.x, box.y, box.w, box.h, '#e2e8f0', 0.4, '#ffffff'));

        // Pasek etykiety rzutu
        const bannerH = 5.5;
        lines.push(svgRect(box.x, box.y, box.w, bannerH, '#cbd5e1', 0.3, '#f1f5f9'));
        lines.push(svgText(box.x + 3, box.y + bannerH / 2, `• ${box.label}`, 2.2, 'start', 'bold', undefined, '#1e293b'));

        // Obraz kadru (render 3D)
        if (slotData && slotData.imagePng) {
            const imgY = box.y + bannerH;
            const imgH = box.h - bannerH;
            const href = slotData.imagePng.startsWith('data:')
                ? slotData.imagePng
                : `data:image/png;base64,${slotData.imagePng}`;

            lines.push(
                `<image x="${v(box.x + 1)}" y="${v(imgY + 1)}" width="${v(box.w - 2)}" height="${v(imgH - 2)}" ` +
                `href="${href}" xlink:href="${href}" preserveAspectRatio="xMidYMid meet"/>`
            );
        } else {
            // Placeholder braku rzutu
            lines.push(
                svgText(box.x + box.w / 2, box.y + box.h / 2, 'Kadr w trakcie generowania...', 2.5, 'middle', 'normal', undefined, '#94a3b8')
            );
        }

        return lines.join('\n');
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

        // Wiersz 0: Nazwa projektu / mebla | Nr rysunku
        const r0H = rowHeights[0];
        lines.push(svgLine(tbX, curY + r0H, tbX + tbW, curY + r0H, '#000000', 0.35));
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + r0H, '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 3, 'Nazwa projektu / mebla', 1.5, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + colSplit + 2, curY + 3, 'Nr rysunku', 1.5, 'start', 'normal', undefined, '#666666'));

        const displayName = this.titleBlock.furnitureName || this.titleBlock.projectName || 'Mebel CAD';
        lines.push(svgText(tbX + 2, curY + 8, displayName, 3.5, 'start', 'bold'));
        lines.push(svgText(tbX + colSplit + 2, curY + 8, this.titleBlock.drawingNumber || 'SB-001', 3.2, 'start', 'bold'));

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
        const col2Split = 100;
        lines.push(svgLine(tbX + colSplit, curY, tbX + colSplit, curY + rowHeights[2], '#000000', 0.35));
        lines.push(svgLine(tbX + col2Split, curY, tbX + col2Split, curY + rowHeights[2], '#000000', 0.35));

        lines.push(svgText(tbX + 2, curY + 2.5, 'Układ', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + 2, curY + 6.5, `Multiview (${this.layout})`, 2.2));

        lines.push(svgText(tbX + colSplit + 2, curY + 2.5, 'Skala', 1.2, 'start', 'normal', undefined, '#666666'));
        lines.push(svgText(tbX + col2Split + 2, curY + 2.5, 'Format', 1.2, 'start', 'normal', undefined, '#666666'));

        const formatLabel = this.paperFormat.split('_')[0];
        lines.push(svgText(tbX + colSplit + 2, curY + 6.5, this.titleBlock.scale || '1:10', 2.5, 'start', 'bold'));
        lines.push(svgText(tbX + col2Split + 2, curY + 6.5, formatLabel, 2.5, 'start', 'bold'));

        // Branding
        lines.push(svgText(tbX + tbW - 2, tbY + tbH - 1.2, 'SmartBox Multiview CAD', 1.4, 'end', 'normal', undefined, '#999999'));

        return lines.join('\n');
    }

    private _drawBomTable(): string {
        if (!this._bomRows || this._bomRows.length === 0) return '';

        const lines: string[] = ['<!-- TABELA BOM -->'];
        const rowH = 5.0;
        const headerH = 6.5;
        const numRows = Math.min(this._bomRows.length, 10);

        const bomW = TITLE_BLOCK_WIDTH;
        const bomH = headerH + numRows * rowH;
        const bomX = this.frameX + this.frameW - bomW;
        const bomY = this.frameY + this.frameH - TITLE_BLOCK_HEIGHT - bomH - 2;

        lines.push(svgRect(bomX, bomY, bomW, bomH, '#000000', 0.5, '#ffffff'));
        lines.push(svgRect(bomX, bomY, bomW, headerH, '#000000', 0.4, '#f1f5f9'));
        lines.push(svgText(bomX + 2, bomY + headerH / 2, 'WYKAZ FORMATER (BOM)', 2.2, 'start', 'bold'));

        let curY = bomY + headerH;
        for (let i = 0; i < numRows; i++) {
            const row = this._bomRows[i];
            lines.push(svgLine(bomX, curY, bomX + bomW, curY, '#e2e8f0', 0.3));
            lines.push(svgText(bomX + 2, curY + rowH / 2, `${row.name} (${row.length}×${row.width}×${row.thickness})`, 1.8));
            lines.push(svgText(bomX + bomW - 2, curY + rowH / 2, `${row.qty} szt.`, 1.8, 'end', 'bold'));
            curY += rowH;
        }

        return lines.join('\n');
    }

    private _drawFoldMarks(): string {
        const lines: string[] = ['<!-- ZNACZNIKI SKŁADANIA -->'];
        const len = 3;

        if (this.paperW > 297) {
            lines.push(svgLine(210, 0, 210, len, '#999999', 0.25));
            lines.push(svgLine(210, this.paperH - len, 210, this.paperH, '#999999', 0.25));
        }

        return lines.join('\n');
    }

    public downloadSvg(filename: string = 'Projekt_CAD_Multiview.svg'): void {
        const svgContent = this.generateSvg();
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    public async downloadJpg(filename: string = 'Projekt_CAD_Multiview.jpg', dpi: number = 300): Promise<void> {
        const svgContent = this.generateSvg();
        const mmToInch = 25.4;
        const widthPx = Math.round((this.paperW / mmToInch) * dpi);
        const heightPx = Math.round((this.paperH / mmToInch) * dpi);

        const canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Nie można utworzyć kontekstu Canvas 2D');

        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        return new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, widthPx, heightPx);
                ctx.drawImage(img, 0, 0, widthPx, heightPx);
                URL.revokeObjectURL(url);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Błąd konwersji do JPG'));
                            return;
                        }
                        const jpgUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = jpgUrl;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(jpgUrl);
                        resolve();
                    },
                    'image/jpeg',
                    0.95
                );
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(new Error('Błąd wczytywania SVG do konwersji: ' + e));
            };
            img.src = url;
        });
    }

    public printSvg(): void {
        const svgContent = this.generateSvg();
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Zezwól na wyskakujące okienka (popups), aby wydrukować arkusz.');
            return;
        }

        const isLandscape = this.paperW >= this.paperH;
        const orientation = isLandscape ? 'landscape' : 'portrait';

        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${this.titleBlock.furnitureName || 'Dokumentacja CAD Multiview'}</title>
                <style>
                    @page {
                        size: ${this.paperW}mm ${this.paperH}mm ${orientation};
                        margin: 0;
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        background: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100vw;
                        height: 100vh;
                        overflow: hidden;
                    }
                    svg {
                        width: 100vw;
                        height: 100vh;
                        max-width: ${this.paperW}mm;
                        max-height: ${this.paperH}mm;
                        display: block;
                    }
                </style>
            </head>
            <body>
                ${svgContent}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 400);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}
