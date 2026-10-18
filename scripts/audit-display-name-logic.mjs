/**
 * scripts/audit-display-name-logic.mjs
 * Strażnik reguły: "Logika nigdy nie czyta stringów wyświetlanych".
 * Szuka w C1_cnc / R1_reports / E1_export miejsc, gdzie logika dotyka `.name`
 * albo polskich literałów w warunkach. Do odpalania przed migracją i w CI.
 *
 * Dodatkowo (v4): LEGACY-PARAM-ALIAS — wycofane nazwy parametrów korpusu
 * w modułach, które po migracji mają kontrakt wyłącznie kanoniczny.
 *
 * Użycie: node scripts/audit-display-name-logic.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBlokiInputTypeViolations } from './bloki-input-audit.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Ścieżka wpisana do listy strażnika MUSI istnieć.
 * Ciche `continue` przy brakującym pliku zamienia wyłączoną regułę w zielone „0” —
 * po rename katalogu strażnik przestaje skanować i udaje, że wszystko jest czysto.
 */
function requirePath(rel, kind = 'plik') {
    const abs = path.join(webRoot, rel);
    if (!fs.existsSync(abs)) {
        throw new Error(
            `[audit] ${kind} z listy strażnika nie istnieje: ${rel}\n` +
            `        Reguła byłaby nieegzekwowana po cichu. Popraw ścieżkę (rename modułu?) albo usuń wpis.`
        );
    }
    return abs;
}

const DIRS = ['C1_cnc', 'R1_reports', 'E1_export', 'A8_pmi', 'A4_smartpanel'];
const EXT = new Set(['.ts', '.tsx', '.js']);

// Moduły z kanonicznym kontraktem parametrów korpusu (zero aliasów od wersji pliku 4).
const CANONICAL_PARAM_DIRS = ['A1_core', 'A2_bloki', 'A3_smartframe', 'B1_biblioteka', 'src', 'A8_pmi'];

// Wyjątki: klucze należące do kontraktu A1_core/gizmo-controller (poza zakresem purge).
const GIZMO_OWNED = new Set(['backOffset', 'topPanelMode', 'traverseWidth']);

// Wycofane nazwy parametrów korpusu (SSOT: A3_smartframe/smartframe-types.ts).
// Uwaga: `cutAngle` NIE jest tu — to odrębne pole domenowe edge_banding (kąt cięcia obrzeża),
// wciąż czytane przez A4_smartpanel/native_core/edge-bevel.ts. Usunięty parametr to `kat_skosu_deg`.
const LEGACY_PARAM_ALIAS = [
    'zoneCount', 'bottomHeight', 'middleHeight', 'backOffsetMm', 'backThickness', 'backOverlap',
    'blindWidth', 'blindSide', 'armDepth', 'armDepthX', 'armDepthY', 'bokLewy', 'bokPrawy',
    'heightFront', 'heightBack', 'heightLeft', 'heightRight', 'kat_skosu_deg', 'cut_angle_deg',
    'szerokosc_zaslepki_mm', 'strona_zaslepki', 'wysokosc_dolu_mm', 'wysokosc_srodka_mm',
    'wysokosc_lewa_mm', 'wysokosc_prawa_mm', 'cabinetType'
];

// Pliki, w których nazwa aliasu jest DANE, a nie użyciem: słownik aliasów.
// Wyjątek: te pliki są DANE słownika aliasów (wycofane -> kanoniczne),
// a nie miejscem użycia aliasu. Bez wpisu strażnik goniłby sam słownik.
const ALIAS_DICTIONARY_FILES = new Set([
    'A3_smartframe/smartframe-types.ts',
    'A2_bloki/01_bloki-module-param-guards.ts'
]);

// Odbiory, dla których `.alias` oznacza realne wejście/wyjście kontraktu korpusu.
const PARAM_RECEIVERS = [
    'gp', 'gps', 'genParams', 'generatorParams', 'params', 'p', 'fp', 'frameParams', 'genP', 'parentGp'
];


