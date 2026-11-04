import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  ArrowRight,
  Download,
  Pencil,
  Trash2,
  X,
  Check,
  Upload,
} from 'lucide-react';
import {
  changeNotebook,
  notebookPDF,
  readNotebooks,
  saveNotebookDraft,
  type Notebook,
  type Paper,
} from './model';
import LoadingProgress from '../components/LoadingProgress';
import { readFile } from '../lib/readFile';
import { download, type Output } from '../lib/client';
import type { Mark } from '../reader/types';
const PDFReader = lazy(() => import('../reader/PDFReader'));
const covers = ['#3659e3', '#35916f', '#ce725d', '#8972ba', '#25344f', '#ca9848'];
const papers: [Paper, string][] = [
  ['ruled', 'Ruled'],
  ['dots', 'Dotted'],
  ['grid', 'Grid'],
  ['cornell', 'Cornell'],
  ['blank', 'Blank'],
];
export default function Notebooks({
  workspace,
  onSave,
  onCloud,
}: {
  workspace: string;
  onSave: (o: Output[]) => Promise<void>;
  onCloud: (o?: Output) => void;
}) {
  const [books, setBooks] = useState<Notebook[]>([]),
    [ready, setReady] = useState(false),
    [query, setQuery] = useState(''),
    [active, setActive] = useState<Notebook>(),
    [editing, setEditing] = useState<Notebook>(),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState('My next big idea'),
    [paper, setPaper] = useState<Paper>('ruled'),
    [color, setColor] = useState(covers[0]),
    [count, setCount] = useState(3),
    [busy, setBusy] = useState(false),
    [creationProgress, setCreationProgress] = useState<{ label: string; value?: number }>({
      label: 'Preparing the notebook editor…',
    }),
    [error, setError] = useState(''),
    [remove, setRemove] = useState<Notebook>();
  const current = useRef(workspace),
    lastSource = useRef(new Map<string, ArrayBuffer>()),
    importing = useRef<HTMLInputElement>(null);
  current.current = workspace;
  useEffect(() => {
    let alive = true;
    readNotebooks(workspace)
      .then((b) => {
        if (alive) {
          setBooks(b);
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive) {
          setReady(true);
          setError(e.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [workspace]);
  async function mutate(fn: (b: Notebook[]) => Notebook[]) {
    const scope = workspace,
      next = await changeNotebook(scope, fn);
    if (current.current === scope) setBooks(next);
    return next;
  }
  async function create() {
    setCreationProgress({ label: 'Preparing the notebook editor…', value: 0 });
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await mutate((b) =>
          b.map((n) =>
            n.id === editing.id
              ? {
                  ...n,
                  title: title.trim() || 'Untitled notebook',
                  color,
                  updated: new Date().toISOString(),
                }
              : n,
          ),
        );
        setEditing(undefined);
      } else {
        const data = await notebookPDF(paper, count, (done, total) =>
            setCreationProgress({
              label: `Creating pages · ${done} of ${total}`,
              value: 5 + (done / total) * 85,
            }),
          ),
          now = new Date().toISOString(),
          book: Notebook = {
            id: crypto.randomUUID(),
            title: title.trim() || 'Untitled notebook',
            color,
            paper,
            data,
            marks: [],
            updated: now,
            created: now,
          };
        setCreationProgress({ label: 'Saving your notebook on this device…', value: 95 });
        await mutate((b) => [book, ...b]);
        setActive(book);
      }
      setCreating(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft(marks: Mark[], data: ArrayBuffer) {
    if (!active) return;
    const id = active.id;
    const changed = lastSource.current.get(id) !== data;
    const updated = await saveNotebookDraft(workspace, id, marks, changed ? data : undefined);
    lastSource.current.set(id, data);
    if (current.current === workspace)
      setBooks((books) =>
        books.map((b) =>
          b.id === id
            ? { ...b, marks, updated, ...(changed ? { data: new Uint8Array(data) } : {}) }
            : b,
        ),
      );
  }
  async function importPDF(file?: File) {
    if (!file) return;
    setCreationProgress({ label: 'Reading your PDF…', value: 0 });
    setBusy(true);
    setError('');
    try {
      if (file.size > 100 * 1048576) throw Error('Choose a PDF smaller than 100 MB.');
      const now = new Date().toISOString(),
        book: Notebook = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.pdf$/i, ''),
          color: covers[0],
          paper: 'blank',
          marks: [],
          data: new Uint8Array(
            await readFile(file, (percent) =>
              setCreationProgress({ label: 'Reading your PDF…', value: percent * 0.9 }),
            ),
          ),
          created: now,
          updated: now,
        };
      setCreationProgress({ label: 'Saving your notebook on this device…', value: 95 });
      await mutate((b) => [book, ...b]);
      setActive(book);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = books
    .filter((b) => b.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => b.updated.localeCompare(a.updated));
  return (
    <div className="notebooks-page">
      <section className="notebook-hero">
        <div>
          <span className="feature-eyebrow">YOUR IDEAS HAVE A HOME · FREE TO CREATE</span>
          <h1>
            A fresh page.
            <br />
            <em>A world of possibility.</em>
          </h1>
          <p>
            Make a notebook for lectures, plans, sketches, or the thought that won’t wait. Write
            with your pen. Keep it your way.
          </p>
          <div className="notebook-hero-actions">
            <button
              className="button primary"
              onClick={() => {
                setEditing(undefined);
                setTitle('My next big idea');
                setCreating(true);
              }}
            >
              <Plus size={18} />
              New notebook
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => importing.current?.click()}
            >
              <Upload size={17} />
              Use a PDF
            </button>
          </div>
          <small>No page subscriptions. No account required. Saved on this device.</small>
        </div>
        <div className="notebook-hero-art" aria-hidden="true">
          <div className="hero-cover back" />
          <div className="hero-cover front">
            <span>
              MAKE
              <br />
              IT
              <br />
              <em>yours.</em>
            </span>
            <BookOpen size={34} />
            <b>plivvi.</b>
          </div>
          <span className="notebook-art-label">Room for your next good idea ↗</span>
        </div>
      </section>
      <input
        ref={importing}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          void importPDF(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="section-heading">
        <div>
          <h2>
            Your notebooks <span>{books.length}</span>
          </h2>
          <p>Pick up where you left off.</p>
        </div>
        <label className="notebook-search">
          <Search size={17} />
          <input
            aria-label="Search notebooks"
            placeholder="Find a notebook…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {error && !creating && !editing && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {busy && !creating && !editing && (
        <LoadingProgress label={creationProgress.label} value={creationProgress.value} />
      )}
      {!ready ? (
        <LoadingProgress
          label="Opening your notebooks…"
          detail="Reading saved notebooks from this device."
        />
      ) : (
        <div className="notebook-shelf">
          {visible.map((book) => (
            <article className="notebook-card" key={book.id}>
              <button
                className="notebook-cover"
                style={{ '--cover': book.color } as React.CSSProperties}
                onClick={() => setActive(book)}
              >
                <span className="notebook-spine" />
                <small>PLIVVI NOTEBOOK</small>
                <strong dir="auto">{book.title}</strong>
                <span className="cover-paper">
                  {papers.find((p) => p[0] === book.paper)?.[1]} paper <ArrowRight size={15} />
                </span>
              </button>
              <div className="notebook-card-info">
                <span>Edited {new Date(book.updated).toLocaleDateString()}</span>
                <button
                  className="icon-button"
                  aria-label={`Rename ${book.title}`}
                  onClick={() => {
                    setEditing(book);
                    setTitle(book.title);
                    setColor(book.color);
                    setCreating(true);
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${book.title}`}
                  onClick={() => setRemove(book)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          <button
            className="notebook-new-card"
            onClick={() => {
              setEditing(undefined);
              setTitle('My next big idea');
              setCreating(true);
            }}
          >
            <Plus size={25} />
            <strong>{query ? 'Start another idea' : 'Your next notebook'}</strong>
            <span>Always room for one more.</span>
          </button>
        </div>
      )}
      <section className="notebook-promises">
        <div>
          <BookOpen />
          <h3>Paper that fits your thinking.</h3>
          <p>
            Blank, ruled, dotted, grid, and Cornell. Add a different page whenever you need one.
          </p>
        </div>
        <div>
          <Pencil />
          <h3>A pen-first workspace.</h3>
          <p>
            Pressure and tilt where your browser supports them. Finger navigation, editable ink,
            photos, and text.
          </p>
        </div>
        <div>
          <Download />
          <h3>Yours to take anywhere.</h3>
          <p>Export PDF, PNG, or JPG. Keep a backup through Files or your own cloud connection.</p>
        </div>
      </section>
      {creating && (
        <div className="modal-shade">
          <form
            className="info-dialog notebook-create"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <button
              type="button"
              className="icon-button dialog-close"
              aria-label="Close notebook setup"
              onClick={() => {
                setCreating(false);
                setEditing(undefined);
              }}
            >
              <X />
            </button>
            <span className="feature-eyebrow">A LITTLE SPACE, ALL YOURS</span>
            <h2>{editing ? 'Make it yours.' : 'Start a good thing.'}</h2>
            <label>
              Notebook name
              <input
                dir="auto"
                aria-label="Notebook name"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <fieldset>
              <legend>Cover color</legend>
              <div className="notebook-colors">
                {covers.map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-label={`Cover ${c}`}
                    aria-pressed={color === c}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  >
                    {color === c && <Check size={17} />}
                  </button>
                ))}
              </div>
            </fieldset>
            {!editing && (
              <>
                <fieldset>
                  <legend>Paper style</legend>
                  <div className="paper-options">
                    {papers.map(([id, name]) => (
                      <button
                        className={paper === id ? 'active' : ''}
                        type="button"
                        key={id}
                        onClick={() => setPaper(id)}
                        aria-pressed={paper === id}
                      >
                        <span className={`paper-sample ${id}`} />
                        {name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Starting pages
                  <input
                    type="number"
                    aria-label="Starting pages"
                    min={1}
                    max={30}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </label>
              </>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? 'Preparing your notebook…' : editing ? 'Save changes' : 'Create notebook'}
              <ArrowRight size={17} />
            </button>
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            {busy && (
              <LoadingProgress label={creationProgress.label} value={creationProgress.value} />
            )}
          </form>
        </div>
      )}
      {remove && (
        <div className="modal-shade">
          <section className="info-dialog">
            <h2>Remove this notebook?</h2>
            <p>
              Download a PDF backup first if you want to keep “{remove.title}”. Removing it deletes
              its local pages and ink.
            </p>
            <div className="notebook-hero-actions">
              <button className="button secondary" onClick={() => setRemove(undefined)}>
                Keep it
              </button>
              <button
                className="button primary"
                onClick={async () => {
                  try {
                    await mutate((b) => b.filter((n) => n.id !== remove.id));
                    setRemove(undefined);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Delete notebook
              </button>
            </div>
          </section>
        </div>
      )}
      {active && (
        <Suspense fallback={<LoadingProgress label="Loading the notebook editor…" />}>
          <PDFReader
            workspace={workspace}
            initialFile={
              new File([active.data as BlobPart], `${active.title}.pdf`, {
                type: 'application/pdf',
              })
            }
            notebook={{
              id: active.id,
              marks: active.marks,
              paper: active.paper,
              onDraft: saveDraft,
            }}
            onClose={() => setActive(undefined)}
            onSave={onSave}
            onCloud={onCloud}
          />
        </Suspense>
      )}
    </div>
  );
}
