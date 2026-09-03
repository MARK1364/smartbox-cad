/**
 * Główny silnik optymalizacji rozkroju NestingEngine
 * Obsługuje rozkrój pod piły panelowe oraz CNC z podziałem na materiały,
 * profile maszynowe (Piła vs CNC) oraz filtrowanie zakresu (Cały projekt / Szafka / SmartBox).
 *
 * Wszystkie wewnętrzne obliczenia geometryczne (BinPacker, rzazy, marginesy, pozycje x/y)
 * są wykonywane z całkowitoliczbową precyzją w Nanometrach (nm, 1 mm = 1 000 000 nm).
 */

import {
    NestingPart,
    SheetConfig,
    NestingOptions,
    NestingResult,
    PackedBoard,
    PackedPart,
    MaterialGroupSummary,
    MachineType,
    NestingScope
} from './nesting-types';
import { BinPacker } from './bin-packer';
import { materialDatabase } from '../../A7_material/material-database';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units';

interface InternalRect {
    id: string;
    partId: string;
    originalName: string;
    sourceNodeId?: string;
    containerId?: string;
    smartboxId?: string;
    furnitureName?: string;
    material?: string;
    thickness?: number;
    thickness_nm?: number;
    w_nm: number;       // z rzazem w nanometrach
    h_nm: number;       // z rzazem w nanometrach
    realW_nm: number;   // bez rzazu w nanometrach
    realH_nm: number;   // bez rzazu w nanometrach
    w: number;          // z rzazem w mm
    h: number;          // z rzazem w mm
    realW: number;      // bez rzazu w mm
    realH: number;      // bez rzazu w mm
    canRotate: boolean;
    area_nm2: number;
}

export class NestingEngine {
    /**
     * Zwraca domyślny rzaz narzędzia dla danego typu maszyny (w mm)
     */
    public static getDefaultKerf(machineType: MachineType): number {
        return machineType === 'cnc' ? 10 : 4;
    }

    /**
     * Zwraca domyślny rzaz narzędzia w nanometrach (nm)
     */
    public static getDefaultKerfNm(machineType: MachineType): number {
        return mmToNm(this.getDefaultKerf(machineType));
    }

    /**
     * Pobiera pełną tożsamość materiału (id, code, name, thickness, fullLabel)
     */
    public static getMaterialInfo(part: { material?: string; thickness?: number }) {
        return materialDatabase.getMaterialInfo(part.material, part.thickness);
    }

    /**
     * Mapuje surowe ID dekoru (np. W1100_ST9_18) na oficjalną nazwę handlową (np. "Biały Alpejski")
     */
    public static resolveMaterialName(rawMaterial?: string, thickness?: number): string {
        const info = materialDatabase.getMaterialInfo(rawMaterial, thickness);
        return info.name;
    }

    /**
     * Zwraca unikalny klucz grupy materiałowej (Dekor + Grubość fizyczna).
     * Ściśle separuje grubości płyt (np. 18mm i 10mm dla dekoru W1100 ST9 tworzą DWA OSOBNE arkusze rozkroju).
     */
    public static getMaterialKey(part: { material?: string; thickness?: number }): string {
        const info = this.getMaterialInfo(part);
        const decorIdentifier = info.code || info.name;
        const thk = Math.round((part.thickness || info.thickness_mm || 18) * 10) / 10;
        return `${decorIdentifier}__${thk}mm`;
    }

    /**
     * Zwraca czytelną, kompletną etykietę materiału: Nazwa + (Kod dekoru) + Grubość
     * np. "Biały Alpejski (W1100 ST9) 18mm", "Sosna Sealand (H110 ST9) 18mm"
     */
    public static getMaterialLabel(part: { material?: string; thickness?: number }): string {
        const info = this.getMaterialInfo(part);
        return info.fullLabel;
    }

