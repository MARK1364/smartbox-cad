/**
 * SmartPanel Web — Feature Commands
 *
 * Komendy dodawania, usuwania i edycji operacji na formatkach (PanelModel.features[]).
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import type { PanelLike } from '../panel-like.js';

export class AddFeatureCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly panelId: string;
    readonly featureData: any;
    readonly index?: number;

    constructor(panelId: string, featureData: any, index?: number, label: string = 'Dodanie obróbki') {
        this.id = `cmd_add_feat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.panelId = panelId;
        this.featureData = JSON.parse(JSON.stringify(featureData));
        this.index = index;
        this.label = label;
        this.timestamp = Date.now();
        this.affectedNodeIds = [panelId];
    }

    execute(document: ProjectDocument): void {
        const node = document.findNode(this.panelId);
        if (!node || !node.domainData) return;
        const panel = node.domainData as PanelLike;
        if (!panel.features) panel.features = [];

        if (this.index !== undefined && this.index >= 0 && this.index < panel.features.length) {
            panel.features.splice(this.index, 0, JSON.parse(JSON.stringify(this.featureData)));
        } else {
            panel.features.push(JSON.parse(JSON.stringify(this.featureData)));
        }

        document.emitChange('features', [this.panelId]);
    }

    undo(document: ProjectDocument): void {
        const node = document.findNode(this.panelId);
        if (!node || !node.domainData) return;
        const panel = node.domainData as PanelLike;
        if (!panel.features) return;

        const idx = panel.features.findIndex((feature: any) => feature?.id === this.featureData.id);
        if (idx !== -1) {
            panel.features.splice(idx, 1);
        }

        document.emitChange('features', [this.panelId]);
    }
}

export class RemoveFeatureCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly panelId: string;
    readonly featureData: any;
    readonly index: number;
    private readonly _previousFeatureId?: string;
    private readonly _nextFeatureId?: string;
    private readonly _remainingFeatureIds: Array<string | undefined>;

    constructor(document: ProjectDocument, panelId: string, featureId: string, label: string = 'Usunięcie cechy geometrycznej') {
        this.id = `cmd_rem_feat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.panelId = panelId;
        const node = document.findNode(panelId);
        if (!node || !node.domainData) {
            throw new Error(`RemoveFeatureCommand: panel "${panelId}" not found.`);
        }
        const panel = node.domainData as PanelLike;
        const idx = (panel.features || []).findIndex((f: any) => f.id === featureId);
        if (idx === -1) {
            throw new Error(`RemoveFeatureCommand: feature "${featureId}" not found on panel.`);
        }
        this.index = idx;
        this.featureData = JSON.parse(JSON.stringify(panel.features[idx]));
        this._previousFeatureId = panel.features[idx - 1]?.id;
        this._nextFeatureId = panel.features[idx + 1]?.id;
        this._remainingFeatureIds = panel.features
            .filter((_: any, featureIndex: number) => featureIndex !== idx)
            .map((feature: any) => feature?.id);
        this.label = label;
        this.timestamp = Date.now();
        this.affectedNodeIds = [panelId];
    }

    execute(document: ProjectDocument): void {
        const node = document.findNode(this.panelId);
        if (!node || !node.domainData) return;
        const panel = node.domainData as PanelLike;
        if (!panel.features) return;
        const idx = panel.features.findIndex((feature: any) => feature?.id === this.featureData.id);
        if (idx !== -1) panel.features.splice(idx, 1);
        document.emitChange('features', [this.panelId]);
    }

    undo(document: ProjectDocument): void {
        const node = document.findNode(this.panelId);
        if (!node || !node.domainData) return;
        const panel = node.domainData as PanelLike;
        if (!panel.features) panel.features = [];
        if (panel.features.some((feature: any) => feature?.id === this.featureData.id)) return;

        const previousIndex = this._previousFeatureId === undefined
            ? -1
            : panel.features.findIndex((feature: any) => feature?.id === this._previousFeatureId);
        const nextIndex = this._nextFeatureId === undefined
            ? -1
            : panel.features.findIndex((feature: any) => feature?.id === this._nextFeatureId);
        let insertionIndex: number;
        if (previousIndex !== -1) {
            insertionIndex = previousIndex + 1;
        } else if (nextIndex !== -1) {
            insertionIndex = nextIndex;
        } else {
            const currentFeatureIds = panel.features.map((feature: any) => feature?.id);
            insertionIndex = currentFeatureIds.length === this._remainingFeatureIds.length
                && currentFeatureIds.every((id, index) => id === this._remainingFeatureIds[index])
                ? Math.min(this.index, panel.features.length)
                : panel.features.length;
        }
        panel.features.splice(insertionIndex, 0, JSON.parse(JSON.stringify(this.featureData)));
        document.emitChange('features', [this.panelId]);
    }
}

export class UpdateFeatureCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly panelId: string;
    readonly featureId: string;
    readonly oldParams: any;
    readonly newParams: any;

    constructor(
        panelId: string,
        featureId: string,
        oldParams: any,
        newParams: any,
        label: string = 'Edycja obróbki'
    ) {
        this.id = `cmd_upd_feat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.panelId = panelId;
        this.featureId = featureId;
        this.oldParams = JSON.parse(JSON.stringify(oldParams));
        this.newParams = JSON.parse(JSON.stringify(newParams));
        this.label = label;
        this.timestamp = Date.now();
        this.affectedNodeIds = [panelId];
    }

    execute(document: ProjectDocument): void {
        this._update(document, this.newParams);
    }

    undo(document: ProjectDocument): void {
        this._update(document, this.oldParams);
    }

    private _update(document: ProjectDocument, params: any): void {
        const node = document.findNode(this.panelId);
        if (!node || !node.domainData) return;
        const panel = node.domainData as PanelLike;
        const feat = (panel.features || []).find((f: any) => f.id === this.featureId);
        if (feat) {
            Object.assign(feat, JSON.parse(JSON.stringify(params)));
        }
        document.emitChange('features', [this.panelId]);
    }
}
