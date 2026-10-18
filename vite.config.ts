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

import { fileURLToPath } from 'node:url';
import { b1ZawieszkiPlugin } from './vite-plugin-b1-zawieszki.ts';
import { pricesApiPlugin } from './vite-plugin-prices-api.ts';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  plugins: [react(), serveEggerTexturesPlugin(), b1ZawieszkiPlugin(), pricesApiPlugin()],
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
        e3_drawing: fileURLToPath(new URL('e3_drawing.html', import.meta.url)),
        draw: fileURLToPath(new URL('draw.html', import.meta.url)),
        report: fileURLToPath(new URL('report.html', import.meta.url)),
        cnc: fileURLToPath(new URL('cnc.html', import.meta.url)),
        dag: fileURLToPath(new URL('dag.html', import.meta.url)),
        studio: fileURLToPath(new URL('studio.html', import.meta.url)),
        cennik: fileURLToPath(new URL('cennik.html', import.meta.url))
      }
    }
  },
  test: {
    setupFiles: ['./test/setup-storage.ts', './src/application/project-domain.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/scratch/**'],
  }
})

