/**
 * SmartPanel Web — C1_CNC Geometry Extractor
 * 
 * Ekstrakcja cech CAM (otwory, wpusty, kontury) z obiektu PanelModel lub sceny 3D.
 */

import { HoleFeature, GrooveFeature, ContourFeature, PocketFeature, CAMFeature, CAMData, Vector3D } from '../dto/cam-dto.js';
import { createVector3D, vecAdd, vecScale } from './cnc-geometry-utils.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { normalizeFaceName } from '../../A1_core/face-name.js';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { nearestEndFace } from '../../C2_connectors/connectors-embedment.js';
import { computeFaceData } from '../../A4_smartpanel/native_core/face-lcs.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

/** Dopuszczalny przebój wiertła dla otworów przelotowych (mm) */
export const MAX_THROUGH_OVERDRILL_MM = 5.0;
/** Dopuszczalna tolerancja niedowiercenia przy uznawaniu otworu za przelotowy (mm) */
export const MIN_THROUGH_DEPTH_TOLERANCE_MM = 0.51;

export interface FaceData3D {
    origin: number[];  // [x, y, z]
    uAxis: number[];   // [x, y, z]
    vAxis: number[];   // [x, y, z]
    normal: number[];  // [x, y, z]
    width: number;
    height: number;
}

/**
 * Sprawdza, czy cecha jest dostępna do obróbki z bieżącego układu WCS
 * w oparciu o wektor podejścia wrzeciona (kierunek osi Z).
 *
 * W standardowym 3-osiowym układzie WCS narzędzie schodzi z góry (+Z ku -Z).
 * Cechy znajdujące się na dolnej powierzchni formatki (spodzie) mają:
 *  - otwory: axis.z > 0.1 (wymagałyby wiercenia od spodu ku górze, przez stół maszyny)
 *  - frezowania/wpusty/kieszenie/kontury: normal.z < -0.1 (powierzchnia zwrócona w dół, ku stołowi)
 * Te cechy nie mogą być wycinane z jednego układu WCS z cechami górnymi.
 */
export function isFeatureMachinableInWcs(feature: CAMFeature): boolean {
    if ('axis' in feature && feature.axis) {
        if (feature.axis.z > 0.1) {
            return false;
        }
    } else if ('position' in feature && (feature as HoleFeature).panelAxis) {
        if ((feature as HoleFeature).panelAxis!.z > 0.1) {
            return false;
        }
    }

    if ('normal' in feature && (feature as any).normal) {
        const norm = (feature as any).normal;
        if (norm.z < -0.1) {
            return false;
        }
    } else if ('panelNormal' in feature && (feature as any).panelNormal) {
        const pNorm = (feature as any).panelNormal;
        if (pNorm.z < -0.1) {
            return false;
        }
    }

    return true;
}

export class GeometryDataExtractor {

