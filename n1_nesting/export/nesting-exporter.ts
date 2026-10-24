/**
 * Eksporter wyników nestingu:
 * - HTML z arkuszami rozkroju z podziałem na materiały, szafki i profil maszyny (Piła vs CNC)
 * - Czyste SVG pojedynczych lub wszystkich płyt
 * - Struktury danych pod maszyny CNC i piły panelowe
 */

import { NestingResult, SheetConfig, PackedBoard } from '../core/nesting-types';

export class NestingExporter {
    /**
     * Generuje kompletny dokument HTML gotowy do wydruku lub zapisu do PDF.
     */
    public static generatePrintableHtml(result: NestingResult, config: SheetConfig, autoPrint = false): string {
        const svgList = result.boards.map((board) => this.generateBoardSvgString(board, config));
        const machineLabel = result.machineType === 'cnc' ? '⚙️ Frezarka CNC (Nesting)' : '🪚 Piła Formatowa / Panelowa';
        const pageOrientation = config.width >= config.height ? 'landscape' : 'portrait';

        let html = `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Plan Rozkroju Płyt (${result.machineType.toUpperCase()}) - Crevo CAD</title>
    <style>
        @page {
            size: A4 ${pageOrientation};
            margin: 10mm;
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #ffffff;
            color: #111827;
            margin: 0;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
            color: #1f2937;
        }
        .summary-box {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 24px;
            font-size: 13px;
        }
        .summary-item strong {
            color: #111827;
        }
        .material-badge {
            background: #e0e7ff;
            color: #3730a3;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
        }
        .machine-badge {
            background: ${result.machineType === 'cnc' ? '#d1fae5' : '#fef3c7'};
            color: ${result.machineType === 'cnc' ? '#065f46' : '#92400e'};
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
        }
        .board-section {
            page-break-after: always;
            margin-bottom: 40px;
        }
        .board-section:last-child {
            page-break-after: auto;
        }
        .board-title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #374151;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .svg-container {
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background: #fafafa;
            display: flex;
            justify-content: center;
            padding: 10px;
        }
        svg {
            max-width: 100%;
            height: auto;
        }
        .print-toolbar {
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 100;
            display: flex;
            gap: 8px;
        }
        .print-toolbar button {
            font: 600 13px 'Segoe UI', Arial, sans-serif;
            background: #4338ca;
            color: #ffffff;
            border: 0;
            border-radius: 6px;
            padding: 10px 16px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .print-toolbar button:hover {
            background: #3730a3;
        }
        @media print {
            .no-print {
                display: none !important;
            }
            body {
                padding: 0;
            }
            svg {
                max-height: none !important;
            }
        }
        .parts-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
            font-size: 12px;
        }
        .parts-table th, .parts-table td {
            border: 1px solid #e5e7eb;
            padding: 6px 10px;
            text-align: left;
        }
        .parts-table th {
            background: #f3f4f6;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="print-toolbar no-print">
        <button type="button" onclick="window.print()">🖨️ Drukuj / Zapisz jako PDF</button>
    </div>
    <div class="header">
        <h1>Plan Rozkroju Płyt — <span class="machine-badge">${machineLabel}</span></h1>
        <div>Data: ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>

    <div class="summary-box">
        <div class="summary-item">Format płyty: <strong>${config.width} x ${config.height} mm</strong></div>
        <div class="summary-item">Rzaz narzędzia: <strong>${config.kerf} mm</strong></div>
        <div class="summary-item">Liczba płyt: <strong>${result.totalBoardsCount}</strong></div>
        <div class="summary-item">Formatek: <strong>${result.totalPartsPlaced} / ${result.totalPartsCount}</strong></div>
        <div class="summary-item">Średni odpad: <strong>${result.avgWastePercent.toFixed(1)}%</strong></div>
        <div class="summary-item">Materiały: <strong>${result.materialGroups?.length || 1}</strong></div>
    </div>
`;

        result.boards.forEach((board, idx) => {
            html += `
    <div class="board-section">
        <div class="board-title">
            <span>Arkusz #${idx + 1} (${config.width} x ${config.height} mm) — <span class="material-badge">${board.materialLabel || board.material || 'Płyta'}</span></span>
            <span>Wykorzystanie: ${board.utilizationPercent.toFixed(1)}% | Odpad: ${board.wastePercent.toFixed(1)}%</span>
        </div>
        <div class="svg-container">
            ${svgList[idx]}
        </div>
        <table class="parts-table">
            <thead>
                <tr>
                    <th width="40">Lp.</th>
                    <th>Nazwa formatki</th>
                    <th width="120">Mebel / Szafka</th>
                    <th width="120">Materiał</th>
                    <th width="100">Wymiar [mm]</th>
                    <th width="80">Pozycja X, Y</th>
                    <th width="80">Obrót</th>
                </tr>
            </thead>
            <tbody>`;

            board.layout.forEach((part, pIdx) => {
                html += `
                <tr>
                    <td>${pIdx + 1}</td>
                    <td><strong>${part.name}</strong></td>
                    <td>${part.furnitureName || '-'}</td>
                    <td>${part.material || board.material || '-'}</td>
                    <td>${part.realW} x ${part.realH}</td>
                    <td>X: ${Math.round(part.x)}, Y: ${Math.round(part.y)}</td>
                    <td>${part.rotated ? 'Tak (90°)' : 'Nie'}</td>
                </tr>`;
            });

            html += `
            </tbody>
        </table>
    </div>`;
        });

        html += autoPrint
            ? `
    <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`
            : `
</body>
</html>`;
        return html;
    }

