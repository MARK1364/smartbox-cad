/**
 * Zakładka „Panel aplikacji” — uniwersalny konstruktor formularza (jak SWOOD).
 *
 * Paleta typów → formularz UI. Powiązanie: w Właściwościach 🔗 Kopiuj parametr sterujący,
 * tu 🔗 Wklej — jak driver w Blenderze (z pola Parta do inputu panelu).
 */

import React, { useEffect, useState } from 'react';
import type { SmartPartPackageDefinition, SmartPartParameter } from './smartpart-studio-types.js';
import {
    addCheckParameter,
    addListParameter,
    addNumberParameter,
    defaultSmartPartParamValues,
    removeParameter,
    upsertBinding,
    type SmartPartParamValues,
} from './smartpart-params.js';
import {
    getDrivingParameterClipboard,
    subscribeDrivingParameterClipboard,
    type DrivingFieldClipboard,
} from './smartpart-driver-clipboard.js';
import {
    getObjectLinkClipboard,
    subscribeObjectLinkClipboard,
    type ObjectLinkClipboard,
} from './smartpart-object-link-clipboard.js';

export interface StudioPanelTabProps {
    def: SmartPartPackageDefinition;
    previewValues: SmartPartParamValues;
    onDefChange: (next: SmartPartPackageDefinition) => void;
    onPreviewChange: (next: SmartPartParamValues) => void;
    /** Zaznaczony Part / Cut w Studio — do „Check → zamroź” (fallback) */
    selectedTargetId?: string | null;
}

type PaletteType = 'number' | 'list' | 'check';

const PALETTE: { type: PaletteType; title: string; hint: string }[] = [
    { type: 'number', title: 'Liczba [mm]', hint: 'Offset, wysokość…' },
    { type: 'list', title: 'Lista wyboru', hint: 'Wariant / GLB' },
    { type: 'check', title: 'Zamroź', hint: 'Zamrożenie Parta / wycięcia' },
];

/** Łapka — jak w katalogach przeciąganych (Bloki / SmartParts). */
const DRAG_HAND_ICON = (
    <span className="hand-icon" aria-hidden style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8', flexShrink: 0 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
    </span>
);

