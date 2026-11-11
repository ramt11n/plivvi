import { useAppStatus } from './lib/appStatus';
import { isComicFile } from './reader/sources';
import UpdateStatus from './components/UpdateStatus';
import Guide from './help/Guide';
import BugReport from './components/BugReport';
import SupportPrompt from './components/SupportPrompt';
import LoadingProgress from './components/LoadingProgress';
import InstallGuide from './components/InstallGuide';
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
import Brand from './components/Brand';
import FeatureShowcase from './components/FeatureShowcase';
import Guides from './components/Guides';
import { brand } from './integrations/config';
import { PublicPage, SiteFooter, SponsorPlacement, ToolLanding } from './components/PublicPages';
import {
  currentRoute,
  navigateTo,
  pathForView,
  toolPath,
  updateSEO,
  featureContent,
} from './seo/routes';
import { sourceUrl } from './integrations/config';
import { accountState, subscribeAccounts } from './integrations/auth';
import {
  workspaceId,
  readDocuments,
  appendDocuments,
  removeDocument,
  updateDocument,
  clearDocuments,
  type StoredDocument,
} from './lib/workspace';
import { tools, groups, popular, templates, bytes, type Tool } from './lib/catalog';
import { rpc, download, downloadAll as exportAll, type Output } from './lib/client';
import Icon from './components/Icon';
const AccountDialog = lazy(() => import('./components/AccountDialog')),
  CloudDialog = lazy(() => import('./components/CloudDialog'));
const PDFReader = lazy(() => import('./reader/PDFReader'));
const Notebooks = lazy(() => import('./notebooks/Notebooks'));
const ToolPanel = lazy(() => import('./components/ToolPanel')),
  CameraView = lazy(() => import('./components/Camera'));
