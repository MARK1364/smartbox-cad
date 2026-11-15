import React, { useEffect, useRef } from 'react';
import type { FurnitureCatalogItem } from './platforma-types.js';

declare const BABYLON: any;

interface FurnitureViewer3DProps {
    item: FurnitureCatalogItem;
}

export const FurnitureViewer3D: React.FC<FurnitureViewer3DProps> = ({ item }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof BABYLON === 'undefined') return;

        let engine: any = null;
        let scene: any = null;

        try {
            engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
            scene = new BABYLON.Scene(engine);
            scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.14, 1.0);

            const { width_mm, height_mm, depth_mm } = item.dimensions;
            // Skala w metrach dla stabilności kamery (1 m = 1 jednostka Babylon)
            const W = width_mm / 1000;
            const H = height_mm / 1000;
            const D = depth_mm / 1000;
            const T = 0.018; // grubość płyty 18 mm

            // Kamera
            const maxDim = Math.max(W, H, D);
            const camera = new BABYLON.ArcRotateCamera(
                'viewerCam',
                -Math.PI / 3.5,
                Math.PI / 2.8,
                maxDim * 2.4,
                new BABYLON.Vector3(0, H / 2, 0),
                scene
            );
            camera.attachControl(canvas, true);
            camera.wheelPrecision = 40;
            camera.lowerRadiusLimit = maxDim * 0.8;
            camera.upperRadiusLimit = maxDim * 6;

            // Światła
            const hemi = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), scene);
            hemi.intensity = 0.75;
            hemi.groundColor = new BABYLON.Color3(0.2, 0.25, 0.35);

            const dirLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -2, -1), scene);
            dirLight.position = new BABYLON.Vector3(2, 4, 2);
            dirLight.intensity = 0.65;

            // Materiały
            const korpusMat = new BABYLON.StandardMaterial('korpusMat', scene);
            korpusMat.diffuseColor = new BABYLON.Color3(0.85, 0.88, 0.92);
            korpusMat.specularPower = 32;

            const frontMat = new BABYLON.StandardMaterial('frontMat', scene);
            frontMat.diffuseColor = new BABYLON.Color3(0.25, 0.45, 0.75);
            frontMat.specularPower = 48;

            const edgeColor = new BABYLON.Color4(0.1, 0.15, 0.25, 1.0);

            const createPanel = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: any) => {
                const mesh = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
                mesh.position = new BABYLON.Vector3(x, y, z);
                mesh.material = mat;
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 1.8;
                mesh.edgesColor = edgeColor;
                return mesh;
            };

            // Budowa parametrycznego korpusu mebla
            // Lewy bok
            createPanel('bok_l', T, H, D, -W / 2 + T / 2, H / 2, 0, korpusMat);
            // Prawy bok
            createPanel('bok_p', T, H, D, W / 2 - T / 2, H / 2, 0, korpusMat);
            // Dno
            createPanel('dno', W - 2 * T, T, D, 0, T / 2, 0, korpusMat);
            // Wieniec górny
            createPanel('gora', W - 2 * T, T, D, 0, H - T / 2, 0, korpusMat);
            // Plecy
            createPanel('plecy', W - 2 * T, H - 2 * T, 0.004, 0, H / 2, D / 2 - 0.002, korpusMat);

            // Wewnętrzne elementy (półki lub szuflady)
            if (item.shelfCount && item.shelfCount > 0) {
                const step = (H - 2 * T) / (item.shelfCount + 1);
                for (let i = 1; i <= item.shelfCount; i++) {
                    createPanel(`polka_${i}`, W - 2 * T, T, D - 0.02, 0, T + i * step, -0.01, korpusMat);
                }
            }

            // Front / Szuflady (odsunięte lekko do przodu dla czytelności 3D)
            if (item.drawerCount && item.drawerCount > 0) {
                const drawerH = (H - T * 2 - (item.drawerCount - 1) * 0.004) / item.drawerCount;
                for (let i = 0; i < item.drawerCount; i++) {
                    const y = T + drawerH / 2 + i * (drawerH + 0.004);
                    createPanel(`front_sz_${i}`, W - 0.006, drawerH, T, 0, y, -D / 2 - T / 2, frontMat);
                }
            } else if (item.doorCount && item.doorCount > 0) {
                if (item.doorCount === 1) {
                    createPanel('front_1d', W - 0.006, H - 0.006, T, 0, H / 2, -D / 2 - T / 2, frontMat);
                } else if (item.doorCount === 2) {
                    const halfW = (W - 0.008) / 2;
                    createPanel('front_2d_l', halfW, H - 0.006, T, -halfW / 2 - 0.002, H / 2, -D / 2 - T / 2, frontMat);
                    createPanel('front_2d_p', halfW, H - 0.006, T, halfW / 2 + 0.002, H / 2, -D / 2 - T / 2, frontMat);
                }
            }

            // Delikatny obrót kamery idle
            engine.runRenderLoop(() => {
                if (scene) scene.render();
            });

            const handleResize = () => {
                if (engine) engine.resize();
            };
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                scene.dispose();
                engine.dispose();
            };
        } catch (err) {
            console.warn('[FurnitureViewer3D] Błąd inicjalizacji Babylon:', err);
        }
    }, [item]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
        />
    );
};
