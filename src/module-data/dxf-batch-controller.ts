/**
 * SmartPanel Web — DXF & HTML Preview Batch Controller
 * 
 * Kontroler masowego eksportu DXF i kart technologicznych HTML
 * dla wybranego zakresu (Scope: Korpus / Projekt / Formatka).
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { CAMSyncService } from '../../C1_cnc/core/cam-sync-service.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { extractPanelPreviewData, openPanelsHtmlPreview, type PanelPreviewData } from '../../C1_cnc/exporters/panel-html-preview.js';
import { UIController } from '../../A1_core/ui-controller.js';
import type { ModuleScope } from './types.js';

export interface DxfBatchPanelItem {
    id: string;
    name: string;
    role: string;
    containerName: string;
    width: number;
    height: number;
    thickness: number;
    holesCount: number;
    selected: boolean;
    panelRef: any;
}

export interface DxfBatchModalState {
    open: boolean;
    scope: ModuleScope | null;
    panels: DxfBatchPanelItem[];
}

type Listener = (state: DxfBatchModalState) => void;

export class DxfBatchController {
    private static _instance: DxfBatchController;
    private state: DxfBatchModalState = {
        open: false,
        scope: null,
        panels: []
    };
    private listeners = new Set<Listener>();

    public static get instance(): DxfBatchController {
        if (!DxfBatchController._instance) {
            DxfBatchController._instance = new DxfBatchController();
        }
        return DxfBatchController._instance;
    }

    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        const s = this.getState();
        this.listeners.forEach(l => l(s));
    }

    public getState(): DxfBatchModalState {
        return {
            open: this.state.open,
            scope: this.state.scope,
            panels: [...this.state.panels]
        };
    }

    public openModal(scope: ModuleScope): void {
        const doc = ContextManager.instance?.document;
        const rawPanels = CAMSyncService.getInstance().resolvePanelsForScope(scope, doc);

        const items: DxfBatchPanelItem[] = rawPanels.map((p) => {
            const rawW = p.width ?? p.length ?? p.dim?.x ?? p.dim_nm?.x ?? 0;
            const rawH = p.height ?? p.depth ?? p.dim?.y ?? p.dim_nm?.y ?? 0;
            const rawT = p.thickness ?? p.dim?.z ?? p.dim_nm?.z ?? 0;
            const features = Array.isArray(p.features) ? p.features : [];
            const holesCount = features.filter((f: any) => (f.type || '').toLowerCase() === 'hole' || (f.type || '').toLowerCase() === 'drill').length;
            const parentName = p.parentContainerName || (p.containerId ? `Korpus ${p.containerId}` : '');

            return {
                id: String(p.id || 'panel'),
                name: p.name || p.role || 'Formatka',
                role: String(p.role || 'PANEL'),
                containerName: parentName,
                width: Math.round(nmToMm(rawW)),
                height: Math.round(nmToMm(rawH)),
                thickness: Math.round(nmToMm(rawT)),
                holesCount,
                selected: true,
                panelRef: p
            };
        });

        this.state = {
            open: true,
            scope,
            panels: items
        };
        this.notify();
    }

    public closeModal(): void {
        this.state.open = false;
        this.notify();
    }

    public toggleSelect(id: string): void {
        this.state.panels = this.state.panels.map(item =>
            item.id === id ? { ...item, selected: !item.selected } : item
        );
        this.notify();
    }

    public selectAll(selected: boolean): void {
        this.state.panels = this.state.panels.map(item => ({ ...item, selected }));
        this.notify();
    }

    /**
     * Zatwierdzenie przez użytkownika:
     * - Otwiera stronę HTML z interaktywnymi rysunkami technicznymi wszystkich zatwierdzonych formatek
     *   (z możliwością pobrania plików DXF na żądanie wprost z podglądu)
     */
    public confirmAndExport(): void {
        const selected = this.state.panels.filter(p => p.selected);
        if (selected.length === 0) {
            alert('Wybierz co najmniej jedną formatkę.');
            return;
        }

        const previewDataList: PanelPreviewData[] = [];

        // Generujemy dane rysunku technicznego i DXF dla każdej zaznaczonej formatki
        selected.forEach((item) => {
            const previewData = extractPanelPreviewData(item.panelRef, item.containerName);
            previewDataList.push(previewData);
        });

        // Otwarcie podglądu HTML w nowej karcie
        const scopeName = this.state.scope?.name || 'Zatwierdzone formatki';
        const title = `Rysunki Techniczne Formatek — ${scopeName} (${selected.length} szt.)`;
        openPanelsHtmlPreview(previewDataList, title);

        UIController.instance?.setStatus?.(`Otwarto rysunki techniczne dla ${selected.length} formatek`);

        this.closeModal();
    }
}
