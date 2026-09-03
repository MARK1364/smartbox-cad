import type { CuttingPanelContract, AccessoryItem } from '../../R1_reports/report-data-normalizer';
import type { NestingPart } from '../../n1_nesting/core/nesting-types';
import type { ModuleScope } from './types';

function matches(value: string | undefined, id: string, name: string): boolean {
    if (!value) return false;
    return value === id || value === name;
}

export function filterPanelsByScope(panels: CuttingPanelContract[], scope: ModuleScope): CuttingPanelContract[] {
    if (!scope || scope.type === 'PROJECT') return panels;
    const { type, id, name } = scope;
    return panels.filter((p) => {
        if (type === 'SMARTBOX') {
            return matches(p.smartbox_id, id, name) || matches(p.part_id, id, name);
        }
        if (type === 'PANEL') {
            return matches(p.part_id, id, name) || matches(p.node_id, id, name);
        }
        return matches(p.container_id, id, name) || matches(p.furniture_name, id, name);
    });
}

export function filterAccessoriesByScope(accessories: AccessoryItem[], scope: ModuleScope): AccessoryItem[] {
    if (!scope || scope.type === 'PROJECT') return accessories;
    if (scope.type === 'PANEL') return [];
    const { type, id, name } = scope;
    return accessories.filter((a) => {
        if (type === 'SMARTBOX') {
            return a.id === id || (a.name && a.name.includes(name)) || matches(a.furniture_name, id, name);
        }
        return matches(a.furniture_name, id, name);
    });
}

export function filterNestingPartsByScope(parts: NestingPart[], scope: ModuleScope): NestingPart[] {
    if (!scope || scope.type === 'PROJECT') return parts;
    const { type, id, name } = scope;
    return parts.filter((p) => {
        if (type === 'SMARTBOX') {
            return matches(p.smartboxId, id, name) || p.id === id;
        }
        if (type === 'PANEL') {
            return p.id === id || p.sourceNodeId === id || p.name === name;
        }
        return matches(p.containerId, id, name) || matches(p.furnitureName, id, name);
    });
}
