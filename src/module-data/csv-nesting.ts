import type { NestingPart } from '../../n1_nesting/core/nesting-types';

function splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if ((ch === ',' || ch === ';') && !inQuotes) {
            out.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    out.push(current.trim());
    return out;
}

function toNumber(value: string | undefined, fallback: number): number {
    if (value === undefined || value === '') return fallback;
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value === '') return fallback;
    const v = value.toLowerCase();
    if (['0', 'false', 'nie', 'no', 'n'].includes(v)) return false;
    if (['1', 'true', 'tak', 'yes', 'y'].includes(v)) return true;
    return fallback;
}

/**
 * CSV → NestingPart[]. Nagłówki (dowolna kolejność, PL/EN):
 * name, width, height, quantity, thickness, material, canRotate
 */
export function parseNestingCsv(text: string): NestingPart[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.length === 0) return [];

    const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
    const looksLikeHeader = header.some((h) =>
        ['name', 'nazwa', 'width', 'dlugosc', 'długość', 'szerokosc', 'szerokość', 'height'].includes(h)
    );
    const start = looksLikeHeader ? 1 : 0;
    const idx = (aliases: string[]) => header.findIndex((h) => aliases.includes(h));

    const iName = looksLikeHeader ? idx(['name', 'nazwa', 'part', 'formatka']) : 0;
    const iWidth = looksLikeHeader ? idx(['width', 'dlugosc', 'długość', 'length', 'x']) : 1;
    const iHeight = looksLikeHeader ? idx(['height', 'szerokosc', 'szerokość', 'y']) : 2;
    const iQty = looksLikeHeader ? idx(['quantity', 'qty', 'szt', 'ilosc', 'ilość']) : 3;
    const iThk = looksLikeHeader ? idx(['thickness', 'grubosc', 'grubość']) : 4;
    const iMat = looksLikeHeader ? idx(['material', 'materiał', 'dekor']) : 5;
    const iRot = looksLikeHeader ? idx(['canrotate', 'rotate', 'obrot', 'obrót']) : 6;

    const parts: NestingPart[] = [];
    for (let row = start; row < lines.length; row++) {
        const cols = splitCsvLine(lines[row]);
        const name = (iName >= 0 ? cols[iName] : cols[0]) || `Formatka_${row}`;
        const width = toNumber(iWidth >= 0 ? cols[iWidth] : cols[1], 0);
        const height = toNumber(iHeight >= 0 ? cols[iHeight] : cols[2], 0);
        if (width <= 0 || height <= 0) continue;
        parts.push({
            id: `csv_${row}_${name}`,
            name,
            width,
            height,
            quantity: Math.max(1, Math.round(toNumber(iQty >= 0 ? cols[iQty] : cols[3], 1))),
            thickness: toNumber(iThk >= 0 ? cols[iThk] : cols[4], 18),
            material: (iMat >= 0 ? cols[iMat] : cols[5]) || 'Płyta',
            canRotate: toBool(iRot >= 0 ? cols[iRot] : cols[6], true),
        });
    }
    return parts;
}
