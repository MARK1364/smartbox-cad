/**
 * PMI Axis Guides — jednoczesne prowadnice GLOBAL (ciągłe) i LOCAL (przerywane).
 *
 * Podczas odsuwania wymiaru użytkownik widzi obie ramy i wybiera kierunek
 * kursorem. ALIGNED nie korzysta z tych prowadnic.
 */

declare const BABYLON: any;

import { Vec3, v3, v3Add, v3Dot, v3Len, v3Normalize, v3Scale } from './dimension-solver';
import { cadAxisKeyToRenderDirection, cadAxesFromRenderMatrix } from '../A1_core/cad-math/coord-system.js';

export const AXIS_KEYS = ['X', 'Y', 'Z'] as const;
export type CadAxisKey = (typeof AXIS_KEYS)[number];
export type GuideSpace = 'GLOBAL' | 'LOCAL';

/** Kolory CAD: X=czerwony, Y=zielony (głębokość), Z=niebieski (wysokość). */
export const AXIS_COLORS: Record<CadAxisKey, [number, number, number]> = {
    X: [1.0, 0.2, 0.2],
    Y: [0.45, 0.75, 0.2],
    Z: [0.2, 0.4, 1.0],
};

/** Osie pokrywają się, gdy kąt między nimi jest mniejszy niż 1°. */
export const GUIDE_OVERLAP_DOT = Math.cos((1 * Math.PI) / 180);

/** Oś równoległa do odcinka pomiaru nie nadaje się do odsunięcia. */
export const GUIDE_PARALLEL_DOT = 0.98;

export interface OffsetGuideCandidate {
    id: string;
    space: GuideSpace;
    axisKey: CadAxisKey;
    directionWorld: Vec3;
    originWorld: Vec3;
    length: number;
    valid: boolean;
    overlapped: boolean;
    /** Lokalna oś pokrywająca się z globalną jest ukrywana, żeby nie walczyła o piksele. */
    visible: boolean;
    label: string;
}

export function guideCandidateId(space: GuideSpace, axisKey: CadAxisKey): string {
    return `${space}_${axisKey}`;
}

export function globalAxisDirections(): Record<CadAxisKey, Vec3> {
    const y = cadAxisKeyToRenderDirection('Y');
    const z = cadAxisKeyToRenderDirection('Z');
    return {
        X: v3(1, 0, 0),
        Y: v3(y.x, y.y, y.z),
        Z: v3(z.x, z.y, z.z),
    };
}

export function localAxisDirections(matrixWorld: number[] | null): Record<CadAxisKey, Vec3> | null {
    if (!matrixWorld) return null;
    const cadAxes = cadAxesFromRenderMatrix(matrixWorld);
    const dirs: Record<CadAxisKey, Vec3> = {
        X: v3(cadAxes.X.x, cadAxes.X.y, cadAxes.X.z),
        Y: v3(cadAxes.Y.x, cadAxes.Y.y, cadAxes.Y.z),
        Z: v3(cadAxes.Z.x, cadAxes.Z.y, cadAxes.Z.z),
    };
    for (const key of AXIS_KEYS) {
        if (v3Len(dirs[key]) <= 1e-6) return null;
        dirs[key] = v3Normalize(dirs[key]);
    }
    return dirs;
}

export function isGuideParallelToMeasure(guideDir: Vec3, measureDir: Vec3 | null): boolean {
    if (!measureDir || v3Len(measureDir) <= 1e-6) return false;
    const m = v3Normalize(measureDir);
    const g = v3Len(guideDir) > 1e-6 ? v3Normalize(guideDir) : guideDir;
    return Math.abs(v3Dot(g, m)) >= GUIDE_PARALLEL_DOT;
}

function formatGuideLabel(
    space: GuideSpace,
    axisKey: CadAxisKey,
    overlapPartner: { space: GuideSpace; axisKey: CadAxisKey } | null,
): string {
    if (!overlapPartner) return space === 'LOCAL' ? `L:${axisKey}` : `G:${axisKey}`;
    if (overlapPartner.axisKey === axisKey) return `G/L:${axisKey}`;
    const a = space === 'GLOBAL' ? `G:${axisKey}` : `L:${axisKey}`;
    const b = overlapPartner.space === 'GLOBAL' ? `G:${overlapPartner.axisKey}` : `L:${overlapPartner.axisKey}`;
    return `${a}/${b}`;
}

export interface BuildGuideOptions {
    origin: Vec3;
    length: number;
    localMatrix: number[] | null;
    measureDirWorld: Vec3 | null;
}

