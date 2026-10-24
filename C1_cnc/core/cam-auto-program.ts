/**
 * cam-auto-program.ts
 * 
 * Automatyczne generowanie domyślnego programu CNC dla formatki z dopasowaniem narzędzi.
 */

import { WcsManager } from '../wcs/wcs-manager.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import type { CNCProgramState } from './cam-state-store.js';
import type { CAMFeature } from '../dto/cam-dto.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

export function buildDefaultCncProgramForPanel(panel: any, toolLib?: ToolLibrary): CNCProgramState | null {
    if (!panel || panel.frozen === true || panel.params?.frozen === true) return null;
    if (typeof panel.width !== 'number' || panel.width <= 0 ||
        typeof panel.height !== 'number' || panel.height <= 0 ||
        typeof panel.thickness !== 'number' || panel.thickness <= 0) {
        return null;
    }

    const dims = {
        width: nmToMm(panel.width),
        height: nmToMm(panel.height),
        thickness: nmToMm(panel.thickness)
    };

    const effectiveToolLib = toolLib || new ToolLibrary();
    const wcs = new WcsManager('G55');
    const rule = WcsRulesMapper.getRuleForRole(panel.role);
    if (rule) {
        wcs.updateForPanelDimensions(dims.width, dims.height, dims.thickness);
        wcs.setRule(rule);
    }

    const extractor = new GeometryDataExtractor();
    const extracted = extractor.extractPanelFeatures(panel, wcs);
    const features: CAMFeature[] = extracted.features || [];

    const toolAssignments: Record<string, string> = {};
    for (const f of features) {
        if ('diameter' in f && !f.toolId) {
            const matched = effectiveToolLib.findBestHoleTool((f as any).diameter);
            if (matched) {
                f.toolId = matched.id;
                toolAssignments[f.featureId] = matched.id;
            }
        } else if ('startPoint' in f && !f.toolId) {
            const matched = effectiveToolLib.findBestGrooveTool();
            if (matched) {
                f.toolId = matched.id;
                toolAssignments[f.featureId] = matched.id;
            }
        }
    }

    const tName = panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS);
    const newProg: CNCProgramState = {
        id: `prog_${panel.id || Date.now()}`,
        name: `Program_${tName}`,
        targetPanel: panel,
        targetPanelId: String(panel.id || ''),
        targetPanelLabel: tName,
        wcsName: 'G55',
        cornerIndex: -1,
        postprocessor: 'Mach3',
        isActive: true,
        features,
        toolAssignments
    };

    return newProg;
}

export function ensurePanelHasCncProgram(panel: any, toolLib?: ToolLibrary): CNCProgramState | null {
    if (!panel) return null;
    if (!panel.cncPrograms) {
        panel.cncPrograms = [];
    }
    if (panel.cncPrograms.length > 0) {
        return panel.cncPrograms[0];
    }
    const prog = buildDefaultCncProgramForPanel(panel, toolLib);
    if (prog) {
        panel.cncPrograms.push(prog);
    }
    return prog;
}
