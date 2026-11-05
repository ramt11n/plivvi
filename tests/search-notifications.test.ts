import { expect, it } from 'vitest';
// @ts-expect-error deployment script is native JavaScript
import { changedURLs, publicEntries } from '../scripts/search-notifications.mjs';
const origin = 'https://plivvi.pages.dev';
const entry = (path: string, n = 'a') => ({ url: origin + path, hash: n.repeat(64) });
it('notifies changed, new and removed public URLs, without repeating unchanged content', () => {
  const before = { entries: [entry('/merge-pdf/'), entry('/split-pdf/'), entry('/old-guide/')] };
  const after = { entries: [entry('/merge-pdf/'), entry('/split-pdf/', 'b'), entry('/guides/')] };
  expect(changedURLs(after, before, origin)).toEqual([
    origin + '/split-pdf/',
    origin + '/guides/',
    origin + '/old-guide/',
  ]);
  expect(changedURLs(after, after, origin)).toEqual([]);
});
it('never submits private workspace paths, foreign origins or query-string visitor state', () => {
  const entries = [
    entry('/account/'),
    entry('/documents/'),
    entry('/404/'),
    entry('/redirect.html'),
    entry('/?private=1'),
    { ...entry('/'), url: 'https://example.com/' },
    entry('/pdf-reader/'),
  ];
  expect(publicEntries({ entries }, origin)).toEqual([entry('/pdf-reader/')]);
  expect(changedURLs({ entries }, null, origin)).toEqual([origin + '/pdf-reader/']);
});
