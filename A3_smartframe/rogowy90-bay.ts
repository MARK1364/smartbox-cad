/**
 * rogowy90-bay.ts — wykrywanie wnęki Bloki dla korpusu L (korpus_rogowy90).
 *
 * Generic ray probe traktuje L jak prosty AABB i łapie wcięcie narożnika / listwę
 * zamiast ścian ramion — stąd „połowa” szafki. Tu wybieramy ramię X lub Y
 * i wiążemy granice z side_references (PLECY_X/Y, BOK_L/BOK_P, wieńce).
 */
import type { DetectedBay, FaceHitRef } from '../A2_bloki/02_bloki-bay-detector.js';
import { ProjectDocument } from '../A1_core/project-document.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { PanelModel } from '../A4_smartpanel/panel-model.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';

const DEFAULT_BOK_MM = 18;
const DEFAULT_BACK_MM = 3;
const DEFAULT_WIENIEC_MM = 18;

type RogowyArm = 'X' | 'Y';

function isRogowy90Cabinet(node: CADNode): boolean {
    const gp = (node.domainData as any)?.generatorParams;
    const t = String(gp?.type || '').toLowerCase();
    return t === 'korpus_rogowy90' || t.includes('rogowy90') || t.includes('rogowy_90');
}

function isBlokiSubtree(node: CADNode): boolean {
    const d = node.domainData as any;
    const gp = d?.generatorParams;
    return Boolean(
        d?.type === 'bloki' ||
        d?.type === 'bloki_container' ||
        String(gp?.type ?? '').startsWith('bloki') ||
        Boolean(gp?.boxType)
    );
}

function panelThicknessMm(node: CADNode | null, fallback: number): number {
    if (!node) return fallback;
    const p = node.domainData as PanelModel;
    const t = p?.thickness;
    return t ? nmToMm(t) : fallback;
}

function findRogowyPanel(cabinetNode: CADNode, ...keySuffixes: string[]): CADNode | null {
    for (const keySuffix of keySuffixes) {
        let found: CADNode | null = null;
        const suffix = keySuffix.toUpperCase();
        const walk = (node: CADNode) => {
            if (found) return;
            if (isBlokiSubtree(node)) return;
            const d = node.domainData as any;
            if (d && (d.type === 'panel' || d.type === 'part')) {
                const key = String(d.key || node.name || '').toUpperCase();
                if (key === suffix || key.endsWith(`_${suffix}`) || key.endsWith(suffix)) {
                    found = node;
                    return;
                }
            }
            for (const child of node.children) walk(child);
        };
        walk(cabinetNode);
        if (found) return found;
    }
    return null;
}

function cabLocalToWorldMm(cab: CADNode, lx: number, ly: number, lz: number): { x: number; y: number; z: number } {
    const w = cab.getWorldMatrix().transformPoint(new Vec3(mmToNm(lx), mmToNm(ly), mmToNm(lz)));
    return { x: nmToMm(w.x), y: nmToMm(w.y), z: nmToMm(w.z) };
}

function probeToCabLocalMm(cab: CADNode, probeMm: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const inv = cab.getWorldMatrix().invert();
    const local = inv.transformPoint(new Vec3(mmToNm(probeMm.x), mmToNm(probeMm.y), mmToNm(probeMm.z)));
    return { x: nmToMm(local.x), y: nmToMm(local.y), z: nmToMm(local.z) };
}

function findRogowy90CabinetAtPoint(doc: ProjectDocument, probeMm: { x: number; y: number; z: number }): CADNode | null {
    const candidates: CADNode[] = [];
    const walk = (node: CADNode) => {
        if (isRogowy90Cabinet(node)) candidates.push(node);
        for (const child of node.children) walk(child);
    };
    walk(doc.rootNode);

    for (const cab of candidates) {
        const gp = (cab.domainData as any)?.generatorParams || {};
        const W = nmToMm((cab.domainData as any).width || mmToNm(900));
        const D = nmToMm((cab.domainData as any).depth || mmToNm(900));
        const H = nmToMm((cab.domainData as any).height || mmToNm(720));
        const bokLewy = Number(gp.glebokosc_boku_lewego_mm ?? 600);
        const bokPrawy = Number(gp.glebokosc_boku_prawego_mm ?? bokLewy);

        const plecyX = findRogowyPanel(cab, 'PLECY_X');
        const bokP = findRogowyPanel(cab, 'BOK_P', 'BOK_X');
        const bokL = findRogowyPanel(cab, 'BOK_L', 'BOK_Y');
        const plecyY = findRogowyPanel(cab, 'PLECY_Y');
        const bottom = findRogowyPanel(cab, 'WIENIEC_D') || findRogowyPanel(cab, 'BOTTOM');

        const backThX = panelThicknessMm(plecyX, DEFAULT_BACK_MM);
        const backThY = panelThicknessMm(plecyY, DEFAULT_BACK_MM);
        const bokTh = panelThicknessMm(bokP, DEFAULT_BOK_MM);
        const wieniecTh = panelThicknessMm(bottom, DEFAULT_WIENIEC_MM);

        const xL = -W / 2 + backThX;
        const xR = W / 2 - bokTh;
        const yF = -D / 2 + bokTh;
        const yB = D / 2 - backThY;
        const zB = wieniecTh;
        const zT = H - wieniecTh;

        const local = probeToCabLocalMm(cab, probeMm);
        if (
            local.x >= xL - 5 && local.x <= xR + 5 &&
            local.y >= yF - 5 && local.y <= yB + 5 &&
            local.z >= zB - 5 && local.z <= zT + 5
        ) {
            return cab;
        }
        void bokPrawy;
    }
    return null;
}

