/**
 * Format pliku projektu: stałe, typy JSON, walidacja i migracja.
 *
 * Osobno od `ProjectDocument` (stan + drzewo), żeby load mógł najpierw
 * odrzucić zły plik bez tyczenia dokumentu.
 */

export const PROJECT_FORMAT = 'smartpanel-project';
export const PROJECT_FORMAT_VERSION = 4;
export const PROJECT_DOMAIN_UNIT = 'nm';

export interface ProjectMetadataJSON {
    savedAt?: string;
    appVersion?: string;
    [key: string]: unknown;
}

export interface ProjectDocumentJSON {
    format: string;
    version: number;
    domainUnit: string;
    id: string;
    name: string;
    metadata?: ProjectMetadataJSON;
    rootNode: Record<string, any>;
    extensions?: Record<string, any>;
}

/**
 * Walidacja wersji / jednostki i normalizacja do bieżącego kontraktu.
 *
 * Wersja 4 usunęła kompatybilność wsteczną parametrów korpusu
 * (aliasy `width`/`zoneCount`/`bottomHeight`/`bokLewy`/`blindWidth`/…).
 * Starsze pliki są ODRZUCANE — świadomie, przy zerowej bazie projektów.
 * Zob. A3_smartframe/smartframe-types.ts (assertCanonicalCabinetParams).
 */
export function migrateProjectToCurrent(data: any): ProjectDocumentJSON {
    if (!data || data.format !== PROJECT_FORMAT) {
        throw new Error(
            `ProjectDocument.load: nieobsługiwany format pliku. Oczekiwano "${PROJECT_FORMAT}" w wersji ${PROJECT_FORMAT_VERSION}.`
        );
    }
    const version = Number(data.version);
    if (!Number.isFinite(version) || version !== PROJECT_FORMAT_VERSION) {
        throw new Error(
            `ProjectDocument.load: plik w wersji ${data.version}, obsługiwana wyłącznie wersja ${PROJECT_FORMAT_VERSION}. ` +
            `Wersje < ${PROJECT_FORMAT_VERSION} zawierają wycofane nazwy parametrów i nie są migrowane — zapisz projekt ponownie w aktualnej aplikacji.`
        );
    }
    if (!data.rootNode) {
        throw new Error('ProjectDocument.load: brak rootNode.');
    }

    const domainUnit = data.domainUnit ?? PROJECT_DOMAIN_UNIT;
    if (domainUnit !== PROJECT_DOMAIN_UNIT) {
        throw new Error(
            `ProjectDocument.load: nieobsługiwana domainUnit "${domainUnit}". Dozwolone wyłącznie "${PROJECT_DOMAIN_UNIT}".`
        );
    }

    const extensions: Record<string, any> = {};
    if (data.extensions && typeof data.extensions === 'object') {
        Object.assign(extensions, data.extensions);
    }

    return {
        format: PROJECT_FORMAT,
        version: PROJECT_FORMAT_VERSION,
        domainUnit: PROJECT_DOMAIN_UNIT,
        id: data.id,
        name: data.name,
        metadata: data.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : {},
        rootNode: data.rootNode,
        extensions,
    };
}
