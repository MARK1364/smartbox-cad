import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../A4_smartpanel/native_core/mesh_builder.js';
import { computeFaceData, localTo3D } from '../A4_smartpanel/native_core/face-lcs.js';
import { mmToNm } from '../A1_core/cad-math/units.js';

const W=200,H=80,T=18;
const build = (edge:string, ang:number, feats:any[]) => {
  const eb: any = { '+X':{active:false},'-X':{active:false},'+Y':{active:false},'-Y':{active:false} };
  if (ang) eb[edge] = { active: true, cutAngle: ang };
  return buildMeshFromPanel({ width: mmToNm(W), height: mmToNm(H), thickness: mmToNm(T), role:'PANEL', edgeBanding: eb, features: feats });
};
const verts = (m:any, face:string) => {
  const pos=m[face].positions; const seen=new Set<string>(); const a:number[][]=[];
  for(let i=0;i<pos.length;i+=3){ const p=[pos[i],pos[i+1],pos[i+2]]; const k=p.map(v=>v.toFixed(5)).join(','); if(!seen.has(k)){seen.add(k);a.push(p);} }
  return a;
};
const planeOf = (edge:string, ang:number, face:string) => {
  const Q = verts(build(edge, ang, []), face);
  const O=Q[0],A=Q[1],B=Q[2];
  const e1=[A[0]-O[0],A[1]-O[1],A[2]-O[2]], e2=[B[0]-O[0],B[1]-O[1],B[2]-O[2]];
  let n=[e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
  const l=Math.hypot(...n); return { O, n: n.map(x=>x/l), Q };
};

describe('diag: rozklad wierzcholkow FACE_Y_PLUS / FACE_Y_MINUS', () => {
  for (const [edge, face, u, v] of [['+Y','FACE_Y_PLUS',6,9],['-Y','FACE_Y_MINUS',6,9],['+X','FACE_X_PLUS',6,30]] as any[]) {
    it(`${face}`, () => {
      const r=4, d=6;
      const { O, n, Q } = planeOf(edge, 45, face);
      const V = verts(build(edge, 45, [{ id:1, type:'hole', face, params:{ u, v, diameter:2*r, depth:d } }]), face);
      const sd = (p:number[]) => (p[0]-O[0])*n[0]+(p[1]-O[1])*n[1]+(p[2]-O[2])*n[2];
      const dist = (a:number[],b:number[]) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      const isQ = (p:number[]) => Q.some(q => dist(p,q) < 1e-4);
      const groups: Record<string, number> = {};
      const onPlane = V.filter(p => Math.abs(sd(p)) < 1e-3);
      const offPlane = V.filter(p => Math.abs(sd(p)) >= 1e-3);
      console.log(`\n=== ${face} (edge ${edge}) uniq=${V.length} quadCorners=${Q.length}`);
      console.log(`  normal=${JSON.stringify(n.map(x=>+x.toFixed(4)))} origin=${JSON.stringify(O.map(x=>+x.toFixed(3)))}`);
      console.log(`  onPlane=${onPlane.length} (z czego narożniki obrysu: ${onPlane.filter(isQ).length}) offPlane=${offPlane.length}`);
      const offSd = offPlane.map(p => +sd(p).toFixed(4));
      console.log(`  signedDepth offPlane: ${JSON.stringify([...new Set(offSd)].sort((a,b)=>a-b))}`);
      // top ring = onPlane minus corners
      const ring = onPlane.filter(p => !isQ(p));
      console.log(`  topRing=${ring.length}`);
      const mean = [0,1,2].map(k => +(ring.reduce((s,p)=>s+p[k],0)/ring.length).toFixed(4));
      const pNom = localTo3D(computeFaceData(face, W, H, T), u, v, 0).map(x=>+x.toFixed(4));
      console.log(`  pNominal=${JSON.stringify(pNom)}  topRingMean=${JSON.stringify(mean)}`);
      // pokaż podejrzane: onPlane ktore nie sa ani naroznikiem ani nie leza na okregu promienia r
      const c = mean;
      const rads = ring.map(p => +Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2]).toFixed(4));
      const odd = ring.filter(p => Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2]) - r) > 1e-3);
      console.log(`  ringPromienie min=${Math.min(...rads).toFixed(4)} max=${Math.max(...rads).toFixed(4)} pozaR=${odd.length}`);
      if (odd.length) console.log(`  ODD: ${JSON.stringify(odd.slice(0,4).map(p=>p.map(x=>+x.toFixed(4))))}`);
      expect(true).toBe(true);
    });
  }
});