function makeFaceRef(
    panelNode: CADNode,
    face: FaceName,
    planeCoordMm: number,
    worldPointMm: { x: number; y: number; z: number }
): FaceHitRef {
    return {
        nodeId: panelNode.id,
        nodeName: panelNode.name,
        face,
        faceName: face,
        worldPointMm,
        planeCoordMm
    };
}

function resolveArm(localPx: number, cornerX: number): RogowyArm {
    return localPx < cornerX ? 'Y' : 'X';
}

/**
 * Wykrywa prostokątną wnękę ramienia X lub Y w korpusie Rogowy90.
 * Zwraca null, gdy punkt nie leży w szafce L — wtedy fallback to generic probe.
 */
export function probeRogowy90BayFromCADPoint(
    document: ProjectDocument,
    probePointMm: { x: number; y: number; z: number }
): DetectedBay | null {
    const cab = findRogowy90CabinetAtPoint(document, probePointMm);
    if (!cab) return null;

    const gp = (cab.domainData as any)?.generatorParams || {};
    const W = nmToMm((cab.domainData as any).width || mmToNm(900));
    const D = nmToMm((cab.domainData as any).depth || mmToNm(900));
    const H = nmToMm((cab.domainData as any).height || mmToNm(720));
    const bokLewy = Math.max(50, Number(gp.glebokosc_boku_lewego_mm ?? 600));
    const bokPrawy = Math.max(50, Number(gp.glebokosc_boku_prawego_mm ?? bokLewy));

    const plecyX = findRogowyPanel(cab, 'PLECY_X');
    const plecyY = findRogowyPanel(cab, 'PLECY_Y');
    const bokP = findRogowyPanel(cab, 'BOK_P', 'BOK_X');
    const bokL = findRogowyPanel(cab, 'BOK_L', 'BOK_Y');
    const bottom = findRogowyPanel(cab, 'WIENIEC_D') || findRogowyPanel(cab, 'BOTTOM');
    const top = findRogowyPanel(cab, 'WIENIEC_G') || findRogowyPanel(cab, 'TOP');

    if (!plecyX || !plecyY || !bokP || !bokL || !bottom || !top) return null;

    const backThX = panelThicknessMm(plecyX, DEFAULT_BACK_MM);
    const backThY = panelThicknessMm(plecyY, DEFAULT_BACK_MM);
    const bokTh = panelThicknessMm(bokP, DEFAULT_BOK_MM);
    const wieniecTh = panelThicknessMm(bottom, DEFAULT_WIENIEC_MM);

    const xLeft = -W / 2 + backThX;
    const xRightFull = W / 2 - bokTh;
    const yFront = -D / 2 + bokTh;
    const yBack = D / 2 - backThY;
    const zBottom = wieniecTh;
    const zTop = H - wieniecTh;

    // Narożnik wnęki L (koniec boku lewego wzdłuż X) — granica między ramionami.
    const cornerX = -W / 2 + bokLewy;
    const xRightYArm = cornerX - bokTh;

    const local = probeToCabLocalMm(cab, probePointMm);
    const arm = resolveArm(local.x, cornerX);
    void bokPrawy;

    const xRight = arm === 'X' ? xRightFull : xRightYArm;
    const width = Math.max(10, xRight - xLeft);
    const height = Math.max(10, zTop - zBottom);
    const depth = Math.max(10, yBack - yFront);

    if (width < 60 || height < 60 || depth < 60) return null;

    const cx = (xLeft + xRight) / 2;
    const cy = (yFront + yBack) / 2;
    const cz = (zBottom + zTop) / 2;

    const centerWorld = cabLocalToWorldMm(cab, cx, cy, cz);
    const leftWorld = cabLocalToWorldMm(cab, xLeft, cy, cz);
    const rightWorld = cabLocalToWorldMm(cab, xRight, cy, cz);
    const bottomWorld = cabLocalToWorldMm(cab, cx, cy, zBottom);
    const topWorld = cabLocalToWorldMm(cab, cx, cy, zTop);
    const frontWorld = cabLocalToWorldMm(cab, cx, yFront, cz);
    const backWorld = cabLocalToWorldMm(cab, cx, yBack, cz);

    const rightPanel = arm === 'X' ? bokP : bokL;
    const rightFace: FaceName = arm === 'X' ? 'FACE_Z_PLUS' : 'FACE_X_PLUS';

    return {
        boundsMm: { width, height, depth },
        boundsNm: { width: mmToNm(width), height: mmToNm(height), depth: mmToNm(depth) },
        centerWorldMm: centerWorld,
        parentCabinetId: cab.id,
        boundary: {
            left: makeFaceRef(plecyX, 'FACE_Z_PLUS', leftWorld.x, leftWorld),
            right: makeFaceRef(rightPanel, rightFace, rightWorld.x, rightWorld),
            bottom: makeFaceRef(bottom, 'FACE_Z_PLUS', bottomWorld.z, bottomWorld),
            // INNER spód WIENIEC_G — zgodne z zTop = H − grubość (fioletowa wnęka)
            top: makeFaceRef(top, 'FACE_Z_PLUS', topWorld.z, topWorld),
            back: makeFaceRef(plecyY, 'FACE_Z_PLUS', backWorld.y, backWorld),
            front: makeFaceRef(bokL, 'FACE_Z_PLUS', frontWorld.y, frontWorld),
            frontPlaneYMm: frontWorld.y
        }
    };
}
