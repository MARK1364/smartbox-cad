import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer.js';
import { resolveMaterialName } from './nesting-engine.js';
import type { ContainerScopeInfo, NestingPart } from './nesting-types.js';
import type { ReportDataIssue } from '../../R1_reports/report-data-normalizer.js';

export interface NestingSourceData {
    parts: NestingPart[];
    containers: ContainerScopeInfo[];
    issues: ReportDataIssue[];
}

export function getNestingBlockReason(issues: ReportDataIssue[], partCount: number): string | null {
    if (issues.length > 0) {
        return 'Nie można obliczyć rozkroju: projekt zawiera formatki z niekompletnymi danymi.';
    }
    if (partCount === 0) {
        return 'Brak formatek do rozkroju.';
    }
    return null;
}

export function extractNestingData(document: unknown): NestingSourceData {
    const data = ReportDataNormalizer.extractProjectData(document);
    const parts = data.panels.map((panel, index) => ({
        id: panel.part_id || `part_${index}`,
        name: panel.role || panel.part_id || `part_${index}`,
        width: panel.length_mm,
        height: panel.width_mm,
        thickness: panel.thickness_mm,
        quantity: panel.qty || 1,
        canRotate: !panel.rotate_grain,
        ...(panel.rotate_grain ? { grain: 'horizontal' as const } : {}),
        material: resolveMaterialName(panel.material),
        containerId: panel.container_id,
        blokId: panel.blok_id,
        furnitureName: panel.furniture_name,
        sourceNodeId: panel.node_id,
    }));

    return {
        parts,
        containers: data.containers,
        issues: data.issues,
    };
}
