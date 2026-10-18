import{p as M,c as I,j as y,R as U,r as _}from"./price-store-DIR5OcdD.js";import{ar as B,aq as z,a as D,r as S,t as N,s as j,D as F,e as T,c as K,M as G,as as H,w as q}from"./report-data-normalizer-ClIE9V2P.js";import{M as W}from"./ModuleSourceBar-CK6pBMLT.js";class E{smartPanel;materialNameCache={};constructor(){this.smartPanel=B,this._buildMaterialNameCache()}get prices(){return M.prices}_buildMaterialNameCache(){try{const t=this.smartPanel?.materials_database||{};for(const e of Object.values(t))if(e?.items)for(const[n,i]of Object.entries(e.items))i?.name&&(this.materialNameCache[n]=String(i.name))}catch{this.materialNameCache={}}}resolveMaterialName(t){if(!t)return"Płyta";if(this.materialNameCache[t])return this.materialNameCache[t];const e=this.prices?.prices_materials||{};return e[t]?.name?e[t].name:t.replace(/_/g," ")}getMaterialPricePerM2(t){const e=this.prices?.prices_materials||{};if(e[t]!==void 0){const i=e[t];return Number(typeof i=="object"?i.price:i)}const n=t.trim().toUpperCase().replace(/[\s\-]+/g,"_");for(const[i,a]of Object.entries(e))if(i.trim().toUpperCase().replace(/[\s\-]+/g,"_")===n)return Number(typeof a=="object"?a.price:a);return null}getEdgeBandPricePerM(t){const e=this.smartPanel?.edge_banding_types||{},n=this.prices?.prices_services||{};let i="";if(e[t]?.prices_services&&(i=e[t].prices_services),i&&n[i]!==void 0){const l=n[i];return Number(typeof l=="object"?l.price:l)}const a={"0.008X0.022":"EDGE_BANDING_08x22","0.008x0.022":"EDGE_BANDING_08x22","0.8X22":"EDGE_BANDING_08x22","ABS_0.8X22":"EDGE_BANDING_08x22","ABS_0.8x22":"EDGE_BANDING_08x22",ABS_1X22:"EDGE_BANDING_08x22",ABS_1x22:"EDGE_BANDING_08x22","ABS_1.0X22":"EDGE_BANDING_08x22","ABS_1.0x22":"EDGE_BANDING_08x22","2.0X22":"okleinowanie_2x22","2.0x22":"okleinowanie_2x22","2X22":"okleinowanie_2x22",ABS_2X22:"okleinowanie_2x22","ABS_2.0X22":"okleinowanie_2x22","2.0X50":"okleinowanie_2x50","2.0x50":"okleinowanie_2x50","2X50":"okleinowanie_2x50","ABS_0.8X43":"okleinowanie_2x50","ABS_0.8x43":"okleinowanie_2x50"},r=t.trim().toUpperCase();if(a[r]&&n[a[r]]!==void 0){const l=n[a[r]];return Number(typeof l=="object"?l.price:l)}return 3.5}calculatePartPricing(t){const e=t.length_mm/1e3,n=t.width_mm/1e3,i=Math.round(e*n*1e3)/1e3,a=this.getMaterialPricePerM2(t.material),r=this.resolveMaterialName(t.material);let l=null;a!==null&&(l=Math.round(i*a*100)/100);let c=0,b=0,u=!1;const f=t.edge_config||{},h=["+X","-X","+Y","-Y"];for(const d of h){const g=f[d];if(g&&g.active){const x=(d==="+X"||d==="-X"?t.is_x_longer:!t.is_x_longer)?e:n;c+=x;const w=this.getEdgeBandPricePerM(g.type_id||"0.008x0.022");w===null?u=!0:u||(b+=x*w)}}const p=Math.round(c*100)/100,o=u?null:Math.round(b*100)/100;let m=null;return l!==null&&o!==null&&(m=Math.round((l+o)*100)/100),{part_id:t.part_id,role:t.role,material_id:t.material,material_name:r,thickness_mm:t.thickness_mm,length_mm:t.length_mm,width_mm:t.width_mm,area_m2:i,price_per_m2:a!==null?a:null,material_cost:l,edge_length_mb:p,edge_cost:o,total_netto_pln:m,edge_config:t.edge_config,is_x_longer:t.is_x_longer,furniture_name:t.furniture_name,qty:t.qty||1}}calculateAccessoryPricing(t){if(t.custom_unit_price!==void 0){const r=Number(t.custom_unit_price),l=Math.round(r*t.qty*100)/100;return{id:t.id,name:t.name,role:t.role,library_id:t.library_id,qty:t.qty,unit_price_pln:r,total_price_pln:l,furniture_name:t.furniture_name}}const e=this.prices?.prices_hardware||{};let n=e[t.library_id];if(n===void 0){const r=t.library_id.trim().toUpperCase();for(const[l,c]of Object.entries(e))if(l.trim().toUpperCase()===r){n=c;break}}let i=null,a=null;if(n!==void 0){const r=Number(typeof n=="object"?n.price:n);(typeof n=="object"?n.unit:"szt")==="m2"&&t.area_m2?i=Math.round(r*t.area_m2*100)/100:i=r,a=Math.round(i*t.qty*100)/100}return{id:t.id,name:t.name,role:t.role,library_id:t.library_id,qty:t.qty,unit_price_pln:i,total_price_pln:a,furniture_name:t.furniture_name}}calculateGlobalSummary(t,e=[]){let n=0,i=0,a=0,r=0,l=!1;const c={};for(const d of t){const g=d.qty||1;n+=d.area_m2*g,a+=d.edge_length_mb*g,d.material_cost===null||d.edge_cost===null?l=!0:(i+=Number(d.material_cost)*g,r+=Number(d.edge_cost)*g),d.total_netto_pln!==null&&(c[d.furniture_name]=(c[d.furniture_name]||0)+Number(d.total_netto_pln)*g)}let b=0,u=0,f=!1;for(const d of e)b+=d.qty,d.total_price_pln===null?f=!0:(u+=Number(d.total_price_pln),c[d.furniture_name]=(c[d.furniture_name]||0)+Number(d.total_price_pln));const h=l?null:Math.round((i+r)*100)/100,p=f?null:Math.round(u*100)/100;let o=null;h!==null&&p!==null&&(o=Math.round((h+p)*100)/100);const m=Object.entries(c).map(([d,g])=>({name:d,cost:Math.round(g*100)/100}));return{Liczba_elementow:t.reduce((d,g)=>d+(g.qty||1),0),Calkowite_powierzchnia_m2:Math.round(n*1e3)/1e3,Calkowite_cena_plyt_PLN:l?null:Math.round(i*100)/100,Calkowite_dlugosc_obrzezy_mb:Math.round(a*100)/100,Calkowite_cena_obrzezy_PLN:l?null:Math.round(r*100)/100,SUMA_PLYTY_PLN:h,Calkowite_liczba_akcesorii_szt:b,Calkowite_cena_akcesorii_PLN:p,SUMA_AKCESORIA_PLN:p,SUMA_CALKOWITA_PLN:o,furnituresBreakdown:m}}}class Y{engine;constructor(t){this.engine=t||new E}getEdgeCode(t,e,n=!0){if(!t||typeof t!="object")return"0";let i,a;e==="length"?n?(i=t["+X"]||{},a=t["-X"]||{}):(i=t["+Y"]||{},a=t["-Y"]||{}):n?(i=t["+Y"]||{},a=t["-Y"]||{}):(i=t["+X"]||{},a=t["-X"]||{});const r=i.active===!0,l=a.active===!0,c=(r?1:0)+(l?1:0);return String(c)}formatThickness(t){return Math.abs(t-Math.round(t))<.05?`${Math.round(t)}mm`:`${t.toFixed(1)}mm`}generateMaterialCuttingTabsHtml(t,e="repMatTab"){const i=new Date().toISOString().slice(0,10),a={};for(const b of t){const u=`${b.material}_${b.thickness_mm}`;a[u]||(a[u]={material_id:b.material,thickness_mm:b.thickness_mm,panels:[]}),a[u].panels.push(b)}const r=Object.values(a).sort((b,u)=>{const f=this.engine.resolveMaterialName(b.material_id).toLowerCase(),h=this.engine.resolveMaterialName(u.material_id).toLowerCase();return f.localeCompare(h)||b.thickness_mm-u.thickness_mm});r.length===0&&r.push({material_id:"W1100_ST9_18",thickness_mm:18,panels:[]});let l="",c="";return r.forEach((b,u)=>{const f=this.engine.resolveMaterialName(b.material_id),h=this.formatThickness(b.thickness_mm),p=`Lista cięć - ${f} ${h}`,o=`${e}_${u}`,m=u===0?" active":"";l+=`<button class="material-tablinks${m}" onclick="openMaterialCutTab(event, '${o}')">${p}</button>`;const d=[...b.panels].sort((x,w)=>(x.role||"").localeCompare(w.role||"")||w.length_mm-x.length_mm||w.width_mm-x.width_mm),g=Object.values(z.aggregateContractRows(d)),A=Math.max(1,Math.ceil(g.length/30));c+=`<div id="${o}" class="material-tabcontent${m}">`;for(let x=0;x<A;x++){const w=x*30,P=g.slice(w,w+30);c+=`
                <div class="cut-sheet">
                    <div class="print-button-container no-print">
                        <button onclick="printCurrentTab('${o}')" class="print-btn-tab">🖨 Drukuj Formatkę A4</button>
                    </div>

                    <table class="cut-header-table">
                        <tbody>
                            <tr><th>Zleceniodawca</th><td contenteditable="true"></td><th>Zleceniobiorca</th><td contenteditable="true"></td></tr>
                            <tr><th>Materiał</th><td>${f}</td><th>Grubość</th><td>${h}</td></tr>
                            <tr><th>Data</th><td>${i}</td><th>Strona</th><td>${x+1}/${A}</td></tr>
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
                        <tbody>`;for(let v=0;v<30;v++)if(v<P.length){const k=P[v],$=v+1,O=this.getEdgeCode(k.edge_config,"length",k.is_x_longer),R=this.getEdgeCode(k.edge_config,"width",k.is_x_longer);c+=`
                            <tr>
                                <td>${$}</td>
                                <td contenteditable="true">${k.length_mm} mm</td>
                                <td contenteditable="true">${O}</td>
                                <td contenteditable="true">${k.width_mm} mm</td>
                                <td contenteditable="true">${R}</td>
                                <td contenteditable="true" style="font-weight:bold;">${k.qty}</td>
                                <td class="col-role" contenteditable="true">${k.role}</td>
                            </tr>`}else c+=`
                            <tr>
                                <td>${v+1}</td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td contenteditable="true"></td>
                                <td class="col-role" contenteditable="true"></td>
                            </tr>`;c+=`
                        </tbody>
                    </table>
                </div>`}c+="</div>"}),{buttonsHtml:l,contentHtml:c}}generateFullProjectReport(t,e,n,i=[]){const a=new Date().toLocaleString("pl-PL"),r=n.map(o=>({part_id:o.part_id,role:o.role,material:o.material_id,thickness_mm:o.thickness_mm,length_mm:o.length_mm,width_mm:o.width_mm,edge_config:o.edge_config,is_x_longer:o.is_x_longer,furniture_name:o.furniture_name,qty:o.qty||1})),{buttonsHtml:l,contentHtml:c}=this.generateMaterialCuttingTabsHtml(r,"repMatTab");let b="";for(const o of e.furnituresBreakdown)b+=`<tr><td style="text-align:left; font-weight:600; padding:8px 12px; border:1px solid #ddd;">${o.name}</td><td style="text-align:right; padding:8px 12px; border:1px solid #ddd; font-weight:bold; color:#1976d2;">${o.cost.toFixed(2)} PLN</td></tr>`;let u="",f=1;for(const o of n)u+=`
            <tr>
                <td style="padding:4px; border:1px solid #ddd;">${f++}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; font-weight:600;">${o.role}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; background:#f6ffed;">${o.material_name}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:center;">${o.thickness_mm} mm</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; background:#f1f8ff;">${o.length_mm} × ${o.width_mm} × ${o.thickness_mm}</td>
                <td style="padding:4px; border:1px solid #ddd;">${o.area_m2.toFixed(3)} m²</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof o.material_cost=="number"?o.material_cost.toFixed(2)+" PLN":'<span style="color:red">BRAK</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; background:#fffbe6;">${o.edge_length_mb.toFixed(2)} mb</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof o.edge_cost=="number"?o.edge_cost.toFixed(2)+" PLN":'<span style="color:red">BRAK</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; color:#1976d2; background:#e3f2fd;">${typeof o.total_netto_pln=="number"?o.total_netto_pln.toFixed(2)+" PLN":'<span style="color:red">BRAK</span>'}</td>
            </tr>`;let h="",p=1;for(const o of i)h+=`
            <tr>
                <td style="padding:4px; border:1px solid #ddd;">${p++}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; font-weight:600;">${o.name}</td>
                <td style="padding:4px; border:1px solid #ddd;">${o.qty}</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof o.unit_price_pln=="number"?o.unit_price_pln.toFixed(2)+" PLN":'<span style="color:red">BRAK CENY</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; color:#1976d2;">${typeof o.total_price_pln=="number"?o.total_price_pln.toFixed(2)+" PLN":'<span style="color:red">BRAK CENY</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd;">${o.furniture_name}</td>
            </tr>`;return`<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raport Projektu CAD - ${t}</title>
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
            <h1>Raport Całego Projektu CAD - ${t}</h1>
            <p><strong>Data wygenerowania:</strong> ${a}</p>
        </div>

        <div class="top-toolbar no-print">
            <button class="tool-btn" onclick="window.print()">🖨 Drukuj / PDF</button>
            <button class="tool-btn tool-btn-green" onclick="downloadThisHtml()">💾 Pobierz Raport HTML</button>
            <button class="tool-btn tool-btn-green" onclick="exportCuttingToCSV()">📊 Pobierz Listę Cięcia (CSV)</button>
        </div>

        <div class="summary-cards">
            <div class="card">
                <div class="title">Koszt Całkowity</div>
                <div class="value">${typeof e.SUMA_CALKOWITA_PLN=="number"?e.SUMA_CALKOWITA_PLN.toFixed(2)+" PLN":e.SUMA_CALKOWITA_PLN}</div>
            </div>
            <div class="card">
                <div class="title">Okucia i Akcesoria</div>
                <div class="value" style="color:#7c3aed;">${typeof e.SUMA_AKCESORIA_PLN=="number"?e.SUMA_AKCESORIA_PLN.toFixed(2)+" PLN":e.SUMA_AKCESORIA_PLN}</div>
            </div>
            <div class="card">
                <div class="title">Płyty i Obrzeża</div>
                <div class="value">${typeof e.SUMA_PLYTY_PLN=="number"?e.SUMA_PLYTY_PLN.toFixed(2)+" PLN":e.SUMA_PLYTY_PLN}</div>
            </div>
            <div class="card">
                <div class="title">Zużycie Płyty</div>
                <div class="value">${e.Calkowite_powierzchnia_m2.toFixed(3)} m²</div>
            </div>
            <div class="card">
                <div class="title">Długość Obrzeży</div>
                <div class="value">${e.Calkowite_dlugosc_obrzezy_mb.toFixed(2)} mb</div>
            </div>
            <div class="card">
                <div class="title">Liczba Formatek / Okuć</div>
                <div class="value">${e.Liczba_elementow} / ${e.Calkowite_liczba_akcesorii_szt} szt.</div>
            </div>
        </div>

        <div class="tabs no-print">
            <button class="tablinks active" onclick="openTab(event, 'SummaryTab')">Podsumowanie i Płyty</button>
            <button class="tablinks" onclick="openTab(event, 'CuttingListTab')">Lista Cięcia (Formularze Hurtowni A4)</button>
            <button class="tablinks" onclick="openTab(event, 'FurnitureTab')">Zestawienie Mebli (${e.furnituresBreakdown.length})</button>
            <button class="tablinks" onclick="openTab(event, 'AccessoriesTab')">Okucia i Akcesoria (${i.length})</button>
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
                        <th>Grubość</th>
                        <th>Wymiary (mm)</th>
                        <th>Pow. m²</th>
                        <th>Koszt Płyty</th>
                        <th>Obrzeża mb</th>
                        <th>Koszt Obrzeży</th>
                        <th>Suma Netto</th>
                    </tr>
                </thead>
                <tbody>
                    ${u}
                </tbody>
                <tfoot>
                    <tr style="background:#e3f2fd; font-weight:bold;">
                        <td colspan="5" style="text-align:left; padding:10px; font-size:12px;">SUMA FORMATEK I OBRZEŻY</td>
                        <td style="padding:10px;">${e.Calkowite_powierzchnia_m2.toFixed(3)} m²</td>
                        <td style="padding:10px;">${typeof e.Calkowite_cena_plyt_PLN=="number"?e.Calkowite_cena_plyt_PLN.toFixed(2)+" PLN":e.Calkowite_cena_plyt_PLN}</td>
                        <td style="padding:10px;">${e.Calkowite_dlugosc_obrzezy_mb.toFixed(2)} mb</td>
                        <td style="padding:10px;">${typeof e.Calkowite_cena_obrzezy_PLN=="number"?e.Calkowite_cena_obrzezy_PLN.toFixed(2)+" PLN":e.Calkowite_cena_obrzezy_PLN}</td>
                        <td style="padding:10px; color:#1565c0; font-size:14px; font-weight:bold;">${typeof e.SUMA_PLYTY_PLN=="number"?e.SUMA_PLYTY_PLN.toFixed(2)+" PLN":e.SUMA_PLYTY_PLN}</td>
                    </tr>
                </tfoot>
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
                ${l}
            </div>

            ${c}
        </div>

        <!-- 3. Zestawienie Mebli -->
        <div id="FurnitureTab" class="tabcontent">
            <h3 style="color:#1976d2; margin-top:0;">Koszty poszczególnych mebli / modułów</h3>
            <table class="general-table">
                <thead>
                    <tr><th style="text-align:left;">Nazwa Mebla</th><th style="text-align:right;">Wartość Netto</th></tr>
                </thead>
                <tbody>
                    ${b}
                    <tr style="background:#e3f2fd; font-weight:bold;">
                        <td style="text-align:left; padding:10px;">SUMA PROJEKTU</td>
                        <td style="text-align:right; padding:10px; color:#1565c0; font-size:14px;">${typeof e.SUMA_CALKOWITA_PLN=="number"?e.SUMA_CALKOWITA_PLN.toFixed(2)+" PLN":e.SUMA_CALKOWITA_PLN}</td>
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
                    ${h||'<tr><td colspan="6" style="padding:15px; color:#777;">Brak przypisanych akcesoriów</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background:#e3f2fd; font-weight:bold;">
                        <td colspan="2" style="text-align:left; padding:10px; font-size:12px;">SUMA OKUĆ I AKCESORIÓW</td>
                        <td style="padding:10px; font-size:12px;">${e.Calkowite_liczba_akcesorii_szt} szt.</td>
                        <td style="padding:10px;">—</td>
                        <td style="padding:10px; color:#1565c0; font-size:14px; font-weight:bold;">${typeof e.SUMA_AKCESORIA_PLN=="number"?e.SUMA_AKCESORIA_PLN.toFixed(2)+" PLN":e.SUMA_AKCESORIA_PLN}</td>
                        <td style="padding:10px;">—</td>
                    </tr>
                </tfoot>
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
            link.download = "${t}_raport_" + new Date().toISOString().slice(0, 10) + ".html";
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
            link.download = "${t}_lista_ciecia.csv";
            link.click();
        }
    <\/script>
</body>
</html>`}generateOrderReportHtml(t,e){const{buttonsHtml:n,contentHtml:i}=this.generateMaterialCuttingTabsHtml(e,"matTab");return`<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Zamówienie - USŁUGA CIĘCIA/OKLEINOWANIA - ${t}</title>
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
        ${n}
    </div>

    ${i}

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
    <\/script>
</body>
</html>`}generateCsv(t){const e=z.aggregateContractRows(t),n=[];n.push("\uFEFFLP;Dlugosc;Okleinowanie_Dlugosci;Szerokosc;Okleinowanie_Szerokosci;Szt;Rola;Material;Grubosc");let i=1;for(const a of Object.values(e)){const r=this.getEdgeCode(a.edge_config,"length",a.is_x_longer),l=this.getEdgeCode(a.edge_config,"width",a.is_x_longer),c=this.engine.resolveMaterialName(a.material);n.push([i++,Math.round(a.length_mm),r,Math.round(a.width_mm),l,a.qty,`"${a.role.replace(/"/g,'""')}"`,`"${c.replace(/"/g,'""')}"`,a.thickness_mm].join(";"))}return n.join(`
`)}downloadFile(t,e,n="text/html;charset=utf-8"){const i=new Blob([t],{type:n}),a=URL.createObjectURL(i),r=document.createElement("a");r.href=a,r.download=e,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(a)}openHtmlInNewTab(t){const e=new Blob([t],{type:"text/html;charset=utf-8"}),n=URL.createObjectURL(e);window.open(n,"_blank")||alert("Wyskakujące okno zostało zablokowane przez przeglądarkę.")}}const C=j,L="src";D("report");function X(s){const t=new E,e=new Y(t),n=s.panels.map(l=>t.calculatePartPricing(l)),i=(s.accessories||[]).map(l=>t.calculateAccessoryPricing(l)),a=t.calculateGlobalSummary(n,i),r=s.scope?.type==="PROJECT"||!s.scope?.name?s.meta?.originLabel||"Projekt CAD":`Wycena: ${s.scope.name}`;return e.generateFullProjectReport(r,a,n,i)}function Z(s,t){const e=JSON.parse(s),n=e.panels?{meta:{module:"report",sourceId:"json",loadedAt:new Date().toISOString(),originLabel:`JSON · ${t}`},scope:e.scope||{type:"PROJECT",id:"ALL",name:t},panels:e.panels,accessories:e.accessories||[],furnitures:e.furnitures||[],containers:e.containers||[]}:e;if(!n.panels)throw new Error(N(C,"entry.report_panels",L));return n}function J(){const[s,t]=_.useState(()=>S("report")),[e,n]=_.useState(s?null:N(C,"entry.report_empty",L)),[i,a]=_.useState(null),[r,l]=_.useState(0);_.useEffect(()=>M.subscribe(()=>l(p=>p+1)),[]);const c=_.useCallback(()=>{const p=S("report");p?.panels&&(t(p),n(null),a(p.meta?.loadedAt?`${N(C,"entry.refreshed",L)} ${new Date(p.meta.loadedAt).toLocaleTimeString(F())}`:N(C,"entry.refreshed",L)))},[]),b=_.useCallback(()=>{const p=s?.scope;if(!p){a(N(C,"entry.no_scope",L));return}a("Pobieram z CAD…"),T("report",p),window.setTimeout(()=>c(),400)},[s?.scope,c]);_.useEffect(()=>{const p=m=>{m.key===H.report&&m.newValue&&c()};window.addEventListener("storage",p);let o=null;try{o=new BroadcastChannel(K),o.onmessage=m=>{const d=m.data;d?.type===G&&d.module==="report"&&c()}}catch{}return()=>{window.removeEventListener("storage",p);try{o?.close()}catch{}}},[c]),_.useEffect(()=>{const p=()=>{s?.meta?.sourceId!=="cad"&&s?.meta?.sourceId!=="session"||s?.scope&&T("report",s.scope)};return window.addEventListener("focus",p),()=>window.removeEventListener("focus",p)},[s?.meta?.sourceId,s?.scope]);const u=_.useMemo(()=>{if(!s?.panels)return null;try{return X(s)}catch{return null}},[s,r]),f=(p,o)=>{try{const m=Z(p,o);q("report",m),t(m),n(null),a(null)}catch(m){n(m?.message||"Niepoprawny JSON raportu")}},h=!!s?.scope&&(s.meta?.sourceId==="cad"||s.meta?.sourceId==="session");return y.jsxs("div",{style:{display:"flex",flexDirection:"column",height:"100%"},children:[y.jsx(W,{module:"report",title:"Raport",originLabel:s?.meta.originLabel||s?.scope.name,onLoadJson:f,onRefreshFromCad:h?b:void 0,statusHint:i||void 0}),e&&!s&&y.jsx("div",{style:{padding:24,color:"#fbbf24"},children:e}),s&&!u&&y.jsx("div",{style:{padding:24,color:"#f87171"},children:N(C,"entry.report_fail",L)}),u&&y.jsx("iframe",{title:"Raport projektu",srcDoc:u,style:{flex:1,minHeight:0,width:"100%",border:"none",background:"#f4f7f9"}})]})}I.createRoot(document.getElementById("report-root")).render(y.jsx(U.StrictMode,{children:y.jsx(J,{})}));
