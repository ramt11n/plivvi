// Smaller dashboard upload, with corresponding source pinned to the public release.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
const ref = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(ref ?? ''))
  throw Error('Pass the full SHA of the published source commit.');
const files = {};
async function add(relative = '') {
  const directory = path.join('dist', relative);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await add(file);
    else if (file !== 'source.zip') {
      files[file] = new Uint8Array(await readFile(path.join('dist', file)));
      if (files[file].length > 25 * 1024 * 1024) throw Error(`Asset too large: ${file}`);
    }
  }
}
await add();
files['_redirects'] = strToU8(
  `/source.zip https://github.com/ramt11n/plivvi/archive/${ref}.zip 302\n`,
);
const archive = zipSync(files, { level: 6 });
if (archive.length > 25 * 1024 * 1024)
  throw Error('Dashboard ZIP exceeds 25 MiB. Use a folder or Wrangler.');
await mkdir('.sites-runtime', { recursive: true });
await writeFile('.sites-runtime/plivvi-dashboard.zip', archive);
console.log(
  `Dashboard ZIP: ${Object.keys(files).length} files, ${(archive.length / 1048576).toFixed(1)} MiB. Source download is pinned to ${ref}.`,
);
