/**
 * Warstwa pliku projektu — oddzielona od ProjectDocument.
 *
 * Chrome / Edge: File System Access API (prawdziwy Zapisz nadpisuje uchwyt).
 * Pozostałe przeglądarki: Blob + <a download> / <input type="file">.
 *
 * Dokument nie zna DOM. Ta klasa woła `serialize()`.
 * `markSaved()` tylko po zapisie natywnym (uchwyt pliku); pobranie Bloba nie czyści dirty.
 */

import {
    type ProjectDocument,
    type ProjectDocumentJSON,
} from './project-document.js';

const FILE_PICKER_TYPES = [
    {
        description: 'Projekt SmartPanel',
        accept: { 'application/json': ['.spp.json', '.json'] },
    },
];

interface NativeFileHandle {
    name?: string;
    getFile(): Promise<File>;
    createWritable(): Promise<{
        write(data: string): Promise<void>;
        close(): Promise<void>;
    }>;
}

export type ProjectSaveMode = 'native' | 'download';

export function suggestedProjectFileName(projectName?: string): string {
    const base = (projectName || 'smartpanel').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'smartpanel';
    return base.toLowerCase().endsWith('.spp.json') ? base : `${base}.spp.json`;
}

export function stampProjectFileMetadata(json: ProjectDocumentJSON): ProjectDocumentJSON {
    return {
        ...json,
        metadata: {
            ...json.metadata,
            savedAt: new Date().toISOString(),
        },
    };
}

function hasSavePicker(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function';
}

function hasOpenPicker(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).showOpenFilePicker === 'function';
}

export function isUserAbort(err: unknown): boolean {
    return !!err && typeof err === 'object' && (err as any).name === 'AbortError';
}

function downloadTextFile(text: string, filename: string): void {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function pickFileWithInput(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = window.document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.spp.json,application/json';
        input.onchange = () => {
            resolve(input.files?.[0] ?? null);
        };
        input.click();
    });
}

async function writeHandle(handle: NativeFileHandle, text: string): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
}

export class ProjectFileIO {
    private fileHandle: NativeFileHandle | null = null;

    get hasFileHandle(): boolean {
        return this.fileHandle != null;
    }

    get currentFileName(): string | null {
        return this.fileHandle?.name ?? null;
    }

    clearHandle(): void {
        this.fileHandle = null;
    }

    async save(document: ProjectDocument): Promise<ProjectSaveMode> {
        const payload = stampProjectFileMetadata(document.serialize());
        const text = JSON.stringify(payload, null, 2);
        const filename = this.currentFileName || suggestedProjectFileName(document.name);

        if (this.fileHandle) {
            await writeHandle(this.fileHandle, text);
            this._afterWrite(document, payload);
            return 'native';
        }

        if (hasSavePicker()) {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: filename,
                types: FILE_PICKER_TYPES,
            }) as NativeFileHandle;
            this.fileHandle = handle;
            await writeHandle(handle, text);
            this._afterWrite(document, payload);
            return 'native';
        }

        downloadTextFile(text, filename);
        document.metadata = { ...payload.metadata };
        return 'download';
    }

    async saveAs(document: ProjectDocument): Promise<ProjectSaveMode> {
        this.fileHandle = null;
        return this.save(document);
    }

    async open(): Promise<{ data: any; fileName: string } | null> {
        if (hasOpenPicker()) {
            const handles = await (window as any).showOpenFilePicker({
                types: FILE_PICKER_TYPES,
                multiple: false,
            }) as NativeFileHandle[];
            const handle = handles?.[0];
            if (!handle) return null;
            const file = await handle.getFile();
            const text = await file.text();
            this.fileHandle = handle;
            return { data: JSON.parse(text), fileName: file.name };
        }

        const file = await pickFileWithInput();
        if (!file) return null;
        this.fileHandle = null;
        return { data: JSON.parse(await file.text()), fileName: file.name };
    }

    async openFromFile(file: File): Promise<{ data: any; fileName: string }> {
        this.fileHandle = null;
        return { data: JSON.parse(await file.text()), fileName: file.name };
    }

    private _afterWrite(document: ProjectDocument, payload: ProjectDocumentJSON): void {
        document.metadata = { ...payload.metadata };
        document.markSaved();
    }
}
