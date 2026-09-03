/**
 * Rejestr hydratorów i fabryk domainData.
 *
 * ProjectDocument nie importuje A4 — moduły zgłaszają się tutaj
 * (domyślne handlery + per-dokument registerHydrator/registerFactory).
 */

export type DomainHydrator = (raw: any, nodeJson: any) => any;
export type DomainFactory = (options?: any) => any;

const defaultHydrators = new Map<string, DomainHydrator>();
const defaultFactories = new Map<string, DomainFactory>();

export function registerDefaultHydrator(nodeType: string, hydrator: DomainHydrator): void {
    defaultHydrators.set(nodeType, hydrator);
}

export function registerDefaultFactory(nodeType: string, factory: DomainFactory): void {
    defaultFactories.set(nodeType, factory);
}

export interface DomainHandlerHost {
    registerHydrator(nodeType: string, hydrator: DomainHydrator): () => void;
    registerFactory(nodeType: string, factory: DomainFactory): () => void;
}

export function applyDefaultDomainHandlers(host: DomainHandlerHost): void {
    for (const [nodeType, hydrator] of defaultHydrators) {
        host.registerHydrator(nodeType, hydrator);
    }
    for (const [nodeType, factory] of defaultFactories) {
        host.registerFactory(nodeType, factory);
    }
}
