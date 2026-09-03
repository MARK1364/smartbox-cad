/**
 * E2_export - DrawingStudio.tsx
 * Pełnoprawne Studio Eksportu 3D z niezależną kontrolą każdego modelu:
 * - Każdy przeciągnięty model ma własną niezależną orientację 3D (obrót do widoku Przód, Góra, Bok, Izometria),
 * - Kostka widoków (ViewCube) obraca zaznaczony model,
 * - Modele można swobodnie przesuwać po arkuszu myszą (PointerDragBehavior w 3D),
 * - Asocjatywne wymiary PMI w przestrzeni 3D na każdym modelu,
 * - Wirtualny arkusz ISO (A4/A3/A2 z tabelką ISO 7200) z drukiem PDF/JPG.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    CADTreeNode,
    PaperFormat,
    PAPER_FORMATS,
    TitleBlockInfo,
} from './drawing-types';
import { DrawingProjectExtractor, LIVE_PROJECT_STORAGE_KEY, LIVE_PMI_STORAGE_KEY, SYNC_CHANNEL_NAME } from './drawing-project-extractor';

declare const BABYLON: any;

interface PlacedModel3D {
    id: string;
    node: CADTreeNode;
    position: [number, number, number];
    rotation: [number, number, number]; // radiany [rx, ry, rz]
    scale: number;
    angleName: string; // "Przód", "Góra", "Bok", "Izometria"
    showPMI: boolean;
}

const VIEW_ANGLES: { key: string; label: string; rx: number; ry: number; rz: number }[] = [
    { key: 'front', label: 'Przód', rx: 0, ry: 0, rz: 0 },
    { key: 'top', label: 'Góra', rx: -Math.PI / 2, ry: 0, rz: 0 },
    { key: 'left', label: 'Bok L', rx: 0, ry: Math.PI / 2, rz: 0 },
    { key: 'right', label: 'Bok P', rx: 0, ry: -Math.PI / 2, rz: 0 },
    { key: 'back', label: 'Tył', rx: 0, ry: Math.PI, rz: 0 },
    { key: 'bottom', label: 'Dół', rx: Math.PI / 2, ry: 0, rz: 0 },
    { key: 'isometric', label: 'Izometria', rx: -0.55, ry: 0.78, rz: 0 },
];

// Komponent rekurencyjnego węzła drzewa CAD z obsługą Drag & Drop
const TreeItemRow: React.FC<{
    node: CADTreeNode;
    selectedNodeId: string | null;
    onSelectNode: (node: CADTreeNode) => void;
    level?: number;
}> = ({ node, selectedNodeId, onSelectNode, level = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeId === node.id;

    const handleDragStart = (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/json', JSON.stringify(node));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: level > 0 ? '12px' : '0' }}>
            <div
                draggable={true}
                onDragStart={handleDragStart}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode(node);
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'grab',
                    fontSize: '11px',
                    userSelect: 'none',
                    background: isSelected ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                    border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.04)'}`,
                    color: isSelected ? '#93c5fd' : '#cbd5e1',
                    marginBottom: '2px',
                    transition: 'background 0.15s',
                }}
                title="Chwyć i przeciągnij na arkusz 3D (możesz upuścić ten sam model wielokrotnie)!"
            >
                {hasChildren ? (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        style={{ cursor: 'pointer', fontSize: '9px', width: '12px', color: '#94a3b8' }}
                    >
                        {isExpanded ? '▼' : '▶'}
                    </span>
                ) : (
                    <span style={{ width: '12px' }}></span>
                )}

                <span style={{ fontSize: '13px' }}>{node.icon}</span>
                <strong style={{ flex: 1, fontWeight: hasChildren ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {node.name}
                </strong>

                <span style={{ fontSize: '9px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
                    {node.width}×{node.height}{node.depth && node.type !== 'PROJECT' ? `×${node.depth}` : ''} mm
                </span>
            </div>

            {hasChildren && isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {node.children!.map((child) => (
                        <TreeItemRow
                            key={child.id}
                            node={child}
                            selectedNodeId={selectedNodeId}
                            onSelectNode={onSelectNode}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const DrawingStudio: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewCubeRef = useRef<HTMLDivElement>(null);

    const [rootNode, setRootNode] = useState<CADTreeNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<CADTreeNode | null>(null);

    // Parametry arkusza
    const [paperFormat, setPaperFormat] = useState<PaperFormat>('A4_LANDSCAPE');
    const [renderStyle, setRenderStyle] = useState<'technical' | 'shaded' | 'wireframe'>('technical');
    const [titleBlock, setTitleBlock] = useState<TitleBlockInfo>(() => ({
        projectName: 'Projekt WebCAD',
        furnitureName: 'Szafka / Komoda',
        author: 'SmartBox CAD',
        date: new Date().toISOString().split('T')[0],
        scale: '1:10',
        sheetNumber: '1/1',
        drawingNumber: 'SB-001',
        remarks: '',
    }));

    // Modele umieszczone na arkuszu 3D
    const [placedModels, setPlacedModels] = useState<PlacedModel3D[]>([]);
    const [activeModelId, setActiveModelId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Referencje Babylon.js
    const engineRef = useRef<any>(null);
    const sceneRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // ─── Inicjalizacja Sceny 3D Babylon.js ───

    useEffect(() => {
        if (!canvasRef.current || typeof BABYLON === 'undefined') return;

        const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0.96, 0.97, 0.98, 1.0); // Czyste białe tło CAD

        // Główna kamera prostopadła do arkusza
        const camera = new BABYLON.ArcRotateCamera(
            'exportSheetCamera',
            -Math.PI / 2,
            Math.PI / 2,
            1600,
            new BABYLON.Vector3(0, 0, 0),
            scene
        );
        camera.attachControl(canvasRef.current, true);
        camera.wheelPrecision = 1.2;
        camera.minZ = 1;
        camera.maxZ = 10000;

        // Oświetlenie CAD
        const hemiLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.95;
        const dirLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -2, -1), scene);
        dirLight.intensity = 0.45;

        engineRef.current = engine;
        sceneRef.current = scene;
        cameraRef.current = camera;

        engine.runRenderLoop(() => {
            scene.render();
        });

        const handleResize = () => engine.resize();
        window.addEventListener('resize', handleResize);

        // Wczytanie początkowego drzewa
        refreshTree();

        return () => {
            window.removeEventListener('resize', handleResize);
            engine.dispose();
        };
    }, []);

    const refreshTree = () => {
        const tree = DrawingProjectExtractor.instance.extractProjectTree();
        setRootNode(tree.rootNode);
        setSelectedNode(tree.rootNode);

        // Jeśli nie ma jeszcze modeli, dodaj pierwszy
        if (placedModels.length === 0 && tree.rootNode) {
            addModelToScene(tree.rootNode, [-300, 0, 0], 'Przód');
        }
    };

    // ─── Dodawanie Niezależnego Modelu 3D na Scenę ───

    const addModelToScene = (node: CADTreeNode, pos: [number, number, number] = [0, 0, 0], angleName = 'Przód') => {
        const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        if (sceneRef.current) {
            buildMeshForNode(sceneRef.current, node, modelId, pos, angleName);
        }

        const angleDef = VIEW_ANGLES.find((a) => a.label.toLowerCase() === angleName.toLowerCase()) || VIEW_ANGLES[0];

        const newModel: PlacedModel3D = {
            id: modelId,
            node,
            position: pos,
            rotation: [angleDef.rx, angleDef.ry, angleDef.rz],
            scale: 1.0,
            angleName: angleDef.label,
            showPMI: true,
        };

        setPlacedModels((prev) => [...prev, newModel]);
        setActiveModelId(modelId);
        showToast(`Dodano model: ${node.name} (${angleDef.label})`);
    };

    const buildMeshForNode = (
        scene: any,
        node: CADTreeNode,
        modelId: string,
        pos: [number, number, number],
        angleName: string
    ) => {
        const parentMesh = new BABYLON.TransformNode(`node_${modelId}`, scene);
        parentMesh.position = new BABYLON.Vector3(pos[0], pos[1], pos[2]);

        const angleDef = VIEW_ANGLES.find((a) => a.label.toLowerCase() === angleName.toLowerCase()) || VIEW_ANGLES[0];
        parentMesh.rotation = new BABYLON.Vector3(angleDef.rx, angleDef.ry, angleDef.rz);

        const W = node.width || 600;
        const H = node.height || 720;
        const D = node.depth || 560;

        // Materiał płyt
        const mat = new BABYLON.StandardMaterial(`mat_${modelId}`, scene);
        if (renderStyle === 'technical') {
            mat.diffuseColor = new BABYLON.Color3(0.98, 0.98, 0.98);
            mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        } else {
            mat.diffuseColor = new BABYLON.Color3(0.92, 0.85, 0.72);
            mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        }

        if (node.type === 'PART') {
            const box = BABYLON.MeshBuilder.CreateBox(`box_${modelId}`, { width: W, height: H, depth: node.thickness || 18 }, scene);
            box.material = mat;
            box.parent = parentMesh;
            box.enableEdgesRendering();
            box.edgesWidth = 3.0;
            box.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            attachDragAndClick(box, modelId);
        } else {
            // Szafka / Korpus (Boki, Wieniec góra, dół)
            const T = 18;
            const left = BABYLON.MeshBuilder.CreateBox(`left_${modelId}`, { width: T, height: H, depth: D }, scene);
            left.position.x = -W / 2 + T / 2;
            left.material = mat;
            left.parent = parentMesh;
            left.enableEdgesRendering();
            left.edgesWidth = 2.5;
            left.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            attachDragAndClick(left, modelId);

            const right = BABYLON.MeshBuilder.CreateBox(`right_${modelId}`, { width: T, height: H, depth: D }, scene);
            right.position.x = W / 2 - T / 2;
            right.material = mat;
            right.parent = parentMesh;
            right.enableEdgesRendering();
            right.edgesWidth = 2.5;
            right.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            attachDragAndClick(right, modelId);

            const bottom = BABYLON.MeshBuilder.CreateBox(`bottom_${modelId}`, { width: W - 2 * T, height: T, depth: D }, scene);
            bottom.position.y = -H / 2 + T / 2;
            bottom.material = mat;
            bottom.parent = parentMesh;
            bottom.enableEdgesRendering();
            bottom.edgesWidth = 2.5;
            bottom.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            attachDragAndClick(bottom, modelId);

            const top = BABYLON.MeshBuilder.CreateBox(`top_${modelId}`, { width: W - 2 * T, height: T, depth: D }, scene);
            top.position.y = H / 2 - T / 2;
            top.material = mat;
            top.parent = parentMesh;
            top.enableEdgesRendering();
            top.edgesWidth = 2.5;
            top.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            attachDragAndClick(top, modelId);

            // Wymiary PMI 3D (linie i etykiety tekstu w przestrzeni)
            buildPMI3D(scene, parentMesh, W, H, D);
        }
    };

    const attachDragAndClick = (mesh: any, modelId: string) => {
        // Kliknięcie zaznacza ten konkretny model
        mesh.actionManager = new BABYLON.ActionManager(sceneRef.current);
        mesh.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                setActiveModelId(modelId);
            })
        );

        // Przeciąganie myszą po płaszczyźnie arkusza
        const dragBehavior = new BABYLON.PointerDragBehavior({ dragPlaneNormal: new BABYLON.Vector3(0, 0, 1) });
        dragBehavior.useObjectOrientationForDragging = false;
        mesh.addBehavior(dragBehavior);
    };

    const buildPMI3D = (scene: any, parentNode: any, W: number, H: number, D: number) => {
        // Linia wymiarowa szerokości
        const p1 = new BABYLON.Vector3(-W / 2, -H / 2 - 40, D / 2);
        const p2 = new BABYLON.Vector3(W / 2, -H / 2 - 40, D / 2);
        const lines = BABYLON.MeshBuilder.CreateLines('dimWidth', { points: [p1, p2] }, scene);
        lines.color = new BABYLON.Color3(0.15, 0.39, 0.92);
        lines.parent = parentNode;

        // Etykieta tekstu PMI (Billboard)
        const plane = BABYLON.MeshBuilder.CreatePlane('dimWidthText', { width: 90, height: 30 }, scene);
        plane.position = new BABYLON.Vector3(0, -H / 2 - 40, D / 2 + 5);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.parent = parentNode;

        const dynTex = new BABYLON.DynamicTexture('dtWidth', { width: 256, height: 128 }, scene);
        dynTex.drawText(`${W} mm`, null, 80, 'bold 44px Segoe UI, Arial', '#1e3a8a', '#ffffff', true);
        const planeMat = new BABYLON.StandardMaterial('matDimWidth', scene);
        planeMat.diffuseTexture = dynTex;
        planeMat.specularColor = new BABYLON.Color3(0, 0, 0);
        plane.material = planeMat;
    };

    // ─── Obrót Wyłącznie Zaznaczonego Modelu za pomocą ViewCube / Przycisku ───

    const rotateActiveModel = (faceKey: string) => {
        if (!activeModelId || !sceneRef.current) return;
        const targetNode = sceneRef.current.getTransformNodeByName(`node_${activeModelId}`);
        if (!targetNode) return;

        const angleDef = VIEW_ANGLES.find((a) => a.key === faceKey) || VIEW_ANGLES[0];

        // Płynna animacja obrotu zaznaczonego modelu
        const animRx = new BABYLON.Animation('animRx', 'rotation.x', 45, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        animRx.setKeys([{ frame: 0, value: targetNode.rotation.x }, { frame: 15, value: angleDef.rx }]);
        const animRy = new BABYLON.Animation('animRy', 'rotation.y', 45, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        animRy.setKeys([{ frame: 0, value: targetNode.rotation.y }, { frame: 15, value: angleDef.ry }]);
        const animRz = new BABYLON.Animation('animRz', 'rotation.z', 45, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        animRz.setKeys([{ frame: 0, value: targetNode.rotation.z }, { frame: 15, value: angleDef.rz }]);

        targetNode.animations = [animRx, animRy, animRz];
        sceneRef.current.beginAnimation(targetNode, 0, 15, false);

        setPlacedModels((prev) =>
            prev.map((m) => (m.id === activeModelId ? { ...m, rotation: [angleDef.rx, angleDef.ry, angleDef.rz], angleName: angleDef.label } : m))
        );
        showToast(`Obrócono aktywny model do widoku: ${angleDef.label}`);
    };

    const removeModel = (id: string) => {
        if (sceneRef.current) {
            const targetNode = sceneRef.current.getTransformNodeByName(`node_${id}`);
            if (targetNode) {
                targetNode.dispose(false, true);
            }
        }
        setPlacedModels((prev) => prev.filter((m) => m.id !== id));
        if (activeModelId === id) setActiveModelId(null);
        showToast('Usunięto model z arkusza');
    };

    // ─── Drag & Drop z drzewa obiektów na płótno 3D ───

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const rawData = e.dataTransfer.getData('application/json');
            if (rawData) {
                const node: CADTreeNode = JSON.parse(rawData);
                const offset = (placedModels.length - 1) * 450;
                addModelToScene(node, [offset, 0, 0], 'Góra');
            }
        } catch (err) {
            console.error('Błąd podczas upuszczania na scenę 3D:', err);
        }
    };

    const handlePrintPdf = () => {
        window.print();
    };

    const handleDownloadJpg = async () => {
        if (!engineRef.current || !cameraRef.current) return;
        try {
            const dataUrl = await BABYLON.Tools.CreateScreenshotAsync(engineRef.current, cameraRef.current, { precision: 2.0 }, 'image/jpeg');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${titleBlock.drawingNumber || 'Arkusz_CAD_3D'}.jpg`;
            a.click();
            showToast('Pobrano raster JPG 300 DPI!');
        } catch (e) {
            alert('Błąd generowania zrzutu: ' + e);
        }
    };

    const activeModel = placedModels.find((m) => m.id === activeModelId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
            {/* Powiadomienie Toast */}
            {toastMessage && (
                <div
                    style={{
                        position: 'fixed',
                        top: '60px',
                        right: '20px',
                        backgroundColor: 'rgba(5, 150, 105, 0.95)',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        zIndex: 100,
                        fontSize: '12px',
                        fontWeight: 600,
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    {toastMessage}
                </div>
            )}

            {/* ─── Górny Pasek Narzędzi ─── */}
            <div
                style={{
                    height: '46px',
                    backgroundColor: '#0f172a',
                    borderBottom: '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 14px',
                    zIndex: 20,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        📐 SmartBox Studio Eksportu 3D
                    </span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>| Niezależne Obroty Modeli & Wymiary PMI</span>
                </div>

                {/* Styl Wizualny CAD */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '4px' }}>Styl:</span>
                    <button
                        onClick={() => setRenderStyle('technical')}
                        style={{
                            background: renderStyle === 'technical' ? '#2563eb' : '#1e293b',
                            color: '#fff',
                            border: '1px solid #334155',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        📐 Techniczny CAD
                    </button>
                    <button
                        onClick={() => setRenderStyle('shaded')}
                        style={{
                            background: renderStyle === 'shaded' ? '#2563eb' : '#1e293b',
                            color: '#fff',
                            border: '1px solid #334155',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        🪵 Drewno / Cieniowany
                    </button>
                </div>

                {/* Format Arkusza i Druk */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                        <span>Arkusz:</span>
                        <select
                            value={paperFormat}
                            onChange={(e) => setPaperFormat(e.target.value as PaperFormat)}
                            style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#f8fafc',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            {(Object.keys(PAPER_FORMATS) as PaperFormat[]).map((fmt) => (
                                <option key={fmt} value={fmt}>
                                    {PAPER_FORMATS[fmt].label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ width: '1px', height: '18px', background: '#334155' }}></div>

                    <button
                        onClick={handlePrintPdf}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '11px',
                            cursor: 'pointer',
                        }}
                    >
                        🖨️ Drukuj / PDF
                    </button>

                    <button
                        onClick={handleDownloadJpg}
                        style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#e2e8f0',
                            padding: '5px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                        }}
                    >
                        🖼️ JPG 300 DPI
                    </button>
                </div>
            </div>

            {/* ─── Główny Obszar Roboczy ─── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* Lewy Panel: Drzewo Obiektów CAD & Lista Modeli na Arkuszu */}
                <div
                    style={{
                        width: '320px',
                        backgroundColor: '#0f172a',
                        borderRight: '1px solid #1e293b',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        zIndex: 10,
                    }}
                >
                    <div style={{ padding: '10px', borderBottom: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                🌳 Biblioteka Modeli 3D
                            </div>
                            <button
                                onClick={refreshTree}
                                style={{
                                    fontSize: '10px',
                                    background: 'rgba(37, 99, 235, 0.2)',
                                    color: '#93c5fd',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                }}
                                title="Pobierz aktualne obiekty i wymiary PMI ze sceny 3D"
                            >
                                🔄 Odśwież 3D
                            </button>
                        </div>

                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', lineHeight: '1.3' }}>
                            Przeciągnij model (np. <strong>komodę</strong>) na scenę 3D — możesz upuścić go <strong>wielokrotnie</strong> i każdy ustawić niezależnie!
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '240px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.8)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            {rootNode && (
                                <TreeItemRow
                                    node={rootNode}
                                    selectedNodeId={selectedNode?.id || null}
                                    onSelectNode={setSelectedNode}
                                />
                            )}
                        </div>
                    </div>

                    {/* Modele na Arkuszu z Bezpośrednim Wyborem Rzutów */}
                    <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📋 Modele na Arkuszu ({placedModels.length})
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {placedModels.map((m, idx) => {
                                const isActive = activeModelId === m.id;
                                return (
                                    <div
                                        key={m.id}
                                        onClick={() => setActiveModelId(m.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px',
                                            padding: '8px',
                                            borderRadius: '5px',
                                            background: isActive ? 'rgba(37, 99, 235, 0.2)' : '#1e293b',
                                            border: `1px solid ${isActive ? '#3b82f6' : '#334155'}`,
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{m.node.icon}</span>
                                                <strong style={{ color: isActive ? '#93c5fd' : '#f1f5f9' }}>
                                                    {m.node.name} (#{idx + 1})
                                                </strong>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeModel(m.id);
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
                                                title="Usuń ten model z arkusza"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Szybkie przyciski rzutów dla tego konkretnego modelu */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                            {VIEW_ANGLES.slice(0, 5).map((ang) => (
                                                <button
                                                    key={ang.key}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveModelId(m.id);
                                                        rotateActiveModel(ang.key);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '2px 4px',
                                                        borderRadius: '3px',
                                                        fontSize: '9px',
                                                        fontWeight: m.angleName === ang.label ? 700 : 400,
                                                        background: m.angleName === ang.label ? '#2563eb' : '#0f172a',
                                                        color: m.angleName === ang.label ? '#fff' : '#94a3b8',
                                                        border: '1px solid #334155',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {ang.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => selectedNode && addModelToScene(selectedNode, [(placedModels.length - 1) * 450, 0, 0], 'Góra')}
                            disabled={!selectedNode}
                            style={{
                                marginTop: '4px',
                                background: selectedNode ? '#2563eb' : '#334155',
                                color: '#fff',
                                border: 'none',
                                padding: '8px 10px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                cursor: selectedNode ? 'pointer' : 'not-allowed',
                            }}
                        >
                            ➕ Dodaj Kolejną Kopię na Arkusz
                        </button>
                    </div>
                </div>

                {/* Centralny Płótno 3D Babylon.js */}
                <div
                    style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <canvas
                        ref={canvasRef}
                        style={{ width: '100%', height: '100%', outline: 'none', display: 'block' }}
                    />

                    {/* ─── Interaktywna Kostka Widoków (ViewCube) — Obraca Zaznaczony Model ─── */}
                    <div className="view-cube-container" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 20 }}>
                        <div ref={viewCubeRef} className="view-cube-wrapper">
                            <div className="cube-face face-front" onClick={() => rotateActiveModel('front')}>PRZÓD</div>
                            <div className="cube-face face-back" onClick={() => rotateActiveModel('back')}>TYŁ</div>
                            <div className="cube-face face-left" onClick={() => rotateActiveModel('left')}>LEWY</div>
                            <div className="cube-face face-right" onClick={() => rotateActiveModel('right')}>PRAWY</div>
                            <div className="cube-face face-top" onClick={() => rotateActiveModel('top')}>GÓRA</div>
                            <div className="cube-face face-bottom" onClick={() => rotateActiveModel('bottom')}>DÓŁ</div>
                        </div>
                    </div>

                    {/* Informacja o obracanym modelu pod kostką */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '90px',
                            right: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            zIndex: 20,
                        }}
                    >
                        <div style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(15,23,42,0.85)', padding: '3px 6px', borderRadius: '3px', border: '1px solid #334155' }}>
                            Aktywny: <strong style={{ color: '#60a5fa' }}>{activeModel?.node.name || 'Wybierz model'}</strong>
                        </div>
                        <button
                            onClick={() => rotateActiveModel('isometric')}
                            style={{
                                background: 'rgba(15, 23, 42, 0.85)',
                                color: '#93c5fd',
                                border: '1px solid #334155',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                backdropFilter: 'blur(6px)',
                            }}
                        >
                            🧊 Izometria
                        </button>
                    </div>

                    {/* ─── Wirtualny Arkusz HUD (Passepartout & Tabelka ISO 7200) ─── */}
                    <svg
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            zIndex: 5,
                        }}
                        viewBox="0 0 1000 700"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        {/* Ramka zewnętrzna arkusza */}
                        <rect x="50" y="30" width="900" height="640" fill="none" stroke="#0f172a" strokeWidth="2.5" />
                        {/* Margines wewnętrzny */}
                        <rect x="70" y="40" width="870" height="620" fill="none" stroke="#475569" strokeWidth="1.0" />

                        {/* Tabelka Rysunkowa ISO 7200 */}
                        <g transform="translate(680, 560)">
                            <rect x="0" y="0" width="260" height="100" fill="#ffffff" stroke="#0f172a" strokeWidth="2.0" />
                            <line x1="0" y1="40" x2="260" y2="40" stroke="#475569" strokeWidth="1.0" />
                            <line x1="0" y1="70" x2="260" y2="70" stroke="#475569" strokeWidth="1.0" />
                            <line x1="160" y1="0" x2="160" y2="100" stroke="#475569" strokeWidth="1.0" />

                            <text x="8" y="15" fontSize="9" fill="#64748b" fontFamily="Segoe UI, sans-serif">Projekt / Mebel</text>
                            <text x="8" y="32" fontSize="14" fill="#0f172a" fontFamily="Segoe UI, sans-serif" fontWeight="bold">
                                {titleBlock.furnitureName || titleBlock.projectName}
                            </text>

                            <text x="168" y="15" fontSize="9" fill="#64748b" fontFamily="Segoe UI, sans-serif">Nr rysunku</text>
                            <text x="168" y="32" fontSize="13" fill="#0f172a" fontFamily="Segoe UI, sans-serif" fontWeight="bold">
                                {titleBlock.drawingNumber}
                            </text>

                            <text x="8" y="55" fontSize="9" fill="#64748b" fontFamily="Segoe UI, sans-serif">
                                Wykonał: <tspan fill="#0f172a" fontWeight="bold">{titleBlock.author}</tspan>
                            </text>
                            <text x="168" y="55" fontSize="9" fill="#64748b" fontFamily="Segoe UI, sans-serif">
                                Data: <tspan fill="#0f172a" fontWeight="bold">{titleBlock.date}</tspan>
                            </text>

                            <text x="8" y="85" fontSize="9" fill="#64748b" fontFamily="Segoe UI, sans-serif">
                                Format: <tspan fill="#0f172a" fontWeight="bold">{paperFormat.split('_')[0]}</tspan>
                            </text>
                            <text x="168" y="85" fontSize="9" fill="#64748b" fontFamily="Segoe UI, sans-serif">
                                Skala: <tspan fill="#0f172a" fontWeight="bold">{titleBlock.scale}</tspan>
                            </text>
                        </g>
                    </svg>
                </div>
            </div>
        </div>
    );
};