export function StudioPanelTab({
    def,
    previewValues,
    onDefChange,
    onPreviewChange,
    selectedTargetId = null,
}: StudioPanelTabProps): React.JSX.Element {
    const parameters = def.parameters ?? [];
    const bindings = def.bindings ?? [];
    const [selectedKey, setSelectedKey] = useState<string | null>(parameters[0]?.key ?? null);
    const [clip, setClip] = useState<DrivingFieldClipboard | null>(() => getDrivingParameterClipboard());
    const [objectLink, setObjectLink] = useState<ObjectLinkClipboard | null>(() => getObjectLinkClipboard());
    const [helpOpen, setHelpOpen] = useState(false);

    useEffect(() => subscribeDrivingParameterClipboard(() => {
        setClip(getDrivingParameterClipboard());
    }), []);
    useEffect(() => subscribeObjectLinkClipboard(() => {
        setObjectLink(getObjectLinkClipboard());
    }), []);

    const commit = (next: SmartPartPackageDefinition) => {
        onDefChange(next);
        onPreviewChange(defaultSmartPartParamValues(next));
    };

    const addControl = (type: PaletteType) => {
        const n = (def.parameters ?? []).length + 1;
        let next: SmartPartPackageDefinition;
        if (type === 'number') {
            next = addNumberParameter(def, {
                label: `Parametr ${n}`,
                default_mm: 50,
                min_mm: 0,
                max_mm: 300,
            });
        } else if (type === 'check') {
            next = addCheckParameter(def, { label: `Zamroź ${n}`, default: false });
        } else {
            next = addListParameter(def, { label: `Wariant ${n}` });
        }
        const created = (next.parameters ?? []).slice(-1)[0];
        commit(next);
        if (created) setSelectedKey(created.key);
    };

    const resolveSelectedTarget = (): { targetType: 'PART' | 'CUT'; targetId: string; name: string } | null => {
        if (!selectedTargetId || selectedTargetId === 'main_container') return null;
        const part = (def.parts ?? []).find((p) => p.id === selectedTargetId);
        if (part) return { targetType: 'PART', targetId: part.id, name: part.name || part.id };
        const cut = (def.cuts ?? []).find((c) => c.id === selectedTargetId);
        if (cut) return { targetType: 'CUT', targetId: cut.id, name: cut.name || cut.id };
        return null;
    };

    /** Nowy check powiązany z frozen zaznaczonego Parta / wycięcia (default OFF = CNC aktywne). */
    const addFreezeCheckForSelected = () => {
        const target = resolveSelectedTarget();
        if (!target) return;
        let next = addCheckParameter(def, {
            label: `Zamroź ${target.name}`,
            default: false,
        });
        const created = (next.parameters ?? []).slice(-1)[0];
        if (!created) return;
        next = upsertBinding(
            next,
            { targetType: target.targetType, targetId: target.targetId, field: 'frozen' },
            created.key,
        );
        onDefChange(next);
        onPreviewChange({ ...defaultSmartPartParamValues(next), [created.key]: false });
        setSelectedKey(created.key);
    };

    /** Wklej skopiowane pole Parta/Cięcia/Kontenera → ten parametr steruje tym polem (tylko number). */
    const pasteOntoParam = (paramKey: string, paramType: SmartPartParameter['type']) => {
        const c = getDrivingParameterClipboard();
        if (!c) return;
        if (paramType !== 'number') return;
        const next = upsertBinding(
            def,
            { targetType: c.targetType, targetId: c.targetId, partId: c.partId, field: c.field },
            paramKey
        );
        const parametersNext = (next.parameters ?? []).map((p) =>
            p.key === paramKey && p.type === 'number'
                ? { ...p, default_mm: Math.round(c.valueMm), label: p.label || c.label }
                : p
        );
        const withDefault = { ...next, parameters: parametersNext };
        onDefChange(withDefault);
        onPreviewChange({ ...defaultSmartPartParamValues(withDefault), [paramKey]: Math.round(c.valueMm) });
        setSelectedKey(paramKey);
    };

    /** Check → wklej parametr ID z drzewa (lub fallback: zaznaczenie) → frozen. */
    const pasteObjectLinkOntoCheck = (paramKey: string) => {
        const link = getObjectLinkClipboard();
        const fallback = resolveSelectedTarget();
        const target = link
            ? { targetType: link.targetType, targetId: link.targetId, name: link.label }
            : fallback;
        if (!target) return;
        const next = upsertBinding(
            def,
            { targetType: target.targetType, targetId: target.targetId, field: 'frozen' },
            paramKey,
        );
        const parametersNext = (next.parameters ?? []).map((p) =>
            p.key === paramKey && p.type === 'check'
                ? { ...p, label: p.label || `Zamroź ${target.name}` }
                : p
        );
        const withParams = { ...next, parameters: parametersNext };
        onDefChange(withParams);
        onPreviewChange({ ...previewValues, [paramKey]: previewValues[paramKey] === true });
        setSelectedKey(paramKey);
    };

    /** Nowy input z etykietą/wartością ze schowka + od razu binding. */
    const pasteAsNewControl = () => {
        const c = getDrivingParameterClipboard();
        if (!c) return;
        let next = addNumberParameter(def, {
            label: c.label,
            default_mm: Math.round(c.valueMm),
            min_mm: 0,
            max_mm: 300,
        });
        const created = (next.parameters ?? []).slice(-1)[0];
        if (created) {
            next = upsertBinding(
                next,
                { targetType: c.targetType, targetId: c.targetId, partId: c.partId, field: c.field },
                created.key
            );
            onDefChange(next);
            onPreviewChange({ ...defaultSmartPartParamValues(next), [created.key]: Math.round(c.valueMm) });
            setSelectedKey(created.key);
        }
    };

    const setParamPreviewValue = (paramKey: string, value: number | string | boolean) => {
        // Zamroź bez powiązania → auto-bind do zaznaczenia / schowka ID
        if (value === true) {
            const param = parameters.find((p) => p.key === paramKey);
            const hasFrozen = bindings.some((b) => b.paramKey === paramKey && b.field === 'frozen');
            if (param?.type === 'check' && !hasFrozen) {
                const link = getObjectLinkClipboard();
                const fallback = resolveSelectedTarget();
                const target = link
                    ? { targetType: link.targetType, targetId: link.targetId, name: link.label }
                    : fallback;
                if (target) {
                    const next = upsertBinding(
                        def,
                        { targetType: target.targetType, targetId: target.targetId, field: 'frozen' },
                        paramKey,
                    );
                    const parametersNext = (next.parameters ?? []).map((p) =>
                        p.key === paramKey && p.type === 'check'
                            ? { ...p, label: p.label || `Zamroź ${target.name}` }
                            : p
                    );
                    onDefChange({ ...next, parameters: parametersNext });
                }
            }
        }
        onPreviewChange({ ...previewValues, [paramKey]: value });
    };

    const selected = parameters.find((p) => p.key === selectedKey) || null;

    const patchSelected = (patch: Partial<SmartPartParameter> & { default?: boolean }) => {
        if (!selected) return;
        const parametersNext = (def.parameters ?? []).map((p) => {
            if (p.key !== selected.key) return p;
            return { ...p, ...patch } as SmartPartParameter;
        });
        const next = { ...def, parameters: parametersNext };
        onDefChange(next);
        if (selected.type === 'number' && 'default_mm' in patch && patch.default_mm !== undefined) {
            const prevDefault = selected.default_mm;
            if (previewValues[selected.key] === prevDefault) {
                onPreviewChange({ ...previewValues, [selected.key]: patch.default_mm });
            }
        }
        if (selected.type === 'check' && 'default' in patch && typeof patch.default === 'boolean') {
            if (previewValues[selected.key] === selected.default) {
                onPreviewChange({ ...previewValues, [selected.key]: patch.default });
            }
        }
    };

    const onPaletteDragStart = (e: React.DragEvent, type: PaletteType) => {
        e.dataTransfer.setData('application/x-smartpart-control', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const onFormDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const acceptPaletteDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const paletteType = e.dataTransfer.getData('application/x-smartpart-control') as PaletteType;
        if (paletteType === 'number' || paletteType === 'list' || paletteType === 'check') {
            addControl(paletteType);
        }
    };

    const canPaste = !!clip;
    const freezeTarget = resolveSelectedTarget();

    return (
        <div className="sp-form-builder">
            <div className="sp-form-builder-toolbar">
                <div className="sp-form-help">
                    <button
                        type="button"
                        className={`sp-form-help-btn ${helpOpen ? 'is-open' : ''}`}
                        aria-label="Instrukcja panelu aplikacji"
                        title="Instrukcja"
                        onClick={() => setHelpOpen((v) => !v)}
                    >
                        ?
                    </button>
                    {helpOpen && (
                        <div className="sp-form-help-pop" role="dialog">
                            <strong>Jak powiązać parametr</strong>
                            <ol>
                                <li>We Właściwościach: Kopiuj parametr sterujący → tu Wklej na Liczbę.</li>
                                <li>Zamroź: w drzewie Kopiuj parametr ID → tu Wklej parametr ID.</li>
                                <li>Kontrolki z rzędu przeciągnij na formularz poniżej.</li>
                            </ol>
                            <button type="button" className="sp-form-help-close" onClick={() => setHelpOpen(false)}>
                                Zamknij
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="sp-driver-clipboard-bar">
                {clip ? (
                    <>
                        Pole: <strong>{clip.label}</strong>
                        <code>{clip.targetType === 'MAIN' ? 'Kontener' : clip.targetId}.{clip.field}</code>
                        <button
                            type="button"
                            className={`sp-driver-paste-btn ${canPaste ? 'is-ready' : ''}`}
                            onClick={pasteAsNewControl}
                            title="Utwórz nowy input liczbowy i podłącz skopiowane pole"
                        >
                            🔗 Wklej jako nowy input
                        </button>
                    </>
                ) : objectLink ? (
                    <>
                        Parametr ID: <strong>{objectLink.label}</strong>
                        <code>{objectLink.targetType}.{objectLink.targetId}</code>
                        <button
                            type="button"
                            className="sp-driver-paste-btn is-ready"
                            onClick={() => {
                                let next = addCheckParameter(def, {
                                    label: `Zamroź ${objectLink.label}`,
                                    default: false,
                                });
                                const created = (next.parameters ?? []).slice(-1)[0];
                                if (!created) return;
                                next = upsertBinding(
                                    next,
                                    {
                                        targetType: objectLink.targetType,
                                        targetId: objectLink.targetId,
                                        field: 'frozen',
                                    },
                                    created.key,
                                );
                                onDefChange(next);
                                onPreviewChange({
                                    ...defaultSmartPartParamValues(next),
                                    [created.key]: false,
                                });
                                setSelectedKey(created.key);
                            }}
                            title="Nowa kontrolka Zamroź + frozen z parametru ID"
                        >
                            ☑ Wklej parametr ID jako Zamroź
                        </button>
                    </>
                ) : (
                    <span style={{ opacity: 0.7 }}>
                        W drzewie → Kopiuj parametr ID, albo we Właściwościach → Kopiuj parametr sterujący.
                    </span>
                )}
                {!objectLink && (
                    <button
                        type="button"
                        className={`sp-driver-paste-btn ${freezeTarget ? 'is-ready' : ''}`}
                        disabled={!freezeTarget}
                        onClick={addFreezeCheckForSelected}
                        title={
                            freezeTarget
                                ? `Zamroź → ${freezeTarget.name}`
                                : 'Zaznacz Part/wycięcie albo skopiuj parametr ID z drzewa'
                        }
                    >
                        ☑ Zamroź zaznaczone
                    </button>
                )}
            </div>

            <div className="sp-form-palette-row">
                <div className="sp-form-section-title">Kontrolki</div>
                <div className="sp-form-palette-items">
                    {PALETTE.map((item) => (
                        <div
                            key={item.type}
                            className="sp-form-palette-item"
                            draggable
                            onDragStart={(e) => onPaletteDragStart(e, item.type)}
                            onDoubleClick={() => addControl(item.type)}
                            title={`${item.hint} — przeciągnij na formularz lub kliknij dwukrotnie`}
                        >
                            {DRAG_HAND_ICON}
                            <strong>{item.title}</strong>
                        </div>
                    ))}
                </div>
            </div>

            <section
                className="sp-form-canvas"
                onDragOver={onFormDragOver}
                onDrop={acceptPaletteDrop}
            >
                <div className="sp-form-section-title">Formularz panelu</div>
                {parameters.length === 0 ? (
                    <div className="sp-form-drop-hint">
                        {canPaste
                            ? 'Wklej skopiowane pole albo upuść kontrolkę z rzędu powyżej'
                            : 'Przeciągnij tu kontrolkę z rzędu powyżej'}
                        {canPaste && (
                            <div style={{ marginTop: 10 }}>
                                <button type="button" className="sp-driver-paste-btn is-ready" onClick={pasteAsNewControl}>
                                    🔗 Wklej parametr sterujący
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    parameters.map((p) => {
                        const linked = bindings.filter((b) => b.paramKey === p.key);
                        const usedBy = linked.length;
                        const active = p.key === selectedKey;
                        const pasteOk = canPaste && p.type === 'number';
                        const bindFrozenOk = p.type === 'check' && (!!objectLink || !!freezeTarget);
                        const linkHint = linked[0]
                            ? `${linked[0].targetType === 'MAIN' ? 'Kontener' : linked[0].targetId}.${linked[0].field}`
                            : '';
                        return (
                            <div
                                key={p.key}
                                className={`sp-form-row ${active ? 'is-active' : ''} ${usedBy > 0 ? 'is-linked' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => {
                                    e.stopPropagation();
                                    acceptPaletteDrop(e);
                                }}
                                onClick={() => setSelectedKey(p.key)}
                            >
                                <div
                                    className="sp-form-row-main"
                                    title={usedBy > 0 ? linkHint : p.key}
                                >
                                    <strong>{p.label || p.key}</strong>
                                </div>
                                {p.type === 'number' ? (
                                    <label className="sp-form-row-value" title="Wartość parametru [mm]">
                                        <input
                                            type="number"
                                            className="cad-prop-input sp-form-row-value-input"
                                            min={p.min_mm}
                                            max={p.max_mm}
                                            step={1}
                                            value={Number(previewValues[p.key] ?? p.default_mm)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                const raw = parseFloat(e.target.value);
                                                let v = Number.isFinite(raw) ? raw : p.default_mm;
                                                if (p.min_mm !== undefined) v = Math.max(p.min_mm, v);
                                                if (p.max_mm !== undefined) v = Math.min(p.max_mm, v);
                                                setParamPreviewValue(p.key, v);
                                            }}
                                        />
                                        <span>mm</span>
                                    </label>
                                ) : p.type === 'check' ? (
                                    <label className="sp-form-row-value" title="Zaznaczony = zamrożony (gdy linked frozen)">
                                        <input
                                            type="checkbox"
                                            className="sp-form-row-check"
                                            checked={previewValues[p.key] === true || (previewValues[p.key] === undefined && p.default === true)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => setParamPreviewValue(p.key, e.target.checked)}
                                        />
                                    </label>
                                ) : (
                                    <select
                                        className="cad-prop-select sp-form-row-value-input"
                                        value={String(previewValues[p.key] ?? p.default)}
                                        title="Wartość listy"
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setParamPreviewValue(p.key, e.target.value)}
                                    >
                                        {p.options.map((o) => (
                                            <option key={o.key} value={o.key}>{o.label || o.key}</option>
                                        ))}
                                    </select>
                                )}
                                {p.type === 'check' ? (
                                    <button
                                        type="button"
                                        className={`sp-driver-paste-btn ${bindFrozenOk ? 'is-ready' : ''}`}
                                        disabled={!bindFrozenOk}
                                        title={
                                            objectLink
                                                ? `Wklej parametr ID → frozen: ${objectLink.label}`
                                                : freezeTarget
                                                    ? `Podłącz frozen → ${freezeTarget.name}`
                                                    : 'W drzewie → Kopiuj parametr ID, potem wklej tu'
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            pasteObjectLinkOntoCheck(p.key);
                                        }}
                                    >
                                        ☑ Wklej parametr ID
                                    </button>
                                ) : p.type === 'number' ? (
                                    <button
                                        type="button"
                                        className={`sp-driver-paste-btn ${pasteOk ? 'is-ready' : ''}`}
                                        disabled={!pasteOk}
                                        title={
                                            pasteOk
                                                ? `Podłącz: ${clip!.label} (${clip!.targetType === 'MAIN' ? 'Kontener' : clip!.targetId}.${clip!.field})`
                                                : canPaste
                                                    ? 'Wklejanie tylko na Liczba [mm]'
                                                    : 'Najpierw skopiuj pole we Właściwościach'
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            pasteOntoParam(p.key, p.type);
                                        }}
                                    >
                                        🔗 Wklej
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="tree-action-btn btn-delete"
                                    title="Usuń z formularza"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const next = removeParameter(def, p.key);
                                        commit(next);
                                        if (selectedKey === p.key) {
                                            setSelectedKey((next.parameters ?? [])[0]?.key ?? null);
                                        }
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })
                )}
            </section>

            <aside className="sp-form-props">
                <div className="sp-form-section-title">Właściwości kontrolki</div>
                {!selected ? (
                    <div style={{ fontSize: 11, color: '#64748b' }}>Zaznacz pole na formularzu.</div>
                ) : selected.type === 'number' ? (
                    <div className="cad-prop-grid">
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Etykieta</label>
                            <input
                                className="cad-prop-input"
                                value={selected.label || ''}
                                onChange={(e) => patchSelected({ label: e.target.value })}
                            />
                        </div>
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Klucz</label>
                            <input className="cad-prop-input" value={selected.key} disabled title="Klucz techniczny (JSON)" />
                        </div>
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Domyślna [mm]</label>
                            <input
                                type="number"
                                className="cad-prop-input"
                                value={selected.default_mm}
                                onChange={(e) => patchSelected({ default_mm: Number(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Min</label>
                            <input
                                type="number"
                                className="cad-prop-input"
                                value={selected.min_mm ?? 0}
                                onChange={(e) => patchSelected({ min_mm: Number(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Max</label>
                            <input
                                type="number"
                                className="cad-prop-input"
                                value={selected.max_mm ?? 300}
                                onChange={(e) => patchSelected({ max_mm: Number(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                ) : selected.type === 'check' ? (
                    <div className="cad-prop-grid">
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Etykieta</label>
                            <input
                                className="cad-prop-input"
                                value={selected.label || ''}
                                onChange={(e) => patchSelected({ label: e.target.value })}
                            />
                        </div>
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Klucz</label>
                            <input className="cad-prop-input" value={selected.key} disabled title="Klucz techniczny (JSON)" />
                        </div>
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Domyślnie zaznaczony</label>
                            <input
                                type="checkbox"
                                checked={selected.default === true}
                                onChange={(e) => patchSelected({ default: e.target.checked })}
                            />
                        </div>
                        <div className="cad-prop-row" style={{ gridColumn: 'span 2', fontSize: 11, color: '#94a3b8' }}>
                            Zaznaczony = zamrożony w Studio (bez wycięć) i przy wstawianiu (bez CNC).
                        </div>
                    </div>
                ) : (
                    <div className="cad-prop-grid">
                        <div className="cad-prop-row">
                            <label className="cad-prop-label">Etykieta</label>
                            <input
                                className="cad-prop-input"
                                value={selected.label || ''}
                                onChange={(e) => patchSelected({ label: e.target.value })}
                            />
                        </div>
                        <div className="cad-prop-row" style={{ gridColumn: 'span 2' }}>
                            <label className="cad-prop-label">Opcje (klucz|etykieta|glb)</label>
                            <textarea
                                className="cad-prop-input"
                                style={{ height: 72, fontFamily: 'monospace', fontSize: 10 }}
                                value={selected.options.map((o) => `${o.key}|${o.label || o.key}|${o.glbPath || ''}`).join('\n')}
                                onChange={(e) => {
                                    const options = e.target.value.split('\n').map((line) => {
                                        const [key, label, glbPath] = line.split('|').map((s) => (s || '').trim());
                                        return { key: key || 'opt', label: label || key || 'opt', glbPath: glbPath || '' };
                                    }).filter((o) => o.key);
                                    const defaultKey = options.some((o) => o.key === selected.default)
                                        ? selected.default
                                        : (options[0]?.key || 'opt');
                                    patchSelected({ options, default: defaultKey } as any);
                                }}
                            />
                        </div>
                    </div>
                )}
            </aside>
        </div>
    );
}
