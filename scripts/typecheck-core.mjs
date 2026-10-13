/**
 * Bramka TypeScript dla A1_core + A2 + A3 + A4 + A5 + C1_cnc (+ powiązane).
 * tsc --noEmit pada na starych błędach poza tymi folderami (sketcher…).
 * Vite/esbuild nie łapie braku importu — to wychodzi w runtime.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('npx tsc --noEmit --pretty false', {
    cwd: webRoot,
    encoding: 'utf8',
    shell: true
});

const text = `${result.stdout || ''}${result.stderr || ''}`;
const gateErrors = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
        /error TS\d+/.test(line) &&
        (/A1_core[/\\]/.test(line) ||
            /A2_bloki[/\\]/.test(line) ||
            /A3_smartframe[/\\]/.test(line) ||
            /A5_smartparts[/\\]/.test(line) ||
            /C1_cnc[/\\]/.test(line) ||
            /B1_biblioteka[/\\]/.test(line) ||
            /A4_smartpanel[/\\]/.test(line) ||
            /A7_material[/\\]/.test(line) ||
            /S2_solver[/\\]/.test(line) ||
            /C2_connectors[/\\]/.test(line) ||
            /A6_agd[/\\]/.test(line) ||
            /o1_operacji[/\\]/.test(line) ||
            /S5_studio[/\\]/.test(line))
    );

if (gateErrors.length > 0) {
    console.error(gateErrors.join('\n'));
    console.error(`\nCore typecheck failed: ${gateErrors.length} error(s).`);
    process.exit(1);
}

console.log('Core typecheck ok (A1 + A2 + A3 + A4 + A5 + C1 + B1_biblioteka + A7 + S2 + C2 + O1 + S5_studio).');
