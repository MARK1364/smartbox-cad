/**
 * Vite middleware: edycja cennika (R1_reports/prices.json) z poziomu przeglądarki.
 *
 * Endpointy (tylko dev-server Vite — start.bat):
 *   GET  /api/prices        → aktualna zawartość cennika
 *   POST /api/prices        → nadpisanie pliku (body: { prices })
 *   POST /api/prices/reset  → przywrócenie cennika domyślnego (prices.default.json)
 *
 * Zapisywany plik to pojedyncze SSOT wyceny: R1_reports/prices.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { serializePriceDatabase, validatePriceDatabase } from './R1_reports/prices-validate.ts';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const PRICES_FILE = path.join(WEB_ROOT, 'R1_reports', 'prices.json');
const DEFAULTS_FILE = path.join(WEB_ROOT, 'R1_reports', 'prices.default.json');

const API_PRICES = '/api/prices';
const API_RESET = '/api/prices/reset';

function readPricesFile(): any {
    const file = fs.existsSync(PRICES_FILE) ? PRICES_FILE : DEFAULTS_FILE;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonBody(req: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
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

export function pricesApiPlugin(): Plugin {
    return {
        name: 'prices-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = req.url?.split('?')[0] || '';

                if (url === API_PRICES && req.method === 'GET') {
                    try {
                        sendJson(res, 200, { ok: true, prices: readPricesFile() });
                    } catch (err: any) {
                        sendJson(res, 500, { ok: false, error: String(err?.message || err) });
                    }
                    return;
                }

                if (url === API_PRICES && req.method === 'POST') {
                    try {
                        const body = await readJsonBody(req);
                        const prices = body?.prices ?? body;
                        validatePriceDatabase(prices);
                        fs.writeFileSync(PRICES_FILE, serializePriceDatabase(prices), 'utf8');
                        sendJson(res, 200, {
                            ok: true,
                            savedAt: new Date().toISOString(),
                            file: 'R1_reports/prices.json',
                        });
                    } catch (err: any) {
                        sendJson(res, 400, { ok: false, error: String(err?.message || err) });
                    }
                    return;
                }

                if (url === API_RESET && req.method === 'POST') {
                    try {
                        if (!fs.existsSync(DEFAULTS_FILE)) {
                            sendJson(res, 404, { ok: false, error: 'Brak pliku domyślnego cennika (prices.default.json).' });
                            return;
                        }
                        const defaults = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
                        fs.writeFileSync(PRICES_FILE, serializePriceDatabase(defaults), 'utf8');
                        sendJson(res, 200, { ok: true, prices: defaults });
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
