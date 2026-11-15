import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const ASSET_MATERIALS_DIRS = [
  path.resolve('C:\\Users\\ADM\\Desktop\\render_konfigurator\\asety_eger'),
  path.resolve('..', '..', 'asset_materials', 'Eger asset drewno', 'eger_drewno'),
  path.resolve('..', '..', 'asset_materials', 'Eger asset  kolor', 'eger_kolor'),
  path.resolve('..', '..', 'asset_materials', 'Eger asset mineral', 'eger_mineral'),
  path.resolve('..', '..', 'asset_materials')
];

function findFileRecursive(dir: string, predicate: (name: string) => boolean): string | null {
  if (!fs.existsSync(dir)) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileRecursive(full, predicate);
        if (found) return found;
      } else if (entry.isFile() && predicate(entry.name)) {
        return full;
      }
    }
  } catch (e) {}
  return null;
}

function serveEggerTexturesPlugin() {
  return {
    name: 'serve-egger-textures',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/textures/egger/')) {
          const filename = decodeURIComponent(req.url.replace('/textures/egger/', '').split('?')[0]);
          const baseName = filename.replace(/(_Albedo)?\.(png|jpg|jpeg|webp)$/i, '').toLowerCase();

          for (const dir of ASSET_MATERIALS_DIRS) {
            const found = findFileRecursive(dir, (f) => {
              const fLow = f.toLowerCase();
              return f === filename ||
                     fLow === filename.toLowerCase() ||
                     (fLow.includes(baseName) && (fLow.includes('albedo') || fLow.endsWith('.png') || fLow.endsWith('.webp') || fLow.endsWith('.jpg')));
            });
            if (found) {
              const ext = path.extname(found).toLowerCase();
              const mime = ext === '.webp' ? 'image/webp' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
              res.setHeader('Content-Type', mime);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              return fs.createReadStream(found).pipe(res);
            }
          }
        }
        next();
      });
    }
  };
}

function serveKitchenDemoPlugin() {
  return {
    name: 'serve-kitchen-demo',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: () => void) => {
        if (req.url?.split('?')[0] !== '/__demo/kuchnia') return next();
        const filePath = path.resolve(process.cwd(), 'Kuchnia_liniowa_demo.spp.json');
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Brak pliku demonstracyjnego kuchni.');
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(filePath).pipe(res);
      });
    }
  };
}

function serveB1BibliotekaPlugin() {
  const B1_ROOT = path.resolve(process.cwd(), 'B1_biblioteka');
  const STATIC_EXTS: Record<string, string> = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.obj': 'text/plain',
    '.stl': 'model/stl',
    '.bin': 'application/octet-stream'
  };

  return {
    name: 'serve-b1-biblioteka',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const rawUrl = req.url ? req.url.split('?')[0] : '';
        if (rawUrl.startsWith('/B1_biblioteka/') || rawUrl.startsWith('./B1_biblioteka/')) {
          const ext = path.extname(rawUrl).toLowerCase();
          // Bezwzględnie przepuszczaj moduły TypeScript/JS oraz żądania Vite (?import, ?t= itp.)
          if (!STATIC_EXTS[ext] || req.url.includes('?import') || req.url.includes('?t=') || req.url.includes('?v=')) {
            return next();
          }

          const subPath = decodeURIComponent(rawUrl.replace(/^\.?\/B1_biblioteka\//, ''));
          let fullPath = path.resolve(B1_ROOT, subPath);
          if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
            const targetBase = path.basename(subPath).toLowerCase();
            const targetDir = path.resolve(B1_ROOT, path.dirname(subPath));
            if (fs.existsSync(targetDir)) {
              try {
                const files = fs.readdirSync(targetDir);
                const match = files.find(f => f.toLowerCase() === targetBase);
                if (match) {
                  fullPath = path.join(targetDir, match);
                }
              } catch {}
            }
          }
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const mime = STATIC_EXTS[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return fs.createReadStream(fullPath).pipe(res);
          }
          // Kluczowe: jeśli zasobu statycznego nie ma w B1, zwróć 404 zamiast index.html (zapobiega próbie parsowania HTML przez Babylon)
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('404 Not Found in B1_biblioteka');
          return;
        }
        next();
      });
    }
  };
}

import { fileURLToPath } from 'node:url';
import wasm from 'vite-plugin-wasm';
import { b1ZawieszkiPlugin } from './vite-plugin-b1-zawieszki.ts';
import { pricesApiPlugin } from './vite-plugin-prices-api.ts';
import { hardwareApiPlugin } from './vite-plugin-hardware-api.ts';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  plugins: [wasm(), react(), serveB1BibliotekaPlugin(), serveEggerTexturesPlugin(), serveKitchenDemoPlugin(), b1ZawieszkiPlugin(), pricesApiPlugin(), hardwareApiPlugin()],
  server: {
    port: 8085
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        landing: fileURLToPath(new URL('landing.html', import.meta.url)),
        nesting: fileURLToPath(new URL('nesting.html', import.meta.url)),
        draw: fileURLToPath(new URL('draw.html', import.meta.url)),
        report: fileURLToPath(new URL('report.html', import.meta.url)),
        cnc: fileURLToPath(new URL('cnc.html', import.meta.url)),
        dag: fileURLToPath(new URL('dag.html', import.meta.url)),
        studio: fileURLToPath(new URL('studio.html', import.meta.url)),
        cennik: fileURLToPath(new URL('cennik.html', import.meta.url)),
        wiercenia: fileURLToPath(new URL('wiercenia.html', import.meta.url)),
        instrukcja: fileURLToPath(new URL('instrukcja.html', import.meta.url)),
        platforma: fileURLToPath(new URL('platforma.html', import.meta.url))
      }
    }
  },
  test: {
    setupFiles: ['./test/setup-storage.ts', './src/application/project-domain.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/scratch/**'],
  }
})

