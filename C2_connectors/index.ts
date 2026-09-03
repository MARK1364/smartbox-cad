/**
 * C2_connectors — port A6_connectors (Blender) do WEB.
 */

export { ConnectorsUI, CONNECTORS_PANEL_TITLE } from './connectors-ui';
export { ConnectorStore } from './connector-store';
export { CONNECTORS_DOCUMENT_SECTION } from './connectors-types';
export { ConnectorVisualizer } from './connector-visualizer';
export { ConnectorsEngine, getConnectorsEngine } from './connectors-engine';
export { scanEligibleConnectorFaces } from './contact-scanner';
export { startConnectorPick, stopConnectorPick } from './connector-picker';
export { attachConnectorsExtension } from './connector-controller';
export { buildConnectorDrillings } from './connectors-drilling-builder';
export { getSymbolSegments, isParentFaceContact } from './connectors-embedment';
export type { ConnectorDrillingIntent, ConnectorDrillingFeature } from './connectors-drilling-intent';
