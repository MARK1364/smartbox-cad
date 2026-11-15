import{c as E,j as k,R as $,r as _}from"./client-CY3f9ouS.js";import{y as T,aA as y,a as R,r as P,t as v,s as O,F as B,e as S,c as D,M as I,aB as j,w as U}from"./report-data-normalizer-DMA1VMmh.js";import{p as A}from"./price-store-DHXjwFZt.js";import{M as F}from"./ModuleSourceBar-RazQHUla.js";const G=T("smart_panel_V1");class L{smartPanel;materialNameCache={};constructor(){this.smartPanel=G,this._buildMaterialNameCache()}get prices(){return A.prices}_buildMaterialNameCache(){try{const t=this.smartPanel?.materials_database||{};for(const e of Object.values(t))if(e?.items)for(const[a,r]of Object.entries(e.items))r?.name&&(this.materialNameCache[a]=String(r.name))}catch{this.materialNameCache={}}}resolveMaterialName(t){if(!t)return"Płyta";if(this.materialNameCache[t])return this.materialNameCache[t];const e=this.prices?.prices_materials||{};return e[t]?.name?e[t].name:t.replace(/_/g," ")}getMaterialPricePerM2(t){const e=this.prices?.prices_materials||{};if(e[t]!==void 0){const r=e[t];return Number(typeof r=="object"?r.price:r)}const a=t.trim().toUpperCase().replace(/[\s\-]+/g,"_");for(const[r,i]of Object.entries(e))if(r.trim().toUpperCase().replace(/[\s\-]+/g,"_")===a)return Number(typeof i=="object"?i.price:i);return null}getEdgeBandPricePerM(t){const e=this.smartPanel?.edge_banding_types||{},a=this.prices?.prices_services||{};let r="";if(e[t]?.prices_services&&(r=e[t].prices_services),r&&a[r]!==void 0){const n=a[r];return Number(typeof n=="object"?n.price:n)}const i={"0.008X0.022":"EDGE_BANDING_08x22","0.008x0.022":"EDGE_BANDING_08x22","0.8X22":"EDGE_BANDING_08x22","ABS_0.8X22":"EDGE_BANDING_08x22","ABS_0.8x22":"EDGE_BANDING_08x22",ABS_1X22:"EDGE_BANDING_08x22",ABS_1x22:"EDGE_BANDING_08x22","ABS_1.0X22":"EDGE_BANDING_08x22","ABS_1.0x22":"EDGE_BANDING_08x22","2.0X22":"okleinowanie_2x22","2.0x22":"okleinowanie_2x22","2X22":"okleinowanie_2x22",ABS_2X22:"okleinowanie_2x22","ABS_2.0X22":"okleinowanie_2x22","2.0X50":"okleinowanie_2x50","2.0x50":"okleinowanie_2x50","2X50":"okleinowanie_2x50","ABS_0.8X43":"okleinowanie_2x50","ABS_0.8x43":"okleinowanie_2x50"},d=t.trim().toUpperCase();if(i[d]&&a[i[d]]!==void 0){const n=a[i[d]];return Number(typeof n=="object"?n.price:n)}return 3.5}calculatePartPricing(t){const e=t.length_mm/1e3,a=t.width_mm/1e3,r=Math.round(e*a*1e3)/1e3,i=this.getMaterialPricePerM2(t.material),d=this.resolveMaterialName(t.material);let n=null;i!==null&&(n=Math.round(r*i*100)/100);let s=0,b=0,m=!1;const h=t.edge_config||{},f=["+X","-X","+Y","-Y"];for(const l of f){const o=h[l];if(o&&o.active){const x=(l==="+X"||l==="-X"?t.is_x_longer:!t.is_x_longer)?e:a;s+=x;const w=this.getEdgeBandPricePerM(o.type_id||"0.008x0.022");w===null?m=!0:m||(b+=x*w)}}const c=Math.round(s*100)/100,g=m?null:Math.round(b*100)/100;let u=null;return n!==null&&g!==null&&(u=Math.round((n+g)*100)/100),{part_id:t.part_id,role:t.role,material_id:t.material,material_name:d,thickness_mm:t.thickness_mm,length_mm:t.length_mm,width_mm:t.width_mm,area_m2:r,price_per_m2:i!==null?i:null,material_cost:n,edge_length_mb:c,edge_cost:g,total_netto_pln:u,edge_config:t.edge_config,is_x_longer:t.is_x_longer,furniture_name:t.furniture_name,qty:t.qty||1}}calculateAccessoryPricing(t){if(t.custom_unit_price!==void 0){const d=Number(t.custom_unit_price),n=Math.round(d*t.qty*100)/100;return{id:t.id,name:t.name,role:t.role,library_id:t.library_id,qty:t.qty,unit_price_pln:d,total_price_pln:n,furniture_name:t.furniture_name}}const e=this.prices?.prices_hardware||{};let a=e[t.library_id];if(a===void 0){const d=t.library_id.trim().toUpperCase();for(const[n,s]of Object.entries(e))if(n.trim().toUpperCase()===d){a=s;break}}let r=null,i=null;if(a!==void 0){const d=Number(typeof a=="object"?a.price:a);(typeof a=="object"?a.unit:"szt")==="m2"&&t.area_m2?r=Math.round(d*t.area_m2*100)/100:r=d,i=Math.round(r*t.qty*100)/100}return{id:t.id,name:t.name,role:t.role,library_id:t.library_id,qty:t.qty,unit_price_pln:r,total_price_pln:i,furniture_name:t.furniture_name}}calculateGlobalSummary(t,e=[]){let a=0,r=0,i=0,d=0,n=!1;const s={};for(const l of t){const o=l.qty||1;a+=l.area_m2*o,i+=l.edge_length_mb*o,l.material_cost===null||l.edge_cost===null?n=!0:(r+=Number(l.material_cost)*o,d+=Number(l.edge_cost)*o),l.total_netto_pln!==null&&(s[l.furniture_name]=(s[l.furniture_name]||0)+Number(l.total_netto_pln)*o)}let b=0,m=0,h=!1;for(const l of e)b+=l.qty,l.total_price_pln===null?h=!0:(m+=Number(l.total_price_pln),s[l.furniture_name]=(s[l.furniture_name]||0)+Number(l.total_price_pln));const f=n?null:Math.round((r+d)*100)/100,c=h?null:Math.round(m*100)/100;let g=null;f!==null&&c!==null&&(g=Math.round((f+c)*100)/100);const u=Object.entries(s).map(([l,o])=>({name:l,cost:Math.round(o*100)/100}));return{Liczba_elementow:t.reduce((l,o)=>l+(o.qty||1),0),Calkowite_powierzchnia_m2:Math.round(a*1e3)/1e3,Calkowite_cena_plyt_PLN:n?null:Math.round(r*100)/100,Calkowite_dlugosc_obrzezy_mb:Math.round(i*100)/100,Calkowite_cena_obrzezy_PLN:n?null:Math.round(d*100)/100,SUMA_PLYTY_PLN:f,Calkowite_liczba_akcesorii_szt:b,Calkowite_cena_akcesorii_PLN:c,SUMA_AKCESORIA_PLN:c,SUMA_CALKOWITA_PLN:g,furnituresBreakdown:u}}}class H{engine;constructor(t){this.engine=t||new L}getEdgeCode(t,e,a=!0){if(!t||typeof t!="object")return"0";let r,i;e==="length"?a?(r=t["+X"]||{},i=t["-X"]||{}):(r=t["+Y"]||{},i=t["-Y"]||{}):a?(r=t["+Y"]||{},i=t["-Y"]||{}):(r=t["+X"]||{},i=t["-X"]||{});const d=r.active===!0,n=i.active===!0,s=(d?1:0)+(n?1:0);return String(s)}formatThickness(t){return Math.abs(t-Math.round(t))<.05?`${Math.round(t)}mm`:`${t.toFixed(1)}mm`}renderCutSheetsHtml(t,e,a,r,i,d){const s=Math.max(1,Math.ceil(a.length/30));let h=`<div class="sheets-group ${e==="merged"?"sheets-merged":"sheets-detailed"}"${e==="merged"?"":' style="display:none;"'}>`;for(let f=0;f<s;f++){const c=f*30,g=a.slice(c,c+30);h+=`
            <div class="cut-sheet">
                <div class="print-button-container no-print">
                    <button onclick="printCurrentTab('${t}')" class="print-btn-tab">🖨 Drukuj Formatkę A4</button>
                </div>

                <table class="cut-header-table">
                    <tbody>
                        <tr><th>Zleceniodawca</th><td contenteditable="true"></td><th>Zleceniobiorca</th><td contenteditable="true"></td></tr>
                        <tr><th>Materiał</th><td>${r}</td><th>Grubość</th><td>${i}</td></tr>
                        <tr><th>Data</th><td>${d}</td><th>Strona</th><td>${f+1}/${s}</td></tr>
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
                    <tbody>`;for(let u=0;u<30;u++)if(u<g.length){const l=g[u],o=c+u+1,z=this.getEdgeCode(l.edge_config,"length",l.is_x_longer),x=this.getEdgeCode(l.edge_config,"width",l.is_x_longer);h+=`
                        <tr>
                            <td>${o}</td>
                            <td contenteditable="true">${l.length_mm} mm</td>
                            <td contenteditable="true">${z}</td>
                            <td contenteditable="true">${l.width_mm} mm</td>
                            <td contenteditable="true">${x}</td>
                            <td contenteditable="true" style="font-weight:bold;">${l.qty||1}</td>
                            <td class="col-role" contenteditable="true">${l.role||""}</td>
                        </tr>`}else h+=`
                        <tr>
                            <td>${c+u+1}</td>
                            <td contenteditable="true"></td>
                            <td contenteditable="true"></td>
                            <td contenteditable="true"></td>
                            <td contenteditable="true"></td>
                            <td contenteditable="true"></td>
                            <td class="col-role" contenteditable="true"></td>
                        </tr>`;h+=`
                    </tbody>
                </table>
            </div>`}return h+="</div>",h}generateMaterialCuttingTabsHtml(t,e="repMatTab"){const a=y.validateCuttingPanelContracts(t);if(a.issues.length>0)throw new Error(`Nieprawidłowe dane formatek: ${a.issues.map(b=>`${b.panel_name}: ${b.reason}`).join("; ")}`);t=a.panels;const r=new Date().toISOString().slice(0,10),i={};for(const b of t){const m=`${b.material}_${b.thickness_mm}`;i[m]||(i[m]={material_id:b.material,thickness_mm:b.thickness_mm,panels:[]}),i[m].panels.push(b)}const d=Object.values(i).sort((b,m)=>{const h=this.engine.resolveMaterialName(b.material_id).toLowerCase(),f=this.engine.resolveMaterialName(m.material_id).toLowerCase();return h.localeCompare(f)||b.thickness_mm-m.thickness_mm});let n="",s="";return d.forEach((b,m)=>{const h=this.engine.resolveMaterialName(b.material_id),f=this.formatThickness(b.thickness_mm),c=`Lista cięć - ${h} ${f}`,g=`${e}_${m}`,u=m===0?" active":"";n+=`<button class="material-tablinks${u}" onclick="openMaterialCutTab(event, '${g}')">${c}</button>`;const l=[...b.panels].sort((x,w)=>w.length_mm-x.length_mm||w.width_mm-x.width_mm||(x.role||"").localeCompare(w.role||"")),o=y.aggregateContractRowsByGeometry(l,(x,w,M)=>this.getEdgeCode(x,w,M)),z=l;s+=`<div id="${g}" class="material-tabcontent${u}">`,s+=this.renderCutSheetsHtml(g,"merged",o,h,f,r),s+=this.renderCutSheetsHtml(g,"detailed",z,h,f,r),s+="</div>"}),{buttonsHtml:n,contentHtml:s}}generateFullProjectReport(t,e,a,r=[],i=[]){const d=new Date().toLocaleString("pl-PL"),n=y.validateCuttingPanelContracts(a.map(o=>({part_id:o.part_id,role:o.role,material:o.material_id,thickness_mm:o.thickness_mm,length_mm:o.length_mm,width_mm:o.width_mm,edge_config:o.edge_config,is_x_longer:o.is_x_longer,furniture_name:o.furniture_name,qty:o.qty||1})));if(n.issues.length>0)throw new Error(`Nieprawidłowe dane formatek: ${n.issues.map(o=>`${o.panel_name}: ${o.reason}`).join("; ")}`);const s=n.panels,b=i.length>0?`<section class="data-issues"><h3>Pominięto ${i.length} ${i.length===1?"formatkę":"formatek"} z niekompletnymi danymi PanelModel</h3><ul>${i.map(o=>`<li><strong>${this.escapeHtml(o.panel_name)}</strong> (${this.escapeHtml(o.node_id)}): ${this.escapeHtml(o.reason)}</li>`).join("")}</ul></section>`:"",{buttonsHtml:m,contentHtml:h}=this.generateMaterialCuttingTabsHtml(s,"repMatTab");let f="";for(const o of e.furnituresBreakdown)f+=`<tr><td style="text-align:left; font-weight:600; padding:8px 12px; border:1px solid #ddd;">${o.name}</td><td style="text-align:right; padding:8px 12px; border:1px solid #ddd; font-weight:bold; color:#1976d2;">${o.cost.toFixed(2)} PLN</td></tr>`;let c="",g=1;for(const o of a)c+=`
            <tr>
                <td style="padding:4px; border:1px solid #ddd;">${g++}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; font-weight:600;">${o.role}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:left; background:#f6ffed;">${o.material_name}</td>
                <td style="padding:4px; border:1px solid #ddd; text-align:center;">${o.thickness_mm} mm</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; background:#f1f8ff;">${o.length_mm} × ${o.width_mm} × ${o.thickness_mm}</td>
                <td style="padding:4px; border:1px solid #ddd;">${o.area_m2.toFixed(3)} m²</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof o.material_cost=="number"?o.material_cost.toFixed(2)+" PLN":'<span style="color:red">BRAK</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; background:#fffbe6;">${o.edge_length_mb.toFixed(2)} mb</td>
                <td style="padding:4px; border:1px solid #ddd;">${typeof o.edge_cost=="number"?o.edge_cost.toFixed(2)+" PLN":'<span style="color:red">BRAK</span>'}</td>
                <td style="padding:4px; border:1px solid #ddd; font-weight:bold; color:#1976d2; background:#e3f2fd;">${typeof o.total_netto_pln=="number"?o.total_netto_pln.toFixed(2)+" PLN":'<span style="color:red">BRAK</span>'}</td>
            </tr>`;let u="",l=1;for(const o of r)u+=`
            <tr>
                <td style="padding:4px; border:1px solid #ddd;">${l++}</td>
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

        
        /* Przełącznik trybu listy cięć (Scalenie vs Rozpisane) */
        .cutting-mode-bar {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 4px 10px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .cutting-mode-label {
            font-size: 11px;
            font-weight: 600;
            color: #4b5563;
        }
        .cutting-mode-radios {
            display: inline-flex;
            align-items: center;
            gap: 12px;
        }
        .cutting-mode-radios label {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            cursor: pointer;
            user-select: none;
        }
        .cutting-mode-radios input[type="radio"] {
            margin: 0;
            cursor: pointer;
            accent-color: #007bff;
        }

        /* Formatka A4 */
        
        /* Przełącznik trybu listy cięć (Scalenie vs Rozpisane) */
        .cutting-mode-bar {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 4px 10px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .cutting-mode-label {
            font-size: 11px;
            font-weight: 600;
            color: #4b5563;
        }
        .cutting-mode-radios {
            display: inline-flex;
            align-items: center;
            gap: 12px;
        }
        .cutting-mode-radios label {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            cursor: pointer;
            user-select: none;
        }
        .cutting-mode-radios input[type="radio"] {
            margin: 0;
            cursor: pointer;
            accent-color: #007bff;
        }

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
            <p><strong>Data wygenerowania:</strong> ${d}</p>
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
        ${b}

        <div class="tabs no-print">
            <button class="tablinks active" onclick="openTab(event, 'SummaryTab')">Podsumowanie i Płyty</button>
            <button class="tablinks" onclick="openTab(event, 'CuttingListTab')">Lista Cięcia (Formularze Hurtowni A4)</button>
            <button class="tablinks" onclick="openTab(event, 'FurnitureTab')">Zestawienie Mebli (${e.furnituresBreakdown.length})</button>
            <button class="tablinks" onclick="openTab(event, 'AccessoriesTab')">Okucia i Akcesoria (${r.length})</button>
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
                    ${c}
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
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
                <h3 style="color:#1976d2; margin:0;">Listy Cięć dla Hurtowni (Formatka A4 - 30 wierszy/strona)</h3>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div class="cutting-mode-bar no-print">
                        <span class="cutting-mode-label">Widok formatek:</span>
                        <div class="cutting-mode-radios">
                            <label>
                                <input type="radio" name="project-cutting-mode" value="merged" checked onchange="switchCuttingMode('merged')">
                                Scalenie
                            </label>
                            <label>
                                <input type="radio" name="project-cutting-mode" value="detailed" onchange="switchCuttingMode('detailed')">
                                Rozpisane
                            </label>
                        </div>
                    </div>
                    <button class="tool-btn tool-btn-green no-print" onclick="exportCuttingToCSV()">📊 Eksportuj do CSV</button>
                </div>
            </div>
            <p class="no-print" style="color:#666; font-size:12px; margin:0 0 10px 0;">Wybierz zakładkę materiału, aby wyświetlić gotowe arkusze do druku lub edycji. Możesz przełączać między formatkami scalonymi (sumowane ilości) a rozpisanymi (każda pozycja osobno).</p>
            
            <div class="material-tabs no-print">
                ${m}
            </div>

            ${h}
        </div>

        <!-- 3. Zestawienie Mebli -->
        <div id="FurnitureTab" class="tabcontent">
            <h3 style="color:#1976d2; margin-top:0;">Koszty poszczególnych mebli / modułów</h3>
            <table class="general-table">
                <thead>
                    <tr><th style="text-align:left;">Nazwa Mebla</th><th style="text-align:right;">Wartość Netto</th></tr>
                </thead>
                <tbody>
                    ${f}
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
                    ${u||'<tr><td colspan="6" style="padding:15px; color:#777;">Brak przypisanych akcesoriów</td></tr>'}
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

        
        function switchCuttingMode(mode) {
            const isMerged = mode === 'merged';
            const mergedGroups = document.querySelectorAll('.sheets-merged');
            const detailedGroups = document.querySelectorAll('.sheets-detailed');

            mergedGroups.forEach(function(el) { el.style.display = isMerged ? 'block' : 'none'; });
            detailedGroups.forEach(function(el) { el.style.display = isMerged ? 'none' : 'block'; });

            const radiosMerged = document.querySelectorAll('input[type="radio"][value="merged"]');
            const radiosDetailed = document.querySelectorAll('input[type="radio"][value="detailed"]');
            radiosMerged.forEach(function(r) { r.checked = isMerged; });
            radiosDetailed.forEach(function(r) { r.checked = !isMerged; });
        }

        function exportCuttingToCSV() {
            let csv = ["\\uFEFFLP;Dlugosc;Okleinowanie_Dlugosci;Szerokosc;Okleinowanie_Szerokosci;Szt;Rola;Material;Grubosc"];
            const sheets = document.querySelectorAll('.sheets-group:not([style*="display: none"]):not([style*="display:none"]) .cut-sheet');
            let globalLp = 1;
            sheets.forEach(function(sheet) {
                const headerCells = sheet.querySelectorAll('.cut-header-table td');
                const matName = headerCells[0]?.textContent?.trim() || '';
                const thick = headerCells[1]?.textContent?.trim() || '';

                const rows = sheet.querySelectorAll('.cutting-table-a4 tbody tr');
                rows.forEach(function(row) {
                    const cells = row.querySelectorAll('td');
                    const len = cells[1]?.textContent?.trim()?.replace(' mm', '') || '';
                    if (!len) return; // pomiń puste wiersze
                    const lCode = cells[2]?.textContent?.trim() || '0';
                    const wid = cells[3]?.textContent?.trim()?.replace(' mm', '') || '';
                    const wCode = cells[4]?.textContent?.trim() || '0';
                    const qty = cells[5]?.textContent?.trim() || '1';
                    const role = cells[6]?.textContent?.trim() || '';

                    csv.push([globalLp++, len, lCode, wid, wCode, qty, '"' + role.replace(/"/g, '""') + '"', '"' + matName.replace(/"/g, '""') + '"', thick].join(';'));
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
</html>`}generateOrderReportHtml(t,e){const a=y.validateCuttingPanelContracts(e);if(a.issues.length>0)throw new Error(`Nieprawidłowe dane formatek: ${a.issues.map(d=>`${d.panel_name}: ${d.reason}`).join("; ")}`);e=a.panels;const{buttonsHtml:r,contentHtml:i}=this.generateMaterialCuttingTabsHtml(e,"matTab");return`<!DOCTYPE html>
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
        <div class="cutting-mode-bar no-print" style="margin: 0 4px;">
            <span class="cutting-mode-label">Widok formatek:</span>
            <div class="cutting-mode-radios">
                <label>
                    <input type="radio" name="order-cutting-mode" value="merged" checked onchange="switchCuttingMode('merged')">
                    Scalenie
                </label>
                <label>
                    <input type="radio" name="order-cutting-mode" value="detailed" onchange="switchCuttingMode('detailed')">
                    Rozpisane
                </label>
            </div>
        </div>
        <p style="font-size: 12px; color: #666; width: 100%; margin: 5px 0 0 0;">Możesz edytować dowolne komórki przed wydrukiem. W oknie drukowania wybierz format A4 oraz marginesy "Brak".</p>
    </div>

    <div class="material-tabs no-print">
        ${r}
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

        
        function switchCuttingMode(mode) {
            const isMerged = mode === 'merged';
            const mergedGroups = document.querySelectorAll('.sheets-merged');
            const detailedGroups = document.querySelectorAll('.sheets-detailed');

            mergedGroups.forEach(function(el) { el.style.display = isMerged ? 'block' : 'none'; });
            detailedGroups.forEach(function(el) { el.style.display = isMerged ? 'none' : 'block'; });

            const radiosMerged = document.querySelectorAll('input[type="radio"][value="merged"]');
            const radiosDetailed = document.querySelectorAll('input[type="radio"][value="detailed"]');
            radiosMerged.forEach(function(r) { r.checked = isMerged; });
            radiosDetailed.forEach(function(r) { r.checked = !isMerged; });
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
</html>`}generateCsv(t,e="merged"){const a=y.validateCuttingPanelContracts(t);if(a.issues.length>0)throw new Error(`Nieprawidłowe dane formatek: ${a.issues.map(n=>`${n.panel_name}: ${n.reason}`).join("; ")}`);t=a.panels;const r=e==="detailed"?[...t].sort((n,s)=>s.length_mm-n.length_mm||s.width_mm-n.width_mm):y.aggregateContractRowsByGeometry(t,(n,s,b)=>this.getEdgeCode(n,s,b)),i=[];i.push("\uFEFFLP;Dlugosc;Okleinowanie_Dlugosci;Szerokosc;Okleinowanie_Szerokosci;Szt;Rola;Material;Grubosc");let d=1;for(const n of r){const s=this.getEdgeCode(n.edge_config,"length",n.is_x_longer),b=this.getEdgeCode(n.edge_config,"width",n.is_x_longer),m=this.engine.resolveMaterialName(n.material);i.push([d++,Math.round(n.length_mm),s,Math.round(n.width_mm),b,n.qty,`"${n.role.replace(/"/g,'""')}"`,`"${m.replace(/"/g,'""')}"`,n.thickness_mm].join(";"))}return i.join(`
`)}downloadFile(t,e,a="text/html;charset=utf-8"){const r=new Blob([t],{type:a}),i=URL.createObjectURL(r),d=document.createElement("a");d.href=i,d.download=e,document.body.appendChild(d),d.click(),document.body.removeChild(d),URL.revokeObjectURL(i)}escapeHtml(t){return t.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]||e)}openHtmlInNewTab(t){const e=new Blob([t],{type:"text/html;charset=utf-8"}),a=URL.createObjectURL(e);window.open(a,"_blank")||alert("Wyskakujące okno zostało zablokowane przez przeglądarkę.")}}const C=O,N="src";R("report");function q(p){const t=new L,e=new H(t),a=y.validateCuttingPanelContracts(p.panels),r=a.panels.map(s=>t.calculatePartPricing(s)),i=(p.accessories||[]).map(s=>t.calculateAccessoryPricing(s)),d=t.calculateGlobalSummary(r,i),n=p.scope?.type==="PROJECT"||!p.scope?.name?p.meta?.originLabel||"Projekt CAD":`Wycena: ${p.scope.name}`;return e.generateFullProjectReport(n,d,r,i,[...p.issues||[],...a.issues])}function K(p,t){const e=JSON.parse(p),a=e.panels?{meta:{module:"report",sourceId:"json",loadedAt:new Date().toISOString(),originLabel:`JSON · ${t}`},scope:e.scope||{type:"PROJECT",id:"ALL",name:t},panels:e.panels,accessories:e.accessories||[],furnitures:e.furnitures||[],containers:e.containers||[],issues:e.issues||[]}:e;if(!a.panels)throw new Error(v(C,"entry.report_panels",N));return a}function W(){const[p,t]=_.useState(()=>P("report")),[e,a]=_.useState(p?null:v(C,"entry.report_empty",N)),[r,i]=_.useState(null),[d,n]=_.useState(0);_.useEffect(()=>A.subscribe(()=>n(c=>c+1)),[]);const s=_.useCallback(()=>{const c=P("report");c?.panels&&(t(c),a(null),i(c.meta?.loadedAt?`${v(C,"entry.refreshed",N)} ${new Date(c.meta.loadedAt).toLocaleTimeString(B())}`:v(C,"entry.refreshed",N)))},[]),b=_.useCallback(()=>{const c=p?.scope;if(!c){i(v(C,"entry.no_scope",N));return}i("Pobieram z CAD…"),S("report",c),window.setTimeout(()=>s(),400)},[p?.scope,s]);_.useEffect(()=>{const c=u=>{u.key===j.report&&u.newValue&&s()};window.addEventListener("storage",c);let g=null;try{g=new BroadcastChannel(D),g.onmessage=u=>{const l=u.data;l?.type===I&&l.module==="report"&&s()}}catch{}return()=>{window.removeEventListener("storage",c);try{g?.close()}catch{}}},[s]),_.useEffect(()=>{const c=()=>{p?.meta?.sourceId!=="cad"&&p?.meta?.sourceId!=="session"||p?.scope&&S("report",p.scope)};return window.addEventListener("focus",c),()=>window.removeEventListener("focus",c)},[p?.meta?.sourceId,p?.scope]);const m=_.useMemo(()=>{if(!p?.panels)return null;try{return q(p)}catch{return null}},[p,d]),h=(c,g)=>{try{const u=K(c,g);U("report",u),t(u),a(null),i(null)}catch(u){a(u?.message||"Niepoprawny JSON raportu")}},f=!!p?.scope&&(p.meta?.sourceId==="cad"||p.meta?.sourceId==="session");return k.jsxs("div",{style:{display:"flex",flexDirection:"column",height:"100%"},children:[k.jsx(F,{module:"report",title:"Raport",originLabel:p?.meta.originLabel||p?.scope.name,onLoadJson:h,onRefreshFromCad:f?b:void 0,statusHint:r||void 0}),e&&!p&&k.jsx("div",{style:{padding:24,color:"#fbbf24"},children:e}),p&&!m&&k.jsx("div",{style:{padding:24,color:"#f87171"},children:v(C,"entry.report_fail",N)}),m&&k.jsx("iframe",{title:"Raport projektu",srcDoc:m,style:{flex:1,minHeight:0,width:"100%",border:"none",background:"#f4f7f9"}})]})}E.createRoot(document.getElementById("report-root")).render(k.jsx($.StrictMode,{children:k.jsx(W,{})}));