    /**
     * Główna funkcja uruchamiająca proces nestingu.
     */
    public static async runNesting(
        parts: NestingPart[],
        config: SheetConfig,
        options: Partial<NestingOptions> = {}
    ): Promise<NestingResult> {
        const startTime = performance.now();

        const machineType: MachineType = options.machineType || config.machineType || 'saw';
        const scope: NestingScope = options.scope || 'PROJECT';
        const targetContainerId = options.targetContainerId;

        const defaultKerf = this.getDefaultKerf(machineType);
        const kerf = config.kerf !== undefined ? Math.max(0, config.kerf) : defaultKerf;
        const trimMargin = Math.max(0, config.trimMargin ?? (machineType === 'cnc' ? 15 : 10));

        // Konwersja na nanometry
        const kerf_nm = mmToNm(kerf);
        const trim_nm = mmToNm(trimMargin);
        const boardWidth_nm = config.width_nm || mmToNm(config.width);
        const boardHeight_nm = config.height_nm || mmToNm(config.height);

        const opts: NestingOptions = {
            mode: options.mode || 'fast',
            iterations: options.iterations ?? (options.mode === 'pro' ? 2000 : 1),
            allowRotation: options.allowRotation ?? true,
            stopOnFirstFit: options.stopOnFirstFit ?? false,
            selectedMaterial: options.selectedMaterial || 'ALL',
            machineType,
            scope,
            targetContainerId,
            ...options
        };

        // 1. Filtrowanie wg zakresu (Scope: PROJECT vs CONTAINER vs SMARTBOX vs MULTI_SELECTION)
        let scopedParts = parts;
        const targetIds = opts.targetContainerIds && opts.targetContainerIds.length > 0
            ? opts.targetContainerIds
            : (targetContainerId && targetContainerId !== 'ALL' ? [targetContainerId] : []);

        if (targetIds.length > 0 && !targetIds.includes('ALL')) {
            const idSet = new Set(targetIds);
            scopedParts = parts.filter((p) => {
                const matchContainer = p.containerId && idSet.has(p.containerId);
                const matchSmartbox = p.smartboxId && idSet.has(p.smartboxId);
                const matchName = p.furnitureName && idSet.has(p.furnitureName);
                return matchContainer || matchSmartbox || matchName;
            });
        }

        // 2. Filtrowanie wg materiału
        const filteredParts = (opts.selectedMaterial && opts.selectedMaterial !== 'ALL')
            ? scopedParts.filter((p) => this.getMaterialKey(p) === opts.selectedMaterial)
            : scopedParts;

        // Podział formatek na grupy wg materiału i grubości
        const groupsMap = new Map<string, NestingPart[]>();
        filteredParts.forEach((p) => {
            const key = this.getMaterialKey(p);
            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key)!.push(p);
        });

        // Wymiary robocze płyty (po odliczeniu marginesów obcięcia trimMargin) w nm
        const usableBoardW_nm = boardWidth_nm - (2 * trim_nm);
        const usableBoardH_nm = boardHeight_nm - (2 * trim_nm);

        if (usableBoardW_nm <= 0 || usableBoardH_nm <= 0) {
            throw new Error(`Wymiary arkusza po odliczeniu marginesów (${nmToMm(usableBoardW_nm)}x${nmToMm(usableBoardH_nm)} mm) są nieprawidłowe.`);
        }

        const allBoards: PackedBoard[] = [];
        const materialSummaries: MaterialGroupSummary[] = [];
        const unplacedParts: NestingPart[] = [];

        let currentGlobalBoardIndex = 1;
        let totalPlacedCount = 0;
        let totalInputPartsCount = 0;

