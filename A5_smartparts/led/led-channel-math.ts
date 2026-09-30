/**
 * A5_smartparts / led — led-channel-math.ts
 * Czysty rdzeń obliczeniowy geometrii wpustów pod profile LED (Functional Core).
 *
 * Wylicza prostopadłościan cięcia z 4 referencji płaszczyzn,
 * bada rzuty i przecięcia bryłowe w lokalnej przestrzeni formatki
 * oraz wyznacza optymalną ścianę i parametry wpustu (GrooveFeature) bez mutowania modeli.
 */

import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { localMmToWorldMm, worldMmToLocalMm, namedFaceFromPick } from '../../S2_solver/constraint-geometry.js';
import { normalizeFaceName, type FaceName } from '../../A4_smartpanel/panel-model.js';
import type { AssocPlaneRef } from '../../A4_smartpanel/associative-dim.js';
import { LED_CHANNEL_SOURCE, type LedChannelDefinition } from './led-channel-types.js';

export interface WorldCutBox {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
}

export function resolvePlaneWorld(doc: any, ref: AssocPlaneRef | null): { point: Vec3; normal: Vec3 } | null {
    if (!doc || !ref?.nodeId || !ref.face) return null;
    const node = doc.findNode(ref.nodeId);
    if (!node) return null;
    const face = namedFaceFromPick(node, ref.face);
    if (!face) return null;
    const point = localMmToWorldMm(node, face.localPointMm);
    const { rotation } = node.getWorldMatrix().decompose();
    const normal = rotation.rotateVec3(new Vec3(
        face.localNormalMm[0],
        face.localNormalMm[1],
        face.localNormalMm[2],
    )).normalize();
    if (!Number.isFinite(normal.x + normal.y + normal.z)) return null;
    return { point, normal };
}

export function getNodeWorldCornersMm(node: any): Vec3[] {
    const domain = node?.domainData || node;
    if (!domain) return [];
    const w = nmToMm(domain.width);
    const h = nmToMm(domain.height);
    const t = nmToMm(domain.thickness);
    if (![w, h, t].every(Number.isFinite)) return [];

    const localCorners: [number, number, number][] = [
        [-w / 2, -t / 2, -h / 2],
        [w / 2, -t / 2, -h / 2],
        [-w / 2, t / 2, -h / 2],
        [w / 2, t / 2, -h / 2],
        [-w / 2, -t / 2, h / 2],
        [w / 2, -t / 2, h / 2],
        [-w / 2, t / 2, h / 2],
        [w / 2, t / 2, h / 2],
    ];

    return localCorners.map(c => localMmToWorldMm(node, c));
}

export function getContainerBoundsWorldMm(doc: any, containerNode: any): { min: Vec3; max: Vec3; panels: any[] } | null {
    if (!containerNode) return null;
    const allPanels = typeof doc?.getPanels === 'function' ? doc.getPanels() : [];
    const containerPanels = allPanels.filter((p: any) => {
        let curr = p;
        while (curr) {
            if (curr.id === containerNode.id) return true;
            curr = curr.parent;
        }
        return false;
    });
    if (containerPanels.length === 0) {
        // Fallback: jeśli containerNode to pojedyncza formatka
        const corners = getNodeWorldCornersMm(containerNode);
        if (corners.length === 0) return null;
        const minX = Math.min(...corners.map(c => c.x));
        const maxX = Math.max(...corners.map(c => c.x));
        const minY = Math.min(...corners.map(c => c.y));
        const maxY = Math.max(...corners.map(c => c.y));
        const minZ = Math.min(...corners.map(c => c.z));
        const maxZ = Math.max(...corners.map(c => c.z));
        return {
            min: new Vec3(minX, minY, minZ),
            max: new Vec3(maxX, maxY, maxZ),
            panels: [containerNode],
        };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of containerPanels) {
        const corners = getNodeWorldCornersMm(p);
        for (const c of corners) {
            if (c.x < minX) minX = c.x;
            if (c.x > maxX) maxX = c.x;
            if (c.y < minY) minY = c.y;
            if (c.y > maxY) maxY = c.y;
            if (c.z < minZ) minZ = c.z;
            if (c.z > maxZ) maxZ = c.z;
        }
    }

    return {
        min: new Vec3(minX, minY, minZ),
        max: new Vec3(maxX, maxY, maxZ),
        panels: containerPanels,
    };
}

