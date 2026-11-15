/**
 * SmartPanel Web — C1_CNC Machining Rule Engine
 * 
 * Inteligentny silnik reguł technologicznych (AFR - Automatic Feature Recognition).
 * Automatycznie dobiera narzędzia i strategie obróbcze na podstawie geometrii i typu cechy CAD
 * (wzorzec ze SWOOD CAM i imos iX).
 */

import { CAMFeature, HoleFeature, GrooveFeature, ContourFeature, PocketFeature, Tool } from '../dto/cam-dto.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

export interface MachiningResolution {
    tool: Tool | null;
    strategyId: 'drilling' | 'profiling_25d' | 'pocketing';
    parameters?: Record<string, any>;
    warning?: string;
}

export class MachiningRuleEngine {
    private static instance: MachiningRuleEngine;

    public static getInstance(): MachiningRuleEngine {
        if (!MachiningRuleEngine.instance) {
            MachiningRuleEngine.instance = new MachiningRuleEngine();
        }
        return MachiningRuleEngine.instance;
    }

    /**
     * Rozpoznaje cechę CAD i dobiera optymalne narzędzie z magazynu oraz strategię CAM.
     */
    public resolveFeatureMachining(feat: CAMFeature, toolLibrary: ToolLibrary): MachiningResolution {
        if ('diameter' in feat) {
            return this.resolveHole(feat as HoleFeature, toolLibrary);
        } else if ('startPoint' in feat && 'endPoint' in feat) {
            return this.resolveGroove(feat as GrooveFeature, toolLibrary);
        } else if ('boundaryPoints' in feat) {
            return this.resolvePocket(feat as PocketFeature, toolLibrary);
        } else if ('points' in feat) {
            return this.resolveContour(feat as ContourFeature, toolLibrary);
        }

        return {
            tool: null,
            strategyId: 'profiling_25d',
            warning: tx(cncTekst, 'rules.unknown_feature', TX_NS)
        };
    }

    /**
     * Dobór narzędzia dla kieszeni (PocketFeature).
     */
    private resolvePocket(pocket: PocketFeature, toolLibrary: ToolLibrary): MachiningResolution {
        const width = Number(pocket.width || 0);
        const length = Number(pocket.length || 0);
        const minDim = Math.min(width, length);
        const fittingMill = toolLibrary.findBestMillTool(minDim > 0 ? minDim : undefined);

        if (fittingMill) {
            return {
                tool: fittingMill,
                strategyId: 'pocketing',
                parameters: {
                    depth: pocket.depth,
                    stepover: fittingMill.diameter * 0.5
                }
            };
        }

        return {
            tool: null,
            strategyId: 'pocketing',
            warning: tx(cncTekst, 'rules.no_optimal_mill', TX_NS, { width: minDim, tool: tx(cncTekst, 'rules.unknown_tool', TX_NS) })
        };
    }

    /**
     * Dobór wiertła dla otworu pionowego lub poziomego (czoła formatki).
     */
    private resolveHole(hole: HoleFeature, toolLibrary: ToolLibrary): MachiningResolution {
        const dia = hole.diameter;
        const face = String(hole.face || '').toUpperCase();
        const isAxisX = face.startsWith('FACE_X') || (!face.startsWith('FACE_Y') && !face.startsWith('FACE_Z') && !!hole.axis && Math.abs(hole.axis.x) > 0.7);
        const isAxisY = face.startsWith('FACE_Y') || (!face.startsWith('FACE_X') && !face.startsWith('FACE_Z') && !!hole.axis && Math.abs(hole.axis.y) > 0.7);
        const isHorizontal = isAxisX || isAxisY;

        const allTools = toolLibrary.getAllTools();
        const candidateDrills = allTools.filter(t => t.type === 'drill');

        // Dopasowanie wyłącznie z uwzględnieniem dozwolonej osi (poziome X/Y dla krawędzi, pionowe Z dla płaszczyzn)
        let exactAxisMatch: Tool | null = null;
        let minDiff = Infinity;

        for (const t of candidateDrills) {
            const allowed = t.allowedAxes || ['Z'];
            if (isAxisX && !allowed.includes('X')) continue;
            if (isAxisY && !allowed.includes('Y')) continue;
            if (!isHorizontal && !allowed.includes('Z')) continue;

            const diff = Math.abs(t.diameter - dia);
            if (diff <= 0.35 && diff < minDiff) {
                minDiff = diff;
                exactAxisMatch = t;
            }
        }

        if (exactAxisMatch) {
            return {
                tool: exactAxisMatch,
                strategyId: 'drilling',
                parameters: {
                    cycle: hole.depth > 25 ? 'G83_peck' : 'G81_standard',
                    retractR: hole.retractR || 5
                }
            };
        }

        const hasDiameterMatchOnOtherAxis = candidateDrills.some(t => Math.abs(t.diameter - dia) <= 0.35);

        return {
            tool: null,
            strategyId: 'drilling',
            warning: (hasDiameterMatchOnOtherAxis && isHorizontal)
                ? tx(cncTekst, 'rules.no_horizontal_drill', TX_NS)
                : tx(cncTekst, 'rules.no_tool', TX_NS, { dia })
        };
    }

