/**
 * flaps-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu KLAPY (prowadniki zawiasów → BOK_L / BOK_P).
 */
export interface FlapsDrillingFeature {
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
        isFlapDrilling: boolean;
        sourceContainerId?: string;
        sourcePartId?: string;
    };
}

export interface FlapsDrillingIntent {
    targetNodeId: string;
    feature: FlapsDrillingFeature;
}
