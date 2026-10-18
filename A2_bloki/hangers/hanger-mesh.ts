/**
 * Wizualizacja GLB zawieszki (HardwareLoader) — prawa strona lustrzana.
 */

import type { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { cadToRender } from '../../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { HardwareLoader } from '../../B1_biblioteka/hardware-loader.js';
import { hangerGlbTemplateId } from '../../B1_biblioteka/zawieszki/hangers-from-catalog.js';
import type { HangerParamsMm } from './hanger-types.js';
import { resolveCutPlacementInPartLcsMm } from './smartpart-bay-placement.js';
import { cutOrientFromRefs } from '../../S5_studio/smartpart-studio-types.js';

function disposeHangerVisual(scene: any, cntNodeId: string): void {
    if (!scene || !cntNodeId) return;
    const tnName = `hanger_glb_${cntNodeId}`;
    const existing = scene.getTransformNodeByName?.(tnName);
    if (existing) {
        try { existing.dispose(); } catch { /* ignore */ }
    }
    const existingMesh = scene.getMeshByName?.(tnName);
    if (existingMesh) {
        try { existingMesh.dispose(); } catch { /* ignore */ }
    }
    for (const mesh of scene.meshes || []) {
        if (
            mesh?.name?.startsWith(`mesh_part_${cntNodeId}`) ||
            mesh?.name?.startsWith(`mesh_cut_${cntNodeId}`) ||
            (mesh?.name?.startsWith('hanger_glb_') && mesh?.metadata?.nodeId === cntNodeId)
        ) {
            try { mesh.dispose(); } catch { /* ignore */ }
        }
    }
}

function findSceneNode(scene: any, nodeId: string): any | null {
    if (!nodeId || !scene) return null;
    const syncAdapter = (ContextManager.instance as any)?.sceneSyncAdapter;
    const fromSync = syncAdapter?.getMeshForNodeId?.(nodeId);
    if (fromSync && !fromSync.isDisposed?.()) return fromSync;
    const doc = ContextManager.instance?.document;
    const cadNode = doc?.findNode?.(nodeId);
    if (cadNode?.domainData) {
        const cv = ContextManager.instance?.containerViews?.get(cadNode.domainData);
        if (cv?.rootNode && !cv.rootNode.isDisposed?.()) return cv.rootNode;
    }
    const tn = scene.getTransformNodeByName?.(nodeId);
    if (tn && !tn.isDisposed?.()) return tn;
    const m = scene.getMeshByName?.(nodeId);
    if (m && !m.isDisposed?.()) return m;
    return null;
}

/**
 * Buduje / odświeża mesh zawieszki przy węźle kontenera.
 * - Jeśli zdefiniowano plik GLB (np. Camaro 806): ładuje model 3D z HardwareLoader.
 * - Jeśli brak GLB (własny SmartPart ze Studio): buduje geometrię parametryczną brył (parts).
 */
export function buildHangerGlbMesh(cntNode: CADNode, params: HangerParamsMm): void {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const scene = ContextManager.instance?.viewport?.scene || win?.__cad_scene;
    if (!scene) return;

    disposeHangerVisual(scene, cntNode.id);

    const rawGlb = params.glbModelPath?.trim();
    const glbId = rawGlb ? hangerGlbTemplateId(rawGlb) : null;

    if (glbId) {
        const place = (instance: any) => {
            if (!instance) return;
            instance.name = `hanger_glb_${cntNode.id}`;
            instance.metadata = {
                type: 'smartpart_hanger_glb',
                nodeId: cntNode.id,
                side: params.side,
                glb: true,
            };

            // Preferuj własny węzeł sceny (SceneSync trzyma TRS CAD→Babylon)
            const selfMesh = findSceneNode(scene, cntNode.id);
            const parentId = cntNode.parent?.id;
            const parentMesh = selfMesh || (parentId ? findSceneNode(scene, parentId) : null);

            if (selfMesh) {
                instance.parent = selfMesh;
                instance.position.set(0, 0, 0);
                if (typeof selfMesh.setEnabled === 'function') {
                    // Ukryj domyślny box kontenera na rzecz modelu GLB
                    if (selfMesh.material) selfMesh.material.alpha = 0;
                }
            } else if (parentMesh) {
                const { translation } = cntNode.localMatrix.decompose();
                const bPos = cadToRender(new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z)));
                instance.parent = parentMesh;
                instance.position.set(bPos.x, bPos.y, bPos.z);
            } else {
                instance.dispose();
                return;
            }

            const s = Math.abs(instance.scaling?.x || 1) || 1;
            instance.scaling.set(params.side === 'R' ? -s : s, s, s);
            instance.setEnabled(true);
            ContextManager.instance?.viewport?.requestRender?.(4);
        };

        const loader = HardwareLoader.instance;
        if (loader.hasTemplate(glbId)) {
            place(loader.createHandleInstance(glbId, scene));
            return;
        }

        loader.loadTemplate(glbId, scene).then((tpl) => {
            if (!tpl) return;
            disposeHangerVisual(scene, cntNode.id);
            place(loader.createHandleInstance(glbId, scene));
        }).catch((err) => {
            console.warn('[SmartParts Hanger] GLB niedostępny:', glbId, err);
        });
        return;
    }

    // Brak modelu GLB -> budujemy parametryczną geometrię SmartParta z definicji
    buildParametricSmartPartMesh(scene, cntNode, params);
}

