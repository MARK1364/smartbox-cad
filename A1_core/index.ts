/**
 * A1_core Barrel Export — Public API
 */

export { ContextManager } from './context-manager.js';
export type { IAppAPI } from './context-manager.js';
export { ContainerModel } from './container-model.js';
export {
    ProjectDocument,
    migrateProjectToCurrent,
    PROJECT_FORMAT,
    PROJECT_FORMAT_VERSION,
    PROJECT_APP_VERSION,
} from './project-document.js';
export type { ProjectDocumentJSON, ProjectMetadataJSON, DocumentExtension, SerializeOptions, LoadOptions } from './project-document.js';
export { ProjectFileIO, stampProjectFileMetadata, suggestedProjectFileName } from './project-file-io.js';
export { registerProjectDomain } from './project-domain.js';
export { attachDrawingsExtension, DRAWINGS_DOCUMENT_SECTION } from './drawings-document-extension.js';
export { FacePicker } from './face-picker.js';
export { HistoryManager } from './history-manager.js';
export { UIController } from './ui-controller.js';
export { unit } from './unit-system.js';
export { TRANSLATIONS as translations } from './translations.js';
export { PropertiesManager } from './properties.js';
export { GeometryDetector, GeometryType } from './geometry-detector.js';
export type { DetectionResult } from './geometry-detector.js';
export { TooltipManager } from './tooltip-manager.js';
export type { ToolHint } from './tooltip-manager.js';
