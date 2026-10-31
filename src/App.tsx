import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Cloud,
  UserRound,
  Code2,
  Mail,
  Home,
  Grid2X2,
  FolderOpen,
  LayoutTemplate,
  Search,
  Plus,
  Upload,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  CloudOff,
  Download,
  Settings,
  HelpCircle,
  X,
  Check,
  MoreHorizontal,
  FileText,
  Trash2,
  Camera,
  ChevronRight,
  Command,
  WifiOff,
  Star,
  Menu,
  Smartphone,
  FolderPlus,
  Heart,
  ExternalLink,
} from 'lucide-react';
import ThemePicker from './components/ThemePicker';
import { PublicPage, SiteFooter, SponsorPlacement, ToolLanding } from './components/PublicPages';
import { currentRoute, navigateTo, pathForView, toolPath, updateSEO } from './seo/routes';
import { sourceUrl } from './integrations/config';
import type { Account } from './integrations/auth';
import { tools, groups, popular, templates, bytes, type Tool } from './lib/catalog';
import { rpc, download, downloadAll as exportAll, type Output } from './lib/client';
import Icon from './components/Icon';
const AccountDialog = lazy(() => import('./components/AccountDialog')),
  CloudDialog = lazy(() => import('./components/CloudDialog'));
const PDFReader = lazy(() => import('./reader/PDFReader'));
const ToolPanel = lazy(() => import('./components/ToolPanel')),
  CameraView = lazy(() => import('./components/Camera'));
