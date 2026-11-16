import './heicWindow.css';
const id = location.hash.slice(1);
if (!/^[\w-]{36}$/.test(id)) throw Error('Open this window from Plivvi’s converter.');
const channel = new BroadcastChannel(`plivvi-heic-${id}`);
const status = document.getElementById('codec-status')!;
const worker = new Worker(new URL('./heic.worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = ({ data }) => {
  if (data.ready) {
    status.textContent = 'Ready. Return to your Plivvi tab to continue.';
    channel.postMessage({ ready: true });
  } else {
    status.textContent = data.error || `Converted ${data.name}.`;
    channel.postMessage(data);
  }
};
worker.onerror = (error) => {
  status.textContent = 'HEIC encoding could not start. Return to Plivvi and retry.';
  channel.postMessage({
    error:
      error.message || 'The HEIC encoder could not start. Retry or choose another output format.',
  });
};
channel.onmessage = ({ data }) => {
  if (data.close) {
    worker.terminate();
    channel.close();
    window.close();
    return;
  }
  if (!data.id || !(data.bytes instanceof ArrayBuffer)) return;
  status.textContent = `Converting ${data.name}…`;
  worker.postMessage(data, [data.bytes]);
};
