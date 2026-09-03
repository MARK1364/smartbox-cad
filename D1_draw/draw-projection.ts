/**
 * D1_draw - draw-projection.ts
 * Silnik rzutowania 2D: Pobiera PRAWDZIWĄ geometrię 3D korpusu/szafy ze sceny (E3GeometrySnapshot / CADNode)
 * i rzutuje rzeczywiste formatki (złożenia 3D) na płaszczyzny wektorowe 2D.
 */

import {
    DrawProjectionAngle,
    Draw2DRect,
    Draw2DPolygon,
    Draw2DView,
    Draw2DSegment,
    BOMRow,
    DrawModelItem,
} from './draw-types';
import { DrawHLREngine } from './draw-hlr-engine';
import {
    resolveGeometrySnapshot,
    E3GeometrySnapshot,
    E3PartPose,
} from '../E3_export/e3-geometry-snapshot';

export interface ProjectablePart {
    id: string;
    name: string;
    role?: string;
    material?: string;
    thickness: number;
    dim: { x: number; y: number; z: number };
    loc: { x: number; y: number; z: number };
    // 8 wierzchołków bryły 3D w układzie środka korpusu (mm)
    vertices3D?: Array<{ x: number; y: number; z: number }>;
    holes?: Array<{ x: number; y: number; diameter: number; depth?: number }>;
    grooves?: Array<{ x: number; y: number; width: number; height: number; depth?: number }>;
}

export interface ProjectableCabinet {
    id?: string;
    width: number;
    height: number;
    depth: number;
    parts: ProjectablePart[];
    name?: string;
}

/**
 * Obraca wektor 3D za pomocą kwaternionu [qx, qy, qz, qw].
 */
function rotateVectorByQuat(
    v: { x: number; y: number; z: number },
    q: [number, number, number, number]
): { x: number; y: number; z: number } {
    const [qx, qy, qz, qw] = q;
    // v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + qw * v)
    const tx = 2 * (qy * v.z - qz * v.y + qw * v.x);
    const ty = 2 * (qz * v.x - qx * v.z + qw * v.y);
    const tz = 2 * (qx * v.y - qy * v.x + qw * v.z);

    return {
        x: v.x + (qy * tz - qz * ty),
        y: v.y + (qz * tx - qx * tz),
        z: v.z + (qx * ty - qy * tx),
    };
}

/**
 * Zwraca kąt nowego rzutu wyprowadzanego z DOWOLNEGO rzutu źródłowego (jak w SolidWorks).
 */
export function getProjectedAngleFromSource(
    sourceAngle: DrawProjectionAngle,
    direction: 'RIGHT' | 'LEFT' | 'DOWN' | 'UP' | 'DIAGONAL'
): DrawProjectionAngle {
    if (direction === 'DIAGONAL') return 'ISO';

    switch (sourceAngle) {
        case 'FRONT':
            if (direction === 'RIGHT') return 'RIGHT';
            if (direction === 'LEFT') return 'LEFT';
            if (direction === 'DOWN') return 'TOP';
            if (direction === 'UP') return 'BOTTOM';
            break;

        case 'RIGHT':
            if (direction === 'RIGHT') return 'BACK';
            if (direction === 'LEFT') return 'FRONT';
            if (direction === 'DOWN') return 'TOP';
            if (direction === 'UP') return 'BOTTOM';
            break;

        case 'LEFT':
            if (direction === 'RIGHT') return 'FRONT';
            if (direction === 'LEFT') return 'BACK';
            if (direction === 'DOWN') return 'TOP';
            if (direction === 'UP') return 'BOTTOM';
            break;

        case 'TOP':
            if (direction === 'RIGHT') return 'RIGHT';
            if (direction === 'LEFT') return 'LEFT';
            if (direction === 'DOWN') return 'BACK';
            if (direction === 'UP') return 'FRONT';
            break;

        case 'BOTTOM':
            if (direction === 'RIGHT') return 'RIGHT';
            if (direction === 'LEFT') return 'LEFT';
            if (direction === 'DOWN') return 'FRONT';
            if (direction === 'UP') return 'BACK';
            break;

        case 'BACK':
            if (direction === 'RIGHT') return 'LEFT';
            if (direction === 'LEFT') return 'RIGHT';
            if (direction === 'DOWN') return 'TOP';
            if (direction === 'UP') return 'BOTTOM';
            break;

        case 'ISO':
        default:
            if (direction === 'RIGHT') return 'RIGHT';
            if (direction === 'LEFT') return 'LEFT';
            if (direction === 'DOWN') return 'TOP';
            if (direction === 'UP') return 'BOTTOM';
            break;
    }
    return 'RIGHT';
}