    /**
     * Generuje ciąg znaków SVG dla pojedynczego arkusza z inteligentnym obracaniem etykiet formatek smukłych.
     */
    public static generateBoardSvgString(board: PackedBoard, config: SheetConfig): string {
        const boardW = board.width;
        const boardH = board.height;

        let partsSvg = '';
        board.layout.forEach((part) => {
            const cx = part.x + part.w / 2;
            const cy = part.y + part.h / 2;
            const isVertical = part.h >= part.w * 1.15;
            const isHorizontal = part.w >= part.h * 1.15;

            let labelSvg = '';

            // 1. Formatka pionowa (np. cokół pionowy 100x1500 mm)
            if (isVertical && part.h >= 90 && part.w >= 28) {
                const fontSizeName = Math.min(22, Math.max(10, part.w * 0.26));
                const fontSizeDims = Math.min(16, Math.max(8, part.w * 0.20));
                const isVeryNarrow = part.w < 65;

                if (isVeryNarrow) {
                    labelSvg = `<g transform="rotate(-90, ${cx}, ${cy})">
                        <text x="${cx}" y="${cy}" font-family="sans-serif" font-size="${fontSizeName}" font-weight="600" fill="#1e1b4b" text-anchor="middle" dominant-baseline="central">${this.escapeXml(part.name)} • ${part.realW}x${part.realH}</text>
                    </g>`;
                } else {
                    labelSvg = `<g transform="rotate(-90, ${cx}, ${cy})">
                        <text x="${cx}" y="${cy - fontSizeName * 0.65}" font-family="sans-serif" font-size="${fontSizeName}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(part.name)}</text>
                        <text x="${cx}" y="${cy + fontSizeDims * 0.85}" font-family="sans-serif" font-size="${fontSizeDims}" fill="#475569" text-anchor="middle">${part.realW} x ${part.realH}${part.rotated ? ' ↺' : ''}</text>
                    </g>`;
                }
            } else if (isHorizontal && part.w >= 90 && part.h >= 28) {
                // 2. Formatka pozioma (np. cokół poziomy 1500x100 mm)
                const fontSizeName = Math.min(22, Math.max(10, part.h * 0.26));
                const fontSizeDims = Math.min(16, Math.max(8, part.h * 0.20));
                const isVeryNarrow = part.h < 65;

                if (isVeryNarrow) {
                    labelSvg = `<text x="${cx}" y="${cy}" font-family="sans-serif" font-size="${fontSizeName}" font-weight="600" fill="#1e1b4b" text-anchor="middle" dominant-baseline="central">${this.escapeXml(part.name)} • ${part.realW}x${part.realH}</text>`;
                } else {
                    labelSvg = `<text x="${cx}" y="${cy - fontSizeName * 0.65}" font-family="sans-serif" font-size="${fontSizeName}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(part.name)}</text>
                        <text x="${cx}" y="${cy + fontSizeDims * 0.85}" font-family="sans-serif" font-size="${fontSizeDims}" fill="#475569" text-anchor="middle">${part.realW} x ${part.realH}${part.rotated ? ' ↺' : ''}</text>`;
                }
            } else if (part.w >= 75 && part.h >= 50) {
                // 3. Formatka proporcjonalna
                const fontSizeName = Math.min(24, Math.max(11, Math.min(part.w, part.h) * 0.16));
                const fontSizeDims = Math.min(18, Math.max(9, Math.min(part.w, part.h) * 0.12));

                labelSvg = `<text x="${cx}" y="${cy - fontSizeName * 0.65}" font-family="sans-serif" font-size="${fontSizeName}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(part.name)}</text>
                    <text x="${cx}" y="${cy + fontSizeDims * 0.85}" font-family="sans-serif" font-size="${fontSizeDims}" fill="#475569" text-anchor="middle">${part.realW} x ${part.realH}${part.rotated ? ' ↺' : ''}</text>`;
            }

            partsSvg += `
        <g>
            <rect x="${part.x}" y="${part.y}" width="${part.w}" height="${part.h}" 
                  fill="#e0e7ff" stroke="#4338ca" stroke-width="1.5">
                <title>${this.escapeXml(part.name)} [${part.realW} x ${part.realH} mm]${part.rotated ? ' (Obrócona 90°)' : ''}</title>
            </rect>
            ${labelSvg}
        </g>`;
        });

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boardW} ${boardH}" width="100%" height="auto" style="max-height: 480px; background: #ffffff;">
    <rect x="0" y="0" width="${boardW}" height="${boardH}" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" />
    ${partsSvg}
</svg>`;
    }

    /**
     * Pobiera wygenerowany plan w przeglądarce jako plik HTML.
     */
    public static downloadHtmlReport(result: NestingResult, config: SheetConfig, filename = 'plan-rozkroju.html'): void {
        const html = this.generatePrintableHtml(result, config);
        this.downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
    }

    /**
     * Otwiera plan rozkroju w nowym oknie i od razu wywołuje okno druku
     * (możliwość wydruku na drukarce lub zapisu do PDF).
     */
    public static printHtmlReport(result: NestingResult, config: SheetConfig): void {
        const html = this.generatePrintableHtml(result, config, true);
        this.openPrintWindow(html, 'plan-rozkroju.html');
    }

    /**
     * Otwiera wydruk pojedynczego arkusza (SVG) w nowym oknie i wywołuje druk.
     */
    public static printBoardSvg(board: PackedBoard, config: SheetConfig): void {
        const svg = this.generateBoardSvgString(board, config);
        const title = `Arkusz #${board.boardIndex} (${board.width} × ${board.height} mm)${board.materialLabel ? ' — ' + board.materialLabel : ''}`;
        this.openPrintWindow(this.wrapSvgHtml(svg, title, config, true), `arkusz-${board.boardIndex}.html`);
    }

    /**
     * Pobiera pojedynczy arkusz jako plik SVG.
     */
    public static downloadBoardSvg(board: PackedBoard, config: SheetConfig, filename?: string): void {
        const svg = this.generateBoardSvgString(board, config);
        this.downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename || `arkusz-${board.boardIndex}.svg`);
    }

    /**
     * Otwiera nowe okno z dokumentem i uruchamia natywne okno druku.
     * Gdy przeglądarka zablokuje popup — pobiera plik HTML jako fallback.
     */
    private static openPrintWindow(html: string, fallbackFilename: string): void {
        const win = window.open('', '_blank');
        if (!win) {
            this.downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), fallbackFilename);
            return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();

        const trigger = () => {
            try {
                win.focus();
                win.print();
            } catch {
                /* okno zamknięte przez użytkownika */
            }
        };
        // SVG/HTML zapisuje się synchronicznie — daj przeglądarce chwilę na layout.
        window.setTimeout(trigger, 400);
    }

    private static wrapSvgHtml(svg: string, title: string, config: SheetConfig, autoPrint: boolean): string {
        const orientation = config.width >= config.height ? 'landscape' : 'portrait';
        return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>${this.escapeXml(title)}</title>
    <style>
        @page { size: A4 ${orientation}; margin: 8mm; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        .sheet-title {
            font: 600 14px 'Segoe UI', Arial, sans-serif;
            color: #111827;
            padding: 8px 4px;
        }
        .svg-wrap svg { width: 100%; height: auto; max-height: none !important; display: block; }
        .toolbar { padding: 8px; }
        .toolbar button {
            font: 600 13px 'Segoe UI', Arial, sans-serif;
            background: #4338ca;
            color: #ffffff;
            border: 0;
            border-radius: 6px;
            padding: 10px 16px;
            cursor: pointer;
        }
        @media print { .toolbar { display: none !important; } }
    </style>
</head>
<body>
    <div class="toolbar"><button type="button" onclick="window.print()">🖨️ Drukuj / Zapisz jako PDF</button></div>
    <div class="sheet-title">${this.escapeXml(title)}</div>
    <div class="svg-wrap">${svg}</div>
    ${autoPrint ? "<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>" : ''}
</body>
</html>`;
    }

    private static downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private static escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }
}
