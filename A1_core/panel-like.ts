/**
 * Wąski kontrakt formatki dla A1 — bez importu klasy PanelModel (A4).
 */

export interface PanelLike {
    type?: string;
    id?: string;
    name?: string;
    role?: string;
    zoneId?: string;
    width?: number;
    height?: number;
    thickness?: number;
    engineManaged?: boolean;
    features?: any[];
    [key: string]: any;
}

/** Panel ręczny — silnik nie kasuje i nie nadpisuje. */
export function isManualPanel(panel: any): boolean {
    return !!panel && panel.engineManaged === false;
}

export function isPanelLike(data: any): data is PanelLike {
    return !!data && (data.type === 'part' || data.type === 'panel');
}

/**
 * Znajduje kontener nadrzędny (korpus, blok, smartpart, agd) dla danej formatki.
 */
export function findOwningContainer(doc: any, panelOrId: any): any | null {
    if (!doc || !panelOrId) return null;
    const id = typeof panelOrId === 'string' ? panelOrId : panelOrId?.id;
    if (!id || typeof doc.findNode !== 'function') return null;
    const node = doc.findNode(id);
    if (!node) return null;

    let curr = node.parent;
    while (curr) {
        if (curr === doc.root || curr.id === 'root' || curr.id === 'root_room') break;
        const d = curr.domainData;
        if (d && (d.type === 'container' || curr.nodeType === 'ASSEMBLY' || d.is_blok)) {
            if (!d.id && curr.id) d.id = curr.id;
            return d;
        }
        if (curr.nodeType === 'ASSEMBLY' || (curr as any).nodeType === 'ASSEMBLY') {
            return curr.domainData || curr;
        }
        curr = curr.parent;
    }
    return null;
}
