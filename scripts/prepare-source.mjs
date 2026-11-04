import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  files = {};
await writeFile(path.join(root,'src/lib/engine-info.json'), JSON.stringify({wasmBytes:(await stat(path.join(root,'node_modules/mupdf/dist/mupdf-wasm.wasm'))).size})+'\n');
const roots = [
  'src',
  'public',
  'tests',
  'scripts',
  'docs',
  'project-site',
  '.github',
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'LICENSE',
  '.env.example',
  '.prettierrc.json',
  '.prettierignore',
  'redirect.html',
  'FEATURE-RESEARCH.md',
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  'vitest.config.ts',
  'tsconfig.json',
  '.gitignore',
];
async function add(relative) {
  if (relative === 'public/source.zip' || relative.endsWith('.tsbuildinfo')) return;
  const full = path.join(root, relative);
  try {
    for (const child of await readdir(full)) await add(`${relative}/${child}`);
  } catch (error) {
    if (error.code !== 'ENOTDIR') throw error;
    files[`plivvi/${relative}`] = [
      new Uint8Array(await readFile(full)),
      { mtime: new Date('2026-11-01T00:00:00Z') },
    ];
  }
}
for (const name of roots) await add(name);
files['plivvi/SOURCE-NOTICE.txt'] = strToU8(
  JSON.parse(await readFile(path.join(root, 'src/brand.json'), 'utf8')).name +
    ' application source, AGPL-3.0-or-later. See README.md and public/THIRD-PARTY-NOTICES.txt for build instructions and corresponding dependency sources.\n',
);
const archive = zipSync(files, { level: 6 });
await writeFile(path.join(root, 'public/source.zip'), archive);
console.log(
  `Source archive: ${Object.keys(files).length} files, ${(archive.length / 1024 / 1024).toFixed(1)} MB`,
);
