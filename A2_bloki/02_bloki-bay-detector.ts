/**
 * bloki-bay-detector.ts
 *
 * Dynamiczny detektor wnęki (Cabinet Bay) w przestrzeni 3D CAD.
 * Bada przestrzeń z punktu wewnątrz korpusu w 5 kierunkach (-X, +X, -Z, +Z, -Y),
 * wykrywając 5 otaczających ścian formatki oraz wyznaczając płaszczyznę lica (przód +Y).
 */

import { ProjectDocument } from '../A1_core/project-document.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { PanelModel, normalizeFaceName, type FaceName } from '../A4_smartpanel/panel-model.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { Mat4 } from '../A1_core/cad-math/mat4.js';

export interface FaceHitRef {
    nodeId: string;
    nodeName: string;
    face: FaceName;
    faceName?: FaceName;
    worldPointMm: { x: number; y: number; z: number };
    planeCoordMm: number; // np. X dla boków, Z dla wieńców, Y dla pleców
    slopeAngleDeg?: number;
}

export type BayBoundary = {
    left: FaceHitRef;
    right: FaceHitRef;
    bottom: FaceHitRef;
    top: FaceHitRef;
    back: FaceHitRef;
    front: FaceHitRef;
    frontPlaneYMm: number;
};

export interface DetectedBay {
    boundsMm: {
        width: number;  // X: od lewego do prawego boku
        height: number; // Z: od dna do góry
        depth: number;  // Y: od pleców do lica przodu
    };
    boundsNm: {
        width: number;
        height: number;
        depth: number;
    };
    centerWorldMm: {
        x: number;
        y: number;
        z: number;
    };
    parentCabinetId?: string;
    roofAngleDeg?: number;
    slopeAxis?: 'X' | 'Y';
    roofAngleDepthDeg?: number;
    heightLeftMm?: number;
    heightRightMm?: number;
    heightFrontMm?: number;
    heightBackMm?: number;
    boundary?: BayBoundary;
}

export type SlimDetectedBay = Omit<DetectedBay, 'boundary'>;

/**
 * Uzupełnia brakujące wysokości skosu LR na podstawie kąta dachu i wymiarów wnęki.
 * Dzięki temu slim snapshot nie gubi geometrii wymaganej przez ContainerView.
 */
function withDerivedLrSlopeHeights(bay: DetectedBay): DetectedBay {
    const angleDeg = bay.roofAngleDeg;
    if (bay.slopeAxis === 'Y' || angleDeg === undefined || !Number.isFinite(Number(angleDeg)) || Math.abs(Number(angleDeg)) <= 0.05) {
        return bay;
    }
    if (bay.heightLeftMm !== undefined && bay.heightRightMm !== undefined) return bay;

    const widthMm = bay.boundsMm?.width;
    const heightMm = bay.boundsMm?.height;
    if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0) return bay;

    const tanBeta = Math.tan((Number(angleDeg) * Math.PI) / 180);
    let heightLeftMm = bay.heightLeftMm;
    let heightRightMm = bay.heightRightMm;

    if (heightLeftMm === undefined && heightRightMm === undefined) {
        heightLeftMm = Math.max(10, heightMm - (widthMm / 2) * tanBeta);
        heightRightMm = Math.max(10, heightMm + (widthMm / 2) * tanBeta);
    } else if (heightLeftMm === undefined) {
        heightLeftMm = Math.max(10, heightRightMm! - widthMm * tanBeta);
    } else if (heightRightMm === undefined) {
        heightRightMm = Math.max(10, heightLeftMm + widthMm * tanBeta);
    }

    return {
        ...bay,
        slopeAxis: bay.slopeAxis ?? 'X',
        heightLeftMm,
        heightRightMm,
    };
}

/**
 * Rekonstruuje pełny obiekt DetectedBay z generatorParams i wymiarów kontenera.
 * Jeśli gp.detectedBay istnieje, zwraca go z dowiązanym boundary z gp.boundary (SSOT).
 * Jeśli gp.detectedBay nie istnieje, rekonstruuje obiekt na bazie gp.boundary i wymiarów kontenera.
 */
export function resolveDetectedBay(
    generatorParams: any,
    containerDimensionsNm?: { width: number; height: number; depth: number }
): DetectedBay | null {
    if (!generatorParams) return null;
    const boundary: BayBoundary | undefined = generatorParams.boundary || generatorParams.detectedBay?.boundary;
    const rawBay: DetectedBay | undefined = generatorParams.detectedBay;

    if (rawBay && boundary) {
        return withDerivedLrSlopeHeights({
            ...rawBay,
            boundary
        });
    }

    if (!boundary) return rawBay ? withDerivedLrSlopeHeights(rawBay) : null;

    const leftX = boundary.left?.planeCoordMm;
    const rightX = boundary.right?.planeCoordMm;
    const bottomZ = boundary.bottom?.planeCoordMm;
    const topZ = boundary.top?.planeCoordMm;
    const backY = boundary.back?.planeCoordMm;
    const frontY = boundary.front?.planeCoordMm ?? boundary.frontPlaneYMm;

    const widthMm = (leftX != null && rightX != null)
        ? Math.abs(rightX - leftX)
        : (containerDimensionsNm ? nmToMm(containerDimensionsNm.width) : 0);
    const heightMm = (topZ != null && bottomZ != null)
        ? Math.abs(topZ - bottomZ)
        : (containerDimensionsNm ? nmToMm(containerDimensionsNm.height) : 0);
    const depthMm = (backY != null && frontY != null)
        ? Math.abs(frontY - backY)
        : (containerDimensionsNm ? nmToMm(containerDimensionsNm.depth) : 0);

    const centerX = (leftX != null && rightX != null) ? (leftX + rightX) / 2 : 0;
    const centerY = (backY != null && frontY != null) ? (backY + frontY) / 2 : 0;
    const centerZ = (bottomZ != null && topZ != null) ? (bottomZ + topZ) / 2 : 0;

    return withDerivedLrSlopeHeights({
        boundsMm: { width: widthMm, height: heightMm, depth: depthMm },
        boundsNm: {
            width: containerDimensionsNm?.width ?? mmToNm(widthMm),
            height: containerDimensionsNm?.height ?? mmToNm(heightMm),
            depth: containerDimensionsNm?.depth ?? mmToNm(depthMm)
        },
        centerWorldMm: { x: centerX, y: centerY, z: centerZ },
        parentCabinetId: generatorParams.parentContainerId || rawBay?.parentCabinetId,
        roofAngleDeg: rawBay?.roofAngleDeg ?? boundary.top?.slopeAngleDeg,
        slopeAxis: rawBay?.slopeAxis,
        roofAngleDepthDeg: rawBay?.roofAngleDepthDeg,
        heightLeftMm: rawBay?.heightLeftMm,
        heightRightMm: rawBay?.heightRightMm,
        heightFrontMm: rawBay?.heightFrontMm,
        heightBackMm: rawBay?.heightBackMm,
        boundary
    });
}

interface PanelFaceInfo {
    node: CADNode;
    panel: PanelModel;
    face: FaceName;
    worldCenterMm: Vec3;
    worldNormal: Vec3;
    minBoundsMm: Vec3;
    maxBoundsMm: Vec3;
}

/** Najbliższy kontener korpusu (preferuj typ korpusu w generatorParams). */
function findKorpusContainer(start: CADNode | null, document: ProjectDocument): CADNode | null {
    let curr: CADNode | null = start;
    let korpusContainer: CADNode | null = null;
    let anyContainer: CADNode | null = null;
    while (curr && curr.id !== document.rootNode.id) {
        const dd = curr.domainData as any;
        if (dd?.type === 'container' || dd?.generatorParams) {
            if (!anyContainer) anyContainer = curr;
            const t = String(dd.generatorParams?.typ_korpusu || dd.generatorParams?.type || '').toLowerCase();
            if (t.includes('korpus') || t.includes('smartframe') || dd.generatorParams?.typ_korpusu) {
                korpusContainer = curr;
                break;
            }
        }
        curr = curr.parent;
    }
    return korpusContainer || anyContainer;
}

function isNodeUnderCabinet(node: CADNode | null, cabinetId: string | undefined): boolean {
    if (!node || !cabinetId) return false;
    let curr: CADNode | null = node;
    while (curr) {
        if (curr.id === cabinetId) return true;
        curr = curr.parent;
    }
    return false;
}

function extractRoofAngleDeg(
    topNode: CADNode | null,
    parentCabinetNode: CADNode | null,
    topNormal?: Vec3
): number | undefined {
    const rotZ = (topNode?.domainData as any)?.lcs?.rotation?.[2];
    if (rotZ != null && Number.isFinite(Number(rotZ)) && Math.abs(Number(rotZ)) > 1e-4) {
        return -Number(rotZ);
    }
    if (parentCabinetNode?.children) {
        const topPanel = parentCabinetNode.children.find(
            (c: any) => String(c.domainData?.role || '').toUpperCase() === 'TOP_PANEL'
        );
        const cabRotZ = (topPanel?.domainData as any)?.lcs?.rotation?.[2];
        if (cabRotZ != null && Number.isFinite(Number(cabRotZ)) && Math.abs(Number(cabRotZ)) > 1e-4) {
            return -Number(cabRotZ);
        }
    }
    if (topNormal && Math.abs(topNormal.x) > 0.05 && Math.abs(topNormal.z) > 0.1) {
        const betaRad = Math.atan2(-topNormal.x, -topNormal.z);
        const deg = (betaRad * 180) / Math.PI;
        if (Math.abs(deg) > 0.5) return deg;
    }
    return undefined;
}

/** Płaszczyzna przednia korpusu SmartFrame w CAD Y [mm]: środek korpusu − D/2. */
function smartFrameFrontPlaneYMm(cabNode: CADNode, depthMm: number): number {
    const originNm = cabNode.getWorldMatrix().transformPoint(new Vec3(0, 0, 0));
    return nmToMm(originNm.y) - depthMm / 2;
}

