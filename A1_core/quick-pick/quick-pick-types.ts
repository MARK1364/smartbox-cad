/**
 * SmartPanel Web — QuickPick Types
 * 
 * Typy struktur danych dla mechanizmu wyboru zakrytych płaszczyzn w scenie 3D (a'la Solid Edge).
 */

export interface QuickPickCandidate {
    /** Kolejność od oka kamery (0 = najbliższa / front, 1, 2... = w głąb). */
    index: number;
    /** Referencja do siatki Babylon.js ściany. */
    mesh: any;
    /** Odległość wzdłuż promienia od kamery w mm. */
    distanceMm: number;
    /** Przesunięcie odległości względem poprzedniej ściany (np. +18 mm). */
    deltaDistanceMm?: number;
    /** Punkt trafienia 3D w przestrzeni świata. */
    worldPoint: { x: number; y: number; z: number };
    /** Wektor normalny ściany w przestrzeni świata. */
    worldNormal?: { x: number; y: number; z: number } | null;
    /** Kanoniczna nazwa ściany (np. FACE_Z_PLUS, FACE_Y_MINUS). */
    faceName: string;
    /** Czytelna etykieta ściany po polsku (np. "Front (+Z) / Przód", "Góra (+Y)"). */
    faceLabel: string;
    /** Krótki symbol orientacji (np. "+Z", "-Z", "+Y", "-Y", "-X", "+X"). */
    axisBadge: string;
    /** Model formatki (PanelModel / CADNode). */
    panelModel: any;
    /** Nazwa formatki (np. "Bok lewy", "Wieniec dolny", "Półka 1"). */
    panelName: string;
    /** Identyfikator smartId. */
    smartId?: string | null;
    /** Czy płaszczyzna jest zasłonięta przez inną płaszczyznę z przodu. */
    isObscured: boolean;
}

export interface QuickPickRequest {
    screenX: number;
    screenY: number;
    candidates: QuickPickCandidate[];
    onSelect: (candidate: QuickPickCandidate) => void;
    onCancel?: () => void;
}
