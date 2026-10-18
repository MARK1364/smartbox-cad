/**
 * SmartPanel Web — C1_CNC Geometry Extractor
 * 
 * Ekstrakcja cech CAM (otwory, wpusty, kontury) z obiektu PanelModel lub sceny 3D.
 */

import { HoleFeature, GrooveFeature, ContourFeature, CAMFeature, CAMData, Vector3D } from '../dto/cam-dto.js';
import { createVector3D, vecAdd, vecScale } from './cnc-geometry-utils.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { nearestEndFace } from '../../C2_connectors/connectors-embedment.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

export interface FaceData3D {
    origin: number[];  // [x, y, z]
    uAxis: number[];   // [x, y, z]
    vAxis: number[];   // [x, y, z]
    normal: number[];  // [x, y, z]
    width: number;
    height: number;
}

export class GeometryDataExtractor {

    /**
     * Ekstrahuje wszystkie cechy CAM z obiektu PanelModel.
     * @param panel - Instancja PanelModel lub generyczny obiekt z właściwościami panelu
     * @param wcsManager - opcjonalna instancja WcsManager do przeliczenia na współrzędne bazy obróbczej
     */
    public extractPanelFeatures(panel: any, wcsManager?: any, filterType?: 'hole' | 'groove' | 'contour' | null): CAMData {
        const features: CAMFeature[] = [];

        if (!panel || panel.frozen === true || panel.params?.frozen === true) {
            return {
                objectName: panel ? (panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS)) : tx(cncTekst, 'extractor.unknown', TX_NS),
                features: [],
                wcsOffset: wcsManager ? wcsManager.getOrigin() : createVector3D(),
                isDirty: false
            };
        }

        if (typeof panel.width !== 'number' || panel.width <= 0 ||
            typeof panel.height !== 'number' || panel.height <= 0 ||
            typeof panel.thickness !== 'number' || panel.thickness <= 0) {
            throw new Error(`[C1_cnc/geometry-extractor] Panel "${panel?.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel?.width}, H=${panel?.height}, T=${panel?.thickness}). Wymiary w nanometrach są wymagane do wygenerowania cech CAM.`);
        }

        const pW = nmToMm(panel.width);
        const pH = nmToMm(panel.height);
        const pT = nmToMm(panel.thickness);

        if (wcsManager) {
            wcsManager.updateForPanelDimensions(pW, pH, pT);
            // Strict: reguła WCS tylko z roli. Brak roli = brak reguły.
            const role = panel.role;
            const rule = WcsRulesMapper.getRuleForRole(role);
            if (rule) {
                wcsManager.setRule(rule);
            }
        }

