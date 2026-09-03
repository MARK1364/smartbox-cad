/**
 * doors-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu DRZWI (prowadniki zawiasów → BOK_L / BOK_P).
 */
export interface DoorsDrillingFeature {
    id: string;
    type: 'hole';
    face: 'FACE_Z_PLUS' | 'FACE_Z_MINUS' | 'FACE_X_PLUS' | 'FACE_X_MINUS' | 'FACE_Y_PLUS' | 'FACE_Y_MINUS';
    side?: string;
    params: {
        template_id?: string;
        u: number;
        v: number;
        diameter: number;
        depth: number;
        isDoorDrilling: boolean;
        sourceContainerId?: string;
        sourcePartId?: string;
    };
}

export interface DoorsDrillingIntent {
    targetNodeId: string;
    feature: DoorsDrillingFeature;
}
