/**
 * SmartParts Studio — osobne okno (jak CNC / nesting), entry studio.html.
 * Layout CAD: PasekMenu | DrzewoObiektow | BelkaWidokowa | PanelEdycji | #renderCanvas
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './smartpart-studio.css';
import type {
    SmartPartPackageDefinition,
    SmartPartBodyItem,
    SmartPartCut,
    SmartPartHoleCut,
    SmartPartPocketCut,
    CutAxis,
    XRefWall,
    YRefWall,
    ZRefWall,
    SmartPartTargetType,
    SmartPartSetItem,
} from './smartpart-studio-types.js';
import {
    calculateCutProtrusion,
    computeAbsoluteFromReference,
    computeReferenceFromAbsolute,
    cutOrientFromRefs,
    cutsOwnedByLiveParts,
    ensurePackageSets,
    findPartForCut,
    holeOutwardDirectionForRef,
    orphanSmartPartCuts,
    partDimsAsMain,
} from './smartpart-studio-types.js';
import {
    SmartPartStudioScene,
    TransformToolMode,
    TransformUpdateEvent,
} from './smartpart-studio-scene.js';
import { ContextMenu } from '../A1_core/context-menu.js';
import { copyObjectLink } from './smartpart-object-link-clipboard.js';
import { tx } from '../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src/src_tekst.json';
import {
    listSmartPartPackages,
    saveSmartPartPackage,
    exportSmartPartPackageJson,
    exportSmartPartIconPng,
    importSmartPartPackageJson,
    createEmptySmartPartPackage,
    DEFAULT_HANGER_SMARTPART,
    allocSmartPartPackageId,
    allocSmartPartSetId,
    allocSmartPartBodyId,
    allocSmartPartCutId,
} from './smartpart-custom-store.js';
import {
    defaultSmartPartParamValues,
    getBinding,
    getPartFieldBinding,
    resolveSmartPartParams,
    applyFrozenBindings,
    removeBinding,
    removePartFieldBinding,
    type SmartPartParamValues,
} from './smartpart-params.js';
import type { SmartPartBindingField } from './smartpart-studio-types.js';
import { StudioPanelTab } from './studio-panel-tab.js';
import {
    getDrivingParameterClipboard,
    copyDrivingParameter,
    subscribeDrivingParameterClipboard,
} from './smartpart-driver-clipboard.js';
import {
    installModulePageLifecycle,
    readModuleSession,
    returnToCad,
} from '../src/module-data/session.js';
import type { SmartPartsModulePayload } from '../src/module-data/types.js';
import { useUiRegionEdgeHint } from '../src/use-ui-region-edge-hint.js';
import { usePanelWidths } from '../src/hooks/use-panel-widths.js';
import { BelkaWidokowa } from '../src/BelkaWidokowa.js';
import { ViewCube } from '../src/ViewCube.js';
import { DrzewoObiektow } from '../src/DrzewoObiektow.js';
import { PanelEdycji } from '../src/PanelEdycji.js';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

installModulePageLifecycle('smartparts');

/** Ikony PPM jak w drzewie CAD (tree-context-menu). */
const CTX_ICONS = {
    rename: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    clone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
};

const studioTreeMenu = new ContextMenu();

function resolveInitialDefinition(): SmartPartPackageDefinition {
    return ensurePackageSets(createEmptySmartPartPackage('SmartPart Kontener 1'));
}

// ─── Ikony SVG identyczne jak w SceneTree.tsx ───
const TREE_ICONS = {
    project: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
    ),
    packageSet: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
    ),
    part: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        </svg>
    ),
    opsFolder: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    ),
    tool: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
    ),
    chevronDown: (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}>
            <path d="M6 9l6 6 6-6"></path>
        </svg>
    ),
    chevronRight: (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}>
            <path d="M9 5l7 7-7 7"></path>
        </svg>
    ),
    trash: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    ),
    eyeShow: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    ),
    eyeHide: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
    ),
    link: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    ),
};

type SelectionTarget = 'main_container' | string;