export function buildOffsetGuideCandidates(opts: BuildGuideOptions): OffsetGuideCandidate[] {
    const { origin, length, localMatrix, measureDirWorld } = opts;
    const globalDirs = globalAxisDirections();
    const localDirs = localAxisDirections(localMatrix);

    const candidates: OffsetGuideCandidate[] = [];

    for (const key of AXIS_KEYS) {
        const dir = globalDirs[key];
        candidates.push({
            id: guideCandidateId('GLOBAL', key),
            space: 'GLOBAL',
            axisKey: key,
            directionWorld: dir,
            originWorld: origin,
            length,
            valid: !isGuideParallelToMeasure(dir, measureDirWorld),
            overlapped: false,
            visible: true,
            label: `G:${key}`,
        });
    }

    if (localDirs) {
        for (const key of AXIS_KEYS) {
            const dir = localDirs[key];
            candidates.push({
                id: guideCandidateId('LOCAL', key),
                space: 'LOCAL',
                axisKey: key,
                directionWorld: dir,
                originWorld: origin,
                length,
                valid: !isGuideParallelToMeasure(dir, measureDirWorld),
                overlapped: false,
                visible: true,
                label: `L:${key}`,
            });
        }
    }

    const globals = candidates.filter(c => c.space === 'GLOBAL');
    const locals = candidates.filter(c => c.space === 'LOCAL');

    for (const local of locals) {
        let best: OffsetGuideCandidate | null = null;
        let bestDot = GUIDE_OVERLAP_DOT;
        for (const global of globals) {
            const d = Math.abs(v3Dot(local.directionWorld, global.directionWorld));
            if (d >= bestDot) {
                bestDot = d;
                best = global;
            }
        }
        if (!best) continue;

        local.overlapped = true;
        best.overlapped = true;
        local.visible = false;
        best.label = formatGuideLabel('GLOBAL', best.axisKey, { space: 'LOCAL', axisKey: local.axisKey });
        local.label = best.label;
    }

    return candidates;
}

export function estimateGuideLength(scene: any, origin: Vec3): number {
    const camera = scene?.activeCamera;
    if (!camera) return 2500;

    const camPos = camera.globalPosition || camera.position;
    const dx = camPos.x - origin.x;
    const dy = camPos.y - origin.y;
    const dz = camPos.z - origin.z;
    const dist = Math.hypot(dx, dy, dz);
    return Math.max(600, Math.min(6000, dist * 2.2));
}

interface AxisLabelVisual {
    plane: any;
    texture: any;
    material: any;
    cacheKey: string;
}

export class PMIAxisGuides {
    private readonly scene: any;
    private readonly lines = new Map<string, any>();
    private readonly labels = new Map<string, AxisLabelVisual>();

    constructor(scene: any) {
        this.scene = scene;
    }

    public update(candidates: OffsetGuideCandidate[], activeId: string | null): void {
        if (!this.scene) return;

        const seen = new Set<string>();

        for (const cand of candidates) {
            seen.add(cand.id);
            const isActive = cand.id === activeId && cand.valid;
            this.updateLine(cand, isActive);
            this.updateLabelForCandidate(cand, isActive);
        }

        for (const [id, line] of this.lines) {
            if (!seen.has(id) && line && !line.isDisposed?.()) line.setEnabled(false);
        }
        for (const [id, label] of this.labels) {
            if (!seen.has(id) && label.plane && !label.plane.isDisposed?.()) label.plane.setEnabled(false);
        }
    }

    public hide(): void {
        for (const line of this.lines.values()) {
            if (line && !line.isDisposed?.()) line.setEnabled(false);
        }
        for (const label of this.labels.values()) {
            if (label.plane && !label.plane.isDisposed?.()) label.plane.setEnabled(false);
        }
    }

    public dispose(): void {
        for (const line of this.lines.values()) {
            if (line && !line.isDisposed?.()) line.dispose();
        }
        this.lines.clear();

        for (const label of this.labels.values()) {
            if (label.plane && !label.plane.isDisposed?.()) label.plane.dispose();
            if (label.material && !label.material.isDisposed?.()) label.material.dispose();
            if (label.texture && !label.texture.isDisposed?.()) label.texture.dispose();
        }
        this.labels.clear();
    }

    private updateLine(cand: OffsetGuideCandidate, isActive: boolean): void {
        const dir = cand.directionWorld;
        const rgb = AXIS_COLORS[cand.axisKey];
        const boost = isActive ? 1.0 : cand.valid ? 0.75 : 0.35;
        const color = new BABYLON.Color3(rgb[0] * boost, rgb[1] * boost, rgb[2] * boost);
        const alpha = !cand.valid ? 0.12 : isActive ? 0.95 : 0.38;

        const p0 = new BABYLON.Vector3(
            cand.originWorld.x - dir.x * cand.length,
            cand.originWorld.y - dir.y * cand.length,
            cand.originWorld.z - dir.z * cand.length,
        );
        const p1 = new BABYLON.Vector3(
            cand.originWorld.x + dir.x * cand.length,
            cand.originWorld.y + dir.y * cand.length,
            cand.originWorld.z + dir.z * cand.length,
        );

        const dashed = cand.space === 'LOCAL';
        const dashSize = Math.max(40, cand.length / 22);
        const gapSize = Math.max(24, cand.length / 32);

        let line = this.lines.get(cand.id);
        const needsRebuild = !line || line.isDisposed?.() || !!line.metadata?.pmiDashed !== dashed;

        if (needsRebuild) {
            if (line && !line.isDisposed?.()) line.dispose();
            line = dashed
                ? BABYLON.MeshBuilder.CreateDashedLines(
                    `pmi_axis_guide_${cand.id}`,
                    { points: [p0, p1], dashSize, gapSize },
                    this.scene,
                )
                : BABYLON.MeshBuilder.CreateLines(
                    `pmi_axis_guide_${cand.id}`,
                    { points: [p0, p1] },
                    this.scene,
                );
            line.isPickable = false;
            line.renderingGroupId = 2;
            line.metadata = { pmiDashed: dashed };
            this.lines.set(cand.id, line);
        } else if (dashed) {
            BABYLON.MeshBuilder.CreateDashedLines(
                null,
                { points: [p0, p1], dashSize, gapSize, instance: line },
            );
        } else {
            BABYLON.MeshBuilder.CreateLines(
                null,
                { points: [p0, p1], instance: line },
            );
        }

        line.color = color;
        line.alpha = alpha;
        line.setEnabled(cand.visible);
    }

