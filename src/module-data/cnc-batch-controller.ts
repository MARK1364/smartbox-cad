/**
 * SmartPanel Web — C1_CNC Batch Controller
 * 
 * Kontroler masowego generowania programów CNC i weryfikacji spójności CAD ↔ CAM dla wybranego zakresu (Scope: Projekt / Szafka / Formatka).
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { CAMSyncService, ScopeValidationReport } from '../../C1_cnc/core/cam-sync-service.js';
import { ToolLibrary } from '../../C1_cnc/processor/tool-library.js';
import { CNCEngine } from '../../C1_cnc/core/cnc-engine.js';
import { Mach3Postprocessor } from '../../C1_cnc/postprocessors/mach3-postprocessor.js';
import { WoodWOPPostprocessor } from '../../C1_cnc/postprocessors/woodwop-postprocessor.js';
import { BiessePostprocessor } from '../../C1_cnc/postprocessors/biesse-postprocessor.js';
import { SCMPostprocessor } from '../../C1_cnc/postprocessors/scm-postprocessor.js';
import { FanucPostprocessor } from '../../C1_cnc/postprocessors/fanuc-postprocessor.js';
import type { ModuleScope } from './types.js';

export interface GeneratedCncFile {
    filename: string;
    content: string;
    panelName: string;
    postprocessor: string;
}

export type CncBatchModalState = {
    open: boolean;
    scope: ModuleScope | null;
    report: ScopeValidationReport | null;
    postprocessor: string;
};

type Listener = (state: CncBatchModalState) => void;

export class CncBatchController {
    private static _instance: CncBatchController;
    private state: CncBatchModalState = {
        open: false,
        scope: null,
        report: null,
        postprocessor: 'WoodWOP'
    };
    private listeners: Set<Listener> = new Set();
    private toolLibrary = new ToolLibrary();

    public static get instance(): CncBatchController {
        if (!CncBatchController._instance) {
            CncBatchController._instance = new CncBatchController();
        }
        return CncBatchController._instance;
    }

    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        const copy = { ...this.state };
        this.listeners.forEach(l => l(copy));
    }

    public getState(): CncBatchModalState {
        return { ...this.state };
    }

    public openModal(scope: ModuleScope, postprocessor: string = 'WoodWOP'): void {
        const doc = ContextManager.instance?.document;
        const report = CAMSyncService.getInstance().validateScope(scope, doc, this.toolLibrary);

        this.state = {
            open: true,
            scope,
            report,
            postprocessor
        };
        this.notify();
    }

    public closeModal(): void {
        this.state.open = false;
        this.notify();
    }

    public setPostprocessor(post: string): void {
        this.state.postprocessor = post;
        this.notify();
    }

    /**
     * Odświeża walidację dla bieżącego zakresu.
     */
    public refreshValidation(): ScopeValidationReport | null {
        if (!this.state.scope) return null;
        const doc = ContextManager.instance?.document;
        const report = CAMSyncService.getInstance().validateScope(this.state.scope, doc, this.toolLibrary);
        this.state.report = report;
        this.notify();
        return report;
    }

    /**
     * Wykonuje auto-synchronizację (uzupełnia brakujące kanały LED, nawierty, przypisuje frezy/wiertła)
     * i natychmiast przelicza raport.
     */
    public autoSynchronizeCurrentScope(): ScopeValidationReport | null {
        if (!this.state.scope) return null;
        const doc = ContextManager.instance?.document;
        CAMSyncService.getInstance().autoSynchronizeScope(this.state.scope, doc, this.toolLibrary);
        return this.refreshValidation();
    }

    /**
     * Generuje pliki maszynowe dla wszystkich formatek posiadających obróbki w danym zakresie.
     */
    public generateFilesForScope(postprocessorName?: string): GeneratedCncFile[] {
        if (!this.state.scope) return [];
        const doc = ContextManager.instance?.document;
        const postName = postprocessorName || this.state.postprocessor || 'WoodWOP';
        const panels = CAMSyncService.getInstance().resolvePanelsForScope(this.state.scope, doc);
        const engine = CNCEngine.getInstance();
        const files: GeneratedCncFile[] = [];

        let post: any;
        let ext = '.nc';
        if (postName === 'WoodWOP') {
            post = new WoodWOPPostprocessor();
            ext = '.mpr';
        } else if (postName === 'Biesse') {
            post = new BiessePostprocessor();
            ext = '.cix';
        } else if (postName === 'SCM') {
            post = new SCMPostprocessor();
            ext = '.xxl';
        } else if (postName === 'Fanuc') {
            post = new FanucPostprocessor();
            ext = '.nc';
        } else {
            post = new Mach3Postprocessor();
            ext = '.nc';
        }

        for (const panel of panels) {
            const programs = panel.cncPrograms || [];
            if (programs.length === 0) continue;

            for (const prog of programs) {
                if (!prog.features || prog.features.length === 0) continue;

                const pName = panel.name || prog.targetPanelName || 'Formatka';
                const safeName = pName.replace(/[^a-zA-Z0-9_\-]/g, '_');
                const filename = `${safeName}_${prog.name || 'CNC'}${ext}`;

                const dims = engine.getDimensionsMM(panel);
                engine.wcsManager.updateForPanelDimensions(dims.width, dims.height, dims.thickness);

                const program = engine.camProcessor.buildCLProgram({
                    projectName: prog.name || 'Program',
                    wcsOrigin: engine.wcsManager.getOrigin(),
                    wcsName: prog.wcsName || 'G55',
                    features: prog.features,
                    toolAssignments: prog.toolAssignments || {},
                    postprocessor: postName,
                    workpieceDimensions: dims
                });

                const code = post.generateNcCode(program);
                files.push({
                    filename,
                    content: code,
                    panelName: pName,
                    postprocessor: postName
                });
            }
        }

        return files;
    }

    /**
     * Pobiera wygenerowany plik na dysk użytkownika.
     */
    public downloadFile(file: GeneratedCncFile): void {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Pobiera wszystkie wygenerowane pliki.
     */
    public downloadAllFiles(files: GeneratedCncFile[]): void {
        for (let i = 0; i < files.length; i++) {
            setTimeout(() => {
                this.downloadFile(files[i]);
            }, i * 150);
        }
    }
}
