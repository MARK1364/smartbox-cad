/**
 * SmartPanel Web — C1_CNC CAM Sync Service
 * 
 * Silnik ciągłej walidacji spójności CAD ↔ CAM (Asocjatywność CAD/CAM).
 * Porównuje cechy geometryczne mebla z operacjami w programie CNC i wykrywa rozbieżności
 * (np. nowo dodane kanały LED, nowe nawierty pod półki, usunięte frezowania).
 */

import { CAMFeature, HoleFeature, GrooveFeature, ContourFeature } from '../dto/cam-dto.js';
import { CNCProgramState } from './cam-state-store.js';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { MachiningRuleEngine } from '../rules/machining-rule-engine.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';
import { ToolLibrary } from '../processor/tool-library.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { WcsManager } from '../wcs/wcs-manager.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

export interface DiscrepancyItem {
    type: 'missing_in_cam' | 'orphaned_in_cam' | 'modified';
    feature: CAMFeature;
    description: string;
    suggestedToolName?: string;
}

export interface PanelSyncReport {
    panelId: string;
    panelName: string;
    containerName?: string;
    hasProgram: boolean;
    activeProgramId?: string;
    isSynced: boolean;
    missingInCam: CAMFeature[];
    orphanedInCam: CAMFeature[];
    modified: { cad: CAMFeature; cam: CAMFeature; reason: string }[];
    discrepancies: DiscrepancyItem[];
}

export interface ScopeValidationReport {
    scopeName: string;
    scopeType: string;
    totalPanels: number;
    panelsWithFeatures: number;
    panelsWithPrograms: number;
    hasDiscrepancies: boolean;
    totalDiscrepancyCount: number;
    panelReports: PanelSyncReport[];
}

export class CAMSyncService {
    private static instance: CAMSyncService;
    private extractor: GeometryDataExtractor = new GeometryDataExtractor();

    public static getInstance(): CAMSyncService {
        if (!CAMSyncService.instance) {
            CAMSyncService.instance = new CAMSyncService();
        }
        return CAMSyncService.instance;
    }

    /**
     * Sprawdza czy dwie cechy CAM są geometrycznie tożsame.
     */
    private areFeaturesEquivalent(a: CAMFeature, b: CAMFeature): boolean {
        // 1. Zgodność po ID
        if (a.featureId && b.featureId && a.featureId === b.featureId) {
            return true;
        }

        // 2. Zgodność po ID składowych
        const aChilds = (a as any).childFeatureIds;
        const bChilds = (b as any).childFeatureIds;
        if (Array.isArray(aChilds) && Array.isArray(bChilds) && aChilds.length > 0 && bChilds.length > 0) {
            if (aChilds.some(id => bChilds.includes(id))) return true;
        }

        // 3. Wiercenia
        if ('diameter' in a && 'diameter' in b) {
            const ha = a as HoleFeature;
            const hb = b as HoleFeature;
            if (Math.abs(ha.diameter - hb.diameter) > 0.2) return false;
            if (Math.abs(ha.depth - hb.depth) > 0.5) return false;
            if (ha.face && hb.face && ha.face !== hb.face) return false;

            const posA = ha.positions || [ha.position];
            const posB = hb.positions || [hb.position];
            if (posA.length !== posB.length) return false;

            // Sprawdź zbieżność pozycji
            return posA.every(pa => posB.some(pb => 
                Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) < 1.0
            ));
        }

        // 4. Wpusty (Rowki, np. Kanał LED, plecy)
        if ('startPoint' in a && 'startPoint' in b) {
            const ga = a as GrooveFeature;
            const gb = b as GrooveFeature;
            if (Math.abs(ga.width - gb.width) > 0.5) return false;
            if (Math.abs(ga.depth - gb.depth) > 0.5) return false;

            const dStart = Math.hypot(ga.startPoint.x - gb.startPoint.x, ga.startPoint.y - gb.startPoint.y, ga.startPoint.z - gb.startPoint.z);
            const dEnd = Math.hypot(ga.endPoint.x - gb.endPoint.x, ga.endPoint.y - gb.endPoint.y, ga.endPoint.z - gb.endPoint.z);
            return (dStart < 2.0 && dEnd < 2.0);
        }

