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
    /**
     * PanelModel / ContainerModel trzymają nm — jawne wejście, bez progu heurystyki.
     * Nieobsłużone/<=0 → defaultVal.
     */
    static nmValToMm(val: any, defaultVal = 0): number {
        if (typeof val !== 'number') {
            val = parseFloat(val);
        }
        if (!Number.isFinite(val) || val <= 0) return defaultVal;
        return Math.round(nmToMm(val));
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

        const wRaw = this.nmValToMm(panel.width || panel.dim?.[0] || panel.dimX || 0);
        const hRaw = this.nmValToMm(panel.height || panel.dim?.[1] || panel.dimY || 0);
        let tRaw = this.nmValToMm(panel.thickness || panel.dim?.[2] || panel.dimZ || 0, 18);
        if (tRaw <= 0) tRaw = 18;

        if (wRaw <= 0 || hRaw <= 0) return null;

        const length_mm = Math.max(wRaw, hRaw);
        const width_mm = Math.min(wRaw, hRaw);
        const is_x_longer = wRaw >= hRaw;

        const isAluFrame = panel.panelForm === 'ALU_FRAME' || (typeof panel.isAluFrame === 'function' && panel.isAluFrame());

        const role = panel.role || panel.sb_role || 'PART';
        // Strict: part_id z id (normalizer dostaje nodeId). Display name nie jest tożsamością.
        const rawPartId = nodeId || panel.id || panel.smartId?.uid || role;
        const part_id = isAluFrame ? `${rawPartId} [Ramka Alu]` : rawPartId;

        let material = panel.materialId || panel.material || panel.custom_properties?.material;
        if (isAluFrame) {
            const tplId = panel.frameTemplateId || 'Z1_BLACK';
            if (tplId === 'Z9_WIDE_BLACK') {
                material = 'RAMKA_ALU_SZKLO_Z9';
            } else if (tplId === 'Z11_FLUTED') {
                material = 'RAMKA_ALU_SZKLO_Z11';
            } else {
                material = 'RAMKA_ALU_SZKLO_Z1';
            }
        } else if (!material) {
            material = 'W1100_ST9_18';
        }

        const edge_config = isAluFrame
            ? {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' },
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: false, type_id: 'none' }
              }
            : this.normalizeEdgeConfig(panel.edgeBanding || panel.edge_banding || panel.custom_properties?.edge_banding);

        const thickness_mm = isAluFrame ? Math.max(20, Math.round(tRaw * 10) / 10) : Math.round(tRaw * 10) / 10;

        return {
            part_id: String(part_id),
            node_id: nodeId ? String(nodeId) : undefined,
            container_id: containerId ? String(containerId) : (panel.containerId || panel.container_id ? String(panel.containerId || panel.container_id) : undefined),
            blok_id: blokId ? String(blokId) : (panel.blok_id || panel.blokId ? String(panel.blok_id || panel.blokId) : undefined),
            role: String(role),
            material: String(material),
            thickness_mm,
            length_mm: Math.round(length_mm * 10) / 10,
            width_mm: Math.round(width_mm * 10) / 10,
            edge_config,
            is_x_longer,
            furniture_name: furnitureName || defaultProjectName(),
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
        const seenDrawerSlots = new Set<string>();
        const drawerKitsByFurnAndType = new Map<string, AccessoryItem>();
        const furnitureSet = new Set<string>();
        const containerMap = new Map<string, ContainerScopeItem>();

        const doc = documentTarget?.document || documentTarget || ContextManager.instance?.document || (UIController.instance as any)?.document;

        if (!doc) {
            return { panels, accessories, furnitures: [], containers: [] };
        }

        const visitedIds = new Set<string>();

        const processPanel = (domain: any, furnName: string, containerId?: string, blokId?: string, nodeId?: string) => {
            if (!domain) return;
            // Obiekt zamrożony zachowuje się jak usunięty — nie trafia na listę raportów ani nestingu
            if (domain.frozen === true || domain.params?.frozen === true) return;
            // SmartWall PART (WALL / WALL_PILLAR) — poza produkcją
            if (isExcludedFromProduction(domain)) return;

            // Strict: dedup po id. Brak id = brak wpisu (bez losowych kluczy).
            const uniqueId = String(nodeId || domain.id || '');
            if (!uniqueId || visitedIds.has(uniqueId)) return;
            visitedIds.add(uniqueId);

            // Strict: sprzęt wykrywamy po roli, nie po nazwie. Obiekty bez roli i wymiarów
            // odpadną w buildContractFromPanel (w/h <= 0 -> null).
            const isHardwareOrHole =
                domain.role === 'PROWADNICA' || domain.role === 'RAIL';
            if (!isHardwareOrHole) {
                const isAluFrame = domain.panelForm === 'ALU_FRAME' || (typeof domain.isAluFrame === 'function' && domain.isAluFrame());
                if (isAluFrame) {
                    // Ramka aluminiowa jako gotowy OSPRZĘT / WYRÓB ZEWNĘTRZNY (nie trafia na piłę do płyt!)
                    const wMm = this.nmValToMm(domain.width || domain.dim?.[0] || domain.dimX || 0);
                    const hMm = this.nmValToMm(domain.height || domain.dim?.[1] || domain.dimY || 0);
                    const areaM2 = Math.round((wMm * hMm / 1_000_000) * 1000) / 1000;

                    const tplId = domain.frameTemplateId || 'Z1_BLACK';
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
                }
            }
        };

        const scanNode = (node: any, currentFurniture: string, currentContainerId?: string, currentBlokId?: string) => {
            if (!node) return;

            let furn = currentFurniture;
            let activeContainerId = currentContainerId;
            let activeBlokId = currentBlokId;
            const domain = node.domainData || node;

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
            const isPart = domain && domain.type !== 'container' && (domain.width || domain.role || domain.thickness || domain.dim || String(node.nodeType) === 'PART');
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
                const isFrozen = Boolean(node.frozen || domain?.frozen || domain?.params?.frozen);
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

        // Zapasowe pobranie bezpośrednio z getPanels jeśli rekurencja czegoś nie objęła
        if (panels.length === 0 && typeof doc.getPanels === 'function') {
            const rawPanels = doc.getPanels();
            for (const p of rawPanels) {
                if (p.frozen === true || p.domainData?.frozen === true || p.params?.frozen === true) continue;
                const parentFurn = p.parent?.name ?? p.parent?.domainData?.name ?? defaultProjectName();
                if (p.parent) furnitureSet.add(parentFurn);
                processPanel(p.domainData || p, parentFurn, p.parent?.id, undefined, p.id);
            }
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
            containers: Array.from(containerMap.values())
        };
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
}
