/**
 * shelves-drilling-intent.ts
 *
 * Kontrakty nawierceń korpusu modułu PÓŁKI (otwory → BOK_L / BOK_P / PLECY).
 */
export interface ShelvesDrillingFeature {
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
        clearance?: number;
        isShelfDrilling: boolean;
        sourceContainerId?: string;
        sourcePartId?: string;
    };
}

export interface ShelvesDrillingIntent {
    targetNodeId: string;
    feature: ShelvesDrillingFeature;
}