export interface DetectedCabinetRow {
    refLeft: AssocPlaneRef;
    refRight: AssocPlaneRef;
    refBottom: AssocPlaneRef;
    refFront: AssocPlaneRef;
    refTop?: AssocPlaneRef | null;
    refBack?: AssocPlaneRef | null;
    cabinetIds: string[];
    cabinetCount: number;
    totalWidthMm: number;
    xMin: number;
    xMax: number;
    yFront: number;
    zBottom: number;
}

/**
 * Automatycznie wykrywa ciągły rząd szafek wiszących (o tym samym dnie Z i froncie Y)
 * na podstawie upuszczenia/wskazania dowolnego elementu jednej szafki.
 */
export function detectCabinetRow(doc: any, targetId: string): DetectedCabinetRow | null {
    if (!doc || !targetId) return null;
    const targetNode = doc.findNode(targetId);
    if (!targetNode) return null;

    // 1. Znajdź kontener korpusu bazowego
    let targetContainer: any = null;
    let curr = targetNode;
    while (curr && curr.id !== doc.rootNode?.id) {
        if (curr.domainData?.type === 'container' || curr.domainData?.generatorParams) {
            targetContainer = curr;
            break;
        }
        curr = curr.parent;
    }
    const baseCabinet = targetContainer || targetNode;
    const baseBounds = getContainerBoundsWorldMm(doc, baseCabinet);
    if (!baseBounds) return null;

    const zBottomBase = baseBounds.min.z;
    const yFrontBase = baseBounds.min.y;

    // 2. Zbierz wszystkie szafki (kontenery korpusów) w scenie
    const allNodes: any[] = [];
    const trav = (n: any) => {
        allNodes.push(n);
        for (const ch of n.children || []) trav(ch);
    };
    trav(doc.rootNode);

    const candidateContainers = allNodes.filter(n =>
        (n.domainData?.type === 'container' || n.domainData?.generatorParams) &&
        !String(n.domainData?.generatorParams?.type || '').startsWith('blok_')
    );

    // 3. Sprawdź które szafki mają to samo dno Z i ten sam front Y
    interface RowCand {
        container: any;
        bounds: { min: Vec3; max: Vec3; panels: any[] };
    }
    const matching: RowCand[] = [];

    const pool = candidateContainers.length > 0 ? candidateContainers : [baseCabinet];
    for (const c of pool) {
        const b = getContainerBoundsWorldMm(doc, c);
        if (!b) continue;
        if (Math.abs(b.min.z - zBottomBase) <= 5 && Math.abs(b.min.y - yFrontBase) <= 10) {
            matching.push({ container: c, bounds: b });
        }
    }

    if (matching.length === 0) {
        matching.push({ container: baseCabinet, bounds: baseBounds });
    }

    // 4. Posortuj wzdłuż osi X i znajdź ciągły łańcuch zawierający szafkę bazową
    matching.sort((a, b) => a.bounds.min.x - b.bounds.min.x);

    // Podział na grupy stykające się (odległość między szafkami <= 5 mm)
    const groups: RowCand[][] = [];
    let currentGroup: RowCand[] = [matching[0]];

    for (let i = 1; i < matching.length; i++) {
        const prev = matching[i - 1];
        const cur = matching[i];
        const gap = cur.bounds.min.x - prev.bounds.max.x;
        if (gap <= 5) {
            currentGroup.push(cur);
        } else {
            groups.push(currentGroup);
            currentGroup = [cur];
        }
    }
    groups.push(currentGroup);

    // Wybierz grupę zawierającą szafkę bazową
    const targetGroupId = baseCabinet.id;
    const selectedGroup = groups.find(g => g.some(item => item.container.id === targetGroupId)) || groups[0];

    const first = selectedGroup[0];
    const last = selectedGroup[selectedGroup.length - 1];

    const xMin = first.bounds.min.x;
    const xMax = last.bounds.max.x;
    const totalWidthMm = Math.max(10, xMax - xMin);

    // 5. Wyznacz referencje skrajne
    const findSide = (panels: any[], role: string, fallbackKeywords: string[]) => {
        return panels.find((p: any) =>
            p.domainData?.role === role ||
            fallbackKeywords.some(k => p.name?.toLowerCase().includes(k))
        );
    };

    const leftPanel = findSide(first.bounds.panels, 'LEFT_SIDE_PANEL', ['bok_l', 'bok lewy', 'left']) || first.bounds.panels[0];
    const rightPanel = findSide(last.bounds.panels, 'RIGHT_SIDE_PANEL', ['bok_p', 'bok prawy', 'right']) || last.bounds.panels[0];

    // Wieniec dolny szafki bazowej (lub pierwszej)
    const bottomPanel = baseBounds.panels.find((p: any) =>
        p.domainData?.role === 'BOTTOM_PANEL' ||
        p.name?.toLowerCase().includes('wieniec_d') ||
        p.name?.toLowerCase().includes('wieniec dolny')
    ) || targetNode;

    const topPanel = baseBounds.panels.find((p: any) =>
        p.domainData?.role === 'TOP_PANEL' ||
        p.name?.toLowerCase().includes('wieniec_g') ||
        p.name?.toLowerCase().includes('wieniec gorny') ||
        p.name?.toLowerCase().includes('top')
    );

    const backPanel = baseBounds.panels.find((p: any) =>
        p.domainData?.role === 'BACK_PANEL' ||
        p.name?.toLowerCase().includes('plecy') ||
        p.name?.toLowerCase().includes('back')
    );

    const refLeft: AssocPlaneRef = {
        nodeId: leftPanel.id,
        face: 'FACE_Z_MINUS',
        label: leftPanel.name || 'Bok Lewy (Koniec rzędu)',
    };

    const refRight: AssocPlaneRef = {
        nodeId: rightPanel.id,
        face: 'FACE_Z_MINUS',
        label: rightPanel.name || 'Bok Prawy (Koniec rzędu)',
    };

    const refBottom: AssocPlaneRef = {
        nodeId: bottomPanel.id,
        face: 'FACE_Z_MINUS',
        label: bottomPanel.name || 'Wieniec Dolny (Dno)',
    };

    const refFront: AssocPlaneRef = {
        nodeId: bottomPanel.id,
        face: 'FACE_Y_PLUS',
        label: 'Front szafek',
    };

    const refTop: AssocPlaneRef | null = topPanel ? {
        nodeId: topPanel.id,
        face: 'FACE_Z_PLUS',
        label: topPanel.name || 'Wieniec Górny',
    } : null;

    const refBack: AssocPlaneRef | null = backPanel ? {
        nodeId: backPanel.id,
        face: 'FACE_Y_MINUS',
        label: backPanel.name || 'Plecy',
    } : null;

    return {
        refLeft,
        refRight,
        refBottom,
        refFront,
        refTop,
        refBack,
        cabinetIds: selectedGroup.map(g => g.container.id),
        cabinetCount: selectedGroup.length,
        totalWidthMm,
        xMin,
        xMax,
        yFront: yFrontBase,
        zBottom: zBottomBase,
    };
}

