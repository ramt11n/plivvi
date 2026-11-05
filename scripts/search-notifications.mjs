import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function publicEntries(manifest, origin) {
  const expected = new URL(origin);
  return (manifest?.entries ?? []).filter((entry) => {
    try {
      const url = new URL(entry.url);
      return (
        url.origin === expected.origin &&
        !url.search &&
        !url.hash &&
        !/^\/(documents|account|redirect(?:\.html)?|404)(\/|$)/.test(url.pathname) &&
        typeof entry.hash === 'string' &&
        /^[a-f0-9]{64}$/.test(entry.hash)
      );
    } catch {
      return false;
    }
  });
}
export function changedURLs(current, previous, origin) {
  const before = new Map(publicEntries(previous, origin).map((entry) => [entry.url, entry.hash]));
  const after = new Map(publicEntries(current, origin).map((entry) => [entry.url, entry.hash]));
  return [
    ...new Set([
      ...[...after].filter(([url, hash]) => before.get(url) !== hash).map(([url]) => url),
      ...[...before.keys()].filter((url) => !after.has(url)),
    ]),
  ];
}
async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function save(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((value) => value.replace(/^--/, '').split('=')),
  );
  const current = await readJSON('dist/search-manifest.json');
  if (!current) throw Error('Build the site before notifying search engines.');
  const { origin } = current;
  if (args.snapshot) {
    const response = await fetch(origin + '/search-manifest.json', {
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });
    if (!response.ok && response.status !== 404)
      throw Error(`Previous manifest: HTTP ${response.status}`);
    const previous = response.ok ? await response.json() : { origin, entries: [] };
    if (previous.origin !== origin) throw Error('Previous manifest has a different origin.');
    await save(args.snapshot, previous);
    console.log(
      `Saved previous public search manifest (${publicEntries(previous, origin).length} pages).`,
    );
    return;
  }
  const previous = await readJSON(args.previous ?? '.sites-runtime/indexnow-submitted.json');
  const urls = changedURLs(current, previous, origin);
  if (!urls.length) {
    console.log('No content changes to notify.');
    return;
  }
  const config = await readJSON('src/seo/indexnow.json');
  const keyLocation = origin + '/' + config.key + '.txt';
  const keyResponse = await fetch(keyLocation, { signal: AbortSignal.timeout(20000) });
  if (!keyResponse.ok || (await keyResponse.text()).trim() !== config.key)
    throw Error('Public ownership proof is not deployed.');
  // Only URLs from our public search manifest are submitted. No visitor data is involved.
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      host: new URL(origin).host,
      key: config.key,
      keyLocation,
      urlList: urls,
    }),
  });
  const body = await response.text();
  const receipt = {
    submittedAt: new Date().toISOString(),
    status: response.status,
    urlCount: urls.length,
    urls,
    meaning:
      response.status === 200
        ? 'Received by IndexNow; indexing is not guaranteed.'
        : response.status === 202
          ? 'Accepted; key validation pending. Indexing is not guaranteed.'
          : 'Submission failed.',
    response: body.slice(0, 1000),
  };
  await save('.sites-runtime/indexnow-receipt.json', receipt);
  console.log(JSON.stringify(receipt, null, 2));
  if (![200, 202].includes(response.status)) throw Error('IndexNow rejected the submission.');
  await save('.sites-runtime/indexnow-submitted.json', current);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
