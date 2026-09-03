import { GlobalReportsEngineWeb, PanelPricingResult, AccessoryPricingResult, GlobalProjectSummary } from './global-reports-engine';
import { CuttingPanelContract, ReportDataNormalizer } from './report-data-normalizer';

export class HtmlReportsGeneratorWeb {
    private engine: GlobalReportsEngineWeb;

    constructor(engine?: GlobalReportsEngineWeb) {
        this.engine = engine || new GlobalReportsEngineWeb();
    }

    /**
     * Zwraca kod okleinowania krawędzi (0 = brak, 1 = jedna, 2 = dwie)
     */
    public getEdgeCode(edgeConfig: any, direction: 'length' | 'width', is_x_longer = true): string {
        if (!edgeConfig || typeof edgeConfig !== 'object') {
            return '0';
        }

        let edge1: any;
        let edge2: any;

        if (direction === 'length') {
            if (is_x_longer) {
                edge1 = edgeConfig['+X'] || {};
                edge2 = edgeConfig['-X'] || {};
            } else {
                edge1 = edgeConfig['+Y'] || {};
                edge2 = edgeConfig['-Y'] || {};
            }
        } else {
            if (is_x_longer) {
                edge1 = edgeConfig['+Y'] || {};
                edge2 = edgeConfig['-Y'] || {};
            } else {
                edge1 = edgeConfig['+X'] || {};
                edge2 = edgeConfig['-X'] || {};
            }
        }

        const active1 = edge1.active === true;
        const active2 = edge2.active === true;
        const count = (active1 ? 1 : 0) + (active2 ? 1 : 0);

        return String(count);
    }

    public formatThickness(th: number): string {
        return Math.abs(th - Math.round(th)) < 0.05 ? `${Math.round(th)}mm` : `${th.toFixed(1)}mm`;
    }

