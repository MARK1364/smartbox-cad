import { describe, it, expect } from 'vitest';
import { NestingEngine } from '../core/nesting-engine';
import { NestingPart, SheetConfig } from '../core/nesting-types';

describe('NestingEngine (n1_nesting) with Machine Profiles and Scope', () => {
    const config: SheetConfig = {
        width: 2800,
        height: 2070,
        kerf: 4,
        trimMargin: 10
    };

    const multiCabinetParts: NestingPart[] = [
        { id: '1', name: 'Bok Lewy', width: 2000, height: 600, quantity: 1, thickness: 18, material: 'Biel Alpejska', containerId: 'Szafka_01', furnitureName: 'Szafka_01', canRotate: true },
        { id: '2', name: 'Bok Prawy', width: 2000, height: 600, quantity: 1, thickness: 18, material: 'Biel Alpejska', containerId: 'Szafka_01', furnitureName: 'Szafka_01', canRotate: true },
        { id: '3', name: 'Plecy HDF', width: 1964, height: 796, quantity: 1, thickness: 3, material: 'HDF Biały', containerId: 'Szafka_01', furnitureName: 'Szafka_01', canRotate: false },
        { id: '4', name: 'Bok Garderoby', width: 2400, height: 600, quantity: 2, thickness: 18, material: 'Biel Alpejska', containerId: 'Garderoba_02', furnitureName: 'Garderoba_02', canRotate: true },
        { id: '5', name: 'Szuflada Bok', width: 500, height: 150, quantity: 4, thickness: 18, material: 'Biel Alpejska', smartboxId: 'SmartBox_Drawer_01', canRotate: true }
    ];

    it('should separate parts by material and create independent boards when selectedMaterial is ALL', async () => {
        const result = await NestingEngine.runNesting(multiCabinetParts, config, {
            mode: 'fast',
            selectedMaterial: 'ALL',
            machineType: 'saw'
        });

        expect(result.materialGroups.length).toBe(2);
        expect(result.boards.length).toBeGreaterThanOrEqual(2);
        expect(result.machineType).toBe('saw');
        
        const bielBoards = result.boards.filter(b => b.material === 'Biały Alpejski');
        const hdfBoards = result.boards.filter(b => b.material === 'HDF Biały' || b.material === 'HDF Biały 3mm');

        expect(bielBoards.length).toBeGreaterThan(0);
        expect(hdfBoards.length).toBeGreaterThan(0);
        expect(bielBoards[0].layout.every(p => p.material === 'Biały Alpejski')).toBe(true);
    });

    it('should unify W1100_ST9_18 and Biały Alpejski 18mm into the same sheet group', async () => {
        const mixedParts: NestingPart[] = [
            { id: '1', name: 'Formatka 1', width: 500, height: 400, quantity: 1, thickness: 18, material: 'W1100_ST9_18', canRotate: true },
            { id: '2', name: 'Formatka 2', width: 500, height: 400, quantity: 1, thickness: 18, material: 'Biały Alpejski', canRotate: true },
            { id: '3', name: 'Formatka 3', width: 500, height: 400, quantity: 1, thickness: 18, material: 'Biel Alpejska', canRotate: true },
            { id: '4', name: 'Formatka 4', width: 500, height: 400, quantity: 1, thickness: 18, material: 'W1100_ST9', canRotate: true },
        ];

        const result = await NestingEngine.runNesting(mixedParts, config, { mode: 'fast' });

        expect(result.materialGroups.length).toBe(1);
        expect(result.materialGroups[0].materialName).toBe('Biały Alpejski');
        expect(result.materialGroups[0].materialLabel).toBe('Biały Alpejski (W1100 ST9) 18mm');
        expect(result.totalPartsPlaced).toBe(4);
    });

    it('should NEVER mix 18mm and 10mm boards even if they share the same decor W1100 ST9', async () => {
        const differentThicknessParts: NestingPart[] = [
            { id: '1', name: 'Formatka 18mm', width: 500, height: 400, quantity: 1, thickness: 18, material: 'W1100_ST9_18', canRotate: true },
            { id: '2', name: 'Formatka 10mm', width: 500, height: 400, quantity: 1, thickness: 10, material: 'W1100_ST9_10', canRotate: true },
        ];

        const result = await NestingEngine.runNesting(differentThicknessParts, config, { mode: 'fast' });

        expect(result.materialGroups.length).toBe(2);
        expect(result.materialGroups.some(g => g.thickness === 18 && g.materialLabel.includes('18mm'))).toBe(true);
        expect(result.materialGroups.some(g => g.thickness === 10 && g.materialLabel.includes('10mm'))).toBe(true);
    });

    it('should filter parts by container scope (Szafka_01)', async () => {
        const result = await NestingEngine.runNesting(multiCabinetParts, config, {
            mode: 'fast',
            scope: 'CONTAINER',
            targetContainerId: 'Szafka_01'
        });

        expect(result.totalPartsPlaced).toBe(3); // Bok Lewy (1), Bok Prawy (1), Plecy HDF (1)
        expect(result.boards.every(b => b.layout.every(p => p.containerId === 'Szafka_01' || p.furnitureName === 'Szafka_01'))).toBe(true);
    });

    it('should filter parts by SmartBox scope (SmartBox_Drawer_01)', async () => {
        const result = await NestingEngine.runNesting(multiCabinetParts, config, {
            mode: 'fast',
            scope: 'SMARTBOX',
            targetContainerId: 'SmartBox_Drawer_01'
        });

        expect(result.totalPartsPlaced).toBe(4); // Szuflada Bok (4 szt)
        expect(result.boards.every(b => b.layout.every(p => p.smartboxId === 'SmartBox_Drawer_01'))).toBe(true);
    });

    it('should configure CNC router profile with 10mm tool diameter and kerf', async () => {
        const cncConfig: SheetConfig = {
            width: 2800,
            height: 2070,
            kerf: 10,
            trimMargin: 15,
            machineType: 'cnc'
        };

        const result = await NestingEngine.runNesting(multiCabinetParts, cncConfig, {
            mode: 'fast',
            machineType: 'cnc',
            scope: 'PROJECT'
        });

        expect(result.machineType).toBe('cnc');
        expect(result.boards.every(b => b.machineType === 'cnc')).toBe(true);
    });

    it('should filter parts by multiple containers (targetContainerIds array)', async () => {
        const result = await NestingEngine.runNesting(multiCabinetParts, config, {
            mode: 'fast',
            targetContainerIds: ['Szafka_01', 'SmartBox_Drawer_01']
        });

        expect(result.totalPartsPlaced).toBe(7); // 3 from Szafka_01 + 4 from SmartBox_Drawer_01
        expect(result.boards.every(b => b.layout.every(p => p.containerId === 'Szafka_01' || p.furnitureName === 'Szafka_01' || p.smartboxId === 'SmartBox_Drawer_01'))).toBe(true);
    });

    it('should generate rotated label in SVG for slender vertical parts (e.g. Cokół 100x1500)', async () => {
        const slenderParts: NestingPart[] = [
            { id: '1', name: 'Cokół Dolny', width: 100, height: 1500, quantity: 1, thickness: 18, material: 'Biel Alpejska', canRotate: false }
        ];

        const result = await NestingEngine.runNesting(slenderParts, config, { mode: 'fast' });
        expect(result.boards.length).toBe(1);

        const { NestingExporter } = await import('../export/nesting-exporter');
        const svg = NestingExporter.generateBoardSvgString(result.boards[0], config);

        expect(svg).toContain('rotate(-90');
        expect(svg).toContain('Cokół Dolny');
    });

    it('should calculate and store positions and dimensions in exact integer nanometers (nm)', async () => {
        const parts: NestingPart[] = [
            { id: 'p1', name: 'Panel Precyzyjny', width: 600, height: 400, quantity: 1, thickness: 18, material: 'Biel Alpejska', canRotate: false }
        ];

        const result = await NestingEngine.runNesting(parts, config, { mode: 'fast' });
        expect(result.boards.length).toBe(1);
        const packed = result.boards[0].layout[0];

        expect(packed.w_nm).toBe(600_000_000);
        expect(packed.h_nm).toBe(400_000_000);
        expect(packed.x_nm).toBe(10_000_000); // 10 mm trimMargin = 10 000 000 nm
        expect(packed.y_nm).toBe(10_000_000); // 10 mm trimMargin = 10 000 000 nm
        expect(result.boards[0].width_nm).toBe(2800_000_000);
        expect(result.boards[0].height_nm).toBe(2070_000_000);
    });
});
