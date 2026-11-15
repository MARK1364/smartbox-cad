/**
 * scripts/build-wasm-shelf.mjs
 * 
 * Skrypt kompilujący moduł A2_bloki/03_shelf_rust do src/wasm/shelf.
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

console.log(`[build-wasm-shelf] Kompilacja A2_bloki/03_shelf_rust za pomocą wasm-pack...`);

const rustDir = path.join(ROOT_DIR, 'A2_bloki', '03_shelf_rust');
const outDir = path.join(ROOT_DIR, 'src', 'wasm', 'shelf');

const res = spawnSync(wasmPackExecutable, ['build', '--target', 'web', '--out-dir', `"${outDir}"`], {
  cwd: rustDir,
  env,
  stdio: 'inherit',
  shell: true
});

if (res.status !== 0) {
  console.error('[build-wasm-shelf] Błąd kompilacji wasm-pack');
  process.exit(res.status || 1);
} else {
  console.log('[build-wasm-shelf] Pomyślnie skompilowano WASM Shelf!');
}