/**
 * Oblicza BoundingBox [mm] bryły narzędzia LED w przestrzeni świata (World Space) z referencji.
 * Zawsze operuje w stabilnym układzie CAD Z-up:
 *   X = od lewej do prawej (szerokość)
 *   Y = od frontu w głąb korpusu (głębokość)
 *   Z = od spodu wieńca w górę materiału (wysokość/grubość)
 */
export function computeLedChannelWorldBox(doc: any, def: LedChannelDefinition): WorldCutBox | null {
    if (!def.enabled) return null;
    const planeLeft = resolvePlaneWorld(doc, def.refLeft);
    const planeRight = resolvePlaneWorld(doc, def.refRight);
    const planeBottom = resolvePlaneWorld(doc, def.refBottom);
    const planeFront = resolvePlaneWorld(doc, def.refFront);

    if (!planeLeft || !planeRight || !planeBottom || !planeFront) {
        return null;
    }

    const offsets = def.offsets || {};
    const offXMin = Number(offsets.xMin) || 0;
    const offXMax = Number(offsets.xMax) || 0;
    const offYMin = Number(offsets.yMin) || 0;
    const offZMin = Number(offsets.zMin) || 0;

    // 1. Zakres X (od lewej do prawej szafki / boku) + offsety Bloku
    let xMin = Math.min(planeLeft.point.x, planeRight.point.x) + offXMin;
    let xMax = Math.max(planeLeft.point.x, planeRight.point.x) - offXMax;
    if (xMin > xMax) {
        const tmp = xMin;
        xMin = xMax;
        xMax = tmp;
    }

    // 2. Zakres Y (od krawędzi frontowej w głąb korpusu)
    const dirY = planeFront.normal.y > 0.5 ? -1 : 1;
    const yFront = planeFront.point.y;
    // Odsunięcie frontowe: priorytet ma def.offsetFromFrontMm lub def.offsets.yMin
    const frontOffset = (offYMin !== 0) ? offYMin : def.offsetFromFrontMm;
    const yStart = yFront + dirY * frontOffset;
    const yEnd = yStart + dirY * Math.max(1, def.grooveWidthMm);
    const yMin = Math.min(yStart, yEnd);
    const yMax = Math.max(yStart, yEnd);

    // 3. Zakres Z (od dolnej powierzchni wieńca w głąb materiału w górę)
    const dirZ = planeBottom.normal.z > 0.5 ? -1 : 1;
    const zBottom = planeBottom.point.z + dirZ * offZMin;
    const z0 = zBottom;
    const depth = def.grooveDepthMm || 9;
    const z1 = z0 + dirZ * Math.max(1, depth);
    const zMin = Math.min(z0, z1);
    const zMax = Math.max(z0, z1);

    return { xMin, xMax, yMin, yMax, zMin, zMax };
}

