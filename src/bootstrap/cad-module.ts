/**
 * Kontrakt modułu CAD dla systemu bootstrapu.
 */

import type { CadModuleContext } from '../../A1_core/cad-module-context.js';
import type { StateMachine } from '../../A1_core/interaction/state-machine.js';

/** Kontekst przekazywany do haczyków rejestracji modułu (domena / tools / UI). */
export interface CadModuleRuntime {
    ctx: CadModuleContext;
    stateMachine: StateMachine;
}

export interface CadModule {
    readonly id: string;
    registerDomain?(runtime: CadModuleRuntime): void | Promise<void>;
    registerProjectExtension?(runtime: CadModuleRuntime): void;
    registerTools?(runtime: CadModuleRuntime): void;
    registerUi?(runtime: CadModuleRuntime): void;
    dispose?(): void;
}
