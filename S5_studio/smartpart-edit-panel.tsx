/**
 * A5_smartparts — smartpart-edit-panel.tsx
 * Panel edycji SMARTPART w oknie pływającym (PPM „Edytuj”).
 *
 *  - smartpart_custom na formatce → updateCustomSmartPartParams
 *  - grupa zawieszek ze Studio → updateHangerSmartPartParams
 */

import React, { useMemo, useState, useEffect } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartPartParamPanel } from './smartpart-param-panel.js';
import {
    initialSmartPartParamValues,
    type SmartPartParamValues,
    type SmartPartPackageDefinition,
    isCustomSmartPartModel,
    isHangerSmartPartGroup,
    updateCustomSmartPartParams,
} from './index.js';
import { updateHangerSmartPartParams } from '../A2_bloki/hangers/hanger-apply.js';
import '../A2_bloki/01_smartparts-ui.css';

function resolveEditContainer(container: any, doc: any): any {
    if (!container) return null;
    // PPM na Part_… → weź grupę SmartParts_* z parameters
    if (container.role === 'SMARTPART_HANGER' || container.generatorParams?.type === 'smartpart_hanger') {
        const groupId = container.generatorParams?.groupId;
        if (groupId && doc) {
            const groupNode = doc.findNode(groupId);
            if (groupNode?.domainData) return groupNode.domainData;
        }
        // fallback: rodzic w drzewie
        const node = doc?.findNode?.(container.id);
        const parent = node?.parent?.domainData;
        if (parent && isHangerSmartPartGroup(parent)) return parent;
    }
    return container;
}

export function SmartPartEditPanel({ container }: { container: any }): React.JSX.Element | null {
    const doc = ContextManager.instance.document;
    const editTarget = resolveEditContainer(container, doc);
    const gp = editTarget?.generatorParams || {};
    const definition = (gp.sourceDefinition || gp.definition) as SmartPartPackageDefinition | undefined;
    const parameters = definition?.parameters ?? [];
    const isCustom = isCustomSmartPartModel(editTarget);

    const initialValues = useMemo((): SmartPartParamValues => {
        if (!definition) return {};
        // Geometria (offset z Parta), potem zapisane paramValues z wstawienia/edycji
        return {
            ...initialSmartPartParamValues(definition),
            ...(gp.paramValues || {}),
        };
    }, [editTarget?.id, definition?.id, gp.paramValues]);

    const [values, setValues] = useState<SmartPartParamValues>(initialValues);

    useEffect(() => {
        setValues(initialValues);
    }, [initialValues]);

    if (!isCustom) return null;

    if (!definition || parameters.length === 0) {
        return (
            <div className="smartparts-edit-empty" style={{ opacity: 0.7, padding: '4px 0' }}>
                Ten SmartPart nie ma parametrów panelu.
            </div>
        );
    }

    const onChange = (next: SmartPartParamValues) => {
        setValues(next);
        const document = ContextManager.instance.document;
        if (!document || !editTarget) return;
        if (isHangerSmartPartGroup(editTarget)) {
            updateHangerSmartPartParams(document, editTarget, next);
        } else {
            updateCustomSmartPartParams(document, editTarget, next);
            if (typeof window !== 'undefined' && typeof (window as any).__rebuildGeometry === 'function') {
                (window as any).__rebuildGeometry('SmartPart param');
            }
        }
        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
        }
        ContextManager.instance.viewport?.requestRender?.(2);
    };

    return (
        <SmartPartParamPanel
            parameters={parameters}
            values={values}
            onChange={onChange}
        />
    );
}
