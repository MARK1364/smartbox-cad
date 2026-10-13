/**
 * skosne-doors-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu DRZWI SKOŚNE (prowadniki zawiasu → BOK_L / BOK_P).
 * Identyczny kształt co DoorsDrillingIntent — wspólna struktura, osobny moduł Bloki.
 */
export interface SkosneDoorsDrillingFeature {
    id: string;
    type: 'hole';
    face: 'FACE_Z_PLUS' | 'FACE_Z_MINUS' | 'FACE_X_PLUS' | 'FACE_X_MINUS' | 'FACE_Y_PLUS' | 'FACE_Y_MINUS';
    side?: string;
    params: {
        template_id?: string;
        u: number;
        v: number;
        u_mm?: number;
        v_mm?: number;
        diameter: number;
        diameter_mm?: number;
        depth: number;
        depth_mm?: number;
        isDoorDrilling: boolean;
        sourceContainerId?: string;
        sourcePartId?: string;
    };
}

export interface SkosneDoorsDrillingIntent {
    targetNodeId: string;
    feature: SkosneDoorsDrillingFeature;
}