function buildParametricSmartPartMesh(scene: any, cntNode: CADNode, params: HangerParamsMm): void {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const BABYLON = win?.BABYLON || (scene?.getEngine ? (scene.constructor as any)._babylon || win?.BABYLON : null);
    if (!BABYLON) return;

    const selfMesh = findSceneNode(scene, cntNode.id);
    const parentId = cntNode.parent?.id;
    const parentMesh = selfMesh || (parentId ? findSceneNode(scene, parentId) : null);

    const gp = (cntNode.domainData as any)?.generatorParams;
    const def = params.definition || gp?.definition;
    const allParts: any[] = Array.isArray(def?.parts) && def.parts.length > 0
        ? def.parts
        : def?.partBody
            ? [def.partBody]
            : [];

    const isSmartPart = Boolean(gp?.isSmartPart || params.part);
    let partsToRender = params.part ? [params.part] : allParts;
    if (!params.part && allParts.length > 1) {
        const sideParts = allParts.filter((p: any) => {
            const refX = (p.refX || '').toUpperCase();
            if (params.side === 'L' && refX === 'LEFT') return true;
            if (params.side === 'R' && refX === 'RIGHT') return true;
            return false;
        });
        if (sideParts.length > 0) {
            partsToRender = sideParts;
        }
    }

    if (partsToRender.length === 0) {
        partsToRender = [
            {
                id: 'part_default',
                widthMm: params.widthMm || 20,
                heightMm: params.heightMm || 38,
                depthMm: params.depthMm || 70,
                colorHex: '#38bdf8',
            }
        ];
    }

    // Jeśli selfMesh istnieje z ContainerView i odpowiada dokładnie temu Partowi — pokoloruj go i użyj bezpośrednio
    const part = params.part || partsToRender[0];
    if (selfMesh && isSmartPart && part?.colorHex && selfMesh.material) {
        try {
            selfMesh.material.diffuseColor = BABYLON.Color3.FromHexString(part.colorHex);
            selfMesh.material.emissiveColor = selfMesh.material.diffuseColor.scale(0.15);
            selfMesh.material.alpha = 0.35;
        } catch { /* ignore */ }
    }

    const rootNode = new BABYLON.TransformNode(`hanger_glb_${cntNode.id}`, scene);
    rootNode.metadata = {
        type: 'smartpart_hanger_visual',
        nodeId: cntNode.id,
        side: params.side,
        parametric: true,
    };

    if (selfMesh) {
        rootNode.parent = selfMesh;
        rootNode.position.set(0, 0, 0);
    } else if (parentMesh) {
        const { translation } = cntNode.localMatrix.decompose();
        const bPos = cadToRender(new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z)));
        rootNode.parent = parentMesh;
        rootNode.position.set(bPos.x, bPos.y, bPos.z);
    } else {
        // Brak rodzica — nie wstawiaj w próżnię świata
        rootNode.dispose();
        return;
    }

    // Tworzymy pomocniczy box tylko gdy brak selfMesh (fallback) lub gdy to klasyczne okucie Camaro
    if (!selfMesh || !isSmartPart) {
        for (let i = 0; i < partsToRender.length; i++) {
            const p = partsToRender[i];
            const w = Math.max(1, Number(p.widthMm) || params.widthMm || 20);
            const h = Math.max(1, Number(p.heightMm) || params.heightMm || 38);
            const d = Math.max(1, Number(p.depthMm) || params.depthMm || 70);

            const box = BABYLON.MeshBuilder.CreateBox(`mesh_part_${cntNode.id}_${p.id || i}`, {
                width: w,
                height: h,
                depth: d,
            }, scene);

            box.parent = rootNode;
            if (isSmartPart) {
                box.position.set(0, 0, 0);
            } else {
                const signX = params.side === 'R' ? -1 : 1;
                box.position.set(signX * (w / 2), -(d / 2), -(h / 2));
            }

            if (typeof box.enableEdgesRendering === 'function') {
                box.enableEdgesRendering();
                box.edgesWidth = 2.0;
                box.edgesColor = new BABYLON.Color4(0.18, 0.22, 0.28, 0.95);
            }

            const mat = new BABYLON.StandardMaterial(`mat_${cntNode.id}_${p.id || i}`, scene);
            const colHex = p.colorHex || '#38bdf8';
            try {
                mat.diffuseColor = BABYLON.Color3.FromHexString(colHex);
                mat.emissiveColor = mat.diffuseColor.scale(0.15);
            } catch {
                mat.diffuseColor = new BABYLON.Color3(0.22, 0.74, 0.97);
            }
            mat.alpha = 0.35;
            box.material = mat;
            box.metadata = { type: 'smartpart_part', nodeId: cntNode.id, partId: p.id };
            box.isPickable = false;
        }
    }


    // Walce / kieszenie — dzieci Parta (FEATURE) albo cuts z definition
    const cutChildren = (cntNode.children || []).filter((ch: any) => {
        const dd = ch?.domainData as any;
        return dd?.role === 'SMARTPART_CUT' || dd?.type === 'smartpart_cut';
    });

    if (cutChildren.length > 0) {
        for (const cutChild of cutChildren) {
            const dd = cutChild.domainData as any;
            const cut = dd?.generatorParams?.cut || dd;
            addCutMesh(BABYLON, scene, rootNode, cntNode.id, cut, cutChild);
        }
    } else if (def && Array.isArray(def.cuts)) {
        const partId = params.part?.id || partsToRender[0]?.id;
        const partIndex = allParts.findIndex((p: any) => p.id === partId);
        const part = params.part || partsToRender[0];
        if (part?.frozen === true) {
            /* zamrożony Part — bez meshy wycięć */
        } else {
            const cuts = def.cuts.filter((c: any) => {
                if (c?.frozen === true) return false;
                if (c.partId) return c.partId === partId;
                return allParts.length <= 1 && partIndex <= 0;
            });
            for (const cut of cuts) {
                addCutMesh(BABYLON, scene, rootNode, cntNode.id, cut, null, part);
            }
        }
    }

    ContextManager.instance?.viewport?.requestRender?.(4);
}

