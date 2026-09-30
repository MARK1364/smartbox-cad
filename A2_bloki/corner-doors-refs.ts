/**
 * Referencje drzwi narożnych — jeden domyślny układ (wcięcie L wieńca).
 */
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import type { FaceName } from '../A4_smartpanel/panel-model.js';

export type CornerAt = 'innerL_wieniec';

export type CornerDoorsRefSlot = {
    partKey: string;
    face: FaceName;
    panelId: string;
};

export type CornerDoorsCustomReferences = {
    xMin?: CornerDoorsRefSlot;
    xMax: CornerDoorsRefSlot;
    yMin: CornerDoorsRefSlot;
    yMax?: CornerDoorsRefSlot;
    zMin: CornerDoorsRefSlot;
    zMax: CornerDoorsRefSlot;
};

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

export function isRogowy90Cabinet(node: CADNode): boolean {
    const gp = (node.domainData as any)?.generatorParams;
    const t = String(gp?.type || '').toLowerCase();
    return t === 'korpus_rogowy90' || t.includes('rogowy90') || t.includes('rogowy_90');
}

function makeRef(panelNode: CADNode, face: FaceName = 'FACE_Z_PLUS'): CornerDoorsRefSlot {
    return {
        partKey: panelNode.name,
        face,
        panelId: panelNode.id,
    };
}

/**
 * Domyślne referencje (model 4+2):
 * - 4 referencje automatyczne: dół, góra, bok prawy, bok lewy.
 * - 2 referencje wcięcia L (xMin, yMax): manualnie wskazywane przez użytkownika w 3D.
 */
export function buildRogowy90CornerDoorsReferences(
    cabinetNode: CADNode
): CornerDoorsCustomReferences | null {
    if (!isRogowy90Cabinet(cabinetNode)) return null;

    const bokL = findRogowyPanel(cabinetNode, 'BOK_L', 'BOK_Y');
    const bokP = findRogowyPanel(cabinetNode, 'BOK_P', 'BOK_X');
    const bottom = findRogowyPanel(cabinetNode, 'WIENIEC_D') || findRogowyPanel(cabinetNode, 'BOTTOM');
    const top = findRogowyPanel(cabinetNode, 'WIENIEC_G') || findRogowyPanel(cabinetNode, 'TOP');
    if (!bokL || !bokP || !bottom || !top) return null;

    return {
        // xMin i yMax pozostają nieprzypisane — użytkownik wskazuje ścianki wcięcia L w oknie 3D
        xMin: undefined,
        xMax: makeRef(bokP),
        yMin: makeRef(bokL),
        yMax: undefined,
        zMin: makeRef(bottom),
        // FACE_Z_PLUS = INNER spód wieńca góry (do wnętrza); FACE_Z_MINUS = OUTER dach
        zMax: makeRef(top, 'FACE_Z_PLUS'),
    };
}

/** Stosuje domyślne referencje + cornerAt. */
export function applyCornerDoorsDefaultRefs(
    cabinetNode: CADNode
): { customReferences: CornerDoorsCustomReferences; cornerAt: CornerAt } | null {
    const customReferences = buildRogowy90CornerDoorsReferences(cabinetNode);
    if (!customReferences) return null;
    return {
        customReferences,
        cornerAt: 'innerL_wieniec',
    };
}

/** @deprecated Użyj applyCornerDoorsDefaultRefs */
export function applyCornerDoorsTrialPreset(
    cabinetNode: CADNode,
    _presetIndex?: number
): { customReferences: CornerDoorsCustomReferences; cornerAt: CornerAt; presetIndex: number } | null {
    const applied = applyCornerDoorsDefaultRefs(cabinetNode);
    if (!applied) return null;
    return { ...applied, presetIndex: 0 };
}
