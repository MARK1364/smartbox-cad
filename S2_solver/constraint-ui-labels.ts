/**
 * Etykiety kotwic więzów — wspólne dla drzewa i narzędzi Solvera.
 */

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
        return `narożnik ${anchor.cornerIndex}`;
    }
    if (anchor.kind === 'FACE') {
        const body = document?.findNode?.(anchor.nodeId);
        const geom = anchor.sourceNodeId
            ? (document?.findNode?.(anchor.sourceNodeId) ?? body)
            : body;
        const geomType = geom?.nodeType ?? body?.nodeType;
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

export function anchorPartLabel(anchor: ConstraintAnchor | null, document: any): string {
    if (!anchor) {
        return '';
    }
    if (anchor.kind === 'DATUM' || String(anchor.nodeId || '').startsWith('__DATUM__:')) {
        return `Datum ${anchor.faceName || 'plane'}`;
    }
    const node = geomNodeForAnchor(anchor, document);
    return node?.name ?? anchor.nodeId.slice(0, 8);
}

export function anchorFullLabel(anchor: ConstraintAnchor | null, document: any): string {
    if (!anchor) {
        return '';
    }
    if (anchor.kind === 'DATUM' || String(anchor.nodeId || '').startsWith('__DATUM__:')) {
        return `Datum: ${anchor.faceName || 'plane'}`;
    }
    const node = geomNodeForAnchor(anchor, document);
    const name = node?.name ?? anchor.nodeId.slice(0, 8);
    return `${name} [${elementIndexLabel(anchor, document)}]`;
}

export function anchorShortLabel(anchor: ConstraintAnchor | null, document: any): string {
    return anchorFullLabel(anchor, document);
}