type Stored = {
  id: string;
  name: string;
  type: string;
  data: Uint8Array;
  date: string;
  size: number;
};
export default function App() {
  const [route, setRoute] = useState(currentRoute),
    [view, setView] = useState(() => currentRoute().view),
    [group, setGroup] = useState('All tools'),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<Tool | null>(null),
    [initial, setInitial] = useState<File[]>([]),
    [dialog, setDialog] = useState<string | null>(null),
    [camera, setCamera] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [documents, setDocuments] = useState<Stored[]>([]),
    [ready, setReady] = useState(false),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [installEvent, setInstallEvent] = useState<any>(null),
    [favorites, setFavorites] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('pocket-favorites') ?? 'null') ?? popular;
      } catch {
        return popular;
      }
    }),
    [dragging, setDragging] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false),
    [readerFile, setReaderFile] = useState<File>(),
    [cloudOutput, setCloudOutput] = useState<Output>(),
    [cloudOpen, setCloudOpen] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    const sync = () => {
      const r = currentRoute();
      setRoute(r);
      setView(r.view);
      setSelected(null);
      setReaderOpen(false);
      setMobileNav(false);
      if (r.view === 'account') setAccountOpen(true);
      updateSEO(r);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const upload = useRef<HTMLInputElement>(null),
    search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    import('idb-keyval')
      .then(({ get }) => get<Stored[]>('pocket-documents'))
      .then((d) => {
        setDocuments(d ?? []);
        setReady(true);
      })
      .catch(() => {
        setReady(true);
        setToast('Local storage is unavailable. You can still process and download files.');
      });
    const net = () => setOnline(navigator.onLine),
      install = (e: Event) => {
        e.preventDefault();
        setInstallEvent(e);
      },
      key = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          search.current?.focus();
        }
        if (e.key === 'Escape') {
          setDialog(null);
          setMobileNav(false);
        }
      };
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('online', net);
      window.removeEventListener('offline', net);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem('pocket-favorites', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);
  function openReader(file?: File) {
    setReaderFile(file);
    setReaderOpen(true);
  }
  function openTool(tool: Tool, files: File[] = []) {
    if (currentRoute().toolId !== tool.id) navigateTo(toolPath(tool.id));
    if (tool.id === 'reader') {
      openReader(files[0]);
      return;
    }
    setInitial(files);
    setSelected(tool);
  }
  function importFiles(files: File[]) {
    if (!files.length) return;
    const f = files[0],
      id = /\.pdf$/i.test(f.name)
        ? files.length > 1
          ? 'merge'
          : 'reader'
        : f.type.startsWith('image/')
          ? 'scan'
          : /\.(docx|xlsx|pptx)$/i.test(f.name)
            ? 'office-pdf'
            : 'html-pdf';
    openTool(
      tools.find((t) => t.id === id)!,
      files,
    );
  }
  async function save(outputs: Output[]) {
    const entries = outputs.map((o) => ({
      id: crypto.randomUUID(),
      name: o.name,
      type: o.type,
      data: o.data,
      date: new Date().toISOString(),
      size: o.data.length,
    }));
    const next = [...entries, ...documents];
    const { set } = await import('idb-keyval');
    await set('pocket-documents', next);
    setDocuments(next);
    setToast('Saved to this device’s workspace.');
    navigator.storage?.persist?.().catch(() => {});
  }
  async function remove(id: string) {
    const next = documents.filter((d) => d.id !== id);
    const { set } = await import('idb-keyval');
    await set('pocket-documents', next);
    setDocuments(next);
    setToast('Removed from this workspace.');
  }
  async function sample() {
    setBusy(true);
    try {
      const o = await rpc<Output>('sample', {});
      await save([o]);
      openReader(new File([o.data as BlobPart], o.name, { type: o.type }));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function makeTemplate(id: string) {
    if (id === 'id' || id === 'passport') {
      const t = tools.find((t) => t.id === 'scan')!;
      setInitial([]);
      setSelected({
        ...t,
        layout: id,
        description: `Upload ${id === 'id' ? 'front and back photos' : 'your passport photo'} and choose the ${id === 'id' ? 'ID copy' : 'Passport copy'} page layout.`,
      });
      return;
    }
    setBusy(true);
    try {
      const out = await rpc<Output[]>('template', { template: id });
      await save(out);
      openReader(new File([out[0].data as BlobPart], out[0].name, { type: out[0].type }));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function nav(v: string) {
    if (v === 'reader') {
      openTool(tools.find((t) => t.id === 'reader')!);
      setMobileNav(false);
      return;
    }
    navigateTo(pathForView(v));
    setQuery('');
    setGroup('All tools');
    setMobileNav(false);
  }
  const filtered = tools.filter(
      (t) =>
        (group === 'All tools' || t.group === group) &&
        `${t.title} ${t.description} ${t.group}`.toLowerCase().includes(query.toLowerCase()),
    ),
    used = documents.reduce((s, d) => s + d.size, 0);
  const ToolCard = ({ tool, compact = false }: { tool: Tool; compact?: boolean }) => (
    <a
      href={toolPath(tool.id)}
      className={`tool-card ${compact ? 'compact' : ''}`}
      onClick={(e) => {
        if (e.button || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        e.preventDefault();
        openTool(tool);
      }}
    >
      <span className={`tool-icon ${tool.color}`}>
        <Icon name={tool.icon} />
      </span>
      <span className="tool-card-text">
        <strong>{tool.title}</strong>
        <span>{tool.description}</span>
      </span>
      <ArrowUpRight className="tool-card-arrow" size={17} />
    </a>
  );
  const DocumentList = ({ all = false }: { all?: boolean }) => (
    <div className="document-list">
      {(all ? documents : documents.slice(0, 4)).map((d) => (
        <div className="document-row" key={d.id}>
          <button
            className="document-open"
            onClick={() =>
              d.type === 'application/pdf'
                ? openReader(new File([d.data as BlobPart], d.name, { type: d.type }))
                : download(d)
            }
          >
            <span className="document-thumb">
              <FileText size={22} />
              <small>{d.name.split('.').pop()?.toUpperCase()}</small>
            </span>
            <span className="document-name">
              <strong>{d.name}</strong>
              <small>
                {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                · {bytes(d.size)}
              </small>
            </span>
          </button>
          <span className="document-local">
            <span />
            On this device
          </span>
          <button
            className="icon-button"
            aria-label={`Download ${d.name}`}
            onClick={() => download(d)}
          >
            <Download size={17} />
          </button>
          <button
            className="icon-button document-cloud"
            aria-label={`Save ${d.name} to cloud`}
            onClick={() => {
              setCloudOutput(d);
              setCloudOpen(true);
            }}
          >
            <Cloud size={17} />
          </button>
          {all && (
            <button
              className="icon-button delete"
              aria-label={`Delete ${d.name}`}
              onClick={() => remove(d.id).catch(() => setToast('Could not update local storage.'))}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <button className="brand" aria-label="Pocket home" onClick={() => nav('home')}>
          <span className="brand-symbol">
            <svg viewBox="0 0 28 28" fill="none">
              <path d="M7 4.5h9l5 5V23H7V4.5Z" fill="white" fillOpacity=".95" />
              <path d="M16 4.5v5h5" stroke="#7779dd" strokeWidth="1.5" />
              <path
                d="m10 15 3 3 5-5"
                stroke="#6c6de1"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            Pocket<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {[
            { id: 'home', name: 'Overview', icon: Home },
            { id: 'reader', name: 'PDF reader & editor', icon: BookOpen },
            { id: 'tools', name: 'All tools', icon: Grid2X2 },
            { id: 'documents', name: 'My documents', icon: FolderOpen },
            { id: 'templates', name: 'Templates', icon: LayoutTemplate },
          ].map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => nav(n.id)}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {n.id === 'tools' && <small>{tools.length}</small>}
              {n.id === 'documents' && documents.length > 0 && <small>{documents.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-label">QUICK START</div>
        <button
          className="nav-item"
          onClick={() => {
            openTool(tools[0]);
            setCamera(true);
          }}
        >
          <Camera size={19} />
          <span>Scan a document</span>
          <Plus size={15} />
        </button>
        <button className="nav-item" onClick={() => upload.current?.click()}>
          <Upload size={19} />
          <span>Import files</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setCloudOutput(undefined);
            setCloudOpen(true);
            setMobileNav(false);
          }}
        >
          <Cloud size={19} />
          <span>Cloud connections</span>
        </button>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <div className="privacy-symbol">
              <ShieldCheck size={22} />
            </div>
            <strong>Your files. Your space.</strong>
            <p>
              Local by default.
              <br />
              Cloud only when you choose.
            </p>
            <button onClick={() => setDialog('privacy')}>
              How privacy works <ArrowUpRight size={13} />
            </button>
          </div>
          <ThemePicker compact />
          <button className="nav-item" onClick={() => setDialog('install')}>
            <Smartphone size={18} />
            <span>Install Pocket</span>
            <Download size={15} />
          </button>
          <button className="nav-item" onClick={() => setDialog('settings')}>
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <div className="sidebar-foot">
            <span>Pocket PDF Workshop</span>
            <span>Made for your everyday.</span>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-context">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu />
            </button>
            <span className="workspace-avatar">
              <FileText size={14} />
            </span>
            <span>Your workspace</span>
            <ChevronRight size={14} />
            <strong>
              {
                {
                  home: 'Overview',
                  tools: 'All tools',
                  documents: 'My documents',
                  templates: 'Templates',
                  tool: tools.find((t) => t.id === route.toolId)?.title,
                  about: 'About',
                  privacy: 'Privacy',
                  support: 'Support',
                  contact: 'Contact',
                  account: 'Account',
                }[view]
              }
            </strong>
          </div>
          <div className="topbar-actions">
            <span className={`connection-pill ${online ? '' : 'offline'}`}>
              {online ? <span className="online-dot" /> : <WifiOff size={13} />}{' '}
              {online ? 'On-device processing' : 'Offline mode'}
            </span>
            <button className="account-button" onClick={() => setAccountOpen(true)}>
              <UserRound size={17} />
              <span>{account?.name ?? 'Sign in'}</span>
            </button>
            <button className="icon-button" aria-label="Help" onClick={() => setDialog('help')}>
              <HelpCircle size={20} />
            </button>
          </div>
        </header>
        <main
          className="content"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragging(true);
            }
          }}
        >
          <input
            ref={upload}
            type="file"
            accept=".pdf,image/*,.docx,.xlsx,.pptx,.txt,.md,.html"
            multiple
            hidden
            onChange={(e) => {
              importFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          {['home', 'tools', 'documents', 'templates'].includes(view) && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {view === 'home' ? 'LESS BUSYWORK. MORE POSSIBILITY.' : 'YOUR DOCUMENT WORKSHOP'}
                </span>
                <h1>
                  {view === 'home'
                    ? 'A little less paperwork.'
                    : view === 'tools'
                      ? 'A tool for every little task.'
                      : view === 'documents'
                        ? 'A place for your paperwork.'
                        : 'Start one step ahead.'}
                </h1>
                <p>
                  {view === 'home'
                    ? 'Good things happen when your documents are in order.'
                    : view === 'tools'
                      ? 'Pick a task. Add your files. Get on with your day.'
                      : view === 'documents'
                        ? 'Your saved outputs, kept right here on this device.'
                        : 'Thoughtful layouts for the documents you make most.'}
                </p>
              </div>
              <button
                className="button secondary heading-import"
                onClick={() => upload.current?.click()}
              >
                <Plus size={17} />
                Import files
              </button>
            </div>
          )}
          {view === 'home' && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-badge">
                    <span /> Open source. Vibe coded. Always free.
                  </span>
                  <h2>
                    From paper pile
                    <br />
                    to peace of mind.
                  </h2>
                  <p>
                    Scan, organize, sign, and convert.
                    <br />
                    Everything your documents need, in one pocket.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button primary"
                      onClick={() => {
                        openTool(tools[0]);
                        setCamera(true);
                      }}
                    >
                      <Camera size={18} />
                      Scan a document
                    </button>
                    <button
                      className="button hero-secondary"
                      onClick={() => upload.current?.click()}
                    >
                      <Upload size={17} />
                      Upload files
                    </button>
                  </div>
                  <div className="hero-trust">
                    <ShieldCheck size={14} />
                    <span>Private by design</span>
                    <span className="dot-separator" /> <span>Files stay on your device</span>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <span className="art-orbit orbit-one" />
                  <span className="art-orbit orbit-two" />
                  <div className="art-spark spark-one">✦</div>
                  <div className="art-spark spark-two">✦</div>
                  <div className="paper-back">
                    <div />
                    <div />
                    <div />
                    <div />
                  </div>
                  <div className="paper-front">
                    <div className="paper-brand">
                      <span />
                      pocket studio
                    </div>
                    <div className="paper-line wide" />
                    <div className="paper-line mid" />
                    <div className="paper-rule" />
                    <div className="paper-row">
                      <span>Less paperwork.</span>
                      <span>✓</span>
                    </div>
                    <div className="paper-row">
                      <span>More headspace.</span>
                      <span>✓</span>
                    </div>
                    <div className="paper-lines">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="paper-signature">All sorted.</div>
                    <span className="pdf-label">PDF</span>
                  </div>
                  <div className="art-done">
                    <span>
                      <Check size={17} />
                    </span>
                    <div>
                      <strong>Looking sharp.</strong>
                      <small>Ready for whatever’s next.</small>
                    </div>
                  </div>
                  <div className="art-floating-icon">
                    <Icon name="ScanLine" size={27} />
                  </div>
                </div>
              </section>
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>
                      Your everyday essentials{' '}
                      <span className="count-pill">{favorites.length}</span>
                    </h2>
                    <p>A few favorites to make quick work of it.</p>
                  </div>
                  <button className="text-button" onClick={() => setDialog('favorites')}>
                    Customize <Settings size={14} />
                  </button>
                </div>
                <div className="tool-grid essentials">
                  {favorites
                    .map((id) => tools.find((t) => t.id === id))
                    .filter(Boolean)
                    .map((t) => (
                      <ToolCard key={t!.id} tool={t!} />
                    ))}
                </div>
                <button className="all-tools-link" onClick={() => nav('tools')}>
                  Explore all {tools.length} tools <ArrowRight size={15} />
                </button>
              </section>
              <section className="section documents-section">
                <div className="section-heading">
                  <div>
                    <h2>Recent documents</h2>
                    <p>Pick up where you left off.</p>
                  </div>
                  <button className="text-button" onClick={() => nav('documents')}>
                    View all <ArrowRight size={14} />
                  </button>
                </div>
                {documents.length ? (
                  <DocumentList />
                ) : (
                  <div className="empty-documents">
                    <div className="empty-stack">
                      <FileText size={25} />
                    </div>
                    <div>
                      <strong>Your next good idea starts here.</strong>
                      <p>Import a document, or try a real sample PDF to explore.</p>
                    </div>
                    <button className="button secondary" disabled={busy} onClick={sample}>
                      {busy ? <span className="spinner" /> : <FileText size={16} />}Try a sample
                    </button>
                  </div>
                )}
              </section>
              <section className="bottom-tips">
                <button onClick={() => nav('templates')}>
                  <span className="mini-tip-icon violet">
                    <LayoutTemplate size={21} />
                  </span>
                  <span>
                    <strong>Skip the blank page.</strong>
                    <small>Start with a useful document layout.</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
                <button onClick={() => setDialog('install')}>
                  <span className="mini-tip-icon mint">
                    <Smartphone size={21} />
                  </span>
                  <span>
                    <strong>Keep Pocket close.</strong>
                    <small>Add it to your Home Screen.</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              </section>
              <SponsorPlacement />
            </>
          )}
          {view === 'tools' && (
            <>
              <div className="tool-search">
                <Search size={20} />
                <input
                  ref={search}
                  placeholder="What would you like to do? Try merge, scan, sign…"
                  aria-label="Search tools"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="key-hint">
                  <Command size={12} /> K
                </span>
              </div>
              <div className="category-tabs">
                {groups.map((g) => (
                  <button
                    className={group === g ? 'active' : ''}
                    key={g}
                    onClick={() => setGroup(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="tool-grid all-tools-grid">
                {filtered.map((t) => (
                  <ToolCard key={t.id} tool={t} />
                ))}
              </div>
              {!filtered.length && (
                <div className="empty-state">
                  <Search size={30} />
                  <h3>No matching tools yet.</h3>
                  <p>Try a different word, or browse a category.</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setQuery('');
                      setGroup('All tools');
                    }}
                  >
                    Show all tools
                  </button>
                </div>
              )}
              <button className="capability-link" onClick={() => setDialog('capabilities')}>
                About conversion quality and supported features <InfoIcon />
              </button>
            </>
          )}
          {view === 'documents' && (
            <>
              {documents.length ? (
                <>
                  <div className="library-toolbar">
                    <span>
                      {documents.length} saved {documents.length === 1 ? 'file' : 'files'} ·{' '}
                      {bytes(used)}
                    </span>
                    <button className="button secondary" onClick={() => downloadAll(documents)}>
                      Export workspace ZIP <Download size={15} />
                    </button>
                  </div>
                  <DocumentList all />
                </>
              ) : (
                <div className="empty-state library-empty">
                  <FolderOpen size={40} />
                  <h2>A clean slate.</h2>
                  <p>
                    After using a tool, choose Save to workspace.
                    <br />
                    Your outputs will appear here, on this device.
                  </p>
                  <button className="button primary" onClick={() => nav('tools')}>
                    Explore the tools <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <p className="library-note">
                <CloudOff size={16} />
                This workspace is stored in your browser. Export important files; clearing browser
                data can remove saved documents.
              </p>
            </>
          )}
          {view === 'templates' && (
            <>
              <div className="template-banner">
                <LayoutTemplate size={22} />
                <p>
                  Simple, useful layouts for your own paperwork. ID and passport presets arrange
                  your scans; they do not recreate official credentials.
                </p>
              </div>
              <div className="templates-grid">
                {templates.map((t) => (
                  <button
                    className="template-card"
                    key={t.id}
                    disabled={busy}
                    onClick={() => makeTemplate(t.id)}
                  >
                    <div className={`template-preview ${t.color}`}>
                      <div className={`template-paper ${t.id}`}>
                        <Icon name={t.icon} size={20} />
                        <span />
                        <span />
                        <span />
                        <span />
                        {t.id === 'id' && <i />}
                      </div>
                    </div>
                    <div className="template-description">
                      <h3>{t.name}</h3>
                      <p>{t.description}</p>
                      <span>
                        Use layout <ArrowRight size={14} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {view === 'tool' && route.toolId && (
            <ToolLanding
              tool={tools.find((t) => t.id === route.toolId)!}
              onStart={() => openTool(tools.find((t) => t.id === route.toolId)!)}
            />
          )}
          {['about', 'privacy', 'support', 'contact', '404'].includes(view) && (
            <PublicPage view={view} />
          )}
          {view === 'account' && (
            <div className="public-page">
              <h1>A small account. No paywalls.</h1>
              <p>Every PDF tool works without signing in.</p>
              <button className="button primary" onClick={() => setAccountOpen(true)}>
                Open account
              </button>
            </div>
          )}
          <SiteFooter />
        </main>
      </div>
      <nav className="mobile-bottom-nav">
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'tools', icon: Grid2X2, label: 'Tools' },
          { id: 'scan', icon: Camera, label: 'Scan' },
          { id: 'documents', icon: FolderOpen, label: 'Files' },
          { id: 'templates', icon: LayoutTemplate, label: 'Layouts' },
        ].map((n) => (
          <button
            key={n.id}
            className={view === n.id ? 'active' : ''}
            onClick={() => (n.id === 'scan' ? (openTool(tools[0]), setCamera(true)) : nav(n.id))}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {dragging && (
        <div
          className="global-drop"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            importFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <Upload size={45} />
          <h2>Drop it in your pocket.</h2>
          <p>PDFs, photos, Office documents, and text files</p>
        </div>
      )}
      {accountOpen && (
        <Suspense
          fallback={
            <div className="modal-shade">
              <div className="loading-card">
                <span className="spinner" />
                Opening account…
              </div>
            </div>
          }
        >
          <AccountDialog onClose={() => setAccountOpen(false)} onAccount={setAccount} />
        </Suspense>
      )}
      {cloudOpen && (
        <Suspense
          fallback={
            <div className="modal-shade">
              <div className="loading-card">
                <span className="spinner" />
                Opening connections…
              </div>
            </div>
          }
        >
          <CloudDialog
            output={cloudOutput}
            onImport={importFiles}
            onClose={() => setCloudOpen(false)}
          />
        </Suspense>
      )}
      {readerOpen && (
        <Suspense
          fallback={
            <div className="modal-shade">
              <div className="loading-card">
                <span className="spinner" />
                Opening your reading nook…
              </div>
            </div>
          }
        >
          <PDFReader
            initialFile={readerFile}
            onClose={() => setReaderOpen(false)}
            onSave={save}
            onCloud={(out) => {
              setCloudOutput(out);
              setCloudOpen(true);
            }}
          />
        </Suspense>
      )}
      {selected && (
        <Suspense
          fallback={
            <div className="modal-shade">
              <div className="loading-card">
                <span className="spinner" />
                Opening your workshop…
              </div>
            </div>
          }
        >
          <ToolPanel
            key={selected.id + initial.map((f) => f.name).join('|')}
            tool={selected}
            initialFiles={initial}
            onClose={() => setSelected(null)}
            onSave={save}
            onCloud={(out) => {
              setCloudOutput(out);
              setCloudOpen(true);
            }}
          />
        </Suspense>
      )}
      {camera && (
        <Suspense>
          <CameraView
            onCapture={(f) => {
              setInitial([f]);
              setSelected(tools[0]);
            }}
            onClose={() => setCamera(false)}
          />
        </Suspense>
      )}
      {dialog && (
        <div
          className="modal-shade"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <section
            className={`info-dialog ${dialog === 'favorites' ? 'wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-title"
          >
            <button
              className="icon-button dialog-close"
              aria-label="Close"
              onClick={() => setDialog(null)}
            >
              <X />
            </button>
            <span className="tool-icon violet">
              {dialog === 'install' ? (
                <Smartphone />
              ) : dialog === 'privacy' ? (
                <ShieldCheck />
              ) : dialog === 'favorites' ? (
                <Star />
              ) : (
                <HelpCircle />
              )}
            </span>
            <h2 id="info-title">
              {
                {
                  install: 'A workshop in your pocket.',
                  privacy: 'Private means private.',
                  settings: 'Make yourself at home.',
                  help: 'A little guidance.',
                  favorites: 'Your everyday essentials.',
                  about: 'Small app. Useful things.',
                  capabilities: 'Know what your tools can do.',
                }[dialog]
              }
            </h2>
            {dialog === 'install' && (
              <>
                <p>Add Pocket to your Home Screen for a focused, app-like workspace.</p>
                {installEvent && (
                  <button
                    className="button primary full"
                    onClick={async () => {
                      await installEvent.prompt();
                      setInstallEvent(null);
                    }}
                  >
                    <Download size={17} />
                    Install Pocket
                  </button>
                )}
                <ol className="help-list">
                  <li>
                    <strong>iPhone or iPad:</strong> open in Safari, tap Share, then Add to Home
                    Screen.
                  </li>
                  <li>
                    <strong>Android or desktop:</strong> use your browser’s Install app option when
                    available.
                  </li>
                  <li>
                    <strong>Offline:</strong> the app shell and tools you have loaded are cached.
                    Open a tool online once before relying on it offline. OCR language packs
                    download separately.
                  </li>
                </ol>
                <p className="small muted">
                  On the private hosted version, sign in as the owner first. No Apple developer
                  account is needed.
                </p>
              </>
            )}
            {dialog === 'privacy' && (
              <>
                <p>
                  Documents are processed in your browser. We do not send document contents to a
                  processing server.
                </p>
                <ul className="help-list">
                  <li>Files stay in memory until you save or download them.</li>
                  <li>
                    Save to workspace keeps outputs in this browser’s local storage. Documents do
                    not sync across devices. Cloud transfers happen only when you explicitly choose
                    them.
                  </li>
                  <li>
                    Large engines and OCR language packs are downloaded when needed. Your document
                    is not part of those requests.
                  </li>
                  <li>
                    Your downloaded files remain under your control. This app cannot delete them.
                  </li>
                </ul>
              </>
            )}
            {dialog === 'settings' && (
              <>
                <h3 className="settings-label">Appearance</h3>
                <ThemePicker />
                <p className="theme-help">
                  System follows your device, including any sunrise/sunset schedule you have
                  enabled.
                </p>
                <OfflineStatus />
                <div className="setting-row">
                  <div>
                    <strong>Local workspace</strong>
                    <span>
                      {documents.length} files · {bytes(used)}
                    </span>
                  </div>
                  <span className="pill">{ready ? 'Ready' : 'Loading'}</span>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Connection</strong>
                    <span>
                      {online
                        ? 'Connected · processing stays local'
                        : 'Offline · cached tools only'}
                    </span>
                  </div>
                  <span className="online-dot" />
                </div>
                <button
                  className="button secondary full"
                  onClick={() => downloadAll(documents)}
                  disabled={!documents.length}
                >
                  Export all saved files
                </button>
                <p className="small muted">
                  Keep a downloaded backup. Browser storage can be cleared by the browser or
                  operating system.
                </p>
                <button
                  className="text-button danger"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        'Remove all saved files from this browser workspace? Downloaded originals will stay unchanged.',
                      )
                    )
                      return;
                    try {
                      const { del } = await import('idb-keyval');
                      await del('pocket-documents');
                      setDocuments([]);
                      setToast('Local workspace cleared.');
                    } catch {
                      setToast('Could not clear browser storage.');
                    }
                  }}
                >
                  Clear local workspace
                </button>
              </>
            )}
            {dialog === 'help' && (
              <>
                <ol className="help-list">
                  <li>
                    <strong>Choose a tool</strong> or import a file and we will choose a starting
                    point.
                  </li>
                  <li>
                    <strong>Adjust it.</strong> Crop photos, move pages, or choose your output
                    settings.
                  </li>
                  <li>
                    <strong>Make a new copy.</strong> Download it, share it to Files, or save it to
                    this device’s workspace.
                  </li>
                </ol>
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={() => {
                    setDialog(null);
                    sample();
                  }}
                >
                  Explore with a sample PDF <ArrowRight size={16} />
                </button>
                <button className="text-button" onClick={() => setDialog('capabilities')}>
                  See supported features
                </button>
              </>
            )}
            {dialog === 'favorites' && (
              <>
                <p>Choose up to eight tools to keep on your Overview.</p>
                <div className="favorites-grid">
                  {tools.map((t) => (
                    <label key={t.id}>
                      <input
                        type="checkbox"
                        checked={favorites.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked && favorites.length >= 8) {
                            setToast('Choose up to eight everyday essentials.');
                            return;
                          }
                          setFavorites((p) =>
                            e.target.checked ? [...p, t.id] : p.filter((id) => id !== t.id),
                          );
                        }}
                      />
                      <Icon name={t.icon} size={17} />
                      {t.title}
                    </label>
                  ))}
                </div>
                <button className="button primary" onClick={() => setDialog(null)}>
                  Done <Check size={16} />
                </button>
              </>
            )}
            {dialog === 'capabilities' && (
              <>
                <ul className="help-list">
                  <li>
                    <strong>Scan:</strong> camera or upload, adjustable perspective crop, lighting
                    normalization and filters. Severe glare, covered text, and curved-book
                    reconstruction need more advanced models.
                  </li>
                  <li>
                    <strong>PDF tools:</strong> page operations, text overlays, drawn signatures,
                    visual comparison, forms, real AES-256 protection and content redaction.
                  </li>
                  <li>
                    <strong>Conversions:</strong> DOCX exports editable paragraphs; XLSX exports
                    inferred text rows; PPTX exports page images. Office-to-PDF creates a basic
                    text/data reading copy.
                  </li>
                  <li>
                    <strong>Not included:</strong> certified PDF/A conversion, certificate-based
                    digital signatures, AI translation, generative summaries, cloud sync, full
                    existing-text editing, and layout-faithful Office conversion.
                  </li>
                </ul>
                <p className="small muted">
                  Original files stay unchanged. Existing cryptographic signatures can be
                  invalidated by PDF edits. Review converted and redacted copies before sharing.
                </p>
              </>
            )}
            {dialog === 'about' && (
              <>
                <p>
                  Pocket PDF Workshop is a responsive, installable document toolkit built with
                  React, TypeScript, MuPDF, pdf-lib and Tesseract.js.
                </p>
                <p className="small muted">
                  Independent software, not affiliated with CamScanner or iLovePDF. Vibe coded by
                  Ramtin Neshatvar. MuPDF and this app are distributed under AGPL-3.0-or-later.
                </p>
                <div className="about-links">
                  <a href={sourceUrl}>
                    Download application source <Download size={15} />
                  </a>
                  <a href="/LICENSE.txt" target="_blank" rel="noreferrer">
                    License <ExternalLink size={14} />
                  </a>
                  <a href="/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noreferrer">
                    Third-party notices <ExternalLink size={14} />
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function InfoIcon() {
  return <HelpCircle size={14} />;
}
async function downloadAll(documents: Stored[]) {
  return exportAll(documents);
}

function OfflineStatus() {
  const [status, setStatus] = useState('Checking offline cache…');
  useEffect(() => {
    if (import.meta.env.DEV) {
      setStatus('Available in the production version.');
      return;
    }
    if (!('serviceWorker' in navigator)) {
      setStatus('This browser does not support offline installation. Use Safari, Chrome, or Edge.');
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      if (active)
        setStatus(
          'Not ready yet. Keep this page online, then reopen it before relying on offline use.',
        );
    }, 7000);
    navigator.serviceWorker.ready
      .then(() => {
        if (active) {
          clearTimeout(timer);
          setStatus('Ready. Tools and OCR languages are cached as you use them.');
        }
      })
      .catch(() => {
        if (active) setStatus('Cache unavailable. Check browser storage settings and try again.');
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="setting-row">
      <div>
        <strong>Offline workspace</strong>
        <span role="status">{status}</span>
      </div>
    </div>
  );
}
