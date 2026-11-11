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
  RefreshCw,
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
  connectGoogle,
  connectOneDrive,
  cloudConnections,
  importGoogle,
  exportGoogle,
  listOneDrive,
  importOneDrive,
  exportOneDrive,
  disconnectCloud,
  type CloudItem,
  type CloudConnections,
} from '../integrations/cloud';

export default function CloudDialog({
  workspace,
  workspaceLabel,
  output,
  onImport,
  onClose,
}: {
  workspace: string;
  workspaceLabel: string;
  output?: Output;
  onImport: (files: File[]) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<IntegrationConfig>(),
    [connections, setConnections] = useState<CloudConnections>({}),
    [ready, setReady] = useState({ google: false, microsoft: false }),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [savedUrl, setSavedUrl] = useState(''),
    [items, setItems] = useState<CloudItem[] | null>(null),
    [folders, setFolders] = useState<{ id?: string; name: string }[]>([{ name: 'OneDrive' }]),
    [filter, setFilter] = useState(''),
    [nextPage, setNextPage] = useState<string>(),
    [selected, setSelected] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    cloudConnections(workspace).then((c) => {
      if (alive) setConnections(c);
    });
    integrationConfig()
      .then((c) => {
        if (!alive) return;
        setConfig(c);
        if (c.google?.clientId && c.google.apiKey && c.google.appId)
          prepareGoogle()
            .then(() => {
              if (alive) setReady((r) => ({ ...r, google: true }));
            })
            .catch((e) => {
              if (alive) setError(e.message);
            });
        if (c.microsoft?.clientId)
          microsoftClient(workspace)
            .then(() => {
              if (alive) setReady((r) => ({ ...r, microsoft: true }));
            })
            .catch((e) => {
              if (alive) setError(e.message);
            });
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [workspace]);
  const enabled = {
    google: !!(config?.google?.clientId && config.google.apiKey && config.google.appId),
    microsoft: !!config?.microsoft?.clientId,
  };
  async function deviceFiles() {
    setError('');
    if (!output) {
      input.current?.click();
      return;
    }
    try {
      const file = new File([output.data as BlobPart], output.name, { type: output.type });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: output.name });
      else download(output);
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        setError('Use Download to save this copy through your browser.');
    }
  }
  async function connect(provider: 'google' | 'microsoft') {
    setBusy(provider);
    setError('');
    setMessage('');
    setSavedUrl('');
    try {
      setConnections(
        await (provider === 'google' ? connectGoogle(workspace) : connectOneDrive(workspace)),
      );
      setItems(null);
      setSelected([]);
      setFolders([{ name: 'OneDrive' }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function run(provider: 'google' | 'microsoft') {
    setBusy(provider);
    setError('');
    setMessage('');
    setSavedUrl('');
    try {
      if (output) {
        const result =
          provider === 'google'
            ? await exportGoogle(output, setBusy, workspace)
            : await exportOneDrive(output, workspace);
        setMessage(`Saved a new copy: ${result.name}`);
        if (result.url?.startsWith('https://')) setSavedUrl(result.url);
      } else if (provider === 'google') {
        const files = await importGoogle(workspace);
        if (files.length) {
          onImport(files);
          onClose();
        }
      } else {
        const result = await listOneDrive(workspace);
        setItems(result.items);
        setNextPage(result.next);
        setFolders([{ name: 'OneDrive' }]);
        setSelected([]);
      }
      setConnections(await cloudConnections(workspace));
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
      const result = await listOneDrive(workspace, id);
      setItems(result.items);
      setNextPage(result.next);
      setFilter('');
      setSelected([]);
      setFolders((old) => (back !== undefined ? old.slice(0, back + 1) : [...old, { id, name }]));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function importItems(list: CloudItem[]) {
    setBusy('import');
    setError('');
    try {
      const files: File[] = [];
      for (const item of list) {
        setBusy(`Importing ${files.length + 1} of ${list.length}…`);
        files.push(await importOneDrive(item, workspace));
      }
      onImport(files);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="modal-shade cloud-shade">
      <section
        className="info-dialog cloud-dialog cloud-hub"
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
        <span className="cloud-hub-eyebrow">
          <Cloud size={16} /> CONNECTIONS · {workspaceLabel}
        </span>
        <h2 id="cloud-title">
          {output ? 'A fresh copy. Wherever you work.' : 'Your files, wherever they live.'}
        </h2>
        <p>
          {output
            ? `Save ${output.name} (${bytes(output.data.length)}) to your cloud, or through your device’s Files app.`
            : 'Connect a cloud account, choose documents, and get back to work. Files are processed on your device.'}
        </p>
        <input
          ref={input}
          hidden
          type="file"
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
            <div className="cloud-browser-heading">
              <button className="text-button" onClick={() => setItems(null)}>
                <ArrowLeft size={15} />
                Connections
              </button>
              <span>{connections.microsoft?.email}</span>
            </div>
            <nav className="cloud-breadcrumb" aria-label="OneDrive folders">
              {folders.map((f, i) => (
                <button
                  key={f.id ?? 'root'}
                  disabled={!!busy}
                  onClick={() => folder(f.id, f.name, i)}
                >
                  {i > 0 ? ' / ' : ''}
                  {f.name}
                </button>
              ))}
            </nav>
            <input
              aria-label="Filter OneDrive files"
              placeholder="Search this folder…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="cloud-items">
              {items
                .filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()))
                .sort(
                  (a, b) => Number(!!b.folder) - Number(!!a.folder) || a.name.localeCompare(b.name),
                )
                .map((item) =>
                  item.folder ? (
                    <button
                      key={item.id}
                      disabled={!!busy}
                      onClick={() => folder(item.id, item.name)}
                    >
                      <Folder size={20} />
                      <span>
                        {item.name}
                        <small>Folder</small>
                      </span>
                      <ArrowUpRight size={15} />
                    </button>
                  ) : (
                    <div className="cloud-file-row" key={item.id}>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.name}`}
                          checked={selected.includes(item.id)}
                          disabled={!!busy}
                          onChange={(e) =>
                            setSelected((old) =>
                              e.target.checked
                                ? [...old, item.id]
                                : old.filter((id) => id !== item.id),
                            )
                          }
                        />
                        <FileText size={20} />
                        <span>
                          {item.name}
                          <small>{bytes(item.size)}</small>
                        </span>
                      </label>
                      <button
                        className="icon-button"
                        aria-label={`Import ${item.name}`}
                        disabled={!!busy}
                        onClick={() => importItems([item])}
                      >
                        <Download size={17} />
                      </button>
                    </div>
                  ),
                )}
            </div>
            {!items.length && <p className="cloud-empty">This folder is empty.</p>}
            {nextPage && (
              <button
                className="button secondary full"
                disabled={!!busy}
                onClick={async () => {
                  setBusy('loading');
                  try {
                    const result = await listOneDrive(workspace, undefined, nextPage);
                    setItems((old) => [
                      ...new Map([...(old ?? []), ...result.items].map((i) => [i.id, i])).values(),
                    ]);
                    setNextPage(result.next);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy('');
                  }
                }}
              >
                Load more files
              </button>
            )}
            <button
              className="button primary full"
              disabled={!!busy || !selected.length}
              onClick={() => importItems(items.filter((i) => selected.includes(i.id)))}
            >
              <Download size={16} />
              Import {selected.length || ''} selected {selected.length === 1 ? 'file' : 'files'}
            </button>
          </div>
        ) : (
          <>
            <button className="cloud-device-action" disabled={!!busy} onClick={deviceFiles}>
              <span className="cloud-device-icon">
                <FolderOpen size={25} />
              </span>
              <span>
                <strong>{output ? 'Save with Files / Share' : 'Open with Files'}</strong>
                <small>iCloud, device folders, and installed cloud providers</small>
              </span>
              {output ? <Download size={20} /> : <Upload size={20} />}
            </button>
            <div className="cloud-device-providers">
              <strong>In Files, choose the provider you already use</strong>
              <span>iCloud Drive</span>
              <span>OneDrive</span>
              <span>Dropbox</span>
              <span>Box</span>
              <small>
                Available providers depend on your device and installed apps. Plivvi reads the file
                you choose and keeps its processing local.
              </small>
            </div>
            <div className="cloud-section-label">DIRECT CONNECTIONS</div>
            <div className={`cloud-connection-grid ${enabled.microsoft ? '' : 'single-provider'}`}>
              {(['google', 'microsoft'] as const)
                .filter((provider) => provider === 'google' || enabled.microsoft)
                .map((provider) => {
                  const connected = connections[provider],
                    title = provider === 'google' ? 'Google Drive' : 'OneDrive';
                  return (
                    <article
                      className={`cloud-connection-card ${connected ? 'connected' : ''}`}
                      key={provider}
                    >
                      <div className="cloud-connection-top">
                        <span
                          className={`provider-mark ${provider === 'google' ? 'drive' : 'onedrive'}`}
                        >
                          {provider === 'google' ? <DriveMark /> : <Cloud size={28} />}
                        </span>
                        <span className="cloud-status">
                          {!config
                            ? 'Checking'
                            : !enabled[provider]
                              ? 'Via your device'
                              : connected
                                ? 'Connected'
                                : 'Ready to connect'}
                        </span>
                      </div>
                      <h3>{title}</h3>
                      <p>
                        {connected
                          ? connected.email
                          : config && !enabled[provider]
                            ? `Choose ${title} in your device’s file picker. Install its app and enable it in Files on iPhone or iPad.`
                            : provider === 'google'
                              ? 'Choose files in Google Picker. Save new copies to Drive.'
                              : 'Browse folders, select files, and save new copies to OneDrive.'}
                      </p>
                      <button
                        className="button primary full"
                        disabled={!config || (enabled[provider] && !ready[provider]) || !!busy}
                        onClick={() =>
                          !enabled[provider]
                            ? deviceFiles()
                            : connected
                              ? run(provider)
                              : connect(provider)
                        }
                      >
                        {config && !enabled[provider]
                          ? output
                            ? 'Save through your device'
                            : 'Open via Files'
                          : connected
                            ? output
                              ? 'Save a new copy'
                              : 'Browse files'
                            : 'Connect account'}
                        <ArrowUpRight size={15} />
                      </button>
                      {connected && (
                        <div className="cloud-account-controls">
                          <button
                            className="text-button"
                            disabled={!!busy}
                            onClick={() => connect(provider)}
                          >
                            <RefreshCw size={12} />
                            Switch account
                          </button>
                          <button
                            className="text-button"
                            disabled={!!busy}
                            onClick={async () => {
                              setBusy('disconnect');
                              try {
                                await disconnectCloud(workspace, provider);
                                setConnections(await cloudConnections(workspace));
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy('');
                              }
                            }}
                          >
                            <Unplug size={12} />
                            Disconnect
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
            </div>
            {config && (!enabled.google || !enabled.microsoft) && (
              <p className="cloud-setup-note">
                {enabled.microsoft
                  ? ''
                  : 'Direct OneDrive connection needs a Microsoft app registration and is being prepared. '}
                Use the single Files action above for iCloud Drive, OneDrive, Dropbox, and Box where
                your device exposes them. On a computer, you can also download a cloud file and
                import it here.
              </p>
            )}
          </>
        )}
        <div className="cloud-privacy">
          <ShieldCheck size={18} />
          <p>
            Connections belong to this workspace and stay in memory for this tab. Switching an app
            account opens a separate set of cloud connections. Downloads and cloud saves create new
            copies.
          </p>
        </div>
        {busy && (
          <p className="processing-line" role="status">
            <span className="spinner" />
            {busy.startsWith('Saving') || busy.startsWith('Importing')
              ? busy
              : 'Connecting securely…'}
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
            {savedUrl && (
              <a href={savedUrl} target="_blank" rel="noreferrer">
                Open in cloud <ArrowUpRight size={14} />
              </a>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
function DriveMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M10 3h8l9 16h-8L10 3Z" fill="#F9BC15" />
      <path d="m10 3 4 7-9 16-4-7L10 3Z" fill="#24A566" />
      <path d="M5 26h18l4-7H9l-4 7Z" fill="#478AF3" />
    </svg>
  );
}
