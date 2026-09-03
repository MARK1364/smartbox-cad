import { nmToMm } from '../A1_core/cad-math/units.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { UIController } from '../A1_core/ui-controller.js';

export interface EdgeBandInfo {
    active: boolean;
    type_id: string;
}

export interface EdgeBandingConfig {
    '+X'?: EdgeBandInfo;
    '-X'?: EdgeBandInfo;
    '+Y'?: EdgeBandInfo;
    '-Y'?: EdgeBandInfo;
    [key: string]: any;
}

export interface CuttingPanelContract {
    part_id: string;
    node_id?: string;
    container_id?: string;
    smartbox_id?: string;
    role: string;
    material: string;
    thickness_mm: number;
    length_mm: number;
    width_mm: number;
    edge_config: EdgeBandingConfig;
    is_x_longer: boolean;
    furniture_name: string;
    qty: number;
}

export interface ContainerScopeItem {
    id: string;
    name: string;
    type: 'furniture' | 'smartbox';
    partsCount: number;
}

export interface AccessoryItem {
    id: string;
    name: string;
    role: string;
    library_id: string;
    qty: number;
    furniture_name: string;
}

export class ReportDataNormalizer {
    /**
     * Bezpieczna konwersja wymiaru (obsługuje nanometry lub milimetry)
     */
    static safeMm(val: any, defaultVal = 0): number {
        if (typeof val !== 'number') {
            val = parseFloat(val);
        }
        if (isNaN(val) || val <= 0) return defaultVal;
        return nmToMm(val);
    }

    /**
     * Pobiera ujednoliconą konfigurację oklein (z bezpiecznym fallbackiem)
     */
    static normalizeEdgeConfig(edgeBanding: any): EdgeBandingConfig {
        const defaultEdge: EdgeBandInfo = { active: false, type_id: 'none' };
        const result: EdgeBandingConfig = {
            '+X': { ...defaultEdge },
            '-X': { ...defaultEdge },
            '+Y': { ...defaultEdge },
            '-Y': { ...defaultEdge }
        };

        if (!edgeBanding || typeof edgeBanding !== 'object') {
            return result;
        }

        const keys = ['+X', '-X', '+Y', '-Y'];
        for (const k of keys) {
            const eb = edgeBanding[k];
            if (eb) {
                if (typeof eb === 'object') {
                    result[k] = {
                        active: eb.active === true || (eb.active !== false && eb.type_id !== 'none' && eb.type_id !== undefined),
                        type_id: eb.type_id || '0.008x0.022'
                    };
                } else if (typeof eb === 'string' && eb !== 'none') {
                    result[k] = {
                        active: true,
                        type_id: eb
                    };
                }
            }
        }

        return result;
    }

    /**
     * Buduje rekord kontraktu dla pojedynczej formatki
     */
    static buildContractFromPanel(
        panel: any,
        furnitureName: string = 'Projekt',
        containerId?: string,
        smartboxId?: string,
        nodeId?: string
    ): CuttingPanelContract | null {
        if (!panel) return null;

        const wRaw = this.safeMm(panel.width || panel.dim?.[0] || panel.dimX || 0);
        const hRaw = this.safeMm(panel.height || panel.dim?.[1] || panel.dimY || 0);
        let tRaw = this.safeMm(panel.thickness || panel.dim?.[2] || panel.dimZ || 0, 18);
        if (tRaw <= 0) tRaw = 18;

        if (wRaw <= 0 || hRaw <= 0) return null;

        const length_mm = Math.max(wRaw, hRaw);
        const width_mm = Math.min(wRaw, hRaw);
        const is_x_longer = wRaw >= hRaw;

        const role = panel.role || panel.sb_role || 'PART';
        const part_id = panel.name || panel.id || panel.smartId?.uid || role;
        const material = panel.materialId || panel.material || panel.custom_properties?.material || 'W1100_ST9_18';
        const edge_config = this.normalizeEdgeConfig(panel.edgeBanding || panel.edge_banding || panel.custom_properties?.edge_banding);

        return {
            part_id: String(part_id),
            node_id: nodeId ? String(nodeId) : undefined,
            container_id: containerId ? String(containerId) : undefined,
            smartbox_id: smartboxId ? String(smartboxId) : undefined,
            role: String(role),
            material: String(material),
            thickness_mm: Math.round(tRaw * 10) / 10,
            length_mm: Math.round(length_mm * 10) / 10,
            width_mm: Math.round(width_mm * 10) / 10,
            edge_config,
            is_x_longer,
            furniture_name: furnitureName || 'Projekt',
            qty: 1
        };
    }

