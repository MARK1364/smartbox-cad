import{r as M,j as e,i as Ct,c as Lt,R as It,a as Pt,t as mt,s as Bt}from"./smartpart-studio-BPI84zrb.js";import{g as it,a as Xt,b as Rt,r as Yt,c as Dt,d as Et}from"./nesting-engine-xYj8HWlf.js";import{C as wt,bo as Tt}from"./report-data-normalizer-lEUTJaCU.js";import{M as Ft}from"./ModuleSourceBar-BaFBxLX5.js";function _t(a){const r=(a.name||"").trim(),l=(a.furnitureName||"").trim();if(l){let m=r;return m.toLowerCase().startsWith(l.toLowerCase())&&(m=m.slice(l.length).replace(/^\s*[-–—:|/]\s*/,"").trim()),{project:l,panel:m||r||"Formatka"}}const i=r.match(/^(.+?)\s*[-–—|/]\s*(.+)$/);return i?{project:i[1].trim(),panel:i[2].trim()}:{project:"",panel:r||"Formatka"}}class Wt{static generatePrintableHtml(r,l){const i=r.boards.map(n=>this.generateBoardSvgString(n,l)),m=r.machineType==="cnc"?"⚙️ Frezarka CNC (Nesting)":"🪚 Piła Formatowa / Panelowa";let d=`<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Plan Rozkroju Płyt (${r.machineType.toUpperCase()}) - Bloki CAD</title>
    <style>
        @page {
            size: A4 landscape;
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
            background: ${r.machineType==="cnc"?"#d1fae5":"#fef3c7"};
            color: ${r.machineType==="cnc"?"#065f46":"#92400e"};
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
    <div class="header">
        <h1>Plan Rozkroju Płyt — <span class="machine-badge">${m}</span></h1>
        <div>Data: ${new Date().toLocaleDateString("pl-PL")} ${new Date().toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"})}</div>
    </div>

    <div class="summary-box">
        <div class="summary-item">Format płyty: <strong>${l.width} x ${l.height} mm</strong></div>
        <div class="summary-item">Rzaz narzędzia: <strong>${l.kerf} mm</strong></div>
        <div class="summary-item">Liczba płyt: <strong>${r.totalBoardsCount}</strong></div>
        <div class="summary-item">Formatek: <strong>${r.totalPartsPlaced} / ${r.totalPartsCount}</strong></div>
        <div class="summary-item">Średni odpad: <strong>${r.avgWastePercent.toFixed(1)}%</strong></div>
        <div class="summary-item">Materiały: <strong>${r.materialGroups?.length||1}</strong></div>
    </div>
`;return r.boards.forEach((n,h)=>{d+=`
    <div class="board-section">
        <div class="board-title">
            <span>Arkusz #${h+1} (${l.width} x ${l.height} mm) — <span class="material-badge">${n.materialLabel||n.material||"Płyta"}</span></span>
            <span>Wykorzystanie: ${n.utilizationPercent.toFixed(1)}% | Odpad: ${n.wastePercent.toFixed(1)}%</span>
        </div>
        <div class="svg-container">
            ${i[h]}
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
            <tbody>`,n.layout.forEach((s,u)=>{d+=`
                <tr>
                    <td>${u+1}</td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.furnitureName||"-"}</td>
                    <td>${s.material||n.material||"-"}</td>
                    <td>${s.realW} x ${s.realH}</td>
                    <td>X: ${Math.round(s.x)}, Y: ${Math.round(s.y)}</td>
                    <td>${s.rotated?"Tak (90°)":"Nie"}</td>
                </tr>`}),d+=`
            </tbody>
        </table>
    </div>`}),d+=`
</body>
</html>`,d}static generateBoardSvgString(r,l){const i=r.width,m=r.height;let d="";return r.layout.forEach(n=>{const h=n.x+n.w/2,s=n.y+n.h/2,u=n.h>=n.w*1.15,y=n.w>=n.h*1.15;let b="";if(u&&n.h>=90&&n.w>=28){const p=Math.min(22,Math.max(10,n.w*.26)),v=Math.min(16,Math.max(8,n.w*.2));n.w<65?b=`<g transform="rotate(-90, ${h}, ${s})">
                        <text x="${h}" y="${s}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle" dominant-baseline="central">${this.escapeXml(n.name)} • ${n.realW}x${n.realH}</text>
                    </g>`:b=`<g transform="rotate(-90, ${h}, ${s})">
                        <text x="${h}" y="${s-p*.65}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(n.name)}</text>
                        <text x="${h}" y="${s+v*.85}" font-family="sans-serif" font-size="${v}" fill="#475569" text-anchor="middle">${n.realW} x ${n.realH}${n.rotated?" ↺":""}</text>
                    </g>`}else if(y&&n.w>=90&&n.h>=28){const p=Math.min(22,Math.max(10,n.h*.26)),v=Math.min(16,Math.max(8,n.h*.2));n.h<65?b=`<text x="${h}" y="${s}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle" dominant-baseline="central">${this.escapeXml(n.name)} • ${n.realW}x${n.realH}</text>`:b=`<text x="${h}" y="${s-p*.65}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(n.name)}</text>
                        <text x="${h}" y="${s+v*.85}" font-family="sans-serif" font-size="${v}" fill="#475569" text-anchor="middle">${n.realW} x ${n.realH}${n.rotated?" ↺":""}</text>`}else if(n.w>=75&&n.h>=50){const p=Math.min(24,Math.max(11,Math.min(n.w,n.h)*.16)),v=Math.min(18,Math.max(9,Math.min(n.w,n.h)*.12));b=`<text x="${h}" y="${s-p*.65}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(n.name)}</text>
                    <text x="${h}" y="${s+v*.85}" font-family="sans-serif" font-size="${v}" fill="#475569" text-anchor="middle">${n.realW} x ${n.realH}${n.rotated?" ↺":""}</text>`}d+=`
        <g>
            <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" 
                  fill="#e0e7ff" stroke="#4338ca" stroke-width="1.5">
                <title>${this.escapeXml(n.name)} [${n.realW} x ${n.realH} mm]${n.rotated?" (Obrócona 90°)":""}</title>
            </rect>
            ${b}
        </g>`}),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${i} ${m}" width="100%" height="auto" style="max-height: 480px; background: #ffffff;">
    <rect x="0" y="0" width="${i}" height="${m}" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" />
    ${d}
</svg>`}static downloadHtmlReport(r,l,i="plan-rozkroju.html"){const m=this.generatePrintableHtml(r,l),d=new Blob([m],{type:"text/html;charset=utf-8"}),n=URL.createObjectURL(d),h=document.createElement("a");h.href=n,h.download=i,document.body.appendChild(h),h.click(),document.body.removeChild(h),URL.revokeObjectURL(n)}static escapeXml(r){return r.replace(/[<>&'"]/g,l=>{switch(l){case"<":return"&lt;";case">":return"&gt;";case"&":return"&amp;";case"'":return"&apos;";case'"':return"&quot;";default:return l}})}}function W(a,r,l){const i=r!==void 0?r:a.x,m=l!==void 0?l:a.y,d=a.w,n=a.h,s=((a.rotationAngle??0)%360+360)%360;if(s===0||s===180)return{minX:i,minY:m,maxX:i+d,maxY:m+n,w:d,h:n};if(s===90||s===270){const I=i+d/2,L=m+n/2;return{minX:I-n/2,minY:L-d/2,maxX:I+n/2,maxY:L+d/2,w:n,h:d}}const u=s*Math.PI/180,y=Math.abs(Math.cos(u)),b=Math.abs(Math.sin(u)),p=Math.round((d*y+n*b)*1e6)/1e6,v=Math.round((d*b+n*y)*1e6)/1e6,w=i+d/2,j=m+n/2,f=w-p/2,C=j-v/2,z=w+p/2,k=j+v/2;return{minX:f,minY:C,maxX:z,maxY:k,w:p,h:v}}function Ot(a,r,l,i,m,d,n,h,s=0,u=.05){const y=Math.max(0,s-u);return a<m+n+y&&a+l+y>m&&r<d+h+y&&r+i+y>d}function T(a,r,l,i,m,d,n=4,h=10,s=.05){const u=W(a,r,l);if(u.minX<h-s||u.maxX>m-h+s||u.minY<h-s||u.maxY>d-h+s)return!0;for(const y of i){if(y.partId===a.partId)continue;const b=W(y);if(Ot(u.minX,u.minY,u.w,u.h,b.minX,b.minY,b.w,b.h,n,s))return!0}return!1}function ut(a,r,l,i,m,d,n,h,s){const u=W(i),y=u.w,b=u.h,p=(i.w-y)/2,v=(i.h-b)/2,w=s-p,j=Math.max(w,d-s-y-p);let f=Math.max(w,Math.min(j,r));if(!T(i,f,l,m,d,n,h,s))return f;const C=a+p;for(const z of m){if(z.partId===i.partId)continue;const k=W(z);if(l+v<k.maxY+h&&l+v+b+h>k.minY){if(f>a){if(k.minX>=C+y){const N=k.minX-y-h-p;N>=a&&N<f&&(f=N)}}else if(f<a&&k.maxX<=C){const N=k.maxX+h-p;N<=a&&N>f&&(f=N)}}}return f=Math.max(w,Math.min(j,f)),T(i,f,l,m,d,n,h,s)?a:f}function ft(a,r,l,i,m,d,n,h,s){const u=W(i),y=u.w,b=u.h,p=(i.w-y)/2,v=(i.h-b)/2,w=s-v,j=Math.max(w,n-s-b-v);let f=Math.max(w,Math.min(j,r));if(!T(i,l,f,m,d,n,h,s))return f;const C=a+v;for(const z of m){if(z.partId===i.partId)continue;const k=W(z);if(l+p<k.maxX+h&&l+p+y+h>k.minX){if(f>a){if(k.minY>=C+b){const N=k.minY-b-h-v;N>=a&&N<f&&(f=N)}}else if(f<a&&k.maxY<=C){const N=k.maxY+h-v;N<=a&&N>f&&(f=N)}}}return f=Math.max(w,Math.min(j,f)),T(i,l,f,m,d,n,h,s)?a:f}function Ht(a,r,l,i,m,d,n,h,s=4,u=10){const y=W(a),b=(a.w-y.w)/2,p=(a.h-y.h)/2,v=u-b,w=Math.max(v,n-u-y.w-b),j=u-p,f=Math.max(j,h-u-y.h-p),C=Math.max(v,Math.min(w,r)),z=Math.max(j,Math.min(f,l));if(!T(a,C,z,d,n,h,s,u))return{x:C,y:z};const k=ut(i,C,m,a,d,n,h,s,u),I=ft(m,z,k,a,d,n,h,s,u),L=ft(m,z,i,a,d,n,h,s,u),N=ut(i,C,L,a,d,n,h,s,u),J=Math.hypot(C-k,z-I),st=Math.hypot(C-N,z-L),V=J<=st?{x:k,y:I}:{x:N,y:L};return T(a,V.x,V.y,d,n,h,s,u)?T(a,k,m,d,n,h,s,u)?T(a,i,L,d,n,h,s,u)?{x:i,y:m}:{x:i,y:L}:{x:k,y:m}:V}const xt=[{id:"1",name:"Bok Lewy",width:2e3,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"2",name:"Bok Prawy",width:2e3,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"3",name:"Wieniec Dolny",width:800,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"4",name:"Wieniec Górny",width:800,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"5",name:"Półka Wew",width:764,height:580,quantity:5,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"6",name:"Szuflada Tył",width:600,height:150,quantity:6,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!1},{id:"7",name:"Plecy HDF",width:1964,height:796,quantity:1,thickness:3,material:"HDF Biały",furnitureName:"Szafka_01",canRotate:!1}],qt={width:2800,height:2070,kerf:4,trimMargin:10,thickness:18,machineType:"saw"};function Ut(a,r,l,i,m=10){return T(a,a.x,a.y,r,l,i,0,m)}const Kt=({initialParts:a,initialSelectedMaterial:r="ALL",scopeLabel:l,isStandaloneWindow:i=!1})=>{const[m,d]=M.useState(()=>a&&a.length>0?a:i?xt:ot()?.parts||xt),[n,h]=M.useState("saw"),[s,u]=M.useState(qt),[y,b]=M.useState("fast"),[p,v]=M.useState(r),[w,j]=M.useState(!1),[f,C]=M.useState(null),[z,k]=M.useState({text:"",type:""}),[I,L]=M.useState(null),[N,J]=M.useState(r),[st,V]=M.useState({}),[F,Z]=M.useState([]),[P,rt]=M.useState(null),lt=M.useRef({}),jt=t=>st[t]||{scale:1,originX:50,originY:50},bt=(t,o)=>{V(c=>({...c,[t]:o(c[t]||{scale:1,originX:50,originY:50})}))},vt=(t,o)=>{if(!t.shiftKey)return;t.preventDefault(),t.stopPropagation();const c=t.currentTarget.getBoundingClientRect(),$=Math.max(0,Math.min(100,(t.clientX-c.left)/c.width*100)),x=Math.max(0,Math.min(100,(t.clientY-c.top)/c.height*100)),S=t.deltaY<0?1.25:.8;bt(o,g=>({scale:Math.min(6,Math.max(1,g.scale*S)),originX:g.scale===1?$:g.originX*.4+$*.6,originY:g.scale===1?x:g.originY*.4+x*.6}))},Q=(t,o,c)=>{Z($=>$.map(x=>{if(x.boardIndex!==o)return x;const S=x.layout.map(g=>{if(g.partId!==t)return g;const Y=((g.rotationAngle??0)+c+360)%360,A={...g,rotationAngle:Y,rotated:Y%180!==0},B=W(A),R=s.trimMargin||10;let E=A.x,X=A.y;return B.minX<R&&(E+=R-B.minX),B.maxX>x.width-R&&(E-=B.maxX-(x.width-R)),B.minY<R&&(X+=R-B.minY),B.maxY>x.height-R&&(X-=B.maxY-(x.height-R)),A.x=Math.round(E),A.y=Math.round(X),I?.partId===t&&L(A),A});return{...x,layout:S}}))};M.useEffect(()=>{const t=o=>{if(I&&(o.key==="r"||o.key==="R")){o.preventDefault();const c=o.shiftKey?-15:15,$=F.find(x=>x.layout.some(S=>S.partId===I.partId));$&&Q(I.partId,$.boardIndex,c)}};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[I,F]);const kt=(t,o,c)=>{if(t.button!==0)return;t.stopPropagation(),L(o);const $=lt.current[c.boardIndex];if(!$)return;const x=$.getBoundingClientRect();rt({boardIndex:c.boardIndex,partId:o.partId,startX:t.clientX,startY:t.clientY,initialPartX:o.x,initialPartY:o.y,svgWidth:x.width,svgHeight:x.height,boardWidth:c.width,boardHeight:c.height})};M.useEffect(()=>{if(!P)return;const t=c=>{const $=c.clientX-P.startX,x=c.clientY-P.startY,S=P.boardWidth/P.svgWidth,g=P.boardHeight/P.svgHeight,_=Math.round(P.initialPartX+$*S),Y=Math.round(P.initialPartY+x*g),A=F.find(X=>X.boardIndex===P.boardIndex),B=A?.layout.find(X=>X.partId===P.partId);if(!B||!A)return;let R=_,E=Y;if(!c.altKey){const X=Ht(B,_,Y,B.x,B.y,A.layout,P.boardWidth,P.boardHeight,s.kerf||4,s.trimMargin||10);R=X.x,E=X.y}Z(X=>X.map(K=>{if(K.boardIndex!==P.boardIndex)return K;const H=K.layout.map(G=>{if(G.partId!==P.partId)return G;const et={...G,x:R,y:E};return I?.partId===G.partId&&L(et),et});return{...K,layout:H}}))},o=()=>{rt(null)};return window.addEventListener("mousemove",t),window.addEventListener("mouseup",o),()=>{window.removeEventListener("mousemove",t),window.removeEventListener("mouseup",o)}},[P,I,F,s]);const $t=(t,o,c,$)=>{const x=c/o.width,S=$/o.height,g=t.x*x,_=t.y*S,Y=t.w*x,A=t.h*S;if(Y<22||A<18)return null;const B=t.h>=t.w*1.15,R=t.w>=t.h*1.15,{project:E,panel:X}=_t(t),K=`${t.realW} × ${t.realH}`,H=Math.min(B?Y:R?A:Math.min(Y,A),120);if(H<18)return null;const G=Math.min(13,Math.max(9,H*.22)),et=Math.min(15,Math.max(10,H*.28)),At=Math.min(12,Math.max(9,H*.2)),dt=t.rotationAngle??0,ht=B?dt-90:dt;return e.jsx("div",{className:"nesting-html-label",style:{left:g,top:_,width:Y,height:A,transform:ht?`rotate(${ht}deg)`:void 0},children:e.jsxs("div",{className:"nesting-html-label-inner",children:[E?e.jsx("div",{className:"nesting-html-label-project",style:{fontSize:G},children:E}):null,e.jsx("div",{className:"nesting-html-label-panel",style:{fontSize:et},children:X}),H>=28?e.jsx("div",{className:"nesting-html-label-dims",style:{fontSize:At},children:K}):null]})},`lbl-${t.partId}`)};M.useEffect(()=>{if(i)return;const t=()=>{const x=ot();x&&x.parts.length>0&&d(x.parts)},o=wt.instance?.document||window.CAD_APP?.document;let c;o&&typeof o.onDocumentChanged=="function"&&(c=o.onDocumentChanged(t));const $=["bloki-project-changed","smartframe-updated","material-database-updated","bloki-properties-update","cad-document-changed","cad-history-executed"];return $.forEach(x=>{window.addEventListener(x,t),document.addEventListener(x,t)}),()=>{typeof c=="function"&&c(),$.forEach(x=>{window.removeEventListener(x,t),document.removeEventListener(x,t)})}},[i]);const ct=t=>{h(t);const o=Et(t),c=t==="cnc"?15:10;u($=>({...$,machineType:t,kerf:o,trimMargin:c}))},D=m,q=M.useMemo(()=>{const t=new Map;return D.forEach(o=>{const c=it(o),$=Xt(o),x=Rt(o);t.has(c)||t.set(c,{key:c,name:o.material||x.name,thickness:o.thickness??x.thickness_mm,label:$,count:0}),t.get(c).count+=o.quantity||0}),Array.from(t.values())},[D]);M.useEffect(()=>{const t=q.find(o=>o.key===p)??q[0];t&&t.thickness>0&&s.thickness!==t.thickness&&u(o=>({...o,thickness:t.thickness}))},[q,p]);const tt=M.useMemo(()=>p==="ALL"?D:D.filter(t=>it(t)===p),[D,p]);function Mt(){const t=ot();t&&t.parts.length>0?(d(t.parts),k({text:`Zaimportowano ${t.parts.length} formatek z projektu 3D.`,type:"success"})):k({text:"Brak wykrytych formatek w scenie 3D. Pozostawiono listę.",type:"error"})}const O=(t,o,c)=>{const $=tt[t];if(!$)return;const x=m.findIndex(g=>g.id===$.id);if(x===-1)return;const S=[...m];if(o==="width"||o==="height"||o==="quantity"||o==="thickness"){const g=parseFloat(c);S[x][o]=isNaN(g)?0:Math.max(0,g)}else o==="canRotate"?S[x].canRotate=c==="any"||c===!0:S[x][o]=c;d(S)},Nt=()=>{const t=q.find(c=>c.key===p)??q[0];if(!t||!(t.thickness>0)){k({text:"Nie można dodać formatki: brak grupy materiałowej z poprawną grubością.",type:"error"});return}const o={id:`part_${Date.now()}`,name:"Nowa formatka",width:500,height:500,quantity:1,thickness:t.thickness,material:t.name,canRotate:!0};d([...m,o])},zt=t=>{const o=tt[t];o&&d(m.filter(c=>c.id!==o.id))},at=async()=>{j(!0),k({text:`Obliczanie rozkroju (${n==="cnc"?"Frezarka CNC":"Piła"})...`,type:""});try{const t=await Dt(D,s,{mode:y,iterations:y==="pro"?2e3:1,selectedMaterial:p,machineType:n,scope:"PROJECT"});C(t),t.unplacedParts.length>0?k({text:`Uwaga: ${t.unplacedParts.length} formatek przekracza wymiar arkusza!`,type:"error"}):k({text:`Rozkrój [${n.toUpperCase()}] gotowy${l?` (${l})`:""}! Arkuszy: ${t.totalBoardsCount}`,type:"success"})}catch(t){k({text:`Błąd: ${t.message||t}`,type:"error"})}finally{j(!1)}};M.useEffect(()=>{D.length>0&&at()},[D,n,p,s.width,s.height,s.kerf,s.trimMargin]);const St=()=>{f&&Wt.downloadHtmlReport(f,s)};M.useEffect(()=>{f&&f.boards?Z(f.boards):Z([])},[f]);const U=M.useMemo(()=>F.length===0?[]:N==="ALL"?F:F.filter(t=>it(t)===N),[F,N]);return e.jsxs("div",{className:"nesting-app-page",children:[e.jsxs("aside",{id:"panel-edycji",className:"sidebar panel-edycji nesting-panel-edycji","aria-label":"Panel edycji",children:[e.jsxs("div",{className:"nesting-form-header",children:[e.jsx("h2",{children:"Nesting"}),e.jsxs("p",{className:"subtitle",children:[l||"Rozkrój płyt"," · ",D.reduce((t,o)=>t+(o.quantity||0),0)," szt."]})]}),e.jsxs("div",{className:"panel",children:[e.jsx("h3",{children:"Profil maszyny"}),e.jsxs("div",{className:"nesting-machine-toggle",children:[e.jsx("button",{type:"button",className:`nesting-machine-btn ${n==="saw"?"active":""}`,onClick:()=>ct("saw"),children:"Piła (4 mm)"}),e.jsx("button",{type:"button",className:`nesting-machine-btn ${n==="cnc"?"active":""}`,onClick:()=>ct("cnc"),children:"CNC (10 mm)"})]})]}),e.jsxs("div",{className:"panel",children:[e.jsx("h3",{children:"Grupa materiałowa"}),e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"materialScope",children:"Materiał"}),e.jsxs("select",{id:"materialScope",value:p,onChange:t=>{v(t.target.value),J(t.target.value)},children:[e.jsxs("option",{value:"ALL",children:["Wszystkie (",D.reduce((t,o)=>t+(o.quantity||0),0)," szt.)"]}),q.map(t=>e.jsxs("option",{value:t.key,children:[t.label," (",t.count," szt.)"]},t.key))]})]})]}),e.jsxs("div",{className:"panel",children:[e.jsx("h3",{children:"Parametry arkusza"}),e.jsxs("div",{className:"row",children:[e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"boardW",children:"Szer. (mm)"}),e.jsx("input",{type:"number",id:"boardW",value:s.width,onChange:t=>u({...s,width:parseInt(t.target.value)||0})})]}),e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"boardH",children:"Wys. (mm)"}),e.jsx("input",{type:"number",id:"boardH",value:s.height,onChange:t=>u({...s,height:parseInt(t.target.value)||0})})]})]}),e.jsxs("div",{className:"row mt-2",children:[e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"kerf",children:n==="cnc"?"Frezu (mm)":"Rzaz (mm)"}),e.jsx("input",{type:"number",id:"kerf",value:s.kerf,onChange:t=>u({...s,kerf:parseInt(t.target.value)||0})})]}),e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"optimizeMode",children:"Tryb"}),e.jsxs("select",{id:"optimizeMode",value:y,onChange:t=>b(t.target.value),children:[e.jsx("option",{value:"fast",children:"Szybki"}),e.jsx("option",{value:"pro",children:"Profesjonalny"})]})]})]})]}),e.jsxs("div",{className:"panel list-panel",children:[e.jsxs("div",{className:"panel-header",children:[e.jsxs("h3",{children:["Formatki (",tt.reduce((t,o)=>t+(o.quantity||0),0),")"]}),e.jsxs("div",{style:{display:"flex",gap:"6px",alignItems:"center"},children:[!i&&e.jsx("button",{className:"btn-secondary",onClick:Mt,style:{padding:"2px 8px",fontSize:"0.75rem",height:"24px"},title:"Pobierz formatki ze sceny 3D",children:"Ze sceny"}),e.jsx("button",{id:"addPartBtn",className:"btn-icon",onClick:Nt,title:"Dodaj formatkę",children:"+"})]})]}),e.jsx("div",{className:"table-container",children:e.jsxs("table",{className:"excel-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Nazwa"}),e.jsx("th",{style:{width:"70px"},children:"Mat."}),e.jsx("th",{style:{width:"40px"},children:"Gr."}),e.jsx("th",{style:{width:"48px"},children:"Szer."}),e.jsx("th",{style:{width:"48px"},children:"Wys."}),e.jsx("th",{style:{width:"36px"},children:"Szt."}),e.jsx("th",{style:{width:"48px"},children:"Obrót"}),e.jsx("th",{style:{width:"24px"}})]})}),e.jsx("tbody",{children:tt.map((t,o)=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("input",{type:"text",value:t.name,onChange:c=>O(o,"name",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"text",value:t.material||"Biel Alpejska",onChange:c=>O(o,"material",c.target.value),style:{fontSize:"0.75rem"}})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.thickness??"",onChange:c=>O(o,"thickness",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.width,onChange:c=>O(o,"width",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.height,onChange:c=>O(o,"height",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.quantity,onChange:c=>O(o,"quantity",c.target.value)})}),e.jsx("td",{children:e.jsxs("select",{value:t.canRotate?"any":"none",onChange:c=>O(o,"canRotate",c.target.value),children:[e.jsx("option",{value:"any",children:"Tak"}),e.jsx("option",{value:"none",children:"Nie"})]})}),e.jsx("td",{children:e.jsx("button",{className:"btn-remove-row",onClick:()=>zt(o),title:"Usuń",children:"×"})})]},t.id||o))})]})})]}),e.jsx("div",{className:"actions",children:e.jsx("button",{id:"runNestingBtn",className:"btn-primary",onClick:at,disabled:w||D.length===0,children:w?"Obliczanie...":`Generuj rozkrój (${n==="cnc"?"CNC":"Piła"})`})}),e.jsx("div",{className:`status-msg ${z.type}`,children:z.text})]}),e.jsxs("main",{className:"workspace",children:[e.jsxs("div",{className:"toolbar",children:[e.jsxs("div",{className:"stats",children:[e.jsxs("span",{children:["Profil: ",e.jsx("strong",{children:n==="cnc"?"CNC":"Piła"})]}),e.jsxs("span",{children:["Arkusze: ",e.jsx("strong",{id:"boardsCountLabel",children:U.length})]}),e.jsxs("span",{children:["Odpad:"," ",e.jsx("strong",{id:"wasteLabel",children:U.length>0?`${(U.reduce((t,o)=>t+o.wastePercent,0)/U.length).toFixed(1)}%`:"0%"})]}),f&&f.materialGroups&&f.materialGroups.length>1&&e.jsxs("span",{style:{display:"flex",alignItems:"center",gap:"6px"},children:["Filtr:",e.jsxs("select",{value:N,onChange:t=>J(t.target.value),className:"nesting-inline-select",children:[e.jsxs("option",{value:"ALL",children:["Wszystkie (",f.boards.length,")"]}),f.materialGroups.map(t=>e.jsxs("option",{value:t.materialKey,children:[t.materialLabel," (",t.boardsCount,")"]},t.materialKey))]})]})]}),e.jsxs("div",{style:{display:"flex",gap:"8px"},children:[e.jsx("button",{className:"btn-secondary",onClick:at,title:"Przywróć optymalne ułożenie",children:"Przywróć auto"}),e.jsx("button",{className:"btn-secondary",id:"exportPdfBtn",onClick:St,disabled:!f||f.boards.length===0,children:"SVG / HTML"})]})]}),e.jsx("div",{className:"boards-container",id:"boardsContainer",children:!f||U.length===0?e.jsxs("div",{style:{margin:"auto",textAlign:"center",color:"#64748b"},children:[e.jsx("p",{style:{fontSize:"1.05rem",fontWeight:600,color:"#1e293b"},children:"Brak rozkroju"}),e.jsxs("p",{style:{fontSize:"0.85rem",marginTop:"4px"},children:["Ustaw parametry po prawej i kliknij ",e.jsx("strong",{children:"Generuj rozkrój"}),"."]})]}):U.map(t=>{const o=jt(t.boardIndex),c=t.layout.find(g=>g.partId===I?.partId),x=Math.round(1100*o.scale),S=Math.round(x*(t.height/t.width));return e.jsxs("div",{className:"board-wrapper",children:[e.jsxs("div",{className:"board-title",style:{display:"flex",justifyContent:"space-between",alignItems:"center",width:x,maxWidth:"100%"},children:[e.jsxs("span",{children:["Arkusz nr ",t.boardIndex," (",t.width," × ",t.height," mm)",t.materialLabel&&e.jsx("span",{className:"board-mat-badge",children:t.materialLabel})]}),e.jsxs("span",{style:{fontSize:"0.85rem",color:"#64748b"},children:["Odpad: ",t.wastePercent.toFixed(1),"%"]})]}),c&&e.jsxs("div",{className:"part-edit-bar",style:{width:x},children:[e.jsxs("span",{children:[c.name," · ","Kąt: ",e.jsxs("strong",{children:[c.rotationAngle??0,"°"]})]}),e.jsxs("div",{style:{display:"flex",gap:"6px"},children:[e.jsx("button",{type:"button",className:"btn-secondary",onClick:()=>Q(c.partId,t.boardIndex,-15),children:"−15°"}),e.jsx("button",{type:"button",className:"btn-secondary",onClick:()=>Q(c.partId,t.boardIndex,15),children:"+15°"}),e.jsx("button",{type:"button",className:"btn-secondary",onClick:()=>Q(c.partId,t.boardIndex,90),children:"90°"})]})]}),e.jsxs("div",{className:"board-stage",style:{width:x,height:S},onWheel:g=>vt(g,t.boardIndex),children:[e.jsxs("svg",{ref:g=>{lt.current[t.boardIndex]=g},viewBox:`0 0 ${t.width} ${t.height}`,className:"board-svg",width:x,height:S,style:{width:x,height:S},onClick:()=>L(null),children:[e.jsx("rect",{x:0,y:0,width:t.width,height:t.height,className:"board-bg"}),e.jsx("rect",{x:s.trimMargin,y:s.trimMargin,width:t.width-2*s.trimMargin,height:t.height-2*s.trimMargin,className:"board-trim"}),t.layout.map(g=>{const _=I?.partId===g.partId,Y=Ut(g,t.layout,t.width,t.height,s.trimMargin);return e.jsx("g",{transform:`translate(${g.x}, ${g.y}) rotate(${g.rotationAngle??0}, ${g.w/2}, ${g.h/2})`,style:{cursor:"grab"},onMouseDown:A=>kt(A,g,t),onClick:A=>{A.stopPropagation(),L(g)},children:e.jsx("rect",{width:g.w,height:g.h,className:`part-rect${_?" selected":""}${Y?" colliding":""}`})},g.partId)})]}),e.jsx("div",{className:"board-labels-layer","aria-hidden":!0,children:t.layout.map(g=>$t(g,t,x,S))})]})]},t.boardIndex)})})]})]})};function ot(){try{const a=wt.instance?.document||window.CAD_APP?.document,r=Tt.extractProjectData(a);if(r&&r.panels&&r.panels.length>0)return{parts:r.panels.map((i,m)=>({id:i.part_id||`part_${m}`,name:i.role||i.part_id||`part_${m}`,width:i.length_mm,height:i.width_mm,thickness:i.thickness_mm,quantity:i.qty||1,canRotate:!0,material:Yt(i.material),containerId:i.container_id,blokId:i.blok_id,furnitureName:i.furniture_name})),containers:r.containers||[]}}catch(a){console.warn("Nesting sync from 3D scene warning:",a)}return null}function gt(a){const r=[];let l="",i=!1;for(let m=0;m<a.length;m++){const d=a[m];d==='"'?i&&a[m+1]==='"'?(l+='"',m++):i=!i:(d===","||d===";")&&!i?(r.push(l.trim()),l=""):l+=d}return r.push(l.trim()),r}function nt(a,r){if(a===void 0||a==="")return r;const l=parseFloat(a.replace(",","."));return Number.isFinite(l)?l:r}function Gt(a,r){if(a===void 0||a==="")return r;const l=a.toLowerCase();return["0","false","nie","no","n"].includes(l)?!1:["1","true","tak","yes","y"].includes(l)?!0:r}function Vt(a){const r=a.split(/\r?\n/).map(w=>w.trim()).filter(w=>w&&!w.startsWith("#"));if(r.length===0)return[];const l=gt(r[0]).map(w=>w.toLowerCase()),i=l.some(w=>["name","nazwa","width","dlugosc","długość","szerokosc","szerokość","height"].includes(w)),m=i?1:0,d=w=>l.findIndex(j=>w.includes(j)),n=i?d(["name","nazwa","part","formatka"]):0,h=i?d(["width","dlugosc","długość","length","x"]):1,s=i?d(["height","szerokosc","szerokość","y"]):2,u=i?d(["quantity","qty","szt","ilosc","ilość"]):3,y=i?d(["thickness","grubosc","grubość"]):4,b=i?d(["material","materiał","dekor"]):5,p=i?d(["canrotate","rotate","obrot","obrót"]):6,v=[];for(let w=m;w<r.length;w++){const j=gt(r[w]),f=(n>=0?j[n]:j[0])||`Formatka_${w}`,C=nt(h>=0?j[h]:j[1],0),z=nt(s>=0?j[s]:j[2],0);C<=0||z<=0||v.push({id:`csv_${w}_${f}`,name:f,width:C,height:z,quantity:Math.max(1,Math.round(nt(u>=0?j[u]:j[3],1))),thickness:nt(y>=0?j[y]:j[4],18),material:(b>=0?j[b]:j[5])||"Płyta",canRotate:Gt(p>=0?j[p]:j[6],!0)})}return v}const pt=Bt,yt="src";Ct("nesting");function Jt(){const a=Pt("nesting");if(a?.parts)return a;const r=localStorage.getItem("NESTING_SESSION_DATA");if(!r)return null;try{const l=JSON.parse(r);return l.parts?{meta:{module:"nesting",sourceId:"session",loadedAt:new Date().toISOString(),originLabel:"Sesja CAD"},scope:{type:l.scope||"PROJECT",id:"ALL",name:"Projekt"},parts:l.parts,containers:l.containers||[],config:l.config,selectedMaterial:l.selectedMaterial||"ALL"}:null}catch{return null}}function Zt(){const[a,r]=M.useState(Jt),[l,i]=M.useState(0),m=h=>{r(h),i(s=>s+1)},d=(h,s)=>{try{const u=JSON.parse(h),y=u.parts||u;if(!Array.isArray(y))throw new Error(mt(pt,"entry.nesting_parts",yt));m({meta:{module:"nesting",sourceId:"json",loadedAt:new Date().toISOString(),originLabel:`JSON · ${s}`},scope:u.scope||{type:"PROJECT",id:"ALL",name:s},parts:y,containers:u.containers||[],config:u.config,selectedMaterial:u.selectedMaterial||"ALL"})}catch(u){alert(u?.message||"Niepoprawny JSON nestingu")}},n=(h,s)=>{const u=Vt(h);if(u.length===0){alert(mt(pt,"entry.csv_empty",yt));return}m({meta:{module:"nesting",sourceId:"csv",loadedAt:new Date().toISOString(),originLabel:`CSV · ${s}`},scope:{type:"PROJECT",id:"ALL",name:s},parts:u,containers:[],selectedMaterial:"ALL"})};return e.jsxs("div",{style:{display:"flex",flexDirection:"column",height:"100%"},children:[e.jsx(Ft,{module:"nesting",title:"Nesting",originLabel:a?.meta.originLabel,onLoadJson:d,onLoadCsv:n}),e.jsx("div",{style:{flex:1,minHeight:0},children:e.jsx(Kt,{initialParts:a?.parts,initialSelectedMaterial:a?.selectedMaterial||"ALL",scopeLabel:a?.scope?.name||a?.meta?.originLabel,isStandaloneWindow:!0},l)})]})}Lt.createRoot(document.getElementById("nesting-root")).render(e.jsx(It.StrictMode,{children:e.jsx(Zt,{})}));
