import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Cloud,
  Download,
  FileText,
  Folder,
  FolderOpen,
  ShieldCheck,
  Unplug,
  Upload,
  X,
} from 'lucide-react';
import { download, type Output } from '../lib/client';
import { bytes } from '../lib/catalog';
import { integrationConfig, type IntegrationConfig } from '../integrations/config';
import {
  prepareGoogle,
  microsoftClient,
  importGoogle,
  exportGoogle,
  listOneDrive,
  importOneDrive,
  exportOneDrive,
  disconnectCloud,
  type CloudItem,
} from '../integrations/cloud';
export default function CloudDialog({
  output,
  onImport,
  onClose,
}: {
  output?: Output;
  onImport: (files: File[]) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<IntegrationConfig>(),
    [ready, setReady] = useState({ google: false, microsoft: false }),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [items, setItems] = useState<CloudItem[] | null>(null),
    [folders, setFolders] = useState<{ id?: string; name: string }[]>([{ name: 'OneDrive' }]),
    [filter, setFilter] = useState(''),
    [more, setMore] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    integrationConfig().then((c) => {
      if (!alive) return;
      setConfig(c);
      if (c.google?.clientId && c.google.apiKey && c.google.appId)
        prepareGoogle()
          .then(() => alive && setReady((r) => ({ ...r, google: true })))
          .catch((e) => alive && setError(e.message));
      if (c.microsoft?.clientId)
        microsoftClient()
          .then(() => alive && setReady((r) => ({ ...r, microsoft: true })))
          .catch((e) => alive && setError(e.message));
    });
    return () => {
      alive = false;
    };
  }, []);
  async function run(provider: 'google' | 'microsoft') {
    setBusy(provider);
    setError('');
    setMessage('');
    try {
      if (output) {
        const name =
          provider === 'google'
            ? await exportGoogle(output, setBusy)
            : await exportOneDrive(output);
        setMessage(`Saved a new copy: ${name}`);
      } else if (provider === 'google') {
        const files = await importGoogle();
        if (files.length) {
          onImport(files);
          onClose();
        }
      } else {
        const result = await listOneDrive();
        setItems(result.items);
        setMore(result.more);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function folder(id?: string, name = 'OneDrive', back?: number) {
    setBusy('folder');
    setError('');
    try {
      const result = await listOneDrive(id);
      setItems(result.items);
      setMore(result.more);
      setFolders((old) => (back !== undefined ? old.slice(0, back + 1) : [...old, { id, name }]));
      setFilter('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  const enabled = {
    google: !!(config?.google?.clientId && config.google.apiKey && config.google.appId),
    microsoft: !!config?.microsoft?.clientId,
  };
  return (
    <div className="modal-shade cloud-shade">
      <section
        className="info-dialog cloud-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-title"
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close cloud connections"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="tool-icon blue">
          <Cloud />
        </span>
        <span className="eyebrow">YOUR FILES. YOUR CHOICE.</span>
        <h2 id="cloud-title">
          {output ? 'Give your copy a home.' : 'Bring a file from your cloud.'}
        </h2>
        <p>
          {output
            ? `Save ${output.name} (${bytes(output.data.length)}) directly to a provider you choose. New copies receive a unique name.`
            : 'Choose a provider or use your device’s Files picker. Imported documents are processed in your browser.'}
        </p>
        <input
          ref={input}
          hidden
          type="file"
          accept="application/pdf,image/*,.docx,.xlsx,.pptx,.txt,.md,.html"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) {
              onImport(files);
              onClose();
            }
            e.target.value = '';
          }}
        />
        {items ? (
          <div className="cloud-file-browser">
            <div className="cloud-breadcrumb">
              {folders.map((f, i) => (
                <button key={i} disabled={!!busy} onClick={() => folder(f.id, f.name, i)}>
                  {i > 0 ? ' / ' : ''}
                  {f.name}
                </button>
              ))}
            </div>
            <input
              aria-label="Filter OneDrive files"
              placeholder="Filter these files…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="cloud-items">
              {items
                .filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()))
                .sort(
                  (a, b) => Number(!!b.folder) - Number(!!a.folder) || a.name.localeCompare(b.name),
                )
                .map((item) => (
                  <button
                    key={item.id}
                    disabled={!!busy}
                    onClick={async () => {
                      if (item.folder) {
                        folder(item.id, item.name);
                        return;
                      }
                      setBusy(item.id);
                      try {
                        const file = await importOneDrive(item);
                        onImport([file]);
                        onClose();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    {item.folder ? <Folder size={20} /> : <FileText size={20} />}
                    <span>
                      {item.name}
                      <small>{item.folder ? 'Folder' : bytes(item.size)}</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
            </div>
            {!items.length && <p>This folder is empty.</p>}
            {more && (
              <p className="small muted">
                Showing the first 200 items. Open a narrower folder, or use your system Files picker
                for a larger collection.
              </p>
            )}
            <button className="text-button" onClick={() => setItems(null)}>
              <ArrowLeft size={14} />
              Back to providers
            </button>
          </div>
        ) : (
          <div className="cloud-provider-list">
            <button
              className="cloud-provider"
              disabled={!enabled.google || !ready.google || !!busy}
              onClick={() => run('google')}
            >
              <span className="provider-mark drive">△</span>
              <span>
                <strong>Google Drive</strong>
                <small>
                  {!config
                    ? 'Checking…'
                    : !enabled.google
                      ? 'Not enabled on this deployment yet'
                      : !ready.google
                        ? 'Preparing secure connection…'
                        : output
                          ? 'Save a new copy to your Drive'
                          : 'Choose specific files with Google Picker'}
                </small>
              </span>
              {busy === 'google' ? <span className="spinner" /> : <ArrowUpRight size={17} />}
            </button>
            <button
              className="cloud-provider"
              disabled={!enabled.microsoft || !ready.microsoft || !!busy}
              onClick={() => run('microsoft')}
            >
              <span className="provider-mark onedrive">
                <Cloud size={26} />
              </span>
              <span>
                <strong>Microsoft OneDrive</strong>
                <small>
                  {!config
                    ? 'Checking…'
                    : !enabled.microsoft
                      ? 'Not enabled on this deployment yet'
                      : !ready.microsoft
                        ? 'Preparing secure connection…'
                        : output
                          ? 'Save a new copy to your OneDrive'
                          : 'Browse your OneDrive files'}
                </small>
              </span>
              {busy === 'microsoft' ? <span className="spinner" /> : <ArrowUpRight size={17} />}
            </button>
            <button
              className="cloud-provider"
              disabled={!!busy}
              onClick={async () => {
                if (!output) {
                  input.current?.click();
                  return;
                }
                try {
                  const file = new File([output.data as BlobPart], output.name, {
                    type: output.type,
                  });
                  if (navigator.canShare?.({ files: [file] }))
                    await navigator.share({ files: [file], title: output.name });
                  else download(output);
                } catch (e) {
                  if ((e as Error).name !== 'AbortError')
                    setError('Use Download to save this copy through your browser.');
                }
              }}
            >
              <span className="provider-mark files">
                <FolderOpen size={25} />
              </span>
              <span>
                <strong>
                  {output ? 'Files / Share sheet' : 'Files, iCloud & other providers'}
                </strong>
                <small>
                  {output
                    ? 'Choose a destination offered by your device'
                    : 'Use cloud providers available in your device’s file picker'}
                </small>
              </span>
              {output ? <Download size={17} /> : <Upload size={17} />}
            </button>
          </div>
        )}
        <div className="cloud-privacy">
          <ShieldCheck size={18} />
          <p>
            Cloud connections are optional. Selecting or saving a file shares it directly with that
            provider. Document tools remain free and usable locally. Google access is limited to
            files you select or create with Pocket.
          </p>
        </div>
        {(enabled.google || enabled.microsoft) && (
          <button
            className="text-button"
            disabled={!!busy}
            onClick={async () => {
              await disconnectCloud();
              setMessage(
                'Local cloud sessions cleared. Provider grants can be revoked in your Google or Microsoft account settings.',
              );
            }}
          >
            <Unplug size={14} />
            Disconnect cloud sessions
          </button>
        )}
        {busy && (
          <p className="processing-line" role="status">
            <span className="spinner" />
            {busy.startsWith('Saving') ? busy : 'Connecting securely…'}
          </p>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="account-message" role="status">
            <Check size={15} />
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