    /**
     * Ekstrahuje wszystkie cechy CAM z obiektu PanelModel.
     * @param panel - Instancja PanelModel lub generyczny obiekt z właściwościami panelu
     * @param wcsManager - opcjonalna instancja WcsManager do przeliczenia na współrzędne bazy obróbczej
     */
    public extractPanelFeatures(panel: any, wcsManager?: any, filterType?: 'hole' | 'groove' | 'contour' | 'pocket' | null): CAMData {
        const features: CAMFeature[] = [];

        if (!panel || panel.frozen === true || panel.params?.frozen === true) {
            return {
                objectName: panel ? (panel.name || tx(cncTekst, 'extractor.panel_default', TX_NS)) : tx(cncTekst, 'extractor.unknown', TX_NS),
                features: [],
                wcsOffset: wcsManager ? wcsManager.getOrigin() : createVector3D(),
                isDirty: false
            };
        }

        if (typeof panel.width !== 'number' || !Number.isFinite(panel.width) || panel.width <= 0 ||
            typeof panel.height !== 'number' || !Number.isFinite(panel.height) || panel.height <= 0 ||
            typeof panel.thickness !== 'number' || !Number.isFinite(panel.thickness) || panel.thickness <= 0) {
            throw new Error(`[C1_cnc/geometry-extractor] Panel "${panel?.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel?.width}, H=${panel?.height}, T=${panel?.thickness}). Wymiary w nanometrach są wymagane do wygenerowania cech CAM.`);
        }

        const pW = nmToMm(panel.width);
        const pH = nmToMm(panel.height);
        const pT = nmToMm(panel.thickness);

        if (wcsManager) {
            wcsManager.updateForPanelDimensions(pW, pH, pT);
            // Strict: reguła WCS z roli tylko wtedy, gdy wcsManager nie posiada jeszcze jawnie skonfigurowanej reguły
            if (typeof wcsManager.isRuleConfigured === 'function' ? !wcsManager.isRuleConfigured() : true) {
                const role = panel.role;
                const rule = WcsRulesMapper.getRuleForRole(role);
                if (rule) {
                    wcsManager.setRule(rule);
                }
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
                if (filterType === 'contour' && t !== 'contour' && t !== 'profile' && t !== 'cutout') continue;
                if (filterType === 'pocket'  && t !== 'pocket')                              continue;
            }

            let faceName = normalizeFaceName(feat.face || 'FACE_Z_PLUS');

            const params = feat.params || {};
            const depthHint = Number(params.depth ?? 12);

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
                faceData = panel.getFace(faceName);
            }
            if (!faceData) {
                faceData = computeFaceData(faceName, pW, pH, pT);
            }
            const isValidVec3Array = (arr: any, requireNonZero: boolean): boolean => {
                if (!Array.isArray(arr) || arr.length < 3) return false;
                const [x, y, z] = arr;
                if (typeof x !== 'number' || !Number.isFinite(x) ||
                    typeof y !== 'number' || !Number.isFinite(y) ||
                    typeof z !== 'number' || !Number.isFinite(z)) {
                    return false;
                }
                if (requireNonZero && Math.hypot(x, y, z) < 1e-6) {
                    return false;
                }
                return true;
            };

            if (
                !faceData ||
                !isValidVec3Array(faceData.origin, false) ||
                !isValidVec3Array(faceData.uAxis, true) ||
                !isValidVec3Array(faceData.vAxis, true) ||
                !isValidVec3Array(faceData.normal, true) ||
                (faceData.width !== undefined && (typeof faceData.width !== 'number' || !Number.isFinite(faceData.width) || faceData.width <= 0)) ||
                (faceData.height !== undefined && (typeof faceData.height !== 'number' || !Number.isFinite(faceData.height) || faceData.height <= 0))
            ) {
                throw new Error(`[C1_cnc/geometry-extractor] Nie udało się wyznaczyć poprawnego układu ściany "${faceName}" dla cechy "${feat.id || feat.type}".`);
            }

            // PanelModel.getFace() zwraca origin/width/height w mm.

            if (feat.type === 'hole' || feat.type === 'HOLE' || feat.type === 'drill') {
                const rawDia = params.diameter ?? params.dia ?? 8;
                const diameter = Number(rawDia);
                if (!Number.isFinite(diameter) || diameter <= 0) {
                    throw new Error(`[C1_cnc/geometry-extractor] Średnica otworu musi być skończoną liczbą dodatnią dla cechy "${feat.id || 'hole'}" (diameter=${rawDia}).`);
                }
                const rawDepth = params.depth ?? 12;
                const depth = Number(rawDepth);
                if (!Number.isFinite(depth) || Math.abs(depth) < 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Głębokość wiercenia musi być niezerową skończoną liczbą dla cechy "${feat.id || 'hole'}" (depth=${rawDepth}).`);
                }
                const rawRetractR = params.retractR ?? 5.0;
                const retractR = Number(rawRetractR);
                if (!Number.isFinite(retractR) || retractR <= 0) {
                    throw new Error(`[C1_cnc/geometry-extractor] Odskok bezpieczny (retractR) musi być skończoną liczbą dodatnią dla cechy "${feat.id || 'hole'}" (retractR=${rawRetractR}).`);
                }
                const rawU = params.x ?? params.u ?? 0;
                const rawV = params.y ?? params.v ?? 0;
                let u = Number(rawU);
                let v = Number(rawV);
                if (!Number.isFinite(u) || !Number.isFinite(v)) {
                    throw new Error(`[C1_cnc/geometry-extractor] Współrzędne otworu (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'hole'}" (u=${rawU}, v=${rawV}).`);
                }
                if (isEdgeConn && String(faceName || '').startsWith('FACE_X')) {
                    u = pT / 2;
                } else if (isEdgeConn && String(faceName || '').startsWith('FACE_Y')) {
                    v = pT / 2;
                }

                const maxU = faceData.width ?? (String(faceName || '').startsWith('FACE_X') ? pT : pW);
                const maxV = faceData.height ?? (String(faceName || '').startsWith('FACE_Y') ? pT : pH);
                if (u < -1e-4 || u > maxU + 1e-4 || v < -1e-4 || v > maxV + 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Pozycja otworu (u=${u}, v=${v}) wykracza poza granice ściany "${faceName}" (0..${maxU} x 0..${maxV} mm) dla cechy "${feat.id || 'hole'}".`);
                }

                const pos: Vector3D = {
                    x: faceData.origin[0] + u * faceData.uAxis[0] + v * faceData.vAxis[0],
                    y: faceData.origin[1] + u * faceData.uAxis[1] + v * faceData.vAxis[1],
                    z: faceData.origin[2] + u * faceData.uAxis[2] + v * faceData.vAxis[2],
                };
                const axis: Vector3D = {
                    x: -faceData.normal[0],
                    y: -faceData.normal[1],
                    z: -faceData.normal[2]
                };

                const isFaceZ = String(faceName || '').includes('FACE_Z');
                const materialSpan = isFaceZ
                    ? pT
                    : (String(faceName || '').startsWith('FACE_X') ? pW : pH);
                const through = params.through === true || (
                    params.through !== false &&
                    Number.isFinite(materialSpan) &&
                    Math.abs(depth) >= materialSpan - MIN_THROUGH_DEPTH_TOLERANCE_MM &&
                    Math.abs(depth) <= materialSpan + MAX_THROUGH_OVERDRILL_MM + 1e-4
                );
                if (through && Math.abs(depth) < materialSpan - MIN_THROUGH_DEPTH_TOLERANCE_MM) {
                    throw new Error(`[C1_cnc/geometry-extractor] Otwór przelotowy (through=true) ma głębokość (${Math.abs(depth)}mm) mniejszą niż wymiar materiału (${materialSpan}mm dla ściany "${faceName}") dla cechy "${feat.id || 'hole'}".`);
                }
                const maxBlindDepth = materialSpan - MIN_THROUGH_DEPTH_TOLERANCE_MM;
                if (!through && Math.abs(depth) >= maxBlindDepth - 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Otwór nieprzelotowy (through=false) o głębokości (${Math.abs(depth)}mm) przebija lub niemal przebija wymiar materiału (${materialSpan}mm, maks. głębokość nieprzelotowa ${maxBlindDepth}mm dla ściany "${faceName}") dla cechy "${feat.id || 'hole'}".`);
                }
                const maxHoleDepth = through ? materialSpan + MAX_THROUGH_OVERDRILL_MM : maxBlindDepth;
                if (Math.abs(depth) > maxHoleDepth + 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Głębokość wiercenia (${Math.abs(depth)}mm) przekracza wymiar materiału (${materialSpan}mm, maks. ${maxHoleDepth}mm dla ściany "${faceName}") dla cechy "${feat.id || 'hole'}".`);
                }

                const faceKey = faceName || undefined;
                const holeToolId = feat.toolId || params.toolId || null;
                const extraGroupSuffix = `${holeToolId ? `_${holeToolId}` : ''}${Math.abs(retractR - 5.0) > 1e-4 ? `_r${Math.round(retractR * 10)}` : ''}`;

                const existingGroup = features.find(f => 
                    'diameter' in f && 
                    (f as HoleFeature).diameter === diameter && 
                    (f as HoleFeature).depth === depth &&
                    (f as HoleFeature).face === faceKey &&
                    !!(f as HoleFeature).through === !!through &&
                    Math.abs(((f as HoleFeature).retractR ?? 5.0) - retractR) <= 1e-4 &&
                    ((f as HoleFeature).toolId || null) === holeToolId
                ) as HoleFeature | undefined;

                const featLabel = feat.name ?? params?.name;
                const holeLabel = featLabel || tx(cncTekst, 'extractor.hole_label', TX_NS, { d: diameter, h: depth });

                if (existingGroup) {
                    if (!existingGroup.positions) {
                        existingGroup.positions = [existingGroup.position];
                    }
                    existingGroup.positions.push(pos);
                    existingGroup.positions.sort((a, b) => (a.x !== b.x ? a.x - b.x : (a.y !== b.y ? a.y - b.y : a.z - b.z)));
                    existingGroup.panelPositions = existingGroup.positions.map(p => ({ ...p }));
                    existingGroup.holeCount = existingGroup.positions.length;
                    if (feat.id && existingGroup.childFeatureIds) {
                        existingGroup.childFeatureIds.push(feat.id);
                        existingGroup.childFeatureIds.sort();
                    }
                    existingGroup.name = `${holeLabel} (${existingGroup.holeCount}×)`;
                    const pFirst = existingGroup.positions[0];
                    const pLast = existingGroup.positions[existingGroup.positions.length - 1];
                    existingGroup.featureId = `hole_grp_${diameter}_${depth}_${faceKey || 'na'}_${Math.round(pFirst.x * 10)}_${Math.round(pFirst.y * 10)}_${Math.round(pLast.x * 10)}_${Math.round(pLast.y * 10)}${extraGroupSuffix}`;
                } else {
                    const detHoleKey = `${diameter}_${depth}_${faceKey || 'na'}_${Math.round(pos.x * 10)}_${Math.round(pos.y * 10)}_${Math.round(pos.z * 10)}${extraGroupSuffix}`;
                    features.push({
                        featureId: `hole_grp_${detHoleKey}`,
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
                        panelAxis: axis ? { ...axis } : null,
                        face: faceKey,
                        through: through || undefined,
                        retractR,
                        toolId: holeToolId
                    } as HoleFeature);
                }

            } else if (feat.type === 'pocket') {
                const gp = getGrooveParamsMm(params);
                const hasExplicitWidth = params.width !== undefined || params.width_nm !== undefined;
                const w = hasExplicitWidth ? Number(gp.width) : 0;
                const l = (params.length !== undefined || params.length_nm !== undefined) ? Number(gp.length) : Number(params.height ?? 0);
                const hasExplicitDepth = params.depth !== undefined || params.depth_nm !== undefined;
                const depth = hasExplicitDepth ? Number(gp.depth) : 3;
                const u = Number(gp.u);
                const v = Number(gp.v);
                if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(l) || l <= 0) {
                    throw new Error(`[C1_cnc/geometry-extractor] Wymiary kieszeni (width, length) muszą być skończonymi liczbami dodatnimi dla cechy "${feat.id || 'pocket'}" (width=${w}, length=${l}).`);
                }
                if (!Number.isFinite(depth) || Math.abs(depth) < 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Głębokość kieszeni musi być niezerową skończoną liczbą dla cechy "${feat.id || 'pocket'}" (depth=${depth}).`);
                }
                const pocketMaterialSpan = String(faceName || '').includes('FACE_Z')
                    ? pT
                    : (String(faceName || '').startsWith('FACE_X') ? pW : pH);
                if (Math.abs(depth) > pocketMaterialSpan + 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Głębokość kieszeni (${Math.abs(depth)}mm) przekracza wymiar materiału (${pocketMaterialSpan}mm dla ściany "${faceName}") dla cechy "${feat.id || 'pocket'}".`);
                }
                if (!Number.isFinite(u) || !Number.isFinite(v)) {
                    throw new Error(`[C1_cnc/geometry-extractor] Współrzędne kieszeni (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'pocket'}" (u=${u}, v=${v}).`);
                }