/**
 * Mesh cięcia w lokalnym układzie Parta.
 * Dane = CAD (X szer., Y głęb., Z wys.); Babylon: cadToRender (Y↔Z).
 */
function addCutMesh(
    BABYLON: any,
    scene: any,
    parent: any,
    cntNodeId: string,
    cut: any,
    cutChild: any | null,
    partAbs?: any,
): void {
    if (!cut) return;
    let mesh: any;
    const cutId = cut.id || 'cut';

    if (cut.type === 'HOLE') {
        const dia = Math.max(1, Number(cut.diameterMm) || 8);
        const len = Math.max(1, Number(cut.lengthMm) || 24);
        mesh = BABYLON.MeshBuilder.CreateCylinder(`mesh_cut_${cntNodeId}_${cutId}`, {
            diameter: dia,
            height: len,
            tessellation: 24,
        }, scene);
        const { axis: holeAxis } = cutOrientFromRefs(cut);
        // Cylinder Babylon wzdłuż Y (= CAD Z)
        if (holeAxis === 'X') {
            mesh.rotation.z = Math.PI / 2;
        } else if (holeAxis === 'Y') {
            mesh.rotation.x = Math.PI / 2; // CAD Y (głęb.) → Babylon Z
        }
        // axis Z (CAD wys.) — domyślna oś cylindra (Babylon Y)
    } else {
        mesh = BABYLON.MeshBuilder.CreateBox(`mesh_cut_${cntNodeId}_${cutId}`, {
            width: Math.max(1, Number(cut.widthMm) || 16),
            height: Math.max(1, Number(cut.heightMm) || 32),
            depth: Math.max(1, Number(cut.depthMm) || 15),
        }, scene);
    }

    mesh.parent = parent;
    if (cutChild && typeof cutChild.localMatrix?.decompose === 'function') {
        const { translation } = cutChild.localMatrix.decompose();
        // lokal CAD nm → Babylon mm
        mesh.position.set(
            nmToMm(translation.x),
            nmToMm(translation.z),
            nmToMm(translation.y),
        );
    } else if (partAbs) {
        const cutLcs = resolveCutPlacementInPartLcsMm(partAbs, cut);
        // HOLE / POCKET: xMm/yMm/zMm = początek (LCS) → mesh w środku bryły
        let x = cutLcs.xMm;
        let y = cutLcs.yMm;
        let z = cutLcs.zMm;
        if (cut.type === 'HOLE' || cut.type === 'POCKET') {
            const { axis, direction: dir } = cutOrientFromRefs(cut);
            const half = cut.type === 'HOLE'
                ? Math.max(1, Number(cut.lengthMm) || 0) / 2
                : axis === 'X' ? Math.max(1, Number(cut.widthMm) || 0) / 2
                : axis === 'Y' ? Math.max(1, Number(cut.depthMm) || 0) / 2
                : Math.max(1, Number(cut.heightMm) || 0) / 2;
            if (axis === 'X') x += dir * half;
            else if (axis === 'Y') y += dir * half;
            else z += dir * half;
        }
        mesh.position.set(x, z, y); // CAD → Babylon
    } else {
        mesh.position.set(0, 0, 0);
    }

    if (typeof mesh.enableEdgesRendering === 'function') {
        mesh.enableEdgesRendering();
        mesh.edgesWidth = 1.8;
        mesh.edgesColor = cut.type === 'HOLE'
            ? new BABYLON.Color4(0.22, 0.74, 0.97, 1.0)
            : new BABYLON.Color4(0.96, 0.62, 0.04, 1.0);
    }

    const mat = new BABYLON.StandardMaterial(`mat_cut_${cntNodeId}_${cutId}`, scene);
    if (cut.type === 'HOLE') {
        mat.diffuseColor = new BABYLON.Color3(0.22, 0.74, 0.97);
        mat.emissiveColor = new BABYLON.Color3(0.08, 0.35, 0.55);
    } else {
        mat.diffuseColor = new BABYLON.Color3(0.96, 0.62, 0.04);
        mat.emissiveColor = new BABYLON.Color3(0.4, 0.22, 0.02);
    }
    mat.alpha = 0.85;
    mesh.material = mat;
    mesh.metadata = { type: 'smartpart_cut', nodeId: cntNodeId, cutId };
}

