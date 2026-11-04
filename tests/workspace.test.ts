import { beforeEach, describe, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../src/lib/storage', () => ({
  get: async (key: string) => structuredClone(store.get(key)),
  set: async (key: string, value: unknown) => {
    await Promise.resolve();
    store.set(key, structuredClone(value));
  },
  del: async (key: string) => {
    store.delete(key);
  },
}));
import {
  appendDocuments,
  clearDocuments,
  documentKey,
  readDocuments,
  readerDraftKey,
  removeDocument,
  updateDocument,
  workspaceId,
} from '../src/lib/workspace';
const file = (name: string) => ({ name, type: 'application/pdf', data: new Uint8Array([1, 2, 3]) });
beforeEach(() => store.clear());
describe('account document workspaces', () => {
  it('keeps legacy guest files accessible without assigning them to a signed-in account', async () => {
    store.set('pocket-documents', [{ id: 'old', name: 'Guest.pdf' }]);
    expect((await readDocuments('guest'))[0].name).toBe('Guest.pdf');
    expect(await readDocuments(workspaceId('alice'))).toEqual([]);
    expect(documentKey(workspaceId('guest'))).not.toBe(documentKey('guest'));
  });
  it('keeps concurrent saves separate between accounts and preserves both saves to one account', async () => {
    const alice = workspaceId('alice'),
      bob = workspaceId('bob');
    await Promise.all([
      appendDocuments(alice, [file('A.pdf')]),
      appendDocuments(alice, [file('B.pdf')]),
      appendDocuments(bob, [file('C.pdf')]),
      appendDocuments('guest', [file('D.pdf')]),
    ]);
    expect((await readDocuments(alice)).map((d) => d.name).sort()).toEqual(['A.pdf', 'B.pdf']);
    expect((await readDocuments(bob)).map((d) => d.name)).toEqual(['C.pdf']);
    expect((await readDocuments('guest')).map((d) => d.name)).toEqual(['D.pdf']);
  });
  it('renames, files, and removes a document only inside the chosen account', async () => {
    const alice = workspaceId('alice'),
      bob = workspaceId('bob');
    const [a] = await appendDocuments(alice, [file('Contract.pdf')]);
    store.set(documentKey(bob), [{ ...a, name: 'Bob.pdf' }]);
    await updateDocument(alice, a.id, { name: 'Signed.pdf', folder: 'Work' });
    expect((await readDocuments(alice))[0]).toMatchObject({ name: 'Signed.pdf', folder: 'Work' });
    expect((await readDocuments(bob))[0].name).toBe('Bob.pdf');
    await removeDocument(alice, a.id);
    expect(await readDocuments(alice)).toEqual([]);
    expect(await readDocuments(bob)).toHaveLength(1);
  });
  it('clears only the active library', async () => {
    await appendDocuments('alice', [file('A.pdf')]);
    await appendDocuments('bob', [file('B.pdf')]);
    await clearDocuments('alice');
    expect(await readDocuments('alice')).toEqual([]);
    expect(await readDocuments('bob')).toHaveLength(1);
  });
  it('isolates reader drafts by account and fingerprints the whole PDF', async () => {
    const first = new Uint8Array(1048580),
      second = new Uint8Array(first);
    second[1048578] = 42;
    const key = await readerDraftKey('guest', first.buffer);
    expect(await readerDraftKey(workspaceId('alice'), first.buffer)).not.toBe(key);
    expect(await readerDraftKey('guest', second.buffer)).not.toBe(key);
  });
});
