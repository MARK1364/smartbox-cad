/**
 * demo-row.ts
 *
 * Funkcje demonstracyjne generujące ciąg szafek połączonych solverem (bez GUI)
 * oraz dynamiczne poszerzanie szafek z automatycznym przesunięciem rzędu.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { CreateKorpusCommand } from '../A3_smartframe/commands/create-korpus-command.js';
import { ConstraintStore } from './constraint-store.js';
import { makeAnchor, makeSolverConstraint } from './constraint-types.js';
import { nmToMm, mmToNm } from '../A1_core/cad-math/units.js';
import type { ContainerModel } from '../A1_core/container-model.js';
import { probeBayFromCADPoint } from '../A2_bloki/02_bloki-bay-detector.js';
import { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } from '../A2_bloki/02_bloki-bay-actions.js';
import { SyncShelfDrillingsCommand } from '../A2_bloki/commands/sync-shelf-drillings-command.js';
import { SyncDoorDrillingsCommand } from '../A2_bloki/commands/sync-door-drillings-command.js';
import { applyLibraryOperation } from '../o1_operacji/operacje-apply.js';
import { createSmartPartHandle } from '../A2_bloki/handles/handle-apply.js';
import { resolveHandleColor } from '../A2_bloki/handles/handle-types.js';
import { PanelModel } from '../A4_smartpanel/panel-model.js';
import { ensurePanelHasCncProgram } from '../C1_cnc/core/cam-auto-program.js';

export function generate10CabinetsRow(widths_mm: number[] = [600, 800, 600, 450, 900, 500, 600, 800, 400, 600]): any[] {
    const ctx = ContextManager.instance;
    const doc = ctx.document;
    const history = ctx.commandHistory;
    const solverCtrl = (ctx as any).solverController;
    if (!doc || !history) {
        console.error('[demo-row] Brak aktywnego dokumentu lub historii komend.');
        return [];
    }

    // 1. Usuń istniejące węzły korpusów, aby zacząć z czystą sceną
    const existing = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
    for (const c of existing) {
        doc.removeNode(c.id);
    }
    ConstraintStore.instance.clear();

    const wysokosc_mm = 720;
    const glebokosc_mm = 560;
    const createdNodes: any[] = [];

    // 2. Tworzymy szafki komendami CreateKorpusCommand
    for (let i = 0; i < widths_mm.length; i++) {
        const w_mm = widths_mm[i];
        const cmd = new CreateKorpusCommand({
            typ_korpusu: 'korpus3',
            szerokosc_mm: w_mm,
            wysokosc_mm: wysokosc_mm,
            glebokosc_mm: glebokosc_mm,
            position: { x: i * 50, y: 0, z: 0 },
        });
        cmd.execute(doc);
        const node = doc.findNode(cmd.affectedNodeIds[0]);
        if (node) createdNodes.push(node);
    }

    if (createdNodes.length === 0) return [];

    // 3. Uziemienie pierwszej szafki w zerze
    ConstraintStore.instance.add(makeSolverConstraint({
        id: 'cst_ground_first',
        bindType: 'GROUND',
        anchorA: makeAnchor({ nodeId: createdNodes[0].id, kind: 'OBJECT' }),
    }));

    // 4. Łączenie sąsiednich szafek więzami VERTEX i COPLANAR
    for (let i = 1; i < createdNodes.length; i++) {
        const prev = createdNodes[i - 1];
        const curr = createdNodes[i];

        ConstraintStore.instance.add(makeSolverConstraint({
            id: `cst_vertex_${i - 1}_to_${i}`,
            bindType: 'VERTEX',
            anchorA: makeAnchor({ nodeId: prev.id, kind: 'VERTEX', cornerIndex: 1 }),
            anchorB: makeAnchor({ nodeId: curr.id, kind: 'VERTEX', cornerIndex: 0 }),
        }));

        ConstraintStore.instance.add(makeSolverConstraint({
            id: `cst_front_${i - 1}_to_${i}`,
            bindType: 'COPLANAR',
            anchorA: makeAnchor({ nodeId: prev.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            anchorB: makeAnchor({ nodeId: curr.id, kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            offsetMm: 0,
        }));
    }

    // 5. Rozwiązanie solvera
    if (solverCtrl && typeof solverCtrl.solveNow === 'function') {
        solverCtrl.solveNow();
    }

    // 6. Odświeżenie widoku w Babylon.js
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    }

    return createdNodes;
}

export function expandCabinet(index: number = 1, delta_mm: number = 200): void {
    const ctx = ContextManager.instance;
    const doc = ctx.document;
    const containers = doc?.getContainers?.() || [];
    const target = containers[index];
    if (!target) {
        console.warn(`[demo-row] Brak szafki o indeksie ${index}`);
        return;
    }
    const container = target.domainData as ContainerModel | null;
    if (!container) {
        console.warn(`[demo-row] Brak domainData w szafce o indeksie ${index}`);
        return;
    }
    const currentW_mm = nmToMm(container.width);
    const newW_mm = currentW_mm + delta_mm;
    container.width = mmToNm(newW_mm);
    if (container.generatorParams) {
        container.generatorParams.szerokosc_mm = newW_mm;
    }
    doc.emitChange('dimensions', [target.id]);

    const solverCtrl = (ctx as any).solverController;
    if (solverCtrl && typeof solverCtrl.solveNow === 'function') {
        solverCtrl.solveNow();
    }

    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    }
}

/**
 * Generuje pełnoprawną szafę korpusową (np. 2500x800x560 mm)
 * z wewnętrznymi półkami oraz frontami dwuskrzydłowymi z okuciami i nawiertami.
 */
