import { describe, it, expect, beforeEach } from 'vitest';
import { ModalTransformManager } from '../modal-transform.js';
import { Quat } from '../cad-math/quat.js';
import { Vec3 } from '../cad-math/vec3.js';
import { nmToMm, mmToNm } from '../cad-math/units.js';

describe('ModalTransformManager — Narzędzia G i R oraz okno wartości', () => {
    let manager: ModalTransformManager;

    beforeEach(() => {
        manager = ModalTransformManager.instance;
        manager.activeMode = 'none';
        manager.lockedAxis = 'none';
    });

    it('zwraca instancję singletona i domyślny stan', () => {
        expect(manager).toBeDefined();
        expect(manager.activeMode).toBe('none');
        expect(manager.lockedAxis).toBe('none');
    });

    it('poprawnie przelicza kąty Eulera w stopniach na Quat i z powrotem dla poszczególnych osi', () => {
        // Oś X: 45°
        const qX = Quat.fromEulerXYZ(45 * (Math.PI / 180), 0, 0);
        expect(qX.length()).toBeCloseTo(1.0, 4);
        expect(Math.round(qX.toEulerXYZ().x * (180 / Math.PI))).toBe(45);

        // Oś Y: 30°
        const qY = Quat.fromEulerXYZ(0, 30 * (Math.PI / 180), 0);
        expect(qY.length()).toBeCloseTo(1.0, 4);
        expect(Math.round(qY.toEulerXYZ().y * (180 / Math.PI))).toBe(30);

        // Oś Z: 90°
        const qZ = Quat.fromEulerXYZ(0, 0, 90 * (Math.PI / 180));
        expect(qZ.length()).toBeCloseTo(1.0, 4);
        expect(Math.round(qZ.toEulerXYZ().z * (180 / Math.PI))).toBe(90);
    });

    it('poprawnie konwertuje jednostki mm do nm i odwrotnie dla translacji', () => {
        const transMm = new Vec3(150, -300, 720);
        const transNm = new Vec3(mmToNm(transMm.x), mmToNm(transMm.y), mmToNm(transMm.z));

        expect(transNm.x).toBe(150_000_000);
        expect(transNm.y).toBe(-300_000_000);
        expect(transNm.z).toBe(720_000_000);

        expect(nmToMm(transNm.x)).toBe(150);
        expect(nmToMm(transNm.y)).toBe(-300);
        expect(nmToMm(transNm.z)).toBe(720);
    });

    it('rejestruje i wywołuje listenery onStateChange przy zakończeniu transformacji', () => {
        let notifiedText: string | null = 'init';
        const unsubscribe = manager.onStateChange((info) => {
            notifiedText = info;
        });

        manager.activeMode = 'translate';
        manager.confirmTransform();

        expect(manager.activeMode).toBe('none');
        expect(notifiedText).toBeNull();

        unsubscribe();
    });

    it('subskrybuje zmiany trybu modalTransformMode i natychmiastowo przekazuje aktualny stan', () => {
        let currentMode = '';
        const unsubscribe = manager.subscribe((mode) => {
            currentMode = mode;
        });

        expect(currentMode).toBe('none');

        manager.activeMode = 'rotate';
        manager.confirmTransform();

        expect(currentMode).toBe('none');

        unsubscribe();
    });
});
