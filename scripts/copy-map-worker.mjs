// Copies MapLibre's worker next to the panel's own map files (public/map), so
// the point picker loads it from the panel's origin (setWorkerUrl in
// src/components/scheduling/LocationMap.tsx). MapLibre 6 finds its worker
// next to its own module, which a bundled chunk is not. Run before `next dev`
// and `next build`; the copy is not committed (.gitignore).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const from = join(
  dirname(require.resolve('maplibre-gl/package.json')),
  'dist',
  'maplibre-gl-worker.mjs',
);
const to = join(root, 'public', 'map', 'maplibre-gl-worker.mjs');
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
