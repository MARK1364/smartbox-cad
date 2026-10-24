/**
 * scripts/generate-repo-map.mjs
 *
 * Automatyczny generator Repo-Mapy symboli AST (Aider-style AST symbol indexing).
 * Wykorzystuje wbudowany TypeScript Compiler API (`typescript`) bez zewnętrznych zależności binarnych.
 *
 * Generuje skondensowany indeks architektury w `docs/REPO_MAP.md`:
 * - Wszystkie moduły, pliki i linie kodu (1-indexed, klikalne linki file://)
 * - Eksportowane funkcje wraz z parametrami i typami zwracanymi
 * - Klasy i ich metody
 * - Interfejsy, typy i enumy
 * - Stałe domenowe / słowniki
 *
 * Użycie: node scripts/generate-repo-map.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const docsDir = path.join(webRoot, 'docs');
const outputFile = path.join(docsDir, 'REPO_MAP.md');

const TARGET_MODULES = [
    { dir: 'A1_core', label: 'A1 Core (CAD Node, Math, B-Rep, Units, Scheme)' },
    { dir: 'A2_bloki', label: 'A2 Bloki (Szafki, Moduły Wnętrz, Okucia, Intent Obróbek)' },
    { dir: 'A3_smartframe', label: 'A3 SmartFrame (Generatory Korpusów, Ściany Referencyjne)' },
    { dir: 'A4_smartpanel', label: 'A4 SmartPanel (Natywny Silnik Płyt, Obróbki, Wycięcia)' },
    { dir: 'A6_agd', label: 'A6 AGD (Sprzęt AGD, Modele 3D, Wymiary Montażowe)' },
    { dir: 'A7_material', label: 'A7 Material (Cenniki, Obrzeża, Routing Obróbczy)' },
    { dir: 'A8_pmi', label: 'A8 PMI (Wymiarowanie, Adnotacje 3D, Etykiety)' },
    { dir: 'B1_biblioteka', label: 'B1 Biblioteka (Katalogi Okuć mm, Uchwyty, Zawiasy, Prowadnice)' },
    { dir: 'C1_cnc', label: 'C1 CNC / CAM (CLData, Postprocesory, WCS, Strategie Frezowania)' },
    { dir: 'C2_connectors', label: 'C2 Connectors (Połączenia Meblowe, Mimośrody, Kołki)' },
    { dir: 'D1_draw', label: 'D1 Draw (Silnik Rysunkowy 2D)' },
    { dir: 'E1_export', label: 'E1 Export (G-code, CSV, JSON, DXF)' },
    { dir: 'n1_nesting', label: 'N1 Nesting (Układ Rozkroju Płyt, Algorytmy Pakowania)' },
    { dir: 'o1_operacji', label: 'O1 Operacje (Przetłoczenia, Wycięcia Przelotowe, Rewizje, Ramki)' },
    { dir: 'R1_reports', label: 'R1 Raporty (Zestawienia Materiałowe, Formatki, Etykiety)' },
    { dir: 'R2_rys', label: 'R2 Rys (Rysunki Warsztatowe, Rzuty, Przekroje)' },
    { dir: 'S1_sketcher', label: 'S1 Sketcher (Szkicownik Parametryczny 2D)' },
    { dir: 'S2_solver', label: 'S2 Solver (Rozkład Sił, Mostek Symulacji)' },
    { dir: 'S3_scena', label: 'S3 Scena (Zarządzanie Środowiskiem 3D)' },
    { dir: 'S4_sciany', label: 'S4 Ściany (Ściany Pomieszczeń, Układ Wnętrz)' },
    { dir: 'S5_studio', label: 'S5 Studio (Wizualny Edytor SmartParts / Komponentów)' },
    { dir: 'T1_tlumaczenia', label: 'T1 Tłumaczenia (Wielojęzyczność PL/EN/DE)' }
];

function isIgnored(relPath) {
    const normalized = relPath.replace(/\\/g, '/');
    if (normalized.includes('/__tests__/') || normalized.includes('.test.') || normalized.includes('.spec.')) return true;
    if (normalized.endsWith('.d.ts')) return true;
    return false;
}

function collectTsFiles(dirPath, baseDir) {
    const results = [];
    if (!fs.existsSync(dirPath)) return results;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'dist' || entry.name === 'coverage') {
                continue;
            }
            results.push(...collectTsFiles(fullPath, baseDir));
        } else if (entry.isFile()) {
            if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !isIgnored(relPath)) {
                results.push({ fullPath, relPath });
            }
        }
    }
    return results;
}

function getNodeLine(node, sourceFile) {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function formatTypeNode(typeNode, sourceFile) {
    if (!typeNode) return 'void';
    const text = typeNode.getText(sourceFile).replace(/\s+/g, ' ').trim();
    return text.length > 50 ? text.slice(0, 47) + '...' : text;
}

function formatParameters(params, sourceFile) {
    if (!params || params.length === 0) return '()';
    const parts = params.map(p => {
        const name = p.name ? p.name.getText(sourceFile) : '_';
        const isOptional = !!p.questionToken;
        const typeStr = p.type ? `: ${formatTypeNode(p.type, sourceFile)}` : '';
        return `${name}${isOptional ? '?' : ''}${typeStr}`;
    });
    const joined = parts.join(', ');
    return joined.length > 70 ? `(${parts.length} params)` : `(${joined})`;
}

function parseFileSymbols(filePath, relPath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
        path.basename(filePath),
        content,
        ts.ScriptTarget.Latest,
        true
    );

    const symbols = {
        classes: [],
        functions: [],
        interfaces: [],
        types: [],
        enums: [],
        constants: []
    };

    function isExported(node) {
        if (!node.modifiers) return false;
        return node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    }

    ts.forEachChild(sourceFile, node => {
        const line = getNodeLine(node, sourceFile);

        if (ts.isFunctionDeclaration(node)) {
            const isExp = isExported(node);
            const name = node.name ? node.name.text : (isExp ? 'default' : null);
            if (name && (isExp || !name.startsWith('_'))) {
                const params = formatParameters(node.parameters, sourceFile);
                const ret = node.type ? formatTypeNode(node.type, sourceFile) : 'any';
                symbols.functions.push({ name, params, ret, line, exported: isExp });
            }
        } else if (ts.isClassDeclaration(node)) {
            const isExp = isExported(node);
            const name = node.name ? node.name.text : 'AnonymousClass';
            const methods = [];
            const heritage = node.heritageClauses?.map(h => h.getText(sourceFile)).join(' ') || '';

            for (const member of node.members) {
                if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
                    const isPrivate = member.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword);
                    if (isPrivate) continue;

                    const mLine = getNodeLine(member, sourceFile);
                    const mName = member.name ? member.name.getText(sourceFile) : 'constructor';
                    const mParams = formatParameters(member.parameters, sourceFile);
                    const mRet = member.type ? formatTypeNode(member.type, sourceFile) : 'void';
                    methods.push({ name: mName, params: mParams, ret: mRet, line: mLine });
                }
            }

            symbols.classes.push({ name, heritage, methods, line, exported: isExp });
        } else if (ts.isInterfaceDeclaration(node)) {
            const isExp = isExported(node);
            const name = node.name.text;
            const heritage = node.heritageClauses?.map(h => h.getText(sourceFile)).join(' ') || '';
            const members = [];
            for (const member of node.members.slice(0, 8)) {
                if (member.name) {
                    members.push(member.name.getText(sourceFile));
                }
            }
            if (node.members.length > 8) {
                members.push(`+${node.members.length - 8} more`);
            }
            symbols.interfaces.push({ name, heritage, members, line, exported: isExp });
        } else if (ts.isTypeAliasDeclaration(node)) {
            const isExp = isExported(node);
            const name = node.name.text;
            let preview = node.type.getText(sourceFile).replace(/\s+/g, ' ').trim();
            if (preview.length > 60) preview = preview.slice(0, 57) + '...';
            symbols.types.push({ name, preview, line, exported: isExp });
        } else if (ts.isEnumDeclaration(node)) {
            const isExp = isExported(node);
            const name = node.name.text;
            const members = node.members.map(m => m.name.getText(sourceFile));
            symbols.enums.push({ name, members, line, exported: isExp });
        } else if (ts.isVariableStatement(node) && isExported(node)) {
            for (const decl of node.declarationList.declarations) {
                const name = decl.name.getText(sourceFile);
                if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                    const fn = decl.initializer;
                    const params = formatParameters(fn.parameters, sourceFile);
                    const ret = fn.type ? formatTypeNode(fn.type, sourceFile) : 'any';
                    symbols.functions.push({ name, params, ret, line, exported: true });
                } else if (/^[A-Z0-9_]{3,}$/.test(name)) {
                    // Exported constant / enum-like config object
                    const typeStr = decl.type ? formatTypeNode(decl.type, sourceFile) : '';
                    symbols.constants.push({ name, typeStr, line });
                }
            }
        }
    });

    return symbols;
}

function generateMarkdown() {
    const startTime = Date.now();
    let totalFiles = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalTypes = 0;

    const moduleData = [];

    for (const mod of TARGET_MODULES) {
        const modAbsDir = path.join(webRoot, mod.dir);
        const files = collectTsFiles(modAbsDir, webRoot);
        const fileEntries = [];

        for (const file of files) {
            const symbols = parseFileSymbols(file.fullPath, file.relPath);
            const hasSymbols =
                symbols.classes.length > 0 ||
                symbols.functions.length > 0 ||
                symbols.interfaces.length > 0 ||
                symbols.types.length > 0 ||
                symbols.enums.length > 0 ||
                symbols.constants.length > 0;

            if (hasSymbols) {
                totalFiles++;
                totalFunctions += symbols.functions.length;
                totalClasses += symbols.classes.length;
                totalTypes += symbols.interfaces.length + symbols.types.length + symbols.enums.length;
                fileEntries.push({
                    relPath: file.relPath.replace(/\\/g, '/'),
                    symbols
                });
            }
        }

        fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath));
        moduleData.push({ ...mod, files: fileEntries });
    }

    const lines = [];
    lines.push('# Crevo CAD — Indeks Architektury i Symboli (Repo-Map)');
    lines.push('');
    lines.push('> Automatycznie wygenerowana mapa symboli AST (`scripts/generate-repo-map.mjs`).');
    lines.push('> Pozwala agentom AI oraz programistom na natychmiastowe lokalizowanie funkcji, sygnatur, klas i typów bez konieczności przeszukiwania całych plików.');
    lines.push('');
    lines.push('### Statystyka Repo:');
    lines.push(`- **Zindeksowanych plików TS/TSX**: ${totalFiles}`);
    lines.push(`- **Eksportowanych funkcji**: ${totalFunctions}`);
    lines.push(`- **Klas domenowych**: ${totalClasses}`);
    lines.push(`- **Typów, Interfejsów i Enumów**: ${totalTypes}`);
    lines.push(`- **Czas generowania**: ${Date.now() - startTime} ms`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Spis Modułów');
    lines.push('');
    for (const mod of moduleData) {
        const anchor = mod.dir.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        lines.push(`- [${mod.label}](#${anchor}) (${mod.files.length} plików)`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const mod of moduleData) {
        const anchor = mod.dir.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        lines.push(`## <a id="${anchor}"></a>${mod.label}`);
        lines.push('');

        if (mod.files.length === 0) {
            lines.push('_Brak plików źródłowych spełniających kryteria._');
            lines.push('');
            continue;
        }

        for (const file of mod.files) {
            const fileLink = `[${file.relPath}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath})`;
            lines.push(`### ${fileLink}`);
            lines.push('');

            const { classes, functions, interfaces, types, enums, constants } = file.symbols;

            if (classes.length > 0) {
                lines.push('**Klasy:**');
                for (const c of classes) {
                    const ext = c.heritage ? ` *${c.heritage}*` : '';
                    lines.push(`- \`class ${c.name}\`${ext} [L${c.line}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath}#L${c.line})`);
                    for (const m of c.methods) {
                        lines.push(`  - \`${m.name}${m.params}: ${m.ret}\` [L${m.line}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath}#L${m.line})`);
                    }
                }
                lines.push('');
            }

            if (functions.length > 0) {
                lines.push('**Funkcje:**');
                for (const fn of functions) {
                    const exp = fn.exported ? '`export` ' : '';
                    lines.push(`- ${exp}\`${fn.name}${fn.params}: ${fn.ret}\` [L${fn.line}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath}#L${fn.line})`);
                }
                lines.push('');
            }

            if (interfaces.length > 0 || types.length > 0 || enums.length > 0) {
                lines.push('**Typy i Modele Danych:**');
                for (const iface of interfaces) {
                    const ext = iface.heritage ? ` *${iface.heritage}*` : '';
                    const fields = iface.members.length > 0 ? ` { ${iface.members.join(', ')} }` : '';
                    lines.push(`- \`interface ${iface.name}\`${ext}${fields} [L${iface.line}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath}#L${iface.line})`);
                }
                for (const t of types) {
                    lines.push(`- \`type ${t.name}\` = \`${t.preview}\` [L${t.line}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath}#L${t.line})`);
                }
                for (const e of enums) {
                    lines.push(`- \`enum ${e.name}\` { ${e.members.join(', ')} } [L${e.line}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath}#L${e.line})`);
                }
                lines.push('');
            }

            if (constants.length > 0) {
                lines.push('**Stałe i Słowniki:**');
                for (const c of constants) {
                    const typePart = c.typeStr ? `: ${c.typeStr}` : '';
                    lines.push(`- \`const ${c.name}${typePart}\` [L${c.line}](file:///${webRoot.replace(/\\/g, '/')}/${file.relPath}#L${c.line})`);
                }
                lines.push('');
            }
        }
    }

    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }
    fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');

    console.log(`[repo-map] Wygenerowano pomyślnie ${outputFile}`);
    console.log(`           ${totalFiles} plików, ${totalFunctions} funkcji, ${totalClasses} klas, ${totalTypes} typów w ${Date.now() - startTime}ms`);
}

generateMarkdown();
