/**
 * Vite middleware: edycja list wierceń okuć z B1_biblioteka z poziomu przeglądarki.
 *
 * Endpointy (tylko dev-server Vite — start.bat):
 *   GET  /api/hardware  → lista plików JSON okuć wraz z zawartością
 *   POST /api/hardware  → zapis jednego lub wielu plików
 *                         body: { files: [{ path, data }] }  (albo { path, data })
 *
 * Po zapisie automatycznie przegenerowywany jest zaszyfrowany kontener reguł
 * (A1_core/vault-payload.generated.ts) przez scripts/pack-and-encrypt-rules.mjs,
 * dzięki czemu CAD od razu widzi nowe wiercenia bez ręcznego builda.
 *
 * Poprzednia wersja każdego pliku trafia do `<nazwa>.backup.json` (kopia awaryjna,
 * niewidoczna w edytorze; przywracana ręcznie przez podmianę pliku).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const B1_DIR = path.join(WEB_ROOT, 'B1_biblioteka');
const PACK_SCRIPT = path.join(WEB_ROOT, 'scripts', 'pack-and-encrypt-rules.mjs');

const API_HARDWARE = '/api/hardware';

/** Kolejność kategorii w UI (te same, które pakuje build). */
export const HARDWARE_CATEGORIES = [
    'zawiasy',
    'szuflady',
    'zawieszki',
    'polki_akcesoria',
    'drazki',
    'uchwyty',
    'wyposazenie',
    'zlewy',
] as const;

const SKIP_FILES = new Set(['catalog.json', 'szuflady.json']);

function isSkippedFile(name: string): boolean {
    return SKIP_FILES.has(name) || name.endsWith('.backup.json') || name.startsWith('.');
}

interface HardwareFile {
    path: string;
    data: any;
}

function collectJsonFiles(dir: string, results: HardwareFile[] = []): HardwareFile[] {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectJsonFiles(fullPath, results);
        } else if (entry.isFile() && entry.name.endsWith('.json') && !isSkippedFile(entry.name)) {
            const relPath = path.relative(B1_DIR, fullPath).replace(/\\/g, '/');
            try {
                results.push({
                    path: relPath,
                    data: JSON.parse(fs.readFileSync(fullPath, 'utf8')),
                });
            } catch (err: any) {
                console.warn(`[hardware-api] Pominięto uszkodzony JSON ${relPath}: ${err?.message || err}`);
            }
        }
    }
    return results;
}

function readAllHardware(): HardwareFile[] {
    const files: HardwareFile[] = [];
    for (const category of HARDWARE_CATEGORIES) {
        collectJsonFiles(path.join(B1_DIR, category), files);
    }
    return files.sort((a, b) => a.path.localeCompare(b.path, 'pl'));
}

/** Bezpieczne rozwiązanie ścieżki względnej wewnątrz B1_biblioteka. */
function resolveHardwarePath(relPathRaw: unknown): { rel: string; full: string } {
    const rel = String(relPathRaw ?? '').replace(/\\/g, '/').trim();
    if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
        throw new Error('Nieprawidłowa ścieżka pliku.');
    }
    if (!/^[a-zA-Z0-9_\-]+\/.+\.json$/i.test(rel)) {
        throw new Error(`Ścieżka musi wskazywać plik .json w kategorii B1 (otrzymano: ${rel || '∅'}).`);
    }
    if (rel.endsWith('.backup.json')) {
        throw new Error('Nie można nadpisać pliku kopii zapasowej.');
    }
    const full = path.resolve(B1_DIR, rel);
    if (!full.startsWith(B1_DIR + path.sep)) {
        throw new Error('Ścieżka wykracza poza katalog B1_biblioteka.');
    }
    if (!fs.existsSync(full)) {
        throw new Error(`Plik nie istnieje: ${rel}`);
    }
    return { rel, full };
}

function readJsonBody(req: any, limitBytes = 16 * 1024 * 1024): Promise<any> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > limitBytes) {
                reject(new Error('Payload zbyt duży.'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch (err: any) {
                reject(new Error(`Niepoprawny JSON: ${err?.message || err}`));
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res: any, status: number, payload: any): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
}

function rebuildVault(): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(process.execPath, [PACK_SCRIPT], { cwd: WEB_ROOT, timeout: 30_000 }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error([stderr, stdout, err.message].filter(Boolean).join('\n').trim()));
                return;
            }
            resolve();
        });
    });
}

function normalizeSaveEntries(body: any): HardwareFile[] {
    const raw = Array.isArray(body?.files) ? body.files : body?.path !== undefined ? [body] : [];
    const entries: HardwareFile[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
        const { rel } = resolveHardwarePath(item?.path);
        if (seen.has(rel)) continue;
        seen.add(rel);
        const data = item?.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error(`Dane pliku ${rel} muszą być obiektem JSON.`);
        }
        entries.push({ path: rel, data });
    }
    if (entries.length === 0) {
        throw new Error('Brak plików do zapisu.');
    }
    return entries;
}

export function hardwareApiPlugin(): Plugin {
    return {
        name: 'hardware-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = req.url?.split('?')[0] || '';

                if (url === API_HARDWARE && req.method === 'GET') {
                    try {
                        sendJson(res, 200, { ok: true, files: readAllHardware() });
                    } catch (err: any) {
                        sendJson(res, 500, { ok: false, error: String(err?.message || err) });
                    }
                    return;
                }

                if (url === API_HARDWARE && req.method === 'POST') {
                    try {
                        const body = await readJsonBody(req);
                        const entries = normalizeSaveEntries(body);
                        const backups: string[] = [];

                        for (const entry of entries) {
                            const { full } = resolveHardwarePath(entry.path);
                            const backup = full.replace(/\.json$/i, '.backup.json');
                            fs.copyFileSync(full, backup);
                            backups.push(path.relative(WEB_ROOT, backup).replace(/\\/g, '/'));
                            fs.writeFileSync(full, JSON.stringify(entry.data, null, 2) + '\n', 'utf8');
                        }

                        let vaultUpdated = true;
                        let vaultError: string | undefined;
                        try {
                            await rebuildVault();
                        } catch (err: any) {
                            vaultUpdated = false;
                            vaultError = String(err?.message || err);
                        }

                        sendJson(res, 200, {
                            ok: true,
                            savedAt: new Date().toISOString(),
                            saved: entries.map((e) => e.path),
                            backups,
                            vaultUpdated,
                            ...(vaultError ? { vaultError } : {}),
                        });
                    } catch (err: any) {
                        sendJson(res, 400, { ok: false, error: String(err?.message || err) });
                    }
                    return;
                }

                next();
            });
        },
    };
}
