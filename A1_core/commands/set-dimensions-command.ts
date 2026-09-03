/**
 * SmartPanel Web — SetDimensionsCommand
 *
 * Komenda zmiany wymiarów (szerokość, wysokość, głębokość/grubość) w nm dla panelu lub korpusu.
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import { ContainerModel } from '../container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';

export interface DimensionValues {
    width?: number;
    height?: number;
    depth?: number;
    thickness?: number;
}

export class SetDimensionsCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly nodeId: string;
    readonly oldDimensions: DimensionValues;
    readonly newDimensions: DimensionValues;
    readonly oldGeneratorParams?: any;
    readonly newGeneratorParams?: any;

    constructor(
        nodeId: string,
        oldDimensions: DimensionValues,
        newDimensions: DimensionValues,
        options: { oldGeneratorParams?: any; newGeneratorParams?: any; label?: string } = {}
    ) {
        this.id = `cmd_dim_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.nodeId = nodeId;
        this.oldDimensions = { ...oldDimensions };
        this.newDimensions = { ...newDimensions };
        this.oldGeneratorParams = options.oldGeneratorParams ? JSON.parse(JSON.stringify(options.oldGeneratorParams)) : undefined;
        this.newGeneratorParams = options.newGeneratorParams ? JSON.parse(JSON.stringify(options.newGeneratorParams)) : undefined;
        this.label = options.label ?? 'Zmiana wymiarów';
        this.timestamp = Date.now();
        this.affectedNodeIds = [nodeId];
    }

    execute(document: ProjectDocument): void {
        this._applyDimensions(document, this.newDimensions, this.newGeneratorParams);
    }

    undo(document: ProjectDocument): void {
        this._applyDimensions(document, this.oldDimensions, this.oldGeneratorParams);
    }

    private _applyDimensions(document: ProjectDocument, dims: DimensionValues, generatorParams?: any): void {
        const node = document.findNode(this.nodeId);
        if (!node || !node.domainData) return;

        const data = node.domainData as any;
        if (dims.width !== undefined) data.width = dims.width;
        if (dims.height !== undefined) data.height = dims.height;
        if (dims.depth !== undefined) data.depth = dims.depth;
        if (dims.thickness !== undefined) data.thickness = dims.thickness;

        if (generatorParams !== undefined && data.generatorParams !== undefined) {
            data.generatorParams = JSON.parse(JSON.stringify(generatorParams));
        }

        document.emitChange('dimensions', [this.nodeId]);
    }
}
