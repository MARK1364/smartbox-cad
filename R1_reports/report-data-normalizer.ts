import { nmToMm } from '../A1_core/cad-math/units.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { UIController } from '../A1_core/ui-controller.js';
import { LedChannelStore } from '../A2_bloki/15_led-external-channel-store.js';
import { isExcludedFromProduction } from '../S4_sciany/smartwall-types.js';
import { tx } from '../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import reportsTekstRaw from './reports_tekst.json';
import { priceStore } from './price-store';

const reportsTekst = reportsTekstRaw as unknown as ModuleTexts;
const TX_NS = 'reports';

/** Domyślna nazwa projektu (tylko display / klucz grupowania raportu) — z tłumaczeń. */
function defaultProjectName(): string {
    return tx(reportsTekst, 'default_project_name', TX_NS);
}

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
    panel_name?: string;
    container_id?: string;
    blok_id?: string;
    role: string;
    material: string;
    thickness_mm: number;
    length_mm: number;
    width_mm: number;
    edge_config: EdgeBandingConfig;
    is_x_longer: boolean;
    furniture_name: string;
    qty: number;
    rotate_grain?: boolean;
}

export interface ReportDataIssue {
    node_id: string;
    panel_name: string;
    reason: string;
}

export interface NormalizedCuttingPanels {
    panels: CuttingPanelContract[];
    issues: ReportDataIssue[];
}

export interface ContainerScopeItem {
    id: string;
    name: string;
    type: 'furniture' | 'bloki';
    partsCount: number;
}

export interface AccessoryItem {
    id: string;
    name: string;
    role: string;
    library_id: string;
    qty: number;
    furniture_name: string;
    container_id?: string;
    blok_id?: string;
    custom_unit_price?: number;
    area_m2?: number;
}

export class ReportDataNormalizer {
    /** PanelModel dimensions are stored in nanometers. Invalid values are not defaulted. */
    static nmValToMm(val: unknown): number | null {
        if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return null;
        const mm = nmToMm(val);
        return Number.isFinite(mm) && mm > 0 ? Math.round(mm * 10) / 10 : null;
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
        if (edgeBanding && edgeBanding['NOTCH'] !== undefined) {
            keys.push('NOTCH');
        }
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
        furnitureName: string = defaultProjectName(),
        containerId?: string,
        blokId?: string,
        nodeId?: string
    ): CuttingPanelContract | null {
        if (!panel) return null;

        const wRaw = this.nmValToMm(panel.width);
        const hRaw = this.nmValToMm(panel.height);
        const tRaw = this.nmValToMm(panel.thickness);
        const materialId = typeof panel.materialId === 'string' ? panel.materialId.trim() : '';
        if (wRaw === null || hRaw === null || tRaw === null || !materialId) return null;

        const isGrainRotated = panel.rotate_grain === true;
        const length_mm = isGrainRotated ? Math.min(wRaw, hRaw) : Math.max(wRaw, hRaw);
        const width_mm = isGrainRotated ? Math.max(wRaw, hRaw) : Math.min(wRaw, hRaw);
        const is_x_longer = isGrainRotated ? (wRaw < hRaw) : (wRaw >= hRaw);

        const isAluFrame = panel.panelForm === 'ALU_FRAME' || (typeof panel.isAluFrame === 'function' && panel.isAluFrame());

        const role = panel.role || 'PART';
        // Strict: part_id z id (normalizer dostaje nodeId). Display name nie jest tożsamością.
        const rawPartId = nodeId || panel.id || panel.smartId?.uid || role;
        const part_id = isAluFrame ? `${rawPartId} [Ramka Alu]` : rawPartId;

        let material = materialId;
        if (isAluFrame) {
            const tplId = panel.frameTemplateId;
            if (tplId === 'Z9_WIDE_BLACK') {
                material = 'RAMKA_ALU_SZKLO_Z9';
            } else if (tplId === 'Z11_FLUTED') {
                material = 'RAMKA_ALU_SZKLO_Z11';
            } else {
                material = 'RAMKA_ALU_SZKLO_Z1';
            }
        }

        const edge_config = isAluFrame
            ? {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' },
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: false, type_id: 'none' }
              }
            : this.normalizeEdgeConfig(panel.edgeBanding);

        const thickness_mm = isAluFrame ? Math.max(20, tRaw) : tRaw;