export function computeFaceData(rawFaceName: string, w: number, h: number, t: number) {
    const faceName = normalizeFaceName(rawFaceName);
    const cx = -w / 2;
    const cy = -h / 2;
    const cz = -t / 2;
    switch (faceName) {
        case 'FACE_Z_PLUS':  return { origin: [cx, cy, cz + t], uAxis: [1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, 1], width: w, height: h, thickness: t };
        case 'FACE_Z_MINUS': return { origin: [cx + w, cy, cz], uAxis: [-1, 0, 0], vAxis: [0, 1, 0], normal: [0, 0, -1], width: w, height: h, thickness: t };
        case 'FACE_X_MINUS': return { origin: [cx, cy, cz], uAxis: [0, 0, 1], vAxis: [0, 1, 0], normal: [-1, 0, 0], width: t, height: h, thickness: w };
        case 'FACE_X_PLUS':  return { origin: [cx + w, cy, cz + t], uAxis: [0, 0, -1], vAxis: [0, 1, 0], normal: [1, 0, 0], width: t, height: h, thickness: w };
        case 'FACE_Y_PLUS':  return { origin: [cx, cy + h, cz + t], uAxis: [1, 0, 0], vAxis: [0, 0, -1], normal: [0, 1, 0], width: w, height: t, thickness: h };
        case 'FACE_Y_MINUS': return { origin: [cx, cy, cz], uAxis: [1, 0, 0], vAxis: [0, 0, 1], normal: [0, -1, 0], width: w, height: t, thickness: h };
        default: throw new Error(`Unknown face: ${faceName}`);
    }
}

/**
 * Rzutuje punkt 3D ze współrzędnych mesha formatki na układ 2D (u, v, d) danej ściany.
 */
export function meshPointToFaceUVD(faceData: any, p: [number, number, number]): { u: number; v: number; d: number } {
    const dx = p[0] - faceData.origin[0];
    const dy = p[1] - faceData.origin[1];
    const dz = p[2] - faceData.origin[2];

    const u = dx * faceData.uAxis[0] + dy * faceData.uAxis[1] + dz * faceData.uAxis[2];
    const v = dx * faceData.vAxis[0] + dy * faceData.vAxis[1] + dz * faceData.vAxis[2];
    const d = -(dx * faceData.normal[0] + dy * faceData.normal[1] + dz * faceData.normal[2]);

    return { u, v, d };
}

export interface LedGrooveFeatureDto {
    id: string;
    type: 'groove';
    name: string;
    face: FaceName;
    params: {
        u: number;
        v: number;
        width: number;
        length: number;
        depth: number;
        source: string;
        channel_id: string;
        is_assembly_groove: boolean;
    };
}

/**
 * Czysta funkcja wyliczająca wpust w formacie na podstawie bryły cięcia LED (Functional Core).
 * Zwraca LedGrooveFeatureDto lub null jeśli brak przecięcia.
 */
