import{r as M,C as gt,j as e,aM as zt,i as St,c as At,R as Ct,a as Lt}from"./report-data-normalizer-BAHpgJ3Q.js";import{N as q}from"./nesting-engine-h4yvFoCe.js";import{M as Pt}from"./ModuleSourceBar-BuZrE1Iq.js";function Bt(s){const o=(s.name||"").trim(),r=(s.furnitureName||"").trim();if(r){let m=o;return m.toLowerCase().startsWith(r.toLowerCase())&&(m=m.slice(r.length).replace(/^\s*[-–—:|/]\s*/,"").trim()),{project:r,panel:m||o||"Formatka"}}const i=o.match(/^(.+?)\s*[-–—|/]\s*(.+)$/);return i?{project:i[1].trim(),panel:i[2].trim()}:{project:"",panel:o||"Formatka"}}class It{static generatePrintableHtml(o,r){const i=o.boards.map(n=>this.generateBoardSvgString(n,r)),m=o.machineType==="cnc"?"⚙️ Frezarka CNC (Nesting)":"🪚 Piła Formatowa / Panelowa";let d=`<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Plan Rozkroju Płyt (${o.machineType.toUpperCase()}) - SmartBox CAD</title>
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
            background: ${o.machineType==="cnc"?"#d1fae5":"#fef3c7"};
            color: ${o.machineType==="cnc"?"#065f46":"#92400e"};
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
        <div class="summary-item">Format płyty: <strong>${r.width} x ${r.height} mm</strong></div>
        <div class="summary-item">Rzaz narzędzia: <strong>${r.kerf} mm</strong></div>
        <div class="summary-item">Liczba płyt: <strong>${o.totalBoardsCount}</strong></div>
        <div class="summary-item">Formatek: <strong>${o.totalPartsPlaced} / ${o.totalPartsCount}</strong></div>
        <div class="summary-item">Średni odpad: <strong>${o.avgWastePercent.toFixed(1)}%</strong></div>
        <div class="summary-item">Materiały: <strong>${o.materialGroups?.length||1}</strong></div>
    </div>
`;return o.boards.forEach((n,h)=>{d+=`
    <div class="board-section">
        <div class="board-title">
            <span>Arkusz #${h+1} (${r.width} x ${r.height} mm) — <span class="material-badge">${n.materialLabel||n.material||"Płyta"}</span></span>
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
            <tbody>`,n.layout.forEach((a,u)=>{d+=`
                <tr>
                    <td>${u+1}</td>
                    <td><strong>${a.name}</strong></td>
                    <td>${a.furnitureName||"-"}</td>
                    <td>${a.material||n.material||"-"}</td>
                    <td>${a.realW} x ${a.realH}</td>
                    <td>X: ${Math.round(a.x)}, Y: ${Math.round(a.y)}</td>
                    <td>${a.rotated?"Tak (90°)":"Nie"}</td>
                </tr>`}),d+=`
            </tbody>
        </table>
    </div>`}),d+=`
</body>
</html>`,d}static generateBoardSvgString(o,r){const i=o.width,m=o.height;let d="";return o.layout.forEach(n=>{const h=n.x+n.w/2,a=n.y+n.h/2,u=n.h>=n.w*1.15,y=n.w>=n.h*1.15;let b="";if(u&&n.h>=90&&n.w>=28){const p=Math.min(22,Math.max(10,n.w*.26)),v=Math.min(16,Math.max(8,n.w*.2));n.w<65?b=`<g transform="rotate(-90, ${h}, ${a})">
                        <text x="${h}" y="${a}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle" dominant-baseline="central">${this.escapeXml(n.name)} • ${n.realW}x${n.realH}</text>
                    </g>`:b=`<g transform="rotate(-90, ${h}, ${a})">
                        <text x="${h}" y="${a-p*.65}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(n.name)}</text>
                        <text x="${h}" y="${a+v*.85}" font-family="sans-serif" font-size="${v}" fill="#475569" text-anchor="middle">${n.realW} x ${n.realH}${n.rotated?" ↺":""}</text>
                    </g>`}else if(y&&n.w>=90&&n.h>=28){const p=Math.min(22,Math.max(10,n.h*.26)),v=Math.min(16,Math.max(8,n.h*.2));n.h<65?b=`<text x="${h}" y="${a}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle" dominant-baseline="central">${this.escapeXml(n.name)} • ${n.realW}x${n.realH}</text>`:b=`<text x="${h}" y="${a-p*.65}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(n.name)}</text>
                        <text x="${h}" y="${a+v*.85}" font-family="sans-serif" font-size="${v}" fill="#475569" text-anchor="middle">${n.realW} x ${n.realH}${n.rotated?" ↺":""}</text>`}else if(n.w>=75&&n.h>=50){const p=Math.min(24,Math.max(11,Math.min(n.w,n.h)*.16)),v=Math.min(18,Math.max(9,Math.min(n.w,n.h)*.12));b=`<text x="${h}" y="${a-p*.65}" font-family="sans-serif" font-size="${p}" font-weight="600" fill="#1e1b4b" text-anchor="middle">${this.escapeXml(n.name)}</text>
                    <text x="${h}" y="${a+v*.85}" font-family="sans-serif" font-size="${v}" fill="#475569" text-anchor="middle">${n.realW} x ${n.realH}${n.rotated?" ↺":""}</text>`}d+=`
        <g>
            <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" 
                  fill="#e0e7ff" stroke="#4338ca" stroke-width="1.5">
                <title>${this.escapeXml(n.name)} [${n.realW} x ${n.realH} mm]${n.rotated?" (Obrócona 90°)":""}</title>
            </rect>
            ${b}
        </g>`}),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${i} ${m}" width="100%" height="auto" style="max-height: 480px; background: #ffffff;">
    <rect x="0" y="0" width="${i}" height="${m}" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" />
    ${d}
</svg>`}static downloadHtmlReport(o,r,i="plan-rozkroju.html"){const m=this.generatePrintableHtml(o,r),d=new Blob([m],{type:"text/html;charset=utf-8"}),n=URL.createObjectURL(d),h=document.createElement("a");h.href=n,h.download=i,document.body.appendChild(h),h.click(),document.body.removeChild(h),URL.revokeObjectURL(n)}static escapeXml(o){return o.replace(/[<>&'"]/g,r=>{switch(r){case"<":return"&lt;";case">":return"&gt;";case"&":return"&amp;";case"'":return"&apos;";case'"':return"&quot;";default:return r}})}}function O(s,o,r){const i=o!==void 0?o:s.x,m=r!==void 0?r:s.y,d=s.w,n=s.h,a=((s.rotationAngle??0)%360+360)%360;if(a===0||a===180)return{minX:i,minY:m,maxX:i+d,maxY:m+n,w:d,h:n};if(a===90||a===270){const P=i+d/2,L=m+n/2;return{minX:P-n/2,minY:L-d/2,maxX:P+n/2,maxY:L+d/2,w:n,h:d}}const u=a*Math.PI/180,y=Math.abs(Math.cos(u)),b=Math.abs(Math.sin(u)),p=Math.round((d*y+n*b)*1e6)/1e6,v=Math.round((d*b+n*y)*1e6)/1e6,w=i+d/2,j=m+n/2,f=w-p/2,C=j-v/2,z=w+p/2,$=j+v/2;return{minX:f,minY:C,maxX:z,maxY:$,w:p,h:v}}function Xt(s,o,r,i,m,d,n,h,a=0,u=.05){const y=Math.max(0,a-u);return s<m+n+y&&s+r+y>m&&o<d+h+y&&o+i+y>d}function F(s,o,r,i,m,d,n=4,h=10,a=.05){const u=O(s,o,r);if(u.minX<h-a||u.maxX>m-h+a||u.minY<h-a||u.maxY>d-h+a)return!0;for(const y of i){if(y.partId===s.partId)continue;const b=O(y);if(Xt(u.minX,u.minY,u.w,u.h,b.minX,b.minY,b.w,b.h,n,a))return!0}return!1}function mt(s,o,r,i,m,d,n,h,a){const u=O(i),y=u.w,b=u.h,p=(i.w-y)/2,v=(i.h-b)/2,w=a-p,j=Math.max(w,d-a-y-p);let f=Math.max(w,Math.min(j,o));if(!F(i,f,r,m,d,n,h,a))return f;const C=s+p;for(const z of m){if(z.partId===i.partId)continue;const $=O(z);if(r+v<$.maxY+h&&r+v+b+h>$.minY){if(f>s){if($.minX>=C+y){const N=$.minX-y-h-p;N>=s&&N<f&&(f=N)}}else if(f<s&&$.maxX<=C){const N=$.maxX+h-p;N<=s&&N>f&&(f=N)}}}return f=Math.max(w,Math.min(j,f)),F(i,f,r,m,d,n,h,a)?s:f}function ut(s,o,r,i,m,d,n,h,a){const u=O(i),y=u.w,b=u.h,p=(i.w-y)/2,v=(i.h-b)/2,w=a-v,j=Math.max(w,n-a-b-v);let f=Math.max(w,Math.min(j,o));if(!F(i,r,f,m,d,n,h,a))return f;const C=s+v;for(const z of m){if(z.partId===i.partId)continue;const $=O(z);if(r+p<$.maxX+h&&r+p+y+h>$.minX){if(f>s){if($.minY>=C+b){const N=$.minY-b-h-v;N>=s&&N<f&&(f=N)}}else if(f<s&&$.maxY<=C){const N=$.maxY+h-v;N<=s&&N>f&&(f=N)}}}return f=Math.max(w,Math.min(j,f)),F(i,r,f,m,d,n,h,a)?s:f}function Rt(s,o,r,i,m,d,n,h,a=4,u=10){const y=O(s),b=(s.w-y.w)/2,p=(s.h-y.h)/2,v=u-b,w=Math.max(v,n-u-y.w-b),j=u-p,f=Math.max(j,h-u-y.h-p),C=Math.max(v,Math.min(w,o)),z=Math.max(j,Math.min(f,r));if(!F(s,C,z,d,n,h,a,u))return{x:C,y:z};const $=mt(i,C,m,s,d,n,h,a,u),P=ut(m,z,$,s,d,n,h,a,u),L=ut(m,z,i,s,d,n,h,a,u),N=mt(i,C,L,s,d,n,h,a,u),J=Math.hypot(C-$,z-P),at=Math.hypot(C-N,z-L),V=J<=at?{x:$,y:P}:{x:N,y:L};return F(s,V.x,V.y,d,n,h,a,u)?F(s,$,m,d,n,h,a,u)?F(s,i,L,d,n,h,a,u)?{x:i,y:m}:{x:i,y:L}:{x:$,y:m}:V}const ft=[{id:"1",name:"Bok Lewy",width:2e3,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"2",name:"Bok Prawy",width:2e3,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"3",name:"Wieniec Dolny",width:800,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"4",name:"Wieniec Górny",width:800,height:600,quantity:1,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"5",name:"Półka Wew",width:764,height:580,quantity:5,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!0},{id:"6",name:"Szuflada Tył",width:600,height:150,quantity:6,thickness:18,material:"Biel Alpejska",furnitureName:"Szafka_01",canRotate:!1},{id:"7",name:"Plecy HDF",width:1964,height:796,quantity:1,thickness:3,material:"HDF Biały",furnitureName:"Szafka_01",canRotate:!1}],Yt={width:2800,height:2070,kerf:4,trimMargin:10,thickness:18,machineType:"saw"};function Dt(s,o,r,i,m=10){return F(s,s.x,s.y,o,r,i,0,m)}const Et=({initialParts:s,initialSelectedMaterial:o="ALL",scopeLabel:r,isStandaloneWindow:i=!1})=>{const[m,d]=M.useState(()=>s&&s.length>0?s:i?ft:it()?.parts||ft),[n,h]=M.useState("saw"),[a,u]=M.useState(Yt),[y,b]=M.useState("fast"),[p,v]=M.useState(o),[w,j]=M.useState(!1),[f,C]=M.useState(null),[z,$]=M.useState({text:"",type:""}),[P,L]=M.useState(null),[N,J]=M.useState(o),[at,V]=M.useState({}),[T,Z]=M.useState([]),[B,ot]=M.useState(null),rt=M.useRef({}),pt=t=>at[t]||{scale:1,originX:50,originY:50},yt=(t,l)=>{V(c=>({...c,[t]:l(c[t]||{scale:1,originX:50,originY:50})}))},wt=(t,l)=>{if(!t.shiftKey)return;t.preventDefault(),t.stopPropagation();const c=t.currentTarget.getBoundingClientRect(),k=Math.max(0,Math.min(100,(t.clientX-c.left)/c.width*100)),x=Math.max(0,Math.min(100,(t.clientY-c.top)/c.height*100)),S=t.deltaY<0?1.25:.8;yt(l,g=>({scale:Math.min(6,Math.max(1,g.scale*S)),originX:g.scale===1?k:g.originX*.4+k*.6,originY:g.scale===1?x:g.originY*.4+x*.6}))},Q=(t,l,c)=>{Z(k=>k.map(x=>{if(x.boardIndex!==l)return x;const S=x.layout.map(g=>{if(g.partId!==t)return g;const Y=((g.rotationAngle??0)+c+360)%360,A={...g,rotationAngle:Y,rotated:Y%180!==0},I=O(A),R=a.trimMargin||10;let E=A.x,X=A.y;return I.minX<R&&(E+=R-I.minX),I.maxX>x.width-R&&(E-=I.maxX-(x.width-R)),I.minY<R&&(X+=R-I.minY),I.maxY>x.height-R&&(X-=I.maxY-(x.height-R)),A.x=Math.round(E),A.y=Math.round(X),P?.partId===t&&L(A),A});return{...x,layout:S}}))};M.useEffect(()=>{const t=l=>{if(P&&(l.key==="r"||l.key==="R")){l.preventDefault();const c=l.shiftKey?-15:15,k=T.find(x=>x.layout.some(S=>S.partId===P.partId));k&&Q(P.partId,k.boardIndex,c)}};return window.addEventListener("keydown",t),()=>window.removeEventListener("keydown",t)},[P,T]);const jt=(t,l,c)=>{if(t.button!==0)return;t.stopPropagation(),L(l);const k=rt.current[c.boardIndex];if(!k)return;const x=k.getBoundingClientRect();ot({boardIndex:c.boardIndex,partId:l.partId,startX:t.clientX,startY:t.clientY,initialPartX:l.x,initialPartY:l.y,svgWidth:x.width,svgHeight:x.height,boardWidth:c.width,boardHeight:c.height})};M.useEffect(()=>{if(!B)return;const t=c=>{const k=c.clientX-B.startX,x=c.clientY-B.startY,S=B.boardWidth/B.svgWidth,g=B.boardHeight/B.svgHeight,_=Math.round(B.initialPartX+k*S),Y=Math.round(B.initialPartY+x*g),A=T.find(X=>X.boardIndex===B.boardIndex),I=A?.layout.find(X=>X.partId===B.partId);if(!I||!A)return;let R=_,E=Y;if(!c.altKey){const X=Rt(I,_,Y,I.x,I.y,A.layout,B.boardWidth,B.boardHeight,a.kerf||4,a.trimMargin||10);R=X.x,E=X.y}Z(X=>X.map(U=>{if(U.boardIndex!==B.boardIndex)return U;const H=U.layout.map(G=>{if(G.partId!==B.partId)return G;const et={...G,x:R,y:E};return P?.partId===G.partId&&L(et),et});return{...U,layout:H}}))},l=()=>{ot(null)};return window.addEventListener("mousemove",t),window.addEventListener("mouseup",l),()=>{window.removeEventListener("mousemove",t),window.removeEventListener("mouseup",l)}},[B,P,T,a]);const bt=(t,l,c,k)=>{const x=c/l.width,S=k/l.height,g=t.x*x,_=t.y*S,Y=t.w*x,A=t.h*S;if(Y<22||A<18)return null;const I=t.h>=t.w*1.15,R=t.w>=t.h*1.15,{project:E,panel:X}=Bt(t),U=`${t.realW} × ${t.realH}`,H=Math.min(I?Y:R?A:Math.min(Y,A),120);if(H<18)return null;const G=Math.min(13,Math.max(9,H*.22)),et=Math.min(15,Math.max(10,H*.28)),Nt=Math.min(12,Math.max(9,H*.2)),dt=t.rotationAngle??0,ht=I?dt-90:dt;return e.jsx("div",{className:"nesting-html-label",style:{left:g,top:_,width:Y,height:A,transform:ht?`rotate(${ht}deg)`:void 0},children:e.jsxs("div",{className:"nesting-html-label-inner",children:[E?e.jsx("div",{className:"nesting-html-label-project",style:{fontSize:G},children:E}):null,e.jsx("div",{className:"nesting-html-label-panel",style:{fontSize:et},children:X}),H>=28?e.jsx("div",{className:"nesting-html-label-dims",style:{fontSize:Nt},children:U}):null]})},`lbl-${t.partId}`)};M.useEffect(()=>{if(i)return;const t=()=>{const x=it();x&&x.parts.length>0&&d(x.parts)},l=gt.instance?.document||window.CAD_APP?.document;let c;l&&typeof l.onDocumentChanged=="function"&&(c=l.onDocumentChanged(t));const k=["smartbox-project-changed","smartframe-updated","material-database-updated","smartbox-properties-update","cad-document-changed","cad-history-executed"];return k.forEach(x=>{window.addEventListener(x,t),document.addEventListener(x,t)}),()=>{typeof c=="function"&&c(),k.forEach(x=>{window.removeEventListener(x,t),document.removeEventListener(x,t)})}},[i]);const lt=t=>{h(t);const l=q.getDefaultKerf(t),c=t==="cnc"?15:10;u(k=>({...k,machineType:t,kerf:l,trimMargin:c}))},D=m,ct=M.useMemo(()=>{const t=new Map;return D.forEach(l=>{const c=q.getMaterialKey(l),k=q.getMaterialLabel(l);t.has(c)||t.set(c,{key:c,name:l.material||"Płyta podstawowa",thickness:l.thickness||18,label:k,count:0}),t.get(c).count+=l.quantity||0}),Array.from(t.values())},[D]),tt=M.useMemo(()=>p==="ALL"?D:D.filter(t=>q.getMaterialKey(t)===p),[D,p]);function vt(){const t=it();t&&t.parts.length>0?(d(t.parts),$({text:`Zaimportowano ${t.parts.length} formatek z projektu 3D.`,type:"success"})):$({text:"Brak wykrytych formatek w scenie 3D. Pozostawiono listę.",type:"error"})}const W=(t,l,c)=>{const k=tt[t];if(!k)return;const x=m.findIndex(g=>g.id===k.id);if(x===-1)return;const S=[...m];if(l==="width"||l==="height"||l==="quantity"||l==="thickness"){const g=parseFloat(c);S[x][l]=isNaN(g)?0:Math.max(0,g)}else l==="canRotate"?S[x].canRotate=c==="any"||c===!0:S[x][l]=c;d(S)},$t=()=>{const t=ct.find(c=>c.key===p),l={id:`part_${Date.now()}`,name:"Nowa formatka",width:500,height:500,quantity:1,thickness:t?t.thickness:18,material:t?t.name:"Biel Alpejska",canRotate:!0};d([...m,l])},kt=t=>{const l=tt[t];l&&d(m.filter(c=>c.id!==l.id))},st=async()=>{j(!0),$({text:`Obliczanie rozkroju (${n==="cnc"?"Frezarka CNC":"Piła"})...`,type:""});try{const t=await q.runNesting(D,a,{mode:y,iterations:y==="pro"?2e3:1,selectedMaterial:p,machineType:n,scope:"PROJECT"});C(t),t.unplacedParts.length>0?$({text:`Uwaga: ${t.unplacedParts.length} formatek przekracza wymiar arkusza!`,type:"error"}):$({text:`Rozkrój [${n.toUpperCase()}] gotowy${r?` (${r})`:""}! Arkuszy: ${t.totalBoardsCount}`,type:"success"})}catch(t){$({text:`Błąd: ${t.message||t}`,type:"error"})}finally{j(!1)}};M.useEffect(()=>{D.length>0&&st()},[D,n,p,a.width,a.height,a.kerf,a.trimMargin]);const Mt=()=>{f&&It.downloadHtmlReport(f,a)};M.useEffect(()=>{f&&f.boards?Z(f.boards):Z([])},[f]);const K=M.useMemo(()=>T.length===0?[]:N==="ALL"?T:T.filter(t=>q.getMaterialKey(t)===N),[T,N]);return e.jsxs("div",{className:"nesting-app-page",children:[e.jsxs("aside",{id:"panel-edycji",className:"sidebar panel-edycji nesting-panel-edycji","aria-label":"Panel edycji",children:[e.jsxs("div",{className:"nesting-form-header",children:[e.jsx("h2",{children:"Nesting"}),e.jsxs("p",{className:"subtitle",children:[r||"Rozkrój płyt"," · ",D.reduce((t,l)=>t+(l.quantity||0),0)," szt."]})]}),e.jsxs("div",{className:"panel",children:[e.jsx("h3",{children:"Profil maszyny"}),e.jsxs("div",{className:"nesting-machine-toggle",children:[e.jsx("button",{type:"button",className:`nesting-machine-btn ${n==="saw"?"active":""}`,onClick:()=>lt("saw"),children:"Piła (4 mm)"}),e.jsx("button",{type:"button",className:`nesting-machine-btn ${n==="cnc"?"active":""}`,onClick:()=>lt("cnc"),children:"CNC (10 mm)"})]})]}),e.jsxs("div",{className:"panel",children:[e.jsx("h3",{children:"Grupa materiałowa"}),e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"materialScope",children:"Materiał"}),e.jsxs("select",{id:"materialScope",value:p,onChange:t=>{v(t.target.value),J(t.target.value)},children:[e.jsxs("option",{value:"ALL",children:["Wszystkie (",D.reduce((t,l)=>t+(l.quantity||0),0)," szt.)"]}),ct.map(t=>e.jsxs("option",{value:t.key,children:[t.label," (",t.count," szt.)"]},t.key))]})]})]}),e.jsxs("div",{className:"panel",children:[e.jsx("h3",{children:"Parametry arkusza"}),e.jsxs("div",{className:"row",children:[e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"boardW",children:"Szer. (mm)"}),e.jsx("input",{type:"number",id:"boardW",value:a.width,onChange:t=>u({...a,width:parseInt(t.target.value)||0})})]}),e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"boardH",children:"Wys. (mm)"}),e.jsx("input",{type:"number",id:"boardH",value:a.height,onChange:t=>u({...a,height:parseInt(t.target.value)||0})})]})]}),e.jsxs("div",{className:"row mt-2",children:[e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"kerf",children:n==="cnc"?"Frezu (mm)":"Rzaz (mm)"}),e.jsx("input",{type:"number",id:"kerf",value:a.kerf,onChange:t=>u({...a,kerf:parseInt(t.target.value)||0})})]}),e.jsxs("div",{className:"input-group",children:[e.jsx("label",{htmlFor:"optimizeMode",children:"Tryb"}),e.jsxs("select",{id:"optimizeMode",value:y,onChange:t=>b(t.target.value),children:[e.jsx("option",{value:"fast",children:"Szybki"}),e.jsx("option",{value:"pro",children:"Profesjonalny"})]})]})]})]}),e.jsxs("div",{className:"panel list-panel",children:[e.jsxs("div",{className:"panel-header",children:[e.jsxs("h3",{children:["Formatki (",tt.reduce((t,l)=>t+(l.quantity||0),0),")"]}),e.jsxs("div",{style:{display:"flex",gap:"6px",alignItems:"center"},children:[!i&&e.jsx("button",{className:"btn-secondary",onClick:vt,style:{padding:"2px 8px",fontSize:"0.75rem",height:"24px"},title:"Pobierz formatki ze sceny 3D",children:"Ze sceny"}),e.jsx("button",{id:"addPartBtn",className:"btn-icon",onClick:$t,title:"Dodaj formatkę",children:"+"})]})]}),e.jsx("div",{className:"table-container",children:e.jsxs("table",{className:"excel-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Nazwa"}),e.jsx("th",{style:{width:"70px"},children:"Mat."}),e.jsx("th",{style:{width:"40px"},children:"Gr."}),e.jsx("th",{style:{width:"48px"},children:"Szer."}),e.jsx("th",{style:{width:"48px"},children:"Wys."}),e.jsx("th",{style:{width:"36px"},children:"Szt."}),e.jsx("th",{style:{width:"48px"},children:"Obrót"}),e.jsx("th",{style:{width:"24px"}})]})}),e.jsx("tbody",{children:tt.map((t,l)=>e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("input",{type:"text",value:t.name,onChange:c=>W(l,"name",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"text",value:t.material||"Biel Alpejska",onChange:c=>W(l,"material",c.target.value),style:{fontSize:"0.75rem"}})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.thickness||18,onChange:c=>W(l,"thickness",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.width,onChange:c=>W(l,"width",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.height,onChange:c=>W(l,"height",c.target.value)})}),e.jsx("td",{children:e.jsx("input",{type:"number",value:t.quantity,onChange:c=>W(l,"quantity",c.target.value)})}),e.jsx("td",{children:e.jsxs("select",{value:t.canRotate?"any":"none",onChange:c=>W(l,"canRotate",c.target.value),children:[e.jsx("option",{value:"any",children:"Tak"}),e.jsx("option",{value:"none",children:"Nie"})]})}),e.jsx("td",{children:e.jsx("button",{className:"btn-remove-row",onClick:()=>kt(l),title:"Usuń",children:"×"})})]},t.id||l))})]})})]}),e.jsx("div",{className:"actions",children:e.jsx("button",{id:"runNestingBtn",className:"btn-primary",onClick:st,disabled:w||D.length===0,children:w?"Obliczanie...":`Generuj rozkrój (${n==="cnc"?"CNC":"Piła"})`})}),e.jsx("div",{className:`status-msg ${z.type}`,children:z.text})]}),e.jsxs("main",{className:"workspace",children:[e.jsxs("div",{className:"toolbar",children:[e.jsxs("div",{className:"stats",children:[e.jsxs("span",{children:["Profil: ",e.jsx("strong",{children:n==="cnc"?"CNC":"Piła"})]}),e.jsxs("span",{children:["Arkusze: ",e.jsx("strong",{id:"boardsCountLabel",children:K.length})]}),e.jsxs("span",{children:["Odpad:"," ",e.jsx("strong",{id:"wasteLabel",children:K.length>0?`${(K.reduce((t,l)=>t+l.wastePercent,0)/K.length).toFixed(1)}%`:"0%"})]}),f&&f.materialGroups&&f.materialGroups.length>1&&e.jsxs("span",{style:{display:"flex",alignItems:"center",gap:"6px"},children:["Filtr:",e.jsxs("select",{value:N,onChange:t=>J(t.target.value),className:"nesting-inline-select",children:[e.jsxs("option",{value:"ALL",children:["Wszystkie (",f.boards.length,")"]}),f.materialGroups.map(t=>e.jsxs("option",{value:t.materialKey,children:[t.materialLabel," (",t.boardsCount,")"]},t.materialKey))]})]})]}),e.jsxs("div",{style:{display:"flex",gap:"8px"},children:[e.jsx("button",{className:"btn-secondary",onClick:st,title:"Przywróć optymalne ułożenie",children:"Przywróć auto"}),e.jsx("button",{className:"btn-secondary",id:"exportPdfBtn",onClick:Mt,disabled:!f||f.boards.length===0,children:"SVG / HTML"})]})]}),e.jsx("div",{className:"boards-container",id:"boardsContainer",children:!f||K.length===0?e.jsxs("div",{style:{margin:"auto",textAlign:"center",color:"#64748b"},children:[e.jsx("p",{style:{fontSize:"1.05rem",fontWeight:600,color:"#1e293b"},children:"Brak rozkroju"}),e.jsxs("p",{style:{fontSize:"0.85rem",marginTop:"4px"},children:["Ustaw parametry po prawej i kliknij ",e.jsx("strong",{children:"Generuj rozkrój"}),"."]})]}):K.map(t=>{const l=pt(t.boardIndex),c=t.layout.find(g=>g.partId===P?.partId),x=Math.round(1100*l.scale),S=Math.round(x*(t.height/t.width));return e.jsxs("div",{className:"board-wrapper",children:[e.jsxs("div",{className:"board-title",style:{display:"flex",justifyContent:"space-between",alignItems:"center",width:x,maxWidth:"100%"},children:[e.jsxs("span",{children:["Arkusz nr ",t.boardIndex," (",t.width," × ",t.height," mm)",t.materialLabel&&e.jsx("span",{className:"board-mat-badge",children:t.materialLabel})]}),e.jsxs("span",{style:{fontSize:"0.85rem",color:"#64748b"},children:["Odpad: ",t.wastePercent.toFixed(1),"%"]})]}),c&&e.jsxs("div",{className:"part-edit-bar",style:{width:x},children:[e.jsxs("span",{children:[c.name," · ","Kąt: ",e.jsxs("strong",{children:[c.rotationAngle??0,"°"]})]}),e.jsxs("div",{style:{display:"flex",gap:"6px"},children:[e.jsx("button",{type:"button",className:"btn-secondary",onClick:()=>Q(c.partId,t.boardIndex,-15),children:"−15°"}),e.jsx("button",{type:"button",className:"btn-secondary",onClick:()=>Q(c.partId,t.boardIndex,15),children:"+15°"}),e.jsx("button",{type:"button",className:"btn-secondary",onClick:()=>Q(c.partId,t.boardIndex,90),children:"90°"})]})]}),e.jsxs("div",{className:"board-stage",style:{width:x,height:S},onWheel:g=>wt(g,t.boardIndex),children:[e.jsxs("svg",{ref:g=>{rt.current[t.boardIndex]=g},viewBox:`0 0 ${t.width} ${t.height}`,className:"board-svg",width:x,height:S,style:{width:x,height:S},onClick:()=>L(null),children:[e.jsx("rect",{x:0,y:0,width:t.width,height:t.height,className:"board-bg"}),e.jsx("rect",{x:a.trimMargin,y:a.trimMargin,width:t.width-2*a.trimMargin,height:t.height-2*a.trimMargin,className:"board-trim"}),t.layout.map(g=>{const _=P?.partId===g.partId,Y=Dt(g,t.layout,t.width,t.height,a.trimMargin);return e.jsx("g",{transform:`translate(${g.x}, ${g.y}) rotate(${g.rotationAngle??0}, ${g.w/2}, ${g.h/2})`,style:{cursor:"grab"},onMouseDown:A=>jt(A,g,t),onClick:A=>{A.stopPropagation(),L(g)},children:e.jsx("rect",{width:g.w,height:g.h,className:`part-rect${_?" selected":""}${Y?" colliding":""}`})},g.partId)})]}),e.jsx("div",{className:"board-labels-layer","aria-hidden":!0,children:t.layout.map(g=>bt(g,t,x,S))})]})]},t.boardIndex)})})]})]})};function it(){try{const s=gt.instance?.document||window.CAD_APP?.document,o=zt.extractProjectData(s);if(o&&o.panels&&o.panels.length>0)return{parts:o.panels.map((i,m)=>({id:i.part_id||`part_${m}`,name:i.role||i.part_id||`part_${m}`,width:i.length_mm,height:i.width_mm,thickness:i.thickness_mm||18,quantity:i.qty||1,canRotate:!0,material:q.resolveMaterialName(i.material),containerId:i.container_id,smartboxId:i.smartbox_id,furnitureName:i.furniture_name})),containers:o.containers||[]}}catch(s){console.warn("Nesting sync from 3D scene warning:",s)}return null}function xt(s){const o=[];let r="",i=!1;for(let m=0;m<s.length;m++){const d=s[m];d==='"'?i&&s[m+1]==='"'?(r+='"',m++):i=!i:(d===","||d===";")&&!i?(o.push(r.trim()),r=""):r+=d}return o.push(r.trim()),o}function nt(s,o){if(s===void 0||s==="")return o;const r=parseFloat(s.replace(",","."));return Number.isFinite(r)?r:o}function Ft(s,o){if(s===void 0||s==="")return o;const r=s.toLowerCase();return["0","false","nie","no","n"].includes(r)?!1:["1","true","tak","yes","y"].includes(r)?!0:o}function Tt(s){const o=s.split(/\r?\n/).map(w=>w.trim()).filter(w=>w&&!w.startsWith("#"));if(o.length===0)return[];const r=xt(o[0]).map(w=>w.toLowerCase()),i=r.some(w=>["name","nazwa","width","dlugosc","długość","szerokosc","szerokość","height"].includes(w)),m=i?1:0,d=w=>r.findIndex(j=>w.includes(j)),n=i?d(["name","nazwa","part","formatka"]):0,h=i?d(["width","dlugosc","długość","length","x"]):1,a=i?d(["height","szerokosc","szerokość","y"]):2,u=i?d(["quantity","qty","szt","ilosc","ilość"]):3,y=i?d(["thickness","grubosc","grubość"]):4,b=i?d(["material","materiał","dekor"]):5,p=i?d(["canrotate","rotate","obrot","obrót"]):6,v=[];for(let w=m;w<o.length;w++){const j=xt(o[w]),f=(n>=0?j[n]:j[0])||`Formatka_${w}`,C=nt(h>=0?j[h]:j[1],0),z=nt(a>=0?j[a]:j[2],0);C<=0||z<=0||v.push({id:`csv_${w}_${f}`,name:f,width:C,height:z,quantity:Math.max(1,Math.round(nt(u>=0?j[u]:j[3],1))),thickness:nt(y>=0?j[y]:j[4],18),material:(b>=0?j[b]:j[5])||"Płyta",canRotate:Ft(p>=0?j[p]:j[6],!0)})}return v}St("nesting");function _t(){const s=Lt("nesting");if(s?.parts)return s;const o=localStorage.getItem("NESTING_SESSION_DATA");if(!o)return null;try{const r=JSON.parse(o);return r.parts?{meta:{module:"nesting",sourceId:"session",loadedAt:new Date().toISOString(),originLabel:"Sesja CAD"},scope:{type:r.scope||"PROJECT",id:"ALL",name:"Projekt"},parts:r.parts,containers:r.containers||[],config:r.config,selectedMaterial:r.selectedMaterial||"ALL"}:null}catch{return null}}function Ot(){const[s,o]=M.useState(_t),[r,i]=M.useState(0),m=h=>{o(h),i(a=>a+1)},d=(h,a)=>{try{const u=JSON.parse(h),y=u.parts||u;if(!Array.isArray(y))throw new Error("JSON nestingu musi mieć tablicę parts");m({meta:{module:"nesting",sourceId:"json",loadedAt:new Date().toISOString(),originLabel:`JSON · ${a}`},scope:u.scope||{type:"PROJECT",id:"ALL",name:a},parts:y,containers:u.containers||[],config:u.config,selectedMaterial:u.selectedMaterial||"ALL"})}catch(u){alert(u?.message||"Niepoprawny JSON nestingu")}},n=(h,a)=>{const u=Tt(h);if(u.length===0){alert("CSV nie zawiera formatek (wymagane: nazwa, długość, szerokość).");return}m({meta:{module:"nesting",sourceId:"csv",loadedAt:new Date().toISOString(),originLabel:`CSV · ${a}`},scope:{type:"PROJECT",id:"ALL",name:a},parts:u,containers:[],selectedMaterial:"ALL"})};return e.jsxs("div",{style:{display:"flex",flexDirection:"column",height:"100%"},children:[e.jsx(Pt,{module:"nesting",title:"Nesting",originLabel:s?.meta.originLabel,onLoadJson:d,onLoadCsv:n}),e.jsx("div",{style:{flex:1,minHeight:0},children:e.jsx(Et,{initialParts:s?.parts,initialSelectedMaterial:s?.selectedMaterial||"ALL",scopeLabel:s?.scope?.name||s?.meta?.originLabel,isStandaloneWindow:!0},r)})]})}At.createRoot(document.getElementById("nesting-root")).render(e.jsx(Ct.StrictMode,{children:e.jsx(Ot,{})}));
