// Export a clean source tree for a public repository. Credentials/runtime/history are never copied.
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination))
  throw Error('Provide an absolute destination directory.');
const root = process.cwd(),
  target = path.resolve(destination);
if (target === root || root.startsWith(target + path.sep))
  throw Error('Choose a separate export directory.');
const entries = [
  'assets',
  'src',
  'public',
  'tests',
  'scripts',
  'docs',
  'project-site',
  '.github',
  'README.md',
  'FEATURE-RESEARCH.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'LICENSE',
  '.env.example',
  '.prettierrc.json',
  '.prettierignore',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'index.html',
  'redirect.html',
  'vite.config.ts',
  'vitest.config.ts',
  'tsconfig.json',
];
await mkdir(target, { recursive: true });
for (const entry of entries)
  await cp(path.join(root, entry), path.join(target, entry), {
    recursive: true,
    force: true,
    filter: (source) => source !== path.join(root, 'public/source.zip'),
  });
console.log(
  `Exported application source to ${target}. No Git history, hosting identity, runtime files, private environment files, or test outputs were included.`,
);
