import type { Command } from '../A1_core/commands/command.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { updateCustomSmartPartParams } from './custom-smartpart-apply.js';
import type { SmartPartParamValues } from './smartpart-params.js';

function cloneValues(values: SmartPartParamValues): SmartPartParamValues {
    return { ...values };
}

export class UpdateCustomSmartPartParamsCommand implements Command {
    readonly id: string;
    readonly label = 'Parametry SmartPart';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly _container: any;
    private readonly _before: SmartPartParamValues;
    private readonly _after: SmartPartParamValues;
    private readonly _rebuildGeometry?: () => void;

    constructor(
        container: any,
        before: SmartPartParamValues,
        after: SmartPartParamValues,
        rebuildGeometry?: () => void,
    ) {
        this.id = `cmd_smartpart_params_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.timestamp = Date.now();
        this._container = container;
        this._before = cloneValues(before);
        this._after = cloneValues(after);
        this._rebuildGeometry = rebuildGeometry;
        const targetPanelId = container.generatorParams?.targetPanelId;
        this.affectedNodeIds = [container.id, ...(targetPanelId ? [targetPanelId] : [])];
    }

    execute(document: ProjectDocument): void {
        this._apply(document, this._after);
    }

    undo(document: ProjectDocument): void {
        this._apply(document, this._before);
    }

    redo(document: ProjectDocument): void {
        this._apply(document, this._after);
    }

    private _apply(document: ProjectDocument, values: SmartPartParamValues): void {
        document.transaction(() => {
            if (!updateCustomSmartPartParams(document, this._container, cloneValues(values))) {
                throw new Error(`UpdateCustomSmartPartParamsCommand: failed to update SmartPart "${this._container.id}".`);
            }
            this._rebuildGeometry?.();
            document.afterCommit(() => {
                if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
                    window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
                    window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
                }
            });
        });
    }
}