        // 5. Kontury
        if ('points' in a && 'points' in b) {
            const ca = a as ContourFeature;
            const cb = b as ContourFeature;
            if (Math.abs(ca.depth - cb.depth) > 0.5) return false;
            if (ca.points.length !== cb.points.length) return false;
            return ca.points.every((pa, idx) => {
                const pb = cb.points[idx];
                return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) < 1.0;
            });
        }

        return false;
    }

    /**
     * Porównuje cechy geometryczne pojedynczej formatki z jej programem CNC.
     */
    public comparePanelWithProgram(panel: any, program?: CNCProgramState | null, toolLibrary?: ToolLibrary): PanelSyncReport {
        const panelId = String(panel.id || panel.smartId?.uid || 'panel');
        const panelName = panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS);
        const containerName = panel.containerName || panel.parent?.name;

        // Jeśli brak utworzonego programu — formatka nie uczestniczy w sprawdzaniu rozbieżności
        if (!program) {
            return {
                panelId,
                panelName,
                containerName,
                hasProgram: false,
                isSynced: true,
                missingInCam: [],
                orphanedInCam: [],
                modified: [],
                discrepancies: []
            };
        }

        // Inicjalizacja WcsManager na bazie formatki jeśli program ma przypisaną bazę
        const wcs = new WcsManager();
        if (typeof panel.width !== 'number' || panel.width <= 0 ||
            typeof panel.height !== 'number' || panel.height <= 0 ||
            typeof panel.thickness !== 'number' || panel.thickness <= 0) {
            throw new Error(`[C1_cnc/cam-sync-service] Panel "${panel?.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel?.width}, H=${panel?.height}, T=${panel?.thickness}). Wymiary w nanometrach są wymagane do synchronizacji CAM.`);
        }
        const pW = nmToMm(panel.width);
        const pH = nmToMm(panel.height);
        const pT = nmToMm(panel.thickness);
        wcs.updateForPanelDimensions(pW, pH, pT);
        // Strict: reguła WCS tylko z roli. Brak roli = brak reguły (default WCS).
        const role = panel.role;
        const rule = WcsRulesMapper.getRuleForRole(role);
        if (rule) wcs.setRule(rule);

        const cadData = this.extractor.extractPanelFeatures(panel, wcs);
        const cadFeatures = cadData.features || [];
        const camFeatures = program.features || [];

        const missingInCam: CAMFeature[] = [];
        const orphanedInCam: CAMFeature[] = [];
        const modified: { cad: CAMFeature; cam: CAMFeature; reason: string }[] = [];
        const discrepancies: DiscrepancyItem[] = [];

        // 1. Sprawdź, których cech CAD brakuje w programie CNC
        for (const cadFeat of cadFeatures) {
            const match = camFeatures.find(camFeat => this.areFeaturesEquivalent(cadFeat, camFeat));
            if (!match) {
                missingInCam.push(cadFeat);
                const ruleRes = toolLibrary ? MachiningRuleEngine.getInstance().resolveFeatureMachining(cadFeat, toolLibrary) : null;
                discrepancies.push({
                    type: 'missing_in_cam',
                    feature: cadFeat,
                    description: tx(cncTekst, 'sync.new_operation', TX_NS, { name: cadFeat.name || cadFeat.featureId }),
                    suggestedToolName: ruleRes?.tool?.name
                });
            } else {
                // Sprawdź czy nie zmieniły się parametry
                if ('depth' in cadFeat && 'depth' in match && Math.abs(cadFeat.depth - match.depth) > 0.5) {
                    const reason = tx(cncTekst, 'sync.modified_depth', TX_NS, { cad: cadFeat.depth, cam: match.depth });
                    modified.push({ cad: cadFeat, cam: match, reason });
                    discrepancies.push({
                        type: 'modified',
                        feature: cadFeat,
                        description: `${cadFeat.name || cadFeat.featureId}: ${reason}`
                    });
                }
            }
        }

        // 2. Sprawdź, które operacje w CAM nie mają już odpowiednika w CAD (osierocone)
        for (const camFeat of camFeatures) {
            const match = cadFeatures.find(cadFeat => this.areFeaturesEquivalent(camFeat, cadFeat));
            if (!match) {
                orphanedInCam.push(camFeat);
                discrepancies.push({
                    type: 'orphaned_in_cam',
                    feature: camFeat,
                    description: tx(cncTekst, 'sync.orphaned', TX_NS, { name: camFeat.name || camFeat.featureId })
                });
            }
        }

        const isSynced = missingInCam.length === 0 && orphanedInCam.length === 0 && modified.length === 0;

        return {
            panelId,
            panelName,
            containerName,
            hasProgram: true,
            activeProgramId: program.id,
            isSynced,
            missingInCam,
            orphanedInCam,
            modified,
            discrepancies
        };
    }

    /**
     * Weryfikuje cały zakres obiektów (Projekt / Szafka / Formatka).
     */
    public validateScope(scope: { type: string; id: string; name: string }, doc: any, toolLibrary?: ToolLibrary): ScopeValidationReport {
        const panels = this.resolvePanelsForScope(scope, doc);
        const reports: PanelSyncReport[] = [];
        let totalDiscrepancies = 0;
        let panelsWithFeatures = 0;
        let panelsWithPrograms = 0;

        for (const p of panels) {
            const hasFeats = Array.isArray(p.features) && p.features.length > 0;
            if (hasFeats) panelsWithFeatures++;

            const programs: CNCProgramState[] = p.cncPrograms || [];
            // Warunek: badamy tylko formatki, dla których w ogóle został utworzony program CNC
            if (programs.length === 0) continue;

            panelsWithPrograms++;
            const activeProg = programs.find(pr => pr.isActive) || programs[0] || null;
            const rep = this.comparePanelWithProgram(p, activeProg, toolLibrary);

            if (!rep.isSynced) {
                totalDiscrepancies += rep.discrepancies.length;
            }
            reports.push(rep);
        }

        return {
            scopeName: scope.name,
            scopeType: scope.type,
            totalPanels: panels.length,
            panelsWithFeatures,
            panelsWithPrograms,
            hasDiscrepancies: totalDiscrepancies > 0,
            totalDiscrepancyCount: totalDiscrepancies,
            panelReports: reports
        };
    }

    /**
     * Automatyczna synchronizacja programu dla pojedynczej formatki przy użyciu MachiningRuleEngine.
     */
    public autoSynchronizeProgram(panel: any, program?: CNCProgramState | null, toolLibrary?: ToolLibrary): CNCProgramState {
        const lib = toolLibrary || new ToolLibrary();
        const ruleEngine = MachiningRuleEngine.getInstance();

        const wcs = new WcsManager();
        if (typeof panel.width !== 'number' || panel.width <= 0 ||
            typeof panel.height !== 'number' || panel.height <= 0 ||
            typeof panel.thickness !== 'number' || panel.thickness <= 0) {
            throw new Error(`[C1_cnc/cam-sync-service] Panel "${panel?.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel?.width}, H=${panel?.height}, T=${panel?.thickness}). Wymiary w nanometrach są wymagane do synchronizacji CAM.`);
        }
        const pW = nmToMm(panel.width);
        const pH = nmToMm(panel.height);
        const pT = nmToMm(panel.thickness);
        wcs.updateForPanelDimensions(pW, pH, pT);
        // Strict: reguła WCS tylko z roli. Brak roli = brak reguły (default WCS).
        const role = panel.role;
        const rule = WcsRulesMapper.getRuleForRole(role);
        if (rule) wcs.setRule(rule);

        const cadData = this.extractor.extractPanelFeatures(panel, wcs);
        const cadFeatures = cadData.features || [];

        // Jeśli formatka nie miała jeszcze programu, tworzymy nowy
        let prog: CNCProgramState;
        if (!program) {
            const pName = panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS);
            prog = {
                id: `prog_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                name: `Program_${pName}`,
                targetPanel: panel,
                targetPanelId: String(panel.id || ''),
                targetPanelLabel: pName,
                wcsName: 'G55',
                cornerIndex: -1,
                postprocessor: 'Mach3',
                isActive: true,
                features: [],
                toolAssignments: {}
            };
            if (!panel.cncPrograms) panel.cncPrograms = [];
            panel.cncPrograms.push(prog);
        } else {
            prog = program;
        }

        // Przypisz narzędzia dla wszystkich wyciągniętych cech za pomocą MachiningRuleEngine
        const newToolAssignments = { ...(prog.toolAssignments || {}) };
        const updatedFeatures: CAMFeature[] = [];

        for (const feat of cadFeatures) {
            let assignedToolId = feat.toolId || newToolAssignments[feat.featureId];

            if (!assignedToolId) {
                const resolution = ruleEngine.resolveFeatureMachining(feat, lib);
                if (resolution.tool) {
                    assignedToolId = resolution.tool.id;
                    newToolAssignments[feat.featureId] = resolution.tool.id;
                }
            }

            updatedFeatures.push({
                ...feat,
                toolId: assignedToolId || null
            });
        }

        prog.features = updatedFeatures;
        prog.toolAssignments = newToolAssignments;

        return prog;
    }

    /**
     * Synchronizuje wszystkie formatki w podanym zakresie.
     */
    public autoSynchronizeScope(scope: { type: string; id: string; name: string }, doc: any, toolLibrary?: ToolLibrary): { updatedCount: number; createdCount: number } {
        const panels = this.resolvePanelsForScope(scope, doc);
        let updatedCount = 0;
        let createdCount = 0;

        for (const p of panels) {
            const hasPrograms = Array.isArray(p.cncPrograms) && p.cncPrograms.length > 0;
            if (!hasPrograms) continue;

            const activeProg = p.cncPrograms.find((pr: any) => pr.isActive) || p.cncPrograms[0];
            if (activeProg) {
                this.autoSynchronizeProgram(p, activeProg, toolLibrary);
                updatedCount++;
            }
        }

        if (doc && typeof doc.notifyDocumentChanged === 'function') {
            doc.notifyDocumentChanged();
        }

        return { updatedCount, createdCount };
    }

    /**
     * Pomocnicza metoda filtrująca formatki wg zakresu.
     */
    public resolvePanelsForScope(scope: { type: string; id: string; name: string }, doc: any): any[] {
        if (!doc || typeof doc.getPanels !== 'function') return [];
        const allItems = doc.getPanels();
        const allPanels = allItems.map((item: any) => {
            const p = item.domainData || item;
            if (p && !p.parent && item.parent) p.parent = item.parent.domainData || item.parent;
            return p;
        }).filter(Boolean);

        if (scope.type === 'PANEL') {
            return allPanels.filter((p: any) => p.id === scope.id || p.smartId?.uid === scope.id);
        }

        if (scope.type === 'CONTAINER' || scope.type === 'BLOKI') {
            return allPanels.filter((p: any) => {
                let curr = p;
                while (curr) {
                    if (curr.id === scope.id || curr.smartId?.uid === scope.id) return true;
                    curr = curr.parent;
                }
                return false;
            });
        }

        // PROJECT
        return allPanels;
    }
}
