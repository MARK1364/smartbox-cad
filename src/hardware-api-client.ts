/**
 * Klient dev-API wierceń okuć (Vite). Zapisywane pliki: B1_biblioteka/<kategoria>/*.json.
 * Po zapisie serwer przegenerowuje zaszyfrowany kontener reguł, więc CAD od razu
 * korzysta z nowych wierceń. Wszystkie funkcje są odporne na brak backendu.
 */

export interface HardwareFileEntry {
    path: string;
    data: any;
}

export interface HardwareSaveResult {
    ok: boolean;
    error?: string;
    saved?: string[];
    backups?: string[];
    vaultUpdated?: boolean;
    vaultError?: string;
}

export async function fetchHardwareFiles(): Promise<HardwareFileEntry[] | null> {
    try {
        const res = await fetch('/api/hardware', { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.ok || !Array.isArray(data.files)) return null;
        return data.files as HardwareFileEntry[];
    } catch {
        return null;
    }
}

export async function saveHardwareFiles(files: HardwareFileEntry[]): Promise<HardwareSaveResult> {
    try {
        const res = await fetch('/api/hardware', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
            return { ok: false, error: data?.error || `HTTP ${res.status}` };
        }
        return {
            ok: true,
            saved: data.saved,
            backups: data.backups,
            vaultUpdated: data.vaultUpdated,
            vaultError: data.vaultError,
        };
    } catch (err: any) {
        return { ok: false, error: String(err?.message || err) };
    }
}
