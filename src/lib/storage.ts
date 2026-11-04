// Keep the existing idb-keyval database and keys. Never replace an unreadable
// library with an empty one: callers must see the error before any write.
let connection: Promise<IDBDatabase> | undefined;
const failure = () =>
  Error(
    'Browser storage did not respond. Close other Plivvi tabs, then reload and try again. Your saved data has not been cleared.',
  );
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    let finished = false;
    const request = indexedDB.open('keyval-store');
    const timer = setTimeout(() => {
      finished = true;
      connection = undefined;
      reject(failure());
    }, 10000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('keyval'))
        request.result.createObjectStore('keyval');
    };
    request.onsuccess = () => {
      const db = request.result;
      if (finished) {
        db.close();
        return;
      }
      finished = true;
      clearTimeout(timer);
      db.onclose = db.onversionchange = () => {
        connection = undefined;
        db.close();
      };
      resolve(db);
    };
    request.onerror = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      connection = undefined;
      reject(request.error ?? failure());
    };
  }).catch((error) => {
    connection = undefined;
    throw error;
  }));
}
async function operation<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction('keyval', mode);
    } catch (error) {
      connection = undefined;
      db.close();
      reject(error);
      return;
    }
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      // Abort stalled writes so they cannot commit after the UI reports failure.
      try {
        transaction.abort();
      } catch {}
      connection = undefined;
      db.close();
      reject(failure());
    }, 10000);
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      connection = undefined;
      db.close();
      reject(error ?? failure());
    };
    transaction.onabort = transaction.onerror = () => fail(transaction.error);
    try {
      const request = run(transaction.objectStore('keyval'));
      transaction.oncomplete = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(request.result);
      };
    } catch (error) {
      try {
        transaction.abort();
      } catch {}
      fail(error);
    }
  });
}
export const get = <T>(key: IDBValidKey) =>
  operation<T | undefined>('readonly', (store) => store.get(key));
export const set = (key: IDBValidKey, value: unknown) =>
  operation('readwrite', (store) => store.put(value, key)).then(() => {});
export const del = (key: IDBValidKey) => operation('readwrite', (store) => store.delete(key));