                const p0: Vector3D = {
                    x: faceData.origin[0] + u * faceData.uAxis[0] + v * faceData.vAxis[0],
                    y: faceData.origin[1] + u * faceData.uAxis[1] + v * faceData.vAxis[1],
                    z: faceData.origin[2] + u * faceData.uAxis[2] + v * faceData.vAxis[2]
                };
                const p1: Vector3D = {
                    x: faceData.origin[0] + (u + w) * faceData.uAxis[0] + v * faceData.vAxis[0],
                    y: faceData.origin[1] + (u + w) * faceData.uAxis[1] + v * faceData.vAxis[1],
                    z: faceData.origin[2] + (u + w) * faceData.uAxis[2] + v * faceData.vAxis[2]
                };
                const p2: Vector3D = {
                    x: faceData.origin[0] + (u + w) * faceData.uAxis[0] + (v + l) * faceData.vAxis[0],
                    y: faceData.origin[1] + (u + w) * faceData.uAxis[1] + (v + l) * faceData.vAxis[1],
                    z: faceData.origin[2] + (u + w) * faceData.uAxis[2] + (v + l) * faceData.vAxis[2]
                };
                const p3: Vector3D = {
                    x: faceData.origin[0] + u * faceData.uAxis[0] + (v + l) * faceData.vAxis[0],
                    y: faceData.origin[1] + u * faceData.uAxis[1] + (v + l) * faceData.vAxis[1],
                    z: faceData.origin[2] + u * faceData.uAxis[2] + (v + l) * faceData.vAxis[2]
                };
                const boundaryPoints: Vector3D[] = [p0, p1, p2, p3];