    /**
     * Generuje wewnętrzny kod zakładek materiałowych dla listy cięcia (format A4, 30 wierszy per arkusz)
     */
    public generateMaterialCuttingTabsHtml(panels: CuttingPanelContract[], prefix = 'repMatTab'): { buttonsHtml: string; contentHtml: string } {
        const rows_per_sheet = 30;
        const today_str = new Date().toISOString().slice(0, 10);

        // Grupowanie formatek po unikalnym materiale i grubości
        const materialGroups: Record<string, { material_id: string; thickness_mm: number; panels: CuttingPanelContract[] }> = {};

        for (const p of panels) {
            const matKey = `${p.material}_${p.thickness_mm}`;
            if (!materialGroups[matKey]) {
                materialGroups[matKey] = {
                    material_id: p.material,
                    thickness_mm: p.thickness_mm,
                    panels: []
                };
            }
            materialGroups[matKey].panels.push(p);
        }

        const sortedGroups = Object.values(materialGroups).sort((a, b) => {
            const nameA = this.engine.resolveMaterialName(a.material_id).toLowerCase();
            const nameB = this.engine.resolveMaterialName(b.material_id).toLowerCase();
            return nameA.localeCompare(nameB) || a.thickness_mm - b.thickness_mm;
        });

        if (sortedGroups.length === 0) {
            sortedGroups.push({
                material_id: 'W1100_ST9_18',
                thickness_mm: 18,
                panels: []
            });
        }

        let buttonsHtml = '';
        let contentHtml = '';

        sortedGroups.forEach((group, idx) => {
            const matName = this.engine.resolveMaterialName(group.material_id);
            const thickLabel = this.formatThickness(group.thickness_mm);
            const tabTitle = `Lista cięć - ${matName} ${thickLabel}`;
            const tabId = `${prefix}_${idx}`;
            const activeCls = idx === 0 ? ' active' : '';

            buttonsHtml += `<button class="material-tablinks${activeCls}" onclick="openMaterialCutTab(event, '${tabId}')">${tabTitle}</button>`;

            // Sortowanie formatek
            const sortedPanels = [...group.panels].sort((a, b) => {
                return (a.role || '').localeCompare(b.role || '') || (b.length_mm - a.length_mm) || (b.width_mm - a.width_mm);
            });

            // Agregacja identycznych formatek
            const aggPanels = Object.values(ReportDataNormalizer.aggregateContractRows(sortedPanels));
            const totalPages = Math.max(1, Math.ceil(aggPanels.length / rows_per_sheet));

            contentHtml += `<div id="${tabId}" class="material-tabcontent${activeCls}">`;

            for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
                const startRow = pageIdx * rows_per_sheet;
                const pagePanels = aggPanels.slice(startRow, startRow + rows_per_sheet);

                contentHtml += `
                <div class="cut-sheet">
                    <div class="print-button-container no-print">
                        <button onclick="printCurrentTab('${tabId}')" class="print-btn-tab">🖨 Drukuj Formatkę A4</button>
                    </div>

                    <table class="cut-header-table">
                        <tbody>
                            <tr><th>Zleceniodawca</th><td contenteditable="true"></td><th>Zleceniobiorca</th><td contenteditable="true"></td></tr>
                            <tr><th>Materiał</th><td>${matName}</td><th>Grubość</th><td>${thickLabel}</td></tr>
                            <tr><th>Data</th><td>${today_str}</td><th>Strona</th><td>${pageIdx + 1}/${totalPages}</td></tr>
                        </tbody>
                    </table>

                    <table class="cutting-table-a4">
                        <thead>
                            <tr>
                                <th class="cut-col-lp">LP</th>
                                <th class="cut-col-len">Długość</th>
                                <th class="cut-col-lenedge">Oklein. Długości</th>
                                <th class="cut-col-wid">Szerokość</th>
                                <th class="cut-col-widedge">Oklein. Szerokości</th>
                                <th class="cut-col-qty">Szt.</th>
                                <th class="cut-col-role">Uwagi</th>
                            </tr>
                        </thead>
                        <tbody>`;

                for (let r = 0; r < rows_per_sheet; r++) {
                    if (r < pagePanels.length) {
                        const p = pagePanels[r];
                        const lp = r + 1;
                        const lCode = this.getEdgeCode(p.edge_config, 'length', p.is_x_longer);
                        const wCode = this.getEdgeCode(p.edge_config, 'width', p.is_x_longer);

                        contentHtml += `
                            <tr>
                                <td>${lp}</td>
                                <td contenteditable="true">${p.length_mm} mm</td>
                                <td contenteditable="true">${lCode}</td>
                                <td contenteditable="true">${p.width_mm} mm</td>
                                <td contenteditable="true">${wCode}</td>
                                <td contenteditable="true" style="font-weight:bold;">${p.qty}</td>
                                <td class="col-role" contenteditable="true">${p.role}</td>
                            </tr>`;
                    } else {
                        contentHtml += `
                            <tr>
                                <td>${r + 1}</td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td class="col-role" contenteditable="true"></td>
                            </tr>`;
                    }
                }

                contentHtml += `
                        </tbody>
                    </table>
                </div>`;
            }

            contentHtml += `</div>`;
        });

