/**
 * SmartPanel Web — C1_CNC WCS Manager
 * 
 * Zarządzanie bazą obróbczej WCS (Work Coordinate System) dla projektu CNC.
 * Odczytuje surowe ustawienia JSON (WcsRule) i na ich podstawie generuje
 * transformacje układu oraz punkt zerowy. Obsługuje też ręczne modyfikacje użytkownika.
 */

import { Vector3D, CAMFeature, HoleFeature, GrooveFeature, ContourFeature, ContourSegment, PocketFeature } from '../dto/cam-dto.js';
import { createVector3D } from '../geometry/cnc-geometry-utils.js';
import { WcsRule } from './wcs-rules-mapper.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';

export class WcsManager {
    private wcsName: string = "G55";
    
    // Surowe wartości z JSON (lub domyślne)
    private rule: WcsRule = {
        origin_corner: { X: "-", Y: "-", Z: "-" },
        directions: { X: "+", Y: "+", Z: "+" },
        rotation: { X: 0, Y: 0, Z: 0 }
    };
    private ruleConfigured: boolean = false;

    // Wymiary formatki dla przeliczenia origin_corner
    private panelDimensions = { width: 0, height: 0, thickness: 0 };

    // Ręczne offsety z UI
    private manualOffset: Vector3D = createVector3D(0, 0, 0);
    private manualRotation: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 };

    constructor(wcsName: string = "G55") {
        this.wcsName = wcsName;
    }

    public getWcsName(): string {
        return this.wcsName;
    }

    public setWcsName(name: string): void {
        this.wcsName = name;
    }

    /**
     * Wczytuje surowe reguły JSON dla formatki.
     */
    public setRule(rule: WcsRule): void {
        this.rule = { ...rule };
        this.ruleConfigured = true;
    }

    public isRuleConfigured(): boolean {
        return this.ruleConfigured;
    }

    /**
     * Kopiuje pełny stan bazy z innej instancji WcsManager.
     */
    public copyFrom(other: WcsManager): void {
        this.wcsName = other.wcsName;
        this.rule = {
            origin_corner: { ...other.rule.origin_corner },
            directions: { ...other.rule.directions },
            rotation: { ...other.rule.rotation }
        };
        this.ruleConfigured = other.ruleConfigured;
        this.panelDimensions = { ...other.panelDimensions };
        this.manualOffset = { ...other.manualOffset };
        this.manualRotation = { ...other.manualRotation };
    }

    public clone(): WcsManager {
        const copy = new WcsManager(this.wcsName);
        copy.copyFrom(this);
        return copy;
    }

    /**
     * Ustawia ręczny offset od użytkownika.
     */
    public setManualOffset(offset: Vector3D): void {
        this.manualOffset = { ...offset };
    }

    /**
     * Ustawia ręczną rotację od użytkownika.
     */
    public setManualRotation(rot: { x: number, y: number, z: number }): void {
        this.manualRotation = { ...rot };
    }

    /**
     * Przekazuje wymiary formatki by menadżer wiedział jak obliczyć krańce (+/-).
     */
    public updateForPanelDimensions(width: number, height: number, thickness: number): void {
        this.panelDimensions = { width, height, thickness };
    }

    /**
     * Zwraca całkowity wektor rotacji WCS (JSON + manual).
     */
    public getRotation(): { x: number, y: number, z: number } {
        return {
            x: this.rule.rotation.X + this.manualRotation.x,
            y: this.rule.rotation.Y + this.manualRotation.y,
            z: this.rule.rotation.Z + this.manualRotation.z
        };
    }

    /**
     * Zwraca wektor kierunków osi WCS (-1 lub 1 dla X, Y, Z).
     */
    public getDirections(): { x: number, y: number, z: number } {
        return {
            x: this.rule.directions.X === "-" ? -1 : 1,
            y: this.rule.directions.Y === "-" ? -1 : 1,
            z: this.rule.directions.Z === "-" ? -1 : 1
        };
    }

    /**
     * Oblicza finalny wektor Origin 3D w przestrzeni formatki na podstawie JSON (np. "-, -, +")
     * plus nałożone ręczne przesunięcia (manualOffset).
     */
    public getOrigin(): Vector3D {
        const { width, height, thickness } = this.panelDimensions;
        
        let ox = this.rule.origin_corner.X === "+" ? width / 2 : -width / 2;
        let oy = this.rule.origin_corner.Y === "+" ? height / 2 : -height / 2;
        let oz = this.rule.origin_corner.Z === "+" ? thickness / 2 : -thickness / 2;

        return {
            x: ox + this.manualOffset.x,
            y: oy + this.manualOffset.y,
            z: oz + this.manualOffset.z
        };
    }

    /**
     * Translacja punktu przestrzeni roboczej 3D do przestrzeni lokalnej WCS.
     */
    public toWcsCoordinates(point: Vector3D): Vector3D {
        const origin = this.getOrigin();
        let px = point.x - origin.x;
        let py = point.y - origin.y;
        let pz = point.z - origin.z;
        return this.transformVector({ x: px, y: py, z: pz });
    }

    /**
     * Translacja punktu przestrzeni WCS z powrotem do układu lokalnego formatki (Panel Coordinates).
     * Ścisła operacja odwrotna do toWcsCoordinates (inwersja rotacji, dirs oraz translacja origin).
     */
    public toPanelCoordinates(wcsPoint: Vector3D): Vector3D {
        const totalRot = this.getRotation();
        const dirs = this.getDirections();

        // 1. Odwrócenie kierunków dirs
        const unDir = new Vec3(
            dirs.x !== 0 ? wcsPoint.x / dirs.x : wcsPoint.x,
            dirs.y !== 0 ? wcsPoint.y / dirs.y : wcsPoint.y,
            dirs.z !== 0 ? wcsPoint.z / dirs.z : wcsPoint.z
        );

        // 2. Odwrócenie rotacji
        const rx = -totalRot.x * Math.PI / 180;
        const ry = -totalRot.y * Math.PI / 180;
        const rz = -totalRot.z * Math.PI / 180;
        const qx = Quat.fromAxisAngle(Vec3.UNIT_X, rx);
        const qy = Quat.fromAxisAngle(Vec3.UNIT_Y, ry);
        const qz = Quat.fromAxisAngle(Vec3.UNIT_Z, rz);
        const rotQuat = qz.multiply(qy).multiply(qx);
        const rotMatrix = Mat4.fromQuaternion(rotQuat);
        const invRotMatrix = rotMatrix.invert();

        const unRot = invRotMatrix ? invRotMatrix.transformDirection(unDir) : unDir;

        // 3. Dodanie punktu początkowego origin
        const origin = this.getOrigin();
        return {
            x: unRot.x + origin.x,
            y: unRot.y + origin.y,
            z: unRot.z + origin.z
        };
    }

    /**
     * Transformacja wektora kierunkowego (np. osi otworu lub normalnej wpustu)
     * z układu WCS z powrotem do układu lokalnego formatki (Panel Coordinates).
     * Wektor podlega odwróceniu kierunków dirs i odwróceniu rotacji bez translacji origin.
     */
    public toPanelVector(wcsVector: Vector3D): Vector3D {
        const totalRot = this.getRotation();
        const dirs = this.getDirections();

        // 1. Odwrócenie kierunków dirs
        const unDir = new Vec3(
            dirs.x !== 0 ? wcsVector.x / dirs.x : wcsVector.x,
            dirs.y !== 0 ? wcsVector.y / dirs.y : wcsVector.y,
            dirs.z !== 0 ? wcsVector.z / dirs.z : wcsVector.z
        );

        // 2. Odwrócenie rotacji
        const rx = -totalRot.x * Math.PI / 180;
        const ry = -totalRot.y * Math.PI / 180;
        const rz = -totalRot.z * Math.PI / 180;
        const qx = Quat.fromAxisAngle(Vec3.UNIT_X, rx);
        const qy = Quat.fromAxisAngle(Vec3.UNIT_Y, ry);
        const qz = Quat.fromAxisAngle(Vec3.UNIT_Z, rz);
        const rotQuat = qz.multiply(qy).multiply(qx);
        const rotMatrix = Mat4.fromQuaternion(rotQuat);
        const invRotMatrix = rotMatrix.invert();

        const unRot = invRotMatrix ? invRotMatrix.transformDirection(unDir) : unDir;
        return {
            x: unRot.x,
            y: unRot.y,
            z: unRot.z
        };
    }

    /**
     * Obrót i odbicie wektora kierunkowego do układu WCS.
     * Wcześniej: 3× ręczne sin/cos z podatnością na Gimbal Lock (G8).
     * Teraz: delegacja do Mat4 — kaskadowe mnożenie macierzy.
     */
    public transformVector(vec: Vector3D): Vector3D {
        const totalRot = this.getRotation();
        const dirs = this.getDirections();

        // Budujemy macierz rotacji z kątów Eulera XYZ (w radianach, negacja bo WCS to inwersja)
        const rx = -totalRot.x * Math.PI / 180;
        const ry = -totalRot.y * Math.PI / 180;
        const rz = -totalRot.z * Math.PI / 180;

        // Kolejność: X → Y → Z (extrinsic, jak poprzednia implementacja)
        const qx = Quat.fromAxisAngle(Vec3.UNIT_X, rx);
        const qy = Quat.fromAxisAngle(Vec3.UNIT_Y, ry);
        const qz = Quat.fromAxisAngle(Vec3.UNIT_Z, rz);
        const rotQuat = qz.multiply(qy).multiply(qx); // right-to-left = X first
        const rotMatrix = Mat4.fromQuaternion(rotQuat);

        const input = new Vec3(vec.x, vec.y, vec.z);
        const rotated = rotMatrix.transformDirection(input);

        return {
            x: rotated.x * dirs.x,
            y: rotated.y * dirs.y,
            z: rotated.z * dirs.z
        };
    }
}

