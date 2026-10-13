/**
 * Vite middleware: żywa lista / kasowanie plików B1_biblioteka/zawieszki.
 * Eager import.meta.glob nie widzi skasowanych plików bez restartu — to API czyta dysk na żądanie.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const ZAWIESZKI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'B1_biblioteka', 'zawieszki');
const API_LIST = '/api/b1-zawieszki';
const API_DELETE = '/api/b1-zawieszki/delete';

function walkJsonFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkJsonFiles(full, out);
        else if (entry.isFile() && /\.json$/i.test(entry.name) && entry.name.toLowerCase() !== 'catalog.json') {
            out.push(full);
        }
    }
    return out;
}

function relToZawieszki(abs: string): string {
    return path.relative(ZAWIESZKI_DIR, abs).split(path.sep).join('/');
}

function readPackageMeta(absJson: string): {
    baseName: string;
    relPath: string;
    id: string;
    name: string;
    isCustom: boolean;
} | null {
    try {
        const raw = JSON.parse(fs.readFileSync(absJson, 'utf8'));
        const baseName = path.basename(absJson, path.extname(absJson));
        const isCustom = Boolean(
            raw?.mainContainer
            || raw?.type === 'CUSTOM'
            || Array.isArray(raw?.parts)
            || raw?.partBody,
        );
        return {
            baseName,
            relPath: relToZawieszki(absJson),
            id: String(raw?.id || baseName),
            name: String(raw?.name || baseName),
            isCustom,
        };
    } catch {
        return null;
    }
}

function deleteCompanions(absJson: string): string[] {
    const deleted: string[] = [];
    const dir = path.dirname(absJson);
    const base = path.basename(absJson, path.extname(absJson));
    for (const ext of ['.json', '.png', '.jpg', '.jpeg', '.webp', '.glb']) {
        const p = path.join(dir, base + ext);
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
            deleted.push(relToZawieszki(p));
        }
    }
    return deleted;
}

function findJsonByQuery(q: string): string | null {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return null;
    const files = walkJsonFiles(ZAWIESZKI_DIR);
    for (const abs of files) {
        const meta = readPackageMeta(abs);
        if (!meta) continue;
        const base = meta.baseName.toLowerCase();
        const id = meta.id.toLowerCase();
        const name = meta.name.toLowerCase();
        if (
            base === needle
            || id === needle
            || name === needle
            || id.replace(/^sp:/, '') === needle.replace(/^sp:/, '')
            || name.replace(/[^a-z0-9]+/g, '') === needle.replace(/[^a-z0-9]+/g, '')
        ) {
            return abs;
        }
    }
    return null;
}

function readBody(req: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

export function b1ZawieszkiPlugin(): Plugin {
    return {
        name: 'b1-zawieszki-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = req.url?.split('?')[0] || '';
                if (url === API_LIST && req.method === 'GET') {
                    try {
                        const files = walkJsonFiles(ZAWIESZKI_DIR)
                            .map(readPackageMeta)
                            .filter(Boolean);
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.setHeader('Cache-Control', 'no-store');
                        res.end(JSON.stringify({ ok: true, dir: 'B1_biblioteka/zawieszki', files }));
                    } catch (err: any) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
                    }
                    return;
                }

                if (url === API_DELETE && (req.method === 'POST' || req.method === 'DELETE')) {
                    try {
                        let idOrName = '';
                        if (req.method === 'POST') {
                            const raw = await readBody(req);
                            const body = raw ? JSON.parse(raw) : {};
                            idOrName = String(body.id || body.name || body.baseName || '');
                        } else {
                            const u = new URL(req.url || '', 'http://localhost');
                            idOrName = u.searchParams.get('id') || u.searchParams.get('name') || '';
                        }
                        const abs = findJsonByQuery(idOrName);
                        if (!abs) {
                            res.statusCode = 404;
                            res.end(JSON.stringify({ ok: false, error: `Nie znaleziono pliku dla „${idOrName}”` }));
                            return;
                        }
                        const meta = readPackageMeta(abs);
                        // Camaro / biblioteka producenta — nie kasuj z UI przypadkiem
                        if (meta && !meta.isCustom) {
                            res.statusCode = 403;
                            res.end(JSON.stringify({ ok: false, error: 'Nie wolno kasować okuć katalogowych (Camaro itd.) z UI.' }));
                            return;
                        }
                        const deleted = deleteCompanions(abs);
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.end(JSON.stringify({ ok: true, deleted, id: meta?.id, name: meta?.name }));
                    } catch (err: any) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
                    }
                    return;
                }

                next();
            });
        },
    };
}