export function calculatePanelLedGroove(
    node: any,
    panel: any,
    box: WorldCutBox,
    def: LedChannelDefinition
): LedGrooveFeatureDto | null {
    if (!box || !panel) return null;

    // Wymiary panelu [mm]
    const w = nmToMm(panel.width);
    const h = nmToMm(panel.height);
    const t = nmToMm(panel.thickness);

    // Narożniki bryły cięcia w przestrzeni świata
    const worldCorners: Vec3[] = [
        new Vec3(box.xMin, box.yMin, box.zMin),
        new Vec3(box.xMax, box.yMin, box.zMin),
        new Vec3(box.xMin, box.yMax, box.zMin),
        new Vec3(box.xMax, box.yMax, box.zMin),
        new Vec3(box.xMin, box.yMin, box.zMax),
        new Vec3(box.xMax, box.yMin, box.zMax),
        new Vec3(box.xMin, box.yMax, box.zMax),
        new Vec3(box.xMax, box.yMax, box.zMax),
    ];

    // Transformacja do CADNode local space: X=width, Y=thickness, Z=height
    const localCorners = worldCorners.map((pt) => worldMmToLocalMm(node, pt));
    const cX = localCorners.map((c) => c[0]);
    const cY = localCorners.map((c) => c[1]);
    const cZ = localCorners.map((c) => c[2]);

    const cutCadMin = [Math.min(...cX), Math.min(...cY), Math.min(...cZ)];
    const cutCadMax = [Math.max(...cX), Math.max(...cY), Math.max(...cZ)];

    // Przecięcie z gabarytem płyty w CADNode: [-w/2, w/2], [-t/2, t/2], [-h/2, h/2]
    const interCadX = [Math.max(-w / 2, cutCadMin[0]), Math.min(w / 2, cutCadMax[0])];
    const interCadY = [Math.max(-t / 2, cutCadMin[1]), Math.min(t / 2, cutCadMax[1])];
    const interCadZ = [Math.max(-h / 2, cutCadMin[2]), Math.min(h / 2, cutCadMax[2])];

    const eps = 0.5;
    if (
        interCadX[1] - interCadX[0] < eps ||
        interCadY[1] - interCadY[0] < eps ||
        interCadZ[1] - interCadZ[0] < eps
    ) {
        return null; // Brak przecięcia
    }

    // Zamiana CADNode (X=w, Y=t, Z=h) na PanelModel Mesh (X=w, Y=h, Z=t)
    const meshMin: [number, number, number] = [interCadX[0], interCadZ[0], interCadY[0]];
    const meshMax: [number, number, number] = [interCadX[1], interCadZ[1], interCadY[1]];

    // Sprawdź czy to bok (lewy/prawy) vs wieniec (dolny/górny)
    const role = String(panel.role || '').toUpperCase();
    const isSide = role.includes('SIDE') || role.includes('BOK');
    if (isSide && !def.cutSides) {
        return null; // Użytkownik wyłączył podcinanie boków
    }

    // Określ ścianę wejściową frezowania
    let candidateFaces: FaceName[] = isSide
        ? ['FACE_X_MINUS', 'FACE_X_PLUS', 'FACE_Y_MINUS', 'FACE_Y_PLUS', 'FACE_Z_MINUS', 'FACE_Z_PLUS']
        : ['FACE_Z_MINUS', 'FACE_Y_MINUS', 'FACE_Y_PLUS', 'FACE_X_MINUS', 'FACE_Z_PLUS'];
    let chosenFace: FaceName = 'FACE_Z_MINUS';
    let bestScore = -Infinity;
    let bestParams: any = null;

    for (const face of candidateFaces) {
        const faceData = computeFaceData(face, w, h, t);
        const uvd0 = meshPointToFaceUVD(faceData, meshMin);
        const uvd1 = meshPointToFaceUVD(faceData, meshMax);

        const uMin = Math.min(uvd0.u, uvd1.u);
        const uMax = Math.max(uvd0.u, uvd1.u);
        const vMin = Math.min(uvd0.v, uvd1.v);
        const vMax = Math.max(uvd0.v, uvd1.v);
        const dMin = Math.min(uvd0.d, uvd1.d);
        const dMax = Math.max(uvd0.d, uvd1.d);

        // Sprawdź czy cięcie zaczyna się na powierzchni tej ściany (dMin bliskie 0)
        if (dMin <= eps && dMax > eps) {
            const surfaceArea = (uMax - uMin) * (vMax - vMin);
            // Boki: krawędzie (nie FACE_Z) mają priorytet nad dużym licem płyty
            const edgeBonus = isSide && !String(face).startsWith('FACE_Z') ? 1e6 : 0;
            // Wieniec: preferuj spód
            const bottomBonus = !isSide && face === 'FACE_Z_MINUS' ? 1e6 : 0;
            const score = surfaceArea + edgeBonus + bottomBonus;
            if (score > bestScore) {
                bestScore = score;
                chosenFace = face;
                bestParams = {
                    u: Math.max(0, uMin),
                    v: Math.max(0, vMin),
                    width: Math.max(1, uMax - uMin),
                    length: Math.max(1, vMax - vMin),
                    depth: Math.min(faceData.thickness, Math.max(1, dMax)),
                };
            }
        }
    }

    if (!bestParams) return null;

    return {
        id: `groove_led_${def.id}_${panel.id}`,
        type: 'groove',
        name: 'Rowek pod LED',
        face: chosenFace,
        params: {
            ...bestParams,
            source: LED_CHANNEL_SOURCE,
            channel_id: def.id,
            is_assembly_groove: true,
        },
    };
}