export default function App() {
  const appStatus = useAppStatus();
  const [taskProgress, setTaskProgress] = useState<{ label: string; value?: number }>({
    label: 'Preparing your workspace…',
    value: 0,
  });
  const [route, setRoute] = useState(currentRoute),
    [view, setView] = useState(() => currentRoute().view),
    [group, setGroup] = useState('All tools'),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<Tool | null>(null),
    [initial, setInitial] = useState<File[]>([]),
    [dialog, setDialog] = useState<string | null>(null),
    [camera, setCamera] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [documentData, setDocuments] = useState<StoredDocument[]>([]),
    [ready, setReady] = useState(false),
    [loadedWorkspace, setLoadedWorkspace] = useState<string>(),
    [storageError, setStorageError] = useState(''),
    [libraryAttempt, setLibraryAttempt] = useState(0),
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
    [authState, setAuthState] = useState(accountState);
  const account = authState.active,
    workspace = workspaceId(account?.uid),
    workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const documents = loadedWorkspace === workspace ? documentData : [],
    libraryReady = ready && loadedWorkspace === workspace;
  const [fileQuery, setFileQuery] = useState(''),
    [folderFilter, setFolderFilter] = useState('all');
  const [fileEdit, setFileEdit] = useState<{
    doc: StoredDocument;
    action: 'rename' | 'folder';
    value: string;
    workspace: string;
  } | null>(null);
  useEffect(() => subscribeAccounts(setAuthState), []);
  useEffect(() => {
    setFileQuery('');
    setFolderFilter('all');
    setSelected(null);
    setReaderOpen(false);
    setReaderFile(undefined);
    setCloudOpen(false);
    setCloudOutput(undefined);
    setFileEdit(null);
    setDialog(null);
  }, [workspace]);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setStorageError('');
    setLoadedWorkspace(undefined);
    setDocuments([]);
    // Local files can open while the independent sign-in service restores.
    readDocuments(workspace)
      .then((d) => {
        if (alive) {
          setDocuments(d);
          setLoadedWorkspace(workspace);
          setReady(true);
        }
      })
      .catch((error) => {
        if (alive) {
          setStorageError(
            error.message || 'Browser storage is unavailable. Saved files have not been cleared.',
          );
          setReady(true);
          setLoadedWorkspace(workspace);
          setToast('Local storage is unavailable. You can still process and download files.');
        }
      });
    return () => {
      alive = false;
    };
  }, [workspace, libraryAttempt]);
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
    const net = () => setOnline(navigator.onLine),
      install = (e: Event) => {
        e.preventDefault();
        setInstallEvent(e);
      },
      key = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          navigateTo('/tools/');
          setTimeout(() => search.current?.focus(), 0);
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
    if (file) setReaderFile(file);
    setReaderOpen(true);
  }
  async function openComic() {
    try {
      const response = await fetch('/samples/pli-free-pages.pdf');
      if (!response.ok) throw new Error('Comic unavailable');
      openReader(
        new File([await response.blob()], 'Pli vs. the Page Taxman.pdf', {
          type: 'application/pdf',
        }),
      );
    } catch {
      setToast('The comic could not open. Please try again.');
    }
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
    if (
      !files.every(
        (file) =>
          isComicFile(file) ||
          /\.(pdf|docx|xlsx|pptx|txt|md|html?|jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i.test(
            file.name,
          ) ||
          file.type.startsWith('image/') ||
          file.type === 'application/pdf',
      )
    ) {
      setToast('Choose a PDF, CBR comic, image, Office document, or text file.');
      return;
    }
    const f = files[0],
      id = isComicFile(f)
        ? 'reader'
        : /\.pdf$/i.test(f.name)
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
    if (!authState.ready)
      throw Error('Your account is still loading. Try saving again in a moment.');
    const target = workspace;
    const next = await appendDocuments(target, outputs);
    if (workspaceRef.current === target) {
      setDocuments(next);
      setToast('Saved to this account’s workspace on this device.');
    }
    navigator.storage?.persist?.().catch(() => {});
  }
  async function remove(id: string) {
    const target = workspace,
      next = await removeDocument(target, id);
    if (workspaceRef.current === target) {
      setDocuments(next);
      setToast('Removed from this workspace.');
    }
  }
  function editDocument(d: StoredDocument, action: 'rename' | 'folder') {
    setFileEdit({
      doc: d,
      action,
      value: action === 'rename' ? d.name : (d.folder ?? ''),
      workspace,
    });
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
    setTaskProgress({ label: 'Preparing your template…', value: 0 });
    try {
      const out = await rpc<Output[]>('template', { template: id }, (label, value) =>
        setTaskProgress({ label, value }),
      );
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
      navigateTo(toolPath('reader'));
      setMobileNav(false);
      return;
    }
    navigateTo(pathForView(v));
    setQuery('');
    setGroup('All tools');
    setMobileNav(false);
  }
  function exploreTools() {
    nav('tools');
    requestAnimationFrame(() => {
      const grid = document.getElementById('all-document-tools');
      grid?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
      grid?.focus({ preventScroll: true });
    });
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
      <span className="tool-serial" aria-hidden="true">
        {String(tools.findIndex((t) => t.id === tool.id) + 1).padStart(2, '0')}
      </span>
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
      {(all
        ? documents.filter(
            (d) =>
              d.name.toLowerCase().includes(fileQuery.toLowerCase()) &&
              (folderFilter === 'all' ||
                (folderFilter === 'unfiled' ? !d.folder : 'folder:' + d.folder === folderFilter)),
          )
        : documents.slice(0, 4)
      ).map((d) => (
        <div className="document-row" key={d.id}>
          <button
            className="document-open"
            onClick={() =>
              d.type === 'application/pdf' || isComicFile(d)
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
            <>
              <button
                className="icon-button"
                aria-label={`Rename ${d.name}`}
                onClick={() => editDocument(d, 'rename')}
              >
                <FileText size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={`Move ${d.name} to folder`}
                onClick={() => editDocument(d, 'folder')}
              >
                <FolderPlus size={16} />
              </button>
            </>
          )}
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
      <aside className={`sidebar studio-rail ${mobileNav ? 'open' : ''}`}>
        <button className="rail-home" aria-label={`${brand.name} home`} onClick={() => nav('home')}>
          <Brand iconOnly />
          <span className="rail-brand-name">{brand.name}</span>
        </button>
        <nav aria-label="Workspace navigation">
          {[
            { id: 'home', name: 'Workbench', icon: Home },
            { id: 'reader', name: 'Reader', icon: BookOpen },
            { id: 'tools', name: 'Tools', icon: Grid2X2 },
            { id: 'documents', name: 'Files', icon: FolderOpen },
            { id: 'notebooks', name: 'Notebooks', icon: BookOpen },
            { id: 'templates', name: 'Layouts', icon: LayoutTemplate },
          ].map((n) => (
            <button
              key={n.id}
              className={`rail-item ${(n.id === 'reader' ? route.toolId === 'reader' : view === n.id) ? 'active' : ''}`}
              aria-label={n.name}
              aria-current={
                (n.id === 'reader' ? route.toolId === 'reader' : view === n.id) ? 'page' : undefined
              }
              onClick={() => nav(n.id)}
            >
              <n.icon size={22} />
              <span>{n.name}</span>
              {n.id === 'documents' && documents.length > 0 && (
                <i className="rail-count">{documents.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button
            className="rail-item rail-support"
            aria-label="Donate to improve Plivvi"
            onClick={() => nav('support')}
          >
            <Heart size={21} fill="currentColor" />
            <span>Support</span>
          </button>
          <button
            className="rail-item"
            aria-label="Import files"
            onClick={() => upload.current?.click()}
          >
            <Upload size={21} />
            <span>Import</span>
          </button>
          <button
            className="rail-item"
            aria-label="Cloud connections"
            onClick={() => {
              setCloudOutput(undefined);
              setCloudOpen(true);
              setMobileNav(false);
            }}
          >
            <Cloud size={21} />
            <span>Cloud</span>
          </button>
          <button
            className="rail-item"
            aria-label="Appearance and settings"
            onClick={() => {
              setDialog('settings');
              setMobileNav(false);
            }}
          >
            <Settings size={21} />
            <span>Settings</span>
          </button>
          <a
            className="rail-source"
            href="https://github.com/ramt11n/plivvi"
            target="_blank"
            rel="noreferrer"
            aria-label="Open source on GitHub"
          >
            <Code2 size={19} />
          </a>
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
        <header className="topbar studio-topbar">
          <div className="studio-header-start">
            <button
              className="icon-button studio-menu"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu size={23} />
            </button>
            <button
              className="header-brand"
              aria-label={`${brand.name} home`}
              onClick={() => nav('home')}
            >
              <Brand />
            </button>
            <span className="studio-header-divider" />
            <span className="studio-view-name">
              {
                {
                  home: 'Your workbench',
                  tools: 'The toolbox',
                  guides: 'Practical guides',
                  guide: 'Practical guides',
                  documents: 'Your files',
                  notebooks: 'Your notebooks',
                  templates: 'Page starters',
                  tool: tools.find((t) => t.id === route.toolId)?.title,
                  about: 'Behind the app',
                  privacy: 'Your privacy',
                  support: 'Support the project',
                  contact: 'Say hello',
                  account: 'Your account',
                }[view]
              }
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="header-support"
              aria-label="Donate to improve Plivvi"
              title="Donate to improve Plivvi"
              onClick={() => nav('support')}
            >
              <Heart size={17} fill="currentColor" />
              <span>Help improve Plivvi</span>
            </button>
            <button className="header-search" aria-label="Find a tool" onClick={() => nav('tools')}>
              <Search size={17} />
              <span>Find a tool</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className={`connection-pill ${online ? '' : 'offline'}`}>
              {online ? <span className="online-dot" /> : <WifiOff size={13} />}
              <span className="connection-text">
                {appStatus.status.state === 'reachable'
                  ? 'Connected'
                  : appStatus.status.state === 'checking'
                    ? 'Checking…'
                    : online
                      ? 'Limited connection'
                      : 'Offline'}
              </span>
            </span>
            <button
              className="icon-button header-settings"
              aria-label="Appearance and settings"
              onClick={() => setDialog('settings')}
            >
              <Settings size={20} />
            </button>
            <button
              className="account-button"
              aria-label={account ? `Account: ${account.name}` : 'Account'}
              onClick={() => setAccountOpen(true)}
            >
              {account ? (
                <span className="account-initial">{account.name.charAt(0).toUpperCase()}</span>
              ) : (
                <UserRound size={20} />
              )}
              {authState.accounts.length > 1 && (
                <i className="account-count">{authState.accounts.length}</i>
              )}
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
            multiple
            hidden
            onChange={(e) => {
              importFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          {['tools', 'documents', 'templates'].includes(view) && (
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
              <section className="workbench-hero">
                <div className="workbench-copy">
                  <div className="workbench-kicker">
                    <span className="live-dot" /> YOUR FILES. YOUR CALL.
                  </div>
                  <h1>
                    Your docs.
                    <br />
                    <span>Your next move.</span>
                  </h1>
                  <p>
                    Read, scan, sign, and put your pages in order.
                    <br className="desktop-break" /> A useful workspace that stays on your device.
                  </p>
                  <div className="workbench-actions">
                    <button className="button primary" onClick={() => upload.current?.click()}>
                      <Plus size={19} />
                      Open a file
                    </button>
                    <button className="button secondary" onClick={() => nav('reader')}>
                      <BookOpen size={18} />
                      Start reading
                    </button>
                  </div>
                  <div className="workbench-principles">
                    <span>
                      <ShieldCheck size={15} />
                      Local processing
                    </span>
                    <span>
                      <Code2 size={15} />
                      Open source
                    </span>
                    <span>No feature paywalls</span>
                  </div>
                </div>
                <div className="drop-workbench">
                  <div className="drop-caption-top">
                    <span>YOUR DOCUMENT STARTS HERE</span>
                    <span className="drop-shortcut">↗</span>
                  </div>
                  <button
                    className="document-drop-card"
                    aria-label="Choose documents from your device"
                    onClick={() => upload.current?.click()}
                  >
                    <span className="page-character mascot-eater" aria-hidden="true">
                      <img
                        src="/visuals/mascot/pli-eats-pages.webp"
                        alt=""
                        width="170"
                        height="160"
                      />
                      <span className="mascot-speech">Give me your documents. Num num…</span>
                    </span>
                    <strong>Drop it here.</strong>
                    <span>
                      Or choose a file from your device <ArrowRight size={15} />
                    </span>
                    <small>PDF, CBR comics, images, Office, and text files</small>
                  </button>
                  <div className="drop-footnote">
                    <ShieldCheck size={13} />
                    Pli eats pages locally. No document upload to a processing server.
                  </div>
                </div>
              </section>
              <section className="quick-moves" aria-label="Quick document tasks">
                {[
                  {
                    id: 'scan',
                    title: 'Scan & clean',
                    note: 'Paper to pixels',
                    icon: Camera,
                    tone: 'mint',
                  },
                  {
                    id: 'organize',
                    title: 'Arrange pages',
                    note: 'Get the order right',
                    icon: Grid2X2,
                    tone: 'peach',
                  },
                  {
                    id: 'sign',
                    title: 'Sign a document',
                    note: 'Add your finishing touch',
                    icon: FileText,
                    tone: 'lilac',
                  },
                  {
                    id: 'image-pdf',
                    title: 'Make a PDF',
                    note: 'Bring your images together',
                    icon: Plus,
                    tone: 'sky',
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={`quick-move ${t.tone}`}
                    onClick={() => openTool(tools.find((v) => v.id === t.id)!)}
                  >
                    <span className="quick-move-icon">
                      <t.icon size={24} />
                    </span>
                    <span>
                      <strong>{t.title}</strong>
                      <small>{t.note}</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </section>
              <FeatureShowcase
                onExplore={exploreTools}
                toolCount={tools.length}
                onNotebook={() => nav('notebooks')}
                onComic={openComic}
                onAction={(id) => openTool(tools.find((t) => t.id === id)!)}
              />
              <section className="section">
                <div className="section-heading">
                  <div>
                    <h2>
                      Your tool shelf <span className="count-pill">{favorites.length}</span>
                    </h2>
                    <p>The tools you keep within reach.</p>
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
                    <h2>Pick up where you left off</h2>
                    <p>Your saved work, in this browser.</p>
                  </div>
                  <button className="text-button" onClick={() => nav('documents')}>
                    View all <ArrowRight size={14} />
                  </button>
                </div>
                {!libraryReady ? (
                  <LoadingProgress
                    label="Opening your workspace…"
                    detail="Reading files saved on this device."
                  />
                ) : storageError ? (
                  <div role="alert" className="error-banner">
                    <p>{storageError}</p>
                    <button
                      className="button secondary"
                      onClick={() => setLibraryAttempt((n) => n + 1)}
                    >
                      Retry opening files
                    </button>
                  </div>
                ) : documents.length ? (
                  <DocumentList />
                ) : (
                  <div className="empty-documents">
                    <div className="empty-stack">
                      <FileText size={25} />
                    </div>
                    <div>
                      <strong>A clear workspace. Yours to fill.</strong>
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
                    <strong>Keep your tools close.</strong>
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
              <FeatureShowcase
                onExplore={exploreTools}
                toolCount={tools.length}
                onNotebook={() => nav('notebooks')}
                onComic={openComic}
                compact
                onAction={(id) => openTool(tools.find((t) => t.id === id)!)}
              />
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
              <nav className="feature-quick-links" aria-label="Popular document workflows">
                {Object.values(featureContent)
                  .filter(
                    (f) =>
                      !query ||
                      `${f.title} ${f.description}`.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((f) => (
                    <a
                      key={f.slug}
                      href={'/' + f.slug + '/'}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateTo('/' + f.slug + '/');
                      }}
                    >
                      {f.title.split(' — ')[0]}
                    </a>
                  ))}
              </nav>
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
              <div
                id="all-document-tools"
                tabIndex={-1}
                role="region"
                aria-label="All document tools"
                className="tool-grid all-tools-grid"
              >
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
              {!libraryReady ? (
                <LoadingProgress
                  label="Opening your workspace…"
                  detail="Reading files saved on this device."
                />
              ) : storageError ? (
                <div role="alert" className="error-banner">
                  <p>{storageError}</p>
                  <button
                    className="button secondary"
                    onClick={() => setLibraryAttempt((n) => n + 1)}
                  >
                    Retry opening files
                  </button>
                </div>
              ) : documents.length ? (
                <>
                  <div className="library-toolbar">
                    <span>
                      {account ? `${account.name} · ` : 'Guest · '}
                      {documents.length} saved {documents.length === 1 ? 'file' : 'files'} ·{' '}
                      {bytes(used)}
                    </span>
                    <button className="button secondary" onClick={() => downloadAll(documents)}>
                      Export workspace ZIP <Download size={15} />
                    </button>
                  </div>
                  <div className="library-filters">
                    <label>
                      <Search size={17} />
                      <input
                        aria-label="Search saved documents"
                        placeholder="Search your files…"
                        value={fileQuery}
                        onChange={(e) => setFileQuery(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Filter document folder"
                      value={folderFilter}
                      onChange={(e) => setFolderFilter(e.target.value)}
                    >
                      <option value="all">All folders</option>
                      <option value="unfiled">Unfiled</option>
                      {[...new Set(documents.map((d) => d.folder).filter(Boolean))].map((f) => (
                        <option key={f} value={'folder:' + f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <DocumentList all />
                  {!documents.some(
                    (d) =>
                      d.name.toLowerCase().includes(fileQuery.toLowerCase()) &&
                      (folderFilter === 'all' ||
                        (folderFilter === 'unfiled'
                          ? !d.folder
                          : 'folder:' + d.folder === folderFilter)),
                  ) && <p className="library-no-results">No files match this search and folder.</p>}
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
                {account
                  ? `${account.name}’s documents are separate from other signed-in accounts. `
                  : 'This is your guest workspace. '}
                Files are saved on this browser, without automatic cloud sync. Download important
                copies.
              </p>
            </>
          )}
          {view === 'notebooks' && (
            <Suspense fallback={<LoadingProgress label="Opening your notebooks…" />}>
              <Notebooks
                key={workspace}
                workspace={workspace}
                onSave={save}
                onCloud={(out) => {
                  setCloudOutput(out);
                  setCloudOpen(true);
                }}
              />
            </Suspense>
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
          {view === 'templates' && busy && (
            <div className="template-loading">
              <LoadingProgress label={taskProgress.label} value={taskProgress.value} />
            </div>
          )}
          {view === 'tool' && route.toolId && (
            <ToolLanding
              tool={tools.find((t) => t.id === route.toolId)!}
              content={route.featureId ? featureContent[route.featureId] : undefined}
              onStart={() => openTool(tools.find((t) => t.id === route.toolId)!)}
            />
          )}
          {(view === 'guides' || view === 'guide') && <Guides id={route.guideId} />}
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
          { id: 'notebooks', icon: BookOpen, label: 'Notes' },
        ].map((n) => (
          <button
            key={n.id}
            className={
              (n.id === 'reader' ? route.toolId === 'reader' : view === n.id) ? 'active' : ''
            }
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
          <h2>Drop your documents here.</h2>
          <p>PDFs, photos, Office documents, and text files</p>
        </div>
      )}
      {accountOpen && (
        <Suspense
          fallback={
            <div className="modal-shade">
              <div className="loading-card">
                <LoadingProgress label="Opening account…" />
              </div>
            </div>
          }
        >
          <AccountDialog onClose={() => setAccountOpen(false)} />
        </Suspense>
      )}
      {cloudOpen && (
        <Suspense
          fallback={
            <div className="modal-shade">
              <div className="loading-card">
                <LoadingProgress label="Opening connections…" />
              </div>
            </div>
          }
        >
          <CloudDialog
            workspace={workspace}
            workspaceLabel={account?.name ?? 'Guest workspace'}
            output={cloudOutput}
            onImport={importFiles}
            onClose={() => setCloudOpen(false)}
          />
        </Suspense>
      )}
      <Guide />
      <BugReport />
      <SupportPrompt />
      {readerOpen && (
        <Suspense
          fallback={
            <div className="modal-shade">
              <div className="loading-card">
                <LoadingProgress label="Opening your reading nook…" />
              </div>
            </div>
          }
        >
          <PDFReader
            key={workspace}
            workspace={workspace}
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
                <LoadingProgress label="Opening your workshop…" />
              </div>
            </div>
          }
        >
          <ToolPanel
            key={selected.id + initial.map((f) => f.name).join('|')}
            tool={selected}
            initialFiles={initial}
            initialOptions={
              route.featureId && featureContent[route.featureId].toolId === selected.id
                ? featureContent[route.featureId].options
                : undefined
            }
            onClose={() => setSelected(null)}
            onSave={save}
            onRead={(out) => {
              setSelected(null);
              openReader(new File([out.data as BlobPart], out.name, { type: out.type }));
            }}
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
                  install: 'Your workspace. One tap away.',
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
                <InstallGuide
                  installEvent={installEvent}
                  onPrompt={async () => {
                    await installEvent?.prompt();
                    setInstallEvent(null);
                  }}
                />
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
                    <strong>App version</strong>
                    <span>
                      {brand.name} {brand.version}
                    </span>
                  </div>
                </div>
                <UpdateStatus app={appStatus} />
                <div className="setting-row">
                  <div>
                    <strong>Local workspace</strong>
                    <span>
                      {documents.length} files · {bytes(used)}
                    </span>
                  </div>
                  <span className="pill">{libraryReady ? 'Ready' : 'Loading'}</span>
                </div>
                <button
                  className="button secondary full"
                  onClick={() => window.dispatchEvent(new Event('plivvi:report'))}
                >
                  Report a bug · suggest an improvement
                </button>
                <a className="text-button" href="/support/" target="_blank" rel="noreferrer">
                  Help improve Plivvi · optional donation
                </a>
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
                      await clearDocuments(workspace);
                      if (workspaceRef.current === workspace) {
                        setDocuments([]);
                        setToast('This workspace’s saved files were cleared.');
                      }
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
                  {brand.name} is a responsive, installable document toolkit built with React,
                  TypeScript, MuPDF, pdf-lib and Tesseract.js.
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
      {fileEdit && (
        <div className="modal-shade">
          <form
            className="info-dialog file-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-edit-title"
            onSubmit={async (e) => {
              e.preventDefault();
              const edit = fileEdit,
                value = edit.value.trim();
              if (edit.action === 'rename' && !value) return;
              try {
                const next = await updateDocument(
                  edit.workspace,
                  edit.doc.id,
                  edit.action === 'rename' ? { name: value } : { folder: value },
                );
                if (workspaceRef.current === edit.workspace) setDocuments(next);
                setFileEdit(null);
              } catch {
                setToast('Could not update this file. Try again.');
              }
            }}
          >
            <h2 id="file-edit-title">
              {fileEdit.action === 'rename' ? 'Give it a new name.' : 'A place for this file.'}
            </h2>
            <p>{fileEdit.doc.name}</p>
            <label>
              {fileEdit.action === 'rename' ? 'Document name' : 'Folder name'}
              <input
                autoFocus
                required={fileEdit.action === 'rename'}
                maxLength={160}
                value={fileEdit.value}
                onChange={(e) => setFileEdit({ ...fileEdit, value: e.target.value })}
              />
            </label>
            {fileEdit.action === 'folder' && (
              <small>
                Use an existing folder name or create a new one. Leave blank for Unfiled.
              </small>
            )}
            <div>
              <button type="button" className="button secondary" onClick={() => setFileEdit(null)}>
                Cancel
              </button>
              <button className="button primary">Save changes</button>
            </div>
          </form>
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
async function downloadAll(documents: StoredDocument[]) {
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