/**
 * Sprawdza czy formatka pełni rolę elementu dzielącego wnękę meblową
 * (np. pionowa przegroda DIVIDER_PLATE lub stały wieniec konstrukcyjny SHELF_BOARD).
 */
export function isBayDividingPanel(role?: string, name?: string): boolean {
    const r = String(role || '').toUpperCase();
    const n = String(name || '').toUpperCase();
    return r === 'DIVIDER_PLATE' ||
        r === 'VERTICAL_DIVIDER' ||
        r === 'SHELF_BOARD' ||
        r.includes('DIVIDER') ||
        r.includes('PRZEGRODA') ||
        r.includes('WIENIEC') ||
        n.includes('PRZEGRODA') ||
        n.includes('WIENIEC');
}

/**
 * Uniwersalnie zbiera wszystkie 6 ścian dla każdej formatki meblowej w scenie.
 * Zgodnie ze standardem LCS z AGENTS.md:
 * - Formatka ma lokalny środek (0, 0, 0) w środku geometrycznym.
 * - Pozycje i orientacje ścian w świecie są liczone w 100% matematycznie
 *   przez macierz świata node.getWorldMatrix() (bez zgadywania ról i bez zamiany osi).
 */
function collectScenePanelFaces(document: ProjectDocument): PanelFaceInfo[] {
    const list: PanelFaceInfo[] = [];
    if (!document) return list;

    const allNodes: CADNode[] = [];
    const traverse = (node: CADNode) => {
        allNodes.push(node);
        for (const child of node.children) traverse(child);
    };
    traverse(document.rootNode);

    for (const node of allNodes) {
        const d = node.domainData;
        if (!d || (d.type !== 'panel' && d.type !== 'part')) continue;
        const panel = d as PanelModel;
        const role = String((panel as any).role || '').toUpperCase();
        // Pomiń elementy Bloku, z wyjątkiem stałych przegród i półek/wieńców dzielących wnęki
        const parent = node.parent;
        const gp = (parent?.domainData as any)?.generatorParams;
        const isStructural = isBayDividingPanel(role, node.name) ||
            role.includes('SHELF') || role.includes('WIENIEC') || role.includes('POLKA');
        if (gp && (String(gp.type || '').startsWith('blok_') || gp.boxType) && !isStructural) {
            continue;
        }

        const wNm = panel.width || mmToNm(800);
        const hNm = panel.height || mmToNm(600);
        const tNm = panel.thickness ??
            (panel.custom_properties?.thickness_mm ? mmToNm(Number(panel.custom_properties.thickness_mm)) : undefined) ??
            (panel.custom_properties?.thickness ? Number(panel.custom_properties.thickness) : undefined) ??
            ((panel as any).dim?.z ? Number((panel as any).dim.z) : undefined);

        if (!tNm) {
            throw new Error(
                `[bloki-bay-detector] Formatka korpusu "${node.name}" (${node.id}) nie posiada zdefiniowanej grubości. ` +
                `CAD wymaga jawnych danych grubości bez sztywnego zgadywania.`
            );
        }

        type FaceCfg = { face: FaceName; centerLocal: Vec3; normalLocal: Vec3; cornersLocal: Vec3[] };
        const localTx = node.localMatrix.data[12];
        const localTy = node.localMatrix.data[13];
        const localTz = node.localMatrix.data[14];
        let facesConfig: FaceCfg[] = [];

        if (role === 'LEFT_SIDE_PANEL' || role === 'SIDE_LEFT' || role === 'BOK_L' || (role === 'MANUAL_PANEL' && localTx < 0)) {
            const hx = tNm / 2;
            const hy = wNm / 2; // głębokość w osi Y
            const hz = hNm / 2; // wysokość w osi Z
            facesConfig = [
                {
                    face: 'FACE_Z_PLUS', // inner (do wnętrza szafy)
                    centerLocal: new Vec3(hx, 0, 0),
                    normalLocal: new Vec3(1, 0, 0),
                    cornersLocal: [
                        new Vec3(hx, -hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Z_MINUS', // outer
                    centerLocal: new Vec3(-hx, 0, 0),
                    normalLocal: new Vec3(-1, 0, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(-hx, hy, -hz),
                        new Vec3(-hx, hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_PLUS', // tył
                    centerLocal: new Vec3(0, hy, 0),
                    normalLocal: new Vec3(0, 1, 0),
                    cornersLocal: [
                        new Vec3(-hx, hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_MINUS', // przód
                    centerLocal: new Vec3(0, -hy, 0),
                    normalLocal: new Vec3(0, -1, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, -hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_PLUS', // góra
                    centerLocal: new Vec3(0, 0, hz),
                    normalLocal: new Vec3(0, 0, 1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, hz), new Vec3(hx, -hy, hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_MINUS', // dół
                    centerLocal: new Vec3(0, 0, -hz),
                    normalLocal: new Vec3(0, 0, -1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, hy, -hz), new Vec3(-hx, hy, -hz)
                    ]
                }
            ];
        } else if (role === 'RIGHT_SIDE_PANEL' || role === 'SIDE_RIGHT' || role === 'BOK_P' || (role === 'MANUAL_PANEL' && localTx > 0)) {
            const hx = tNm / 2;
            const hy = wNm / 2; // głębokość w osi Y
            const hz = hNm / 2; // wysokość w osi Z
            facesConfig = [
                {
                    face: 'FACE_Z_PLUS', // inner (do wnętrza szafy)
                    centerLocal: new Vec3(-hx, 0, 0),
                    normalLocal: new Vec3(-1, 0, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(-hx, hy, -hz),
                        new Vec3(-hx, hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Z_MINUS', // outer
                    centerLocal: new Vec3(hx, 0, 0),
                    normalLocal: new Vec3(1, 0, 0),
                    cornersLocal: [
                        new Vec3(hx, -hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_PLUS', // tył
                    centerLocal: new Vec3(0, hy, 0),
                    normalLocal: new Vec3(0, 1, 0),
                    cornersLocal: [
                        new Vec3(-hx, hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_MINUS', // przód
                    centerLocal: new Vec3(0, -hy, 0),
                    normalLocal: new Vec3(0, -1, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, -hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_PLUS', // góra
                    centerLocal: new Vec3(0, 0, hz),
                    normalLocal: new Vec3(0, 0, 1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, hz), new Vec3(hx, -hy, hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_MINUS', // dół
                    centerLocal: new Vec3(0, 0, -hz),
                    normalLocal: new Vec3(0, 0, -1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, hy, -hz), new Vec3(-hx, hy, -hz)
                    ]
                }
            ];
        } else if (role === 'VERTICAL_DIVIDER' || role === 'DIVIDER' || role === 'PRZEGRODA' || role.includes('DIVIDER')) {
            const hx = tNm / 2;
            const hy = wNm / 2;
            const hz = hNm / 2;
            facesConfig = [
                {
                    face: 'FACE_Z_PLUS', // lewa strona przegrody (-X)
                    centerLocal: new Vec3(-hx, 0, 0),
                    normalLocal: new Vec3(-1, 0, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(-hx, hy, -hz),
                        new Vec3(-hx, hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Z_MINUS', // prawa strona przegrody (+X)
                    centerLocal: new Vec3(hx, 0, 0),
                    normalLocal: new Vec3(1, 0, 0),
                    cornersLocal: [
                        new Vec3(hx, -hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_PLUS',
                    centerLocal: new Vec3(0, hy, 0),
                    normalLocal: new Vec3(0, 1, 0),
                    cornersLocal: [
                        new Vec3(-hx, hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_MINUS',
                    centerLocal: new Vec3(0, -hy, 0),
                    normalLocal: new Vec3(0, -1, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, -hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_PLUS',
                    centerLocal: new Vec3(0, 0, hz),
                    normalLocal: new Vec3(0, 0, 1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, hz), new Vec3(hx, -hy, hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_MINUS',
                    centerLocal: new Vec3(0, 0, -hz),
                    normalLocal: new Vec3(0, 0, -1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, hy, -hz), new Vec3(-hx, hy, -hz)
                    ]
                }
            ];
        } else if (role === 'TOP_PANEL' || role === 'WIENIEC_G') {
            const hx = wNm / 2;
            const hy = hNm / 2;
            const hz = tNm / 2;
            facesConfig = [
                {
                    face: 'FACE_Z_PLUS', // inner (do wnętrza szafy, w dół)
                    centerLocal: new Vec3(0, 0, -hz),
                    normalLocal: new Vec3(0, 0, -1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, hy, -hz), new Vec3(-hx, hy, -hz)
                    ]
                },
                {
                    face: 'FACE_Z_MINUS', // outer (góra szafy)
                    centerLocal: new Vec3(0, 0, hz),
                    normalLocal: new Vec3(0, 0, 1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, hz), new Vec3(hx, -hy, hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_PLUS',
                    centerLocal: new Vec3(hx, 0, 0),
                    normalLocal: new Vec3(1, 0, 0),
                    cornersLocal: [
                        new Vec3(hx, -hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_MINUS',
                    centerLocal: new Vec3(-hx, 0, 0),
                    normalLocal: new Vec3(-1, 0, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(-hx, hy, -hz),
                        new Vec3(-hx, hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_PLUS',
                    centerLocal: new Vec3(0, hy, 0),
                    normalLocal: new Vec3(0, 1, 0),
                    cornersLocal: [
                        new Vec3(-hx, hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_MINUS',
                    centerLocal: new Vec3(0, -hy, 0),
                    normalLocal: new Vec3(0, -1, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, -hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                }
            ];
        } else if (role === 'BOTTOM_PANEL' || role === 'WIENIEC_D' || role === 'SHELF' || role === 'SHELF_PANEL' || role === 'POLKA') {
            const hx = wNm / 2;
            const hy = hNm / 2;
            const hz = tNm / 2;
            facesConfig = [
                {
                    face: 'FACE_Z_PLUS', // inner / góra półki (w górę)
                    centerLocal: new Vec3(0, 0, hz),
                    normalLocal: new Vec3(0, 0, 1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, hz), new Vec3(hx, -hy, hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_Z_MINUS', // outer / spód półki (w dół)
                    centerLocal: new Vec3(0, 0, -hz),
                    normalLocal: new Vec3(0, 0, -1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, hy, -hz), new Vec3(-hx, hy, -hz)
                    ]
                },
                {
                    face: 'FACE_X_PLUS',
                    centerLocal: new Vec3(hx, 0, 0),
                    normalLocal: new Vec3(1, 0, 0),
                    cornersLocal: [
                        new Vec3(hx, -hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_MINUS',
                    centerLocal: new Vec3(-hx, 0, 0),
                    normalLocal: new Vec3(-1, 0, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(-hx, hy, -hz),
                        new Vec3(-hx, hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_PLUS',
                    centerLocal: new Vec3(0, hy, 0),
                    normalLocal: new Vec3(0, 1, 0),
                    cornersLocal: [
                        new Vec3(-hx, hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_MINUS',
                    centerLocal: new Vec3(0, -hy, 0),
                    normalLocal: new Vec3(0, -1, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, -hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                }
            ];
        } else if (role === 'BACK_PANEL' || role === 'PLECY') {
            const hx = wNm / 2;
            const hy = tNm / 2;
            const hz = hNm / 2;
            facesConfig = [
                {
                    face: 'FACE_Z_PLUS', // inner (do wnętrza szafy, w stronę przodu)
                    centerLocal: new Vec3(0, -hy, 0),
                    normalLocal: new Vec3(0, -1, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, -hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Z_MINUS', // outer (tył zewnętrzny)
                    centerLocal: new Vec3(0, hy, 0),
                    normalLocal: new Vec3(0, 1, 0),
                    cornersLocal: [
                        new Vec3(-hx, hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_PLUS',
                    centerLocal: new Vec3(hx, 0, 0),
                    normalLocal: new Vec3(1, 0, 0),
                    cornersLocal: [
                        new Vec3(hx, -hy, -hz), new Vec3(hx, hy, -hz),
                        new Vec3(hx, hy, hz), new Vec3(hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_X_MINUS',
                    centerLocal: new Vec3(-hx, 0, 0),
                    normalLocal: new Vec3(-1, 0, 0),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(-hx, hy, -hz),
                        new Vec3(-hx, hy, hz), new Vec3(-hx, -hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_PLUS',
                    centerLocal: new Vec3(0, 0, hz),
                    normalLocal: new Vec3(0, 0, 1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, hz), new Vec3(hx, -hy, hz),
                        new Vec3(hx, hy, hz), new Vec3(-hx, hy, hz)
                    ]
                },
                {
                    face: 'FACE_Y_MINUS',
                    centerLocal: new Vec3(0, 0, -hz),
                    normalLocal: new Vec3(0, 0, -1),
                    cornersLocal: [
                        new Vec3(-hx, -hy, -hz), new Vec3(hx, -hy, -hz),
                        new Vec3(hx, hy, -hz), new Vec3(-hx, hy, -hz)
                    ]
                }
            ];
        } else {
            // Domyślny uniwersalny panel manualny (LCS z AGENTS.md)
            facesConfig = [
                {
                    face: 'FACE_Z_PLUS',
                    centerLocal: new Vec3(0, 0, tNm / 2),
                    normalLocal: new Vec3(0, 0, 1),
                    cornersLocal: [
                        new Vec3(-wNm / 2, -hNm / 2, tNm / 2),
                        new Vec3(wNm / 2, -hNm / 2, tNm / 2),
                        new Vec3(wNm / 2, hNm / 2, tNm / 2),
                        new Vec3(-wNm / 2, hNm / 2, tNm / 2)
                    ]
                },
                {
                    face: 'FACE_Z_MINUS',
                    centerLocal: new Vec3(0, 0, -tNm / 2),
                    normalLocal: new Vec3(0, 0, -1),
                    cornersLocal: [
                        new Vec3(-wNm / 2, -hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, -hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, hNm / 2, -tNm / 2),
                        new Vec3(-wNm / 2, hNm / 2, -tNm / 2)
                    ]
                },
                {
                    face: 'FACE_X_PLUS',
                    centerLocal: new Vec3(wNm / 2, 0, 0),
                    normalLocal: new Vec3(1, 0, 0),
                    cornersLocal: [
                        new Vec3(wNm / 2, -hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, hNm / 2, tNm / 2),
                        new Vec3(wNm / 2, -hNm / 2, tNm / 2)
                    ]
                },
                {
                    face: 'FACE_X_MINUS',
                    centerLocal: new Vec3(-wNm / 2, 0, 0),
                    normalLocal: new Vec3(-1, 0, 0),
                    cornersLocal: [
                        new Vec3(-wNm / 2, -hNm / 2, -tNm / 2),
                        new Vec3(-wNm / 2, hNm / 2, -tNm / 2),
                        new Vec3(-wNm / 2, hNm / 2, tNm / 2),
                        new Vec3(-wNm / 2, -hNm / 2, tNm / 2)
                    ]
                },
                {
                    face: 'FACE_Y_PLUS',
                    centerLocal: new Vec3(0, hNm / 2, 0),
                    normalLocal: new Vec3(0, 1, 0),
                    cornersLocal: [
                        new Vec3(-wNm / 2, hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, hNm / 2, tNm / 2),
                        new Vec3(-wNm / 2, hNm / 2, tNm / 2)
                    ]
                },
                {
                    face: 'FACE_Y_MINUS',
                    centerLocal: new Vec3(0, -hNm / 2, 0),
                    normalLocal: new Vec3(0, -1, 0),
                    cornersLocal: [
                        new Vec3(-wNm / 2, -hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, -hNm / 2, -tNm / 2),
                        new Vec3(wNm / 2, -hNm / 2, tNm / 2),
                        new Vec3(-wNm / 2, -hNm / 2, tNm / 2)
                    ]
                }
            ];
        }

        // Dla paneli korpusu transformacją do świata jest pozycja lokalna (cornerX, cornerY, cornerZ) przetransformowana przez rodzica (korpus)
        const parentNode = node.parent;
        const isCabinetPanel = !!(role && parentNode && parentNode.id !== document.rootNode.id);
        const transformMat = isCabinetPanel
            ? (parentNode?.getWorldMatrix() || Mat4.identity()).multiply(Mat4.fromTranslation(localTx, localTy, localTz))
            : node.getWorldMatrix();

        for (const fc of facesConfig) {
            const worldCenterNm = transformMat.transformPoint(fc.centerLocal);
            const worldNormal = transformMat.transformDirection(fc.normalLocal).normalize();
            const cornersWorld = fc.cornersLocal.map(c => transformMat.transformPoint(c));

            const minX = nmToMm(Math.min(...cornersWorld.map(c => c.x)));
            const maxX = nmToMm(Math.max(...cornersWorld.map(c => c.x)));
            const minY = nmToMm(Math.min(...cornersWorld.map(c => c.y)));
            const maxY = nmToMm(Math.max(...cornersWorld.map(c => c.y)));
            const minZ = nmToMm(Math.min(...cornersWorld.map(c => c.z)));
            const maxZ = nmToMm(Math.max(...cornersWorld.map(c => c.z)));

            list.push({
                node,
                panel,
                face: fc.face,
                worldCenterMm: new Vec3(nmToMm(worldCenterNm.x), nmToMm(worldCenterNm.y), nmToMm(worldCenterNm.z)),
                worldNormal,
                minBoundsMm: new Vec3(minX, minY, minZ),
                maxBoundsMm: new Vec3(maxX, maxY, maxZ)
            });
        }
    }

    return list;
}

/**
 * Wykrywa wnękę wokół punktu `probePointMm` w przestrzeni CAD:
 * - Oś X: lewo/prawo (szerokość)
 * - Oś Y: przód/tył (głębokość: przód = -D/2, tył = +D/2)
 * - Oś Z: dół/góra (wysokość: spód = 0, góra = +H)
 */
export function probeBayFromCADPoint(
    document: ProjectDocument,
    probePointMm: { x: number; y: number; z: number },
    options?: { maxDistanceMm?: number }
): DetectedBay | null {
    const maxDist = options?.maxDistanceMm || 3000;
    const px = probePointMm.x;
    const py = probePointMm.y;
    const pz = probePointMm.z;

    const faces = collectScenePanelFaces(document);
    if (faces.length === 0) return null;

    let hitLeft: { info: PanelFaceInfo; dist: number } | null = null;
    let hitRight: { info: PanelFaceInfo; dist: number } | null = null;
    let hitBottom: { info: PanelFaceInfo; dist: number } | null = null;
    let hitTop: { info: PanelFaceInfo; dist: number } | null = null;
    let hitBack: { info: PanelFaceInfo; dist: number } | null = null;
    let hitFront: { info: PanelFaceInfo; dist: number } | null = null;

    const tol = 100; // mm tolerancji zasięgu w poprzek

    for (const f of faces) {
        // 1. Lewy bok (szukamy na lewo: X <= px + 20, normalna skierowana w prawo: normal.x > 0.5)
        if (f.worldNormal.x > 0.5 && f.worldCenterMm.x <= px + 20) {
            const dist = Math.max(0, px - f.worldCenterMm.x);
            if (dist < maxDist &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitLeft || dist < hitLeft.dist) {
                    hitLeft = { info: f, dist };
                }
            }
        }

        // 2. Prawy bok (szukamy na prawo: X >= px - 20, normalna skierowana w lewo: normal.x < -0.5)
        if (f.worldNormal.x < -0.5 && f.worldCenterMm.x >= px - 20) {
            const dist = Math.max(0, f.worldCenterMm.x - px);
            if (dist < maxDist &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitRight || dist < hitRight.dist) {
                    hitRight = { info: f, dist };
                }
            }
        }

        // 3. Dno / wieniec dolny / półka (szukamy poniżej: Z <= pz + 20, normalna w górę: normal.z > 0.5)
        if (f.worldNormal.z > 0.5 && f.worldCenterMm.z <= pz + 20) {
            const dist = Math.max(0, pz - f.worldCenterMm.z);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol) {
                if (!hitBottom || dist < hitBottom.dist) {
                    hitBottom = { info: f, dist };
                }
            }
        }

        // 4. Góra / wieniec górny / półka nad (szukamy powyżej: Z >= pz - 20, normalna w dół: normal.z < -0.5)
        if (f.worldNormal.z < -0.5 && f.worldCenterMm.z >= pz - 20) {
            const dist = Math.max(0, f.worldCenterMm.z - pz);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                py >= f.minBoundsMm.y - tol && py <= f.maxBoundsMm.y + tol) {
                if (!hitTop || dist < hitTop.dist) {
                    hitTop = { info: f, dist };
                }
            }
        }

        // 5. Tył / plecy (szukamy z tyłu w CAD: Y >= py - 20, normalna skierowana do przodu szafy: normal.y < -0.5)
        if (f.worldNormal.y < -0.5 && f.worldCenterMm.y >= py - 20) {
            const dist = Math.max(0, f.worldCenterMm.y - py);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitBack || dist < hitBack.dist) {
                    hitBack = { info: f, dist };
                }
            }
        }

        // 6. Przód / front (normalna skierowana w stronę tyłu szafy: normal.y > 0.5, Y <= py + 20)
        if (f.worldNormal.y > 0.5 && f.worldCenterMm.y <= py + 20) {
            const dist = Math.max(0, py - f.worldCenterMm.y);
            if (dist < maxDist &&
                px >= f.minBoundsMm.x - tol && px <= f.maxBoundsMm.x + tol &&
                pz >= f.minBoundsMm.z - tol && pz <= f.maxBoundsMm.z + tol) {
                if (!hitFront || dist < hitFront.dist) {
                    hitFront = { info: f, dist };
                }
            }
        }
    }

    if (!hitLeft || !hitRight || !hitBottom || !hitTop) {
        return null; // Wnęka musi być co najmniej ograniczona z 4 stron (lewo, prawo, dół, góra)
    }

    // Zabezpieczenie przed kliknięciem na pojedynczą formatkę od zewnątrz:
    // Wnęka musi być przestrzenią pomiędzy osobnymi formatkami (lewa !== prawa, dół !== góra)
    if (hitLeft.info.node.id === hitRight.info.node.id || hitBottom.info.node.id === hitTop.info.node.id) {
        return null;
    }
    if (hitLeft.info.node.id === hitBottom.info.node.id || hitLeft.info.node.id === hitTop.info.node.id) {
        return null;
    }
    if (hitRight.info.node.id === hitBottom.info.node.id || hitRight.info.node.id === hitTop.info.node.id) {
        return null;
    }

    const leftX = hitLeft.info.worldCenterMm.x;
    const rightX = hitRight.info.worldCenterMm.x;
    const bottomZ = hitBottom.info.worldCenterMm.z;
    let topZ = hitTop.info.worldCenterMm.z;

    // Korekta lica SKOŚNEGO wieńca górnego:
    // Wieniec górny skośny jest pozycjonowany w loc.z = z_top_center - (tTop/2)*cosBeta.
    // transformMat w collectScenePanelFaces nie uwzględnia obrotu panelu (tylko translację),
    // więc worldCenterMm.z dla FACE_Z_PLUS wynosi localTz - grubosc_wienca/2.
    // Zewnętrzna krawędź dachu w osi wnęki (x=0) leży na z_gora_dachu = localTz + (grubosc/2)*cos(beta).
    // Pełna grubość wieńca w pionie to grubosc / cos(beta).
    // Prawdziwe dolne lico wieńca (sufit wnęki) w osi wnęki leży na:
    // z_dol_wienca = z_gora_dachu - grubosc / cos(beta).
    // Korekta odejmowana od worldCenterMm.z to: (grubosc / cos(beta)) - (grubosc / 2) * (1 + cos(beta)).
    {
        const topNode: any = (hitTop.info as any).node;
        const topPanel: any = (hitTop.info as any).panel;
        const obrot_dachu_deg = Number(topNode?.domainData?.lcs?.rotation?.[2]);
        let cos_kat_skosu: number | null = null;
        if (Number.isFinite(obrot_dachu_deg)) {
            cos_kat_skosu = Math.cos((-obrot_dachu_deg * Math.PI) / 180);
        } else {
            const normalna_z = Math.abs((hitTop.info as any).worldNormal?.z ?? 1);
            if (normalna_z > 1e-6 && normalna_z < 1) cos_kat_skosu = normalna_z;
        }
        let grubosc_wienca_gornego_mm = 0;
        const surowa_grubosc = topPanel?.thickness ?? topNode?.domainData?.thickness;
        if (surowa_grubosc != null && Number.isFinite(Number(surowa_grubosc)) && Number(surowa_grubosc) > 0) {
            // PanelModel.thickness jest w nm (jak width/height); grubość wieńca < 100 mm.
            const grubosc_nm = Number(surowa_grubosc);
            grubosc_wienca_gornego_mm = grubosc_nm > 1000 ? nmToMm(grubosc_nm) : grubosc_nm;
        }
        if (!grubosc_wienca_gornego_mm) grubosc_wienca_gornego_mm = 18;
        if (cos_kat_skosu !== null && cos_kat_skosu > 1e-6 && cos_kat_skosu < 1 - 1e-9) {
            const korekta_pionowa_wienca_mm = (grubosc_wienca_gornego_mm / cos_kat_skosu) - (grubosc_wienca_gornego_mm / 2) * (1 + cos_kat_skosu);
            if (korekta_pionowa_wienca_mm > 0 && korekta_pionowa_wienca_mm < 100) topZ -= korekta_pionowa_wienca_mm;
        }
    }

    // Korpus z boków wnęki — blok działa w zakresie jednego korpusu
    let parentCabinet = findKorpusContainer(hitLeft.info.node, document)
        || findKorpusContainer(hitRight.info.node, document)
        || findKorpusContainer(hitBottom.info.node, document)
        || findKorpusContainer(hitTop.info.node, document);
    if (!parentCabinet && document) {
        for (const child of document.rootNode.children) {
            const found = findKorpusContainer(child, document);
            if (found) {
                parentCabinet = found;
                break;
            }
        }
    }
    const parentCabinetId = parentCabinet?.id;
    const rawCabDepth = (parentCabinet?.domainData as any)?.depth;
    const cabinetDepthMm = rawCabDepth ? nmToMm(rawCabDepth) : undefined;

    // Odrzuć „przód” z innego korpusu (szafa stojąca przed wnęką bez płyty frontowej)
    if (hitFront && parentCabinetId && !isNodeUnderCabinet(hitFront.info.node, parentCabinetId)) {
        hitFront = null;
    }
    if (hitBack && parentCabinetId && !isNodeUnderCabinet(hitBack.info.node, parentCabinetId)) {
        hitBack = null;
    }

    // W CAD: Przód szafy to mniejsze Y (-D/2), Tył to większe Y (+D/2)
    // Brak płyty frontowej w tym korpusie → płaszczyzna ze SmartFrame (-D/2)
    let frontPlaneY: number;
    if (hitFront) {
        frontPlaneY = hitFront.info.worldCenterMm.y;
    } else if (parentCabinet && cabinetDepthMm !== undefined) {
        frontPlaneY = smartFrameFrontPlaneYMm(parentCabinet, cabinetDepthMm);
    } else {
        frontPlaneY = Math.min(hitLeft.info.minBoundsMm.y, hitRight.info.minBoundsMm.y, hitBottom.info.minBoundsMm.y);
    }

    const backY = hitBack
        ? hitBack.info.worldCenterMm.y
        : Math.max(hitLeft.info.maxBoundsMm.y, hitRight.info.maxBoundsMm.y, hitBottom.info.maxBoundsMm.y);

    const width = Math.max(10, rightX - leftX);
    const height = Math.max(10, topZ - bottomZ);
    const depth = Math.max(10, backY - frontPlaneY);

    if (width < 60 || height < 60) {
        return null;
    }

    const centerX = (leftX + rightX) / 2;
    const centerY = (frontPlaneY + backY) / 2;
    let centerZ = (bottomZ + topZ) / 2;

    // Znajdź właściwą ścianę przedniej krawędzi (normalna skierowana w przód: normal.y < -0.5)
    // NIE używamy FACE_X_PLUS jako domyślnej — to ściana boku; Y wychodzi w środku głębokości.
    let frontFaceName: FaceName = 'FACE_Y_MINUS';
    const leftNodeFaces = faces.filter(f => f.node.id === hitLeft!.info.node.id);
    const leftFrontFace = leftNodeFaces.find(f => f.worldNormal.y < -0.5);
    if (leftFrontFace) {
        frontFaceName = leftFrontFace.face;
    } else if (hitFront) {
        frontFaceName = hitFront.info.face;
    }

    // Znajdź właściwą ścianę tylnej krawędzi (normalna skierowana w tył: normal.y > 0.5)
    let backFaceName: FaceName = 'FACE_Z_PLUS';
    if (hitBack) {
        backFaceName = hitBack.info.face;
    } else {
        const leftBackFace = leftNodeFaces.find(f => f.worldNormal.y > 0.5);
        if (leftBackFace) backFaceName = leftBackFace.face;
    }

    const frontRefNode = hitFront
        ? hitFront.info.node
        : (parentCabinetId && document.findNode(parentCabinetId) ? document.findNode(parentCabinetId)! : hitLeft.info.node);
    const backRefNode = hitBack ? hitBack.info.node : hitLeft.info.node;
    let roofAngleDeg = extractRoofAngleDeg(hitTop.info.node, parentCabinet, hitTop.info.worldNormal);
    let heightLeftMm: number | undefined;
    let heightRightMm: number | undefined;
    if (roofAngleDeg && Math.abs(roofAngleDeg) > 0.05) {
        const tanBeta = Math.tan((roofAngleDeg * Math.PI) / 180);
        heightLeftMm = Math.max(10, (topZ - (width / 2) * tanBeta) - bottomZ);
        heightRightMm = Math.max(10, (topZ + (width / 2) * tanBeta) - bottomZ);
    }

    let slopeAxis: 'X' | undefined;

    const gp = (parentCabinet?.domainData as any)?.generatorParams;
    const cabType = String(
        gp?.typ_korpusu ||
        gp?.type ||
        (parentCabinet?.domainData as any)?.typ_korpusu ||
        (parentCabinet?.domainData as any)?.type ||
        parentCabinet?.name ||
        ''
    ).toLowerCase();
    const isSkosnyLr = cabType.includes('skosny_lr') || (cabType.includes('skosny') && (gp?.wysokosc_lewy_mm != null || gp?.wysokosc_prawy_mm != null));
    const isSkosnyFb = !isSkosnyLr && (cabType.includes('skosny') || gp?.wysokosc_przod_mm != null || gp?.wysokosc_tyl_mm != null);

    const originNm = parentCabinet?.getWorldMatrix().transformPoint(new Vec3(0, 0, 0));
    const cabBaseZMm = originNm ? nmToMm(originNm.z) : 0;

    let topRefNode = hitTop.info.node;
    let topRefFace: FaceName = hitTop.info.face;

    if (isSkosnyFb) {
        // Górna płaszczyzna SmartFrame — pozioma płaszczyzna góry korpusu
        const cabHeightMm = gp?.wysokosc_przod_mm ?? gp?.wysokosc_mm ?? ((parentCabinet?.domainData as any)?.height ? nmToMm((parentCabinet.domainData as any).height) : 2200);
        topZ = cabBaseZMm + cabHeightMm;
        centerZ = (bottomZ + topZ) / 2;
        slopeAxis = undefined;
        roofAngleDeg = undefined;
        topRefNode = parentCabinetId && document.findNode(parentCabinetId)
            ? document.findNode(parentCabinetId)!
            : hitTop.info.node;
        topRefFace = 'FACE_Z_MINUS';
    } else if (isSkosnyLr) {
        slopeAxis = 'X';
        const hL = gp?.wysokosc_lewy_mm;
        const hR = gp?.wysokosc_prawy_mm;
        if (hL != null && hR != null && width > 0) {
            roofAngleDeg = (Math.atan2(hR - hL, width) * 180) / Math.PI;
            const tanSlope = Math.tan((roofAngleDeg * Math.PI) / 180);
            heightLeftMm = Math.max(10, (topZ - (width / 2) * tanSlope) - bottomZ);
            heightRightMm = Math.max(10, (topZ + (width / 2) * tanSlope) - bottomZ);
        }
    } else if (roofAngleDeg && Math.abs(roofAngleDeg) > 0.05) {
        slopeAxis = 'X';
    }

    const effectiveHeight = Math.max(10, topZ - bottomZ);

    return {
        boundsMm: { width, height: effectiveHeight, depth },
        boundsNm: { width: mmToNm(width), height: mmToNm(effectiveHeight), depth: mmToNm(depth) },
        centerWorldMm: { x: centerX, y: centerY, z: centerZ },
        parentCabinetId,
        roofAngleDeg,
        slopeAxis,
        heightLeftMm,
        heightRightMm,
        boundary: {
            left: {
                nodeId: hitLeft.info.node.id,
                nodeName: hitLeft.info.node.name,
                face: hitLeft.info.face,
                faceName: hitLeft.info.face,
                worldPointMm: { x: leftX, y: centerY, z: centerZ },
                planeCoordMm: leftX
            },
            right: {
                nodeId: hitRight.info.node.id,
                nodeName: hitRight.info.node.name,
                face: hitRight.info.face,
                faceName: hitRight.info.face,
                worldPointMm: { x: rightX, y: centerY, z: centerZ },
                planeCoordMm: rightX
            },
            bottom: {
                nodeId: hitBottom.info.node.id,
                nodeName: hitBottom.info.node.name,
                face: hitBottom.info.face,
                faceName: hitBottom.info.face,
                worldPointMm: { x: centerX, y: centerY, z: bottomZ },
                planeCoordMm: bottomZ
            },
            top: {
                nodeId: topRefNode.id,
                nodeName: topRefNode.name,
                face: topRefFace,
                faceName: topRefFace,
                worldPointMm: { x: centerX, y: centerY, z: topZ },
                planeCoordMm: topZ,
                slopeAngleDeg: roofAngleDeg
            },
            back: {
                nodeId: backRefNode.id,
                nodeName: hitBack ? hitBack.info.node.name : 'Tylna krawędź',
                face: backFaceName,
                faceName: backFaceName,
                worldPointMm: { x: centerX, y: backY, z: centerZ },
                planeCoordMm: backY
            },
            front: {
                nodeId: frontRefNode.id,
                nodeName: hitFront ? hitFront.info.node.name : 'Przód Korpusu',
                face: frontFaceName,
                faceName: frontFaceName,
                worldPointMm: { x: centerX, y: frontPlaneY, z: centerZ },
                planeCoordMm: frontPlaneY
            },
            frontPlaneYMm: frontPlaneY
        }
    };
}

/**
 * Wykrywa zewnętrzny obrys (gabaryt i ściany zewnętrzne) korpusu szafki dla modułów zewnętrznych (np. Blendy / Obudowa).
 * Szuka skrajnych paneli korpusu (boki zewnętrzne, wieniec dolny/górny, plecy/front) i wylicza pełny gabaryt zewnętrzny W x H x D.
 */
export function detectCabinetOuterHull(
    document: ProjectDocument,
    target?: string | CADNode | { x: number; y: number; z: number }
): DetectedBay | null {
    if (!document) return null;

    const allNodes: CADNode[] = [];
    const traverse = (node: CADNode) => {
        allNodes.push(node);
        for (const child of node.children) traverse(child);
    };
    traverse(document.rootNode);

    // 1. Znajdź docelowy korpus (kontener) lub węzeł
    let cabinetNode: CADNode | null = null;

    if (typeof target === 'string') {
        const found = document.findNode(target) || allNodes.find(n => n.name === target || n.id === target);
        if (found) {
            let curr: CADNode | null = found;
            while (curr && curr.id !== document.rootNode.id) {
                if (curr.domainData?.type === 'container' || (curr.domainData as any)?.generatorParams) {
                    cabinetNode = curr;
                    break;
                }
                curr = curr.parent;
            }
            if (!cabinetNode) cabinetNode = found;
        }
    } else if (target && typeof (target as any).id === 'string' && (target as any).children) {
        let curr: CADNode | null = target as CADNode;
        while (curr && curr.id !== document.rootNode.id) {
            if (curr.domainData?.type === 'container' || (curr.domainData as any)?.generatorParams) {
                cabinetNode = curr;
                break;
            }
            curr = curr.parent;
        }
        if (!cabinetNode) cabinetNode = target as CADNode;
    }

    const faces = collectScenePanelFaces(document);
    if (faces.length === 0) return null;

    // Zbierz wszystkie kontenery korpusów w scenie
    const containers = allNodes.filter(n =>
        n.domainData?.type === 'container' &&
        !(n.domainData as any)?.generatorParams?.boxType &&
        !String((n.domainData as any)?.generatorParams?.type || '').startsWith('blok_')
    );

    if (!cabinetNode) {
        if (target && typeof (target as any).x === 'number') {
            const pt = target as { x: number; y: number; z: number };
            let bestDist = Infinity;
            for (const c of containers) {
                const cFaces = faces.filter(f => {
                    let p: CADNode | null = f.node;
                    while (p) {
                        if (p.id === c.id) return true;
                        p = p.parent;
                    }
                    return false;
                });
                if (cFaces.length === 0) continue;
                const minX = Math.min(...cFaces.map(f => f.minBoundsMm.x));
                const maxX = Math.max(...cFaces.map(f => f.maxBoundsMm.x));
                const minY = Math.min(...cFaces.map(f => f.minBoundsMm.y));
                const maxY = Math.max(...cFaces.map(f => f.maxBoundsMm.y));
                const minZ = Math.min(...cFaces.map(f => f.minBoundsMm.z));
                const maxZ = Math.max(...cFaces.map(f => f.maxBoundsMm.z));

                const cX = (minX + maxX) / 2;
                const cY = (minY + maxY) / 2;
                const cZ = (minZ + maxZ) / 2;
                const dist = Math.hypot(pt.x - cX, pt.y - cY, pt.z - cZ);
                if (dist < bestDist) {
                    bestDist = dist;
                    cabinetNode = c;
                }
            }
        }

        if (!cabinetNode && containers.length > 0) {
            cabinetNode = containers[0];
        }
    }

    // Filtruj ściany tylko dla wybranego korpusu (lub wszystkie sceny jeśli brak kontenera)
    const targetFaces = cabinetNode
        ? faces.filter(f => {
            let p: CADNode | null = f.node;
            while (p) {
                if (p.id === cabinetNode!.id) return true;
                p = p.parent;
            }
            return false;
        })
        : faces;

    if (targetFaces.length === 0) return null;

    // Skrajne współrzędne geometrii w świecie
    const minX = Math.min(...targetFaces.map(f => f.minBoundsMm.x));
    const maxX = Math.max(...targetFaces.map(f => f.maxBoundsMm.x));
    const minY = Math.min(...targetFaces.map(f => f.minBoundsMm.y));
    const maxY = Math.max(...targetFaces.map(f => f.maxBoundsMm.y));
    const minZ = Math.min(...targetFaces.map(f => f.minBoundsMm.z));
    const maxZ = Math.max(...targetFaces.map(f => f.maxBoundsMm.z));

    const cabData = cabinetNode?.domainData as any;
    const width = cabData?.width ? nmToMm(cabData.width) : Math.max(10, maxX - minX);
    const height = cabData?.height ? nmToMm(cabData.height) : Math.max(10, maxZ - minZ);
    const depth = cabData?.depth ? nmToMm(cabData.depth) : Math.max(10, maxY - minY);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Znajdź skrajne panele referencyjne (zewnętrzne lica).
    // Priorytet: rola formatki (BOTTOM/SIDE/TOP), potem geometria —
    // inaczej dół łapie krawędź boku (minZ + normalna −Z) zamiast wieńca.
    const roleOf = (f: PanelFaceInfo) => String(f.panel.role || '').toUpperCase();
    const nameOf = (f: PanelFaceInfo) => String(f.node.name || '').toUpperCase();
    const isBottomRole = (f: PanelFaceInfo) =>
        roleOf(f) === 'BOTTOM_PANEL' || roleOf(f) === 'WIENIEC_D' ||
        nameOf(f).includes('WIENIEC_D') || nameOf(f).includes('WIENIEC DOLNY') || nameOf(f).includes('DNO');
    const isTopRole = (f: PanelFaceInfo) =>
        roleOf(f) === 'TOP_PANEL' || roleOf(f) === 'WIENIEC_G' ||
        nameOf(f).includes('WIENIEC_G') || nameOf(f).includes('WIENIEC GOR');
    const isLeftRole = (f: PanelFaceInfo) =>
        roleOf(f) === 'LEFT_SIDE_PANEL' || roleOf(f) === 'SIDE_LEFT' || roleOf(f) === 'BOK_L' ||
        nameOf(f).includes('BOK_L') || nameOf(f).includes('BOK LEWY');
    const isRightRole = (f: PanelFaceInfo) =>
        roleOf(f) === 'RIGHT_SIDE_PANEL' || roleOf(f) === 'SIDE_RIGHT' || roleOf(f) === 'BOK_P' ||
        nameOf(f).includes('BOK_P') || nameOf(f).includes('BOK PRAW');

    // Lewy bok: formatka przy minX, lico zewnętrzne (normalna −X)
    let leftFace =
        targetFaces.find(f => isLeftRole(f) && f.worldNormal.x < -0.5) ||
        targetFaces.find(f => Math.abs(f.minBoundsMm.x - minX) < 1 && f.worldNormal.x < -0.5);
    if (!leftFace) leftFace = targetFaces.find(f => Math.abs(f.worldCenterMm.x - minX) < 20 && f.face === 'FACE_Z_MINUS') || targetFaces[0];

    // Prawy bok: formatka przy maxX, lico zewnętrzne (normalna +X)
    let rightFace =
        targetFaces.find(f => isRightRole(f) && f.worldNormal.x > 0.5) ||
        targetFaces.find(f => Math.abs(f.maxBoundsMm.x - maxX) < 1 && f.worldNormal.x > 0.5);
    if (!rightFace) rightFace = targetFaces.find(f => Math.abs(f.worldCenterMm.x - maxX) < 20 && f.face === 'FACE_Z_MINUS') || targetFaces[0];

    // Dół: wieniec dolny / spód szafki (NIE krawędź dolna boku)
    let bottomFace =
        targetFaces.find(f => isBottomRole(f) && f.worldNormal.z < -0.5) ||
        targetFaces.find(f => isBottomRole(f) && f.face === 'FACE_Z_MINUS') ||
        targetFaces.find(f => Math.abs(f.minBoundsMm.z - minZ) < 1 && f.worldNormal.z < -0.5 && isBottomRole(f));
    if (!bottomFace) {
        bottomFace = targetFaces.find(f => Math.abs(f.minBoundsMm.z - minZ) < 1 && f.worldNormal.z < -0.5 && !isLeftRole(f) && !isRightRole(f));
    }
    if (!bottomFace) bottomFace = targetFaces.find(f => Math.abs(f.worldCenterMm.z - minZ) < 20 && f.face === 'FACE_Z_MINUS') || targetFaces[0];

    // Góra: wieniec górny
    let topFace =
        targetFaces.find(f => isTopRole(f) && f.worldNormal.z > 0.5) ||
        targetFaces.find(f => isTopRole(f) && f.face === 'FACE_Z_MINUS') ||
        targetFaces.find(f => Math.abs(f.maxBoundsMm.z - maxZ) < 1 && f.worldNormal.z > 0.5 && !isLeftRole(f) && !isRightRole(f));
    if (!topFace) topFace = targetFaces.find(f => Math.abs(f.worldCenterMm.z - maxZ) < 20 && f.face === 'FACE_Z_MINUS') || targetFaces[0];

    // Przód: krawędź frontowa wieńca dolnego (stabilny offset LED), potem dowolna ściana przy minY
    let frontFace =
        targetFaces.find(f => isBottomRole(f) && f.worldNormal.y < -0.5) ||
        targetFaces.find(f => isBottomRole(f) && (f.face === 'FACE_Y_MINUS' || f.face === 'FACE_X_PLUS' || f.face === 'FACE_Y_PLUS')) ||
        targetFaces.find(f => Math.abs(f.minBoundsMm.y - minY) < 1 && f.worldNormal.y < -0.5);
    if (!frontFace) frontFace = targetFaces.find(f => Math.abs(f.worldCenterMm.y - minY) < 20) || leftFace;

    // Tył: szukaj pleców (BACK_PANEL) lub tylnej krawędzi przy maxY
    let backFace = targetFaces.find(f => (f.panel as any)?.role === 'BACK_PANEL' || (f.node as any)?.domainData?.role === 'BACK_PANEL' || (f.node as any)?.role === 'BACK_PANEL');
    if (!backFace) backFace = targetFaces.find(f => Math.abs(f.maxBoundsMm.y - maxY) < 1 && f.worldNormal.y > 0.5);
    if (!backFace) backFace = targetFaces.find(f => Math.abs(f.worldCenterMm.y - maxY) < 20) || leftFace;

    const isBackPanel = (backFace.panel as any)?.role === 'BACK_PANEL' || (backFace.node as any)?.domainData?.role === 'BACK_PANEL' || (backFace.node as any)?.role === 'BACK_PANEL';
    const backFaceName: FaceName = isBackPanel ? 'FACE_Z_MINUS' : 'FACE_Y_PLUS';

    // Front LED: jeśli znaleziono ścianę wieńca z normalną −Y, użyj jej prawdziwej nazwy
    const frontFaceName: FaceName =
        frontFace.worldNormal.y < -0.5
            ? (frontFace.face as FaceName)
            : 'FACE_Y_MINUS';

    return {
        boundsMm: { width, height, depth },
        boundsNm: { width: mmToNm(width), height: mmToNm(height), depth: mmToNm(depth) },
        centerWorldMm: { x: centerX, y: centerY, z: centerZ },
        parentCabinetId: cabinetNode?.id,
        boundary: {
            left: {
                nodeId: leftFace.node.id,
                nodeName: leftFace.node.name || 'Bok Lewy (Zewnętrzny)',
                face: 'FACE_Z_MINUS',
                faceName: 'FACE_Z_MINUS',
                worldPointMm: { x: minX, y: centerY, z: centerZ },
                planeCoordMm: minX
            },
            right: {
                nodeId: rightFace.node.id,
                nodeName: rightFace.node.name || 'Bok Prawy (Zewnętrzny)',
                face: 'FACE_Z_MINUS',
                faceName: 'FACE_Z_MINUS',
                worldPointMm: { x: maxX, y: centerY, z: centerZ },
                planeCoordMm: maxX
            },
            bottom: {
                nodeId: bottomFace.node.id,
                nodeName: bottomFace.node.name || 'Dół (Zewnętrzny)',
                face: 'FACE_Z_MINUS',
                faceName: 'FACE_Z_MINUS',
                worldPointMm: { x: centerX, y: centerY, z: minZ },
                planeCoordMm: minZ
            },
            top: {
                nodeId: topFace.node.id,
                nodeName: topFace.node.name || 'Góra (Zewnętrzny)',
                face: 'FACE_Z_MINUS',
                faceName: 'FACE_Z_MINUS',
                worldPointMm: { x: centerX, y: centerY, z: maxZ },
                planeCoordMm: maxZ
            },
            back: {
                nodeId: backFace.node.id,
                nodeName: backFace.node.name || 'Tył (Zewnętrzny)',
                face: backFaceName,
                faceName: backFaceName,
                worldPointMm: { x: centerX, y: maxY, z: centerZ },
                planeCoordMm: maxY
            },
            front: {
                nodeId: frontFace.node.id,
                nodeName: frontFace.node.name || 'Przód (Zewnętrzny)',
                face: frontFaceName,
                faceName: frontFaceName,
                worldPointMm: { x: centerX, y: minY, z: centerZ },
                planeCoordMm: minY
            },
            frontPlaneYMm: minY
        }
    };
}

/**
 * Wykrywa wnękę meblową za pomocą bezpośredniego raycastingu 3D na fizycznej geometrii w scenie Babylon.js.
 * Wypuszcza promienie z punktu kliknięcia w 6 kierunkach:
 * - Lewo (-X) / Prawo (+X)
 * - Dół (-Y) / Góra (+Y)
 * - Tył (+Z) / Przód (-Z)
 * 
 * Dla trybu 'external' (np. blendy/obudowa) wyznacza zewnętrzny gabaryt całego korpusu.
 */
export function probeBayFromSceneRay(
    scene: any,
    pickResult: any,
    document: ProjectDocument,
    mode: 'internal' | 'external' = 'internal'
): DetectedBay | null {
    if (mode === 'external') {
        const pickedMesh = pickResult?.pickedMesh;
        const targetId = pickedMesh?.metadata?.panelModel?.id || pickedMesh?.parent?.name || pickedMesh?.name;
        const targetPoint = pickResult?.pickedPoint ? {
            x: pickResult.pickedPoint.x,
            y: pickResult.pickedPoint.z, // Babylon Z = CAD Y
            z: pickResult.pickedPoint.y  // Babylon Y = CAD Z
        } : undefined;
        return detectCabinetOuterHull(document, targetId || targetPoint);
    }

    const B = typeof window !== 'undefined' && (window as any).BABYLON ? (window as any).BABYLON : (globalThis as any).BABYLON;
    if (!scene || !pickResult || !pickResult.hit || !pickResult.pickedPoint || !B) return null;

    const p = pickResult.pickedPoint.clone();
    let norm = pickResult.getNormal ? pickResult.getNormal(true) : null;
    if (!norm || norm.length() < 0.1) {
        norm = new B.Vector3(0, 1, 0);
    } else {
        norm = norm.normalize();
    }

    // Odsunięcie punktu startowego o 6 mm w stronę wnętrza wnęki (wzdłuż normalnej trafienia)
    let origin = p.add(norm.scale(6));

    const predicate = (m: any) => {
        if (!m || !m.isPickable || !m.isVisible) return false;
        const name = m.name || '';
        if (
            name.includes('ground') ||
            name.includes('grid') ||
            name.includes('blok_plane') ||
            name.includes('blok_bay') ||
            name.includes('gizmo') ||
            name.includes('helper') ||
            name.includes('axis') ||
            name.includes('highlight') ||
            name.includes('preview')
        ) {
            return false;
        }

        const panelModel = m.metadata?.panelModel || m.metadata?.model;
        let role = String(panelModel?.role || m.metadata?.role || '').toUpperCase();
        let docNode: CADNode | null = null;
        if (panelModel && document) {
            docNode = document.findNode(panelModel.id);
            if (docNode) {
                const nodeRole = String((docNode.domainData as any)?.role || '').toUpperCase();
                if (nodeRole) role = nodeRole;
            }
        }
        if (!docNode && m.parent && document) {
            const allPanels = typeof (document as any).getPanels === 'function' ? (document as any).getPanels() : [];
            const found = allPanels.find((n: any) => n.name === m.parent.name || n.id === m.parent.name);
            if (found) {
                docNode = found;
                const nodeRole = String((found.domainData as any)?.role || '').toUpperCase();
                if (nodeRole) role = nodeRole;
            }
        }

        const isDividing = isBayDividingPanel(role, name || docNode?.name);

        if (!isDividing && (name.endsWith('_SB') || name.includes('bloki'))) {
            return false;
        }
        // Fronty szafek oraz dzieci modułów bloki (z wyjątkiem przegród dzielących wnęki) nie tworzą korpusu wnęki
        if (role === 'FRONT') return false;

        if (docNode && !isDividing) {
            let parent = docNode.parent;
            while (parent && parent.id !== document.rootNode.id) {
                const gp = (parent.domainData as any)?.generatorParams;
                if (gp && (gp.boxType || String(gp.type || '').startsWith('blok_'))) {
                    return false;
                }
                parent = parent.parent;
            }
        }

        if (m.metadata?.isBlokChild && !isDividing) {
            return false;
        }
        return true;
    };

    const resolveNode = (
        hit: any,
        fallbackFace: FaceName,
        dir?: 'LEFT' | 'RIGHT' | 'BOTTOM' | 'TOP' | 'FRONT' | 'BACK'
    ): { id: string; name: string; face: FaceName } => {
        if (!hit || !hit.hit || !hit.pickedMesh) {
            return { id: '', name: '', face: fallbackFace };
        }
        const m = hit.pickedMesh;
        let id = '';
        let name = '';
        let face: FaceName = fallbackFace;
        let role = '';

        if (m.metadata?.panelModel && document) {
            const node = document.findNode(m.metadata.panelModel.id);
            if (node) {
                id = node.id;
                name = node.name;
                role = String((node.domainData as any)?.role || '');
            } else {
                id = m.metadata.panelModel.id;
                name = m.metadata.panelModel.name || '';
                role = String(m.metadata.panelModel.role || '');
            }
        }
        if (!id && m.parent) {
            name = m.parent.name || '';
            if (document) {
                const allPanels = typeof (document as any).getPanels === 'function' ? (document as any).getPanels() : [];
                const found = allPanels.find((n: any) => n.name === name || n.id === name);
                if (found) {
                    id = found.id;
                    role = String((found.domainData as any)?.role || '');
                }
            }
        }
        if (!role && m.metadata?.role) {
            role = String(m.metadata.role);
        }

        if (m.metadata?.faceName) {
            const rawFace = String(m.metadata.faceName).trim();
            if (rawFace.toUpperCase().startsWith('OUTLINE_')) {
                const edgeKey = m.metadata.outlineEdgeKey;
                const mapped: FaceName = edgeKey === '+X' ? 'FACE_X_PLUS'
                    : edgeKey === '-X' ? 'FACE_X_MINUS'
                    : edgeKey === '+Y' ? 'FACE_Y_PLUS'
                    : edgeKey === '-Y' ? 'FACE_Y_MINUS'
                    : fallbackFace;
                face = mapped;
            } else {
                try {
                    face = normalizeFaceName(rawFace);
                } catch {
                    face = fallbackFace;
                }
            }
        } else {
            const isDivider = isBayDividingPanel(role, name) &&
                (role.toUpperCase().includes('DIVIDER') || name.toUpperCase().includes('PRZEGRODA'));
            if (isDivider && dir === 'LEFT') {
                face = 'FACE_Z_MINUS';
            } else {
                face = fallbackFace;
            }
        }
        return { id: id || m.id || '', name: name || m.name || '', face };
    };

    const maxDist = 3500;
    let hitLeft = scene.pickWithRay(new B.Ray(origin, new B.Vector3(-1, 0, 0), maxDist), predicate, false);
    let hitRight = scene.pickWithRay(new B.Ray(origin, new B.Vector3(1, 0, 0), maxDist), predicate, false);
    let hitBottom = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, -1, 0), maxDist), predicate, false);
    let hitBack = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, 0, 1), maxDist), predicate, false);
    let hitFront = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, 0, -1), maxDist), predicate, false);

    // Fallback gdy punkt leżał na dnie lub ściance i odsunięcie poszło w stronę ściany
    if (!hitBottom?.hit || !hitLeft?.hit || !hitRight?.hit) {
        const altOrigin = p.subtract(norm.scale(6));
        const altHitLeft = !hitLeft?.hit ? scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(-1, 0, 0), maxDist), predicate, false) : hitLeft;
        const altHitRight = !hitRight?.hit ? scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(1, 0, 0), maxDist), predicate, false) : hitRight;
        const altHitBottom = !hitBottom?.hit ? scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(0, -1, 0), maxDist), predicate, false) : hitBottom;

        if (altHitLeft?.hit) hitLeft = altHitLeft;
        if (altHitRight?.hit) hitRight = altHitRight;
        if (altHitBottom?.hit) hitBottom = altHitBottom;
    }

    if (!hitLeft?.hit || !hitRight?.hit || !hitBottom?.hit) {
        return null;
    }

    const leftInfo = resolveNode(hitLeft, 'FACE_Z_PLUS', 'LEFT');
    const rightInfo = resolveNode(hitRight, 'FACE_Z_PLUS', 'RIGHT');
    const bottomInfo = resolveNode(hitBottom, 'FACE_Z_PLUS', 'BOTTOM');
    const backInfo = resolveNode(hitBack, 'FACE_Z_PLUS', 'BACK');
    const frontInfo = resolveNode(hitFront, 'FACE_Y_MINUS', 'FRONT');

    // Korpus z boków wnęki — blok w zakresie jednego korpusu
    const sideNode = (leftInfo.id ? document.findNode(leftInfo.id) : null)
        || (rightInfo.id ? document.findNode(rightInfo.id) : null)
        || (bottomInfo.id ? document.findNode(bottomInfo.id) : null)
        || (pickResult?.pickedMesh?.metadata?.panelModel?.id ? document.findNode(pickResult.pickedMesh.metadata.panelModel.id) : null);
    let parentCabinet = findKorpusContainer(sideNode, document);
    if (!parentCabinet && document) {
        for (const child of document.rootNode.children) {
            const found = findKorpusContainer(child, document);
            if (found) {
                parentCabinet = found;
                break;
            }
        }
    }
    const parentCabinetId = parentCabinet?.id;
    const gp = (parentCabinet?.domainData as any)?.generatorParams;
    const cabType = String(
        gp?.typ_korpusu ||
        gp?.type ||
        (parentCabinet?.domainData as any)?.typ_korpusu ||
        (parentCabinet?.domainData as any)?.type ||
        parentCabinet?.name ||
        ''
    ).toLowerCase();
    const isSkosnyLr = cabType.includes('skosny_lr') || (cabType.includes('skosny') && (gp?.wysokosc_lewy_mm != null || gp?.wysokosc_prawy_mm != null));
    const isSkosnyFb = !isSkosnyLr && (cabType.includes('skosny') || gp?.wysokosc_przod_mm != null || gp?.wysokosc_tyl_mm != null);

    const leftX = hitLeft.pickedPoint.x;
    const rightX = hitRight.pickedPoint.x;
    const bayCenterX = (leftX + rightX) / 2;

    const initialBottomY = hitBottom.pickedPoint.y;
    const safeStartY = initialBottomY + 10;
    const centerOrigin = new B.Vector3(bayCenterX, safeStartY, origin.z);

    const centerHitBottom = scene.pickWithRay(new B.Ray(centerOrigin, new B.Vector3(0, -1, 0), maxDist), predicate, false);
    if (centerHitBottom?.hit) hitBottom = centerHitBottom;
    const bottomY = hitBottom.pickedPoint.y;

    const cabOriginNm = parentCabinet?.getWorldMatrix().transformPoint(new Vec3(0, 0, 0));
    const cabBaseYMm = cabOriginNm ? nmToMm(cabOriginNm.z) : 0; // Babylon Y = CAD Z

    let hitTop: any = null;
    let topY: number;
    let topInfo: { id: string; name: string; face: FaceName };
    let heightLeftMm: number | undefined;
    let heightRightMm: number | undefined;
    let measuredAngleDeg: number | undefined;

    if (isSkosnyFb) {
        // Dla skosu w głąb: ZERO raycastu do skośnego wieńca! Na sztywno bierzemy top SmartFrame.
        const cabHeightMm = gp?.wysokosc_przod_mm ?? gp?.wysokosc_mm ?? ((parentCabinet?.domainData as any)?.height ? nmToMm((parentCabinet.domainData as any).height) : 2200);
        topY = cabBaseYMm + cabHeightMm;
        topInfo = {
            id: parentCabinetId || '',
            name: parentCabinet?.name || 'Góra Korpusu',
            face: 'FACE_Z_MINUS'
        };
    } else {
        hitTop = scene.pickWithRay(new B.Ray(origin, new B.Vector3(0, 1, 0), maxDist), predicate, false);
        if (!hitTop?.hit) {
            const altOrigin = p.subtract(norm.scale(6));
            const altHitTop = scene.pickWithRay(new B.Ray(altOrigin, new B.Vector3(0, 1, 0), maxDist), predicate, false);
            if (altHitTop?.hit) hitTop = altHitTop;
        }
        if (!hitTop?.hit) {
            return null;
        }

        const centerHitTop = scene.pickWithRay(new B.Ray(centerOrigin, new B.Vector3(0, 1, 0), maxDist), predicate, false);
        if (centerHitTop?.hit) hitTop = centerHitTop;
        topY = hitTop.pickedPoint.y;

        // Dokładny pomiar wysokości dachu przy lewej i prawej ścianie wnęki (dla skosu LR)
        const probeMargin = Math.min(20, Math.max(5, (rightX - leftX) * 0.05));
        const rayLeft = new B.Ray(new B.Vector3(leftX + probeMargin, safeStartY, origin.z), new B.Vector3(0, 1, 0), maxDist);
        const rayRight = new B.Ray(new B.Vector3(rightX - probeMargin, safeStartY, origin.z), new B.Vector3(0, 1, 0), maxDist);
        const hitTopLeft = scene.pickWithRay(rayLeft, predicate, false);
        const hitTopRight = scene.pickWithRay(rayRight, predicate, false);

        if (hitTopLeft?.hit && hitTopRight?.hit) {
            const dx = (rightX - probeMargin) - (leftX + probeMargin);
            const dy = hitTopRight.pickedPoint.y - hitTopLeft.pickedPoint.y;
            const slope = dx !== 0 ? dy / dx : 0;
            const yTopLeftMeasured = hitTopLeft.pickedPoint.y - probeMargin * slope;
            const yTopRightMeasured = hitTopRight.pickedPoint.y + probeMargin * slope;
            heightLeftMm = Math.max(10, yTopLeftMeasured - bottomY);
            heightRightMm = Math.max(10, yTopRightMeasured - bottomY);
            if (Math.abs(dy) > 1) {
                measuredAngleDeg = (Math.atan(slope) * 180) / Math.PI;
            }
        }

        topInfo = resolveNode(hitTop, 'FACE_Z_MINUS', 'TOP');
    }

    // Minimalne wymiary wnęki (min 60 mm szerokości i wysokości)
    if (Math.abs(rightX - leftX) < 60 || Math.abs(topY - bottomY) < 60) {
        return null;
    }

    // Zabezpieczenie przed upuszczeniem/kliknięciem na pojedynczą formatkę od zewnątrz:
    if (!leftInfo.id || !rightInfo.id || !bottomInfo.id || !topInfo.id) {
        return null;
    }
    if (leftInfo.id === rightInfo.id || bottomInfo.id === topInfo.id) {
        return null;
    }
    if (leftInfo.id === bottomInfo.id || leftInfo.id === topInfo.id) {
        return null;
    }
    if (rightInfo.id === bottomInfo.id || rightInfo.id === topInfo.id) {
        return null;
    }

    const rawCabDepth = (parentCabinet?.domainData as any)?.depth;
    const cabinetDepthMm = rawCabDepth ? nmToMm(rawCabDepth) : undefined;

    // Odrzuć trafienie przodu/tyłu spoza tego korpusu (np. szafa stojąca przed wnęką)
    const frontNode = frontInfo.id ? document.findNode(frontInfo.id) : null;
    const backNode = backInfo.id ? document.findNode(backInfo.id) : null;
    const frontInCabinet = !!(hitFront?.hit && isNodeUnderCabinet(frontNode, parentCabinetId));
    const backInCabinet = !!(hitBack?.hit && isNodeUnderCabinet(backNode, parentCabinetId));

    const refMesh = hitLeft.pickedMesh || hitRight.pickedMesh;
    const refBb = refMesh?.getBoundingInfo()?.boundingBox;

    let backZ = backInCabinet ? hitBack.pickedPoint.z : (refBb ? refBb.maximumWorld.z : p.z + 300);
    let frontZ: number;
    let frontFace: FaceName = frontInfo.face;
    if (frontInCabinet) {
        frontZ = hitFront.pickedPoint.z;
    } else if (parentCabinet && cabinetDepthMm !== undefined) {
        // Brak płyty frontowej w tym korpusie → płaszczyzna ze SmartFrame (−D/2)
        frontZ = smartFrameFrontPlaneYMm(parentCabinet, cabinetDepthMm);
        frontFace = 'FACE_Y_MINUS';
    } else {
        frontZ = refBb ? refBb.minimumWorld.z : p.z - 300;
        frontFace = 'FACE_Y_MINUS';
    }

    if (frontZ > backZ) {
        const tmp = frontZ;
        frontZ = backZ;
        backZ = tmp;
    }

    const width = Math.max(10, Math.abs(rightX - leftX));
    const depth = Math.max(10, Math.abs(backZ - frontZ));

    const centerX = (leftX + rightX) / 2;
    let centerY = (bottomY + topY) / 2; // Babylon Y = CAD Z (wysokość)
    const centerZ = (frontZ + backZ) / 2; // Babylon Z = CAD Y (głębokość)

    const slopeAxis: 'X' | undefined = (isSkosnyLr && heightLeftMm !== undefined && heightRightMm !== undefined && Math.abs(heightRightMm - heightLeftMm) > 1) ? 'X' : undefined;
    const effectiveHeight = Math.max(10, topY - bottomY);

    const frontRefId = frontInCabinet ? frontInfo.id : (parentCabinetId || frontInfo.id || leftInfo.id);
    const frontRefName = frontInCabinet ? (frontInfo.name || 'Przód') : 'Przód Korpusu';
    const backRefId = backInCabinet ? backInfo.id : leftInfo.id;
    const backRefName = backInCabinet ? (backInfo.name || 'Tył') : 'Tył';
    const backFace = backInfo.face;

    const topNode = topInfo.id ? (document.findNode(topInfo.id) || null) : null;
    let topNormalCAD: Vec3 | undefined;
    if (hitTop?.getNormal) {
        const bn = hitTop.getNormal(true);
        if (bn) {
            topNormalCAD = new Vec3(bn.x, bn.z, bn.y);
        }
    }
    const roofAngleDeg = isSkosnyFb ? undefined : (extractRoofAngleDeg(topNode, parentCabinet, topNormalCAD) ?? measuredAngleDeg);

    const topRefId = isSkosnyFb && parentCabinetId ? parentCabinetId : topInfo.id;
    const topRefName = isSkosnyFb && parentCabinet ? (parentCabinet.name || 'Góra Korpusu') : (topInfo.name || 'Góra');
    const topFaceName: FaceName = isSkosnyFb ? 'FACE_Z_MINUS' : topInfo.face;

    return {
        boundsMm: { width, height: effectiveHeight, depth },
        boundsNm: { width: mmToNm(width), height: mmToNm(effectiveHeight), depth: mmToNm(depth) },
        centerWorldMm: { x: centerX, y: centerZ, z: centerY },
        parentCabinetId,
        roofAngleDeg,
        slopeAxis,
        heightLeftMm,
        heightRightMm,
        boundary: {
            left: {
                nodeId: leftInfo.id,
                nodeName: leftInfo.name || 'Bok Lewy',
                face: leftInfo.face,
                faceName: leftInfo.face,
                worldPointMm: { x: leftX, y: centerZ, z: centerY },
                planeCoordMm: leftX
            },
            right: {
                nodeId: rightInfo.id,
                nodeName: rightInfo.name || 'Bok Prawy',
                face: rightInfo.face,
                faceName: rightInfo.face,
                worldPointMm: { x: rightX, y: centerZ, z: centerY },
                planeCoordMm: rightX
            },
            bottom: {
                nodeId: bottomInfo.id,
                nodeName: bottomInfo.name || 'Dół',
                face: bottomInfo.face,
                faceName: bottomInfo.face,
                worldPointMm: { x: centerX, y: centerZ, z: bottomY },
                planeCoordMm: bottomY
            },
            top: {
                nodeId: topRefId,
                nodeName: topRefName,
                face: topFaceName,
                faceName: topFaceName,
                worldPointMm: { x: centerX, y: centerZ, z: topY },
                planeCoordMm: topY,
                slopeAngleDeg: roofAngleDeg
            },
            back: {
                nodeId: backRefId,
                nodeName: backRefName,
                face: backFace,
                faceName: backFace,
                worldPointMm: { x: centerX, y: backZ, z: centerY },
                planeCoordMm: backZ
            },
            front: {
                nodeId: frontRefId,
                nodeName: frontRefName,
                face: frontFace,
                faceName: frontFace,
                worldPointMm: { x: centerX, y: frontZ, z: centerY },
                planeCoordMm: frontZ
            },
            frontPlaneYMm: frontZ
        }
    };
}
