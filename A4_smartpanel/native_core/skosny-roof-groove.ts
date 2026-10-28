import earcutModule from 'earcut';
const earcut = (earcutModule as any).default || earcutModule;

export interface TrapezoidBackGrooveSpec {
    hF: number;
    hB: number;
    D: number;
    thickness: number;
    backOffset: number;
    shiftY?: number;
    grubosc_plecow_mm: number;
    margines_gorny_plecow_mm: number;
    featureId?: string;
}

export function buildSkosnyRoofWithTrapezoidGroove(
    w: number,
    h: number,
    t: number,
    spec: TrapezoidBackGrooveSpec
) {
    const {
        hF,
        hB,
        D,
        backOffset,
        shiftY = 0,
        grubosc_plecow_mm,
        margines_gorny_plecow_mm,
        featureId = 'feat_back_groove'
    } = spec;
    const hx = w / 2;

    const betaDeg = Math.atan2(hB - hF, D) * 180 / Math.PI;
    const beta = betaDeg * Math.PI / 180;
    const theta = (betaDeg - 90) * Math.PI / 180;
    const loc = {
        y: Math.sin(beta) * t / 2,
        z: (hF + hB) / 2 - Math.cos(beta) * t / 2
    };

    function cabToPanelYZ(y_from_front: number, zc: number) {
        const yc_cab = y_from_front - D / 2;
        const dy = yc_cab - loc.y;
        const dz = zc - loc.z;
        const yp = Math.cos(theta) * dy + Math.sin(theta) * dz;
        const zp = -Math.sin(theta) * dy + Math.cos(theta) * dz;
        // Z_MINUS (z = -t/2) to dach zewnętrzny, Z_PLUS (z = +t/2) to sufit wewnętrzny
        return [zp, yp] as [number, number]; // [yPanel, zPanel]
    }

    const cosBeta = Math.cos(beta);
    const tanBeta = Math.tan(beta);
    const zCeil = (y: number) => hF - t / cosBeta + y * tanBeta;

    // Pozycja pleców wzdłuż osi Y szafki (od przodu y=0 do ściany y=D):
    const yPlecyFront = D - backOffset + shiftY;
    const yPlecyBack = yPlecyFront + grubosc_plecow_mm;
    const rearWallLuz = D - yPlecyBack;

    // Dno wpustu / schodka:
    const zCeilAtPlecyFront = zCeil(yPlecyFront);
    const zCeilAtPlecyBack = zCeil(yPlecyBack);
    const zStepTop = Math.max(zCeilAtPlecyFront, zCeilAtPlecyBack) + margines_gorny_plecow_mm;

    // Punkty zewnętrzne dachu (wieniec ZAWSZE dochodzi do ściany y=D):
    const pRoofFront = cabToPanelYZ(0, hF);
    const pRoofBack  = cabToPanelYZ(D, hB);
    const pCeilFront = cabToPanelYZ(0, zCeil(0));

    // Helper do tworzenia czworokąta między dwoma punktami profilu a i b wzdłuż X: [-hx, +hx]
    function makeQuadMesh(a: [number, number], b: [number, number]) {
        const v0 = [-hx, a[0], a[1]];
        const v1 = [hx, a[0], a[1]];
        const v2 = [hx, b[0], b[1]];
        const v3 = [-hx, b[0], b[1]];
        return {
            positions: [...v0, ...v1, ...v2, ...v3],
            indices: [0, 1, 2, 0, 2, 3]
        };
    }

    function mergeMeshes(m1: { positions: number[]; indices: number[] }, m2: { positions: number[]; indices: number[] }) {
        const offset = m1.positions.length / 3;
        return {
            positions: [...m1.positions, ...m2.positions],
            indices: [...m1.indices, ...m2.indices.map((i: number) => i + offset)]
        };
    }

    let profile2D: Array<[number, number]>;
    let faceZMinus: { positions: number[]; indices: number[] };
    let faceYPlus: { positions: number[]; indices: number[] };
    let faceZPlus: { positions: number[]; indices: number[] };
    let faceYMinus: { positions: number[]; indices: number[] };
    let grooveBottom: { positions: number[]; indices: number[] };
    let grooveFront: { positions: number[]; indices: number[] };
    let grooveBack: { positions: number[]; indices: number[] } | undefined;

    // Segment dachu Z_MINUS (zawsze od przodu y=0 do ściany y=D)
    faceZMinus = makeQuadMesh(pRoofFront, pRoofBack);
    // Segment przodu wieńca Y_MINUS (zacięty pionowo pod kątem topEndCut)
    faceYMinus = makeQuadMesh(pCeilFront, pRoofFront);

    if (rearWallLuz <= 0.5) {
        // --- PRZYPADEK 1: SCHODEK L (plecy na samym tyle mebla, luz <= grubość pleców) ---
        const pStepBack = cabToPanelYZ(D, zStepTop);
        const pStepCorner = cabToPanelYZ(yPlecyFront, zStepTop);
        const pStepBottom = cabToPanelYZ(yPlecyFront, zCeilAtPlecyFront);

        profile2D = [
            pRoofFront,
            pRoofBack,
            pStepBack,
            pStepCorner,
            pStepBottom,
            pCeilFront
        ];

        faceYPlus = makeQuadMesh(pRoofBack, pStepBack);
        grooveBottom = makeQuadMesh(pStepBack, pStepCorner);
        grooveFront = makeQuadMesh(pStepCorner, pStepBottom);
        faceZPlus = makeQuadMesh(pStepBottom, pCeilFront);
    } else {
        // --- PRZYPADEK 2: WPUST TYPU U (plecy odsunięte > 3 mm od ściany, za plecami jest wieniec) ---
        const pCeilBackWall = cabToPanelYZ(D, zCeil(D));
        const pGrooveBackEntry = cabToPanelYZ(yPlecyBack, zCeilAtPlecyBack);
        const pGrooveBackTop   = cabToPanelYZ(yPlecyBack, zStepTop);
        const pGrooveFrontTop  = cabToPanelYZ(yPlecyFront, zStepTop);
        const pGrooveFrontEntry = cabToPanelYZ(yPlecyFront, zCeilAtPlecyFront);

        profile2D = [
            pRoofFront,
            pRoofBack,
            pCeilBackWall,
            pGrooveBackEntry,
            pGrooveBackTop,
            pGrooveFrontTop,
            pGrooveFrontEntry,
            pCeilFront
        ];

        // Tylna ścianka wieńca przy ścianie
        faceYPlus = makeQuadMesh(pRoofBack, pCeilBackWall);
        // Sufit za plecami
        const ceilPartBack = makeQuadMesh(pCeilBackWall, pGrooveBackEntry);
        // Ścianka tylna wpustu
        grooveBack = makeQuadMesh(pGrooveBackEntry, pGrooveBackTop);
        // Poziome dno wpustu o stałej szerokości grubosc_plecow_mm
        grooveBottom = makeQuadMesh(pGrooveBackTop, pGrooveFrontTop);
        // Ścianka przednia wpustu
        grooveFront = makeQuadMesh(pGrooveFrontTop, pGrooveFrontEntry);
        // Sufit przed plecami
        const ceilPartFront = makeQuadMesh(pGrooveFrontEntry, pCeilFront);
        // Połączony sufit FACE_Z_PLUS
        faceZPlus = mergeMeshes(ceilPartBack, ceilPartFront);
    }

    // Ścianki boczne: FACE_X_MINUS i FACE_X_PLUS (triangulowane earcut)
    const flat2D = profile2D.flat();
    const triIndices = earcut(flat2D);

    // FACE_X_PLUS: x = +hx, normalna +X (profil CCW -> [i0, i1, i2])
    const xPlusPos: number[] = [];
    for (const p of profile2D) {
        xPlusPos.push(hx, p[0], p[1]);
    }
    const xPlusIdx: number[] = [];
    for (let i = 0; i < triIndices.length; i += 3) {
        xPlusIdx.push(triIndices[i], triIndices[i + 1], triIndices[i + 2]);
    }
    const faceXPlus = { positions: xPlusPos, indices: xPlusIdx };

    // FACE_X_MINUS: x = -hx, normalna -X -> [i0, i2, i1]
    const xMinusPos: number[] = [];
    for (const p of profile2D) {
        xMinusPos.push(-hx, p[0], p[1]);
    }
    const xMinusIdx: number[] = [];
    for (let i = 0; i < triIndices.length; i += 3) {
        xMinusIdx.push(triIndices[i], triIndices[i + 2], triIndices[i + 1]);
    }
    const faceXMinus = { positions: xMinusPos, indices: xMinusIdx };

    // Wierzchołki i krawędzie B-rep
    const vertices: number[][] = [];
    for (const p of profile2D) {
        vertices.push([-hx, p[0], p[1]]);
        vertices.push([hx, p[0], p[1]]);
    }

    const edges: Array<{ key: string; points: number[][] }> = [];
    for (let i = 0; i < profile2D.length; i++) {
        const pt = profile2D[i];
        edges.push({ key: `e_long_${i}`, points: [[-hx, pt[0], pt[1]], [hx, pt[0], pt[1]]] });
    }
    for (let i = 0; i < profile2D.length; i++) {
        const next = (i + 1) % profile2D.length;
        edges.push({ key: `e_prof_neg_${i}`, points: [[-hx, profile2D[i][0], profile2D[i][1]], [-hx, profile2D[next][0], profile2D[next][1]]] });
        edges.push({ key: `e_prof_pos_${i}`, points: [[hx, profile2D[i][0], profile2D[i][1]], [hx, profile2D[next][0], profile2D[next][1]]] });
    }

    const result: Record<string, any> = {
        FACE_Z_PLUS: faceZPlus,
        FACE_Z_MINUS: faceZMinus,
        FACE_Y_PLUS: faceYPlus,
        FACE_Y_MINUS: faceYMinus,
        FACE_X_PLUS: faceXPlus,
        FACE_X_MINUS: faceXMinus,
        [`feature_${featureId}_bottom`]: grooveBottom,
        [`feature_${featureId}_wall_front`]: grooveFront,
        vertices,
        edges
    };

    if (grooveBack) {
        result[`feature_${featureId}_wall_back`] = grooveBack;
    }

    return result;
}
