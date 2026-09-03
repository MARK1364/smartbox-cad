/**
 * Bramka TypeScript dla A1_core + A2_smartbox.
 * tsc --noEmit pada na starych błędach poza tymi folderami (sketcher, CNC…).
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
            /A2_smartbox[/\\]/.test(line) ||
            /Biblioteki[/\\]/.test(line) ||
            /A4_smartpanel[/\\]/.test(line) ||
            /A7_material[/\\]/.test(line) ||
            /S2_solver[/\\]/.test(line) ||
            /C2_connectors[/\\]/.test(line) ||
            /o1_operacji[/\\]/.test(line))
    );

if (gateErrors.length > 0) {
    console.error(gateErrors.join('\n'));
    console.error(`\nCore typecheck failed: ${gateErrors.length} error(s).`);
    process.exit(1);
}

console.log('Core typecheck ok (A1 + A2 + Biblioteki + A4 + A7 + S2 + C2 + O1).');
