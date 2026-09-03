/**
 * SmartPanel Web — C1_CNC Geometry Extractor
 * 
 * Ekstrakcja cech CAM (otwory, wpusty, kontury) z obiektu PanelModel lub sceny 3D.
 */

import { HoleFeature, GrooveFeature, ContourFeature, CAMFeature, CAMData, Vector3D } from '../dto/cam-dto.js';
import { createVector3D, vecAdd, vecScale } from './cnc-geometry-utils.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { nearestEndFace } from '../../C2_connectors/connectors-embedment.js';

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

        if (!panel) {
            return {
                objectName: "Unknown",
                features: [],
                wcsOffset: wcsManager ? wcsManager.getOrigin() : createVector3D(),
                isDirty: false
            };
        }

        const pW = typeof panel.width === 'number' ? nmToMm(panel.width) : 600;
        const pH = typeof panel.height === 'number' ? nmToMm(panel.height) : 720;
        const pT = typeof panel.thickness === 'number' ? nmToMm(panel.thickness) : 18;

        if (wcsManager) {
            wcsManager.updateForPanelDimensions(pW, pH, pT);
            const role = panel.role || panel.name;
            const rule = WcsRulesMapper.getRuleForRole(role);
            if (rule) {
                wcsManager.setRule(rule);
            }
        }

        const panelName = panel.name || "Płyta";
        const panelFeatures = panel.features || [];

        for (const feat of panelFeatures) {
            // Cecha zamrożona przez CAD — CAM pipeline ją pomija
            if (feat.cam_frozen === true) continue;

            // Filtr typów — przycisk "Wykryj otwory" pobiera tylko otwory, itd.
            if (filterType) {
                const t = (feat.type || '').toLowerCase();
                if (filterType === 'hole'    && t !== 'hole' && t !== 'drill')                continue;
                if (filterType === 'groove'  && t !== 'groove' && t !== 'nut')               continue;
                if (filterType === 'contour' && t !== 'contour' && t !== 'profile')          continue;
            }

            let faceName = feat.face;
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

                const holeLabel = feat.name || params.name || `Otwór ⌀${diameter}x${depth}mm`;

                if (existingGroup) {
                    if (!existingGroup.positions) {
                        existingGroup.positions = [existingGroup.position];
                    }
                    existingGroup.positions.push(pos);
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
                let width = Number(params.width || 4);
                const depth = Number(params.depth || 8);

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

                    if (params.u !== undefined && params.v !== undefined && params.length !== undefined) {
                        const u = Number(params.u);
                        const v = Number(params.v);
                        const gW = Number(params.width);
                        const gL = Number(params.length);

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
                    const pW = typeof panel.width === 'number' ? nmToMm(panel.width) : 600;
                    startPoint = { x: 0, y: 0, z: 0 };
                    endPoint = { x: pW, y: 0, z: 0 };
                }

                features.push({
                    featureId: `groove_${feat.id || Math.random().toString(36).substring(2, 9)}`,
                    name: feat.name || params.name || `Wpust_${features.length + 1}`,
                    objectName: panelName,
                    width,
                    depth,
                    startPoint,
                    endPoint,
                    toolId: feat.toolId || null,
                    leadIn: 0,
                    leadOut: 0,
                    flipDepthDirection: false
                } as GrooveFeature);

            } else if (feat.type === 'contour' || feat.type === 'CONTOUR' || feat.type === 'profile') {
                const pThickness = typeof panel.thickness === 'number' ? nmToMm(panel.thickness) : 18;
                const depth = Number(params.depth !== undefined ? params.depth : pThickness);
                const points: Vector3D[] = (params.points || []).map((p: any) => ({ x: p.x || 0, y: p.y || 0, z: p.z || 0 }));

                features.push({
                    featureId: `contour_${feat.id || Math.random().toString(36).substring(2, 9)}`,
                    name: feat.name || params.name || `Profil_${features.length + 1}`,
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
                    f.position = wcsManager.toWcsCoordinates(f.position);
                    if ('axis' in f && f.axis) {
                        f.axis = wcsManager.transformVector(f.axis);
                    }
                    const hf = f as HoleFeature;
                    if (hf.positions && Array.isArray(hf.positions)) {
                        hf.positions = hf.positions.map(p => wcsManager.toWcsCoordinates(p));
                    }
                }
                if ('startPoint' in f && 'endPoint' in f) {
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
