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
import { WcsRulesMapper, cornerIndexToOriginCorner } from '../wcs/wcs-rules-mapper.js';
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
    /**
     * Węzły CAD przypisane do PanelModel podczas rozwiązywania zakresu.
     * Trzymamy referencję do węzła, a nie nazwę kontenera, żeby raport zawsze
     * czytał aktualną nazwę rodzica po zmianie nazwy lub reparentingu.
     */
    private readonly panelNodes = new WeakMap<object, any>();

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
        return this.getFeatureDifferences(a, b, false).length === 0;
    }

    /** ID służy do znalezienia pary CAD↔CAM, ale nie potwierdza zgodności geometrii. */
    private haveSameFeatureIdentity(a: CAMFeature, b: CAMFeature): boolean {
        if (a.featureId && b.featureId && a.featureId === b.featureId) return true;

        const aChilds = (a as any).childFeatureIds;
        const bChilds = (b as any).childFeatureIds;
        if (Array.isArray(aChilds) && Array.isArray(bChilds) && aChilds.length > 0 && bChilds.length > 0) {
            return aChilds.some(id => bChilds.includes(id));
        }
        return false;
    }

    private featureKind(feature: CAMFeature): 'hole' | 'groove' | 'contour' | 'pocket' {
        if ('diameter' in feature) return 'hole';
        if ('startPoint' in feature) return 'groove';
        if ('boundaryPoints' in feature) return 'pocket';
        return 'contour';
    }

    private pointsMatch(a: any, b: any, toleranceMm: number): boolean {
        return Boolean(a && b && Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z) &&
            Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z) &&
            Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= toleranceMm);
    }

    private pointListsMatch(a: any[], b: any[], toleranceMm: number, unordered = false): boolean {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        if (!unordered) return a.every((point, index) => this.pointsMatch(point, b[index], toleranceMm));

        const unmatched = [...b];
        for (const point of a) {
            const index = unmatched.findIndex((candidate) => this.pointsMatch(point, candidate, toleranceMm));
            if (index < 0) return false;
            unmatched.splice(index, 1);
        }
        return unmatched.length === 0;
    }

    /** Zwraca różnice geometryczne; luźniejsze tolerancje służą tylko dopasowaniu bez ID. */
    private getFeatureDifferences(a: CAMFeature, b: CAMFeature, strict: boolean): string[] {
        const kindA = this.featureKind(a);
        if (kindA !== this.featureKind(b)) return ['type'];

        const dimensionsToleranceMm = strict ? 0.01 : 0.5;
        const positionToleranceMm = strict ? 0.05 : 1.0;
        const differences: string[] = [];

        if (kindA === 'hole') {
            const ha = a as HoleFeature;
            const hb = b as HoleFeature;
            const diameterToleranceMm = strict ? 0.01 : 0.2;
            if (Math.abs(ha.diameter - hb.diameter) > diameterToleranceMm) differences.push('diameter');
            if (Math.abs(ha.depth - hb.depth) > dimensionsToleranceMm) differences.push('depth');
            if ((ha.face ?? null) !== (hb.face ?? null)) differences.push('face');
            if (Boolean(ha.through) !== Boolean(hb.through)) differences.push('through');

            const posA = ha.positions?.length ? ha.positions : [ha.position];
            const posB = hb.positions?.length ? hb.positions : [hb.position];
            if (!this.pointListsMatch(posA, posB, positionToleranceMm, true)) differences.push('position');
            if ((ha.axis ?? null) !== (hb.axis ?? null) &&
                (!ha.axis || !hb.axis || !this.pointsMatch(ha.axis, hb.axis, strict ? 0.001 : 0.05))) {
                differences.push('axis');
            }
            return differences;
        }

        if (kindA === 'groove') {
            const ga = a as GrooveFeature;
            const gb = b as GrooveFeature;
            const groovePositionToleranceMm = strict ? 0.05 : 2.0;
            if (Math.abs(ga.width - gb.width) > dimensionsToleranceMm) differences.push('width');
            if (Math.abs(ga.depth - gb.depth) > dimensionsToleranceMm) differences.push('depth');
            if ((ga.face ?? null) !== (gb.face ?? null)) differences.push('face');
            if ((ga.purpose ?? 'GENERIC') !== (gb.purpose ?? 'GENERIC')) differences.push('purpose');
            if (!this.pointsMatch(ga.startPoint, gb.startPoint, groovePositionToleranceMm) ||
                !this.pointsMatch(ga.endPoint, gb.endPoint, groovePositionToleranceMm)) differences.push('path');
            if (Boolean(ga.reverseDirection) !== Boolean(gb.reverseDirection) ||
                Boolean(ga.flipDepthDirection) !== Boolean(gb.flipDepthDirection)) differences.push('direction');
            return differences;
        }

        if (kindA === 'contour') {
            const ca = a as ContourFeature;
            const cb = b as ContourFeature;
            if (Math.abs(ca.depth - cb.depth) > dimensionsToleranceMm) differences.push('depth');
            if (!this.pointListsMatch(ca.points, cb.points, positionToleranceMm)) differences.push('path');
            if (((ca as any).face ?? null) !== ((cb as any).face ?? null)) differences.push('face');
            if (Boolean(ca.isInnerContour) !== Boolean(cb.isInnerContour)) differences.push('contourType');

            const segsA = Array.isArray(ca.segments) ? ca.segments : [];
            const segsB = Array.isArray(cb.segments) ? cb.segments : [];
            if (segsA.length !== segsB.length) {
                differences.push('segments');
            } else if (segsA.length > 0) {
                const segsMatch = segsA.every((sa, idx) => {
                    const sb = segsB[idx];
                    if (sa.type !== sb.type) return false;
                    if (sa.type === 'ARC' && sb.type === 'ARC') {
                        return Math.abs(sa.radius - sb.radius) <= dimensionsToleranceMm &&
                            sa.direction === sb.direction &&
                            this.pointsMatch(sa.center, sb.center, positionToleranceMm);
                    }
                    if (sa.type === 'LINE' && sb.type === 'LINE') {
                        return this.pointsMatch(sa.start, sb.start, positionToleranceMm) &&
                            this.pointsMatch(sa.end, sb.end, positionToleranceMm);
                    }
                    return true;
                });
                if (!segsMatch) differences.push('segments');
            }
            return differences;
        }

        const pa = a as any;
        const pb = b as any;
        if (Math.abs(pa.width - pb.width) > dimensionsToleranceMm) differences.push('width');
        if (Math.abs(pa.length - pb.length) > dimensionsToleranceMm) differences.push('length');
        if (Math.abs(pa.depth - pb.depth) > dimensionsToleranceMm) differences.push('depth');
        if ((pa.face ?? null) !== (pb.face ?? null)) differences.push('face');
        if (!this.pointListsMatch(pa.boundaryPoints, pb.boundaryPoints, positionToleranceMm)) differences.push('boundary');
        return differences;
    }

    private getFeatureModificationReason(a: CAMFeature, b: CAMFeature): string | null {
        if (this.getFeatureDifferences(a, b, true).length === 0) return null;
        return tx(cncTekst, 'sync.modified_geometry', TX_NS);
    }

    /**
     * Nazwa korpusu czytana z żywego drzewa CAD. Pomijamy pośrednie złożenia,
     * żeby raport pokazywał korpus nadrzędny, a nie np. wewnętrzny blok.
     */
    private getResolvedContainerName(panel: any): string | undefined {
        const node = this.panelNodes.get(panel);
        if (node) {
            let containerName: string | undefined;
            let curr = node.parent ?? null;
            while (curr) {
                // Korzeń dokumentu nie jest korpusem — kończymy na najwyższym złożeniu.
                if (!curr.parent) break;
                containerName = curr.domainData?.name ?? curr.name ?? containerName;
                curr = curr.parent;
            }
            return containerName;
        }
        return panel?.parent?.name;
    }

    /**
     * Tworzy i konfiguruje instancję WcsManager dla formatki i konkretnego programu CAM.
     * Uwzględnia wymiary formatki, regułę roli oraz specyficzny układ WCS programu
     * (cornerIndex, wcsName, manualną rotację i manualny offset).
     */
    public createWcsForPanelAndProgram(panel: any, program?: CNCProgramState | null): WcsManager {
        const wcs = new WcsManager();
        if (typeof panel?.width !== 'number' || !Number.isFinite(panel.width) || panel.width <= 0 ||
            typeof panel?.height !== 'number' || !Number.isFinite(panel.height) || panel.height <= 0 ||
            typeof panel?.thickness !== 'number' || !Number.isFinite(panel.thickness) || panel.thickness <= 0) {
            throw new Error(`[C1_cnc/cam-sync-service] Panel "${panel?.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel?.width}, H=${panel?.height}, T=${panel?.thickness}). Wymiary w nanometrach są wymagane do synchronizacji CAM.`);
        }
        const pW = nmToMm(panel.width);
        const pH = nmToMm(panel.height);
        const pT = nmToMm(panel.thickness);
        wcs.updateForPanelDimensions(pW, pH, pT);

        const role = panel.role;
        const roleRule = WcsRulesMapper.getRuleForRole(role);
        const rule = roleRule
            ? { ...roleRule, origin_corner: { ...roleRule.origin_corner }, directions: { ...roleRule.directions }, rotation: { ...roleRule.rotation } }
            : {
                origin_corner: { X: '-', Y: '-', Z: '-' },
                directions: { X: '+', Y: '+', Z: '+' },
                rotation: { X: 0, Y: 0, Z: 0 },
            };

        if (program && program.cornerIndex !== undefined) {
            if (typeof program.cornerIndex !== 'number' || !Number.isInteger(program.cornerIndex) || (program.cornerIndex !== -1 && (program.cornerIndex < 0 || program.cornerIndex > 7))) {
                throw new Error(`[C1_cnc/cam-sync-service] Indeks naroża WCS musi być wartością -1 lub liczbą całkowitą 0-7 (cornerIndex=${program.cornerIndex}).`);
            }
            if (program.cornerIndex >= 0) {
                rule.origin_corner = cornerIndexToOriginCorner(program.cornerIndex);
            }
        }
        wcs.setRule(rule);

        if (program?.wcsName) {
            wcs.setWcsName(program.wcsName);
        }
        if (program) {
            const rotX = program.wcsRotX ?? 0;
            const rotY = program.wcsRotY ?? 0;
            const rotZ = program.wcsRotZ ?? 0;
            const offX = program.wcsOffsetX ?? 0;
            const offY = program.wcsOffsetY ?? 0;
            const offZ = program.wcsOffsetZ ?? 0;
            if (!Number.isFinite(rotX) || !Number.isFinite(rotY) || !Number.isFinite(rotZ) ||
                !Number.isFinite(offX) || !Number.isFinite(offY) || !Number.isFinite(offZ)) {
                throw new Error(`[C1_cnc/cam-sync-service] Parametry WCS muszą być liczbami skończonymi (rot=[${rotX}, ${rotY}, ${rotZ}], offset=[${offX}, ${offY}, ${offZ}]).`);
            }
            wcs.setManualRotation({
                x: rotX,
                y: rotY,
                z: rotZ
            });
            wcs.setManualOffset({
                x: offX,
                y: offY,
                z: offZ
            });
        }

        return wcs;
    }

    /**
     * Porównuje cechy geometryczne pojedynczej formatki z jej programem CNC.
     */
    public comparePanelWithProgram(panel: any, program?: CNCProgramState | null, toolLibrary?: ToolLibrary): PanelSyncReport {
        const panelId = String(panel.id || panel.smartId?.uid || 'panel');
        const panelName = panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS);
        const containerName = panel.containerName || this.getResolvedContainerName(panel);

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

        // Inicjalizacja WcsManager na bazie formatki i parametrów WCS programu
        const wcs = this.createWcsForPanelAndProgram(panel, program);

        const cadData = this.extractor.extractPanelFeatures(panel, wcs);
        const cadFeatures = cadData.features || [];
        const camFeatures = program.features || [];

        const missingInCam: CAMFeature[] = [];
        const orphanedInCam: CAMFeature[] = [];
        const modified: { cad: CAMFeature; cam: CAMFeature; reason: string }[] = [];
        const discrepancies: DiscrepancyItem[] = [];

        const matchedCamFeatures = new Set<CAMFeature>();

        // 1. Najpierw dopasuj stabilnym ID, a następnie porównaj geometrię tej pary.
        for (const cadFeat of cadFeatures) {
            const available = camFeatures.filter((camFeat) => !matchedCamFeatures.has(camFeat));
            const identityMatch = available.find((camFeat) => this.haveSameFeatureIdentity(cadFeat, camFeat));
            const match = identityMatch || available.find((camFeat) => this.areFeaturesEquivalent(cadFeat, camFeat));
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
                matchedCamFeatures.add(match);
                const reason = identityMatch ? this.getFeatureModificationReason(cadFeat, match) : null;
                if (reason) {
                    modified.push({ cad: cadFeat, cam: match, reason });
                    discrepancies.push({
                        type: 'modified',
                        feature: cadFeat,
                        description: `${cadFeat.name || cadFeat.featureId}: ${reason}`,
                    });
                }
            }
        }

        // 2. Sprawdź, które operacje w CAM nie mają już odpowiednika w CAD (osierocone)
        for (const camFeat of camFeatures) {
            if (!matchedCamFeatures.has(camFeat)) {
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

            // Weryfikujemy wszystkie programy formatki — formatka może posiadać ich kilka
            const allDiscrepancies: DiscrepancyItem[] = [];
            const allMissing: CAMFeature[] = [];
            const allOrphaned: CAMFeature[] = [];
            const allModified: { cad: CAMFeature; cam: CAMFeature; reason: string }[] = [];
            let allProgramsSynced = true;

            for (const prog of programs) {
                const rep = this.comparePanelWithProgram(p, prog, toolLibrary);
                if (!rep.isSynced) {
                    allProgramsSynced = false;
                    allDiscrepancies.push(...rep.discrepancies);
                    allMissing.push(...rep.missingInCam);
                    allOrphaned.push(...rep.orphanedInCam);
                    allModified.push(...rep.modified);
                }
            }

            if (!allProgramsSynced) {
                totalDiscrepancies += allDiscrepancies.length;
            }

            reports.push({
                panelId: String(p.id || ''),
                panelName: p.name || tx(cncTekst, 'extractor.panel_default', TX_NS),
                containerName: p.containerName || this.getResolvedContainerName(p),
                hasProgram: true,
                activeProgramId: activeProg?.id,
                isSynced: allProgramsSynced,
                missingInCam: allMissing,
                orphanedInCam: allOrphaned,
                modified: allModified,
                discrepancies: allDiscrepancies
            });
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

        const wcs = this.createWcsForPanelAndProgram(panel, program);
        const cadData = this.extractor.extractPanelFeatures(panel, wcs);
        const cadFeatures = cadData.features || [];

        // Jeśli formatka nie miała jeszcze programu, budujemy nowy obiekt, ale go
        // NIE dopisujemy do panel.cncPrograms. Trwałe dodanie musi przejść przez
        // komendę historii (CreateCncProgramCommand), inaczej zmiana omija Undo/Redo.
        let prog: CNCProgramState;
        if (!program) {
            const pName = panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS);
            const targetPanelId = String(panel.id || 'panel');
            prog = {
                id: `prog_${targetPanelId}`,
                name: `Program_${pName}`,
                targetPanel: panel,
                targetPanelId,
                targetPanelLabel: pName,
                wcsName: 'G55',
                cornerIndex: -1,
                postprocessor: 'Mach3',
                isActive: true,
                features: [],
                toolAssignments: {}
            };
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
     *
     * Operacja jest transakcyjna: jeśli którakolwiek formatka rzuci błąd,
     * wcześniej zmodyfikowane programy wracają do stanu sprzed synchronizacji,
     * a powiadomienie o zmianie dokumentu nie jest publikowane.
     */
    public autoSynchronizeScope(scope: { type: string; id: string; name: string }, doc: any, toolLibrary?: ToolLibrary): { updatedCount: number; createdCount: number } {
        const panels = this.resolvePanelsForScope(scope, doc);
        let updatedCount = 0;
        let createdCount = 0;

        const snapshots: Array<{
            panel: any;
            programs: any[];
            program: any;
            features: any;
            toolAssignments: any;
        }> = [];

        const restoreSnapshots = (): void => {
            for (let i = snapshots.length - 1; i >= 0; i--) {
                const snapshot = snapshots[i];
                snapshot.program.features = snapshot.features;
                snapshot.program.toolAssignments = snapshot.toolAssignments;

                if (Array.isArray(snapshot.panel.cncPrograms)) {
                    snapshot.panel.cncPrograms.splice(0, snapshot.panel.cncPrograms.length, ...snapshot.programs);
                } else {
                    snapshot.panel.cncPrograms = snapshot.programs;
                }
            }
        };

        const synchronize = (): { updatedCount: number; createdCount: number } => {
            for (const p of panels) {
                const hasPrograms = Array.isArray(p.cncPrograms) && p.cncPrograms.length > 0;
                if (!hasPrograms) continue;

                let panelUpdated = false;
                for (const prog of p.cncPrograms) {
                    if (!prog) continue;

                    snapshots.push({
                        panel: p,
                        programs: [...p.cncPrograms],
                        program: prog,
                        features: prog.features,
                        toolAssignments: prog.toolAssignments,
                    });

                    this.autoSynchronizeProgram(p, prog, toolLibrary);
                    panelUpdated = true;
                }

                if (panelUpdated) {
                    updatedCount++;
                }
            }

            if (doc && typeof doc.notifyDocumentChanged === 'function') {
                doc.notifyDocumentChanged();
            }

            return { updatedCount, createdCount };
        };

        if (doc && typeof doc.transaction === 'function') {
            return doc.transaction(synchronize, restoreSnapshots);
        }

        try {
            return synchronize();
        } catch (error) {
            restoreSnapshots();
            throw error;
        }
    }

    /**
     * Pomocnicza metoda filtrująca formatki wg zakresu.
     *
     * Przynależność jest liczona z aktualnego drzewa CAD przy każdym wywołaniu.
     * Dzięki temu `ProjectDocument.reparentNode()` jest od razu widoczny i nie
     * zostaje nam stary `parent` zapisany wcześniej w PanelModel.
     */
    public resolvePanelsForScope(scope: { type: string; id: string; name: string }, doc: any): any[] {
        if (!doc || typeof doc.getPanels !== 'function') return [];

        const entries = doc.getPanels()
            .map((node: any) => {
                const panel = node?.domainData || node;
                return panel ? { node, panel } : null;
            })
            .filter((entry: { node: any; panel: any } | null): entry is { node: any; panel: any } => entry !== null);

        // Zapamiętujemy referencję do węzła, nie nazwę — nazwa jest czytana na bieżąco.
        for (const { node, panel } of entries) {
            if (!panel || typeof panel !== 'object') continue;
            this.panelNodes.set(panel, node);
        }

        const matchesId = (candidate: any): boolean => Boolean(candidate) && (
            candidate.id === scope.id ||
            candidate.smartId?.uid === scope.id
        );

        if (scope.type === 'PANEL') {
            return entries
                .filter(({ node, panel }) => matchesId(panel) || matchesId(node))
                .map(({ panel }) => panel);
        }

        if (scope.type === 'CONTAINER' || scope.type === 'BLOKI') {
            return entries
                .filter(({ node }) => {
                    let curr = node?.parent ?? null;
                    while (curr) {
                        if (matchesId(curr) || matchesId(curr.domainData)) return true;
                        curr = curr.parent ?? null;
                    }
                    return false;
                })
                .map(({ panel }) => panel);
        }

        // PROJECT
        return entries.map(({ panel }) => panel);
    }
}
