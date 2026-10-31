import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Cloud,
  Download,
  Eraser,
  FilePlus2,
  Highlighter,
  LayoutPanelLeft,
  List,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  MousePointer2,
  PanelLeftClose,
  PenLine,
  Plus,
  Printer,
  Redo2,
  Save,
  Search,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  SunMoon,
} from 'lucide-react';
import { download, inputs, rpc, type Input, type Output } from '../lib/client';
import PDFPage from './PDFPage';
import PageThumbnail from './PageThumbnail';
import ThemePicker from '../components/ThemePicker';
import type { Mark, ReaderInfo, ReaderTool } from './types';
type Props = {
  initialFile?: File;
  onClose: () => void;
  onSave: (out: Output[]) => Promise<void>;
  onCloud: (out?: Output) => void;
};
const palette = ['#28344b', '#6965d8', '#267ba8', '#b94c62', '#278466', '#e8bc32'];
const tools: { id: ReaderTool; name: string; icon: typeof PenLine }[] = [
  { id: 'select', name: 'Select text', icon: MousePointer2 },
  { id: 'pen', name: 'Pen', icon: PenLine },
  { id: 'highlighter', name: 'Highlighter', icon: Highlighter },
  { id: 'text', name: 'Type text', icon: Type },
  { id: 'note', name: 'Sticky note', icon: MessageSquare },
  { id: 'rectangle', name: 'Rectangle', icon: Square },
  { id: 'eraser', name: 'Erase my marks', icon: Eraser },
];
export default function PDFReader({ initialFile, onClose, onSave, onCloud }: Props) {
  const [file, setFile] = useState<File | undefined>(initialFile),
    [info, setInfo] = useState<ReaderInfo>(),
    [password, setPassword] = useState(''),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [page, setPage] = useState(0),
    [jump, setJump] = useState('1'),
    [sidebar, setSidebar] = useState<'pages' | 'outline' | 'search' | 'marks' | null>(() =>
      window.innerWidth >= 1000 ? 'pages' : null,
    ),
    [tool, setTool] = useState<ReaderTool>('select'),
    [color, setColor] = useState(palette[0]),
    [size, setSize] = useState(2.5),
    [touchInk, setTouchInk] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [history, setHistory] = useState<Mark[][]>([[]]),
    [cursor, setCursor] = useState(0),
    [zoom, setZoom] = useState(100),
    [fit, setFit] = useState<'width' | 'page' | 'manual'>('width'),
    [continuous, setContinuous] = useState(true),
    [query, setQuery] = useState(''),
    [hits, setHits] = useState<{ page: number; count: number; quads: number[][] }[]>([]),
    [searching, setSearching] = useState(false),
    [bookmarks, setBookmarks] = useState<number[]>([]),
    [viewport, setViewport] = useState({ width: 950, height: 750 }),
    [draftKey, setDraftKey] = useState(''),
    [draftReady, setDraftReady] = useState(false),
    [notice, setNotice] = useState(''),
    [flatten, setFlatten] = useState(false),
    [appearance, setAppearance] = useState(false);
  const pendingLayouts = useRef(new Set<string>());
  const draftSnapshot = useRef<{ key: string; marks: Mark[] }>({ key: '', marks: [] }),
    carry = useRef<Mark[] | null>(null),
    pendingPage = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null),
    raw = useRef<Input | undefined>(undefined),
    scroller = useRef<HTMLDivElement>(null),
    session = useRef(''),
    generation = useRef(0),
    saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    latest = useRef({ history, cursor });
  latest.current = { history, cursor };
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (info && pendingPage.current !== null) {
      const target = pendingPage.current;
      pendingPage.current = null;
      setPage(target);
      setJump(String(target + 1));
      requestAnimationFrame(() =>
        document
          .getElementById(`reader-page-${target}`)
          ?.scrollIntoView({ block: 'start', behavior: 'instant' }),
      );
    }
  }, [info]);
  const marks = history[cursor] ?? [],
    selectedMark = marks.find((m) => m.id === selected);
  if (draftReady && draftKey) draftSnapshot.current = { key: draftKey, marks };
  useEffect(() => {
    if (!file) return;
    const gen = ++generation.current;
    let alive = true;
    setLoading(true);
    setError('');
    setInfo(undefined);
    setDraftReady(false);
    setHistory([[]]);
    setCursor(0);
    setPage(0);
    setJump('1');
    setHits([]);
    setSelected(null);
    (async () => {
      if (file.size > 100 * 1048576) throw Error('Choose a PDF smaller than 100 MB.');
      const data = (await inputs([file]))[0];
      raw.current = data;
      const r = await rpc<ReaderInfo>('reader-open', { input: data, password });
      if (!alive || gen !== generation.current) {
        rpc('reader-close', { session: r.session });
        return;
      }
      session.current = r.session;
      setInfo(r);
      const digest = await crypto.subtle.digest(
          'SHA-256',
          data.data.slice(0, Math.min(data.data.byteLength, 1048576)),
        ),
        key =
          'pocket-reader-' +
          Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('') +
          '-' +
          data.data.byteLength;
      setDraftKey(key);
      try {
        const { get } = await import('idb-keyval'),
          saved = carry.current ?? (await get<Mark[]>(key));
        carry.current = null;
        if (alive && saved?.length) {
          setHistory([saved.filter((m) => m.page < r.count)]);
          setNotice('Restored your local annotation draft.');
        }
      } catch {}
      try {
        setBookmarks(JSON.parse(localStorage.getItem(key + '-bookmarks') ?? '[]'));
      } catch {
        setBookmarks([]);
      }
      setDraftReady(true);
    })()
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      const draft = draftSnapshot.current;
      if (draft.key)
        import('idb-keyval').then(({ set }) => set(draft.key, draft.marks)).catch(() => {});
      if (session.current) {
        rpc('reader-close', { session: session.current }).catch(() => {});
        session.current = '';
      }
    };
  }, [file, attempt]);
  useEffect(() => {
    if (!scroller.current) return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setViewport({ width: r.width, height: r.height });
    });
    observer.observe(scroller.current);
    return () => observer.disconnect();
  }, [info, sidebar, loading]);
  useEffect(() => {
    if (!draftReady || !draftKey) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      import('idb-keyval')
        .then(({ set }) => set(draftKey, marks))
        .then(() => setNotice('Draft saved on this device'))
        .catch(() => setNotice('Draft storage unavailable. Download your copy to keep changes.'));
    }, 650);
    return () => clearTimeout(saveTimer.current);
  }, [marks, draftKey, draftReady]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!info) return;
    for (const mark of marks) {
      if (mark.kind !== 'text') continue;
      const width = info.pages[mark.page].width * mark.rect.w,
        key = JSON.stringify([mark.text, mark.size, width]);
      if (mark.layoutKey === key || pendingLayouts.current.has(mark.id + key)) continue;
      pendingLayouts.current.add(mark.id + key);
      rpc<string[]>('reader-layout-text', { text: mark.text ?? '', size: mark.size, width })
        .then((lines) =>
          setHistory((old) =>
            old.map((state) =>
              state.map((m) =>
                m.id === mark.id &&
                JSON.stringify([m.text, m.size, info.pages[m.page].width * m.rect.w]) === key
                  ? { ...m, lines, layoutKey: key }
                  : m,
              ),
            ),
          ),
        )
        .catch(() => {})
        .finally(() => pendingLayouts.current.delete(mark.id + key));
    }
  }, [marks, info]);
  const commit = useCallback((next: Mark[] | ((old: Mark[]) => Mark[])) => {
    const { history: h, cursor: c } = latest.current,
      value = typeof next === 'function' ? next(h[c]) : next;
    setHistory([...h.slice(Math.max(0, c - 79), c + 1), value]);
    setCursor(Math.min(80, c + 1));
  }, []);
  function undo() {
    setCursor((c) => Math.max(0, c - 1));
    setSelected(null);
  }
  function redo() {
    setCursor((c) => Math.min(history.length - 1, c + 1));
    setSelected(null);
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable=true]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        commit((old) => old.filter((m) => m.id !== selected));
        setSelected(null);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [history.length, selected]);
  const visible = useCallback((index: number) => {
    setPage(index);
    setJump(String(index + 1));
  }, []);
  function go(index: number) {
    if (!info) return;
    const next = Math.max(0, Math.min(info.count - 1, index));
    setPage(next);
    setJump(String(next + 1));
    if (continuous)
      document
        .getElementById(`reader-page-${next}`)
        ?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function scaleFor(index: number) {
    if (!info) return 1;
    const p = info.pages[index];
    return fit === 'manual'
      ? zoom / 100
      : fit === 'page'
        ? Math.min((viewport.width - 56) / p.width, (viewport.height - 55) / p.height)
        : Math.min(1.65, (viewport.width - (viewport.width < 600 ? 26 : 76)) / p.width);
  }
  function changeZoom(ratio: number) {
    const current = info ? scaleFor(page) * 100 : zoom;
    setZoom(Math.max(35, Math.min(400, Math.round(current * ratio))));
    setFit('manual');
  }
  async function exportCopy() {
    if (!raw.current) throw Error('Open a PDF first.');
    return rpc<Output>('reader-export', { input: raw.current, password, marks, flatten });
  }
  async function action(kind: 'download' | 'save' | 'cloud' | 'print') {
    setBusy(kind);
    setError('');
    const printWindow = kind === 'print' ? window.open('about:blank', '_blank') : null;
    if (printWindow)
      printWindow.document.write(
        '<title>Preparing PDF</title><p style="font:16px system-ui;padding:32px">Preparing your print copy…</p>',
      );
    try {
      const out = await exportCopy();
      if (kind === 'download') download(out);
      if (kind === 'save') {
        await onSave([out]);
        setNotice('Saved a PDF copy to your local workspace.');
      }
      if (kind === 'cloud') onCloud(out);
      if (kind === 'print') {
        const url = URL.createObjectURL(
          new Blob([out.data as BlobPart], { type: 'application/pdf' }),
        );
        if (printWindow) printWindow.location.replace(url);
        else download(out);
        setTimeout(() => URL.revokeObjectURL(url), 300000);
        setNotice('Use your PDF viewer’s Print command.');
      }
    } catch (e) {
      printWindow?.close();
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function find() {
    if (!info || !query.trim()) return;
    setSearching(true);
    try {
      const result = await rpc<typeof hits>('reader-search', { session: info.session, query });
      setHits(result);
      if (result.length) go(result[0].page);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  function bookmark() {
    const next = bookmarks.includes(page)
      ? bookmarks.filter((p) => p !== page)
      : [...bookmarks, page].sort((a, b) => a - b);
    setBookmarks(next);
    try {
      localStorage.setItem(draftKey + '-bookmarks', JSON.stringify(next));
    } catch {}
  }
  async function appendPage() {
    if (!raw.current || !info) return;
    setBusy('page');
    try {
      const out = await rpc<Output>('reader-add-page', { input: raw.current, password });
      carry.current = marks;
      pendingPage.current = info.count;
      setFile(new File([out.data as BlobPart], out.name, { type: out.type }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function newDocument(template: string) {
    setBusy('new');
    try {
      const out = await rpc<Output[]>('template', { template });
      setPassword('');
      setFile(
        new File([out[0].data as BlobPart], `Untitled-${Date.now()}.pdf`, {
          type: 'application/pdf',
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  const chosen = selectedMark ?? { color, size };
  return (
    <section
      className="reader-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Pocket PDF reader and editor"
    >
      <input
        type="file"
        accept="application/pdf,.pdf"
        ref={input}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setPassword('');
            setFile(f);
          }
          e.target.value = '';
        }}
      />
      <header className="reader-header">
        <button className="reader-icon" aria-label="Close reader" onClick={onClose}>
          <ArrowLeft size={21} />
        </button>
        <div className="reader-file-name">
          <strong>{file?.name ?? 'Your reading nook.'}</strong>
          <span>
            {info
              ? `${info.count} pages · local processing · cloud optional`
              : 'Read, mark up, and make room for ideas.'}
          </span>
        </div>
        <span className="reader-free-badge">Free & open source</span>
        <button
          className="reader-icon"
          aria-label="Open another PDF"
          onClick={() => input.current?.click()}
        >
          <Upload size={19} />
        </button>
        <button
          className="reader-icon"
          aria-label="New blank document"
          disabled={!!busy}
          onClick={() => newDocument('blank')}
        >
          <FilePlus2 size={19} />
        </button>
        <button
          className="reader-icon"
          aria-label="Reader appearance"
          aria-expanded={appearance}
          onClick={() => setAppearance((v) => !v)}
        >
          <SunMoon size={19} />
        </button>
        <button
          className="button secondary reader-save"
          aria-label="Save annotated PDF to workspace"
          disabled={!info || !!busy}
          onClick={() => action('save')}
        >
          <Save size={16} />
          <span>Save copy</span>
        </button>
        <button
          className="button primary reader-download"
          aria-label="Download annotated PDF"
          disabled={!info || !!busy}
          onClick={() => action('download')}
        >
          {busy ? <LoaderCircle className="spinning" size={17} /> : <Download size={17} />}
          <span>Download</span>
        </button>
      </header>
      {appearance && (
        <div className="reader-theme-popover">
          <ThemePicker />
          <p>
            System follows your device’s appearance schedule. PDF page colors stay faithful to the
            document.
          </p>
        </div>
      )}
      {info && (
        <>
          <div className="reader-toolbar">
            <div className="reader-toolbar-group">
              <button
                className={`reader-icon ${sidebar ? 'active' : ''}`}
                aria-label="Toggle reader sidebar"
                onClick={() => setSidebar(sidebar ? null : 'pages')}
              >
                <LayoutPanelLeft size={19} />
              </button>
              {tools.map((t) => (
                <button
                  key={t.id}
                  className={`reader-tool ${tool === t.id ? 'active' : ''}`}
                  title={t.name}
                  aria-label={t.name}
                  aria-pressed={tool === t.id}
                  onClick={() => {
                    setTool(t.id);
                    if (t.id === 'text') setSize(18);
                    else if (t.id === 'highlighter') setColor('#e8bc32');
                    else if (t.id === 'pen') setSize(2.5);
                  }}
                >
                  <t.icon size={18} />
                  <span>
                    {t.name === 'Select text'
                      ? 'Select'
                      : t.name === 'Type text'
                        ? 'Text'
                        : t.name === 'Erase my marks'
                          ? 'Eraser'
                          : t.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="reader-toolbar-group history-tools">
              <button
                className="reader-icon"
                aria-label="Undo annotation"
                disabled={cursor === 0}
                onClick={undo}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="reader-icon"
                aria-label="Redo annotation"
                disabled={cursor === history.length - 1}
                onClick={redo}
              >
                <Redo2 size={18} />
              </button>
              <button
                className="reader-icon"
                aria-label="Search this PDF"
                onClick={() => setSidebar('search')}
              >
                <Search size={18} />
              </button>
              <button
                className={`reader-icon ${bookmarks.includes(page) ? 'active' : ''}`}
                aria-label="Bookmark current page"
                aria-pressed={bookmarks.includes(page)}
                onClick={bookmark}
              >
                <Bookmark size={18} />
              </button>
              <button
                className="reader-icon"
                aria-label="Open print copy"
                disabled={!!busy}
                onClick={() => action('print')}
              >
                <Printer size={18} />
              </button>
              <button
                className="reader-icon"
                aria-label="Save PDF to cloud"
                disabled={!!busy}
                onClick={() => action('cloud')}
              >
                <Cloud size={19} />
              </button>
            </div>
          </div>
          {(tool !== 'select' || selectedMark) && (
            <div className="reader-properties">
              <div className="ink-colors" aria-label="Ink colors">
                {palette.map((c) => (
                  <button
                    key={c}
                    aria-label={`Use ${c} ink`}
                    className={chosen.color === c ? 'active' : ''}
                    style={{ background: c }}
                    onClick={() => {
                      setColor(c);
                      if (selectedMark)
                        commit((old) =>
                          old.map((m) => (m.id === selected ? { ...m, color: c } : m)),
                        );
                    }}
                  />
                ))}
              </div>
              <label className="reader-weight">
                {tool === 'text' || selectedMark?.kind === 'text' ? 'Text size' : 'Stroke'}
                <input
                  aria-label="Annotation size"
                  type="range"
                  min="1"
                  max={tool === 'text' || selectedMark?.kind === 'text' ? 48 : 12}
                  step=".5"
                  value={chosen.size}
                  onChange={(e) => {
                    setSize(+e.target.value);
                    if (selectedMark)
                      commit((old) =>
                        old.map((m) => (m.id === selected ? { ...m, size: +e.target.value } : m)),
                      );
                  }}
                />
                <span>{chosen.size} pt</span>
              </label>
              <label className="reader-touch">
                <input
                  type="checkbox"
                  checked={touchInk}
                  onChange={(e) => setTouchInk(e.target.checked)}
                />
                Draw with finger
              </label>
              <span className="stylus-hint">
                <PenLine size={13} />
                Pencil & stylus ready
              </span>
              <label className="reader-flatten">
                <input
                  type="checkbox"
                  checked={flatten}
                  onChange={(e) => setFlatten(e.target.checked)}
                />
                Flatten export
              </label>
            </div>
          )}
        </>
      )}
      {error && (
        <div className="reader-error" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss reader error" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {loading ? (
        <div className="reader-welcome">
          <span className="spinner" />
          <h2>Opening your document…</h2>
          <p>Preparing crisp pages and selectable text.</p>
        </div>
      ) : !info ? (
        <div className="reader-welcome">
          <span className="reader-welcome-icon">
            <BookOpen size={38} />
          </span>
          <span className="eyebrow">A SMALL SPACE FOR BIG IDEAS</span>
          <h1>Read it. Mark it. Make it yours.</h1>
          <p>
            A quiet PDF reader with a useful creative side.
            <br />
            Highlight a thought, write in the margin, or start a fresh page.
          </p>
          {error.toLowerCase().includes('password') && file ? (
            <form
              className="reader-password"
              onSubmit={(e) => {
                e.preventDefault();
                setAttempt((n) => n + 1);
              }}
            >
              <label>
                PDF password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              <button className="button primary">Open protected PDF</button>
            </form>
          ) : (
            <>
              <button className="button primary" onClick={() => input.current?.click()}>
                <Upload size={17} />
                Open a PDF
              </button>
              <div className="reader-new-options">
                <button onClick={() => newDocument('blank')}>
                  Blank page <Plus size={14} />
                </button>
                <button onClick={() => newDocument('notes')}>
                  Lined notebook <Plus size={14} />
                </button>
                <button onClick={() => newDocument('grid')}>
                  Graph paper <Plus size={14} />
                </button>
              </div>
            </>
          )}
          <small>Apple Pencil, other styluses, mouse, and touch. No account required.</small>
        </div>
      ) : (
        <div className={`reader-workspace ${sidebar ? 'with-sidebar' : ''}`}>
          {sidebar && (
            <aside className="reader-sidebar">
              <div className="reader-sidebar-tabs">
                {[
                  { id: 'pages', label: 'Pages', icon: List },
                  { id: 'outline', label: 'Contents', icon: BookOpen },
                  { id: 'search', label: 'Find', icon: Search },
                  { id: 'marks', label: 'Marks', icon: PenLine },
                ].map((t) => (
                  <button
                    key={t.id}
                    aria-label={t.label}
                    title={t.label}
                    className={sidebar === t.id ? 'active' : ''}
                    onClick={() => setSidebar(t.id as any)}
                  >
                    <t.icon size={17} />
                    <span>{t.label}</span>
                  </button>
                ))}
                <button
                  className="reader-sidebar-close reader-icon"
                  aria-label="Close sidebar"
                  onClick={() => setSidebar(null)}
                >
                  <X size={18} />
                </button>
              </div>
              {sidebar === 'pages' && (
                <>
                  <div className="reader-page-list">
                    {info.pages.map((p, i) => (
                      <button
                        className={page === i ? 'active' : ''}
                        key={i}
                        onClick={() => {
                          go(i);
                          if (viewport.width < 600) setSidebar(null);
                        }}
                      >
                        <PageThumbnail session={info.session} index={i} />
                        <span>
                          Page {i + 1}
                          <small>
                            {Math.round(p.width)} × {Math.round(p.height)} pt
                          </small>
                        </span>
                        {bookmarks.includes(i) && <Bookmark size={14} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {sidebar === 'outline' && (
                <div className="reader-outline">
                  {info.outline.length ? (
                    info.outline.map((item, i) => (
                      <button
                        key={i}
                        style={{ paddingLeft: 14 + item.level * 13 }}
                        onClick={() => go(item.page)}
                      >
                        {item.title}
                        <small>{item.page + 1}</small>
                      </button>
                    ))
                  ) : (
                    <p>This PDF has no table of contents.</p>
                  )}
                  <h3>Your bookmarks</h3>
                  {bookmarks.length ? (
                    bookmarks.map((n) => (
                      <div className="reader-bookmark-row" key={n}>
                        <button onClick={() => go(n)}>
                          <Bookmark size={14} />
                          Page {n + 1}
                        </button>
                        <button
                          aria-label={`Remove bookmark page ${n + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = bookmarks.filter((v) => v !== n);
                            setBookmarks(next);
                            try {
                              localStorage.setItem(draftKey + '-bookmarks', JSON.stringify(next));
                            } catch {}
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>Use the bookmark button to keep a page close.</p>
                  )}
                </div>
              )}
              {sidebar === 'search' && (
                <div className="reader-search">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      find();
                    }}
                  >
                    <label>
                      Find in document
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="A word or phrase…"
                      />
                    </label>
                    <button className="button primary" disabled={searching || !query.trim()}>
                      {searching ? <span className="spinner" /> : <Search size={16} />}Find
                    </button>
                  </form>
                  <p>
                    {hits.length
                      ? `${hits.reduce((s, h) => s + h.count, 0)} matches on ${hits.length} pages`
                      : 'Search the PDF’s text layer. For scanned pages, run OCR first.'}
                  </p>
                  {hits.map((hit) => (
                    <button className="search-page-hit" key={hit.page} onClick={() => go(hit.page)}>
                      Page {hit.page + 1}
                      <span>{hit.count} matches</span>
                    </button>
                  ))}
                </div>
              )}
              {sidebar === 'marks' && (
                <div className="reader-mark-list">
                  <h3>{marks.length} annotations</h3>
                  {marks.length ? (
                    marks.map((m, i) => (
                      <button
                        key={m.id}
                        className={selected === m.id ? 'active' : ''}
                        onClick={() => {
                          go(m.page);
                          setSelected(m.id);
                          setTool('select');
                        }}
                      >
                        <span style={{ background: m.color }} />
                        <strong>
                          {m.text?.slice(0, 35) ||
                            `${m.kind === 'ink' ? 'Handwriting' : m.kind} ${i + 1}`}
                        </strong>
                        <small>Page {m.page + 1}</small>
                      </button>
                    ))
                  ) : (
                    <p>Write, highlight, or add text. Your new annotations appear here.</p>
                  )}
                  <p className="reader-hint">
                    The eraser removes marks added in this reader session or restored local draft.
                  </p>
                </div>
              )}
            </aside>
          )}
          <div className="reader-scroll" ref={scroller}>
            <div className="reader-page-stack">
              {(continuous ? info.pages.map((_, i) => i) : [page]).map((i) => (
                <PDFPage
                  key={info.session + '-' + i}
                  session={info.session}
                  index={i}
                  width={info.pages[i].width}
                  height={info.pages[i].height}
                  displayWidth={Math.max(120, info.pages[i].width * scaleFor(i))}
                  marks={marks.filter((m) => m.page === i)}
                  tool={tool}
                  color={color}
                  size={size}
                  touchInk={touchInk}
                  selected={selected}
                  onSelect={setSelected}
                  onMark={(m) => commit((old) => [...old, m])}
                  onErase={(id) => commit((old) => old.filter((m) => m.id !== id))}
                  onUpdate={(mark) =>
                    commit((old) => old.map((m) => (m.id === mark.id ? mark : m)))
                  }
                  onVisible={continuous ? visible : () => {}}
                  onZoom={changeZoom}
                  searchQuads={hits.find((h) => h.page === i)?.quads}
                />
              ))}
            </div>
          </div>
          {selectedMark && (
            <aside className="reader-selection-card" key={selectedMark.id}>
              <header>
                <strong>
                  {selectedMark.kind === 'text'
                    ? 'Edit your text'
                    : selectedMark.kind === 'note'
                      ? 'Your note'
                      : 'Selected annotation'}
                </strong>
                <button
                  className="reader-icon"
                  aria-label="Deselect annotation"
                  onClick={() => setSelected(null)}
                >
                  <X size={16} />
                </button>
              </header>
              {(selectedMark.kind === 'text' || selectedMark.kind === 'note') && (
                <textarea
                  aria-label="Annotation text"
                  defaultValue={selectedMark.text}
                  onBlur={(e) => {
                    const text = e.target.value;
                    if (text !== selectedMark.text)
                      commit((old) => old.map((m) => (m.id === selected ? { ...m, text } : m)));
                  }}
                  placeholder="Write something…"
                  autoFocus
                />
              )}
              <button
                className="text-button danger"
                onClick={() => {
                  commit((old) => old.filter((m) => m.id !== selected));
                  setSelected(null);
                }}
              >
                <Trash2 size={14} />
                Remove this annotation
              </button>
            </aside>
          )}
        </div>
      )}
      {info && (
        <footer className="reader-statusbar">
          <div className="reader-pagination">
            <button
              className="reader-icon"
              aria-label="Previous page"
              disabled={!page}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(Number(jump) - 1);
              }}
            >
              <label>
                Page
                <input
                  aria-label="Go to page"
                  type="number"
                  min="1"
                  max={info.count}
                  value={jump}
                  onChange={(e) => setJump(e.target.value)}
                />
                <span>of {info.count}</span>
              </label>
            </form>
            <button
              className="reader-icon"
              aria-label="Next page"
              disabled={page === info.count - 1}
              onClick={() => go(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            className="reader-add-page"
            disabled={!!busy || info.count >= 300}
            onClick={appendPage}
          >
            <Plus size={14} />
            Add page
          </button>
          <span className="reader-draft-notice">
            {notice || `${marks.length} marks · original unchanged`}
          </span>
          <div className="reader-view-controls">
            <select
              aria-label="Page layout"
              value={continuous ? 'continuous' : 'single'}
              onChange={(e) => setContinuous(e.target.value === 'continuous')}
            >
              <option value="continuous">Continuous</option>
              <option value="single">Single page</option>
            </select>
            <button
              className="reader-icon"
              aria-label="Zoom out"
              onClick={() => changeZoom(1 / 1.15)}
            >
              <ZoomOut size={17} />
            </button>
            <span>{Math.round(scaleFor(page) * 100)}%</span>
            <button className="reader-icon" aria-label="Zoom in" onClick={() => changeZoom(1.15)}>
              <ZoomIn size={17} />
            </button>
            <button
              className="reader-icon"
              aria-label="Fit page"
              aria-pressed={fit === 'page'}
              onClick={() => setFit('page')}
            >
              <Maximize2 size={17} />
            </button>
            <button
              className="reader-icon"
              aria-label="Fit width"
              aria-pressed={fit === 'width'}
              onClick={() => setFit('width')}
            >
              <ChevronsUpDown size={17} />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
