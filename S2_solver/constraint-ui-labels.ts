/**
 * Etykiety kotwic więzów — wspólne dla drzewa i narzędzi Solvera.
 */

import { nmToMm } from '../A1_core/cad-math/units.js';
import { NodeType } from '../A1_core/cad-node/node-type.js';
import { faceAnchorLabel, faceNameFromLocalNormal, resolveAnchor } from './constraint-geometry.js';
import type { ConstraintAnchor } from './constraint-types.js';

export function geomNodeForAnchor(anchor: ConstraintAnchor, document: any) {
    if (anchor.sourceNodeId) {
        return document?.findNode?.(anchor.sourceNodeId) ?? document?.findNode?.(anchor.nodeId);
    }
    return document?.findNode?.(anchor.nodeId);
}

function elementIndexLabel(anchor: ConstraintAnchor, document: any): string {
    if (anchor.kind === 'VERTEX') {
        if (anchor.cornerIndex === 8) return 'wieniec dolny strefy';
        if (anchor.cornerIndex === 16) return 'wieniec górny strefy';
        const isTop = (anchor.cornerIndex & 4) !== 0;
        const sideLabel = anchor.cornerIndex >= 0 ? (isTop ? 'góra' : 'dół') : '';
        return sideLabel ? `narożnik ${anchor.cornerIndex} (${sideLabel})` : `narożnik ${anchor.cornerIndex}`;
    }
    if (anchor.kind === 'FACE') {
        const body = document?.findNode?.(anchor.nodeId);
        const geom = anchor.sourceNodeId
            ? (document?.findNode?.(anchor.sourceNodeId) ?? body)
            : body;
        const isAssembly = body?.nodeType === NodeType.ASSEMBLY || Boolean(anchor.sourceNodeId && anchor.sourceNodeId !== anchor.nodeId);
        if (isAssembly) {
            const resolved = body ? resolveAnchor(body, anchor, geom) : null;
            const bodyNormal = resolved?.localNormal ?? anchor.localNormalMm;
            if (bodyNormal) {
                const faceName = faceNameFromLocalNormal(bodyNormal, NodeType.ASSEMBLY);
                return faceAnchorLabel(faceName, NodeType.ASSEMBLY);
            }
        }
        const geomType = geom?.nodeType ?? body?.nodeType ?? NodeType.PART;
        if (anchor.faceName) {
            return faceAnchorLabel(anchor.faceName, geomType);
        }
        const resolved = body ? resolveAnchor(body, anchor, geom) : null;
        if (resolved?.localNormal) {
            const faceName = faceNameFromLocalNormal(resolved.localNormal, geomType);
            return faceAnchorLabel(faceName, geomType);
        }
        return faceAnchorLabel('', geomType);
    }
    return 'origin';
}

function formatDatumLabel(anchor: ConstraintAnchor, document: any, full: boolean): string {
    const node = document?.findNode?.(anchor.nodeId);
    if (node && node.nodeType === NodeType.GLC_FRAME) {
        const tipZ_nm = (node.domainData as any)?.tipZ_nm;
        const axisZ_nm = (node.domainData as any)?.axisZHeight_nm;
        const z_mm = typeof tipZ_nm === 'number' && tipZ_nm > 0
            ? Math.round(nmToMm(tipZ_nm))
            : (typeof axisZ_nm === 'number' && axisZ_nm > 0 ? Math.round(nmToMm(axisZ_nm)) + 30 : 2430);
        return full ? `Góra osi Z [Z: ${z_mm} mm]` : `Góra osi Z (${z_mm} mm)`;
    }
    if (node && node.nodeType === NodeType.DATUM_LEVEL) {
        const z_nm = (node.domainData as any)?.z_nm ?? node.localMatrix?.getTranslation?.()?.z ?? 0;
        const z_mm = Math.round(nmToMm(z_nm));
        const name = node.name || anchor.faceName || 'Poziom';
        return full ? `${name} [Z: ${z_mm} mm]` : `${name} (${z_mm} mm)`;
    }
    if (String(anchor.nodeId || '').startsWith('__DATUM__:')) {
        return full ? `Datum: ${anchor.faceName || 'plane'}` : `Datum ${anchor.faceName || 'plane'}`;
    }
    return full ? `Poziom: ${anchor.faceName || anchor.nodeId}` : `${anchor.faceName || 'Poziom Z'}`;
}

export function anchorPartLabel(anchor: ConstraintAnchor | null, document: any): string {
    if (!anchor) {
        return '';
    }
    if (anchor.kind === 'DATUM' || String(anchor.nodeId || '').startsWith('__DATUM__:')) {
        return formatDatumLabel(anchor, document, false);
    }
    const node = geomNodeForAnchor(anchor, document);
    const baseName = node?.name ?? anchor.nodeId.slice(0, 8);
    if (anchor.kind === 'VERTEX' && anchor.cornerIndex >= 0) {
        if (anchor.cornerIndex === 8) return `${baseName} [Wieniec dolny]`;
        if (anchor.cornerIndex === 16) return `${baseName} [Wieniec górny]`;
        const isTop = (anchor.cornerIndex & 4) !== 0;
        return `${baseName} [c${anchor.cornerIndex} ${isTop ? 'G' : 'D'}]`;
    }
    if (anchor.kind === 'FACE') {
        return `${baseName} [${elementIndexLabel(anchor, document)}]`;
    }
    return baseName;
}

export function anchorFullLabel(anchor: ConstraintAnchor | null, document: any): string {
    if (!anchor) {
        return '';
    }
    if (anchor.kind === 'DATUM' || String(anchor.nodeId || '').startsWith('__DATUM__:')) {
        return formatDatumLabel(anchor, document, true);
    }
    const node = geomNodeForAnchor(anchor, document);
    const name = node?.name ?? anchor.nodeId.slice(0, 8);
    return `${name} [${elementIndexLabel(anchor, document)}]`;
}

export function anchorShortLabel(anchor: ConstraintAnchor | null, document: any): string {
    return anchorFullLabel(anchor, document);
}