export function StudioApp(): React.JSX.Element {
    const uiRegionHint = useUiRegionEdgeHint();
    const {
        treeWidth,
        editPanelWidth,
        isDraggingTree,
        isDraggingEdit,
        startResizeTree,
        startResizeEdit,
    } = usePanelWidths();
    const [currentDef, setCurrentDef] = useState<SmartPartPackageDefinition>(() => resolveInitialDefinition());

    const [selectedId, setSelectedId] = useState<SelectionTarget>('main_container');
    const [studioTab, setStudioTab] = useState<'props' | 'panel'>('props');
    const [drivingClipboard, setDrivingClipboard] = useState(() => getDrivingParameterClipboard());
    const [previewParamValues, setPreviewParamValues] = useState<SmartPartParamValues>(() =>
        defaultSmartPartParamValues(resolveInitialDefinition())
    );

    useEffect(() => subscribeDrivingParameterClipboard(() => {
        setDrivingClipboard(getDrivingParameterClipboard());
    }), []);
    const [transformTool, setTransformTool] = useState<TransformToolMode>('select');
    const [isOrtho, setIsOrtho] = useState<boolean>(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [renderMode, setRenderMode] = useState<'shaded' | 'edges' | 'wireframe' | 'xray'>('shaded');
    const [projection, setProjection] = useState<'ortho' | 'perspective'>('perspective');
    const [gridVisible, setGridVisible] = useState(true);
    const [lcsVisible, setLcsVisible] = useState(true);
    const [isPanActive, setIsPanActive] = useState(false);
    const [isZoomWindowActive, setIsZoomWindowActive] = useState(false);
    const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
    const [viewMenuOpen, setViewMenuOpen] = useState(false);
    const [projMenuOpen, setProjMenuOpen] = useState(false);
    const [infoMenuOpen, setInfoMenuOpen] = useState(false);
    const viewMenuRef = useRef<HTMLDivElement | null>(null);

    const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
    const [editingNode, setEditingNode] = useState<{ type: 'package' | 'set' | 'part' | 'cut'; id: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const isCollapsed = (id: string, defaultCollapsed = false) =>
        collapsedIds[id] !== undefined ? collapsedIds[id] : defaultCollapsed;
    const toggleCollapse = (id: string, e?: React.MouseEvent, defaultCollapsed = false) => {
        e?.stopPropagation();
        setCollapsedIds((prev) => {
            const cur = prev[id] !== undefined ? prev[id] : defaultCollapsed;
            return { ...prev, [id]: !cur };
        });
    };

    const startRename = (type: 'package' | 'set' | 'part' | 'cut', id: string, currentName: string) => {
        setEditingNode({ type, id });
        setEditValue(currentName || '');
    };

    const finishRename = (save: boolean) => {
        if (!editingNode) return;
        const name = editValue.trim();
        if (save && name) {
            if (editingNode.type === 'package') {
                setCurrentDef((prev) => ({ ...prev, name }));
            } else if (editingNode.type === 'set') {
                setCurrentDef((prev) => ({
                    ...prev,
                    sets: (prev.sets || []).map((s) => (s.id === editingNode.id ? { ...s, name } : s)),
                }));
            } else if (editingNode.type === 'part') {
                setCurrentDef((prev) => ({
                    ...prev,
                    parts: prev.parts.map((p) => (p.id === editingNode.id ? { ...p, name } : p)),
                }));
            } else if (editingNode.type === 'cut') {
                setCurrentDef((prev) => ({
                    ...prev,
                    cuts: prev.cuts.map((c) => (c.id === editingNode.id ? { ...c, name } : c)),
                }));
            }
        }
        setEditingNode(null);
        setEditValue('');
    };

    const copyParamId = (type: 'part' | 'cut', id: string, name: string) => {
        copyObjectLink({
            targetType: type === 'part' ? 'PART' : 'CUT',
            targetId: id,
            label: name,
        });
        setStudioTab('panel');
    };

    // ─── Operacje na Zestawach (Sets) ───
    const handleAddSet = () => {
        const sets = currentDef.sets || [];
        const num = sets.length + 1;
        const newSetId = allocSmartPartSetId(currentDef.id, `set_${num}`);
        const newSet: SmartPartSetItem = {
            id: newSetId,
            name: `Zestaw ${num}`,
            visible: true,
        };
        setCurrentDef((prev) => ({
            ...prev,
            sets: [...(prev.sets || []), newSet],
        }));
        setSelectedId(newSetId);
        setCollapsedIds((prev) => ({ ...prev, main_container: false, [newSetId]: false }));
    };

    const handleCloneSet = (sourceSetId: string) => {
        const sets = currentDef.sets || [];
        const sourceSet = sets.find((s) => s.id === sourceSetId);
        if (!sourceSet) return;
        const num = sets.length + 1;
        const newSetId = allocSmartPartSetId(currentDef.id, `set_${num}`);
        const newSet: SmartPartSetItem = {
            id: newSetId,
            name: `${sourceSet.name} (Kopia)`,
            visible: true,
        };
        const sourceParts = currentDef.parts.filter((p) => p.setId === sourceSetId);
        const partIdMap = new Map<string, string>();
        const clonedParts: SmartPartBodyItem[] = sourceParts.map((p, idx) => {
            const newPartId = allocSmartPartBodyId(currentDef.id, `part_${Date.now()}_${idx}`);
            partIdMap.set(p.id, newPartId);
            return {
                ...p,
                id: newPartId,
                setId: newSetId,
                name: `${p.name} (Kopia)`,
            };
        });
        const clonedCuts: SmartPartCut[] = [];
        currentDef.cuts.forEach((c, idx) => {
            if (c.partId && partIdMap.has(c.partId)) {
                const newPartId = partIdMap.get(c.partId)!;
                const newCutId = allocSmartPartCutId(currentDef.id, `cut_${Date.now()}_${idx}`);
                clonedCuts.push({
                    ...c,
                    id: newCutId,
                    partId: newPartId,
                } as any);
            }
        });
        setCurrentDef((prev) => ({
            ...prev,
            sets: [...(prev.sets || []), newSet],
            parts: [...prev.parts, ...clonedParts],
            cuts: [...prev.cuts, ...clonedCuts],
        }));
        setSelectedId(newSetId);
    };

    const handleDeleteSet = (setId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const sets = currentDef.sets || [];
        if (sets.length <= 1) {
            alert('Pakiet musi zawierać przynajmniej jeden zestaw.');
            return;
        }
        const updatedSets = sets.filter((s) => s.id !== setId);
        const partsToDelete = new Set(currentDef.parts.filter((p) => p.setId === setId).map((p) => p.id));
        const updatedParts = currentDef.parts.filter((p) => !partsToDelete.has(p.id));
        const updatedCuts = currentDef.cuts.filter((c) => !c.partId || !partsToDelete.has(c.partId));
        setCurrentDef((prev) => ({
            ...prev,
            sets: updatedSets,
            parts: updatedParts,
            cuts: updatedCuts,
        }));
        if (selectedId === setId || partsToDelete.has(selectedId)) {
            setSelectedId('main_container');
        }
    };

    const handleToggleSetVisibility = (setId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentDef((prev) => ({
            ...prev,
            sets: (prev.sets || []).map((s) =>
                s.id === setId ? { ...s, visible: s.visible === false } : s
            ),
        }));
    };

    // ─── Operacje na Parts ───
    const handleAddPart = (targetSetId?: string) => {
        const sets = currentDef.sets || [];
        const activeSetId = targetSetId || sets[0]?.id || 'set_1';
        const num = currentDef.parts.length + 1;
        const newPart: SmartPartBodyItem = {
            id: allocSmartPartBodyId(currentDef.id, `part_${num}`),
            setId: activeSetId,
            name: `Part ${num}`,
            widthMm: 18,
            heightMm: 38,
            depthMm: 68,
            xMm: 0,
            yMm: 0,
            zMm: 0,
            refX: 'CENTER',
            offsetX_mm: 0,
            refY: 'CENTER',
            offsetY_mm: 0,
            refZ: 'CENTER',
            offsetZ_mm: 0,
            colorHex: num % 2 === 0 ? '#10b981' : '#38bdf8',
        };
        setCurrentDef((prev) => ({
            ...prev,
            parts: [...prev.parts, newPart],
        }));
        setSelectedId(newPart.id);
        setCollapsedIds((prev) => ({
            ...prev,
            main_container: false,
            [activeSetId]: false,
            [newPart.id]: false,
        }));
    };

    const handleClonePart = (partId: string) => {
        const sourcePart = currentDef.parts.find((p) => p.id === partId);
        if (!sourcePart) return;
        const num = currentDef.parts.length + 1;
        const newPartId = allocSmartPartBodyId(currentDef.id, `part_${num}`);
        const clonedPart: SmartPartBodyItem = {
            ...sourcePart,
            id: newPartId,
            name: `${sourcePart.name} (Kopia)`,
        };
        const sourceCuts = currentDef.cuts.filter((c) => c.partId === partId);
        const clonedCuts: SmartPartCut[] = sourceCuts.map((c, idx) => ({
            ...c,
            id: allocSmartPartCutId(currentDef.id, `cut_${Date.now()}_${idx}`),
            partId: newPartId,
        } as any));
        setCurrentDef((prev) => ({
            ...prev,
            parts: [...prev.parts, clonedPart],
            cuts: [...prev.cuts, ...clonedCuts],
        }));
        setSelectedId(newPartId);
    };

    const handleDeletePart = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const updatedParts = currentDef.parts.filter((p) => p.id !== id);
        const updatedCuts = currentDef.cuts.filter((c) => c.partId !== id);
        setCurrentDef((prev) => ({ ...prev, parts: updatedParts, cuts: updatedCuts }));
        if (selectedId === id || currentDef.cuts.some((c) => c.id === selectedId && c.partId === id)) {
            setSelectedId('main_container');
        }
    };

    const handleTogglePartVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentDef((prev) => ({
            ...prev,
            parts: prev.parts.map((p) =>
                p.id === id ? { ...p, visible: p.visible === false } : p
            ),
        }));
    };

    const handleToggleCutVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentDef((prev) => ({
            ...prev,
            cuts: prev.cuts.map((c) =>
                c.id === id ? { ...c, visible: c.visible === false } : c
            ),
        }));
    };

    const handleDeleteCut = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentDef((prev) => ({
            ...prev,
            cuts: prev.cuts.filter((c) => c.id !== id),
        }));
        if (selectedId === id) {
            setSelectedId('main_container');
        }
    };

    /** PPM drzewa — jak w SceneTree / tree-context-menu (Zmień nazwę, Usuń, Dodaj, Klonuj). */
    const openStudioTreeContextMenu = (
        e: React.MouseEvent,
        opts: {
            type: 'package' | 'set' | 'part' | 'cut';
            id: string;
            name: string;
            canDelete?: boolean;
        },
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedId(opts.type === 'package' ? 'main_container' : opts.id);

        const items: any[] = [
            {
                section: 'Obiekt',
                toolbar: [
                    {
                        label: 'Zmień nazwę',
                        caption: 'Nazwa',
                        icon: CTX_ICONS.rename,
                        action: 'rename',
                    },
                ],
            },
        ];

        if (opts.type === 'package') {
            items.push({
                label: 'Dodaj zestaw',
                icon: CTX_ICONS.add,
                action: 'add-set',
            });
        } else if (opts.type === 'set') {
            items.push({
                label: 'Dodaj część (Part)',
                icon: CTX_ICONS.add,
                action: 'add-part',
            });
            items.push({
                label: 'Klonuj zestaw',
                icon: CTX_ICONS.clone,
                action: 'clone-set',
            });
        } else if (opts.type === 'part') {
            items.push({
                label: 'Klonuj część',
                icon: CTX_ICONS.clone,
                action: 'clone-part',
            });
            items.push({
                label: 'Kopiuj parametr ID',
                icon: CTX_ICONS.link,
                action: 'copy-param-id',
            });
        } else if (opts.type === 'cut') {
            items.push({
                label: 'Kopiuj parametr ID',
                icon: CTX_ICONS.link,
                action: 'copy-param-id',
            });
        }

        if (opts.canDelete) {
            items.push({ separator: true });
            items.push({
                label: 'Usuń',
                icon: CTX_ICONS.trash,
                action: 'delete',
            });
        }

        studioTreeMenu.onAction((action: string) => {
            if (action === 'rename') {
                startRename(opts.type, opts.id, opts.name);
            } else if (action === 'add-set') {
                handleAddSet();
            } else if (action === 'add-part') {
                handleAddPart(opts.id);
            } else if (action === 'clone-set') {
                handleCloneSet(opts.id);
            } else if (action === 'clone-part') {
                handleClonePart(opts.id);
            } else if (action === 'copy-param-id') {
                if (opts.type === 'part' || opts.type === 'cut') {
                    copyParamId(opts.type, opts.id, opts.name);
                }
            } else if (action === 'delete') {
                if (opts.type === 'set') handleDeleteSet(opts.id);
                else if (opts.type === 'part') handleDeletePart(opts.id);
                else if (opts.type === 'cut') handleDeleteCut(opts.id);
            }
        });
        studioTreeMenu.show(e.clientX, e.clientY, items);
    };

    const resolveOwnerPartId = (): string => {
        if (currentDef.parts.some((p) => p.id === selectedId)) return selectedId;
        const cut = currentDef.cuts.find((c) => c.id === selectedId);
        if (cut?.partId && currentDef.parts.some((p) => p.id === cut.partId)) return cut.partId;
        return currentDef.parts[0]?.id || '';
    };

    const cutsForPart = (partId: string, partIndex: number) =>
        currentDef.cuts.filter((c) => {
            if (c.partId) return c.partId === partId;
            // multi-part: bez partId nie wieszaj pod Part1 (jak w hanger-apply)
            return currentDef.parts.length <= 1 && partIndex === 0;
        });

    /** Cuts z złym/brakującym partId — niewidoczne pod Partami, ale siedziały w JSON. */
    const orphanCuts = useMemo(() => orphanSmartPartCuts(currentDef), [currentDef]);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneRef = useRef<SmartPartStudioScene | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const callAPI = useCallback((method: string, ...args: any[]) => {
        const scene = sceneRef.current;
        if (!scene) return;
        switch (method) {
            case 'setRenderMode':
                scene.setRenderMode(String(args[0] || 'shaded'));
                break;
            case 'toggleGrid':
                // Stan React ustawia Belka (jak w App); tu tylko sync sceny do nowego stanu.
                scene.setGridVisible(!gridVisible);
                break;
            case 'setLcsVisible':
                setLcsVisible(Boolean(args[0]));
                scene.setLcsVisible(Boolean(args[0]));
                break;
            case 'toggleProjection': {
                const ortho = scene.toggleProjection();
                setIsOrtho(ortho);
                setProjection(ortho ? 'ortho' : 'perspective');
                break;
            }
            case 'setView':
                scene.setView(String(args[0] || 'front'));
                break;
            default:
                break;
        }
    }, [gridVisible]);

    const togglePanMode = useCallback(() => {
        const next = sceneRef.current?.togglePanTool() ?? !isPanActive;
        setIsPanActive(next);
        if (next) {
            // Pan wyłącza tryb przesuwania obiektu (jak w CAD: osobne narzędzia)
            setTransformTool('select');
            sceneRef.current?.setTransformTool('select');
        }
    }, [isPanActive]);

    const toggleZoomWindowMode = useCallback(() => {
        setIsZoomWindowActive((v) => !v);
    }, []);

    // Aktualizacja pozycji po przeciągnięciu gizmem — wyliczamy offsety od wybranej ściany referencyjnej
    const handleGizmoTransform = useCallback((targetId: string, transform: TransformUpdateEvent) => {
        setCurrentDef((prev) => {
            const partIdx = prev.parts.findIndex((p) => p.id === targetId);
            if (partIdx >= 0) {
                const p = prev.parts[partIdx];
                const rel = computeReferenceFromAbsolute(
                    prev.mainContainer,
                    transform.xMm,
                    transform.yMm,
                    transform.zMm,
                    p.refX || 'CENTER',
                    p.refY || 'CENTER',
                    p.refZ || 'CENTER'
                );
                const updatedParts = [...prev.parts];
                updatedParts[partIdx] = {
                    ...p,
                    xMm: transform.xMm,
                    yMm: transform.yMm,
                    zMm: transform.zMm,
                    offsetX_mm: rel.offsetX_mm,
                    offsetY_mm: rel.offsetY_mm,
                    offsetZ_mm: rel.offsetZ_mm,
                };
                return { ...prev, parts: updatedParts };
            }

            const cutIdx = prev.cuts.findIndex((c) => c.id === targetId);
            if (cutIdx >= 0) {
                const c = prev.cuts[cutIdx];
                const part = findPartForCut(prev, c);
                const dims = part ? partDimsAsMain(part) : prev.mainContainer;
                const rel = computeReferenceFromAbsolute(
                    dims,
                    transform.xMm,
                    transform.yMm,
                    transform.zMm,
                    c.refX || 'CENTER',
                    c.refY || 'CENTER',
                    c.refZ || 'CENTER'
                );
                const updatedCuts = [...prev.cuts];
                updatedCuts[cutIdx] = {
                    ...c,
                    xMm: transform.xMm,
                    yMm: transform.yMm,
                    zMm: transform.zMm,
                    offsetX_mm: rel.offsetX_mm,
                    offsetY_mm: rel.offsetY_mm,
                    offsetZ_mm: rel.offsetZ_mm,
                };
                return { ...prev, cuts: updatedCuts, cutsFrame: 'PART' };
            }

            return prev;
        });
    }, []);

    // Inicjalizacja sceny 3D
    useEffect(() => {
        if (!canvasRef.current) return;

        const studioScene = new SmartPartStudioScene(
            canvasRef.current,
            (clickedId) => {
                setSelectedId(clickedId);
            },
            handleGizmoTransform
        );

        sceneRef.current = studioScene;
        studioScene.updateDefinition(currentDef, selectedId);

        return () => {
            studioScene.dispose();
            sceneRef.current = null;
        };
    }, [handleGizmoTransform]);

    // Definicja do sceny = resolve parametrów (podgląd panelu przestawia Partsy / Zamroź)
    const displayDef = useMemo(() => {
        if (!(currentDef.bindings?.length)) return currentDef;
        try {
            return resolveSmartPartParams(currentDef, previewParamValues);
        } catch (err) {
            console.warn('[Studio] resolveSmartPartParams:', err);
            // Geometria może paść — zamrażanie z check i tak aplikuj
            return applyFrozenBindings(currentDef, previewParamValues);
        }
    }, [currentDef, previewParamValues]);

    // Aktualizacja definicji w scenie
    useEffect(() => {
        if (sceneRef.current) {
            sceneRef.current.updateDefinition(displayDef, selectedId);
        }
    }, [displayDef, selectedId]);

    // Po wczytaniu / nowym pakiecie — zsynchronizuj wartości podglądu z defaultami
    useEffect(() => {
        setPreviewParamValues(defaultSmartPartParamValues(currentDef));
    }, [currentDef.id]);

    // Zmiana aktywnego narzędzia transformacji (G / R jak w CAD)
    const handleChangeTransformTool = (tool: TransformToolMode) => {
        setTransformTool(tool);
        sceneRef.current?.setTransformTool(tool);
        if ((tool === 'translate' || tool === 'rotate') && isPanActive) {
            sceneRef.current?.setPanToolActive(false);
            setIsPanActive(false);
        }
    };

    // Skróty jak w CAD: G = Przesuń, R = Obróć (toggle)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const key = e.key.toLowerCase();
            if (key === 'g') {
                handleChangeTransformTool(
                    sceneRef.current?.getTransformTool() === 'translate' ? 'select' : 'translate'
                );
            }
            if (key === 'r') {
                handleChangeTransformTool(
                    sceneRef.current?.getTransformTool() === 'rotate' ? 'select' : 'rotate'
                );
            }
            if (key === '1') sceneRef.current?.setViewPreset('ISO');
            if (key === '2') sceneRef.current?.setViewPreset('TOP');
            if (key === '3') sceneRef.current?.setViewPreset('FRONT');
            if (key === '4') sceneRef.current?.setViewPreset('SIDE');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPanActive]);

    // Zmiana wymiarów Kontenera Głównego — zachowujemy stałe odległości od ścian referencyjnych!
    const handleUpdateMainContainer = (field: 'widthMm' | 'heightMm' | 'depthMm', val: number) => {
        const updatedMain = {
            ...currentDef.mainContainer,
            [field]: Math.max(1, val),
        };

        const updatedParts = currentDef.parts.map((p) => {
            const abs = computeAbsoluteFromReference(
                updatedMain,
                p.refX || 'CENTER',
                p.offsetX_mm ?? p.xMm,
                p.refY || 'CENTER',
                p.offsetY_mm ?? p.yMm,
                p.refZ || 'CENTER',
                p.offsetZ_mm ?? p.zMm
            );
            return { ...p, xMm: abs.xMm, yMm: abs.yMm, zMm: abs.zMm };
        });

        // Cięcia są w LCS Parta — przy zmianie kontenera głównego nie przeliczamy ich
        setCurrentDef({
            ...currentDef,
            mainContainer: updatedMain,
            parts: updatedParts,
            cutsFrame: 'PART',
        });
    };

    // Tworzenie nowego pakietu (pusty, czysty SmartPart)
    const handleNewPackage = () => {
        const name = `SmartPart_${listSmartPartPackages().length + 1}`;
        const newPkg = createEmptySmartPartPackage(name);
        setCurrentDef(newPkg);
        setSelectedId('main_container');
        setFeedback('Utworzono nowy czysty SmartPart.');
        setTimeout(() => setFeedback(null), 2500);
    };

    // Zapis pakietu do katalogu i bezpośrednie pobranie pliku JSON do Downloads
    const handleSave = () => {
        const iconDataUrl = sceneRef.current?.captureThumbnail();
        const safeName = (currentDef.name || 'SmartPart').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const targetId = currentDef.name && (!currentDef.id || !currentDef.id.includes(safeName))
            ? allocSmartPartPackageId(safeName)
            : currentDef.id;
        // JSON = drzewo: tylko cuts z żywym partId (orphany z złym id nie idą do pliku)
        const toSave: SmartPartPackageDefinition = {
            ...currentDef,
            id: targetId,
            cuts: cutsOwnedByLiveParts(currentDef),
            units: 'mm',
            version: '1.0',
            coordSystem: 'CAD',
            partBody: currentDef.parts?.[0] ? { ...currentDef.parts[0] } : currentDef.partBody,
            iconDataUrl: iconDataUrl || currentDef.iconDataUrl,
            updatedAt: Date.now(),
        };
        saveSmartPartPackage(toSave);
        setCurrentDef(toSave);

        // Bezpośrednio pobieramy plik .json do folderu Pobrane (Downloads)
        exportSmartPartPackageJson(toSave);

        // Oraz pobieramy ikonę .png o dokładnie tej samej nazwie bazowej
        if (iconDataUrl) {
            setTimeout(() => {
                exportSmartPartIconPng(iconDataUrl, toSave.name || toSave.id);
            }, 180);
        }

        const safeBase = (toSave.name || toSave.id || 'smartpart').trim().replace(/[^a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF-]/g, '_');
        setFeedback(`Pobrano komplet: "${safeBase}.json" i "${safeBase}.png"!`);
        setTimeout(() => setFeedback(null), 3500);
    };

    // Ręczne pobranie pliku JSON
    const handleExportJson = () => {
        const safeName = (currentDef.name || 'SmartPart').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const targetId = currentDef.name && (!currentDef.id || !currentDef.id.includes(safeName))
            ? allocSmartPartPackageId(safeName)
            : currentDef.id;
        exportSmartPartPackageJson({
            ...currentDef,
            id: targetId,
            cuts: cutsOwnedByLiveParts(currentDef),
            units: 'mm',
            version: '1.0',
            coordSystem: 'CAD',
            partBody: currentDef.parts?.[0] ? { ...currentDef.parts[0] } : currentDef.partBody,
        });
        setFeedback(`Pobrano "${currentDef.name}.json" do Pobranych.`);
        setTimeout(() => setFeedback(null), 2500);
    };

    // Eksport ikony PNG
    const handleExportIcon = () => {
        const iconUrl = sceneRef.current?.captureThumbnail();
        if (iconUrl) {
            exportSmartPartIconPng(iconUrl, currentDef.name || 'smartpart');
            setFeedback('Pobrano ikonę PNG do Pobranych.');
            setTimeout(() => setFeedback(null), 2500);
        }
    };

    // Wczytanie z pliku JSON
    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = String(event.target?.result || '');
                const imported = importSmartPartPackageJson(text);
                setCurrentDef(imported);
                setSelectedId('main_container');
                setFeedback(`Zaimportowano "${imported.name}".`);
                setTimeout(() => setFeedback(null), 3000);
            } catch (err: any) {
                alert(`Błąd importu: ${err.message}`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };


    // Zmiana ściany referencyjnej lub offsetu dla Parta
    const handleUpdatePartRef = (
        id: string,
        axis: 'X' | 'Y' | 'Z',
        newRef: string,
        newOffset?: number
    ) => {
        setCurrentDef((prev) => {
            const part = prev.parts.find((p) => p.id === id);
            if (!part) return prev;

            const refX = axis === 'X' ? (newRef as XRefWall) : (part.refX || 'CENTER');
            const refY = axis === 'Y' ? (newRef as YRefWall) : (part.refY || 'CENTER');
            const refZ = axis === 'Z' ? (newRef as ZRefWall) : (part.refZ || 'CENTER');

            let offX = part.offsetX_mm ?? part.xMm ?? 0;
            let offY = part.offsetY_mm ?? part.yMm ?? 0;
            let offZ = part.offsetZ_mm ?? part.zMm ?? 0;
            let xMm = part.xMm ?? 0;
            let yMm = part.yMm ?? 0;
            let zMm = part.zMm ?? 0;

            if (newOffset !== undefined) {
                // Użytkownik ręcznie wpisał nowy offset w inpucie
                if (axis === 'X') offX = newOffset;
                if (axis === 'Y') offY = newOffset;
                if (axis === 'Z') offZ = newOffset;
            }
            // Zmiana ściany referencyjnej (lub offsetu) natychmiast przelicza pozycję bezwzględną w kontenerze
            const abs = computeAbsoluteFromReference(prev.mainContainer, refX, offX, refY, offY, refZ, offZ);
            xMm = abs.xMm;
            yMm = abs.yMm;
            zMm = abs.zMm;

            return {
                ...prev,
                parts: prev.parts.map((p) =>
                    p.id === id
                        ? {
                              ...p,
                              refX,
                              offsetX_mm: offX,
                              refY,
                              offsetY_mm: offY,
                              refZ,
                              offsetZ_mm: offZ,
                              xMm,
                              yMm,
                              zMm,
                          }
                        : p
                ),
            };
        });
    };

    // ─── Operacje na Cięciach ───
    const handleAddHoleCut = () => {
        if (currentDef.parts.length === 0) {
            alert('Najpierw dodaj część (Part), do której ma należeć otwór.');
            return;
        }
        const ownerPartId = resolveOwnerPartId();
        const ownerPart = currentDef.parts.find((p) => p.id === ownerPartId) || currentDef.parts[0];
        const num = currentDef.cuts.filter((c) => c.type === 'HOLE').length + 1;
        const local = computeAbsoluteFromReference(
            ownerPart ? partDimsAsMain(ownerPart) : currentDef.mainContainer,
            'LEFT',
            0,
            'CENTER',
            0,
            'CENTER',
            0,
        );
        const refs = {
            refX: 'LEFT' as const,
            offsetX_mm: 0,
            refY: 'CENTER' as const,
            offsetY_mm: 0,
            refZ: 'CENTER' as const,
            offsetZ_mm: 0,
        };
        const orient = cutOrientFromRefs(refs);
        const newCut: SmartPartHoleCut = {
            id: allocSmartPartCutId(currentDef.id, `walec_${num}`),
            name: `Otwór okrągły ${num}`,
            type: 'HOLE',
            diameterMm: 8,
            lengthMm: 24,
            xMm: local.xMm,
            yMm: local.yMm,
            zMm: local.zMm,
            ...refs,
            ...orient,
            partId: ownerPartId || undefined,
        };
        setCurrentDef({ ...currentDef, cuts: [...currentDef.cuts, newCut], cutsFrame: 'PART' });
        setSelectedId(newCut.id);
        setCollapsedIds((prev) => ({
            ...prev,
            main_container: false,
            ...(ownerPartId ? { [ownerPartId]: false } : {}),
        }));
    };

    const handleAddPocketCut = () => {
        if (currentDef.parts.length === 0) {
            alert('Najpierw dodaj część (Part), do której ma należeć sześcian.');
            return;
        }
        const ownerPartId = resolveOwnerPartId();
        const ownerPart = currentDef.parts.find((p) => p.id === ownerPartId) || currentDef.parts[0];
        const num = currentDef.cuts.filter((c) => c.type === 'POCKET').length + 1;
        const local = computeAbsoluteFromReference(
            ownerPart ? partDimsAsMain(ownerPart) : currentDef.mainContainer,
            'CENTER',
            0,
            'BACK',
            0,
            'CENTER',
            0,
        );
        const refs = {
            refX: 'CENTER' as const,
            offsetX_mm: 0,
            refY: 'BACK' as const,
            offsetY_mm: 0,
            refZ: 'CENTER' as const,
            offsetZ_mm: 0,
        };
        const orient = cutOrientFromRefs(refs);
        const newCut: SmartPartPocketCut = {
            id: allocSmartPartCutId(currentDef.id, `szescian_${num}`),
            name: `Wcięcie prostokątne ${num}`,
            type: 'POCKET',
            widthMm: 16,
            heightMm: 32,
            depthMm: 15,
            xMm: local.xMm,
            yMm: local.yMm,
            zMm: local.zMm,
            ...refs,
            ...orient,
            partId: ownerPartId || undefined,
        };
        setCurrentDef({ ...currentDef, cuts: [...currentDef.cuts, newCut], cutsFrame: 'PART' });
        setSelectedId(newCut.id);
        setCollapsedIds((prev) => ({
            ...prev,
            main_container: false,
            ...(ownerPartId ? { [ownerPartId]: false } : {}),
        }));
    };


    // Zmiana ściany referencyjnej lub offsetu dla Cięcia
    const handleUpdateCutRef = (
        id: string,
        axis: 'X' | 'Y' | 'Z',
        newRef: string,
        newOffset?: number
    ) => {
        setCurrentDef((prev) => {
            const cut = prev.cuts.find((c) => c.id === id);
            if (!cut) return prev;

            const part = findPartForCut(prev, cut);
            const dims = part ? partDimsAsMain(part) : prev.mainContainer;

            const refX = axis === 'X' ? (newRef as XRefWall) : (cut.refX || 'CENTER');
            const refY = axis === 'Y' ? (newRef as YRefWall) : (cut.refY || 'CENTER');
            const refZ = axis === 'Z' ? (newRef as ZRefWall) : (cut.refZ || 'CENTER');

            let offX = cut.offsetX_mm ?? cut.xMm ?? 0;
            let offY = cut.offsetY_mm ?? cut.yMm ?? 0;
            let offZ = cut.offsetZ_mm ?? cut.zMm ?? 0;
            let xMm = cut.xMm ?? 0;
            let yMm = cut.yMm ?? 0;
            let zMm = cut.zMm ?? 0;

            if (newOffset !== undefined) {
                // Użytkownik ręcznie wpisał nowy offset w inpucie
                if (axis === 'X') offX = newOffset;
                if (axis === 'Y') offY = newOffset;
                if (axis === 'Z') offZ = newOffset;
            }
            // Zmiana ściany referencyjnej (lub offsetu) natychmiast przelicza pozycję w LCS parta
            const local = computeAbsoluteFromReference(dims, refX, offX, refY, offY, refZ, offZ);
            xMm = local.xMm;
            yMm = local.yMm;
            zMm = local.zMm;

            // Oś/zwrot tylko z odniesienia (bez osobnych parametrów w UI)
            let orientPatch: { axis: CutAxis; direction: 1 | -1 } | Record<string, never> = {};
            if (newOffset === undefined) {
                if (newRef !== 'CENTER') {
                    const outward = holeOutwardDirectionForRef(axis, refX, refY, refZ);
                    if (outward !== null) orientPatch = { axis, direction: outward };
                } else {
                    orientPatch = cutOrientFromRefs({ refX, refY, refZ });
                }
            }

            return {
                ...prev,
                cutsFrame: 'PART',
                cuts: prev.cuts.map((c) =>
                    c.id === id
                        ? {
                              ...c,
                              refX,
                              offsetX_mm: offX,
                              refY,
                              offsetY_mm: offY,
                              refZ,
                              offsetZ_mm: offZ,
                              xMm,
                              yMm,
                              zMm,
                              ...orientPatch,
                          }
                        : c
                ),
            };
        });
    };

    const handleUpdateCutProp = (id: string, field: string, val: any) => {
        setCurrentDef({
            ...currentDef,
            cuts: currentDef.cuts.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
        });
    };

    const selectedPart = displayDef.parts.find((p) => p.id === selectedId);
    const selectedCut = displayDef.cuts.find((c) => c.id === selectedId);

    /** Jedna ramka HTML na oś (X/Y/Z) — ref + odstęp (+ opcjonalnie wymiar). */
    const renderAxisFrame = (
        axis: 'X' | 'Y' | 'Z',
        title: string,
        children: React.ReactNode,
    ) => (
        <div className={`cad-axis-frame cad-axis-frame--${axis.toLowerCase()}`}>
            <div className="cad-axis-frame-title">{title}</div>
            <div className="cad-axis-frame-body">{children}</div>
        </div>
    );

    /** Kategoria jak w Blenderze: Położenie / Rozmiar. */
    const renderPropCategory = (
        title: string,
        children: React.ReactNode,
        kind?: 'location' | 'size',
    ) => (
        <div className={`cad-prop-category${kind === 'size' ? ' cad-prop-category--size' : ''}`}>
            <div className="cad-prop-category-title">{title}</div>
            <div className="cad-prop-category-body">{children}</div>
        </div>
    );

    const renderDimRow = (axis: 'X' | 'Y' | 'Z', children: React.ReactNode) => (
        <div className={`cad-dim-row cad-dim-row--${axis.toLowerCase()}`}>{children}</div>
    );

    const renderDrivingParamControl = (opts: {
        targetType?: SmartPartTargetType;
        targetId: string;
        partId?: string;
        field: SmartPartBindingField;
        label: string;
        valueMm: number;
        onManualChange: (v: number) => void;
    }) => {
        const targetType = opts.targetType || (opts.partId ? 'PART' : 'MAIN');
        const targetId = opts.targetId || opts.partId || 'main_container';
        const binding = getBinding(currentDef, targetType, targetId, opts.field);
        const linked = binding?.paramKey;
        const linkedParam = linked
            ? (currentDef.parameters ?? []).find((p) => p.key === linked)
            : undefined;
        const isCopied =
            drivingClipboard?.targetType === targetType &&
            drivingClipboard?.targetId === targetId &&
            drivingClipboard?.field === opts.field;
        return (
            <div className="cad-prop-row cad-prop-row--compact">
                <label className="cad-prop-label">{opts.label}</label>
                <div className="cad-prop-value-group">
                    <input
                        type="number"
                        className="cad-prop-input"
                        style={{ opacity: linked ? 0.55 : 1 }}
                        disabled={!!linked}
                        value={opts.valueMm}
                        onChange={(e) => opts.onManualChange(Number(e.target.value) || 0)}
                        title={linked ? `Sterowane: ${linkedParam?.label || linked}` : 'Wartość stała'}
                    />
                    <button
                        type="button"
                        className={`sp-driver-copy-btn sp-driver-copy-btn--icon ${isCopied ? 'is-copied' : ''}`}
                        title="Kopiuj parametr sterujący — potem wklej w Panelu aplikacji"
                        aria-label="Kopiuj parametr"
                        onClick={() => {
                            copyDrivingParameter({
                                targetType,
                                targetId,
                                partId: opts.partId,
                                field: opts.field,
                                label: opts.label,
                                valueMm: opts.valueMm,
                            });
                            setFeedback(`Skopiowano: ${opts.label.replace(/\s*\[mm\]\s*$/i, '')} → wklej w Panelu aplikacji`);
                            setStudioTab('panel');
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                    </button>
                    {linked && (
                        <>
                            <span className="sp-driver-linked" title={linked}>
                                {linkedParam?.label || linked}
                            </span>
                            <button
                                type="button"
                                className="tree-action-btn btn-delete"
                                title="Odłącz parametr sterujący"
                                onClick={() => setCurrentDef((prev) => removeBinding(prev, targetType, targetId, opts.field))}
                            >
                                ✕
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderOffsetBind = (
        partId: string,
        field: SmartPartBindingField,
        label: string,
        valueMm: number,
        onManualChange: (v: number) => void,
    ) => renderDrivingParamControl({
        targetType: 'PART',
        targetId: partId,
        partId,
        field,
        label,
        valueMm,
        onManualChange,
    });

    const renderCutParamBind = (
        cutId: string,
        field: SmartPartBindingField,
        label: string,
        valueMm: number,
        onManualChange: (v: number) => void,
    ) => renderDrivingParamControl({
        targetType: 'CUT',
        targetId: cutId,
        field,
        label,
        valueMm,
        onManualChange,
    });

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            {/* ─── Pasek menu (jak CAD / CNC) ─── */}
            <div id="pasek-menu" className="pasek-menu" aria-label="Pasek menu" data-ui-name="Pasek menu">
                <div className="menu-left" style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 8, flex: 1 }}>
                    <button
                        type="button"
                        className="menu-btn"
                        onClick={() => {
                            try {
                                returnToCad('smartparts');
                            } catch {
                                window.location.href = './index.html';
                            }
                        }}
                        style={{
                            padding: '6px 12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: 'rgba(37, 99, 235, 0.85)',
                            color: '#fff',
                            border: '1px solid rgba(59, 130, 246, 0.5)',
                            borderRadius: 4,
                            cursor: 'pointer',
                        }}
                        title="Wróć do głównego CAD"
                    >
                        ← CAD
                    </button>
                    <div className="menu-brand" style={{ marginLeft: 6 }}>Studio 3D</div>
                    <span style={{ marginLeft: 10, opacity: 0.75, fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentDef.name}>
                        {currentDef.name || 'SmartPart'}
                    </span>

                    {/* Narzędzia 3D jak w głównej aplikacji — tylko G i R */}
                    <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />
                    <div className="topbar-transform-group" title={tx(srcTekst, 'app.tools.transform_title', TX_NS)}>
                        <button
                            type="button"
                            className={`topbar-transform-btn ${transformTool === 'translate' ? 'active' : ''}`}
                            onClick={() => handleChangeTransformTool(
                                transformTool === 'translate' ? 'select' : 'translate'
                            )}
                            title={tx(srcTekst, 'app.tools.move_title', TX_NS)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="5 9 2 12 5 15" />
                                <polyline points="9 5 12 2 15 5" />
                                <polyline points="15 19 12 22 9 19" />
                                <polyline points="19 9 22 12 19 15" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <line x1="12" y1="2" x2="12" y2="22" />
                            </svg>
                            <kbd className="topbar-key-badge">G</kbd>
                            <span>{tx(srcTekst, 'app.tools.move', TX_NS)}</span>
                        </button>
                        <button
                            type="button"
                            className={`topbar-transform-btn ${transformTool === 'rotate' ? 'active' : ''}`}
                            onClick={() => handleChangeTransformTool(
                                transformTool === 'rotate' ? 'select' : 'rotate'
                            )}
                            title={tx(srcTekst, 'app.tools.rotate_title', TX_NS)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                            <kbd className="topbar-key-badge">R</kbd>
                            <span>{tx(srcTekst, 'app.tools.rotate', TX_NS)}</span>
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
                    <button type="button" className="menu-btn" onClick={handleNewPackage}>+ Nowy</button>
                    <button
                        type="button"
                        className="menu-btn"
                        onClick={handleSave}
                        style={{ backgroundColor: 'rgba(2, 132, 199, 0.85)', color: '#fff', border: '1px solid #38bdf8', fontWeight: 700 }}
                    >
                        Zapisz
                    </button>
                    <button type="button" className="menu-btn" onClick={handleExportJson}>JSON</button>
                    <button type="button" className="menu-btn" onClick={handleExportIcon}>PNG</button>
                    <button type="button" className="menu-btn" onClick={() => fileInputRef.current?.click()}>Wczytaj</button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleFileImport}
                    />
                </div>
            </div>

            {feedback && <div className="cad-feedback-toast">{feedback}</div>}

            {/* ─── Belka widokowa (tryb cieniowania, siatka, kamera) ── */}
            <BelkaWidokowa
                renderMode={renderMode}
                projection={projection}
                gridVisible={gridVisible}
                lcsVisible={lcsVisible}
                isPanActive={isPanActive}
                isZoomWindowActive={isZoomWindowActive}
                activeTab="tab-a5-smartparts"
                displayMenuOpen={displayMenuOpen}
                viewMenuOpen={viewMenuOpen}
                projMenuOpen={projMenuOpen}
                infoMenuOpen={infoMenuOpen}
                viewMenuRef={viewMenuRef}
                onDisplayMenuOpenChange={setDisplayMenuOpen}
                onViewMenuOpenChange={setViewMenuOpen}
                onProjMenuOpenChange={setProjMenuOpen}
                onInfoMenuOpenChange={setInfoMenuOpen}
                onRenderModeChange={(m: any) => setRenderMode(m)}
                onToggleGrid={() => {
                    setGridVisible(!gridVisible);
                    callAPI('toggleGrid');
                }}
                onToggleLcs={(nextVal) => {
                    setLcsVisible(nextVal);
                    callAPI('setLcsVisible', nextVal);
                }}
                onProjectionChange={(p: any) => setProjection(p)}
                onTogglePan={togglePanMode}
                onToggleZoomWindow={toggleZoomWindowMode}
                onOpenSSOT={() => {}}
                callAPI={callAPI}
            />

            <ViewCube
                onSetView={(view) => callAPI('setView', view)}
                style={{ right: `${editPanelWidth + 24}px` }}
            />

            <DrzewoObiektow
                treeWidth={treeWidth}
                isDraggingTree={isDraggingTree}
                startResizeTree={startResizeTree}
            >
                        <div className="tree-root">
                            <div className="tree-children">
                                <div
                                    className={`tree-node ${selectedId === 'main_container' ? 'selected' : ''}`}
                                >
                                    <div
                                        className="tree-node-content"
                                        onClick={() => setSelectedId('main_container')}
                                        onContextMenu={(e) => openStudioTreeContextMenu(e, {
                                            type: 'package',
                                            id: currentDef.id,
                                            name: currentDef.name || 'Kontener SmartPart',
                                        })}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            startRename('package', currentDef.id, currentDef.name || 'Kontener SmartPart');
                                        }}
                                    >
                                        <span
                                            className="tree-chevron"
                                            onClick={(e) => toggleCollapse('main_container', e, false)}
                                        >
                                            {isCollapsed('main_container', false)
                                                ? TREE_ICONS.chevronRight
                                                : TREE_ICONS.chevronDown}
                                        </span>
                                        {TREE_ICONS.project}
                                        {editingNode?.type === 'package' ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                className="node-name-input"
                                                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none', minWidth: 120 }}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => finishRename(true)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') finishRename(true);
                                                    if (e.key === 'Escape') finishRename(false);
                                                }}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="node-name-text">
                                                {currentDef.name || 'Kontener SmartPart'}
                                            </span>
                                        )}
                                        <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>
                                            ({currentDef.mainContainer.widthMm}x{currentDef.mainContainer.heightMm}x{currentDef.mainContainer.depthMm})
                                        </span>
                                    </div>
                                    <div className="tree-node-actions">
                                        <button
                                            type="button"
                                            className="tree-action-btn"
                                            title="Dodaj zestaw okuć"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddSet();
                                            }}
                                        >
                                            {TREE_ICONS.packageSet}
                                        </button>
                                    </div>
                                </div>

                                {!isCollapsed('main_container', false) &&
                                    (currentDef.sets || []).map((setItem, setIdx) => {
                                        const setCollapsed = isCollapsed(setItem.id, false);
                                        const setParts = currentDef.parts.filter(
                                            (p) => p.setId === setItem.id || (!p.setId && setIdx === 0)
                                        );
                                        return (
                                            <div key={setItem.id} className="tree-children" style={{ marginLeft: '12px' }}>
                                                <div
                                                    className={`tree-node ${selectedId === setItem.id ? 'selected' : ''}`}
                                                    style={{ opacity: setItem.visible === false ? 0.45 : 1 }}
                                                >
                                                    <div
                                                        className="tree-node-content"
                                                        onClick={() => setSelectedId(setItem.id)}
                                                        onContextMenu={(e) => openStudioTreeContextMenu(e, {
                                                            type: 'set',
                                                            id: setItem.id,
                                                            name: setItem.name || `Zestaw ${setIdx + 1}`,
                                                            canDelete: (currentDef.sets || []).length > 1,
                                                        })}
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            startRename('set', setItem.id, setItem.name || `Zestaw ${setIdx + 1}`);
                                                        }}
                                                    >
                                                        <span
                                                            className="tree-chevron"
                                                            onClick={(e) => toggleCollapse(setItem.id, e, false)}
                                                        >
                                                            {setCollapsed
                                                                ? TREE_ICONS.chevronRight
                                                                : TREE_ICONS.chevronDown}
                                                        </span>
                                                        {TREE_ICONS.packageSet}
                                                        {editingNode?.type === 'set' && editingNode.id === setItem.id ? (
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                className="node-name-input"
                                                                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none', minWidth: 100 }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onBlur={() => finishRename(true)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') finishRename(true);
                                                                    if (e.key === 'Escape') finishRename(false);
                                                                }}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <span className="node-name-text">
                                                                {setItem.name || `Zestaw ${setIdx + 1}`}
                                                            </span>
                                                        )}
                                                        <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>
                                                            ({setParts.length} {setParts.length === 1 ? 'część' : 'części'})
                                                        </span>
                                                    </div>
                                                    <div className="tree-node-actions">
                                                        <button
                                                            type="button"
                                                            className="tree-action-btn"
                                                            title="Dodaj część (Part) do tego zestawu"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddPart(setItem.id);
                                                            }}
                                                        >
                                                            {TREE_ICONS.part}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="tree-action-btn btn-toggle-part-vis"
                                                            title={tx(srcTekst, 'tree.toggle', TX_NS)}
                                                            onClick={(e) => handleToggleSetVisibility(setItem.id, e)}
                                                        >
                                                            {setItem.visible === false ? TREE_ICONS.eyeHide : TREE_ICONS.eyeShow}
                                                        </button>
                                                        {(currentDef.sets || []).length > 1 && (
                                                            <button
                                                                type="button"
                                                                className="tree-action-btn btn-delete"
                                                                title="Usuń zestaw"
                                                                onClick={(e) => handleDeleteSet(setItem.id, e)}
                                                            >
                                                                {TREE_ICONS.trash}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {!setCollapsed &&
                                                    setParts.map((p, idx) => {
                                        const partCuts = cutsForPart(p.id, idx);
                                        const partCollapsed = isCollapsed(p.id, false);
                                        const partFrozen = displayDef.parts.find((x) => x.id === p.id)?.frozen === true;
                                        return (
                                            <div key={p.id} className="tree-children" style={{ marginLeft: '12px' }}>
                                                <div
                                                    className={`tree-node ${selectedId === p.id ? 'selected' : ''}`}
                                                    style={{ opacity: p.visible === false || partFrozen ? 0.45 : 1 }}
                                                    title={partFrozen ? 'Zamrożony (panel Zamroź) — bez wycięć CNC' : undefined}
                                                >
                                                    <div
                                                        className="tree-node-content"
                                                        onClick={() => setSelectedId(p.id)}
                                                        onContextMenu={(e) => openStudioTreeContextMenu(e, {
                                                            type: 'part',
                                                            id: p.id,
                                                            name: p.name || `Part ${idx + 1}`,
                                                            canDelete: currentDef.parts.length > 1,
                                                        })}
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            startRename('part', p.id, p.name || `Part ${idx + 1}`);
                                                        }}
                                                    >
                                                        <span
                                                            className="tree-chevron"
                                                            onClick={(e) => toggleCollapse(p.id, e, false)}
                                                        >
                                                            {partCollapsed
                                                                ? TREE_ICONS.chevronRight
                                                                : TREE_ICONS.chevronDown}
                                                        </span>
                                                        {TREE_ICONS.part}
                                                        {editingNode?.type === 'part' && editingNode.id === p.id ? (
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                className="node-name-input"
                                                                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none', minWidth: 100 }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onBlur={() => finishRename(true)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') finishRename(true);
                                                                    if (e.key === 'Escape') finishRename(false);
                                                                }}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <span className="node-name-text">
                                                                {p.name || `Part ${idx + 1}`}
                                                            </span>
                                                        )}
                                                        <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>
                                                            ({p.widthMm}x{p.heightMm}x{p.depthMm})
                                                        </span>
                                                        {partFrozen && (
                                                            <span style={{ color: '#38bdf8', fontSize: 10, marginLeft: 4, fontWeight: 600 }}>
                                                                zamrożony
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="tree-node-actions">
                                                        <button
                                                            type="button"
                                                            className="tree-action-btn btn-toggle-part-vis"
                                                            title={tx(srcTekst, 'tree.toggle', TX_NS)}
                                                            onClick={(e) => handleTogglePartVisibility(p.id, e)}
                                                        >
                                                            {p.visible === false ? TREE_ICONS.eyeHide : TREE_ICONS.eyeShow}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="tree-action-btn"
                                                            title="Kopiuj parametr ID — potem Wklej parametr ID na Zamroź w Panelu"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyParamId('part', p.id, p.name || `Part ${idx + 1}`);
                                                            }}
                                                        >
                                                            {TREE_ICONS.link}
                                                        </button>
                                                        {currentDef.parts.length > 1 && (
                                                            <button
                                                                type="button"
                                                                className="tree-action-btn btn-delete"
                                                                title="Usuń część"
                                                                onClick={(e) => handleDeletePart(p.id, e)}
                                                            >
                                                                {TREE_ICONS.trash}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {!partCollapsed &&
                                                    partCuts.map((cut) => {
                                                        const prot = calculateCutProtrusion(
                                                            cut,
                                                            currentDef.mainContainer,
                                                            p,
                                                        );
                                                        const maxProt = Math.max(
                                                            prot.leftXMinusMm,
                                                            prot.rightXPlusMm,
                                                            prot.bottomYMinusMm,
                                                            prot.topYPlusMm,
                                                            prot.backZMinusMm,
                                                            prot.frontZPlusMm
                                                        );
                                                        const cutFrozen =
                                                            partFrozen
                                                            || displayDef.cuts.find((x) => x.id === cut.id)?.frozen === true;
                                                        return (
                                                            <div
                                                                key={cut.id}
                                                                className="tree-children"
                                                                style={{ marginLeft: '12px' }}
                                                            >
                                                                <div
                                                                    className={`tree-node ${selectedId === cut.id ? 'selected' : ''}`}
                                                                    style={{
                                                                        opacity:
                                                                            cut.visible === false
                                                                            || p.visible === false
                                                                            || cutFrozen
                                                                                ? 0.45
                                                                                : 1,
                                                                    }}
                                                                    title={cutFrozen ? 'Zamrożone — niewidoczne w Studio / bez CNC' : undefined}
                                                                >
                                                                    <div
                                                                        className="tree-node-content"
                                                                        onClick={() => setSelectedId(cut.id)}
                                                                        onContextMenu={(e) => openStudioTreeContextMenu(e, {
                                                                            type: 'cut',
                                                                            id: cut.id,
                                                                            name: cut.name || 'Cut',
                                                                            canDelete: true,
                                                                        })}
                                                                        onDoubleClick={(e) => {
                                                                            e.stopPropagation();
                                                                            startRename('cut', cut.id, cut.name || 'Cut');
                                                                        }}
                                                                    >
                                                                        {TREE_ICONS.tool}
                                                                        {editingNode?.type === 'cut' && editingNode.id === cut.id ? (
                                                                            <input
                                                                                type="text"
                                                                                value={editValue}
                                                                                className="node-name-input"
                                                                                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none', minWidth: 100 }}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                                onBlur={() => finishRename(true)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') finishRename(true);
                                                                                    if (e.key === 'Escape') finishRename(false);
                                                                                }}
                                                                                autoFocus
                                                                            />
                                                                        ) : (
                                                                            <span className="node-name-text">{cut.name}</span>
                                                                        )}
                                                                        {cut.type === 'HOLE' ? (
                                                                            <span
                                                                                style={{
                                                                                    opacity: 0.5,
                                                                                    fontSize: '11px',
                                                                                    marginLeft: '4px',
                                                                                }}
                                                                            >
                                                                                (Ø{(cut as SmartPartHoleCut).diameterMm}
                                                                                {maxProt > 0 ? ` +${maxProt}` : ''})
                                                                            </span>
                                                                        ) : (
                                                                            <span
                                                                                style={{
                                                                                    opacity: 0.5,
                                                                                    fontSize: '11px',
                                                                                    marginLeft: '4px',
                                                                                }}
                                                                            >
                                                                                ({(cut as SmartPartPocketCut).widthMm}x
                                                                                {(cut as SmartPartPocketCut).heightMm}
                                                                                {maxProt > 0 ? ` +${maxProt}` : ''})
                                                                            </span>
                                                                        )}
                                                                        {cutFrozen && (
                                                                            <span style={{ color: '#38bdf8', fontSize: 10, marginLeft: 4, fontWeight: 600 }}>
                                                                                zamrożony
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="tree-node-actions">
                                                                        <button
                                                                            type="button"
                                                                            className="tree-action-btn btn-toggle-part-vis"
                                                                            title={tx(srcTekst, 'tree.toggle', TX_NS)}
                                                                            onClick={(e) => handleToggleCutVisibility(cut.id, e)}
                                                                        >
                                                                            {cut.visible === false ? TREE_ICONS.eyeHide : TREE_ICONS.eyeShow}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="tree-action-btn"
                                                                            title="Kopiuj parametr ID — potem Wklej parametr ID na Zamroź w Panelu"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                copyParamId('cut', cut.id, cut.name || 'Cut');
                                                                            }}
                                                                        >
                                                                            {TREE_ICONS.link}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="tree-action-btn btn-delete"
                                                                            title="Usuń cięcie"
                                                                            onClick={(e) => handleDeleteCut(cut.id, e)}
                                                                        >
                                                                            {TREE_ICONS.trash}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        );
                                    })}
                                            </div>
                                        );
                                    })}

                                    {orphanCuts.length > 0 && (
                                        <div className="tree-children" style={{ marginLeft: '12px', marginTop: 8 }}>
                                            <div className="tree-node" style={{ background: 'rgba(239,68,68,0.12)' }}>
                                                <div className="tree-node-content">
                                                    {TREE_ICONS.opsFolder}
                                                    <span className="node-name-text" style={{ color: '#fca5a5', fontWeight: 600 }}>
                                                        Cięcia bez Parta
                                                    </span>
                                                    <span style={{ opacity: 0.6, fontSize: '10px', marginLeft: 4 }}>
                                                        ({orphanCuts.length} — nie trafią do JSON)
                                                    </span>
                                                </div>
                                            </div>
                                            {orphanCuts.map((cut) => (
                                                <div key={cut.id} className="tree-children" style={{ marginLeft: '12px' }}>
                                                    <div className={`tree-node ${selectedId === cut.id ? 'selected' : ''}`}>
                                                        <div
                                                            className="tree-node-content"
                                                            onClick={() => setSelectedId(cut.id)}
                                                        >
                                                            {TREE_ICONS.tool}
                                                            <span className="node-name-text">{cut.name || cut.id}</span>
                                                            <span style={{ opacity: 0.5, fontSize: 10, marginLeft: 4 }}>
                                                                (partId: {cut.partId || 'brak'})
                                                            </span>
                                                        </div>
                                                        <div className="tree-node-actions">
                                                            <button
                                                                type="button"
                                                                className="tree-action-btn btn-delete"
                                                                title="Usuń (orphan — nie należy do żadnego Parta)"
                                                                onClick={(e) => handleDeleteCut(cut.id, e)}
                                                            >
                                                                {TREE_ICONS.trash}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        </div>
            </DrzewoObiektow>

            <PanelEdycji
                editPanelWidth={editPanelWidth}
                isDraggingEdit={isDraggingEdit}
                startResizeEdit={startResizeEdit}
            >
                    <div
                        className="tab-content active"
                        id="tab-a5-smartparts-studio"
                        style={{
                            height: 'calc(100% - 40px)',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}
                    >
                        <div
                            className="panel-header"
                            style={{
                                flexShrink: 0,
                                position: 'sticky',
                                top: 0,
                                zIndex: 10,
                                background: '#18181b',
                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                padding: '6px 12px',
                            }}
                        >
                            <h2 style={{ fontSize: '13px', margin: '0 0 6px', fontWeight: 700, lineHeight: '1.2' }}>SmartParts</h2>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                    type="button"
                                    className={`menu-btn ${studioTab === 'props' ? 'is-active' : ''}`}
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: 11,
                                        background: studioTab === 'props' ? 'rgba(2,132,199,0.35)' : undefined,
                                        borderColor: studioTab === 'props' ? '#38bdf8' : undefined,
                                    }}
                                    onClick={() => setStudioTab('props')}
                                >
                                    Właściwości
                                </button>
                                <button
                                    type="button"
                                    className={`menu-btn ${studioTab === 'panel' ? 'is-active' : ''}`}
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: 11,
                                        background: studioTab === 'panel' ? 'rgba(2,132,199,0.35)' : undefined,
                                        borderColor: studioTab === 'panel' ? '#38bdf8' : undefined,
                                    }}
                                    onClick={() => setStudioTab('panel')}
                                    title="Parametry panelu aplikacji"
                                >
                                    Panel aplikacji
                                </button>
                            </div>
                        </div>

                        {studioTab === 'panel' ? (
                            <StudioPanelTab
                                def={currentDef}
                                previewValues={previewParamValues}
                                onDefChange={setCurrentDef}
                                onPreviewChange={setPreviewParamValues}
                                selectedTargetId={selectedId}
                            />
                        ) : (
                        <>
                        <div className="panel-section">
                            <h3 style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Biblioteka obiektów
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    <button type="button" className="cad-add-btn" style={{ borderColor: '#38bdf8', color: '#38bdf8' }} onClick={handleAddSet}>
                                        <span>+ Dodaj Zestaw</span>
                                    </button>
                                    <button type="button" className="cad-add-btn" onClick={() => handleAddPart()}>
                                        <span>+ Dodaj Część</span>
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    <button type="button" className="cad-add-btn is-hole" onClick={handleAddHoleCut}>
                                        <span>+ Otwór okrągły</span>
                                    </button>
                                    <button type="button" className="cad-add-btn is-pocket" onClick={handleAddPocketCut}>
                                        <span>+ Wcięcie prostokątne</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Inspektor Właściwości */}
                        <div className="panel-section" style={{ flex: 1 }}>
                            {/* Wariant A: Kontener Główny SmartPart */}
                            {selectedId === 'main_container' && (
                                <>
                                    <h3 style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Kontener główny
                                    </h3>
                                <div className="cad-prop-grid">
                                    {renderDrivingParamControl({
                                        targetType: 'MAIN',
                                        targetId: 'main_container',
                                        field: 'widthMm',
                                        label: 'Szerokość (X) [mm]',
                                        valueMm: currentDef.mainContainer.widthMm,
                                        onManualChange: (v) => handleUpdateMainContainer('widthMm', v),
                                    })}
                                    {renderDrivingParamControl({
                                        targetType: 'MAIN',
                                        targetId: 'main_container',
                                        field: 'heightMm',
                                        label: 'Wysokość (Z) [mm]',
                                        valueMm: currentDef.mainContainer.heightMm,
                                        onManualChange: (v) => handleUpdateMainContainer('heightMm', v),
                                    })}
                                    {renderDrivingParamControl({
                                        targetType: 'MAIN',
                                        targetId: 'main_container',
                                        field: 'depthMm',
                                        label: 'Głębokość (Y) [mm]',
                                        valueMm: currentDef.mainContainer.depthMm,
                                        onManualChange: (v) => handleUpdateMainContainer('depthMm', v),
                                    })}
                                </div>
                            </>
                        )}

                        {/* Wariant B: Wybrany Part */}
                        {selectedPart && (
                            <>
                                <h3 style={{ margin: '0 0 6px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Część (Part)</h3>

                                <div className="cad-prop-grid">
                                    {renderPropCategory('Położenie', (
                                        <>
                                            {renderAxisFrame('X', 'Oś X', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedPart.refX || 'CENTER'}
                                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'X', e.target.value)}
                                                        >
                                                            <option value="LEFT">Bok lewy (−X)</option>
                                                            <option value="RIGHT">Bok prawy (+X)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderOffsetBind(
                                                        selectedPart.id,
                                                        'offsetX_mm',
                                                        'Odstęp [mm]',
                                                        selectedPart.offsetX_mm ?? selectedPart.xMm,
                                                        (v) => handleUpdatePartRef(selectedPart.id, 'X', selectedPart.refX || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                            {renderAxisFrame('Y', 'Oś Y', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedPart.refY || 'CENTER'}
                                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'Y', e.target.value)}
                                                        >
                                                            <option value="FRONT">Przód (−Y)</option>
                                                            <option value="BACK">Tył (+Y)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderOffsetBind(
                                                        selectedPart.id,
                                                        'offsetY_mm',
                                                        'Odstęp [mm]',
                                                        selectedPart.offsetY_mm ?? selectedPart.yMm,
                                                        (v) => handleUpdatePartRef(selectedPart.id, 'Y', selectedPart.refY || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                            {renderAxisFrame('Z', 'Oś Z', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedPart.refZ || 'CENTER'}
                                                            onChange={(e) => handleUpdatePartRef(selectedPart.id, 'Z', e.target.value)}
                                                        >
                                                            <option value="BOTTOM">Dół (−Z)</option>
                                                            <option value="TOP">Góra (+Z)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderOffsetBind(
                                                        selectedPart.id,
                                                        'offsetZ_mm',
                                                        'Odstęp [mm]',
                                                        selectedPart.offsetZ_mm ?? selectedPart.zMm,
                                                        (v) => handleUpdatePartRef(selectedPart.id, 'Z', selectedPart.refZ || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                        </>
                                    ), 'location')}

                                    {renderPropCategory('Rozmiar', (
                                        <>
                                            {renderDimRow('X', renderDrivingParamControl({
                                                targetType: 'PART',
                                                targetId: selectedPart.id,
                                                partId: selectedPart.id,
                                                field: 'widthMm',
                                                label: 'Szerokość [mm]',
                                                valueMm: selectedPart.widthMm,
                                                onManualChange: (v) => {
                                                    setCurrentDef((prev) => ({
                                                        ...prev,
                                                        parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, widthMm: v } : p)),
                                                    }));
                                                },
                                            }))}
                                            {renderDimRow('Y', renderDrivingParamControl({
                                                targetType: 'PART',
                                                targetId: selectedPart.id,
                                                partId: selectedPart.id,
                                                field: 'depthMm',
                                                label: 'Głębokość [mm]',
                                                valueMm: selectedPart.depthMm,
                                                onManualChange: (v) => {
                                                    setCurrentDef((prev) => ({
                                                        ...prev,
                                                        parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, depthMm: v } : p)),
                                                    }));
                                                },
                                            }))}
                                            {renderDimRow('Z', renderDrivingParamControl({
                                                targetType: 'PART',
                                                targetId: selectedPart.id,
                                                partId: selectedPart.id,
                                                field: 'heightMm',
                                                label: 'Wysokość [mm]',
                                                valueMm: selectedPart.heightMm,
                                                onManualChange: (v) => {
                                                    setCurrentDef((prev) => ({
                                                        ...prev,
                                                        parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, heightMm: v } : p)),
                                                    }));
                                                },
                                            }))}
                                        </>
                                    ), 'size')}

                                    <div className="cad-props-misc">
                                        <div className="cad-prop-row">
                                            <label className="cad-prop-label">Kolor podglądu</label>
                                            <input
                                                type="color"
                                                className="cad-prop-color"
                                                value={selectedPart.colorHex}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setCurrentDef((prev) => ({
                                                        ...prev,
                                                        parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, colorHex: val } : p)),
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div className="cad-prop-row">
                                            <label className="cad-prop-label">Model GLB (opcja)</label>
                                            <input
                                                type="text"
                                                className="cad-prop-input"
                                                value={selectedPart.glbPath || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setCurrentDef((prev) => ({
                                                        ...prev,
                                                        parts: prev.parts.map((p) => (p.id === selectedPart.id ? { ...p, glbPath: val } : p)),
                                                    }));
                                                }}
                                                placeholder="np. Zawieszka.glb"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Wariant C: Otwór okrągły (HOLE) */}
                        {selectedCut && selectedCut.type === 'HOLE' && (
                            <>
                                <h3 style={{ margin: '0 0 6px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Otwór okrągły</h3>

                                <div className="cad-prop-grid">
                                    {renderPropCategory('Położenie', (
                                        <>
                                            {renderAxisFrame('X', 'Oś X', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedCut.refX || 'CENTER'}
                                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'X', e.target.value)}
                                                        >
                                                            <option value="LEFT">Bok lewy (−X)</option>
                                                            <option value="RIGHT">Bok prawy (+X)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderCutParamBind(
                                                        selectedCut.id,
                                                        'offsetX_mm',
                                                        'Odstęp [mm]',
                                                        selectedCut.offsetX_mm ?? selectedCut.xMm,
                                                        (v) => handleUpdateCutRef(selectedCut.id, 'X', selectedCut.refX || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                            {renderAxisFrame('Y', 'Oś Y', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedCut.refY || 'CENTER'}
                                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Y', e.target.value)}
                                                        >
                                                            <option value="FRONT">Przód (−Y)</option>
                                                            <option value="BACK">Tył (+Y)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderCutParamBind(
                                                        selectedCut.id,
                                                        'offsetY_mm',
                                                        'Odstęp [mm]',
                                                        selectedCut.offsetY_mm ?? selectedCut.yMm,
                                                        (v) => handleUpdateCutRef(selectedCut.id, 'Y', selectedCut.refY || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                            {renderAxisFrame('Z', 'Oś Z', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedCut.refZ || 'CENTER'}
                                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Z', e.target.value)}
                                                        >
                                                            <option value="BOTTOM">Dół (−Z)</option>
                                                            <option value="TOP">Góra (+Z)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderCutParamBind(
                                                        selectedCut.id,
                                                        'offsetZ_mm',
                                                        'Odstęp [mm]',
                                                        selectedCut.offsetZ_mm ?? selectedCut.zMm,
                                                        (v) => handleUpdateCutRef(selectedCut.id, 'Z', selectedCut.refZ || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                        </>
                                    ), 'location')}

                                    {renderPropCategory('Rozmiar', (
                                        <>
                                            {renderCutParamBind(
                                                selectedCut.id,
                                                'diameterMm',
                                                'Średnica Ø [mm]',
                                                (selectedCut as SmartPartHoleCut).diameterMm,
                                                (v) => handleUpdateCutProp(selectedCut.id, 'diameterMm', v || 1),
                                            )}
                                            {renderCutParamBind(
                                                selectedCut.id,
                                                'lengthMm',
                                                'Długość [mm]',
                                                (selectedCut as SmartPartHoleCut).lengthMm,
                                                (v) => handleUpdateCutProp(selectedCut.id, 'lengthMm', v || 1),
                                            )}
                                        </>
                                    ), 'size')}
                                </div>
                            </>
                        )}

                        {/* Wariant D: Wcięcie prostokątne (POCKET) */}
                        {selectedCut && selectedCut.type === 'POCKET' && (
                            <>
                                <h3 style={{ margin: '0 0 6px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wcięcie prostokątne</h3>

                                <div className="cad-prop-grid">
                                    {renderPropCategory('Położenie', (
                                        <>
                                            {renderAxisFrame('X', 'Oś X', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedCut.refX || 'CENTER'}
                                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'X', e.target.value)}
                                                        >
                                                            <option value="LEFT">Bok lewy (−X)</option>
                                                            <option value="RIGHT">Bok prawy (+X)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderCutParamBind(
                                                        selectedCut.id,
                                                        'offsetX_mm',
                                                        'Odstęp [mm]',
                                                        selectedCut.offsetX_mm ?? selectedCut.xMm,
                                                        (v) => handleUpdateCutRef(selectedCut.id, 'X', selectedCut.refX || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                            {renderAxisFrame('Y', 'Oś Y', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedCut.refY || 'CENTER'}
                                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Y', e.target.value)}
                                                        >
                                                            <option value="FRONT">Przód (−Y)</option>
                                                            <option value="BACK">Tył (+Y)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderCutParamBind(
                                                        selectedCut.id,
                                                        'offsetY_mm',
                                                        'Odstęp [mm]',
                                                        selectedCut.offsetY_mm ?? selectedCut.yMm,
                                                        (v) => handleUpdateCutRef(selectedCut.id, 'Y', selectedCut.refY || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                            {renderAxisFrame('Z', 'Oś Z', (
                                                <>
                                                    <div className="cad-prop-row">
                                                        <label className="cad-prop-label">Odniesienie</label>
                                                        <select
                                                            className="cad-prop-select"
                                                            value={selectedCut.refZ || 'CENTER'}
                                                            onChange={(e) => handleUpdateCutRef(selectedCut.id, 'Z', e.target.value)}
                                                        >
                                                            <option value="BOTTOM">Dół (−Z)</option>
                                                            <option value="TOP">Góra (+Z)</option>
                                                            <option value="CENTER">Środek</option>
                                                        </select>
                                                    </div>
                                                    {renderCutParamBind(
                                                        selectedCut.id,
                                                        'offsetZ_mm',
                                                        'Odstęp [mm]',
                                                        selectedCut.offsetZ_mm ?? selectedCut.zMm,
                                                        (v) => handleUpdateCutRef(selectedCut.id, 'Z', selectedCut.refZ || 'CENTER', v),
                                                    )}
                                                </>
                                            ))}
                                        </>
                                    ), 'location')}

                                    {renderPropCategory('Rozmiar', (
                                        <>
                                            {renderDimRow('X', renderCutParamBind(
                                                selectedCut.id,
                                                'widthMm',
                                                'Szerokość [mm]',
                                                (selectedCut as SmartPartPocketCut).widthMm,
                                                (v) => handleUpdateCutProp(selectedCut.id, 'widthMm', v || 1),
                                            ))}
                                            {renderDimRow('Y', renderCutParamBind(
                                                selectedCut.id,
                                                'depthMm',
                                                'Głębokość [mm]',
                                                (selectedCut as SmartPartPocketCut).depthMm,
                                                (v) => handleUpdateCutProp(selectedCut.id, 'depthMm', v || 1),
                                            ))}
                                            {renderDimRow('Z', renderCutParamBind(
                                                selectedCut.id,
                                                'heightMm',
                                                'Wysokość [mm]',
                                                (selectedCut as SmartPartPocketCut).heightMm,
                                                (v) => handleUpdateCutProp(selectedCut.id, 'heightMm', v || 1),
                                            ))}
                                        </>
                                    ), 'size')}
                                </div>
                            </>
                        )}

                        </div>
                        </>
                        )}
                    </div>
            </PanelEdycji>

            <canvas
                id="renderCanvas"
                ref={canvasRef}
                className="cad-canvas"
                tabIndex={0}
                style={{ width: '100%', height: '100%', display: 'block', background: '#ebeff2' }}
            />

            {uiRegionHint && (
                <div className="scene-ui-region-hint" role="status">
                    {uiRegionHint}
                </div>
            )}
        </div>
    );
}