        return {
            part_id: String(part_id),
            node_id: nodeId ? String(nodeId) : undefined,
            panel_name: String(panel.name || role),
            container_id: containerId ? String(containerId) : undefined,
            blok_id: blokId ? String(blokId) : undefined,
            role: String(role),
            material: String(material),
            thickness_mm,
            length_mm: Math.round(length_mm * 10) / 10,
            width_mm: Math.round(width_mm * 10) / 10,
            edge_config,
            is_x_longer,
            furniture_name: furnitureName || defaultProjectName(),
            qty: 1,
            ...(isGrainRotated ? { rotate_grain: true } : {})
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
        issues: ReportDataIssue[];
    } {
        const panels: CuttingPanelContract[] = [];
        const accessories: AccessoryItem[] = [];
        const issues: ReportDataIssue[] = [];
        const seenDrawerSlots = new Set<string>();
        const drawerKitsByFurnAndType = new Map<string, AccessoryItem>();
        const furnitureSet = new Set<string>();
        const containerMap = new Map<string, ContainerScopeItem>();

        const doc = documentTarget?.document || documentTarget || ContextManager.instance?.document || (UIController.instance as any)?.document;

        if (!doc) {
            return { panels, accessories, furnitures: [], containers: [], issues };
        }

        const visitedIds = new Set<string>();

        const processPanel = (domain: any, furnName: string, containerId?: string, blokId?: string, nodeId?: string) => {
            if (!domain) return;
            // Obiekt zamrożony zachowuje się jak usunięty — nie trafia na listę raportów ani nestingu
            if (domain.frozen === true) return;
            // SmartWall PART (WALL / WALL_PILLAR) — poza produkcją
            if (isExcludedFromProduction(domain)) return;

            // Strict: dedup po id. Brak id = brak wpisu (bez losowych kluczy).
            const uniqueId = String(nodeId || domain.id || '');
            if (!uniqueId || visitedIds.has(uniqueId)) return;
            visitedIds.add(uniqueId);

            // Hardware is excluded by structural role, not display name.
            const isHardwareOrHole =
                domain.role === 'PROWADNICA' || domain.role === 'RAIL';
            if (!isHardwareOrHole) {
                const isAluFrame = domain.panelForm === 'ALU_FRAME' || (typeof domain.isAluFrame === 'function' && domain.isAluFrame());
                if (isAluFrame) {
                    // Ramka aluminiowa jako gotowy OSPRZĘT / WYRÓB ZEWNĘTRZNY (nie trafia na piłę do płyt!)
                    const wMm = this.nmValToMm(domain.width);
                    const hMm = this.nmValToMm(domain.height);
                    const tMm = this.nmValToMm(domain.thickness);
                    const materialId = typeof domain.materialId === 'string' ? domain.materialId.trim() : '';
                    if (wMm === null || hMm === null || tMm === null || !materialId) {
                        issues.push({
                            node_id: uniqueId,
                            panel_name: String(domain.name || uniqueId),
                            reason: 'Brak wymaganych wymiarów PanelModel (width, height, thickness) lub materialId.',
                        });
                        return;
                    }
                    const areaM2 = Math.round((wMm * hMm / 1_000_000) * 1000) / 1000;

                    const tplId = domain.frameTemplateId;
                    let pricePerM2 = 300.0;
                    let libId = 'RAMKA_ALU_Z1_BLACK';
                    let frameName = 'Z-1 20x20mm';

                    if (tplId === 'Z9_WIDE_BLACK') {
                        pricePerM2 = 340.0;
                        libId = 'RAMKA_ALU_Z9_WIDE_BLACK';
                        frameName = 'Z-9 45x20mm (szeroki)';
                    } else if (tplId === 'Z11_FLUTED') {
                        pricePerM2 = 350.0;
                        libId = 'RAMKA_ALU_Z11_FLUTED';
                        frameName = 'Z-11 20x20mm (ryflowany)';
                    }

                    const customUnitPrice = Math.round(areaM2 * pricePerM2 * 100) / 100;
                    const panelDisplayName = domain.name || tx(reportsTekst, 'default_front_name', TX_NS);

                    accessories.push({
                        id: `alu_frame_${uniqueId}`,
                        name: `${panelDisplayName} [Ramka alu ${frameName}, ${wMm}x${hMm}mm, szkło Antisol]`,
                        role: 'RAMKA_ALU',
                        library_id: libId,
                        qty: 1,
                        furniture_name: furnName || defaultProjectName(),
                        container_id: containerId,
                        blok_id: blokId,
                        custom_unit_price: customUnitPrice,
                        area_m2: areaM2
                    });
                    return;
                }

                const contract = this.buildContractFromPanel(domain, furnName, containerId, blokId, nodeId);
                if (contract) {
                    panels.push(contract);
                    if (containerId && containerMap.has(containerId)) {
                        containerMap.get(containerId)!.partsCount += 1;
                    }
                    if (blokId && containerMap.has(blokId)) {
                        containerMap.get(blokId)!.partsCount += 1;
                    }
                } else {
                    issues.push({
                        node_id: uniqueId,
                        panel_name: String(domain.name || uniqueId),
                        reason: 'Brak wymaganych dodatnich wymiarów PanelModel (width, height, thickness) lub materialId.',
                    });
                }
            }
        };

        const scanNode = (node: any, currentFurniture: string, currentContainerId?: string, currentBlokId?: string) => {
            if (!node) return;

            let furn = currentFurniture;
            let activeContainerId = currentContainerId;
            let activeBlokId = currentBlokId;
            const domain = node.domainData;

            if (node.frozen === true || domain?.frozen === true) {
                return;
            }

            // Strict: Bloki tylko po flagach strukturalnych, nigdy po nazwie.
            const isBlok = domain?.is_blok ||
                domain?.type === 'bloki' ||
                domain?.type === 'BLOKI' ||
                domain?.generatorParams?.type?.startsWith('bloki') ||
                domain?.generatorParams?.boxType !== undefined ||
                domain?.sb_role !== undefined ||
                domain?.role === 'BLOKI';
            const isSmartFrame = !isBlok && (domain?.is_smartframe || domain?.type === 'container' || String(node.nodeType) === 'ASSEMBLY' || node.type === 'CONTAINER');

            if (isBlok) {
                // Strict: klucz mapy tylko z id. Nazwa (sbName) to display.
                activeBlokId = String(node.id || domain?.id || '');
                const rawSbName = domain?.name ?? node?.name;
                const sbName = rawSbName || tx(reportsTekst, 'default_bloki_name', TX_NS);
                if (!containerMap.has(activeBlokId)) {
                    containerMap.set(activeBlokId, {
                        id: activeBlokId,
                        name: sbName,
                        type: 'bloki',
                        partsCount: 0
                    });
                }
            } else if (isSmartFrame) {
                // Strict: klucz mapy tylko z id. furn to display (tekst UI -> faza tekstów raportów).
                activeContainerId = String(node.id || domain?.id || '');
                const rawFurnName = domain?.name ?? node?.name;
                furn = rawFurnName || tx(reportsTekst, 'default_cabinet_name', TX_NS);
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
            const isPart = domain && String(node.nodeType) === 'PART';
            if (isPart) {
                processPanel(domain, furn, activeContainerId, activeBlokId, node.id);
            }

            // Akcesoria / Okucia — strict: report_type / nodeType / rola. Bez zgadywania po nazwach.
            const roleUpper = String(domain?.role || '').toUpperCase();
            const isAccessory = (domain?.report_type === 'akcesoria') ||
                String(node.nodeType) === 'HARDWARE' || domain?.type === 'hardware' ||
                ['HINGE_LOCATOR', 'PROWADNICA', 'RAIL', 'HOLDER', 'TUBE_ROD', 'BOX', 'SZUFLADA', 'DRAWER', 'LED'].includes(roleUpper);

            if (isAccessory) {
                // Obiekt zamrożony (np. zawias) zachowuje się jak usunięty — nie trafia do raportów
                const isFrozen = Boolean(node.frozen || domain?.frozen);
                if (!isFrozen) {
                    // Strict: library_id tylko ze strukturalnych pól. Bez nazw display.
                    let library_id = domain?.library_id || domain?.price_id || domain?.hardwareId || roleUpper;
                    if (roleUpper === 'PROWADNICA' || roleUpper === 'RAIL') {
                        const rawHw = String(domain?.hardwareId || domain?.library_id || domain?.price_id || domain?.params?.railId || roleUpper).toUpperCase();
                        const len = domain?.params?.lengthMm || 500;
                        if (rawHw.includes('ANTARO') || rawHw.includes('M94') || rawHw.includes('D214') || rawHw.includes('KOSZ')) {
                            const roundedLen = Math.round(len / 50) * 50;
                            const clampedLen = Math.min(600, Math.max(300, roundedLen));
                            library_id = `BLUM_ANTARO_M_${clampedLen}`;
                        } else {
                            library_id = domain?.library_id || 'PROWADNICA_KPL';
                        }
                    }
                    // Strict: szablon zawiasu po kodzie (71T3550 = bez hamulca). Bez polskich literałów.
                    if (roleUpper === 'HINGE_LOCATOR') {
                        const rawHw = String(domain?.hardwareId || domain?.library_id || domain?.price_id || roleUpper).toUpperCase();
                        if (rawHw.includes('71T3550')) {
                            library_id = 'HINGE_BLUM_71T3550';
                        } else {
                            library_id = 'HINGE_BLUM_71B3550';
                        }
                    }
                    if (roleUpper === 'LED') {
                        library_id = 'LED_PROFILE_WPUSZCZANY';
                    }

                    const isRailItem = roleUpper === 'PROWADNICA' || roleUpper === 'RAIL';
                    const isLedItem = roleUpper === 'LED';
                    if (isRailItem) {
                        // Strict: indeks szuflady z params albo z id. Bez regexów po display name.
                        const drawerIdx = domain?.params?.drawerIndex ??
                            (node.id?.match(/drawer_(\d+)/i)?.[1]);
                        
                        // Unikalne gniazdo szuflady (aby nie liczyć podwójnie lewej i prawej prowadnicy)
                        const drawerSlotKey = `${furn}_${activeBlokId || 'sb'}_drawer_${drawerIdx ?? node.id}`;

                        if (!seenDrawerSlots.has(drawerSlotKey)) {
                            seenDrawerSlots.add(drawerSlotKey);

                            // Sumowanie szuflad tego samego typu w danym meblu/korpusie
                            const furnTypeKey = `${furn}_${library_id}`;
                            const existingKit = drawerKitsByFurnAndType.get(furnTypeKey);

                            if (existingKit) {
                                existingKit.qty += 1;
                            } else {
                                const railSystemId = domain?.params?.railId;
                                const railLabel = library_id.startsWith('BLUM_ANTARO_M_')
                                    ? (railSystemId ? `Antaro ${railSystemId}` : 'Antaro')
                                    : (railSystemId || 'Antaro');
                                const kitName = `Szuflada [${railLabel}] (kpl)`;

                                const kitItem: AccessoryItem = {
                                    id: `drawer_${furn}_${library_id}`,
                                    name: kitName,
                                    role: 'PROWADNICA',
                                    library_id,
                                    qty: 1,
                                    furniture_name: furn,
                                    container_id: activeContainerId,
                                    blok_id: activeBlokId,
                                };
                                drawerKitsByFurnAndType.set(furnTypeKey, kitItem);
                                accessories.push(kitItem);
                            }
                        }
                    } else if (isLedItem) {
                        const ledSlotKey = `${furn}_${activeBlokId || node.id}_led`;
                        if (!seenDrawerSlots.has(ledSlotKey)) {
                            seenDrawerSlots.add(ledSlotKey);
                            accessories.push({
                                id: node.id || domain?.id || `acc_${accessories.length + 1}`,
                                name: 'Zestaw Profil LED wpuszczany',
                                role: 'LED',
                                library_id: 'LED_PROFILE_WPUSZCZANY',
                                qty: 1,
                                furniture_name: furn,
                                container_id: activeContainerId,
                                blok_id: activeBlokId,
                            });
                        }
                    } else {
                        accessories.push({
                            id: node.id || domain?.id || `acc_${accessories.length + 1}`,
                            name: node.name ?? domain?.name ?? roleUpper,
                            role: roleUpper || 'AKCESORIUM',
                            library_id,
                            qty: 1,
                            furniture_name: furn,
                            container_id: activeContainerId,
                            blok_id: activeBlokId,
                        });
                    }
                }
            }

            const children = node.children || node._children;
            if (children && Array.isArray(children)) {
                for (const child of children) {
                    scanNode(child, furn, activeContainerId, activeBlokId);
                }
            }
        };

        if (doc.rootNode) {
            scanNode(doc.rootNode, defaultProjectName());
        }

        // Pozycje SmartParts / LED zewnętrzny (kanał) — system 'assembly_led_channel' (A2_bloki/led).
        // Uwaga: LED wewnętrzny ('BLOKI_LED', led-internal-engine) jest odrębnym systemem
        // i nie przechodzi przez LedChannelStore.
        try {
            const ledStore = LedChannelStore.instance;
            const placedChannels = (ledStore.channels || []).filter(
                (ch) => !ch.frozen && ch.visible !== false && ch.enabled !== false && Boolean(ch.refBottom || ch.detectedWidthMm)
            );
            for (const ch of placedChannels) {
                const widthMm = Math.round(ch.detectedWidthMm || 0);
                const widthLabel = widthMm > 0 ? ` [${widthMm} mm]` : '';
                const furnName = ch.refBottom?.label ? `Szafka (${ch.refBottom.label})` : 'Szafki wiszące';
                furnitureSet.add(furnName);
                accessories.push({
                    id: ch.id,
                    name: `Zestaw Profil LED wpuszczany${widthLabel}`,
                    role: 'LED',
                    library_id: 'LED_PROFILE_WPUSZCZANY',
                    qty: 1, // Liczy się sztuka
                    furniture_name: furnName,
                });
            }
        } catch (err) {
            console.warn('Błąd odczytu kanałów LED w raporcie:', err);
        }

        if (furnitureSet.size === 0 && panels.length > 0) {
            furnitureSet.add(defaultProjectName());
        }

        return {
            panels,
            accessories: this.aggregateAccessories(accessories),
            furnitures: Array.from(furnitureSet),
            containers: Array.from(containerMap.values()),
            issues,
        };
    }

    static validateCuttingPanelContracts(rows: CuttingPanelContract[]): NormalizedCuttingPanels {
        const panels: CuttingPanelContract[] = [];
        const issues: ReportDataIssue[] = [];
        for (const row of rows || []) {
            const id = typeof row?.node_id === 'string' && row.node_id
                ? row.node_id
                : String(row?.part_id || '');
            const missing = [
                !id && 'brak ID formatki',
                !row?.role && 'brak roli',
                !row?.material && 'brak materiału',
                !Number.isFinite(row?.length_mm) || row.length_mm <= 0 ? 'nieprawidłowa długość' : '',
                !Number.isFinite(row?.width_mm) || row.width_mm <= 0 ? 'nieprawidłowa szerokość' : '',
                !Number.isFinite(row?.thickness_mm) || row.thickness_mm <= 0 ? 'nieprawidłowa grubość' : '',
            ].filter(Boolean);
            if (missing.length > 0) {
                issues.push({
                    node_id: id,
                    panel_name: String(row?.role || id || 'Formatka'),
                    reason: missing.join(', '),
                });
                continue;
            }
            panels.push({
                ...row,
                length_mm: Math.round(row.length_mm * 10) / 10,
                width_mm: Math.round(row.width_mm * 10) / 10,
                thickness_mm: Math.round(row.thickness_mm * 10) / 10,
                edge_config: this.normalizeEdgeConfig(row.edge_config),
                qty: Number.isFinite(row.qty) && row.qty > 0 ? row.qty : 1,
            });
        }
        return { panels, issues };
    }

    /**
     * Display name pozycji okucia z cennika (SSOT). Zwraca null, gdy brak wpisu —
     * wtedy zostaje nazwa z węzła. Służy wyłącznie wyświetlaniu scalonej pozycji.
     */
    static resolveAccessoryDisplayName(item: AccessoryItem): string | null {
        const hw = priceStore.prices?.prices_hardware as Record<string, any> | undefined;
        if (!hw || !item?.library_id) return null;

        const direct = hw[item.library_id];
        if (direct?.name) return String(direct.name);

        const norm = String(item.library_id).trim().toUpperCase();
        for (const [k, v] of Object.entries(hw)) {
            if (k.trim().toUpperCase() === norm && (v as any)?.name) {
                return String((v as any).name);
            }
        }
        return null;
    }

    /**
     * Scala powtarzające się okucia/akcesoria i sumuje ich qty.
     * Tożsamość pozycji = rola + library_id + zakres (mebel/korpus/blok) + wariant (cena własna / powierzchnia).
     * Pozycje z ceną własną (np. ramki alu) zachowują nazwę wariantu — nie są przemianowywane.
     */
    static aggregateAccessories(items: AccessoryItem[]): AccessoryItem[] {
        const order: string[] = [];
        const groups = new Map<string, AccessoryItem[]>();

        for (const item of items) {
            const isCustomPriced = typeof item.custom_unit_price === 'number';
            const canonical = isCustomPriced ? null : this.resolveAccessoryDisplayName(item);
            const nameKey = isCustomPriced ? item.name : (canonical ?? item.name);
            const key = [
                item.role,
                item.library_id,
                item.furniture_name,
                item.container_id ?? '',
                item.blok_id ?? '',
                item.custom_unit_price ?? '',
                item.area_m2 ?? '',
                nameKey
            ].join('|');

            if (!groups.has(key)) {
                groups.set(key, []);
                order.push(key);
            }
            groups.get(key)!.push(item);
        }

        const result: AccessoryItem[] = [];
        for (const key of order) {
            const group = groups.get(key)!;
            const merged: AccessoryItem = { ...group[0] };
            merged.qty = group.reduce((sum, it) => sum + (it.qty || 1), 0);
            if (group.length > 1 && typeof group[0].custom_unit_price !== 'number') {
                const canonical = this.resolveAccessoryDisplayName(group[0]);
                if (canonical) merged.name = canonical;
            }
            result.push(merged);
        }
        return result;
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

    /**
     * Agreguje formatki o tych samych gabarytach i okleinowaniu (sumuje qty),
     * łącząc unikalne role / uwagi w jedno zestawienie (do hurtowni).
     */
    static aggregateContractRowsByGeometry(
        rows: CuttingPanelContract[],
        getEdgeCodeFn?: (edgeConfig: any, direction: 'length' | 'width', is_x_longer?: boolean) => string
    ): CuttingPanelContract[] {
        const defaultGetEdgeCode = (cfg: any, dir: 'length' | 'width', isXLonger = true) => {
            if (!cfg || typeof cfg !== 'object') return '0';
            const e1 = dir === 'length' ? (isXLonger ? cfg['+X'] : cfg['+Y']) : (isXLonger ? cfg['+Y'] : cfg['+X']);
            const e2 = dir === 'length' ? (isXLonger ? cfg['-X'] : cfg['-Y']) : (isXLonger ? cfg['-Y'] : cfg['-X']);
            return String((e1?.active ? 1 : 0) + (e2?.active ? 1 : 0));
        };
        const edgeCodeCalc = getEdgeCodeFn || defaultGetEdgeCode;

        const getDetailedEdgeSig = (cfg: any, isXLonger = true) => {
            if (!cfg || typeof cfg !== 'object') return '0|0';
            const getDirTypes = (d: 'length' | 'width') => {
                const e1 = d === 'length' ? (isXLonger ? cfg['+X'] : cfg['+Y']) : (isXLonger ? cfg['+Y'] : cfg['+X']);
                const e2 = d === 'length' ? (isXLonger ? cfg['-X'] : cfg['-Y']) : (isXLonger ? cfg['-Y'] : cfg['-X']);
                const active = [e1, e2].filter((e) => e && e.active === true).map((e) => String(e.type_id || 'std').toLowerCase()).sort();
                return active.join('+');
            };
            return `${getDirTypes('length')}|${getDirTypes('width')}`;
        };

        const groups = new Map<string, { panel: CuttingPanelContract; roles: string[]; totalQty: number }>();

        for (const row of rows) {
            const lCode = edgeCodeCalc(row.edge_config, 'length', row.is_x_longer);
            const wCode = edgeCodeCalc(row.edge_config, 'width', row.is_x_longer);
            const edgeSig = getDetailedEdgeSig(row.edge_config, row.is_x_longer);
            const len = Math.round(row.length_mm);
            const wid = Math.round(row.width_mm);
            const key = `${row.material}_${row.thickness_mm}_${len}_${lCode}_${wid}_${wCode}_${row.is_x_longer}_${edgeSig}`;

            const existing = groups.get(key);
            const qty = row.qty || 1;
            const role = row.role ? row.role.trim() : '';

            if (!existing) {
                groups.set(key, {
                    panel: { ...row, length_mm: len, width_mm: wid },
                    roles: role ? [role] : [],
                    totalQty: qty,
                });
            } else {
                existing.totalQty += qty;
                if (role && !existing.roles.includes(role)) {
                    existing.roles.push(role);
                }
            }
        }

        const result: CuttingPanelContract[] = [];
        for (const entry of groups.values()) {
            const merged = { ...entry.panel };
            merged.qty = entry.totalQty;
            if (entry.roles.length > 0) {
                merged.role = entry.roles.join(', ');
            }
            result.push(merged);
        }

        return result.sort((a, b) => (b.length_mm - a.length_mm) || (b.width_mm - a.width_mm) || (a.role || '').localeCompare(b.role || ''));
    }
}
