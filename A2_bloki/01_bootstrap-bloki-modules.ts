/**
 * A2_bloki/01_bootstrap-bloki-modules.ts
 *
 * Scentralizowane wpisywanie wtyczek Bloki do SmartModuleRegistry.
 * Wywoływane jawnie bez side-effectów przy imporcie.
 */

import { SmartModuleRegistry } from './core/smart-module-registry.js';
import { shelvesPlugin } from './plugins/shelves-plugin.js';
import { shelfPlugin } from './plugins/shelf-plugin.js';
import { doorsPlugin } from './plugins/doors-plugin.js';
import { skosneDoorsPlugin } from './plugins/skosne-doors-plugin.js';
import { cornerDoorsPlugin } from './plugins/corner-doors-plugin.js';
import { cornerShelvesPlugin } from './plugins/corner-shelves-plugin.js';
import { tubesPlugin } from './plugins/tubes-plugin.js';
import { drawersPlugin } from './plugins/drawers-plugin.js';
import { dividersPlugin } from './plugins/dividers-plugin.js';
import { panelsPlugin } from './plugins/panels-plugin.js';
import { flapsPlugin } from './plugins/flaps-plugin.js';
import { ledInternalPlugin } from './plugins/led-internal-plugin.js';
import { ledExternalPlugin } from './plugins/led-external-plugin.js';
import { handlePlugin } from './plugins/handle-plugin.js';
import { hangersPlugin } from './plugins/hangers-plugin.js';
import { sinkPlugin } from './plugins/sink-plugin.js';

export function registerAllBlokiModules(): void {
    SmartModuleRegistry.register(shelvesPlugin);
    SmartModuleRegistry.register(shelfPlugin);
    SmartModuleRegistry.register(doorsPlugin);
    SmartModuleRegistry.register(skosneDoorsPlugin);
    SmartModuleRegistry.register(cornerDoorsPlugin);
    SmartModuleRegistry.register(cornerShelvesPlugin);
    SmartModuleRegistry.register(tubesPlugin);
    SmartModuleRegistry.register(drawersPlugin);
    SmartModuleRegistry.register(dividersPlugin);
    SmartModuleRegistry.register(panelsPlugin);
    SmartModuleRegistry.register(flapsPlugin);
    SmartModuleRegistry.register(ledInternalPlugin);
    SmartModuleRegistry.register(ledExternalPlugin);
    SmartModuleRegistry.register(handlePlugin);
    SmartModuleRegistry.register(hangersPlugin);
    SmartModuleRegistry.register(sinkPlugin);
}