    /**
     * Skanuje dokument CAD / drzewo obiektów i wyciąga wszystkie formatki oraz akcesoria
     */
    static extractProjectData(documentTarget: any): {
        panels: CuttingPanelContract[];
        accessories: AccessoryItem[];
        furnitures: string[];
        containers: ContainerScopeItem[];
    } {
        const panels: CuttingPanelContract[] = [];
        const accessories: AccessoryItem[] = [];
        const furnitureSet = new Set<string>();
        const containerMap = new Map<string, ContainerScopeItem>();

        const doc = documentTarget?.document || documentTarget || ContextManager.instance?.document || (UIController.instance as any)?.document;

        if (!doc) {
            return { panels, accessories, furnitures: [], containers: [] };
        }

        const visitedIds = new Set<string>();

        const processPanel = (domain: any, furnName: string, containerId?: string, smartboxId?: string, nodeId?: string) => {
            if (!domain) return;
            const uniqueId = String(nodeId || domain.id || domain.name || Math.random());
            if (visitedIds.has(uniqueId)) return;
            visitedIds.add(uniqueId);

            const nameUpper = String(domain.name || '').toUpperCase();
            const isHardwareOrHole = ['HOLE', 'OTW', 'PUSZKA', 'WKRET'].some(x => nameUpper.includes(x));
            if (!isHardwareOrHole) {
                const contract = this.buildContractFromPanel(domain, furnName, containerId, smartboxId, nodeId);
                if (contract) {
                    panels.push(contract);
                    if (containerId && containerMap.has(containerId)) {
                        containerMap.get(containerId)!.partsCount += 1;
                    }
                    if (smartboxId && containerMap.has(smartboxId)) {
                        containerMap.get(smartboxId)!.partsCount += 1;
                    }
                }
            }
        };

        const scanNode = (node: any, currentFurniture: string, currentContainerId?: string, currentSmartboxId?: string) => {
            if (!node) return;

            let furn = currentFurniture;
            let activeContainerId = currentContainerId;
            let activeSmartboxId = currentSmartboxId;
            const domain = node.domainData || node;

            const isSmartBox = domain?.is_smartbox || 
                domain?.type === 'smartbox' || 
                (domain?.name && String(domain.name).toLowerCase().includes('smartbox')) || 
                (domain?.name && String(domain.name).endsWith('_SB')) ||
                domain?.generatorParams?.type?.startsWith('smartbox') ||
                domain?.generatorParams?.boxType !== undefined ||
                domain?.sb_role !== undefined;
            const isSmartFrame = !isSmartBox && (domain?.is_smartframe || domain?.type === 'container' || String(node.nodeType) === 'ASSEMBLY' || node.type === 'CONTAINER');

            if (isSmartBox) {
                activeSmartboxId = String(node.id || domain?.id || node.name);
                const sbName = domain?.name || node.name || 'SmartBox';
                if (!containerMap.has(activeSmartboxId)) {
                    containerMap.set(activeSmartboxId, {
                        id: activeSmartboxId,
                        name: sbName,
                        type: 'smartbox',
                        partsCount: 0
                    });
                }
            } else if (isSmartFrame) {
                activeContainerId = String(node.id || domain?.id || node.name);
                furn = domain?.name || node.name || 'Szafka';
                furnitureSet.add(furn);
                if (!containerMap.has(activeContainerId)) {
                    containerMap.set(activeContainerId, {
                        id: activeContainerId,
                        name: furn,
                        type: 'furniture',
                        partsCount: 0
                    });
                }
            }

            // Formatka
            const isPart = domain && domain.type !== 'container' && (domain.width || domain.role || domain.thickness || domain.dim || String(node.nodeType) === 'PART');
            if (isPart) {
                processPanel(domain, furn, activeContainerId, activeSmartboxId, node.id);
            }

            // Akcesoria / Okucia
            const roleUpper = String(domain?.role || '').toUpperCase();
            const nameUpper = String(node.name || domain?.name || '').toUpperCase();
            const isAccessory = (domain?.report_type === 'akcesoria') ||
                ['HINGE_LOCATOR', 'PROWADNICA', 'HOLDER', 'TUBE_ROD', 'BOX', 'SZUFLADA', 'DRAWER'].includes(roleUpper) ||
                nameUpper.includes('HINGE') || nameUpper.includes('ZAWIAS') || nameUpper.includes('PROWADNICA');

            if (isAccessory) {
                let library_id = domain?.library_id || domain?.price_id || domain?.name || roleUpper;
                if (roleUpper === 'PROWADNICA') library_id = 'PROWADNICA_KPL';
                if (roleUpper === 'BOX' || nameUpper.includes('SZUFLADA')) library_id = 'BLUM_ANTARO_M_500';
                if (roleUpper === 'HINGE_LOCATOR' || nameUpper.includes('ZAWIAS')) library_id = 'HINGE_BLUM_71B3550';

                accessories.push({
                    id: node.id || domain?.id || String(Math.random()),
                    name: node.name || domain?.name || roleUpper,
                    role: roleUpper || 'AKCESORIUM',
                    library_id,
                    qty: roleUpper === 'PROWADNICA' ? 0.5 : 1,
                    furniture_name: furn
                });
            }

            const children = node.children || node._children;
            if (children && Array.isArray(children)) {
                for (const child of children) {
                    scanNode(child, furn, activeContainerId, activeSmartboxId);
                }
            }
        };

        if (doc.rootNode) {
            scanNode(doc.rootNode, 'Projekt');
        }

        // Zapasowe pobranie bezpośrednio z getPanels jeśli rekurencja czegoś nie objęła
        if (panels.length === 0 && typeof doc.getPanels === 'function') {
            const rawPanels = doc.getPanels();
            for (const p of rawPanels) {
                const parentFurn = p.parent?.name || p.parent?.domainData?.name || 'Projekt';
                if (p.parent) furnitureSet.add(parentFurn);
                processPanel(p.domainData || p, parentFurn, p.parent?.id, undefined, p.id);
            }
        }

        if (furnitureSet.size === 0 && panels.length > 0) {
            furnitureSet.add('Projekt');
        }

        return {
            panels,
            accessories,
            furnitures: Array.from(furnitureSet),
            containers: Array.from(containerMap.values())
        };
    }

    /**
     * Agreguje identyczne panele (sumowanie ilości qty)
     */
    static aggregateContractRows(rows: CuttingPanelContract[]): Record<string, CuttingPanelContract> {
        const grouped: Record<string, CuttingPanelContract> = {};

        for (const row of rows) {
            const edgeKey = JSON.stringify(row.edge_config);
            const key = `${row.role}_${row.length_mm}_${row.width_mm}_${row.thickness_mm}_${row.material}_${edgeKey}_${row.is_x_longer}`;

            if (!grouped[key]) {
                grouped[key] = {
                    ...row,
                    qty: row.qty || 1
                };
            } else {
                grouped[key].qty += (row.qty || 1);
            }
        }

        return grouped;
    }
}