        const panelName = panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS);
        const panelFeatures = panel.features || [];

        for (const feat of panelFeatures) {
            // Cecha zamrożona lub ukryta — CAM pipeline ją pomija (traktuje jak usuniętą)
            if (feat.cam_frozen === true || feat.frozen === true || feat.params?.frozen === true || feat.visible === false || feat.params?.visible === false) continue;

            // Filtr typów — przycisk "Wykryj otwory" pobiera tylko otwory, itd.
            if (filterType) {
                const t = (feat.type || '').toLowerCase();
                if (filterType === 'hole'    && t !== 'hole' && t !== 'drill')                continue;
                if (filterType === 'groove'  && t !== 'groove' && t !== 'nut')               continue;
                if (filterType === 'contour' && t !== 'contour' && t !== 'profile')          continue;
            }

            let faceName = feat.face;
            if (faceName === '+Z' || faceName === 'front' || faceName === 'FRONT') faceName = 'FACE_Z_PLUS';
            else if (faceName === '-Z' || faceName === 'back' || faceName === 'BACK') faceName = 'FACE_Z_MINUS';
            else if (faceName === '+X' || faceName === 'right' || faceName === 'RIGHT') faceName = 'FACE_X_PLUS';
            else if (faceName === '-X' || faceName === 'left' || faceName === 'LEFT') faceName = 'FACE_X_MINUS';
            else if (faceName === '+Y' || faceName === 'top' || faceName === 'TOP') faceName = 'FACE_Y_PLUS';
            else if (faceName === '-Y' || faceName === 'bottom' || faceName === 'BOTTOM') faceName = 'FACE_Y_MINUS';
            else if (!faceName) faceName = 'FACE_Z_PLUS';

            const params = feat.params || {};
            const depthHint = Number(params.depth || 12);

            // Czoło wieńca nigdy nie jest FACE_Z (oś Z = grubość). Przepnij na najbliższy koniec.
            const isEdgeConn = params.faceType === 'EDGE' || (
                params.isConnectorDrilling === true &&
                params.faceType !== 'FACE' &&
                String(faceName || '').includes('FACE_Z') &&
                depthHint > pT + 0.5
            );
            if (isEdgeConn && String(faceName || '').includes('FACE_Z')) {
                const u0 = Number(params.u ?? params.x ?? 0);
                const v0 = Number(params.v ?? params.y ?? 0);
                faceName = nearestEndFace(u0 - pW / 2, v0 - pH / 2, pW, pH);
            }

            let faceData: FaceData3D | null = null;
            if (panel.getFace && typeof panel.getFace === 'function') {
                try {
                    faceData = panel.getFace(faceName);
                } catch {
                    faceData = null;
                }
            }

            // PanelModel.getFace() zwraca origin/width/height w mm.

            if (feat.type === 'hole' || feat.type === 'HOLE' || feat.type === 'drill') {
                const diameter = Number(params.diameter || params.dia || 8);
                const depth = Number(params.depth || 12);
                let u = Number(params.x || params.u || 0);
                let v = Number(params.y || params.v || 0);
                if (isEdgeConn && String(faceName || '').startsWith('FACE_X')) {
                    u = pT / 2;
                } else if (isEdgeConn && String(faceName || '').startsWith('FACE_Y')) {
                    v = pT / 2;
                }

                let pos: Vector3D;
                let axis: Vector3D;

                if (faceData) {
                    pos = {
                        x: faceData.origin[0] + u * faceData.uAxis[0] + v * faceData.vAxis[0],
                        y: faceData.origin[1] + u * faceData.uAxis[1] + v * faceData.vAxis[1],
                        z: faceData.origin[2] + u * faceData.uAxis[2] + v * faceData.vAxis[2],
                    };
                    axis = {
                        x: -faceData.normal[0],
                        y: -faceData.normal[1],
                        z: -faceData.normal[2]
                    };
                } else {
                    pos = { x: u, y: v, z: 0 };
                    axis = { x: 0, y: 0, z: -1 };
                }

                const through = params.through === true || (
                    Number.isFinite(pT) &&
                    depth >= pT - 0.51 &&
                    String(faceName || '').includes('FACE_Z')
                );
                const faceKey = faceName || undefined;

                const existingGroup = features.find(f => 
                    'diameter' in f && 
                    (f as HoleFeature).diameter === diameter && 
                    (f as HoleFeature).depth === depth &&
                    (f as HoleFeature).face === faceKey &&
                    !!(f as HoleFeature).through === !!through
                ) as HoleFeature | undefined;

                const featLabel = feat.name ?? params?.name;
                const holeLabel = featLabel || tx(cncTekst, 'extractor.hole_label', TX_NS, { d: diameter, h: depth });

                if (existingGroup) {
                    if (!existingGroup.positions) {
                        existingGroup.positions = [existingGroup.position];
                    }
                    existingGroup.positions.push(pos);
                    if (!existingGroup.panelPositions) {
                        existingGroup.panelPositions = existingGroup.positions.map(p => ({ ...p }));
                    } else {
                        existingGroup.panelPositions.push({ ...pos });
                    }
                    existingGroup.holeCount = existingGroup.positions.length;
                    if (feat.id && existingGroup.childFeatureIds) {
                        existingGroup.childFeatureIds.push(feat.id);
                    }
                    existingGroup.name = `${holeLabel} (${existingGroup.holeCount}×)`;
                } else {
                    features.push({
                        featureId: `hole_grp_${diameter}_${depth}_${faceKey || 'na'}_${feat.id || Math.random().toString(36).substring(2, 7)}`,
                        name: holeLabel,
                        objectName: panelName,
                        diameter,
                        depth,
                        position: pos,
                        positions: [pos],
                        panelPosition: { ...pos },
                        panelPositions: [{ ...pos }],
                        holeCount: 1,
                        childFeatureIds: feat.id ? [feat.id] : [],
                        axis,
                        face: faceKey,
                        through: through || undefined,
                        retractR: Number(params.retractR || 5.0),
                        toolId: feat.toolId || null
                    } as HoleFeature);
                }

            } else if (feat.type === 'groove' || feat.type === 'GROOVE' || feat.type === 'nut') {
                const gp = getGrooveParamsMm(params);
                let width = gp.width || Number(params.width || 4);
                const depth = gp.depth || Number(params.depth || 8);

                let startPoint: Vector3D;
                let endPoint: Vector3D;

                if (params.startPoint && params.endPoint) {
                    startPoint = { ...params.startPoint };
                    endPoint = { ...params.endPoint };
                } else if (faceData) {
                    let u1 = Number(params.x1 || 0);
                    let v1 = Number(params.y1 || 0);
                    let u2 = Number(params.x2 || faceData.width);
                    let v2 = Number(params.y2 || 0);

                    const gW = gp.width || Number(params.width || 0);
                    const gL = gp.length || Number(params.length || 0);

                    if (gW > 0 && gL > 0) {
                        const u = gp.u;
                        const v = gp.v;

                        if (gW < gL) {
                            width = gW;
                            u1 = u + gW / 2;
                            v1 = v;
                            u2 = u + gW / 2;
                            v2 = v + gL;
                        } else {
                            width = gL;
                            u1 = u;
                            v1 = v + gL / 2;
                            u2 = u + gW;
                            v2 = v + gL / 2;
                        }
                    }

                    startPoint = {
                        x: faceData.origin[0] + u1 * faceData.uAxis[0] + v1 * faceData.vAxis[0],
                        y: faceData.origin[1] + u1 * faceData.uAxis[1] + v1 * faceData.vAxis[1],
                        z: faceData.origin[2] + u1 * faceData.uAxis[2] + v1 * faceData.vAxis[2]
                    };

                    endPoint = {
                        x: faceData.origin[0] + u2 * faceData.uAxis[0] + v2 * faceData.vAxis[0],
                        y: faceData.origin[1] + u2 * faceData.uAxis[1] + v2 * faceData.vAxis[1],
                        z: faceData.origin[2] + u2 * faceData.uAxis[2] + v2 * faceData.vAxis[2]
                    };
                } else {
                    // Panel już zwalidowany na wejściu ekstraktora — użyj pW, bez zgadywania 600.
                    startPoint = { x: 0, y: 0, z: 0 };
                    endPoint = { x: pW, y: 0, z: 0 };
                }

                const grooveLabel = feat.name ?? params?.name;
                features.push({
                    featureId: `groove_${feat.id || Math.random().toString(36).substring(2, 9)}`,
                    name: grooveLabel || tx(cncTekst, 'extractor.groove_label', TX_NS, { n: features.length + 1 }),
                    // Intencja z kodu źródłowego cechy CAD, nie z nazwy. Dwa odrębne systemy LED:
                    // BLOKI_LED = LED wewnętrzny (sync A2, led-internal-engine) — profil we wnętrzu szafki,
                    // assembly_led_channel = LED zewnętrzny (kanał) (A2_bloki/led-channel-engine) — kanał pod korpusami.
                    purpose: (params.source === 'BLOKI_LED' || params.source === 'assembly_led_channel')
                        ? 'LED_CHANNEL'
                        : undefined,
                    objectName: panelName,
                    face: faceName || 'FACE_Z_PLUS',
                    width,
                    depth,
                    startPoint,
                    endPoint,
                    panelStartPoint: { ...startPoint },
                    panelEndPoint: { ...endPoint },
                    toolId: feat.toolId || null,
                    leadIn: 0,
                    leadOut: 0,
                    flipDepthDirection: false
                } as GrooveFeature);

            } else if (feat.type === 'contour' || feat.type === 'CONTOUR' || feat.type === 'profile') {
                const depth = Number(params.depth !== undefined ? params.depth : pT);
                const points: Vector3D[] = (params.points || []).map((p: any) => ({ x: p.x || 0, y: p.y || 0, z: p.z || 0 }));

                const contourLabel = feat.name ?? params?.name;
                features.push({
                    featureId: `contour_${feat.id || Math.random().toString(36).substring(2, 9)}`,
                    name: contourLabel || tx(cncTekst, 'extractor.contour_label', TX_NS, { n: features.length + 1 }),
                    objectName: panelName,
                    depth,
                    points,
                    toolId: feat.toolId || null
                } as ContourFeature);
            }
        }

        // Transformacja współrzędnych względem WCS jeśli podano wcsManager
        if (wcsManager) {
            for (const f of features) {
                if ('position' in f) {
                    const hf = f as HoleFeature;
                    if (!hf.panelPosition) {
                        hf.panelPosition = { ...hf.position };
                    }
                    if (!hf.panelPositions && hf.positions) {
                        hf.panelPositions = hf.positions.map(p => ({ ...p }));
                    }
                    f.position = wcsManager.toWcsCoordinates(f.position);
                    if ('axis' in f && f.axis) {
                        f.axis = wcsManager.transformVector(f.axis);
                    }
                    if (hf.positions && Array.isArray(hf.positions)) {
                        hf.positions = hf.positions.map(p => wcsManager.toWcsCoordinates(p));
                    }
                }
                if ('startPoint' in f && 'endPoint' in f) {
                    const gf = f as GrooveFeature;
                    if (!gf.panelStartPoint) gf.panelStartPoint = { ...gf.startPoint };
                    if (!gf.panelEndPoint) gf.panelEndPoint = { ...gf.endPoint };
                    f.startPoint = wcsManager.toWcsCoordinates(f.startPoint);
                    f.endPoint = wcsManager.toWcsCoordinates(f.endPoint);
                }
                if ('points' in f && Array.isArray(f.points)) {
                    f.points = f.points.map((p: any) => wcsManager.toWcsCoordinates(p));
                }
            }
        }

        return {
            objectName: panelName,
            features,
            wcsOffset: wcsManager ? wcsManager.getOrigin() : createVector3D(),
            isDirty: false
        };
    }
}