        return { buttonsHtml, contentHtml };
    }

    /**
     * Generuje pełny wielozakładkowy raport HTML dla projektu z listami cięć per materiał
     */
    public generateFullProjectReport(
        projectName: string,
        summary: GlobalProjectSummary,
        panels: PanelPricingResult[],
        accessories: AccessoryPricingResult[] = []
    ): string {
        const dateStr = new Date().toLocaleString('pl-PL');

        const rawContracts: CuttingPanelContract[] = panels.map(p => ({
            part_id: p.part_id,
            role: p.role,
            material: p.material_id,
            thickness_mm: p.thickness_mm,
            length_mm: p.length_mm,
            width_mm: p.width_mm,
            edge_config: p.edge_config,
            is_x_longer: p.is_x_longer,
            furniture_name: p.furniture_name,
            qty: p.qty || 1
        }));

        // Generowanie materiałowych list cięcia (A4)
        const { buttonsHtml: materialTabsBtns, contentHtml: materialTabsContent } = this.generateMaterialCuttingTabsHtml(rawContracts, 'repMatTab');

        // Tabela mebli
        let furnRows = '';
        for (const furn of summary.furnituresBreakdown) {
            furnRows += `<tr><td style="text-align:left; font-weight:600; padding:8px 12px; border:1px solid #ddd;">${furn.name}</td><td style="text-align:right; padding:8px 12px; border:1px solid #ddd; font-weight:bold; color:#1976d2;">${furn.cost.toFixed(2)} PLN</td></tr>`;
        }

        // Tabela szczegółowej wyceny formatek
        let pricingRows = '';
        let pLp = 1;
        for (const p of panels) {
            pricingRows += `
            <tr>
                <td style="padding:4px; border:1px solid #ddd;">${pLp++}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; font-weight:600;">${p.role}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; background:#f6ffed;">${p.material_name}</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; background:#f1f8ff;">${p.length_mm} × ${p.width_mm} × ${p.thickness_mm}</td>
                <td style="padding:4px; border:1px solid #ddd;">${p.area_m2.toFixed(3)} m²</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof p.material_cost === 'number' ? p.material_cost.toFixed(2) + ' PLN' : '<span style="color:red">BRAK</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; background:#fffbe6;">${p.edge_length_mb.toFixed(2)} mb</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof p.edge_cost === 'number' ? p.edge_cost.toFixed(2) + ' PLN' : '<span style="color:red">BRAK</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; color:#1976d2; background:#e3f2fd;">${typeof p.total_netto_pln === 'number' ? p.total_netto_pln.toFixed(2) + ' PLN' : '<span style="color:red">BRAK</span>'}</td>
            </tr>`;
        }

        // Tabela akcesoriów
        let accRows = '';
        let aLp = 1;
        for (const a of accessories) {
            accRows += `
            <tr>
                <td style="padding:4px; border:1px solid #ddd;">${aLp++}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; font-weight:600;">${a.name}</td>
                <td style="padding:4px; border:1px solid #ddd;">${a.qty}</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof a.unit_price_pln === 'number' ? a.unit_price_pln.toFixed(2) + ' PLN' : '<span style="color:red">BRAK CENY</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; color:#1976d2;">${typeof a.total_price_pln === 'number' ? a.total_price_pln.toFixed(2) + ' PLN' : '<span style="color:red">BRAK CENY</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd;">${a.furniture_name}</td>
            </tr>`;
        }

        return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raport Projektu CAD - ${projectName}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f7f9; color: #333; font-size: 13px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #2196f3; padding-bottom: 20px; margin-bottom: 25px; }
        .header h1 { margin: 0; color: #1976d2; font-size: 26px; }
        .header p { margin: 5px 0 0; color: #666; font-size: 14px; }
        
        .top-toolbar { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .tool-btn { background: #2196f3; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; transition: background 0.2s; }
        .tool-btn:hover { background: #1976d2; }
        .tool-btn-green { background: #28a745; }
        .tool-btn-green:hover { background: #218838; }

        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .card { background: #f0f7ff; border: 1px solid #bde0fe; border-radius: 6px; padding: 15px; text-align: center; }
        .card .title { font-size: 11px; text-transform: uppercase; color: #555; font-weight: bold; margin-bottom: 5px; }
        .card .value { font-size: 20px; font-weight: bold; color: #1976d2; }

        /* Główne zakładki */
        .tabs { overflow: hidden; border-bottom: 1px solid #ccc; display: flex; gap: 5px; margin-bottom: 20px; }
        .tablinks { background-color: #f1f1f1; border: 1px solid #ccc; border-bottom: none; cursor: pointer; padding: 10px 20px; transition: 0.3s; font-size: 14px; font-weight: bold; border-radius: 6px 6px 0 0; color: #555; }
        .tablinks:hover { background-color: #e0e0e0; }
        .tablinks.active { background-color: #2196f3; color: white; border-color: #2196f3; }
        .tabcontent { display: none; }
        .tabcontent.active { display: block; animation: fadeEffect 0.3s; }
        @keyframes fadeEffect { from {opacity: 0;} to {opacity: 1;} }

        /* Zakładki materiałowe w liście cięć */
        .material-tabs { overflow: hidden; border-bottom: 1px solid #ccc; display: flex; flex-wrap: wrap; gap: 6px; margin: 15px 0 20px 0; }
        .material-tablinks { background-color: #f1f1f1; border: 1px solid #ccc; cursor: pointer; padding: 8px 14px; font-size: 12px; font-weight: 600; border-radius: 4px 4px 0 0; transition: background 0.2s; }
        .material-tablinks:hover { background-color: #e0e0e0; }
        .material-tablinks.active { background-color: #007bff; color: white; border-color: #007bff; }
        .material-tabcontent { display: none; }
        .material-tabcontent.active { display: block; }

        /* Formatka A4 */
        .cut-sheet {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 25px auto;
            padding: 5mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background: #fff;
            border: 1px dashed #999;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            position: relative;
        }

        .print-button-container { position: absolute; top: -12px; right: -12px; z-index: 100; }
        .print-btn-tab { background: #007bff; color: white; border: 1px solid #0056b3; padding: 6px 12px; cursor: pointer; font-size: 11px; font-weight: bold; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }

        .cut-header-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        .cutting-table-a4 { width: 100%; border-collapse: collapse; table-layout: fixed; }
        
        .cut-header-table th, .cut-header-table td,
        .cutting-table-a4 th, .cutting-table-a4 td {
            border: 1px solid #000;
            padding: 1px 2px;
            font-size: 10px;
            line-height: 1.2;
        }

        .cutting-table-a4 td {
            height: 26px;
            padding: 0 2px !important;
            font-size: 11px !important;
            text-align: center;
        }
        
        .cutting-table-a4 th { height: 26px; background: #eee !important; font-size: 10px !important; text-align: center; font-weight: bold; }
        
        .cut-col-lp { width: 8%; }
        .cut-col-len { width: 16%; }
        .cut-col-lenedge { width: 18%; }
        .cut-col-wid { width: 16%; }
        .cut-col-widedge { width: 18%; }
        .cut-col-qty { width: 6%; }
        .cut-col-role { width: 20%; }
        .cutting-table-a4 td.col-role { text-align: left; }
        .cut-header-table th { width: 18%; text-align: left; font-weight: bold; }
        .cut-header-table td { width: 32%; text-align: left; font-weight: 600; }

        .cut-header-table td[contenteditable="true"], .cutting-table-a4 td[contenteditable="true"] {
            background: #fdfdfd;
            cursor: text;
        }
        .cut-header-table td[contenteditable="true"]:focus, .cutting-table-a4 td[contenteditable="true"]:focus {
            background: #e3f2fd !important;
            outline: 2px solid #007bff;
        }

        /* Tabele podsumowania */
        table.general-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: white; border: 1px solid #ddd; }
        table.general-table th, table.general-table td { padding: 6px 8px; border: 1px solid #ddd; text-align: center; font-size: 11px; }
        table.general-table th { background-color: #f8f9fa; font-weight: bold; color: #333; border-bottom: 2px solid #2196f3; text-transform: uppercase; }
        table.general-table tr:nth-child(even) { background-color: #fafafa; }
        table.general-table tr:hover { background-color: #f1f8ff; }

        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; border: none; width: 100%; padding: 0; }
            .tabs, .material-tabs, .no-print { display: none !important; }
            .tabcontent { display: block !important; }
            .cut-sheet { box-shadow: none; border: none; margin: 0; padding: 0; page-break-after: always; width: 100%; min-height: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Raport Całego Projektu CAD - ${projectName}</h1>
            <p><strong>Data wygenerowania:</strong> ${dateStr}</p>
        </div>

        <div class="top-toolbar no-print">
            <button class="tool-btn" onclick="window.print()">🖨 Drukuj / PDF</button>
            <button class="tool-btn tool-btn-green" onclick="downloadThisHtml()">💾 Pobierz Raport HTML</button>
            <button class="tool-btn tool-btn-green" onclick="exportCuttingToCSV()">📊 Pobierz Listę Cięcia (CSV)</button>
        </div>

        <div class="summary-cards">
            <div class="card">
                <div class="title">Koszt Całkowity</div>
                <div class="value">${typeof summary.SUMA_CALKOWITA_PLN === 'number' ? summary.SUMA_CALKOWITA_PLN.toFixed(2) + ' PLN' : summary.SUMA_CALKOWITA_PLN}</div>
            </div>
            <div class="card">
                <div class="title">Zużycie Płyty</div>
                <div class="value">${summary.Calkowite_powierzchnia_m2.toFixed(3)} m²</div>
            </div>
            <div class="card">
                <div class="title">Długość Obrzeży</div>
                <div class="value">${summary.Calkowite_dlugosc_obrzezy_mb.toFixed(2)} mb</div>
            </div>
            <div class="card">
                <div class="title">Liczba Formatek</div>
                <div class="value">${summary.Liczba_elementow} szt.</div>
            </div>
        </div>

        <div class="tabs no-print">
            <button class="tablinks active" onclick="openTab(event, 'SummaryTab')">Podsumowanie i Płyty</button>
            <button class="tablinks" onclick="openTab(event, 'CuttingListTab')">Lista Cięcia (Formularze Hurtowni A4)</button>
            <button class="tablinks" onclick="openTab(event, 'FurnitureTab')">Zestawienie Mebli (${summary.furnituresBreakdown.length})</button>
            <button class="tablinks" onclick="openTab(event, 'AccessoriesTab')">Okucia i Akcesoria (${accessories.length})</button>
        </div>

        <!-- 1. Podsumowanie i Wycena Szczegółowa -->
        <div id="SummaryTab" class="tabcontent active">
            <h3 style="color:#1976d2; margin-top:0;">Wycena Szczegółowa Formatek</h3>
            <table class="general-table">
                <thead>
                    <tr>
                        <th>LP</th>
                        <th>Rola</th>
                        <th>Materiał</th>
                        <th>Wymiary (mm)</th>
                        <th>Pow. m²</th>
                        <th>Koszt Płyty</th>
                        <th>Obrzeża mb</th>
                        <th>Koszt Obrzeży</th>
                        <th>Suma Netto</th>
                    </tr>
                </thead>
                <tbody>
                    ${pricingRows}
                </tbody>
            </table>
        </div>

        <!-- 2. Lista Cięć - Formularze A4 per materiał -->
        <div id="CuttingListTab" class="tabcontent">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:#1976d2; margin:0;">Listy Cięć dla Hurtowni (Formatka A4 - 30 wierszy/strona)</h3>
                <button class="tool-btn tool-btn-green no-print" onclick="exportCuttingToCSV()">📊 Eksportuj do CSV</button>
            </div>
            <p class="no-print" style="color:#666; font-size:12px; margin:4px 0 10px 0;">Wybierz zakładkę materiału, aby wyświetlić gotowe arkusze do druku lub edycji.</p>
            
            <div class="material-tabs no-print">
                ${materialTabsBtns}
            </div>

            ${materialTabsContent}
        </div>

        <!-- 3. Zestawienie Mebli -->
        <div id="FurnitureTab" class="tabcontent">
            <h3 style="color:#1976d2; margin-top:0;">Koszty poszczególnych mebli / modułów</h3>
            <table class="general-table">
                <thead>
                    <tr><th style="text-align:left;">Nazwa Mebla</th><th style="text-align:right;">Wartość Netto</th></tr>
                </thead>
                <tbody>
                    ${furnRows}
                    <tr style="background:#e3f2fd; font-weight:bold;">
                        <td style="text-align:left; padding:10px;">SUMA PROJEKTU</td>
                        <td style="text-align:right; padding:10px; color:#1565c0; font-size:14px;">${typeof summary.SUMA_CALKOWITA_PLN === 'number' ? summary.SUMA_CALKOWITA_PLN.toFixed(2) + ' PLN' : summary.SUMA_CALKOWITA_PLN}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 4. Akcesoria -->
        <div id="AccessoriesTab" class="tabcontent">
            <h3 style="color:#1976d2; margin-top:0;">Zestawienie Okuć i Akcesoriów</h3>
            <table class="general-table">
                <thead>
                    <tr>
                        <th>LP</th>
                        <th>Nazwa Akcesorium / Okucia</th>
                        <th>Ilość (kpl/szt)</th>
                        <th>Cena Jedn. Netto</th>
                        <th>Suma Netto</th>
                        <th>Mebel</th>
                    </tr>
                </thead>
                <tbody>
                    ${accRows || '<tr><td colspan="6" style="padding:15px; color:#777;">Brak przypisanych akcesoriów</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        function openTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].className = tabcontent[i].className.replace(" active", "");
            }
            tablinks = document.getElementsByClassName("tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            document.getElementById(tabName).className += " active";
            if (evt && evt.currentTarget) evt.currentTarget.className += " active";
        }

        function openMaterialCutTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("material-tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].className = tabcontent[i].className.replace(" active", "");
            }
            tablinks = document.getElementsByClassName("material-tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            var target = document.getElementById(tabName);
            if (target) target.className += " active";
            if (evt && evt.currentTarget) evt.currentTarget.className += " active";
        }

        function downloadThisHtml() {
            const html = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
            const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "${projectName}_raport_" + new Date().toISOString().slice(0, 10) + ".html";
            link.click();
        }

        function printCurrentTab(specificTabId) {
            let activeTab = null;
            if (specificTabId) {
                activeTab = document.getElementById(specificTabId);
            }
            if (!activeTab) {
                activeTab = document.querySelector('.material-tabcontent.active');
            }
            if (!activeTab) return;

            const printWindow = window.open('', '_blank', 'width=900,height=800');
            if (!printWindow) {
                alert('Przeglądarka zablokowała okno drukowania. Zezwól na wyskakujące okna.');
                return;
            }

            printWindow.document.write(\`
                <html>
                <head>
                    <title>Wydruk Listy Cięcia - Formatka A4</title>
                    <style>
                        @page { size: A4 portrait; margin: 5mm; }
                        body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 5mm; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                        th, td { border: 1px solid #000; padding: 2px; font-size: 11px; text-align: center; height: 26px; }
                        th { font-weight: bold; background: #eee !important; height: 26px; -webkit-print-color-adjust: exact; }
                        .cut-header-table { margin-bottom: 8px; }
                        .cut-header-table th { text-align: left; }
                        .cut-header-table td { text-align: left; font-weight: bold; }
                        .col-role { text-align: left; }
                        .print-button-container, .no-print { display: none !important; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    \${activeTab.innerHTML}
                </body>
                </html>
            \`);
            printWindow.document.close();
        }

        function exportCuttingToCSV() {
            let csv = ["\\uFEFFLP;Dlugosc;Okleinowanie_Dlugosci;Szerokosc;Okleinowanie_Szerokosci;Szt;Rola;Material;Grubosc"];
            const tables = document.querySelectorAll('.cutting-table-a4');
            let globalLp = 1;
            tables.forEach(table => {
                const sheet = table.closest('.cut-sheet');
                const headerCells = sheet ? sheet.querySelectorAll('.cut-header-table td') : [];
                const matName = headerCells[1]?.textContent?.trim() || '';
                const thick = headerCells[2]?.textContent?.trim() || '';

                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    const len = cells[1]?.textContent?.trim()?.replace(' mm', '') || '';
                    if (!len) return; // pomiń puste wiersze
                    const lCode = cells[2]?.textContent?.trim() || '0';
                    const wid = cells[3]?.textContent?.trim()?.replace(' mm', '') || '';
                    const wCode = cells[4]?.textContent?.trim() || '0';
                    const qty = cells[5]?.textContent?.trim() || '1';
                    const role = cells[6]?.textContent?.trim() || '';

                    csv.push([globalLp++, len, lCode, wid, wCode, qty, '"' + role + '"', '"' + matName + '"', thick].join(';'));
                });
            });

            const blob = new Blob([csv.join('\\n')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "${projectName}_lista_ciecia.csv";
            link.click();
        }
    </script>
</body>
</html>`;
    }

    /**
     * Generuje formularz zlecenia cięcia / okleinowania dla hurtowni (Formatka A4 z 30 wierszami per strona)
     */
    public generateOrderReportHtml(moduleName: string, panels: CuttingPanelContract[]): string {
        const { buttonsHtml: tabsButtonsHtml, contentHtml: tabsContentHtml } = this.generateMaterialCuttingTabsHtml(panels, 'matTab');

        return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Zamówienie - USŁUGA CIĘCIA/OKLEINOWANIA - ${moduleName}</title>
    <style>
        body { background-color: #f0f2f5; margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .no-print-top { text-align: center; margin-bottom: 20px; background: #fff; padding: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto 20px auto; display: flex; justify-content: center; gap: 12px; align-items: center; flex-wrap: wrap; }
        .print-btn { background: #28a745; color: white; border: none; padding: 10px 22px; font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px; }
        .print-btn:hover { background: #218838; }
        .download-btn { background: #007bff; color: white; border: none; padding: 10px 22px; font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 6px; }
        .download-btn:hover { background: #0056b3; }

        .material-tabs { overflow: hidden; border-bottom: 1px solid #ccc; display: flex; flex-wrap: wrap; gap: 6px; margin: 15px auto; max-width: 210mm; }
        .material-tablinks { background-color: #f1f1f1; border: 1px solid #ccc; cursor: pointer; padding: 8px 14px; font-size: 12px; font-weight: 600; border-radius: 4px 4px 0 0; }
        .material-tablinks.active { background-color: #007bff; color: white; border-color: #007bff; }
        .material-tabcontent { display: none; }
        .material-tabcontent.active { display: block; }

        .cut-sheet {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 25px auto;
            padding: 5mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background: #fff;
            border: 1px dashed #999;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            position: relative;
        }

        .print-button-container { position: absolute; top: -12px; right: -12px; z-index: 100; }
        .print-btn-tab { background: #007bff; color: white; border: 1px solid #0056b3; padding: 6px 12px; cursor: pointer; font-size: 11px; font-weight: bold; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }

        .cut-header-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        .cutting-table-a4 { width: 100%; border-collapse: collapse; table-layout: fixed; }
        
        .cut-header-table th, .cut-header-table td,
        .cutting-table-a4 th, .cutting-table-a4 td {
            border: 1px solid #000;
            padding: 1px 2px;
            font-size: 10px;
            line-height: 1.2;
        }

        .cutting-table-a4 td {
            height: 26px;
            padding: 0 2px !important;
            font-size: 11px !important;
            text-align: center;
        }
        
        .cutting-table-a4 th { height: 26px; background: #eee !important; font-size: 10px !important; text-align: center; font-weight: bold; }
        
        .cut-col-lp { width: 8%; }
        .cut-col-len { width: 16%; }
        .cut-col-lenedge { width: 18%; }
        .cut-col-wid { width: 16%; }
        .cut-col-widedge { width: 18%; }
        .cut-col-qty { width: 6%; }
        .cut-col-role { width: 20%; }
        .cutting-table-a4 td.col-role { text-align: left; }
        .cut-header-table th { width: 18%; text-align: left; font-weight: bold; }
        .cut-header-table td { width: 32%; text-align: left; font-weight: 600; }

        .cut-header-table td[contenteditable="true"], .cutting-table-a4 td[contenteditable="true"] {
            background: #fdfdfd;
            cursor: text;
        }
        .cut-header-table td[contenteditable="true"]:focus, .cutting-table-a4 td[contenteditable="true"]:focus {
            background: #e3f2fd !important;
            outline: 2px solid #007bff;
        }

        @media print {
            .no-print, .no-print-top { display: none !important; }
            body { padding: 0; background: white; }
            .cut-sheet { box-shadow: none; border: none; margin: 0; padding: 0; page-break-after: always; width: 100%; min-height: auto; }
        }
    </style>
</head>
<body>
    <div class="no-print-top">
        <button class="print-btn" onclick="printCurrentTab()">🖨 DRUKUJ ZAMÓWIENIE (A4)</button>
        <button class="download-btn" onclick="downloadOrderHtml()">💾 POBIERZ PLIK HTML</button>
        <p style="font-size: 12px; color: #666; width: 100%; margin: 5px 0 0 0;">Możesz edytować dowolne komórki przed wydrukiem. W oknie drukowania wybierz format A4 oraz marginesy "Brak".</p>
    </div>

    <div class="material-tabs no-print">
        ${tabsButtonsHtml}
    </div>

    ${tabsContentHtml}

    <script>
        function openMaterialCutTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("material-tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].className = tabcontent[i].className.replace(" active", "");
            }
            tablinks = document.getElementsByClassName("material-tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            var target = document.getElementById(tabName);
            if (target) target.className += " active";
            if (evt && evt.currentTarget) evt.currentTarget.className += " active";
        }

        function downloadOrderHtml() {
            const html = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
            const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "Zamowienie_hurtownia_" + new Date().toISOString().slice(0, 10) + ".html";
            link.click();
        }

        function printCurrentTab(specificTabId) {
            let activeTab = null;
            if (specificTabId) {
                activeTab = document.getElementById(specificTabId);
            }
            if (!activeTab) {
                activeTab = document.querySelector('.material-tabcontent.active');
            }
            if (!activeTab) return;

            const printWindow = window.open('', '_blank', 'width=900,height=800');
            if (!printWindow) {
                alert('Przeglądarka zablokowała wyskakujące okno drukowania. Zezwól na okna dla tej strony.');
                return;
            }

            printWindow.document.write(\`
                <html>
                <head>
                    <title>Wydruk Listy Cięcia - Zamówienie</title>
                    <style>
                        @page { size: A4 portrait; margin: 5mm; }
                        body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 5mm; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                        th, td { border: 1px solid #000; padding: 2px; font-size: 11px; text-align: center; height: 26px; }
                        th { font-weight: bold; background: #eee !important; height: 26px; -webkit-print-color-adjust: exact; }
                        .cut-header-table { margin-bottom: 8px; }
                        .cut-header-table th { text-align: left; }
                        .cut-header-table td { text-align: left; font-weight: bold; }
                        .col-role { text-align: left; }
                        .print-button-container, .no-print { display: none !important; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    \${activeTab.innerHTML}
                </body>
                </html>
            \`);
            printWindow.document.close();
        }
    </script>
</body>
</html>`;
    }

    /**
     * Eksportuje listę cięcia do pliku CSV z kodowaniem UTF-8 z BOM
     */
    public generateCsv(panels: CuttingPanelContract[]): string {
        const grouped = ReportDataNormalizer.aggregateContractRows(panels);
        const lines: string[] = [];

        // UTF-8 BOM
        lines.push('\uFEFFLP;Dlugosc;Okleinowanie_Dlugosci;Szerokosc;Okleinowanie_Szerokosci;Szt;Rola;Material;Grubosc');

        let lp = 1;
        for (const p of Object.values(grouped)) {
            const lCode = this.getEdgeCode(p.edge_config, 'length', p.is_x_longer);
            const wCode = this.getEdgeCode(p.edge_config, 'width', p.is_x_longer);
            const matName = this.engine.resolveMaterialName(p.material);

            lines.push([
                lp++,
                Math.round(p.length_mm),
                lCode,
                Math.round(p.width_mm),
                wCode,
                p.qty,
                `"${p.role.replace(/"/g, '""')}"`,
                `"${matName.replace(/"/g, '""')}"`,
                p.thickness_mm
            ].join(';'));
        }

        return lines.join('\n');
    }

    /**
     * Pomocnik do pobierania pliku tekstowego/blob w przeglądarce
     */
    public downloadFile(content: string, filename: string, mimeType = 'text/html;charset=utf-8'): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Otwiera wygenerowany HTML w nowym oknie
     */
    public openHtmlInNewTab(htmlContent: string): void {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
            alert('Wyskakujące okno zostało zablokowane przez przeglądarkę.');
        }
    }
}
