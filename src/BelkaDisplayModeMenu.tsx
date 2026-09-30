import React, { useEffect, useRef } from 'react';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

export type DisplayMode = 'shaded' | 'edges' | 'wireframe' | 'xray';
export type ProjectionMode = 'ortho' | 'perspective';

type SelectOption<T extends string> = {
    id: T;
    label: string;
    title: string;
    itemId?: string;
    icon?: React.ReactNode;
};

function Chevron() {
    return (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 2, opacity: 0.8 }}>
            <path d="M6 9l6 6 6-6" />
        </svg>
    );
}

const CUBE_ICONS: Record<DisplayMode, string> = {
    shaded: new URL('./icons/display/cube-shaded.svg', import.meta.url).href,
    edges: new URL('./icons/display/cube-edges.svg', import.meta.url).href,
    wireframe: new URL('./icons/display/cube-wireframe.svg', import.meta.url).href,
    xray: new URL('./icons/display/cube-xray.svg', import.meta.url).href,
};

function DisplayCubeIcon({ mode }: { mode: DisplayMode }) {
    return <img className="belka-dropdown-icon" src={CUBE_ICONS[mode]} alt="" draggable={false} />;
}

function BelkaSelectMenu<T extends string>({
    id,
    title,
    value,
    label,
    options,
    open,
    onOpenChange,
    onChange,
}: {
    id: string;
    title: string;
    value: string;
    label?: string;
    options: SelectOption<T>[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChange: (id: T) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find((m) => m.id === value) || options[0];

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
        };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [open, onOpenChange]);

    return (
        <div ref={ref} id={id} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                className={`tool-btn ${open ? 'active' : ''}`}
                title={title}
                onClick={() => onOpenChange(!open)}
            >
                {current.icon}
                <span>{label || current.label}</span>
                <Chevron />
            </button>
            {open && (
                <div className="belka-dropdown-panel" role="listbox" aria-label={title}>
                    {options.map((item) => {
                        const active = item.id === value;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                id={item.itemId}
                                role="option"
                                aria-selected={active}
                                className={`belka-dropdown-item ${active ? 'active' : ''}`}
                                title={item.title}
                                onClick={() => {
                                    onChange(item.id);
                                    onOpenChange(false);
                                }}
                            >
                                <span className="belka-dropdown-check">{active ? '✓' : ''}</span>
                                {item.icon}
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const DISPLAY_MODES: (SelectOption<DisplayMode> & { labelKey: string; titleKey: string })[] = [
    { id: 'edges', label: '', title: '', labelKey: 'belka.mode_edges', titleKey: 'belka.mode_edges_title', itemId: 'toolEdges', icon: <DisplayCubeIcon mode="edges" /> },
    { id: 'wireframe', label: '', title: '', labelKey: 'belka.mode_wire', titleKey: 'belka.mode_wire_title', itemId: 'toolWireframe', icon: <DisplayCubeIcon mode="wireframe" /> },
    { id: 'xray', label: '', title: '', labelKey: 'belka.mode_xray', titleKey: 'belka.mode_xray_title', itemId: 'toolXRay', icon: <DisplayCubeIcon mode="xray" /> },
    { id: 'shaded', label: '', title: '', labelKey: 'belka.mode_shaded', titleKey: 'belka.mode_shaded_title', itemId: 'toolShaded', icon: <DisplayCubeIcon mode="shaded" /> },
];

const PROJECTION_MODES: (SelectOption<ProjectionMode> & { labelKey: string; titleKey: string })[] = [
    { id: 'ortho', label: '', title: '', labelKey: 'belka.proj_ortho', titleKey: 'belka.proj_ortho_title', itemId: 'toolProjOrtho' },
    { id: 'perspective', label: '', title: '', labelKey: 'belka.proj_persp', titleKey: 'belka.proj_persp_title', itemId: 'toolProjPersp' },
];

function localizeOptions<T extends string>(opts: (SelectOption<T> & { labelKey: string; titleKey: string })[]): SelectOption<T>[] {
    return opts.map((o) => ({ ...o, label: tx(srcTekst, o.labelKey, TX_NS), title: tx(srcTekst, o.titleKey, TX_NS) }));
}

export function BelkaDisplayModeMenu({
    mode,
    onChange,
    open,
    onOpenChange,
}: {
    mode: string;
    onChange: (mode: DisplayMode) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    useLocale();
    return (
        <BelkaSelectMenu
            id="belka-tryb-wyswietlania"
            title={tx(srcTekst, 'belka.view_title', TX_NS)}
            value={mode}
            label={tx(srcTekst, 'belka.view', TX_NS)}
            options={localizeOptions(DISPLAY_MODES)}
            open={open}
            onOpenChange={onOpenChange}
            onChange={onChange}
        />
    );
}

export function BelkaProjectionMenu({
    mode,
    onChange,
    open,
    onOpenChange,
}: {
    mode: string;
    onChange: (mode: ProjectionMode) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    useLocale();
    return (
        <BelkaSelectMenu
            id="belka-projekcja"
            title={tx(srcTekst, 'belka.proj_title', TX_NS)}
            value={mode}
            options={localizeOptions(PROJECTION_MODES)}
            open={open}
            onOpenChange={onOpenChange}
            onChange={onChange}
        />
    );
}

export function BelkaInfoMenu({
    open,
    onOpenChange,
    onToggleInspector,
    onDumpSceneTree,
    onOpenSSOT,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onToggleInspector: () => void;
    onDumpSceneTree: () => void;
    onOpenSSOT?: () => void;
}) {
    useLocale();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
        };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [open, onOpenChange]);

    return (
        <div ref={ref} id="belka-info" style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                id="toolInfo"
                className={`tool-btn ${open ? 'active' : ''}`}
                title={tx(srcTekst, 'belka.info_title', TX_NS)}
                onClick={() => onOpenChange(!open)}
            >
                <span>{tx(srcTekst, 'belka.info', TX_NS)}</span>
                <Chevron />
            </button>
            {open && (
                <div className="belka-dropdown-panel" role="menu" aria-label={tx(srcTekst, 'belka.info_title', TX_NS)}>
                    <button
                        type="button"
                        id="toolInspector"
                        role="menuitem"
                        className="belka-dropdown-item"
                        title={tx(srcTekst, 'belka.inspector_title', TX_NS)}
                        onClick={() => {
                            onToggleInspector();
                            onOpenChange(false);
                        }}
                    >
                        {tx(srcTekst, 'belka.inspector', TX_NS)}
                    </button>
                    <button
                        type="button"
                        id="toolSceneTree"
                        role="menuitem"
                        className="belka-dropdown-item"
                        title={tx(srcTekst, 'belka.dump_tree_title', TX_NS)}
                        onClick={() => {
                            onDumpSceneTree();
                            onOpenChange(false);
                        }}
                    >
                        {tx(srcTekst, 'belka.dump_tree', TX_NS)}
                    </button>
                    {onOpenSSOT && (
                        <button
                            type="button"
                            id="toolJsonSSOT"
                            role="menuitem"
                            className="belka-dropdown-item"
                            title={tx(srcTekst, 'belka.ssot_title', TX_NS)}
                            onClick={() => {
                                onOpenSSOT();
                                onOpenChange(false);
                            }}
                        >
                        {tx(srcTekst, 'belka.ssot', TX_NS)}
                    </button>
                    )}
                </div>
            )}
        </div>
    );
}
