import earcut from 'earcut';
import { normalizeFaceName, FaceName } from '../panel-model.js';

// Kopia funkcji / adapter dla niezależności,
// zwraca układ lokalny ściany do rzutowania 2D -> 3D
function computeFaceData(rawFaceName: string, w: number, h: number, t: number) {
    const faceName = normalizeFaceName(rawFaceName);
    const cx = -w / 2;
    const cy = -h / 2;
    const cz = -t / 2;
    switch (faceName) {
        case 'FACE_Z_PLUS':  return { origin: [cx, cy, cz + t], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: w, height: h };
        case 'FACE_Z_MINUS': return { origin: [cx + w, cy, cz], uAxis: [-1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, -1], width: w, height: h };
        case 'FACE_X_MINUS': return { origin: [cx, cy, cz], uAxis: [0, 0, 1], vAxis: [0, 1, 0], normal: [-1, 0, 0], width: t, height: h };
        case 'FACE_X_PLUS':  return { origin: [cx + w, cy, cz + t], uAxis: [0, 0, -1], vAxis: [0, 1, 0], normal: [1, 0, 0], width: t, height: h };
        case 'FACE_Y_PLUS':  return { origin: [cx, cy + h, cz + t], uAxis: [1, 0, 0], vAxis: [0, 0, -1], normal: [0, 1, 0], width: w, height: t };
        case 'FACE_Y_MINUS': return { origin: [cx, cy, cz], uAxis: [1, 0, 0], vAxis: [0, 0, 1], normal: [0, -1, 0], width: w, height: t };
        default: throw new Error(`Unknown face: ${faceName}`);
    }
}

// Mapuje 2D (u, v) na 3D (x, y, z) na podstawie danych ściany
function localTo3D(faceData: any, u: number, v: number, depthOffset: number = 0) {
    return [
        faceData.origin[0] + faceData.uAxis[0] * u + faceData.vAxis[0] * v - faceData.normal[0] * depthOffset,
        faceData.origin[1] + faceData.uAxis[1] * u + faceData.vAxis[1] * v - faceData.normal[1] * depthOffset,
        faceData.origin[2] + faceData.uAxis[2] * u + faceData.vAxis[2] * v - faceData.normal[2] * depthOffset
    ];
}

function generateCircle(cx: number, cy: number, r: number, segments: number = 24) {
    const pts = [];
    for (let i = 0; i < segments; i++) {
        const theta = (2 * Math.PI * i) / segments;
        pts.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
    }
    return pts;
}

