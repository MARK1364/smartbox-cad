import React, { useEffect, useRef } from 'react';

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

const DISPLAY_MODES: SelectOption<DisplayMode>[] = [
    { id: 'edges', label: 'Krawędzie', title: 'Cieniowanie z krawędziami (domyślny)', itemId: 'toolEdges', icon: <DisplayCubeIcon mode="edges" /> },
    { id: 'wireframe', label: 'Szkielet', title: 'Tylko krawędzie', itemId: 'toolWireframe', icon: <DisplayCubeIcon mode="wireframe" /> },
    { id: 'xray', label: 'Półprzezroczyste', title: 'Półprzezroczyste bryły', itemId: 'toolXRay', icon: <DisplayCubeIcon mode="xray" /> },
    { id: 'shaded', label: 'Cieniowany', title: 'Cieniowanie powierzchni', itemId: 'toolShaded', icon: <DisplayCubeIcon mode="shaded" /> },
];

const PROJECTION_MODES: SelectOption<ProjectionMode>[] = [
    { id: 'ortho', label: 'Ortogonalny', title: 'Rzut prostokątny (CAD)', itemId: 'toolProjOrtho' },
    { id: 'perspective', label: 'Perspektywa', title: 'Rzut perspektywiczny', itemId: 'toolProjPersp' },
];

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
    return (
        <BelkaSelectMenu
            id="belka-tryb-wyswietlania"
            title="Widok (Tryb wyświetlania)"
            value={mode}
            label="Widok"
            options={DISPLAY_MODES}
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
    return (
        <BelkaSelectMenu
            id="belka-projekcja"
            title="Projekcja kamery"
            value={mode}
            options={PROJECTION_MODES}
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
                title="Informacje i narzędzia diagnostyczne"
                onClick={() => onOpenChange(!open)}
            >
                <span style={{ fontSize: '0.9rem' }}>ℹ️</span>
                <span>Info</span>
                <Chevron />
            </button>
            {open && (
                <div className="belka-dropdown-panel" role="menu" aria-label="Informacje i narzędzia diagnostyczne">
                    <button
                        type="button"
                        id="toolInspector"
                        role="menuitem"
                        className="belka-dropdown-item"
                        title="Przełącz widoczność Babylon.js Inspector (Skrót: Ctrl+I)"
                        onClick={() => {
                            onToggleInspector();
                            onOpenChange(false);
                        }}
                    >
                        <span style={{ width: 16, textAlign: 'center' }}>🔍</span>
                        Inspector (Ctrl+I)
                    </button>
                    <button
                        type="button"
                        id="toolSceneTree"
                        role="menuitem"
                        className="belka-dropdown-item"
                        title="Wypisz drzewo hierarchii CADNode oraz Babylon.js w konsoli F12"
                        onClick={() => {
                            onDumpSceneTree();
                            onOpenChange(false);
                        }}
                    >
                        <span style={{ width: 16, textAlign: 'center' }}>🌳</span>
                        SceneTree (Konsola)
                    </button>
                    {onOpenSSOT && (
                        <button
                            type="button"
                            id="toolJsonSSOT"
                            role="menuitem"
                            className="belka-dropdown-item"
                            title="Wyświetl drzewo JSON SSOT (Single Source of Truth) projektu"
                            onClick={() => {
                                onOpenSSOT();
                                onOpenChange(false);
                            }}
                        >
                            <span style={{ width: 16, textAlign: 'center' }}>📄</span>
                            JSON SSOT
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