                const faceNormal: Vector3D = {
                    x: faceData.normal[0],
                    y: faceData.normal[1],
                    z: faceData.normal[2]
                };

                const pocketLabel = feat.name ?? params?.name;
                const detPocketKey = `${faceName || 'na'}_${Math.round(u * 10)}_${Math.round(v * 10)}_${Math.round(w * 10)}_${Math.round(l * 10)}`;
                features.push({
                    featureId: feat.id ? `pocket_${feat.id}` : `pocket_${detPocketKey}`,
                    name: pocketLabel || tx(cncTekst, 'extractor.pocket_label', TX_NS, { n: features.length + 1 }),
                    objectName: panelName,
                    face: faceName || 'FACE_Z_PLUS',
                    width: w,
                    length: l,
                    depth,
                    boundaryPoints,
                    panelBoundaryPoints: boundaryPoints.map(p => ({ ...p })),
                    normal: faceNormal,
                    panelNormal: { ...faceNormal },
                    toolId: feat.toolId || null
                } as PocketFeature);

            } else if (feat.type === 'cutout') {
                const gp = getGrooveParamsMm(params);
                const hasExplicitWidth = params.width !== undefined || params.width_nm !== undefined;
                const w = hasExplicitWidth ? Number(gp.width) : 0;
                const l = (params.length !== undefined || params.length_nm !== undefined) ? Number(gp.length) : Number(params.height ?? 0);
                const u = Number(gp.u);
                const v = Number(gp.v);
                if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(l) || l <= 0) {
                    throw new Error(`[C1_cnc/geometry-extractor] Wymiary wycięcia (width, length) muszą być skończonymi liczbami dodatnimi dla cechy "${feat.id || 'cutout'}" (width=${w}, length=${l}).`);
                }
                if (!Number.isFinite(u) || !Number.isFinite(v)) {
                    throw new Error(`[C1_cnc/geometry-extractor] Współrzędne wycięcia (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'cutout'}" (u=${u}, v=${v}).`);
                }
                const p0: Vector3D = {
                    x: faceData.origin[0] + u * faceData.uAxis[0] + v * faceData.vAxis[0],
                    y: faceData.origin[1] + u * faceData.uAxis[1] + v * faceData.vAxis[1],
                    z: faceData.origin[2] + u * faceData.uAxis[2] + v * faceData.vAxis[2]
                };
                const p1: Vector3D = {
                    x: faceData.origin[0] + (u + w) * faceData.uAxis[0] + v * faceData.vAxis[0],
                    y: faceData.origin[1] + (u + w) * faceData.uAxis[1] + v * faceData.vAxis[1],
                    z: faceData.origin[2] + (u + w) * faceData.uAxis[2] + v * faceData.vAxis[2]
                };
                const p2: Vector3D = {
                    x: faceData.origin[0] + (u + w) * faceData.uAxis[0] + (v + l) * faceData.vAxis[0],
                    y: faceData.origin[1] + (u + w) * faceData.uAxis[1] + (v + l) * faceData.vAxis[1],
                    z: faceData.origin[2] + (u + w) * faceData.uAxis[2] + (v + l) * faceData.vAxis[2]
                };
                const p3: Vector3D = {
                    x: faceData.origin[0] + u * faceData.uAxis[0] + (v + l) * faceData.vAxis[0],
                    y: faceData.origin[1] + u * faceData.uAxis[1] + (v + l) * faceData.vAxis[1],
                    z: faceData.origin[2] + u * faceData.uAxis[2] + (v + l) * faceData.vAxis[2]
                };
                const points: Vector3D[] = [p0, p1, p2, p3, { ...p0 }];
                // Bezwzględna docelowa wysokość Z dla frezowania przelotowego (przeciwległa powierzchnia formatki)
                const nz = faceData.normal ? faceData.normal[2] : 1;
                const depth = p0.z - nz * pT;

                const cutoutLabel = feat.name ?? params?.name;
                const detCutoutKey = `${faceName || 'na'}_${Math.round(u * 10)}_${Math.round(v * 10)}_${Math.round(w * 10)}_${Math.round(l * 10)}`;
                const faceNormal: Vector3D = {
                    x: faceData.normal[0],
                    y: faceData.normal[1],
                    z: faceData.normal[2]
                };
                features.push({
                    featureId: feat.id ? `cutout_${feat.id}` : `cutout_${detCutoutKey}`,
                    name: cutoutLabel || tx(cncTekst, 'extractor.cutout_label', TX_NS, { n: features.length + 1 }),
                    objectName: panelName,
                    depth,
                    panelDepth: depth,
                    points,
                    panelPoints: points.map(p => ({ ...p })),
                    normal: faceNormal,
                    panelNormal: { ...faceNormal },
                    compensation: 'Right',
                    isInnerContour: true,
                    toolId: feat.toolId || null
                } as ContourFeature);

            } else if (feat.type === 'groove' || feat.type === 'GROOVE' || feat.type === 'nut') {
                const gp = getGrooveParamsMm(params);
                const hasExplicitWidth = params.width !== undefined || params.width_nm !== undefined;
                const hasExplicitDepth = params.depth !== undefined || params.depth_nm !== undefined;
                const hasExplicitLength = params.length !== undefined || params.length_nm !== undefined;
                let width = hasExplicitWidth ? Number(gp.width) : 4;
                const depth = hasExplicitDepth ? Number(gp.depth) : 8;
                if (!Number.isFinite(width) || width <= 0) {
                    throw new Error(`[C1_cnc/geometry-extractor] Szerokość wpustu musi być dodatnią liczbą skończoną dla cechy "${feat.id || 'groove'}" (width=${width}).`);
                }
                if (!Number.isFinite(depth) || Math.abs(depth) < 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Głębokość wpustu nie może być zerowa ani nieskończona dla cechy "${feat.id || 'groove'}" (depth=${depth}).`);
                }
                const grooveMaterialSpan = String(faceName || '').includes('FACE_Z')
                    ? pT
                    : (String(faceName || '').startsWith('FACE_X') ? pW : pH);
                if (Math.abs(depth) > grooveMaterialSpan + 1e-4) {
                    throw new Error(`[C1_cnc/geometry-extractor] Głębokość wpustu (${Math.abs(depth)}mm) przekracza wymiar materiału (${grooveMaterialSpan}mm dla ściany "${faceName}") dla cechy "${feat.id || 'groove'}".`);
                }

                let startPoint: Vector3D;
                let endPoint: Vector3D;

                if (params.startPoint && params.endPoint) {
                    const sp = params.startPoint;
                    const ep = params.endPoint;
                    if (typeof sp.x !== 'number' || !Number.isFinite(sp.x) ||
                        typeof sp.y !== 'number' || !Number.isFinite(sp.y) ||
                        typeof sp.z !== 'number' || !Number.isFinite(sp.z) ||
                        typeof ep.x !== 'number' || !Number.isFinite(ep.x) ||
                        typeof ep.y !== 'number' || !Number.isFinite(ep.y) ||
                        typeof ep.z !== 'number' || !Number.isFinite(ep.z)) {
                        throw new Error(`[C1_cnc/geometry-extractor] Punkty wpustu (startPoint, endPoint) muszą mieć skończone współrzędne dla cechy "${feat.id || 'groove'}".`);
                    }
                    startPoint = { ...sp };
                    endPoint = { ...ep };
                } else {
                    let u1 = Number(params.x1 ?? 0);
                    let v1 = Number(params.y1 ?? 0);
                    let u2 = Number(params.x2 ?? faceData.width ?? pW);
                    let v2 = Number(params.y2 ?? 0);
                    if (!Number.isFinite(u1) || !Number.isFinite(v1) || !Number.isFinite(u2) || !Number.isFinite(v2)) {
                        throw new Error(`[C1_cnc/geometry-extractor] Współrzędne wpustu (x1, y1, x2, y2) muszą być liczbami skończonymi dla cechy "${feat.id || 'groove'}".`);
                    }

                    const gW = hasExplicitWidth ? width : 0;
                    const gL = hasExplicitLength ? Number(gp.length) : 0;
                    if (hasExplicitLength && (!Number.isFinite(gL) || gL <= 0)) {
                        throw new Error(`[C1_cnc/geometry-extractor] Długość wpustu musi być dodatnią liczbą skończoną dla cechy "${feat.id || 'groove'}" (length=${gL}).`);
                    }

                    if (gW > 0 && gL > 0) {
                        const u = Number(gp.u);
                        const v = Number(gp.v);
                        if (!Number.isFinite(u) || !Number.isFinite(v)) {
                            throw new Error(`[C1_cnc/geometry-extractor] Współrzędne wpustu (u, v) muszą być liczbami skończonymi dla cechy "${feat.id || 'groove'}" (u=${u}, v=${v}).`);
                        }

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
                }

                const faceNormal: Vector3D = {
                    x: faceData.normal[0],
                    y: faceData.normal[1],
                    z: faceData.normal[2]
                };

                const grooveLabel = feat.name ?? params?.name;
                const detGrooveKey = `${faceName || 'na'}_${Math.round(startPoint.x * 10)}_${Math.round(startPoint.y * 10)}_${Math.round(startPoint.z * 10)}_${Math.round(endPoint.x * 10)}_${Math.round(endPoint.y * 10)}_${Math.round(endPoint.z * 10)}`;
                features.push({
                    featureId: feat.id ? `groove_${feat.id}` : `groove_${detGrooveKey}`,
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
                    normal: faceNormal,
                    panelNormal: { ...faceNormal },
                    toolId: feat.toolId || null,
                    leadIn: 0,
                    leadOut: 0,
                    flipDepthDirection: false
                } as GrooveFeature);

            } else if (feat.type === 'contour' || feat.type === 'CONTOUR' || feat.type === 'profile') {
                const depth = Number(params.depth !== undefined ? params.depth : pT);
                if (!Number.isFinite(depth)) {
                    throw new Error(`[C1_cnc/geometry-extractor] Głębokość konturu musi być liczbą skończoną dla cechy "${feat.id || 'contour'}" (depth=${params.depth}).`);
                }
                const points: Vector3D[] = (params.points || []).map((p: any) => ({ x: Number(p.x ?? 0), y: Number(p.y ?? 0), z: Number(p.z ?? 0) }));

                const contourLabel = feat.name ?? params?.name;
                const detContourKey = `${Math.round(depth * 10)}_${points.map(p => `${Math.round(p.x * 10)}_${Math.round(p.y * 10)}`).join('_')}`;
                const rawSegments = Array.isArray(params.segments) ? params.segments : undefined;
                const isInner = Boolean(params.isInnerContour);
                features.push({
                    featureId: feat.id ? `contour_${feat.id}` : `contour_${detContourKey}`,
                    name: contourLabel || tx(cncTekst, 'extractor.contour_label', TX_NS, { n: features.length + 1 }),
                    objectName: panelName,
                    depth,
                    points,
                    panelPoints: points.map(p => ({ ...p })),
                    segments: rawSegments,
                    panelSegments: rawSegments ? rawSegments.map((s: any) => ({ ...s })) : undefined,
                    isInnerContour: isInner,
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
                    if (!hf.panelAxis && hf.axis) {
                        hf.panelAxis = { ...hf.axis };
                    }
                    f.position = wcsManager.toWcsCoordinates(f.position);
                    if (hf.panelAxis) {
                        f.axis = wcsManager.transformVector(hf.panelAxis);
                    }
                    if (hf.positions && Array.isArray(hf.positions)) {
                        hf.positions = hf.positions.map(p => wcsManager.toWcsCoordinates(p));
                    }
                }
                if ('startPoint' in f && 'endPoint' in f) {
                    const gf = f as GrooveFeature;
                    if (!gf.panelStartPoint) gf.panelStartPoint = { ...gf.startPoint };
                    if (!gf.panelEndPoint) gf.panelEndPoint = { ...gf.endPoint };
                    if (!gf.panelNormal && gf.normal) gf.panelNormal = { ...gf.normal };
                    f.startPoint = wcsManager.toWcsCoordinates(f.startPoint);
                    f.endPoint = wcsManager.toWcsCoordinates(f.endPoint);
                    if (gf.panelNormal) {
                        gf.normal = wcsManager.transformVector(gf.panelNormal);
                    }
                }
                if ('points' in f && Array.isArray(f.points)) {
                    const cf = f as ContourFeature;
                    if (!cf.panelPoints) {
                        cf.panelPoints = cf.points.map((p: any) => ({ ...p }));
                    }
                    if (cf.panelDepth === undefined && typeof cf.depth === 'number') {
                        cf.panelDepth = cf.depth;
                    }
                    if (!cf.panelNormal && cf.normal) {
                        cf.panelNormal = { ...cf.normal };
                    }
                    if (!cf.panelSegments && Array.isArray(cf.segments)) {
                        cf.panelSegments = cf.segments.map(seg =>
                            seg.type === 'ARC'
                                ? { ...seg, start: { ...seg.start }, end: { ...seg.end }, center: { ...seg.center } }
                                : { ...seg, start: { ...seg.start }, end: { ...seg.end } }
                        );
                    }
                    f.points = cf.panelPoints.map((p: any) => wcsManager.toWcsCoordinates(p));
                    if (typeof cf.panelDepth === 'number' && Number.isFinite(cf.panelDepth) && cf.panelPoints.length > 0) {
                        const p0z = cf.panelPoints[0].z;
                        const nz = cf.panelNormal ? (cf.panelNormal.z >= 0 ? 1 : -1) : 1;
                        const dirCheck = (cf.panelDepth - p0z) * nz;
                        const targetZ_panel = (dirCheck < -1e-4)
                            ? cf.panelDepth
                            : p0z - nz * Math.abs(cf.panelDepth);
                        const pTargetLocal = { x: cf.panelPoints[0].x, y: cf.panelPoints[0].y, z: targetZ_panel };
                        const pTargetWcs = wcsManager.toWcsCoordinates(pTargetLocal);
                        cf.depth = pTargetWcs.z;
                    }
                    if (Array.isArray(cf.panelSegments)) {
                        cf.segments = cf.panelSegments.map(seg => {
                            if (seg.type === 'ARC') {
                                const s1 = wcsManager.toWcsCoordinates(seg.start);
                                const e1 = wcsManager.toWcsCoordinates(seg.end);
                                const c1 = wcsManager.toWcsCoordinates(seg.center);
                                const cross0 = (seg.start.x - seg.center.x) * (seg.end.y - seg.center.y) - (seg.start.y - seg.center.y) * (seg.end.x - seg.center.x);
                                const cross1 = (s1.x - c1.x) * (e1.y - c1.y) - (s1.y - c1.y) * (e1.x - c1.x);
                                const flippedXY = Math.abs(cross0) > 1e-6 && Math.abs(cross1) > 1e-6 && (cross0 * cross1 < 0);
                                return {
                                    ...seg,
                                    start: s1,
                                    end: e1,
                                    center: c1,
                                    direction: flippedXY ? (seg.direction === 'CW' ? 'CCW' : 'CW') : seg.direction
                                };
                            }
                            return {
                                ...seg,
                                start: wcsManager.toWcsCoordinates(seg.start),
                                end: wcsManager.toWcsCoordinates(seg.end)
                            };
                        });
                    }
                    if (cf.panelNormal) {
                        cf.normal = typeof wcsManager.transformVector === 'function'
                            ? wcsManager.transformVector(cf.panelNormal)
                            : { ...cf.panelNormal };
                    }
                }
                if ('boundaryPoints' in f && Array.isArray((f as any).boundaryPoints)) {
                    const pf = f as PocketFeature;
                    if (!pf.panelBoundaryPoints) {
                        pf.panelBoundaryPoints = pf.boundaryPoints.map((p: any) => ({ ...p }));
                    }
                    if (!pf.panelNormal && pf.normal) pf.panelNormal = { ...pf.normal };
                    pf.boundaryPoints = pf.panelBoundaryPoints.map((p: any) => wcsManager.toWcsCoordinates(p));
                    if (pf.panelNormal) {
                        pf.normal = typeof wcsManager.transformVector === 'function'
                            ? wcsManager.transformVector(pf.panelNormal)
                            : { ...pf.panelNormal };
                    }
                }
            }
        }

        const effectiveFeatures = wcsManager
            ? features.filter(isFeatureMachinableInWcs)
            : features;

        return {
            objectName: panelName,
            features: effectiveFeatures,
            wcsOffset: (wcsManager && typeof wcsManager.getOrigin === 'function') ? wcsManager.getOrigin() : createVector3D(),
            isDirty: false
        };
    }
}