export class DrawProjectionEngine {
    /**
     * Konwertuje dowolny obiekt z drzewa sceny 3D na model z rzeczywistą pozycją i obrotem formatek w 3D.
     */
    public static modelItemToProjectable(item: DrawModelItem): ProjectableCabinet {
        // 1. Sprawdź czy mamy snapshot rzeczywistej geometrii ze sceny 3D (E3GeometrySnapshot)
        const snapshot = resolveGeometrySnapshot(item.id);

        if (snapshot && snapshot.parts && snapshot.parts.length > 0) {
            return this.snapshotToProjectable(snapshot, item.name);
        }

        // 2. Jeśli to pojedynczy element (formatka/panel)
        const isSinglePart = item.type === 'PART' || !item.children || item.children.length === 0;
        if (isSinglePart) {
            const w = item.width || 600;
            const h = item.height || 720;
            const t = item.thickness || item.depth || 18;

            const halfX = w / 2;
            const halfY = h / 2;
            const halfZ = t / 2;

            const vertices3D = [
                { x: -halfX, y: -halfY, z: -halfZ },
                { x: halfX, y: -halfY, z: -halfZ },
                { x: halfX, y: halfY, z: -halfZ },
                { x: -halfX, y: halfY, z: -halfZ },
                { x: -halfX, y: -halfY, z: halfZ },
                { x: halfX, y: -halfY, z: halfZ },
                { x: halfX, y: halfY, z: halfZ },
                { x: -halfX, y: halfY, z: halfZ },
            ];

            return {
                id: item.id,
                name: item.name,
                width: w,
                height: h,
                depth: t,
                parts: [
                    {
                        id: item.id,
                        name: item.name,
                        role: item.role || 'PANEL',
                        material: item.material || 'Płyta laminowana 18mm',
                        thickness: t,
                        dim: { x: w, y: h, z: t },
                        loc: { x: 0, y: 0, z: 0 },
                        vertices3D,
                    },
                ],
            };
        }

        // 3. Fallback: Pobierz z zagnieżdżonych dzieci węzła
        const parts: ProjectablePart[] = [];
        const collectParts = (node: DrawModelItem) => {
            if (node.type === 'PART' || !node.children || node.children.length === 0) {
                const w = node.width || 18;
                const h = node.height || 720;
                const d = node.depth || node.thickness || 18;

                const raw = node.rawNode;
                const tx = raw?.translationNm ? raw.translationNm[0] / 1000000 : (raw?.x || 0);
                const ty = raw?.translationNm ? raw.translationNm[1] / 1000000 : (raw?.y || 0);
                const tz = raw?.translationNm ? raw.translationNm[2] / 1000000 : (raw?.z || 0);

                parts.push({
                    id: node.id,
                    name: node.name,
                    role: node.role || node.name,
                    material: node.material || 'Płyta laminowana 18mm',
                    thickness: node.thickness || 18,
                    dim: { x: w, y: h, z: d },
                    loc: { x: tx, y: ty, z: tz },
                });
            } else {
                for (const ch of node.children) {
                    collectParts(ch);
                }
            }
        };

        for (const ch of item.children || []) {
            collectParts(ch);
        }

        return {
            id: item.id,
            name: item.name,
            width: item.width || 800,
            height: item.height || 720,
            depth: item.depth || 560,
            parts,
        };
    }

