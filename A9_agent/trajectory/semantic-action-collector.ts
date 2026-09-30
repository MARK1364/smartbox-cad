/**
 * semantic-action-collector.ts
 * Zbieracz zdarzeń domenowych CAD oraz zmian stanu szafki dla modułu A9_agent.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import {
  CabinetStateSnapshot,
  SemanticAction,
  DomainActionType,
} from './trajectory-types.js';

export class SemanticActionCollector {
  private static _instance: SemanticActionCollector | null = null;

  public static get instance(): SemanticActionCollector {
    if (!this._instance) {
      this._instance = new SemanticActionCollector();
    }
    return this._instance;
  }

  /**
   * Tworzy precyzyjny snapshot bieżącego stanu szafki w dokumencie CAD.
   */
  captureCabinetSnapshot(): CabinetStateSnapshot | undefined {
    const doc = ContextManager.instance.document;
    if (!doc) return undefined;

    const containers = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
    if (containers.length === 0) return undefined;

    // Główny korpus mebla
    const mainKorpusNode = containers[0];
    const domainData = (mainKorpusNode.domainData || mainKorpusNode) as any;
    const params = domainData.generatorParams || {};

    const widthMm = domainData.width !== undefined ? Math.round(nmToMm(domainData.width)) : (params.szerokosc_mm || 1000);
    const heightMm = domainData.height !== undefined ? Math.round(nmToMm(domainData.height)) : (params.wysokosc_mm || 2200);
    const depthMm = domainData.depth !== undefined ? Math.round(nmToMm(domainData.depth)) : (params.glebokosc_mm || 600);
    const zoneCount = Number(params.liczba_stref || 1);

    const submodules: Array<{ id: string; name: string; boxType: string; zoneIndex?: number }> = [];
    for (let i = 1; i < containers.length; i++) {
      const c = containers[i];
      const cData = (c.domainData || c) as any;
      const cParams = cData.generatorParams || {};
      const boxType = cParams.boxType || (cParams.type ? cParams.type.replace('blok_', '').toUpperCase() : 'UNKNOWN');
      submodules.push({
        id: c.id,
        name: c.name || cData.name || `Moduł ${i}`,
        boxType,
        zoneIndex: cParams.zoneIndex,
      });
    }

    const panels = typeof doc.getPanels === 'function' ? doc.getPanels() : [];

    return {
      widthMm,
      heightMm,
      depthMm,
      liczba_stref: zoneCount,
      zoneHeightsMm: {
        bottom: params.wysokosc_strefy_dolnej_mm,
        middle: params.wysokosc_strefy_srodkowej_mm,
      },
      submodules,
      panelsCount: panels.length,
    };
  }

  /**
   * Tworzy semantyczną akcję na podstawie zdarzenia domenowego lub mutacji.
   */
  createAction(
    type: DomainActionType,
    intent: string,
    parameters: Record<string, any> = {},
    target?: { entityId?: string; bayIndex?: number; zoneIndex?: number }
  ): SemanticAction {
    const rules: string[] = [];

    // Podstawowa walidacja stolarska
    if (type === 'CREATE_KORPUS' && parameters.liczba_stref) {
      rules.push(`strefy_liczba_${parameters.liczba_stref}`);
    }
    if (parameters.boxType === 'DIVIDERS') {
      rules.push('moduł_pionowych_przegród_wnęki');
    }

    return {
      timestampMs: Date.now(),
      type,
      intent,
      target,
      parameters,
      furnitureRulesMatched: rules,
    };
  }
}