/** { id, opis, re, fix } */
const RULES = [
    {
        id: 'MATCH-BY-NAME',
        opis: 'matchowanie tożsamości po name (=== / includes z .name)',
        fix: '-> match po node.id, fallback role/nodeType',
        res: [
            /\b\w+\??\.name\??\s*===[^=]/,
            /===\s*\w+\??\.name\b/,
            /\.name\??\.includes\(/,
            /\.includes\([^()\n]*\.name/,
            /\.name\??\.(startsWith|endsWith)\(/,
            /startsWith\(\s*['"]pmi_['"]\)/,
        ],
    },
    {
        id: 'ROLE-FALLBACK-NAME',
        opis: 'klasyfikacja spada na .name (role || name)',
        fix: '-> role || nodeType; name tylko do display',
        res: [/\|\|\s*\w+\??\.name\b/],
    },
    {
        id: 'NAME-FALLBACK-LITERAL',
        opis: 'polski literał jako fallback nazwy (|| \'Płyta\' / ?? \'Formatka\')',
        fix: '-> klucz z *_tekst.json przez tx(), tylko w warstwie display',
        res: [/\b\w+\??\.name\??\s*(\|\||\?\?)\s*['"][^'"]*[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż]/],
    },
    {
        id: 'PL-LITERAL-IN-CONDITION',
        opis: 'polski literał w warunku (startsWith/includes/===)',
        fix: '-> flaga statusu / kod, nigdy tekst',
        res: [
            // tylko literały z polskimi ogonkami albo znane polskie słowa (bez ogonków),
            // żeby nie łapać kodów 'PANEL' / 'FACE_X' / 'function'
            /\.(startsWith|includes|endsWith)\(\s*['"][^'"]*(?:[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż]*(?:[ĄĆĘŁŃÓŚŹŻąćęłńóśźż]|Brak|BRAK|Zatrzymano|Szafka|Formatka|Korpus|Płyta|Wnęk|Wniek|Zawias|Polka|Prost|Otwór|Otwor)[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż]*)[^'"]*['"]/,
            /===\s*['"][^'"]*(?:[ĄĆĘŁŃÓŚŹŻąćęłńóśźż]|Brak|BRAK|Zatrzymano|Szafka|Formatka|Korpus|Płyta|Wnęk|Zawias)[^'"]*['"]/,
        ],
    },
    {
        id: 'NAME-IN-FILENAME',
        opis: 'name w nazwie pliku programu / eksportu',
        fix: '-> nazwa z id/indeksu + display label osobno',
        res: [/targetPanelName|toFilename\(.*\.name|fileName.*\.name|\.name.*\.nc\b/],
    },
];

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(full, out); }
        else if (EXT.has(path.extname(e.name))) out.push(full);
    }
    return out;
}

function walkTests(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walkTests(full, out);
        else if (EXT.has(path.extname(e.name))) out.push(full);
    }
    return out;
}

let findings = 0;
for (const d of DIRS) {
    const abs = requirePath(d, 'katalog');
    const files = walk(abs);
    console.log(`\n## ${d} — plików: ${files.length}`);
    for (const f of files) {
        const rel = path.relative(webRoot, f);
        const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            const t = line.trim();
            if (!t || t.startsWith('//') || t.startsWith('*')) return;
            // Obiekty platformowe, nie węzły CAD: `err?.name === 'AbortError'`,
            // `error.name`, `event.name` — nazwa typu błędu, nie tożsamość bryły.
            if (/\b(?:err|error|exception|event|e)\??\.name\b/.test(t)) return;
            for (const r of RULES) {
                if (r.res.some((re) => re.test(line))) {
                    findings++;
                    console.log(`  [${r.id}] ${rel}:${i + 1}: ${t.slice(0, 140)}`);
                    break;
                }
            }
        });
    }
}

// Testy: tylko informacyjnie (dane testowe po nazwach są OK, ale widać skalę powiązania z nazwami)
let testHits = 0;
for (const d of DIRS) {
    const tdir = path.join(webRoot, d, '__tests__');
    if (!fs.existsSync(tdir)) continue;
    for (const f of walkTests(tdir)) {
        const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            if (/['"]Wieniec|['"]Polka|kołek|konfirmat|Drazek|Formatka/.test(line)) testHits++;
        });
    }
}
console.log(`\n(w testach: ${testHits} linii z polskimi nazwami — dane testowe, OK)`);

// ─── Strażnik parametrów: zero aliasów w kontraktach kanonicznych ───
// Wykrywa odczyt/zapis wycofanego klucza (`gp.zoneCount`, `bottomHeight:` w obiekcie DTO, …).
let paramFindings = 0;
console.log(`\n## LEGACY-PARAM-ALIAS (kontrakt kanoniczny, wyjątek: gizmo)`);
for (const d of CANONICAL_PARAM_DIRS) {
    const abs = requirePath(d, 'katalog');
    for (const f of walk(abs)) {
        const rel = path.relative(webRoot, f);
        if (ALIAS_DICTIONARY_FILES.has(rel.split(path.sep).join('/'))) continue;
        const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            const t = line.trim();
            if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('* @deprecated')) return;
            for (const alias of LEGACY_PARAM_ALIAS) {
                if (GIZMO_OWNED.has(alias)) continue;
                // (1) odczyt przez jawny odbiór kontraktu: gp.zoneCount, params.bottomHeight
                const recv = PARAM_RECEIVERS.join('|');
                const readRe = new RegExp(`\\b(?:${recv})\\s*(?:\\?\\.)?\\.?\\s*${alias}\\b`);
                // (2) klucz obiektu przekazywanego do kontraktu ( CreateKorpusCommand({ zoneCount: … }) )
                const keyRe = new RegExp(`(^|[\\s{(,])${alias}\\s*:`);
                if (readRe.test(t) || keyRe.test(t)) {
                    paramFindings++;
                    console.log(`  [LEGACY-PARAM-ALIAS] ${rel}:${i + 1}: ${t.slice(0, 140)}`);
                    break;
                }
            }
        });
    }
}

console.log(`\nZnalezionych miejsc do odcięcia (name): ${findings}`);
console.log(`Znalezionych aliasów parametrów: ${paramFindings}`);
console.log('Legenda fixów:');
for (const r of RULES) console.log(`  ${r.id}: ${r.fix}`);
console.log('  LEGACY-PARAM-ALIAS: -> klucze kanoniczne *_mm (SSOT: A3_smartframe/smartframe-types.ts)');
if (paramFindings > 0) process.exitCode = 1;

// ─── Strażnik drzwi narożnych: zero aliasów w kontrakcie corner-doors ───
const CORNER_DOORS_LEGACY = [
    'szcz_srodkowa', 'ov_top', 'ov_bottom', 'nalozenie_lewe', 'nalozenie_prawe',
    'thickness', 'front_thickness', 'use_hinge_1', 'use_hinge_2', 'use_hinge_3',
    'use_hinge_4', 'use_hinge_5', 'use_hinge_6',
    'hinge_1_pos', 'hinge_2_pos', 'hinge_3_pos', 'hinge_4_pos', 'hinge_5_pos', 'hinge_6_pos',
    'hinge_1_template', 'hinge_2_template', 'hinge_3_template', 'hinge_4_template',
    'hinge_5_template', 'hinge_6_template', 'hinge_template', 'hingeTemplate'
];
const CORNER_DOORS_ALIAS_DICTIONARY = new Set(['A2_bloki/07_corner-doors-engine.ts']);
let cornerDoorsFindings = 0;
console.log(`\n## CORNER-DOORS-LEGACY (tylko kanoniczne *_mm / uzyj_zawias_* / pozycja_zawias_*_mm)`);
for (const rel of ['A2_bloki/07_corner-doors-engine.ts', 'A2_bloki/07_corner-doors-adapter.tsx', 'A2_bloki/02_bloki-bay-actions.ts']) {
    const f = requirePath(rel);
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
        const t = line.trim();
        if (!t || t.startsWith('//') || t.startsWith('*')) return;
        if (CORNER_DOORS_ALIAS_DICTIONARY.has(rel)) {
            // W słowniku aliasów wystąpienia są dane, nie użyciem — pomijamy klucze w LEGACY_CORNER_DOORS_PARAM_ALIASES.
            if (/LEGACY_CORNER_DOORS_PARAM_ALIASES|assertCanonicalCornerDoorsParams/.test(t)) return;
            if (/^\w+:\s*['"]/.test(t)) return;
        }
        for (const alias of CORNER_DOORS_LEGACY) {
            const keyRe = new RegExp(`(^|[\\s{(,])${alias}\\s*:`);
            const readRe = new RegExp(`\\b(?:gp|params|p|raw)\\.${alias}\\b`);
            if (keyRe.test(t) || readRe.test(t)) {
                cornerDoorsFindings++;
                console.log(`  [CORNER-DOORS-LEGACY] ${rel}:${i + 1}: ${t.slice(0, 140)}`);
                break;
            }
        }
    });
}
console.log(`  → ${cornerDoorsFindings}`);
if (cornerDoorsFindings > 0) process.exitCode = 1;

// ─── Strażnik modułów Bloki: drzwi / szuflady / klapy / półki / LED / … ───
// Tylko kontrakt generatorParams (zapis/odczyt), nie CSS ani lokalne helpery UI.
const BLOKI_MODULE_LEGACY = [
    'thickness', 'front_thickness', 'ov_top', 'ov_bottom', 'ov_left', 'ov_right',
    'door_type', 'doorType', 'szczelina', 'gap_mm',
    'use_hinge_1', 'use_hinge_2', 'use_hinge_3', 'use_hinge_4', 'use_hinge_5', 'use_hinge_6',
    'hinge_1_pos', 'hinge_2_pos', 'hinge_3_pos', 'hinge_4_pos', 'hinge_5_pos', 'hinge_6_pos',
    'hinge_1_template', 'hinge_2_template', 'hinge_3_template', 'hinge_4_template',
    'hinge_5_template', 'hinge_6_template', 'hinge_template', 'hingeTemplate',
    'count', 'drawerCount', 'frontHeightAuto', 'front_height_auto', 'commonGap', 'common_gap',
    'frontHeights', 'front_heights', 'individualGaps', 'individual_gaps',
    'spacerL', 'spacerR', 'enable_spacer_L', 'enable_spacer_R',
    'railSystem', 'rail_system', 'railConfigs', 'rail_configs', 'railManufacturer', 'rail_manufacturer',
    'flap_type', 'hinge_left_offset', 'hinge_right_offset', 'hingeLeftOffset', 'hingeRightOffset',
    'use_center_hinge', 'useCenterHinge',
    'hinge_left_template', 'hinge_right_template', 'hinge_center_template',
    'hingeLeftTemplate', 'hingeRightTemplate', 'hingeCenterTemplate',
    'shelfCount', 'shelfOffsetFront', 'offset_front', 'shelfOffsetSide', 'offset_side',
    'holePattern', 'hole_pattern', 'frontInset', 'backInset', 'frontHoles', 'backHoles',
    'frontOffsetX', 'backOffsetX', 'tripleZOffset', 'triple_z_offset',
    'system32Spacing', 'system32StartOffset', 'system32HoleCount',
    'offsetBottom', 'offset_bottom', 'offsetTop', 'offset_top', 'referenceFrom',
    'dividerCount', 'spacingMode', 'spacing_mode', 'sectionWidths', 'section_widths',
    'showShelf', 'show_shelf', 'spaceAboveShelf', 'space_above_shelf', 'shelfThickness', 'rodDiameter',
    'sidePanelMode', 'enableLeft', 'enableRight', 'enableTop', 'enableBottom',
    'autoDepthLeft', 'autoDepthRight', 'autoDepthTop',
    'panelDepthLeft', 'panelDepthRight', 'panelDepthTop',
    'plinthHeight', 'plinthGap', 'plinthRecess',
    'variant', 'hasLeft', 'hasRight', 'hasBack',
    'offsetFromFrontMm', 'offsetFromFrontLeftMm', 'offsetFromFrontRightMm', 'offsetBackFromCenterMm',
    'grooveWidthMm', 'grooveDepthMm', 'cutSides', 'insetTopMm', 'insetBottomMm',
];
const BLOKI_MODULE_ALIAS_DICTIONARY = new Set([
    'A2_bloki/01_bloki-module-param-guards.ts',
]);
const BLOKI_MODULE_FILES = [
    'A2_bloki/05_doors-engine.ts', 'A2_bloki/05_doors-adapter.tsx', 'A2_bloki/05_doors-drilling-builder.ts',
    'A2_bloki/06_skosne-doors-engine.ts', 'A2_bloki/06_skosne-doors-adapter.tsx', 'A2_bloki/06_skosne-doors-drilling-builder.ts',
    'A2_bloki/09_drawers-engine.ts', 'A2_bloki/09_drawers-adapter.tsx',
    'A2_bloki/12_flaps-engine.ts', 'A2_bloki/12_flaps-adapter.tsx', 'A2_bloki/12_flaps-drilling-builder.ts',
    'A2_bloki/04_shelves-engine.ts', 'A2_bloki/04_shelves-adapter.tsx', 'A2_bloki/04_shelves-drilling-builder.ts',
    'A2_bloki/03_shelf-engine.ts', 'A2_bloki/03_shelf-adapter.tsx',
    'A2_bloki/10_dividers-engine.ts', 'A2_bloki/10_dividers-adapter.tsx',
    'A2_bloki/08_tubes-engine.ts', 'A2_bloki/08_tubes-adapter.tsx',
    'A2_bloki/11_panels-engine.ts', 'A2_bloki/11_panels-adapter.tsx',
    'A2_bloki/13_led-internal-engine.ts', 'A2_bloki/13_led-internal-adapter.tsx',
    'A2_bloki/14_led-external-engine.ts', 'A2_bloki/14_led-external-adapter.tsx',
    'A2_bloki/16_led-engine.ts',
    'A2_bloki/02_bloki-bay-actions.ts', 'A2_bloki/01_bloki-ui.tsx',
    'A7_material/material-commands.ts',
];
const BLOKI_CONTRACT_LINE = /(?:pushUpdate|triggerUpdate|generatorParams\s*=|\b(?:gp|generatorParams)\s*[.[]|\b(?:normalize(?:Doors|SkosneDoors|Drawers|Flaps|Shelves|Shelf|Dividers|Panels|Tubes|LedInternal|LedExternal)|build(?:Doors|SkosneDoors|Drawers|Flaps|Shelves|Shelf|Dividers|Panels|Tubes|LedInternal|LedExternal|Led))(?:Plan|Params)\()/;
let blokiModuleFindings = 0;
console.log(`\n## BLOKI-MODULE-LEGACY (wszystkie moduły A2 — tylko kanoniczne klucze)`);
for (const rel of BLOKI_MODULE_FILES) {
    const f = requirePath(rel);
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
        const t = line.trim();
        if (!t || t.startsWith('//') || t.startsWith('*')) return;
        if (!BLOKI_CONTRACT_LINE.test(t)) return;
        if (BLOKI_MODULE_ALIAS_DICTIONARY.has(rel)) {
            if (/LEGACY_\w+_PARAM_ALIASES|assertCanonical/.test(t)) return;
            if (/^\w+:\s*['"]/.test(t)) return;
        }
        // Granica createBloki: aliasy mapowane tylko w BlokiModalParams / createBlokiGeneratorParams
        if (rel === 'A2_bloki/02_bloki-bay-actions.ts' && /params\?\.\w+/.test(t)) return;
        if (rel === 'A2_bloki/02_bloki-bay-actions.ts' && /BlokiModalParams|createBlokiGeneratorParams/.test(t)) return;
        if (/resolveRuleThicknessMm\([^)]*'(?:front_thickness|thickness|spacer_thickness)'/.test(t)) return;
        if (/grubosc_(?:frontu|polki|wienca|przegrody|blendy)_mm/.test(t)) return;
        // A5 LedChannelDefinition — angielskie klucze kontraktu A5, nie Bloki
        if (/LedChannelDefinition|offsetFromFrontMm:\s*offsetFront|grooveWidthMm:\s*grooveW|grooveDepthMm:\s*grooveD|cutSides,\s*$/.test(t)) return;
        for (const alias of BLOKI_MODULE_LEGACY) {
            const keyRe = new RegExp(`(^|[\\s{(,\\[])${alias}\\s*:`);
            const readRe = new RegExp(`\\b(?:gp|generatorParams|params|raw)\\.${alias}\\b`);
            if (keyRe.test(t) || readRe.test(t)) {
                blokiModuleFindings++;
                console.log(`  [BLOKI-MODULE-LEGACY] ${rel}:${i + 1}: ${t.slice(0, 140)}`);
                break;
            }
        }
    });
}
console.log(`  → ${blokiModuleFindings}`);
if (blokiModuleFindings > 0) process.exitCode = 1;

// ─── Strażnik kompatybilności wstecznej ────────────────────────────────
// Wszystkie reguły poniżej blokują CI przy powrocie aliasów / zgadywania jednoski.

/** Zgadywanie jednostki po wartości — wycofane (.agents/AGENTS.md → „Jednostki”). */
const UNIT_GUESS_RES = [
    />\s*50_?000\s*\?\s*nmToMm/,
    />\s*10_?000\s*\?\s*nmToMm/,
    /\bn\s*>\s*\d+\s*\?\s*nmToMm/,
    /Math\.abs\([^)]*\)\s*>\s*10_?000/,
    // surowa arytmetyka zamiast mmToNm/nmToMm
    /\*\s*1_?000_?000\b(?!\s*\/\s*1_?000_?000)/,
    /\/\s*1_?000_?000\b/,
    /\*\s*1000000\b/,
];

/** Wycofane aliasy nazw ścian — wejście tylko FACE_* (SSOT: normalizeFaceName). */
const FACE_ALIAS_RES = [
    /normalizeFaceName\(\s*['"](?:front|back|left|right|top|bottom)['"]/i,
    /normalizeFaceName\(\s*['"][+-][XYZ]['"]/,
    /normalizeFaceName\(\s*['"](?:POS|NEG)_[XYZ]['"]/i,
    /normalizeFaceName\(\s*['"]EDGE_[XY]_(?:MINUS|PLUS)['"]/i,
    /normalizeFaceName\(\s*['"](?:FACE_[XYZ]_(?:TOP|BOTTOM)|TOP_FACE|BOTTOM_FACE)['"]/i,
];

/** Bare width/height/depth w DTO Bloki — dozwolone tylko *_mm. */
const BLOKI_DIM_RES = [
    /\bparams\.(width|height|depth)\b/,
    /\bgp\.(width|height|depth)\b/,
    /\bdims\.(width|height|depth)\b/,
];

/** Wycofane typy/aliasy jednostek i wycofany format CAM. */
const DEAD_API_RES = [
    [/\bProcessedCAMProject\b/, 'wycofany format CAM — postprocessory przyjmują wyłącznie CLDataProgram'],
    [/\binchToNm\b|\bnmToInch\b/, 'wycofany przelicznik cali — użyj INCH_TO_NM_FACTOR'],
    [/\bTO_MICRONS\b|\bMicrons\b/, 'wycofany alias "mikrony" — użyj TO_NM / Nanometers'],
];

const UNIT_GUESS_DIRS = ['A1_core', 'A2_bloki', 'A3_smartframe', 'A4_smartpanel',
    'A6_agd', 'C1_cnc', 'C2_connectors', 'R1_reports', 'R2_rys', 'D1_draw', 'S2_solver',
    'S4_sciany', 'src', 'B1_biblioteka', 'A8_pmi'];
const FACE_ALIAS_DIRS = ['A1_core', 'A2_bloki', 'A3_smartframe', 'A4_smartpanel',
    'A6_agd', 'C2_connectors', 'S2_solver', 'o1_operacji'];
const BLOKI_DIM_DIRS = ['A2_bloki'];
const DEAD_API_DIRS = UNIT_GUESS_DIRS;

/** Pliki, w których dany wzorzec jest DANE (słownik aliasów, test kontraktu), nie wywołaniem. */
const DEAD_API_ALLOWED = new Set([
    'C1_cnc/dto/cam-dto.ts',                        // opisuje wycofanie ProcessedCAMProject
    'A1_core/cad-math/units.ts',                    // INCH_TO_NM_FACTOR + komentarz o usuniętych fn
    'A1_core/unit-system.ts',                       // komentarz o usuniętych aliasach
    'scripts/audit-display-name-logic.mjs',         // sam strażnik
]);

let compatFindings = 0;

function scanDirs(label, dirs, res, allowBareDims) {
    console.log(`\n## ${label}`);
    let count = 0;
    for (const d of dirs) {
        const abs = requirePath(d, 'katalog');
        for (const f of walk(abs)) {
            const rel = path.relative(webRoot, f).split(path.sep).join('/');
            if (DEAD_API_ALLOWED.has(rel)) continue;
            const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
            lines.forEach((line, i) => {
                const t = line.trim();
                if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
                // `/ 1_000_000` w nmToMm-ekwiwalentach i w jawnych konwersjach jest OK,
                // bo sprawdzamy parę: konwersja *1e6 do nm bez nmToMm jest podejrzana.
                const hit = res.some((re) => re.test(t));
                if (!hit) return;
                if (allowBareDims) {
                    // DTO Bloki: dopuszczamy `container.width` (model CAD w nm) i
                    // `params.width_mm`; wycinamy tylko `.width/.height/.depth` bez _mm.
                    const bare = t.match(/\b(params|gp|dims)\.(width|height|depth)\b/);
                    if (!bare) return;
                }
                count++;
                compatFindings++;
                console.log(`  [${label}] ${rel}:${i + 1}: ${t.slice(0, 140)}`);
            });
        }
    }
    console.log(`  → ${count}`);
    return count;
}

scanDirs('UNIT-GUESS (brak zgadywania jednostki po wartości)', UNIT_GUESS_DIRS, UNIT_GUESS_RES, true);
scanDirs('FACE-ALIAS (normalizeFaceName tylko FACE_*)', FACE_ALIAS_DIRS, FACE_ALIAS_RES, false);
scanDirs('BLOKI-DIMS (tylko width_mm/height_mm/depth_mm)', BLOKI_DIM_DIRS, BLOKI_DIM_RES, false);
const DEAD_API_ALL = new RegExp(DEAD_API_RES.map(([re]) => re.source).join('|'));
scanDirs('DEAD-API (wycofane eksporty)', DEAD_API_DIRS, [DEAD_API_ALL], false);

console.log('  wycofane API: ' + DEAD_API_RES.map(([, why]) => why).join(' | '));

console.log(`\nZnalezionych naruszeń kompatybilności wstecznej: ${compatFindings}`);
if (compatFindings > 0) process.exitCode = 1;

// ─── Kontrakty wejściowe Bloki: bez any i bez anonimowych map parametrów ───
const blokiRoot = requirePath('A2_bloki', 'katalog');
const blokiSourceFiles = walk(blokiRoot).filter((file) => {
    const rel = path.relative(blokiRoot, file).split(path.sep).join('/');
    return /(?:-engine|module-plans|-adapter)\.(?:ts|tsx)$/.test(rel) || rel === 'bloki-ui.tsx';
});
let blokiInputFindings = 0;
console.log('\n## BLOKI-INPUT-TYPES (*PlanParams na granicy domeny)');
for (const file of blokiSourceFiles) {
    const rel = path.relative(webRoot, file).split(path.sep).join('/');
    const source = fs.readFileSync(file, 'utf8');
    for (const violation of findBlokiInputTypeViolations(rel, source)) {
        blokiInputFindings++;
        console.log(`  [BLOKI-INPUT-TYPES] ${violation}`);
    }
}
console.log(`  → ${blokiInputFindings}`);
if (blokiInputFindings > 0) process.exitCode = 1;

// ─── Twardy zakaz wycofanej nazwy modułu w całym repozytorium ───
console.log('\n## ZERO-SMARTBOX (zakaz używania wycofanej nazwy w kodzie i dokumentacji)');
let zeroForbiddenFindings = 0;
const FORBIDDEN_PATTERN = /smart[_\-\s]?box/i;

function walkAllSource(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'scratch') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            walkAllSource(full, out);
        } else if (/\.(?:ts|tsx|js|mjs|cjs|json|md|html|css|txt)$/.test(e.name)) {
            out.push(full);
        }
    }
    return out;
}

const allSourceFiles = walkAllSource(webRoot);

for (const file of allSourceFiles) {
    const rel = path.relative(webRoot, file).split(path.sep).join('/');
    if (rel === 'scripts/audit-display-name-logic.mjs') continue;
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, idx) => {
        const cleanedLine = line.replace(/ZERO-SMARTBOX/g, '');
        if (FORBIDDEN_PATTERN.test(cleanedLine)) {
            zeroForbiddenFindings++;
            console.log(`  [ZERO-SMARTBOX] ${rel}:${idx + 1}: ${line.trim().slice(0, 100)}`);
        }
    });
}
console.log(`  → ${zeroForbiddenFindings}`);
if (zeroForbiddenFindings > 0) process.exitCode = 1;