/**
 * Po rebuildzie geometrii odtwarza mesh Partów / cuts zawieszek SmartPart.
 * Bez tego widać tylko otwory na formatkach (ContainerView jest niewidoczny, a parametric mesh znika).
 * Usuwa też osierocone meshe po skasowaniu SmartPart z drzewa.
 */
export function syncHangerMeshesFromDocument(document: any): void {
    if (!document?.rootNode) return;
    const liveHangerIds = new Set<string>();
    const stack: any[] = [document.rootNode];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (Array.isArray(node.children)) {
            for (const ch of node.children) stack.push(ch);
        }
        const gp = node.domainData?.generatorParams;
        if (!gp) continue;
        const isHanger =
            node.domainData?.role === 'SMARTPART_HANGER'
            || gp.type === 'smartpart_hanger';
        if (!isHanger) continue;
        liveHangerIds.add(node.id);
        try {
            buildHangerGlbMesh(node, {
                hardwareId: gp.hardwareId || '',
                side: gp.side || 'L',
                fromTopMm: Number(gp.fromTopMm) || 0,
                fromBackMm: Number(gp.fromBackMm) || 0,
                fromSideMm: Number(gp.fromSideMm) || 0,
                widthMm: Number(gp.widthMm) || 20,
                heightMm: Number(gp.heightMm) || 38,
                depthMm: Number(gp.depthMm) || 70,
                glbModelPath: gp.glbModelPath || '',
                definition: gp.definition,
                part: gp.part,
            });
        } catch (err) {
            console.warn('[HangerMesh] sync:', err);
        }
    }

    // Osierocone Part/cut/GLB / wireframe po delete — drzewo już bez węzła, mesh zostawał na scenie
    purgeOrphanHangerMeshes(document, liveHangerIds);
}

/** Usuwa meshe SmartPart bez odpowiadającego CADNode (ghosty po delete z drzewa). */
export function purgeOrphanHangerMeshes(document: any, liveHangerIds?: Set<string>): void {
    const scene = ContextManager.instance?.viewport?.scene
        || (typeof window !== 'undefined' ? (window as any).__cad_scene : null);
    if (!scene || !document) return;
    const live = liveHangerIds || new Set<string>();
    const orphanTypes = new Set(['smartpart_hanger', 'smartpart_part', 'smartpart_cut', 'smartpart_hangers']);
    const tryDispose = (obj: any) => {
        try { obj?.dispose?.(false, true); } catch { /* ignore */ }
    };
    const isOrphan = (obj: any): boolean => {
        const meta = obj?.metadata;
        if (!meta) return false;
        const nid = meta.nodeId || meta.model?.id;
        if (!nid) {
            const name = String(obj?.name || '');
            return name.startsWith('mesh_part_') || name.startsWith('mesh_cut_') || name.startsWith('hanger_glb_');
        }
        if (live.has(nid) || document.findNode?.(nid)) return false;
        if (orphanTypes.has(meta.type)) return true;
        const name = String(obj?.name || '');
        return name.startsWith('mesh_part_') || name.startsWith('mesh_cut_') || name.startsWith('hanger_glb_');
    };
    for (const mesh of [...(scene.meshes || [])]) {
        if (isOrphan(mesh)) tryDispose(mesh);
    }
    for (const tn of [...(scene.transformNodes || [])]) {
        if (isOrphan(tn)) tryDispose(tn);
    }
}
