/**
 * connectors-drilling-intent.ts
 *
 * Kontrakty nawierceń złączy — otwory pod kołki, konfirmaty i minifixy
 * na formatkach korpusu (FACE = boczek, EDGE = wieniec).
 *
 * Analogiczny do ShelvesDrillingIntent / DoorsDrillingIntent.
 */

export type CanonicalFace =
    | 'FACE_Z_PLUS'
    | 'FACE_Z_MINUS'
    | 'FACE_X_PLUS'
    | 'FACE_X_MINUS'
    | 'FACE_Y_PLUS'
    | 'FACE_Y_MINUS';

export interface ConnectorDrillingFeature {
    id: string;
    type: 'hole';
    face: CanonicalFace;
    name?: string;
    side?: string;
    params: {
        /** Pozycja wzdłuż osi U ściany [mm]. */
        u: number;
        /** Pozycja wzdłuż osi V ściany [mm]. */
        v: number;
        /** Średnica wiertła [mm]. */
        diameter: number;
        /** Głębokość wiercenia [mm]. */
        depth: number;
        /** Flaga identyfikująca otwory złączy (do filtrowania w sync/clear). */
        isConnectorDrilling: true;
        /** Identyfikator cechy do wyszukiwania w CNC (typ złącza). */
        template_id: string;
        /** Typ złącza z connectors_3_rules.json. */
        connectorType: string;
        /** ID grupy złączy w ConnectorStore. */
        connectorGroupId: string;
        /** Indeks złącza w obrębie grupy. */
        connectorIndex: number;
        /** Typ ściany: EDGE = czoło wieńca, FACE = płaszczyzna boczka. */
        faceType?: 'EDGE' | 'FACE';
        /** Konfirmat w boczku — otwór na wylot. */
        through?: boolean;
        /** ID formatki-źródła (parentObjectId lub otherObjectId). */
        sourcePartId?: string;
    };
}

export interface ConnectorDrillingIntent {
    /** ID węzła formatki docelowej, do której trafia otwór. */
    targetNodeId: string;
    /** Cecha geometryczna (hole) do wstawienia w panel.features[]. */
    feature: ConnectorDrillingFeature;
}
