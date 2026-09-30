/**
 * tubes-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu DRĄŻEK (uchwyty rozety fi25 oraz podpórki półki nad drążkiem → BOK_L / BOK_P).
 */
export interface TubesDrillingFeature {
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
        isTubeDrilling: boolean;
        sourceContainerId?: string;
        sourcePartId?: string;
    };
}

export interface TubesDrillingIntent {
    targetNodeId: string;
    feature: TubesDrillingFeature;
}
