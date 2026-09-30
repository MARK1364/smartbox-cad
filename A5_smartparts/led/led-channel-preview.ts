/**
 * Wizualizacja kontenera LED w scenie 3D (Babylon.js).
 * Rysuje półprzezroczystą bryłę narzędzia cięcia (cyan neon), pokazując dokładną trasę frezowania w czasie rzeczywistym.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import type { WorldCutBox } from './led-channel-engine.js';

const PREVIEW_MESH_PREFIX = 'led_channel_preview_';

declare const BABYLON: any;

export class LedChannelPreview {
    private static _instances: Map<string, any> = new Map();

    /**
     * Aktualizuje lub tworzy wizualną bryłę kontenera LED w 3D.
     */
    static update(channelId: string, box: WorldCutBox | null): void {
        const scene = ContextManager.instance?.babylonScene || ContextManager.instance?.viewport?.scene;
        if (!scene || typeof BABYLON === 'undefined') return;

        const meshName = `${PREVIEW_MESH_PREFIX}${channelId}`;
        let mesh = this._instances.get(channelId);

        if (!mesh || mesh.isDisposed()) {
            mesh = scene.getMeshByName(meshName);
        }

        if (!box) {
            if (mesh) {
                mesh.dispose();
                this._instances.delete(channelId);
            }
            return;
        }

        const width = Math.max(1, box.xMax - box.xMin);
        const depth = Math.max(1, box.yMax - box.yMin);
        const height = Math.max(1, box.zMax - box.zMin);

        const centerX = (box.xMin + box.xMax) / 2;
        const centerY = (box.yMin + box.yMax) / 2;
        const centerZ = (box.zMin + box.zMax) / 2;

        if (!mesh || mesh.isDisposed()) {
            mesh = BABYLON.MeshBuilder.CreateBox(meshName, { width: 1, height: 1, depth: 1 }, scene);
            mesh.isPickable = true;
            mesh.metadata = { type: 'led_profile', channelId };

            const mat = new BABYLON.StandardMaterial(`${meshName}_mat`, scene);
            mat.diffuseColor = new BABYLON.Color3(0.92, 0.93, 0.95);
            mat.emissiveColor = new BABYLON.Color3(0.65, 0.7, 0.75);
            mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
            mat.alpha = 1.0;
            mat.backFaceCulling = false;

            mesh.material = mat;
            mesh.enableEdgesRendering();
            mesh.edgesWidth = 1.2;
            mesh.edgesColor = new BABYLON.Color4(0.35, 0.4, 0.45, 0.9);

            this._instances.set(channelId, mesh);
        }

        // Babylon.js jest układem Y-up (Y = góra, Z = głębokość).
        // W CAD Z-up: X = szerokość, Y = głębokość, Z = wysokość.
        mesh.scaling.x = width;
        mesh.scaling.y = height; // CAD Z -> Babylon Y (grubość wpustu w pionie)
        mesh.scaling.z = depth;  // CAD Y -> Babylon Z (szerokość rowka w osi głębokości)

        mesh.position.x = centerX;
        mesh.position.y = centerZ; // CAD Z -> Babylon Y
        mesh.position.z = centerY; // CAD Y -> Babylon Z
        mesh.setEnabled(true);
    }

    /**
     * Usuwa podgląd 3D wskazanego kanału.
     */
    static remove(channelId: string): void {
        const mesh = this._instances.get(channelId);
        if (mesh) {
            mesh.dispose();
            this._instances.delete(channelId);
        }
    }

    /**
     * Czyści wszystkie podglądy 3D kanałów LED.
     */
    static clearAll(): void {
        for (const [id, mesh] of this._instances.entries()) {
            if (mesh && !mesh.isDisposed()) {
                mesh.dispose();
            }
        }
        this._instances.clear();
    }
}