    /**
     * Konwertuje E3GeometrySnapshot (prawdziwe formatki 3D ze sceny) na model rzutowalny.
     */
    public static snapshotToProjectable(snapshot: E3GeometrySnapshot, customName?: string): ProjectableCabinet {
        const parts: ProjectablePart[] = [];

        for (const p of snapshot.parts) {
            const pw = p.width || 600;
            const ph = p.height || 720;
            const pt = p.thickness || 18;

            const hx = pw / 2;
            const hy = ph / 2;
            const hz = pt / 2;

            // 8 narożników płyty w jej lokalnym układzie
            const localCorners = [
                { x: -hx, y: -hy, z: -hz },
                { x: hx, y: -hy, z: -hz },
                { x: hx, y: hy, z: -hz },
                { x: -hx, y: hy, z: -hz },
                { x: -hx, y: -hy, z: hz },
                { x: hx, y: -hy, z: hz },
                { x: hx, y: hy, z: hz },
                { x: -hx, y: hy, z: hz },
            ];

            // Transformacja 3D narożników przez kwaternion i pozycję [x, y, z] w korpusie
            const vertices3D = localCorners.map((c) => {
                const rot = rotateVectorByQuat(c, p.rotq || [0, 0, 0, 1]);
                return {
                    x: rot.x + (p.pos ? p.pos[0] : 0),
                    y: rot.y + (p.pos ? p.pos[1] : 0),
                    z: rot.z + (p.pos ? p.pos[2] : 0),
                };
            });

            // Oblicz zorientowany prostopadłościan (AABB) w układzie korpusu
            const minX = Math.min(...vertices3D.map((v) => v.x));
            const maxX = Math.max(...vertices3D.map((v) => v.x));
            const minY = Math.min(...vertices3D.map((v) => v.y));
            const maxY = Math.max(...vertices3D.map((v) => v.y));
            const minZ = Math.min(...vertices3D.map((v) => v.z));
            const maxZ = Math.max(...vertices3D.map((v) => v.z));

            const dimX = Math.max(maxX - minX, 1);
            const dimY = Math.max(maxY - minY, 1);
            const dimZ = Math.max(maxZ - minZ, 1);

            const locX = (minX + maxX) / 2;
            const locY = (minY + maxY) / 2;
            const locZ = (minZ + maxZ) / 2;

            parts.push({
                id: p.id,
                name: p.name || 'Formatka',
                role: p.role,
                material: 'Płyta laminowana 18mm',
                thickness: pt,
                dim: { x: dimX, y: dimY, z: dimZ },
                loc: { x: locX, y: locY, z: locZ },
                vertices3D,
            });
        }

        return {
            id: snapshot.id,
            name: customName || snapshot.name || 'Korpus 3D',
            width: snapshot.width || 800,
            height: snapshot.height || 720,
            depth: snapshot.depth || 560,
            parts,
        };
    }

