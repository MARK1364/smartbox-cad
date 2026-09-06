/**
 * E3_export - drawing-types.ts
 * Typy danych dla 2D Drawing Studio i E3 z obsługą Multi-Kadrów 3D i wymiarów PMI.
 */



import type { PaperFormat, TitleBlockInfo } from './export-types.js';

export type DrawingModelScope = 'PROJECT' | 'CONTAINER' | 'SUBASSEMBLY' | 'PART';
export type ProjectionAngle = 'FRONT' | 'TOP' | 'LEFT' | 'RIGHT' | 'BACK' | 'BOTTOM' | 'ISOMETRIC' | 'CUSTOM';
export type DisplayStyle = 'HIDDEN_REMOVED' | 'SHADED' | 'MONO';

export interface HoleFeature2D {
    id: string;
    x: number;      // mm od lewej dolnej krawędzi ściany
    y: number;      // mm
    diameter: number;
    depth: number;
    face: 'FRONT' | 'BACK' | 'EDGE_X_MINUS' | 'EDGE_X_PLUS' | 'EDGE_Y_MINUS' | 'EDGE_Y_PLUS';
    frozen?: boolean;
}

export interface GrooveFeature2D {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
    name?: string;
    /** library = ramka/smart (edytowalna); engine = wpust silnika (tylko podgląd). */
    source?: 'library' | 'engine';
    libraryId?: string;
    face?: string;
    editable?: boolean;
    frozen?: boolean;
}

export type CADNodeType = 'PROJECT' | 'CONTAINER' | 'ASSEMBLY' | 'SUBASSEMBLY' | 'DRAWERS' | 'SHELVES' | 'PART';

export interface CADTreeNode {
    id: string;
    name: string;
    type: CADNodeType;
    icon: string;
    width: number;
    height: number;
    depth: number;
    thickness?: number;
    material?: string;
    role?: string;
    partCount: number;
    children?: CADTreeNode[];
    holes?: HoleFeature2D[];
    grooves?: GrooveFeature2D[];
    visible?: boolean;
    frozen?: boolean;
    isManual?: boolean;
    engineManaged?: boolean;
}

export interface PartDrawingGeometry {
    id: string;
    name: string;
    role?: string;
    material: string;
    width: number;      // wymiar X (mm)
    height: number;     // wymiar Y (mm)
    thickness: number;  // grubość Z (mm, np. 18)
    colorHex?: string;
    parentContainerId?: string;
    parentContainerName?: string;
    holes: HoleFeature2D[];
    grooves: GrooveFeature2D[];
}

export interface ContainerDrawingGeometry {
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    parts: PartDrawingGeometry[];
}

export interface ProjectDrawingTree {
    projectName: string;
    rootNode: CADTreeNode;
    containers: ContainerDrawingGeometry[];
    standaloneParts: PartDrawingGeometry[];
}

export interface DrawingPMIDimension {
    id: string;
    text: string;
    distanceMM: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    z1?: number;
    z2?: number;
    lx1?: number;
    ly1?: number;
    lz1?: number;
    lx2?: number;
    ly2?: number;
    lz2?: number;
    nodeId?: string;
    dimType?: 'LINEAR' | 'ALIGNED' | 'RADIUS' | 'DIAMETER';
}

export interface DrawingView2D {
    id: string;
    title: string;
    scope: DrawingModelScope;
    targetEntityId: string;
    targetEntityName: string;
    targetNode?: CADTreeNode;
    projection: ProjectionAngle;
    scale: number;        // współczynnik np. 0.1 = 1:10, 0.2 = 1:5, 1.0 = 1:1
    scaleText: string;    // "1:10", "1:5", "1:1"
    showPMI: boolean;     // czy wyświetlać rzutowane wymiary PMI w tym kadrze
    x: number;            // pozycja X środka rzutu na arkuszu (mm)
    y: number;            // pozycja Y środka rzutu na arkuszu (mm)
    widthMm: number;      // szerokość rzutu w skali na arkuszu (mm)
    heightMm: number;     // wysokość rzutu w skali na arkuszu (mm)
    svgCode: string;      // wygenerowana grafika wektorowa SVG
    pmiSvgOverlay?: string; // zrzutowane wektory PMI dla tej perspektywy
    isSelected?: boolean;
}

export interface DrawingDimension2D {
    id: string;
    viewId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    valueMm: number;
    text: string;
    offsetMm: number;
    orientation: 'HORIZONTAL' | 'VERTICAL' | 'ALIGNED';
}



export interface DrawingSheetModel {
    id: string;
    name: string;
    paperFormat: PaperFormat;
    titleBlock: TitleBlockInfo;
    views: DrawingView2D[];
    dimensions: DrawingDimension2D[];
    showBOM: boolean;
}