        // Przetwarzanie każdej grupy materiałowej
        for (const [matKey, partsInGroup] of groupsMap.entries()) {
            const samplePart = partsInGroup[0];
            const materialName = this.resolveMaterialName(samplePart.material);
            const thickness = samplePart.thickness || 18;
            const materialLabel = this.getMaterialLabel(samplePart);

            // Przygotowanie listy formatek (rozwinięcie ilości sztuk quantity) w nm
            const rectsToPack: InternalRect[] = [];
            let groupPartsCount = 0;

            partsInGroup.forEach((p) => {
                const qty = Math.max(0, Math.floor(p.quantity || 0));
                groupPartsCount += qty;
                totalInputPartsCount += qty;

                const partW_nm = p.width_nm || mmToNm(p.width);
                const partH_nm = p.height_nm || mmToNm(p.height);
                const thk_nm = p.thickness_nm || (p.thickness ? mmToNm(p.thickness) : mmToNm(18));

                for (let i = 0; i < qty; i++) {
                    if (partW_nm <= 0 || partH_nm <= 0) continue;

                    const canRotate = opts.allowRotation && p.canRotate !== false;
                    const w_with_kerf_nm = partW_nm + kerf_nm;
                    const h_with_kerf_nm = partH_nm + kerf_nm;

                    rectsToPack.push({
                        id: `${p.id}_${i}`,
                        partId: p.id,
                        originalName: p.name,
                        sourceNodeId: p.sourceNodeId,
                        containerId: p.containerId,
                        smartboxId: p.smartboxId,
                        furnitureName: p.furnitureName,
                        material: this.resolveMaterialName(p.material),
                        thickness: p.thickness,
                        thickness_nm: thk_nm,
                        w_nm: w_with_kerf_nm,
                        h_nm: h_with_kerf_nm,
                        realW_nm: partW_nm,
                        realH_nm: partH_nm,
                        w: nmToMm(w_with_kerf_nm),
                        h: nmToMm(h_with_kerf_nm),
                        realW: nmToMm(partW_nm),
                        realH: nmToMm(partH_nm),
                        canRotate,
                        area_nm2: w_with_kerf_nm * h_with_kerf_nm
                    });
                }
            });

            // Wstępna weryfikacja czy formatka mieści się na arkuszu
            const validRects: InternalRect[] = [];
            for (const r of rectsToPack) {
                const fitsNormal = r.w_nm <= usableBoardW_nm && r.h_nm <= usableBoardH_nm;
                const fitsRotated = r.canRotate && r.h_nm <= usableBoardW_nm && r.w_nm <= usableBoardH_nm;

                if (!fitsNormal && !fitsRotated) {
                    const existing = unplacedParts.find((up) => up.id === r.partId);
                    if (existing) {
                        existing.quantity += 1;
                    } else {
                        const orig = parts.find((p) => p.id === r.partId);
                        if (orig) {
                            unplacedParts.push({ ...orig, quantity: 1 });
                        }
                    }
                } else {
                    validRects.push(r);
                }
            }

            if (validRects.length === 0) {
                materialSummaries.push({
                    materialKey: matKey,
                    materialName,
                    thickness,
                    materialLabel,
                    partsCount: groupPartsCount,
                    boardsCount: 0,
                    totalUsedArea: 0,
                    totalBoardArea: 0,
                    utilizationPercent: 0,
                    wastePercent: 100,
                    boards: []
                });
                continue;
            }

            // Uruchomienie algorytmu optymalizacji pakowania w nanometrach
            const groupBoards = await this.optimizePacking(
                validRects,
                usableBoardW_nm,
                usableBoardH_nm,
                trim_nm,
                opts,
                materialName,
                thickness,
                materialLabel,
                machineType,
                currentGlobalBoardIndex
            );

            currentGlobalBoardIndex += groupBoards.length;
            totalPlacedCount += validRects.length;

            let groupUsedArea = 0;
            let groupTotalArea = 0;

            groupBoards.forEach((b) => {
                groupUsedArea += b.usedArea;
                groupTotalArea += b.totalArea;
                allBoards.push(b);
            });

            const groupUtilization = groupTotalArea > 0 ? (groupUsedArea / groupTotalArea) * 100 : 0;
            const groupWaste = Math.max(0, 100 - groupUtilization);

            materialSummaries.push({
                materialKey: matKey,
                materialName,
                thickness,
                materialLabel,
                partsCount: groupPartsCount,
                boardsCount: groupBoards.length,
                totalUsedArea: groupUsedArea,
                totalBoardArea: groupTotalArea,
                utilizationPercent: groupUtilization,
                wastePercent: groupWaste,
                boards: groupBoards
            });
        }

