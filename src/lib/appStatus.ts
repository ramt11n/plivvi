import { useCallback, useEffect, useState } from 'react';
import brand from '../brand.json';
export type AppStatus = {
  state: 'checking' | 'reachable' | 'offline' | 'limited';
  version?: string;
  update: boolean;
  checked?: number;
  error?: string;
};
export function useAppStatus() {
  const [status, setStatus] = useState<AppStatus>({
      state: navigator.onLine ? 'checking' : 'offline',
      update: false,
    }),
    [reloading, setReloading] = useState(false);
  const check = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus((old) => ({ ...old, state: 'offline' }));
      return;
    }
    setStatus((old) => ({ ...old, state: 'checking', error: undefined }));
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/version.json?check=' + Date.now(), {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('Content-Type')?.includes('json'))
        throw Error('The update server did not respond. Your cached tools are still available.');
      const remote = await response.json();
      if (typeof remote.version !== 'string')
        throw Error('The version response was incomplete. Try again.');
      const entry = document
        .querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
        ?.getAttribute('src');
      setStatus({
        state: 'reachable',
        version: remote.version,
        update:
          remote.version !== brand.version || !!(entry && remote.entry && remote.entry !== entry),
        checked: Date.now(),
      });
      navigator.serviceWorker
        ?.getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {});
    } catch (e) {
      setStatus((old) => ({
        ...old,
        state: navigator.onLine ? 'limited' : 'offline',
        error:
          (e as Error).name === 'AbortError'
            ? 'The connection timed out. Try again after your connection settles.'
            : (e as Error).message,
        checked: Date.now(),
      }));
    } finally {
      clearTimeout(timer);
    }
  }, []);
  useEffect(() => {
    let last = 0;
    const refresh = () => {
      if (document.visibilityState === 'hidden' || Date.now() - last < 60000) return;
      last = Date.now();
      check();
    };
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', check);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', check);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [check]);
  async function apply() {
    setReloading(true);
    try {
      const saves: Promise<unknown>[] = [];
      window.dispatchEvent(
        new CustomEvent('plivvi:before-update', {
          detail: { waitUntil: (p: Promise<unknown>) => saves.push(p) },
        }),
      );
      await Promise.all(saves);
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.installing) {
          const installing = reg.installing;
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => finish(Error('The update is still downloading. Please try again shortly.')),
              20000,
            );
            const changed = () => {
              if (installing.state === 'installed' || installing.state === 'activated') finish();
              else if (installing.state === 'redundant')
                finish(Error('The update could not install. Check your connection and retry.'));
            };
            function finish(error?: Error) {
              clearTimeout(timer);
              installing.removeEventListener('statechange', changed);
              error ? reject(error) : resolve();
            }
            installing.addEventListener('statechange', changed);
            changed();
          });
        }
      }
      if (reg?.waiting) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', changed);
            reject(Error('The update is not ready yet. Check again in a moment.'));
          }, 15000);
          function changed() {
            clearTimeout(timer);
            navigator.serviceWorker.removeEventListener('controllerchange', changed);
            resolve();
          }
          navigator.serviceWorker.addEventListener('controllerchange', changed);
          reg.waiting!.postMessage({ type: 'APPLY_UPDATE' });
        });
      }
      location.reload();
    } catch (e) {
      setStatus((old) => ({ ...old, error: (e as Error).message }));
      setReloading(false);
    }
  }
  return { status, check, apply, reloading };
}