/**
 * Przelicza współrzędne wszystkich cech do nowego układu WCS
 * na podstawie ich zachowanych pozycji lokalnych formatki (panelPosition / panelStartPoint).
 */
export function retransformFeaturesToWcs(features: CAMFeature[], wcsManager: WcsManager): CAMFeature[] {
    return features.map(f => {
        if ('position' in f) {
            const hf = f as HoleFeature;
            const basePos = hf.panelPosition || hf.position;
            const basePositions = hf.panelPositions && hf.panelPositions.length > 0 
                ? hf.panelPositions 
                : (hf.positions || [basePos]);
            const baseAxis = hf.panelAxis || hf.axis;
            
            return {
                ...hf,
                panelPosition: hf.panelPosition || { ...hf.position },
                panelPositions: basePositions.map(p => ({ ...p })),
                panelAxis: baseAxis ? { ...baseAxis } : undefined,
                position: wcsManager.toWcsCoordinates(basePos),
                positions: basePositions.map(p => wcsManager.toWcsCoordinates(p)),
                axis: baseAxis ? wcsManager.transformVector(baseAxis) : undefined
            };
        }
        if ('startPoint' in f && 'endPoint' in f) {
            const gf = f as GrooveFeature;
            const baseStart = gf.panelStartPoint || gf.startPoint;
            const baseEnd = gf.panelEndPoint || gf.endPoint;
            const baseNormal = gf.panelNormal || gf.normal;
            return {
                ...gf,
                panelStartPoint: gf.panelStartPoint || { ...gf.startPoint },
                panelEndPoint: gf.panelEndPoint || { ...gf.endPoint },
                panelNormal: baseNormal ? { ...baseNormal } : undefined,
                startPoint: wcsManager.toWcsCoordinates(baseStart),
                endPoint: wcsManager.toWcsCoordinates(baseEnd),
                normal: baseNormal ? wcsManager.transformVector(baseNormal) : undefined
            };
        }
        if ('points' in f) {
            const cf = f as ContourFeature;
            const basePoints = cf.panelPoints && cf.panelPoints.length > 0 ? cf.panelPoints : cf.points;
            const baseNormal = cf.panelNormal || cf.normal;
            const rawPanelDepth = cf.panelDepth !== undefined ? cf.panelDepth : cf.depth;
            let targetWcsDepth = cf.depth;
            if (typeof rawPanelDepth === 'number' && Number.isFinite(rawPanelDepth) && basePoints.length > 0) {
                const p0z = basePoints[0].z;
                const nz = baseNormal ? (baseNormal.z >= 0 ? 1 : -1) : 1;
                const dirCheck = (rawPanelDepth - p0z) * nz;
                const targetZ_panel = (dirCheck < -1e-4)
                    ? rawPanelDepth
                    : p0z - nz * Math.abs(rawPanelDepth);
                const pTargetLocal = { x: basePoints[0].x, y: basePoints[0].y, z: targetZ_panel };
                targetWcsDepth = wcsManager.toWcsCoordinates(pTargetLocal).z;
            }
            return {
                ...cf,
                panelPoints: basePoints.map(p => ({ ...p })),
                panelNormal: baseNormal ? { ...baseNormal } : undefined,
                points: basePoints.map(p => wcsManager.toWcsCoordinates(p)),
                panelDepth: rawPanelDepth,
                depth: targetWcsDepth,
                panelSegments: Array.isArray(cf.panelSegments && cf.panelSegments.length > 0 ? cf.panelSegments : cf.segments)
                    ? (cf.panelSegments && cf.panelSegments.length > 0 ? cf.panelSegments : cf.segments)!.map(seg =>
                        seg.type === 'ARC'
                            ? { ...seg, start: { ...seg.start }, end: { ...seg.end }, center: { ...seg.center } }
                            : { ...seg, start: { ...seg.start }, end: { ...seg.end } }
                    )
                    : undefined,
                segments: Array.isArray(cf.panelSegments && cf.panelSegments.length > 0 ? cf.panelSegments : cf.segments)
                    ? (cf.panelSegments && cf.panelSegments.length > 0 ? cf.panelSegments : cf.segments)!.map(seg => {
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
                    })
                    : undefined,
                normal: baseNormal ? wcsManager.transformVector(baseNormal) : undefined
            };
        }
        if ('boundaryPoints' in f) {
            const pf = f as PocketFeature;
            const basePoints = pf.panelBoundaryPoints && pf.panelBoundaryPoints.length > 0 ? pf.panelBoundaryPoints : pf.boundaryPoints;
            const baseNormal = pf.panelNormal || pf.normal;
            return {
                ...pf,
                panelBoundaryPoints: basePoints.map(p => ({ ...p })),
                panelNormal: baseNormal ? { ...baseNormal } : undefined,
                boundaryPoints: basePoints.map(p => wcsManager.toWcsCoordinates(p)),
                normal: baseNormal ? wcsManager.transformVector(baseNormal) : undefined
            };
        }
        return f;
    });
}