    /**
     * Tworzy pojedynczy rzut dla mebla na zadanej pozycji arkusza.
     */
    public static generateSingleView(
        cabinet: ProjectableCabinet,
        projection: DrawProjectionAngle,
        scale: number = 0.1,
        posX: number = 30,
        posY: number = 30
    ): Draw2DView {
        const { width, height, depth, parts, name, id } = cabinet;
        const scaleText = scale === 0.1 ? '1:10' : scale === 0.05 ? '1:20' : scale === 0.2 ? '1:5' : scale === 1.0 ? '1:1' : `1:${Math.round(1 / scale)}`;

        let title = `${name || 'Model'} — Rzut `;
        let viewW = width;
        let viewH = height;
        let rects: Draw2DRect[] = [];
        let polygons: Draw2DPolygon[] | undefined = undefined;

        switch (projection) {
            case 'FRONT':
                title += 'z przodu (A)';
                viewW = width;
                viewH = height;
                rects = this.projectFront(parts, width, height);
                break;
            case 'TOP':
                title += 'z góry (B)';
                viewW = width;
                viewH = depth;
                rects = this.projectTop(parts, width, depth);
                break;
            case 'RIGHT':
                title += 'z boku (C)';
                viewW = depth;
                viewH = height;
                rects = this.projectSide(parts, depth, height, 'RIGHT');
                break;
            case 'LEFT':
                title += 'z boku lewego (D)';
                viewW = depth;
                viewH = height;
                rects = this.projectSide(parts, depth, height, 'LEFT');
                break;
            case 'BACK':
                title += 'od tyłu (E)';
                viewW = width;
                viewH = height;
                rects = this.projectFront(parts, width, height, true);
                break;
            case 'BOTTOM':
                title += 'z dołu (F)';
                viewW = width;
                viewH = depth;
                rects = this.projectTop(parts, width, depth, true);
                break;
            case 'ISO':
                title += 'aksonometryczny 30°';
                viewW = width * 1.2;
                viewH = height * 1.2;
                break;
        }

        // ─── Automatyczny Silnik Usuwania Linii Niewidocznych (CAD HLR Engine) ───
        const hlrResult = DrawHLREngine.computeHLR(parts, projection);
        const segments: Draw2DSegment[] = hlrResult.segments;

        if (segments.length > 0) {
            viewW = hlrResult.widthMm;
            viewH = hlrResult.heightMm;
        } else if (projection === 'ISO') {
            polygons = this.projectIsometric(parts);
        }

        return {
            id: `view_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            title,
            sourceNodeId: id,
            sourceNodeName: name,
            projection,
            scale,
            scaleText,
            x: posX,
            y: posY,
            widthMm: viewW,
            heightMm: viewH,
            rects,
            segments,
            polygons,
            dimensions: [],
            visible: true,
        };
    }

    /**
     * Zestaw rzutów standardowych (przód, góra, bok, izometria) + BOM.
     */
    public static generateViewsForCabinet(
        cabinet: ProjectableCabinet,
        scale: number = 0.1
    ): { views: Draw2DView[]; bomRows: BOMRow[] } {
        const views = [
            this.generateSingleView(cabinet, 'FRONT', scale, 30, 40),
            this.generateSingleView(cabinet, 'TOP', scale, 30, 130),
            this.generateSingleView(cabinet, 'RIGHT', scale, 130, 40),
            this.generateSingleView(cabinet, 'ISO', scale, 130, 130),
        ];
        return { views, bomRows: this.generateBOM(cabinet.parts) };
    }

    /**
     * Rzut Z PRZODU / OD TYŁU (Płaszczyzna XY)
     * - W rzucie z przodu wszystkie elementy pierwszego planu (boki lewy/prawy, wieńce, półki) są w 100% LINIAMI CIĄGŁYMI.
     * - Plecy leżą w tle.
     * - W rzucie od tyłu plecy są linią ciągłą na wierzchu, a wnętrze liniami przerywanymi z lustrzanym odbiciem.
     */
    public static projectFront(
        parts: ProjectablePart[],
        cabinetW: number,
        cabinetH: number,
        isBackView: boolean = false
    ): Draw2DRect[] {
        const rects: Draw2DRect[] = [];

        const backParts: ProjectablePart[] = [];
        const frontParts: ProjectablePart[] = [];

        for (const p of parts) {
            const isBack = p.role === 'BACK' || (p.name && p.name.toLowerCase().includes('plec'));
            if (isBack) {
                backParts.push(p);
            } else {
                frontParts.push(p);
            }
        }

        if (isBackView) {
            // ─── RZUT OD TYŁU ───
            // 1. Elementy wewnętrzne (półki, wieńce) zasłonięte przez plecy -> linie przerywane
            for (const part of frontParts) {
                const w = part.dim.x;
                const h = part.dim.y;
                const posX = -part.loc.x; // Lustrzane odbicie X
                const cx = (cabinetW / 2) + posX;
                const cy = (cabinetH / 2) - part.loc.y;

                rects.push({
                    id: `back_hidden_${part.id || part.name}`,
                    name: part.name,
                    role: part.role,
                    x: cx - w / 2,
                    y: cy - h / 2,
                    width: w,
                    height: h,
                    thickness: part.thickness,
                    material: part.material,
                    isBack: true,
                    strokeColor: '#64748b',
                    fillColor: 'none',
                    dashArray: '2,1.5',
                });
            }

            // 2. Pełna ściana pleców na wierzchu -> linia ciągła
            for (const part of backParts) {
                const w = part.dim.x;
                const h = part.dim.y;
                const posX = -part.loc.x;
                const cx = (cabinetW / 2) + posX;
                const cy = (cabinetH / 2) - part.loc.y;

                rects.push({
                    id: `back_solid_${part.id || part.name}`,
                    name: part.name,
                    role: part.role,
                    x: cx - w / 2,
                    y: cy - h / 2,
                    width: w,
                    height: h,
                    thickness: part.thickness,
                    material: part.material,
                    isBack: false,
                    strokeColor: '#0f172a',
                    fillColor: '#f1f5f9',
                });
            }
        } else {
            // ─── RZUT Z PRZODU (100% CZYSTE LINIE CIĄGŁE DLA BOKÓW I PÓŁEK) ───
            // 1. Najpierw plecy w tle (jako tło wnęki mebla, bez żadnych przerywanych kresek nachodzących na boki)
            for (const part of backParts) {
                const w = part.dim.x;
                const h = part.dim.y;
                const cx = (cabinetW / 2) + part.loc.x;
                const cy = (cabinetH / 2) - part.loc.y;

                rects.push({
                    id: `front_back_${part.id || part.name}`,
                    name: part.name,
                    role: part.role,
                    x: cx - w / 2,
                    y: cy - h / 2,
                    width: w,
                    height: h,
                    thickness: part.thickness,
                    material: part.material,
                    isBack: true,
                    strokeColor: '#e2e8f0',
                    fillColor: '#ffffff',
                });
            }

            // 2. Na pierwszym planie: BOKI LEWY I PRAWY, WIEŃCE, PÓŁKI, PRZEGRODY
            // Wszystkie krawędzie (zarówno zewnętrzne jak i wewnętrzne boczków) są 100% CIĄGŁE!
            for (const part of frontParts) {
                const w = part.dim.x;
                const h = part.dim.y;
                const cx = (cabinetW / 2) + part.loc.x;
                const cy = (cabinetH / 2) - part.loc.y;

                rects.push({
                    id: `front_solid_${part.id || part.name}`,
                    name: part.name,
                    role: part.role,
                    x: cx - w / 2,
                    y: cy - h / 2,
                    width: w,
                    height: h,
                    thickness: part.thickness,
                    material: part.material,
                    isBack: false,
                    strokeColor: '#0f172a',
                    fillColor: '#f1f5f9',
                    dashArray: undefined, // 100% LINIA CIĄGŁA
                    holes: part.holes,
                    grooves: part.grooves,
                });
            }
        }

        return rects;
    }

    /**
     * Rzut Z GÓRY / Z DOŁU (Płaszczyzna XZ)
     */
    /**
     * Rzut Z GÓRY / Z DOŁU (Płaszczyzna XZ)
     */
    public static projectTop(
        parts: ProjectablePart[],
        cabinetW: number,
        cabinetD: number,
        isBottomView: boolean = false
    ): Draw2DRect[] {
        const rects: Draw2DRect[] = [];

        for (const part of parts) {
            const isTopWreath = part.role === 'TOP' || (part.name && part.name.toLowerCase().includes('gór'));
            const isBottomWreath = part.role === 'BOTTOM' || (part.name && part.name.toLowerCase().includes('dol'));
            const isSide = part.role === 'SIDE_L' || part.role === 'SIDE_R' || (part.name && part.name.toLowerCase().includes('bok'));
            const isFrontPlane = isSide || (isBottomView ? isBottomWreath : isTopWreath);

            // W standardowym rzucie rysujemy tylko krawędzie widoczne na pierwszym planie
            if (isFrontPlane) {
                const w = part.dim.x;
                const h = part.dim.z;

                const cx = (cabinetW / 2) + part.loc.x;
                const cy = (cabinetD / 2) - part.loc.z;

                const x = cx - w / 2;
                const y = cy - h / 2;

                rects.push({
                    id: `top_${part.id || part.name}`,
                    name: part.name,
                    role: part.role,
                    x,
                    y,
                    width: w,
                    height: h,
                    thickness: part.thickness,
                    material: part.material,
                    isBack: false,
                    strokeColor: '#0f172a',
                    fillColor: '#f1f5f9',
                });
            }
        }

        return rects;
    }

    /**
     * Rzut Z BOKU (Płaszczyzna YZ) — PRAWY / LEWY
     */
    public static projectSide(
        parts: ProjectablePart[],
        cabinetD: number,
        cabinetH: number,
        side: 'LEFT' | 'RIGHT' = 'RIGHT'
    ): Draw2DRect[] {
        const rects: Draw2DRect[] = [];

        for (const part of parts) {
            const isCoveringSide = (side === 'RIGHT' && part.loc.x > 50) || (side === 'LEFT' && part.loc.x < -50);

            // Rysujemy tylko widoczną płytę boczną
            if (isCoveringSide) {
                const w = part.dim.z;
                const h = part.dim.y;

                const posZ = side === 'RIGHT' ? -part.loc.z : part.loc.z;
                const cx = (cabinetD / 2) + posZ;
                const cy = (cabinetH / 2) - part.loc.y;

                const x = cx - w / 2;
                const y = cy - h / 2;

                rects.push({
                    id: `side_${part.id || part.name}`,
                    name: part.name,
                    role: part.role,
                    x,
                    y,
                    width: w,
                    height: h,
                    thickness: part.thickness,
                    material: part.material,
                    isBack: false,
                    strokeColor: '#0f172a',
                    fillColor: '#f1f5f9',
                });
            }
        }

        return rects;
    }

    /**
     * Rzut AKSONOMETRYCZNY / IZOMETRYCZNY 30°
     */
    public static projectIsometric(parts: ProjectablePart[]): Draw2DPolygon[] {
        const polygons: Draw2DPolygon[] = [];
        const isoAngle = Math.PI / 6; // 30 stopni
        const cosA = Math.cos(isoAngle);
        const sinA = Math.sin(isoAngle);

        const projectIsoPoint = (x: number, y: number, z: number): { x: number; y: number } => {
            const px = (x - z) * cosA;
            const py = -y + (x + z) * sinA;
            return { x: px, y: py };
        };

        const sorted = [...parts].sort((a, b) => {
            const depthA = a.loc.x + a.loc.y - a.loc.z;
            const depthB = b.loc.x + b.loc.y - b.loc.z;
            return depthA - depthB;
        });

        for (const part of sorted) {
            let v: Array<{ x: number; y: number }> = [];

            if (part.vertices3D && part.vertices3D.length === 8) {
                // Rzutuj rzeczywiste 8 wierzchołków obróconej w 3D formatki
                v = part.vertices3D.map((p) => projectIsoPoint(p.x, p.y, p.z));
            } else {
                const hx = part.dim.x / 2;
                const hy = part.dim.y / 2;
                const hz = part.dim.z / 2;
                const cx = part.loc.x;
                const cy = part.loc.y;
                const cz = part.loc.z;

                v = [
                    projectIsoPoint(cx - hx, cy - hy, cz - hz),
                    projectIsoPoint(cx + hx, cy - hy, cz - hz),
                    projectIsoPoint(cx + hx, cy + hy, cz - hz),
                    projectIsoPoint(cx - hx, cy + hy, cz - hz),
                    projectIsoPoint(cx - hx, cy - hy, cz + hz),
                    projectIsoPoint(cx + hx, cy - hy, cz + hz),
                    projectIsoPoint(cx + hx, cy + hy, cz + hz),
                    projectIsoPoint(cx - hx, cy + hy, cz + hz),
                ];
            }

            // Ściana górna (+Y)
            polygons.push({
                id: `iso_top_${part.id || part.name}`,
                name: `${part.name} - Góra`,
                role: part.role,
                points: [v[3], v[2], v[6], v[7]],
                fillColor: '#e2e8f0',
                strokeColor: '#334155',
                strokeWidth: 0.35,
            });

            // Ściana prawa (+X)
            polygons.push({
                id: `iso_right_${part.id || part.name}`,
                name: `${part.name} - Prawa`,
                role: part.role,
                points: [v[1], v[2], v[6], v[5]],
                fillColor: '#cbd5e1',
                strokeColor: '#334155',
                strokeWidth: 0.35,
            });

            // Ściana przednia (+Z)
            polygons.push({
                id: `iso_front_${part.id || part.name}`,
                name: `${part.name} - Przód`,
                role: part.role,
                points: [v[4], v[5], v[6], v[7]],
                fillColor: '#f1f5f9',
                strokeColor: '#0f172a',
                strokeWidth: 0.5,
            });
        }

        return polygons;
    }

    /**
     * Generuje zestawienie formatek BOM (Bill of Materials)
     */
    public static generateBOM(parts: ProjectablePart[]): BOMRow[] {
        const rows: BOMRow[] = [];
        for (const part of parts) {
            const d1 = part.dim.x;
            const d2 = part.dim.y;
            const d3 = part.dim.z;
            const dims = [d1, d2, d3].sort((a, b) => b - a);

            const length = Math.round(dims[0]);
            const width = Math.round(dims[1]);
            const thickness = Math.round(part.thickness || dims[2] || 18);

            rows.push({
                name: part.name || 'Formatka',
                material: part.material || 'Płyta laminowana 18mm',
                length,
                width,
                thickness,
                qty: 1,
            });
        }
        return rows;
    }
}
