/**
 * Sekcja `extensions.viewport` w pliku projektu.
 *
 * Kamera nie należy do drzewa CADNode — podpina się przez registerExtension(),
 * tak samo jak PMI i solver. Babylon zostaje w S3, core go nie importuje.
 */

import type { DocumentExtension, ProjectDocument } from '../A1_core/project-document.js';
import type { Viewport } from './viewport.js';

export const VIEWPORT_DOCUMENT_SECTION = 'viewport';
export const VIEWPORT_EXTENSION_VERSION = 1;

export interface ViewportCameraJSON {
    alpha: number;
    beta: number;
    radius: number;
    target: [number, number, number];
}

export interface ViewportExtensionJSON {
    version: number;
    camera?: ViewportCameraJSON;
}

export function serializeViewport(viewport: Viewport): ViewportExtensionJSON {
    const cam = viewport.camera;
    const target = cam?.target;
    return {
        version: VIEWPORT_EXTENSION_VERSION,
        camera: cam
            ? {
                alpha: cam.alpha,
                beta: cam.beta,
                radius: cam.radius,
                target: [target?.x ?? 0, target?.y ?? 0, target?.z ?? 0],
            }
            : undefined,
    };
}

export function applyViewport(viewport: Viewport, data: ViewportExtensionJSON | null | undefined): void {
    const camera = data?.camera;
    if (!camera || !viewport.camera) return;

    if (typeof camera.alpha === 'number' && typeof viewport.applyCameraPose === 'function') {
        viewport.applyCameraPose(camera.alpha, camera.beta, camera.radius, camera.target);
        return;
    }

    const cam = viewport.camera;
    if (Array.isArray(camera.target) && camera.target.length >= 3 && typeof cam.target?.set === 'function') {
        cam.target.set(camera.target[0], camera.target[1], camera.target[2]);
    }
    if (typeof camera.alpha === 'number') cam.alpha = camera.alpha;
    if (typeof camera.beta === 'number') cam.beta = camera.beta;
    if (typeof camera.radius === 'number') cam.radius = camera.radius;
}

export function attachViewportExtension(document: ProjectDocument, viewport: Viewport): () => void {
    const extension: DocumentExtension = {
        serialize: () => serializeViewport(viewport),
        load: (data) => applyViewport(viewport, data),
    };
    return document.registerExtension(VIEWPORT_DOCUMENT_SECTION, extension);
}