export function buildMeshFromPanel(model: any) {
    const result: any = {};
    const FACE_NAMES: FaceName[] = [
        'FACE_X_PLUS',
        'FACE_X_MINUS',
        'FACE_Y_PLUS',
        'FACE_Y_MINUS',
        'FACE_Z_PLUS',
        'FACE_Z_MINUS'
    ];
    
    if (model.role === 'DRILLING_PATTERN') {
        return { edges: [], vertices: [] };
    }

    // Model dimensions are in nm, we need mm for the 3D scene
    const TO_MM = 1_000_000;
    const modelWidth = model.width / TO_MM;
    const modelHeight = model.height / TO_MM;
    const modelThickness = model.thickness / TO_MM;

    function projectBoxToFace(rawFaceName: string, min: number[], max: number[], w: number, h: number, t: number) {
        const faceData = computeFaceData(rawFaceName, w, h, t);
        let uMin = Infinity, uMax = -Infinity;
        let vMin = Infinity, vMax = -Infinity;
        
        for (let ix = 0; ix < 2; ix++) {
            for (let iy = 0; iy < 2; iy++) {
                for (let iz = 0; iz < 2; iz++) {
                    const px = ix === 0 ? min[0] : max[0];
                    const py = iy === 0 ? min[1] : max[1];
                    const pz = iz === 0 ? min[2] : max[2];
                    
                    const dx = px - faceData.origin[0];
                    const dy = py - faceData.origin[1];
                    const dz = pz - faceData.origin[2];
                    
                    const u = dx * faceData.uAxis[0] + dy * faceData.uAxis[1] + dz * faceData.uAxis[2];
                    const v = dx * faceData.vAxis[0] + dy * faceData.vAxis[1] + dz * faceData.vAxis[2];
                    
                    uMin = Math.min(uMin, u);
                    uMax = Math.max(uMax, u);
                    vMin = Math.min(vMin, v);
                    vMax = Math.max(vMax, v);
                }
            }
        }
        
        uMin = Math.max(0, uMin);
        uMax = Math.min(faceData.width, uMax);
        vMin = Math.max(0, vMin);
        vMax = Math.min(faceData.height, vMax);
        
        if (uMin >= uMax || vMin >= vMax) return null;
        
        return [
            [uMin, vMin],
            [uMin, vMax],
            [uMax, vMax],
            [uMax, vMin]
        ];
    }

    const extraHoles2D: Record<string, number[][][]> = {
        FACE_X_PLUS: [], FACE_X_MINUS: [], FACE_Y_PLUS: [], FACE_Y_MINUS: [], FACE_Z_PLUS: [], FACE_Z_MINUS: []
    };

    if (model.features) {
        for (const feat of model.features) {
            if (feat.visible === false || feat.frozen || feat.params?.frozen) continue;
            if (feat.is_assembly_drilling || feat.params?.is_assembly_drilling) continue;
            if (feat.type === 'groove') {
                const faceData = computeFaceData(feat.face, modelWidth, modelHeight, modelThickness);
                const p00_0 = localTo3D(faceData, feat.params.u, feat.params.v, 0);
                const p11_d = localTo3D(faceData, feat.params.u + feat.params.width, feat.params.v + feat.params.length, feat.params.depth);
                
                const min = [
                    Math.min(p00_0[0], p11_d[0]), Math.min(p00_0[1], p11_d[1]), Math.min(p00_0[2], p11_d[2])
                ];
                const max = [
                    Math.max(p00_0[0], p11_d[0]), Math.max(p00_0[1], p11_d[1]), Math.max(p00_0[2], p11_d[2])
                ];

                const EPS = 0.01;
                const hw = modelWidth / 2, hh = modelHeight / 2, ht = modelThickness / 2;
                const pushHole = (rawFace: string, min: number[], max: number[]) => {
                    const canonicalFace = normalizeFaceName(rawFace);
                    const hole = projectBoxToFace(canonicalFace, min, max, modelWidth, modelHeight, modelThickness);
                    if (hole) {
                        if (!extraHoles2D[canonicalFace]) extraHoles2D[canonicalFace] = [];
                        extraHoles2D[canonicalFace].push(hole);
                    }
                };

                if (min[0] <= -hw + EPS) pushHole('FACE_X_MINUS', min, max);
                if (max[0] >= hw - EPS)  pushHole('FACE_X_PLUS', min, max);
                if (min[1] <= -hh + EPS) pushHole('FACE_Y_MINUS', min, max);
                if (max[1] >= hh - EPS)  pushHole('FACE_Y_PLUS', min, max);
                if (min[2] <= -ht + EPS) pushHole('FACE_Z_MINUS', min, max);
                if (max[2] >= ht - EPS)  pushHole('FACE_Z_PLUS', min, max);
            }
        }
    }

    for (const face of FACE_NAMES) {
        const faceData = computeFaceData(face, modelWidth, modelHeight, modelThickness);
        const outerContour = [
            [0, 0],
            [faceData.width, 0],
            [faceData.width, faceData.height],
            [0, faceData.height]
        ];

        const holes2D: number[][][] = [];
        if (extraHoles2D[face]) {
            holes2D.push(...extraHoles2D[face]);
        }

        const featuresOnFace = model.features ? model.features.filter((f: any) => {
            const fFace = f.face ? normalizeFaceName(f.face) : (f.side ? normalizeFaceName(f.side) : '');
            return fFace === face && f.visible !== false && !f.frozen && !f.params?.frozen;
        }) : [];
        const faceResult = { positions: [] as number[], indices: [] as number[] };

        for (const feat of featuresOnFace) {
            if (feat.type === 'hole') {
                const cxRaw = feat.params.u;
                const cyRaw = feat.params.v;
                const r = (feat.params.diameter || 35) / 2;
                const depth = feat.params.depth || 10;
                
                const template = feat.params.template_id || 'SINGLE';
                const spacing = feat.params.spacing || 32;
                
                // Ekspansja wzorców (TRIPLE, SYSTEM_32, itp.) na listę otworów
                const holeCenters: { cx: number, cy: number }[] = [];
                if (template === 'TRIPLE') {
                    const offsetZ = feat.params.offsetZ || 32;
                    holeCenters.push({ cx: cxRaw, cy: cyRaw });
                    holeCenters.push({ cx: cxRaw, cy: cyRaw + offsetZ });
                    holeCenters.push({ cx: cxRaw, cy: cyRaw - offsetZ });
                } else if (template === 'SYSTEM_32' || template === 'ROW') {
                    const count = feat.params.count || 5;
                    for (let i = 0; i < count; i++) {
                        holeCenters.push({ cx: cxRaw, cy: cyRaw + i * spacing });
                    }
                } else {
                    holeCenters.push({ cx: cxRaw, cy: cyRaw });
                }

                for (const { cx, cy } of holeCenters) {
                    // Sprawdź czy środek otworu mieści się w granicach ściany
                    const isInsideFace = cx >= r && cx <= (faceData.width - r) && cy >= r && cy <= (faceData.height - r);

                    if (isInsideFace) {
                        const circle = generateCircle(cx, cy, r, 24).reverse();
                        holes2D.push(circle);

                        // --- Generowanie geometrii 3D cylindra wnęki (ścianki boczne i dno otworu) ---
                        const segments = 24;
                        const p3dTop: number[][] = [];
                        const p3dBottom: number[][] = [];
                        for (const p of circle) {
                            p3dTop.push(localTo3D(faceData, p[0], p[1], 0));
                            p3dBottom.push(localTo3D(faceData, p[0], p[1], depth));
                        }
                        const pCenterBottom = localTo3D(faceData, cx, cy, depth);

                        const hw = modelWidth / 2, hh = modelHeight / 2, ht = modelThickness / 2;
                        const EPS = 0.01;

                        const addQuad = (pA: number[], pB: number[], pC: number[], pD: number[]) => {
                            if (Math.abs(pA[0]) >= hw - EPS || Math.abs(pA[1]) >= hh - EPS || Math.abs(pA[2]) >= ht - EPS) return;
                            const idx = faceResult.positions.length / 3;
                            faceResult.positions.push(...pA, ...pB, ...pC, ...pD);
                            faceResult.indices.push(idx, idx+1, idx+2, idx, idx+2, idx+3);
                        };

                        const addTriangle = (pA: number[], pB: number[], pC: number[]) => {
                            if (Math.abs(pA[0]) >= hw - EPS || Math.abs(pA[1]) >= hh - EPS || Math.abs(pA[2]) >= ht - EPS) return;
                            const idx = faceResult.positions.length / 3;
                            faceResult.positions.push(...pA, ...pB, ...pC);
                            faceResult.indices.push(idx, idx+1, idx+2);
                        };

                        for (let i = 0; i < segments; i++) {
                            const nextI = (i + 1) % segments;
                            // Dno otworu (widoczne dla obserwatora patrzącego w głąb dziury)
                            addTriangle(p3dBottom[i], pCenterBottom, p3dBottom[nextI]);
                            // Ścianki boczne otworu (kierunek CCW z punktu widzenia środka otworu)
                            addQuad(p3dTop[i], p3dTop[nextI], p3dBottom[nextI], p3dBottom[i]);
                        }
                    }
                }
            } else if (feat.type === 'groove') {
                const uRaw = feat.params.u;
                const vRaw = feat.params.v;
                const wRaw = feat.params.width;
                const hRaw = feat.params.length;
                const depth = feat.params.depth;

                // Twarde zabezpieczenie matematyczne: Subtractive domain clipping
                const u0 = Math.max(0, uRaw);
                const u1 = Math.min(faceData.width, uRaw + wRaw);
                const v0 = Math.max(0, vRaw);
                const v1 = Math.min(faceData.height, vRaw + hRaw);

                if (u1 <= u0 || v1 <= v0) continue;

                // Groove 'holes2D' are already handled by extraHoles2D pre-pass since the top opening intersects the face plane.
                
                // Build 3D cavity
                const p00_0 = localTo3D(faceData, u0, v0, 0);
                const p10_0 = localTo3D(faceData, u1, v0, 0);
                const p11_0 = localTo3D(faceData, u1, v1, 0);
                const p01_0 = localTo3D(faceData, u0, v1, 0);

                const p00_d = localTo3D(faceData, u0, v0, depth);
                const p10_d = localTo3D(faceData, u1, v0, depth);
                const p11_d = localTo3D(faceData, u1, v1, depth);
                const p01_d = localTo3D(faceData, u0, v1, depth);

                const addQuad = (pA: number[], pB: number[], pC: number[], pD: number[]) => {
                    const cx = (pA[0] + pB[0] + pC[0] + pD[0]) / 4;
                    const cy = (pA[1] + pB[1] + pC[1] + pD[1]) / 4;
                    const cz = (pA[2] + pB[2] + pC[2] + pD[2]) / 4;
                    const hw = modelWidth / 2, hh = modelHeight / 2, ht = modelThickness / 2;
                    const EPS = 0.01;
                    
                    // Cull walls that lie on or outside the panel boundaries
                    if (Math.abs(cx) >= hw - EPS || Math.abs(cy) >= hh - EPS || Math.abs(cz) >= ht - EPS) {
                        return; 
                    }

                    const idx = faceResult.positions.length / 3;
                    faceResult.positions.push(...pA, ...pB, ...pC, ...pD);
                    faceResult.indices.push(idx, idx+1, idx+2, idx, idx+2, idx+3);
                };

                // Add bottom and walls with proper winding (CCW) to face outwards (towards the viewer)
                addQuad(p00_d, p10_d, p11_d, p01_d); // Bottom
                addQuad(p00_0, p00_d, p10_d, p10_0); // Wall
                addQuad(p10_0, p10_d, p11_d, p11_0); // Wall
                addQuad(p11_0, p11_d, p01_d, p01_0); // Wall
                addQuad(p01_0, p01_d, p00_d, p00_0); // Wall
            }
        }

        // --- Płaska ściana z dziurami (Earcut) ---
        const flatVertices: number[] = [];
        const holeIndices: number[] = [];

        // Dodaj obrys zewnętrzny
        for (const [u, v] of outerContour) {
            flatVertices.push(u, v);
        }

        // Dodaj dziury
        for (const hole of holes2D) {
            holeIndices.push(flatVertices.length / 2);
            for (const [u, v] of hole) {
                flatVertices.push(u, v);
            }
        }

        // Uruchom Earcut
        const triangles = earcut(flatVertices, holeIndices, 2);

        // Dodaj wygenerowane trójkąty płaskiej ściany do ogólnych tablic obiektu
        const offset = faceResult.positions.length / 3;
        for (let i = 0; i < flatVertices.length; i += 2) {
            const u = flatVertices[i];
            const v = flatVertices[i + 1];
            const p3d = localTo3D(faceData, u, v, 0);
            faceResult.positions.push(...p3d);
        }

        for (const idx of triangles) {
            faceResult.indices.push(idx + offset);
        }

        result[face] = faceResult;
    }

    const w = modelWidth;
    const h = modelHeight;
    const t = modelThickness;

    // Narożniki wycentrowane wokół (0,0,0) — spójne z computeFaceData (LCS w środku płyty)
    const hw = w / 2, hh = h / 2, ht = t / 2;

    const v000 = [-hw, -hh, -ht];
    const vW00 = [ hw, -hh, -ht];
    const v0H0 = [-hw,  hh, -ht];
    const vWH0 = [ hw,  hh, -ht];

    const v00T = [-hw, -hh,  ht];
    const vW0T = [ hw, -hh,  ht];
    const v0HT = [-hw,  hh,  ht];
    const vWHT = [ hw,  hh,  ht];

    // Kolejność musi ściśle odpowiadać topology.ts NAROZNIK_WSPOLRZEDNE!
    result['vertices'] = [
        v000, // 0: tyl_dol_lewo
        vW00, // 1: tyl_dol_prawo
        vW0T, // 2: przod_dol_prawo
        v00T, // 3: przod_dol_lewo
        v0H0, // 4: tyl_gora_lewo
        vWH0, // 5: tyl_gora_prawo
        vWHT, // 6: przod_gora_prawo
        v0HT  // 7: przod_gora_lewo
    ];

    // Klucze krawędzi muszą ściśle odpowiadać KRAWEDZIE z topology.ts
    result['edges'] = [
        { key: "dol_tyl", points: [v000, vW00] },
        { key: "dol_przod", points: [v00T, vW0T] },
        { key: "gora_tyl", points: [v0H0, vWH0] },
        { key: "gora_przod", points: [v0HT, vWHT] },
        { key: "tyl_lewo", points: [v000, v0H0] },
        { key: "tyl_prawo", points: [vW00, vWH0] },
        { key: "przod_lewo", points: [v00T, v0HT] },
        { key: "przod_prawo", points: [vW0T, vWHT] },
        { key: "dol_lewo", points: [v000, v00T] },
        { key: "dol_prawo", points: [vW00, vW0T] },
        { key: "gora_lewo", points: [v0H0, v0HT] },
        { key: "gora_prawo", points: [vWH0, vWHT] }
    ];

    if (model.features) {
        for (const feat of model.features) {
            if (feat.visible === false || feat.frozen || feat.params?.frozen) continue;
            if (feat.is_assembly_drilling || feat.params?.is_assembly_drilling) continue;
            const faceData = computeFaceData(feat.face, w, h, t);
            if (feat.type === 'hole') {
                const cxRaw = feat.params.u;
                const cyRaw = feat.params.v;
                const r = (feat.params.diameter || 35) / 2;
                
                const template = feat.params.template_id || 'SINGLE';
                const spacing = feat.params.spacing || 32;
                
                const holeCenters: { cx: number, cy: number, suffix: string }[] = [];
                if (template === 'TRIPLE') {
                    const offsetZ = feat.params.offsetZ || 32;
                    holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
                    holeCenters.push({ cx: cxRaw, cy: cyRaw + offsetZ, suffix: '_t' });
                    holeCenters.push({ cx: cxRaw, cy: cyRaw - offsetZ, suffix: '_b' });
                } else if (template === 'SYSTEM_32' || template === 'ROW') {
                    const count = feat.params.count || 5;
                    for (let i = 0; i < count; i++) {
                        holeCenters.push({ cx: cxRaw, cy: cyRaw + i * spacing, suffix: `_${i}` });
                    }
                } else {
                    holeCenters.push({ cx: cxRaw, cy: cyRaw, suffix: '' });
                }

                for (const { cx, cy, suffix } of holeCenters) {
                    const circle2D = generateCircle(cx, cy, r, 24);
                    circle2D.push(circle2D[0]);
                    const points = circle2D.map(p => localTo3D(faceData, p[0], p[1], 0));
                    result['edges'].push({
                        key: `e_hole_${feat.id}${suffix}`,
                        points: points
                    });
                }
            } else if (feat.type === 'groove') {
                const u0 = feat.params.u;
                const v0 = feat.params.v;
                const gw = feat.params.width;
                const gh = feat.params.length;
                const depth = feat.params.depth;

                const u1 = u0 + gw;
                const v1 = v0 + gh;

                const p00_0 = localTo3D(faceData, u0, v0, 0);
                const p10_0 = localTo3D(faceData, u1, v0, 0);
                const p11_0 = localTo3D(faceData, u1, v1, 0);
                const p01_0 = localTo3D(faceData, u0, v1, 0);

                const p00_d = localTo3D(faceData, u0, v0, depth);
                const p10_d = localTo3D(faceData, u1, v0, depth);
                const p11_d = localTo3D(faceData, u1, v1, depth);
                const p01_d = localTo3D(faceData, u0, v1, depth);

                // Top outline (obrys górny otworu wpustu)
                result['edges'].push({ key: `e_groove_${feat.id}_t1`, points: [p00_0, p10_0] });
                result['edges'].push({ key: `e_groove_${feat.id}_t2`, points: [p10_0, p11_0] });
                result['edges'].push({ key: `e_groove_${feat.id}_t3`, points: [p11_0, p01_0] });
                result['edges'].push({ key: `e_groove_${feat.id}_t4`, points: [p01_0, p00_0] });

                // Bottom outline (dno wpustu)
                result['edges'].push({ key: `e_groove_${feat.id}_b1`, points: [p00_d, p10_d] });
                result['edges'].push({ key: `e_groove_${feat.id}_b2`, points: [p10_d, p11_d] });
                result['edges'].push({ key: `e_groove_${feat.id}_b3`, points: [p11_d, p01_d] });
                result['edges'].push({ key: `e_groove_${feat.id}_b4`, points: [p01_d, p00_d] });

                // Vertical edges (ścianki boczne wgłąb)
                result['edges'].push({ key: `e_groove_${feat.id}_v1`, points: [p00_0, p00_d] });
                result['edges'].push({ key: `e_groove_${feat.id}_v2`, points: [p10_0, p10_d] });
                result['edges'].push({ key: `e_groove_${feat.id}_v3`, points: [p11_0, p11_d] });
                result['edges'].push({ key: `e_groove_${feat.id}_v4`, points: [p01_0, p01_d] });
            }
        }
    }

    return result;
}
