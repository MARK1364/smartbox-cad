import { describe, it, expect } from 'vitest';
import { materialDatabase } from '../material-database.js';

describe('Egger decor textures and thumbnails', () => {
    it('loads H1180 ST37 with valid texture and thumbnail paths', () => {
        const mat = materialDatabase.getMaterialById('H1180_ST37_18');
        expect(mat).toBeDefined();
        expect(mat?.name).toBe('Dąb Halifax naturalny');
        expect(mat?.code).toBe('H1180 ST37');
        expect(mat?.thickness_mm).toBe(18);
        expect(mat?.thumbnail_path).toBe('/textures/thumbnails/H1180_ST37.webp');
        expect(mat?.texture_path).toBe('/textures/egger/H1180_ST37_Albedo.png');
        expect(mat?.hexColor).toBe('#b89e7a');
    });

    it('loads H1181 ST37 and H1344 ST32 correctly', () => {
        const h1181 = materialDatabase.getMaterialById('H1181_ST37_18');
        expect(h1181).toBeDefined();
        expect(h1181?.name).toBe('Dąb Halifax tabak');
        expect(h1181?.thumbnail_path).toBe('/textures/thumbnails/H1181_ST37.webp');
        expect(h1181?.texture_path).toBe('/textures/egger/H1181_ST37_Albedo.png');

        const h1344 = materialDatabase.getMaterialById('H1344_ST32_18');
        expect(h1344).toBeDefined();
        expect(h1344?.name).toBe('Dąb Sherman koniakowy');
        expect(h1344?.thumbnail_path).toBe('/textures/thumbnails/H1344_ST32.webp');
        expect(h1344?.texture_path).toBe('/textures/egger/H1344_ST32_Albedo.png');
    });

    it('automatically generates 16mm variants with correct properties', () => {
        const h1180_16 = materialDatabase.getMaterialById('H1180_ST37_16');
        expect(h1180_16).toBeDefined();
        expect(h1180_16?.thickness_mm).toBe(16);
        expect(h1180_16?.thumbnail_path).toBe('/textures/thumbnails/H1180_ST37.webp');
        expect(h1180_16?.texture_path).toBe('/textures/egger/H1180_ST37_Albedo.png');

        const h1344_16 = materialDatabase.getMaterialById('H1344_ST32_16');
        expect(h1344_16).toBeDefined();
        expect(h1344_16?.thickness_mm).toBe(16);
    });

    it('does not assign synthetic texture_path to HDF, glass or plain uni materials', () => {
        const hdf = materialDatabase.getMaterialById('HDF_BIALY_3');
        expect(hdf).toBeDefined();
        expect(hdf?.texture_path).toBeUndefined();
        expect(hdf?.color).toBeDefined();

        const white = materialDatabase.getMaterialById('W1100_ST9_18');
        expect(white).toBeDefined();
        expect(white?.texture_path).toBeUndefined();
    });
});