        const executionTimeMs = performance.now() - startTime;

        let totalUsedArea = 0;
        let totalBoardArea = 0;
        allBoards.forEach((b) => {
            totalUsedArea += b.usedArea;
            totalBoardArea += b.totalArea;
        });

        const avgUtilizationPercent = totalBoardArea > 0 ? (totalUsedArea / totalBoardArea) * 100 : 0;
        const avgWastePercent = Math.max(0, 100 - avgUtilizationPercent);

        return {
            boards: allBoards,
            materialGroups: materialSummaries,
            unplacedParts,
            machineType,
            scope,
            totalPartsPlaced: totalPlacedCount,
            totalPartsCount: totalInputPartsCount,
            totalBoardsCount: allBoards.length,
            totalUsedArea,
            totalBoardArea,
            avgUtilizationPercent,
            avgWastePercent,
            executionTimeMs
        };
    }

    /**
     * Optymalizuje pakowanie w nanometrach za pomocą iteracji i mutacji kolejności.
     */
    private static async optimizePacking(
        rects: InternalRect[],
        usableBoardW_nm: number,
        usableBoardH_nm: number,
        trim_nm: number,
        opts: NestingOptions,
        materialName: string,
        thickness: number,
        materialLabel: string,
        machineType: MachineType,
        startBoardIndex: number
    ): Promise<PackedBoard[]> {
        const iterations = opts.iterations || 1;
        let bestBoards: PackedBoard[] | null = null;
        let bestScore = Infinity;

        // Sortowanie wyjściowe: Malejąco po dłuższym boku (BSSF heuristic)
        const baseSorted = [...rects].sort((a, b) => {
            const maxDimA = Math.max(a.w_nm, a.h_nm);
            const maxDimB = Math.max(b.w_nm, b.h_nm);
            return maxDimB - maxDimA;
        });

        for (let iter = 0; iter < iterations; iter++) {
            const currentList = baseSorted.map((r) => ({ ...r }));

            if (iter === 0) {
                // Heurystyka 1: Dłuższy bok malejąco
            } else if (iter === 1) {
                // Heurystyka 2: Pole powierzchni malejąco
                currentList.sort((a, b) => b.area_nm2 - a.area_nm2);
            } else if (iter === 2) {
                // Heurystyka 3: Obwód malejąco
                currentList.sort((a, b) => (b.w_nm + b.h_nm) - (a.w_nm + a.h_nm));
            } else {
                // Heurystyka losowa (Monte Carlo / Genetic Shuffle)
                this.shuffleArray(currentList);
                currentList.forEach((r) => {
                    if (r.canRotate && Math.random() > 0.5) {
                        const tempW = r.w_nm;
                        r.w_nm = r.h_nm;
                        r.h_nm = tempW;
                        const tempRealW = r.realW_nm;
                        r.realW_nm = r.realH_nm;
                        r.realH_nm = tempRealW;
                    }
                });
            }

            const boards = this.packRectangles(
                currentList,
                usableBoardW_nm,
                usableBoardH_nm,
                trim_nm,
                materialName,
                thickness,
                materialLabel,
                machineType,
                startBoardIndex
            );

            // Kryterium oceny: minimalizacja liczby płyt + maksymalizacja upakowania na ostatniej płycie
            const lastBoard = boards[boards.length - 1];
            const lastBoardUsed = lastBoard ? lastBoard.usedArea : 0;
            const score = (boards.length * 1e8) + lastBoardUsed;

            if (score < bestScore) {
                bestScore = score;
                bestBoards = boards;
            }

            // Yield co 100 iteracji, aby UI nie blokował się
            if (iter % 100 === 0 && iter > 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        return bestBoards || [];
    }

    /**
     * Pakuje listę prostokątów w serię płyt operując w 100% na nanometrach.
     */
    private static packRectangles(
        rectsList: InternalRect[],
        usableBoardW_nm: number,
        usableBoardH_nm: number,
        trim_nm: number,
        materialName: string,
        thickness: number,
        materialLabel: string,
        machineType: MachineType,
        startBoardIndex: number
    ): PackedBoard[] {
        const boards: PackedBoard[] = [];
        let currentRects = [...rectsList];
        let localIndex = 1;

        const totalBoardW_nm = usableBoardW_nm + (2 * trim_nm);
        const totalBoardH_nm = usableBoardH_nm + (2 * trim_nm);
        const totalBoardW_mm = nmToMm(totalBoardW_nm);
        const totalBoardH_mm = nmToMm(totalBoardH_nm);
        const totalBoardArea = totalBoardW_mm * totalBoardH_mm;

        while (currentRects.length > 0) {
            const packer = new BinPacker(usableBoardW_nm, usableBoardH_nm);
            const layoutData: PackedPart[] = [];
            const notFitted: InternalRect[] = [];
            let areaOnThisBoard = 0;

            for (const rect of currentRects) {
                const result = packer.insert(rect.w_nm, rect.h_nm, rect.canRotate);
                const node = result.node;
                const rotated = result.rotated;

                if (node) {
                    const finalW_nm = rotated ? rect.realH_nm : rect.realW_nm;
                    const finalH_nm = rotated ? rect.realW_nm : rect.realH_nm;
                    const posX_nm = node.x + trim_nm;
                    const posY_nm = node.y + trim_nm;

                    const finalW_mm = nmToMm(finalW_nm);
                    const finalH_mm = nmToMm(finalH_nm);
                    const posX_mm = nmToMm(posX_nm);
                    const posY_mm = nmToMm(posY_nm);

                    layoutData.push({
                        partId: rect.partId,
                        name: rect.originalName,
                        sourceNodeId: rect.sourceNodeId,
                        containerId: rect.containerId,
                        smartboxId: rect.smartboxId,
                        furnitureName: rect.furnitureName,
                        material: rect.material,
                        thickness: rect.thickness,
                        thickness_nm: rect.thickness_nm,
                        x: posX_mm,
                        y: posY_mm,
                        w: finalW_mm,
                        h: finalH_mm,
                        realW: finalW_mm,
                        realH: finalH_mm,
                        x_nm: posX_nm,
                        y_nm: posY_nm,
                        w_nm: finalW_nm,
                        h_nm: finalH_nm,
                        realW_nm: finalW_nm,
                        realH_nm: finalH_nm,
                        rotated,
                        rotationAngle: 0
                    });

                    areaOnThisBoard += (finalW_mm * finalH_mm);
                } else {
                    notFitted.push(rect);
                }
            }

            const utilizationPercent = (areaOnThisBoard / totalBoardArea) * 100;
            const wastePercent = Math.max(0, 100 - utilizationPercent);

            boards.push({
                boardIndex: startBoardIndex + localIndex - 1,
                boardIndexInGroup: localIndex,
                material: materialName,
                thickness,
                thickness_nm: mmToNm(thickness),
                materialLabel,
                machineType,
                width: totalBoardW_mm,
                height: totalBoardH_mm,
                width_nm: totalBoardW_nm,
                height_nm: totalBoardH_nm,
                layout: layoutData,
                usedArea: areaOnThisBoard,
                totalArea: totalBoardArea,
                wasteArea: totalBoardArea - areaOnThisBoard,
                utilizationPercent,
                wastePercent
            });

            localIndex++;
            currentRects = notFitted;
        }

        return boards;
    }

    private static shuffleArray<T>(array: T[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
