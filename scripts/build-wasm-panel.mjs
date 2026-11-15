/**
 * scripts/build-wasm-panel.mjs
 * 
 * Skrypt kompilujący moduł crates/panel_brep do src/wasm/panel_brep.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
const wasmPackExecutable = process.platform === 'win32' 
  ? path.join(cargoBin, 'wasm-pack.exe')
  : path.join(cargoBin, 'wasm-pack');

const env = { ...process.env, PATH: `${cargoBin}${path.delimiter}${process.env.PATH || ''}` };

console.log(`[build-wasm-panel] Kompilacja crates/panel_brep za pomocą wasm-pack...`);

const rustDir = path.join(ROOT_DIR, 'crates', 'panel_brep');
const outDir = path.join(ROOT_DIR, 'src', 'wasm', 'panel_brep');

const res = spawnSync(wasmPackExecutable, ['build', '--target', 'web', '--out-dir', `"${outDir}"`], {
  cwd: rustDir,
  env,
  stdio: 'inherit',
  shell: true
});

if (res.status !== 0) {
  console.error('[build-wasm-panel] Błąd kompilacji wasm-pack');
  process.exit(res.status || 1);
} else {
  console.log('[build-wasm-panel] Pomyślnie skompilowano WASM Panel B-Rep!');
}