    /**
     * Dobór narzędzia dla wpustu (piła nutująca dla rowków pod plecy 3-4mm, frez palcowy dla kanałów LED >4mm).
     */
    private resolveGroove(groove: GrooveFeature, toolLibrary: ToolLibrary): MachiningResolution {
        const width = Number(groove.width || 4);
        const allTools = toolLibrary.getAllTools();

        // LED (wewnętrzny 'BLOKI_LED' lub zewnętrzny kanał 'assembly_led_channel'):
        // tag purpose ze źródła (emiter CAD / extractor), nie nazwa.
        // Szerokość >= 8 mm to niezależna heurystyka geometryczna (nie językowa).
        const isLedChannel = groove.purpose === 'LED_CHANNEL' || width >= 8.0;

        // Jeśli wąski rowek (3-4 mm, np. na plecy szafy), preferuj piłę nutującą
        if (width <= 4.5 && !isLedChannel) {
            const saw = allTools.find(t => t.type === 'groove');
            if (saw) {
                const sawAllowed = saw.allowedAxes || ['X'];
                // Agregat piłowy maszyny idzie po osi X — nie przypisuj piły dla wpustu poprzecznego w osi Y, chyba że piła zezwala na Y
                const isAlongY = groove.startPoint && groove.endPoint &&
                    Math.abs(groove.endPoint.y - groove.startPoint.y) > Math.abs(groove.endPoint.x - groove.startPoint.x) + 0.1;
                if (!isAlongY || sawAllowed.includes('Y')) {
                    return {
                        tool: saw,
                        strategyId: 'profiling_25d',
                        parameters: {
                            isSawing: true,
                            cutWidth: width
                        }
                    };
                }
            }
        }

        // Dla kanałów LED lub wpustów frezowanych: szukamy optymalnego frezu palcowego
        const mills = allTools
            .filter(t => t.type === 'mill')
            .sort((a, b) => b.diameter - a.diameter); // od największego pasującego

        // Najlepszy frez to taki o średnicy równej lub mniejszej od szerokości rowka
        const fittingMill = mills.find(m => m.diameter <= width + 0.1);

        if (fittingMill) {
            const needsPocketing = fittingMill.diameter < width - 0.5;
            return {
                tool: fittingMill,
                strategyId: needsPocketing ? 'pocketing' : 'profiling_25d',
                parameters: {
                    isLedChannel,
                    pocketWidth: width,
                    depth: groove.depth,
                    stepover: fittingMill.diameter * 0.65
                }
            };
        }

        return {
            tool: null,
            strategyId: 'profiling_25d',
            warning: tx(cncTekst, 'rules.no_optimal_mill', TX_NS, { width, tool: tx(cncTekst, 'rules.unknown_tool', TX_NS) })
        };
    }

    /**
     * Dobór frezu dla konturu / podcięcia.
     */
    private resolveContour(contour: ContourFeature, toolLibrary: ToolLibrary): MachiningResolution {
        const allTools = toolLibrary.getAllTools();
        const mills = allTools.filter(t => t.type === 'mill');

        // Preferuj frez fi 8-12 mm
        let preferredMill = mills.find(m => m.diameter >= 8 && m.diameter <= 12);
        if (!preferredMill) {
            preferredMill = mills[0];
        }

        const chosen = preferredMill || null;
        return {
            tool: chosen,
            strategyId: 'profiling_25d',
            parameters: {
                compensation: contour.compensation || 'Left',
                depth: contour.depth
            }
        };
    }
}