    private updateLabelForCandidate(cand: OffsetGuideCandidate, isActive: boolean): void {
        if (!cand.visible) {
            const existing = this.labels.get(cand.id);
            if (existing?.plane && !existing.plane.isDisposed?.()) existing.plane.setEnabled(false);
            return;
        }

        const rgb = AXIS_COLORS[cand.axisKey];
        const alpha = !cand.valid ? 0.18 : isActive ? 0.95 : 0.46;
        const text = isActive && cand.valid ? `[${cand.label}]` : cand.label;
        const dir = cand.directionWorld;
        const pos = v3Add(
            cand.originWorld,
            v3Scale(dir, cand.length + Math.max(60, cand.length * 0.06)),
        );
        this.updateLabel(cand.id, text, pos, rgb, alpha, cand.length);
    }

    private updateLabel(
        key: string,
        text: string,
        pos: Vec3,
        rgb: [number, number, number],
        alpha: number,
        guideLength: number,
    ): void {
        const labelH = Math.max(90, guideLength * 0.055);
        const labelW = Math.max(labelH * 1.4, text.length * labelH * 0.52);
        const cacheKey = `${text}|${rgb.join(',')}|${alpha.toFixed(2)}|${labelW.toFixed(0)}|${labelH.toFixed(0)}`;

        let visual = this.labels.get(key);
        if (!visual || visual.plane?.isDisposed?.()) {
            visual = this.buildLabel(key, text, rgb, alpha, labelW, labelH);
            this.labels.set(key, visual);
        } else if (visual.cacheKey !== cacheKey) {
            if (visual.plane && !visual.plane.isDisposed?.()) visual.plane.dispose();
            if (visual.material && !visual.material.isDisposed?.()) visual.material.dispose();
            if (visual.texture && !visual.texture.isDisposed?.()) visual.texture.dispose();
            visual = this.buildLabel(key, text, rgb, alpha, labelW, labelH);
            this.labels.set(key, visual);
        }

        visual.plane.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
        visual.plane.setEnabled(true);
    }

    private buildLabel(
        key: string,
        text: string,
        rgb: [number, number, number],
        alpha: number,
        labelW: number,
        labelH: number,
    ): AxisLabelVisual {
        const texWidth = 192;
        const texHeight = 64;
        const cacheKey = `${text}|${rgb.join(',')}|${alpha.toFixed(2)}|${labelW.toFixed(0)}|${labelH.toFixed(0)}`;

        const texture = new BABYLON.DynamicTexture(
            `pmi_axis_lbl_tex_${key}`,
            { width: texWidth, height: texHeight },
            this.scene,
            false,
        );
        texture.hasAlpha = true;

        const ctx = texture.getContext();
        ctx.clearRect(0, 0, texWidth, texHeight);
        ctx.font = 'bold 32px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}, ${Math.min(1, alpha + 0.08)})`;
        ctx.fillText(text, texWidth / 2, texHeight / 2);
        texture.update();

        const plane = BABYLON.MeshBuilder.CreatePlane(`pmi_axis_lbl_${key}`, {
            width: labelW,
            height: labelH,
        }, this.scene);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.renderingGroupId = 2;
        plane.isPickable = false;

        const material = new BABYLON.StandardMaterial(`pmi_axis_lbl_mat_${key}`, this.scene);
        material.diffuseTexture = texture;
        material.emissiveColor = new BABYLON.Color3(1, 1, 1);
        material.disableLighting = true;
        material.backFaceCulling = false;
        material.useAlphaFromDiffuseTexture = true;
        plane.material = material;

        return { plane, texture, material, cacheKey };
    }
}

/** Środek odcinka — wygodny import dla narzędzi PMI. */
export function axisGuideOrigin(a: Vec3, b: Vec3): Vec3 {
    return v3Add(v3Scale(a, 0.5), v3Scale(b, 0.5));
}
