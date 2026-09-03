/**
 * SmartPanel Web — C1_CNC Geometry Detector & Feature Extractor
 * 
 * Moduł zapewniający 100% spójności nazewnictwa z modułem `A1_core.geometry_detector` z Blendera.
 * Umożliwia zarówno interaktywną detekcję geometrii 3D myszą (naroża, krawędzie, płaszczyzny),
 * jak i ekstrakcję cech obróbczych CAM (otwory, wpusty, kontury).
 */

export { GeometryDetector, GeometryType } from '../../A1_core/geometry-detector.js';
export type { DetectionResult } from '../../A1_core/geometry-detector.js';

export { GeometryDataExtractor } from './geometry-extractor.js';
export type { FaceData3D } from './geometry-extractor.js';
