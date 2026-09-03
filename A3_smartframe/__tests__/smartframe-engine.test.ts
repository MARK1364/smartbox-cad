import { describe, it, expect } from 'vitest';
import { Korpus3Engine } from '../smartframe-engine';
import { Quat } from '../../A1_core/cad-math/quat';
import { Vec3 } from '../../A1_core/cad-math/vec3';

describe('Korpus3Engine SmartFrame generation', () => {
    it('should generate 1-zone cabinet geometry with fallback rules', () => {
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2000,
            depth: 600,
            zoneCount: 1,
            backOffsetMm: 10
        });

        expect(plan.zones).toHaveLength(1);
        expect(plan.zones[0].zoneKey).toBe('SEKCJA_B');
        expect(plan.zones[0].size).toBe(2000);

        expect(plan.parts.length).toBeGreaterThan(0);

        const roles = plan.parts.map(p => p.role);
        expect(roles).toContain('LEFT_SIDE_PANEL');
        expect(roles).toContain('RIGHT_SIDE_PANEL');
        expect(roles).toContain('BOTTOM_PANEL');
        expect(roles).toContain('TOP_PANEL');
        expect(roles).toContain('BACK_PANEL');
    });

    it('should calculate 3-zone cabinet layout correctly', () => {
        const engine = new Korpus3Engine();
        const plan = engine.plan({
            width: 1000,
            height: 2500,
            depth: 600,
            zoneCount: 3,
            bottomHeight: 500,
            middleHeight: 1200
        });

        expect(plan.zones).toHaveLength(3);
        const [b, m, t] = plan.zones;

        expect(b.zoneKey).toBe('SEKCJA_B');
        expect(b.size).toBe(500);
        expect(b.baseOffset).toBe(0);

        expect(m.zoneKey).toBe('SEKCJA_M');
        expect(m.size).toBe(1200);
        expect(m.baseOffset).toBe(500);

        expect(t.zoneKey).toBe('SEKCJA_T');
        expect(t.size).toBe(800); // 2500 - 500 - 1200
        expect(t.baseOffset).toBe(1700);
    });

    it('should orient BACK_PANEL Z+ axis after 180 deg rotation (Math.PI)', () => {
        const backRotQuat = Quat.fromEulerXYZ(Math.PI, 0, 0);
        const localZNormal = new Vec3(0, 0, 1);
        const cadWorldZNormal = backRotQuat.rotateVec3(localZNormal);

        // Oś +Z formatki pleców po rotacji 180 deg wokół X powinna wskazywać (0, 0, -1)
        expect(Math.abs(cadWorldZNormal.x)).toBeCloseTo(0);
        expect(Math.abs(cadWorldZNormal.y)).toBeCloseTo(0);
        expect(cadWorldZNormal.z).toBeCloseTo(-1);
    });
});
