/**
 * SmartPanel Web — C1_CNC Machining Rule Engine
 * 
 * Inteligentny silnik reguł technologicznych (AFR - Automatic Feature Recognition).
 * Automatycznie dobiera narzędzia i strategie obróbcze na podstawie geometrii i typu cechy CAD
 * (wzorzec ze SWOOD CAM i imos iX).
 */

import { CAMFeature, HoleFeature, GrooveFeature, ContourFeature, Tool } from '../dto/cam-dto.js';
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
        } else if ('points' in feat) {
            return this.resolveContour(feat as ContourFeature, toolLibrary);
        }

        return {
            tool: toolLibrary.getAllTools()[0] || null,
            strategyId: 'profiling_25d',
            warning: tx(cncTekst, 'rules.unknown_feature', TX_NS)
        };
    }

    /**
     * Dobór wiertła dla otworu pionowego lub poziomego (czoła formatki).
     */
    private resolveHole(hole: HoleFeature, toolLibrary: ToolLibrary): MachiningResolution {
        const dia = hole.diameter;
        const face = String(hole.face || '').toUpperCase();
        const isHorizontal = face.startsWith('FACE_X') || face.startsWith('FACE_Y') || (
            hole.axis && (Math.abs(hole.axis.x) > 0.7 || Math.abs(hole.axis.y) > 0.7)
        );

        const allTools = toolLibrary.getAllTools();
        const candidateDrills = allTools.filter(t => t.type === 'drill');

        // 1. Dopasowanie z uwzględnieniem osi (poziome dla krawędzi, pionowe dla płaszczyzn)
        let exactAxisMatch: Tool | null = null;
        let minDiff = Infinity;

        for (const t of candidateDrills) {
            const allowed = t.allowedAxes || ['Z'];
            const supportsHorizontal = allowed.includes('X') || allowed.includes('Y');
            const supportsVertical = allowed.includes('Z');

            if (isHorizontal && !supportsHorizontal) continue;
            if (!isHorizontal && !supportsVertical) continue;

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

        // 2. Fallback: dowolne wiertło o odpowiedniej średnicy
        const anyDrill = toolLibrary.findBestHoleTool(dia, 0.35);
        if (anyDrill) {
            return {
                tool: anyDrill,
                strategyId: 'drilling',
                parameters: {
                    cycle: 'G81_standard',
                    retractR: hole.retractR || 5
                },
                warning: isHorizontal ? tx(cncTekst, 'rules.no_horizontal_drill', TX_NS) : undefined
            };
        }

        // 3. Ostateczny fallback: frez palcowy
        const millFallback = allTools.find(t => t.type === 'mill' && t.diameter <= dia);
        if (millFallback) {
            return {
                tool: millFallback,
                strategyId: 'drilling',
                warning: tx(cncTekst, 'rules.assigned_mill', TX_NS, { dia, tool: millFallback.name })
            };
        }

        return {
            tool: allTools[0] || null,
            strategyId: 'drilling',
            warning: tx(cncTekst, 'rules.no_tool', TX_NS, { dia })
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

        // Fallback: jakikolwiek frez lub narzędzie do rowków
        const fallback = allTools.find(t => t.type === 'mill' || t.type === 'groove') || allTools[0] || null;
        return {
            tool: fallback,
            strategyId: 'profiling_25d',
            warning: tx(cncTekst, 'rules.no_optimal_mill', TX_NS, { width, tool: fallback?.name || tx(cncTekst, 'rules.unknown_tool', TX_NS) })
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

        const chosen = preferredMill || allTools[0] || null;
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
