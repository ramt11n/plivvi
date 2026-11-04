import { get, set, del } from './storage';
import type { Output } from './client';
export type StoredDocument = {
  id: string;
  name: string;
  type: string;
  data: Uint8Array;
  date: string;
  size: number;
  folder?: string;
};
export const workspaceId = (uid?: string) => (uid ? `account-${uid}` : 'guest');
export const documentKey = (workspace: string) =>
  workspace === 'guest' ? 'pocket-documents' : `pocket-documents:${workspace}`;
export const readerDraftPrefix = (workspace: string) =>
  workspace === 'guest' ? 'pocket-reader-' : `pocket-reader:${workspace}:`;
const queues = new Map<string, Promise<unknown>>();
function change<T>(workspace: string, operation: () => Promise<T>): Promise<T> {
  const pending = (queues.get(workspace) ?? Promise.resolve()).catch(() => {}).then(operation);
  queues.set(workspace, pending);
  pending
    .finally(() => {
      if (queues.get(workspace) === pending) queues.delete(workspace);
    })
    .catch(() => {});
  return pending;
}
export async function readDocuments(workspace: string) {
  return (await get<StoredDocument[]>(documentKey(workspace))) ?? [];
}
export async function appendDocuments(workspace: string, outputs: Output[]) {
  return change(workspace, async () => {
    const entries = outputs.map((o) => ({
      id: crypto.randomUUID(),
      name: o.name,
      type: o.type,
      data: o.data,
      date: new Date().toISOString(),
      size: o.data.length,
    }));
    const next = [...entries, ...(await readDocuments(workspace))];
    await set(documentKey(workspace), next);
    return next;
  });
}
export async function updateDocument(
  workspace: string,
  id: string,
  changes: { name?: string; folder?: string },
) {
  return change(workspace, async () => {
    const next = (await readDocuments(workspace)).map((d) =>
      d.id === id ? { ...d, ...changes } : d,
    );
    await set(documentKey(workspace), next);
    return next;
  });
}
export async function removeDocument(workspace: string, id: string) {
  return change(workspace, async () => {
    const next = (await readDocuments(workspace)).filter((d) => d.id !== id);
    await set(documentKey(workspace), next);
    return next;
  });
}
export async function clearDocuments(workspace: string) {
  return change(workspace, async () => {
    await del(documentKey(workspace));
  });
}

export async function readerDraftKey(workspace: string, data: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return (
    readerDraftPrefix(workspace) +
    Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('') +
    '-' +
    data.byteLength
  );
}
