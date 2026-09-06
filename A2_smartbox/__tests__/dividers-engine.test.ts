import { describe, it, expect } from 'vitest';
import { DividersEngine } from '../dividers-engine.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { cadMatrixToRenderMatrix } from '../../A1_core/cad-math/coord-system.js';

describe('DividersEngine LCS and Orientation', () => {
    it('generates vertical dividers with LCS Y aligned with cabinet depth (global Y)', () => {
        const engine = new DividersEngine();
        const plan = engine.plan({
            width: 800,
            height: 1000,
            depth: 500,
            count: 2,
            thickness: 18
        });

        expect(plan.parts.length).toBe(2);

        for (const part of plan.parts) {
            expect(part.lcs).toBeDefined();
            expect(part.lcs.mapping).toEqual({ X: 'x', Y: 'y', Z: 'z' });
            expect(part.lcs.rotation).toEqual([90, 0, 90]);

            // Wymiary: X = wysokość, Y = głębokość, Z = grubość
            expect(part.dim.x).toBe(1000); // height
            expect(part.dim.y).toBe(500);  // depth
            expect(part.dim.z).toBe(18);   // thickness

            // Kwaternion obrotu [0, -90, 0] wokół osi Y
            const rotQuat = Quat.fromEulerXYZ(
                part.lcs.rotation[0] * Math.PI / 180,
                part.lcs.rotation[1] * Math.PI / 180,
                part.lcs.rotation[2] * Math.PI / 180
            );

            // Testujemy zachowanie po konwersji przez cadMatrixToRenderMatrix (tak jak w SceneSyncAdapter dla Babylona):
            const cadM = Mat4.fromQuaternion(rotQuat);
            const renderM = cadMatrixToRenderMatrix(cadM);
            const { rotation: bRot } = renderM.decompose();

            // W Babylon (Render):
            // 1. Oś X formatki (wysokość = 1000) ma iść w Babylon Y (pion w górę)
            const xBabylon = bRot.rotateVec3(new Vec3(1, 0, 0));
            expect(xBabylon.x).toBeCloseTo(0, 5);
            expect(xBabylon.y).toBeCloseTo(1, 5);
            expect(xBabylon.z).toBeCloseTo(0, 5);

            // 2. Oś Y formatki (głębokość = 500) ma iść w Babylon Z (głębokość szafy)
            const yBabylon = bRot.rotateVec3(new Vec3(0, 1, 0));
            expect(yBabylon.x).toBeCloseTo(0, 5);
            expect(yBabylon.y).toBeCloseTo(0, 5);
            expect(yBabylon.z).toBeCloseTo(-1, 5);

            // 3. Oś Z formatki (grubość = 18) ma iść w Babylon X (szerokość / w poprzek)
            const zBabylon = bRot.rotateVec3(new Vec3(0, 0, 1));
            expect(Math.abs(zBabylon.x)).toBeCloseTo(1, 5);
            expect(zBabylon.y).toBeCloseTo(0, 5);
            expect(zBabylon.z).toBeCloseTo(0, 5);

            // 4. Oklejona krawędź przednia to +Y (kierunek przodu mebla, identycznie jak półki)
            expect(part.edge_banding['+Y']?.active).toBe(true);
        }
    });
});
