/**
 * groove-intent.ts
 *
 * Kontrakty dla operacji generowania wpustów (Grooves) w lokalnym układzie współrzędnych formatek (LCS).
 * Całkowicie niezależne od środowiska renderującego (Document/Nodes).
 */

/**
 * Czysto geometryczna definicja wpustu w przestrzeni lokalnej (LCS) formatki.
 * Wszystkie wymiary i pozycje są wyrażone w nanometrach (nm) dla najwyższej precyzji w domenie CAD.
 */
export interface GrooveFeatureLCS {
    type: 'groove';
    
    /** 
     * Identyfikator płaszczyzny w układzie LCS (np. "+Z" = front, "-Z" = back).
     * W przyszłości: indeks ściany B-Rep.
     */
    face: '+Z' | '-Z' | '+X' | '-X' | '+Y' | '-Y';
    
    params: {
        /** 
         * Pozycja startowa (lewy dolny róg) na płaszczyźnie względem lokalnego układu (nm).
         * Współrzędne U i V zależą od orientacji wybranej ściany (face).
         */
        u_nm: number;
        v_nm: number;
        
        /** Wymiar wzdłuż osi U wybranej ściany (nm) */
        width_nm: number;
        
        /** Wymiar wzdłuż osi V wybranej ściany (nm) */
        length_nm: number;
        
        /** Głębokość wpustu wgłąb materiału, mierzona wzdłuż normalnej do ściany (nm) */
        depth_nm: number;
    };
}

/**
 * Zamiar wykonania operacji wygenerowania wpustu (z możliwością modyfikacji wymiarów samej formatki).
 * Zwracany przez builder, ale nie modyfikuje jeszcze stanu aplikacji.
 */
export interface GrooveIntent {
    /** Identyfikator węzła docelowego (CADNode UUID), na którym ma zostać utworzony wpust. */
    targetNodeId: string;
    
    /** Opcjonalna modyfikacja wymiarów bazy formatki (np. skrócenie, gdy wpust idzie na wylot). W nanometrach. */
    dimensionsOverride_nm?: {
        width_nm: number;
        height_nm: number;
        thickness_nm: number;
    };
    
    /** Opcjonalna modyfikacja położenia węzła (translacja), jeśli formatka uległa skróceniu. (nm) */
    positionOverride_nm?: {
        x_nm: number;
        y_nm: number;
        z_nm: number;
    };
    
    /** 
     * Wygenerowana cecha wpustu w przestrzeni LCS. 
     * Jeśli undefined, to wpust zredukował się do ucięcia płyty na wylot. 
     */
    feature?: GrooveFeatureLCS;
}