export function generateWardrobeDemo(options?: {
    szerokosc_mm?: number;
    wysokosc_mm?: number;
    glebokosc_mm?: number;
    liczba_polek?: number;
}): any {
    const ctx = ContextManager.instance;
    const doc = ctx.document;
    if (!doc) {
        console.error('[demo-row] Brak aktywnego dokumentu CAD.');
        return null;
    }

    const w = options?.szerokosc_mm ?? 800;
    const h = options?.wysokosc_mm ?? 2500;
    const d = options?.glebokosc_mm ?? 560;
    const shelvesCount = options?.liczba_polek ?? 5;

    // 1. Usuń istniejące węzły korpusów, aby zacząć z czystą sceną
    const existing = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
    for (const c of existing) {
        doc.removeNode(c.id);
    }
    ConstraintStore.instance.clear();

    // 2. Utwórz korpus szafy
    const cmdKorpus = new CreateKorpusCommand({
        typ_korpusu: 'korpus3',
        szerokosc_mm: w,
        wysokosc_mm: h,
        glebokosc_mm: d,
        liczba_stref: 1,
        wysokosc_strefy_dolnej_mm: h,
        wysokosc_strefy_srodkowej_mm: 0,
        cofniecie_plecow_mm: 3,
        position: { x: 0, y: 0, z: 0 },
    } as any);
    cmdKorpus.execute(doc);

    const containers = doc.getContainers();
    if (containers.length === 0) return null;
    const cabinetNode = doc.findNode(containers[0].id);
    if (!cabinetNode) return null;

    // 3. Wykryj wnękę i wstaw półki oraz drzwi dwuskrzydłowe
    const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: h / 2 });
    if (bay) {
        const shelvesOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'SHELVES')!;
        createBlokInDetectedBay(doc, bay, shelvesOpt, {
            liczba_polek: shelvesCount,
            odsuniecie_przod_mm: 20,
            wzor_nawiercen: 'TRIPLE',
            rozstaw_potrojny_z_mm: 32
        });

        const doorsOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DOORS')!;
        createBlokInDetectedBay(doc, bay, doorsOpt, {
            rodzaj_drzwi: 'DOUBLE',
            szczelina_mm: 3
        });

        // 4. Synchronizacja wierceń w korpusie
        new SyncShelfDrillingsCommand(cabinetNode.id).execute(doc);
        new SyncDoorDrillingsCommand(cabinetNode.id).execute(doc);

        // 5. Dodanie rewizji 15x150 mm na lewym boku (od dołu 150 mm, od przodu 300 mm)
        const panelNodes = doc.getPanels();
        const leftSideNode = panelNodes.find(p => (p.domainData as any)?.role === 'LEFT_SIDE_PANEL');
        if (leftSideNode && leftSideNode.domainData) {
            applyLibraryOperation(leftSideNode.domainData as PanelModel, 'rewizja', 'FACE_Z_MINUS', {
                widthMm: 15,
                heightMm: 150,
                uMm: 300,
                vMm: 150,
                through: true,
                uEdge: 'FACE_X_MINUS',
                vEdge: 'FACE_Y_MINUS'
            });
        }

        // 6. Konwersja frontów na ramki aluminiowe ze szkłem (Z1_BLACK) oraz dodanie 2 uchwytów Easty 160
        const leftDoorNode = panelNodes.find(p => p.name === 'Drzwi_Lewe');
        const rightDoorNode = panelNodes.find(p => p.name === 'Drzwi_Prawe');
        if (leftDoorNode && rightDoorNode) {
            const leftDoorModel = leftDoorNode.domainData as PanelModel;
            const rightDoorModel = rightDoorNode.domainData as PanelModel;
            leftDoorModel.convertToAluFrame('Z1_BLACK');
            rightDoorModel.convertToAluFrame('Z1_BLACK');

            const doorHMm = nmToMm(leftDoorModel.height);

            // Lewy front: krawędź środkowa to FACE_X_PLUS (prawa strona lewych drzwi)
            createSmartPartHandle(doc, leftDoorNode, {
                seriesId: 'easy',
                handleType: 'BAR',
                producerId: 'rejs',
                holeDistanceMm: 160,
                totalLengthMm: 194,
                depthMm: 28,
                thicknessMm: 12,
                colorId: 'black',
                color: resolveHandleColor('black').color,
                orientation: 'VERTICAL',
                uEdge: 'FACE_X_PLUS',
                vEdge: 'FACE_Y_MINUS',
                uMm: 40,
                vMm: (doorHMm / 2) - 80,
                placementPreset: 'CUSTOM'
            });

            // Prawy front: krawędź środkowa to FACE_X_MINUS (lewa strona prawych drzwi)
            createSmartPartHandle(doc, rightDoorNode, {
                seriesId: 'easy',
                handleType: 'BAR',
                producerId: 'rejs',
                holeDistanceMm: 160,
                totalLengthMm: 194,
                depthMm: 28,
                thicknessMm: 12,
                colorId: 'black',
                color: resolveHandleColor('black').color,
                orientation: 'VERTICAL',
                uEdge: 'FACE_X_MINUS',
                vEdge: 'FACE_Y_MINUS',
                uMm: 40,
                vMm: (doorHMm / 2) - 80,
                placementPreset: 'CUSTOM'
            });
        }
    }

    // 7. Utwórz programy CNC dla formatek posiadających cechy obróbcze
    const allPanels = doc.getPanels();
    for (const pNode of allPanels) {
        const pModel = pNode.domainData as any;
        if (pModel && pModel.features && pModel.features.length > 0) {
            ensurePanelHasCncProgram(pModel);
        }
    }

    // 8. Powiadomienie o zmianie w scenie 3D
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
    }

    return cabinetNode;
}
