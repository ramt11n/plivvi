import LoadingProgress from './LoadingProgress';
import { SponsorPlacement } from './PublicPages';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Plus,
  ArrowRight,
  ArrowLeft,
  Download,
  Check,
  ShieldCheck,
  Camera,
  Trash2,
  Copy,
  GripVertical,
  RotateCw,
  FolderPlus,
  BookOpen,
  FileText,
  Share2,
  Cloud,
} from 'lucide-react';
import type { Tool } from '../lib/catalog';
import { bytes } from '../lib/catalog';
import { rpc, inputs, download, downloadAll, type Output, type Preview } from '../lib/client';
import { canvasBlob, loadImage } from '../lib/image';
import Icon from './Icon';
import SignaturePad from './SignaturePad';
const CameraView = lazy(() => import('./Camera')),
  ScanEditor = lazy(() => import('./ScanEditor'));
type Page = { id: string; source: number; index: number; url: string; rotation: number };
export default function ToolPanel({
  tool,
  initialFiles = [],
  initialOptions = {},
  onClose,
  onSave,
  onRead,
  onCloud,
}: {
  tool: Tool;
  initialFiles?: File[];
  initialOptions?: Record<string, string>;
  onClose: () => void;
  onSave: (o: Output[]) => Promise<void>;
  onRead?: (o: Output) => void;
  onCloud?: (o: Output) => void;
}) {
  const [files, setFiles] = useState<File[]>(initialFiles),
    [pages, setPages] = useState<Page[]>([]),
    [preview, setPreview] = useState<Preview>(),
    [pageCount, setPageCount] = useState<number>(),
    [options, setOptions] = useState<any>({
      range: '',
      splitMode: 'every',
      rotation: 90,
      format: tool.id === 'image-convert' ? 'png' : 'jpg',
      layout: tool.layout ?? 'a4',
      margin: 24,
      compression: 'lossless',
      resolution: 1500,
      text: tool.id === 'watermark' ? 'CONFIDENTIAL' : '',
      opacity: 0.18,
      page: 1,
      fontSize: 18,
      rect: { x: 0.1, y: 0.15, w: 0.3, h: 0.12 },
      language: 'eng',
      ocrOutput: 'text',
      fields: {},
      ...initialOptions,
    }),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [progressValue,setProgressValue]=useState<number|undefined>(0),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [results, setResults] = useState<Output[]>([]),
    [saved, setSaved] = useState(false),
    [camera, setCamera] = useState(false),
    [editImage, setEditImage] = useState<number | null>(null),
    [activePage, setActivePage] = useState<string>(),
    [fullPage, setFullPage] = useState<string>(),
    [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    urls = useRef<string[]>([]),
    rectStart = useRef<{ x: number; y: number } | null>(null),
    dragPage = useRef<string | null>(null),
    autoEdited = useRef(false);
  useEffect(() => {
    if (['scan', 'enhance'].includes(tool.id) && files.length && !autoEdited.current) {
      autoEdited.current = true;
      setEditImage(0);
    }
  }, [files, tool.id]);
  const set = (key: string, value: any) => setOptions((o: any) => ({ ...o, [key]: value }));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
    };
  }, [busy, onClose]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  async function add(incoming: File[]) {
    if (!incoming.length) return;
    if (incoming.some((f) => f.size > 100 * 1048576)) {
      setError('Please use files smaller than 100 MB each.');
      return;
    }
    const id = tool.id,
      allowed = incoming.every((f) =>
        id === 'office-pdf'
          ? /\.(docx|xlsx|pptx)$/i.test(f.name)
          : id === 'html-pdf'
            ? /\.(txt|md|html?)$/i.test(f.name)
            : ['scan', 'enhance', 'image-pdf', 'image-convert'].includes(id)
              ? f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
              : id === 'ocr'
                ? f.type.startsWith('image/') || /\.pdf$/i.test(f.name)
                : /\.pdf$/i.test(f.name),
      );
    if (!allowed) {
      setError('That file type is not supported by this tool. Check the accepted types below.');
      return;
    }
    setError('');
    setResults([]);
    setFiles((prev) =>
      [
        'merge',
        'image-pdf',
        'scan',
        'enhance',
        'image-convert',
        'office-pdf',
        'html-pdf',
        'ocr',
        'compare',
      ].includes(id)
        ? [...prev, ...incoming]
        : incoming.slice(0, 1),
    );
  }
  useEffect(() => {
    const gen = ++generation.current;
    if (!files.length) {
      setPages([]);
      setPreview(undefined);
      setPageCount(undefined);
      return;
    }
    let currentUrls: string[] = [];
    setLoading(true);setProgressValue(0);
    setPageCount(undefined);
    setError('');
    (async () => {
      const pgs: Page[] = [];
      let count = 0,
        complete = true;
      for (let source = 0; source < files.length; source++) {
        const file = files[source];
        if (/\.pdf$/i.test(file.name)) {
          try {
            const result = await rpc<Preview>('preview', {
              input: (await inputs([file],p=>gen===generation.current&&setProgressValue(p*0.15)))[0],
              password: options.currentPassword,
            },(label,percent)=>{if(gen===generation.current){setStatus(label);if(percent!==undefined)setProgressValue(15+percent*0.8);}});
            if (gen !== generation.current) return;
            count += result.count;
            if (source === 0) {
              setPreview(result);
              setOptions((o: any) => ({
                ...o,
                fields: Object.fromEntries((result.fields ?? []).map((f) => [f.name, f.value])),
              }));
            }
            for (const p of result.pages) {
              const url = URL.createObjectURL(new Blob([p.png as BlobPart], { type: 'image/png' }));
              currentUrls.push(url);
              pgs.push({ id: `${source}-${p.index}`, source, index: p.index, url, rotation: 0 });
            }
          } catch (e) {
            complete = false;
            if (gen === generation.current) setError((e as Error).message);
          }
        } else if (file.type.startsWith('image/')) {
          count++;
          const url = URL.createObjectURL(file);
          currentUrls.push(url);
          pgs.push({ id: `${source}-0`, source, index: 0, url, rotation: 0 });
        }
      }
      if (gen === generation.current) {
        urls.current.forEach((u) => URL.revokeObjectURL(u));
        urls.current = currentUrls;
        setPages(pgs);
        setPageCount(complete && count ? count : undefined);
        setActivePage(pgs[0]?.id);
      } else currentUrls.forEach((u) => URL.revokeObjectURL(u));
    })()
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        if (gen === generation.current) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [files, options.currentPassword]);
  const images = ['scan', 'enhance', 'image-pdf', 'image-convert'].includes(tool.id),
    placement = ['sign', 'annotate', 'redact'].includes(tool.id);
  useEffect(() => {
    if (!placement || !files[0] || !preview) return;
    const gen = ++generation.current;
    (async () => {
      try {
        const p = await rpc<Preview>('preview', {
          input: (await inputs([files[0]]))[0],
          password: options.currentPassword,
          pageIndex: Number(options.page) - 1,
        });
        if (gen !== generation.current) return;
        const url = URL.createObjectURL(
          new Blob([p.pages[0].png as BlobPart], { type: 'image/png' }),
        );
        urls.current.push(url);
        setFullPage(url);
      } catch (e) {
        if (gen === generation.current) setError((e as Error).message);
      }
    })();
  }, [placement, options.page, preview, files, options.currentPassword]);
  async function process() {
    setBusy(true);setProgressValue(0);
    setError('');
    setStatus('Preparing your document…');
    setSaved(false);
    try {
      let out: Output[];
      if (tool.id === 'image-convert') {
        out = [];
        for (const f of files) {
          const c = await loadImage(f, 5000),
            type = options.format === 'jpg' ? 'image/jpeg' : `image/${options.format}`,
            b = await canvasBlob(c, type, 0.9);
          if (b.type !== type)
            throw Error('This browser cannot export that format. Choose PNG or JPG.');
          out.push({
            name: f.name.replace(/\.[^.]+$/, '') + '.' + options.format,
            data: new Uint8Array(await b.arrayBuffer()),
            type,
          });
        }
      } else {
        let fs = files;
        if (images || tool.id === 'ocr') {
          fs = await Promise.all(
            files.map(async (f) => {
              if (!f.type.startsWith('image/')) return f;
              const c = await loadImage(f, 2200),
                b = await canvasBlob(c);
              return new File([b], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
            }),
          );
        }
        if (tool.id === 'ocr') {
          const { recognize } = await import('../lib/ocr');
          out = await recognize(await inputs(fs), options, setStatus);
        } else
          out = await rpc<Output[]>(
            'operate',
            {
              tool: tool.id,
              files: await inputs(fs,setProgressValue),
              options: {
                ...options,
                order: pages.map((p) => p.index),
                rotations: pages.map((p) => p.rotation),
              },
            },
            (label,percent)=>{setStatus(label);if(percent!==undefined)setProgressValue(10+percent*0.9);},
          );
      }
      setResults(out);
      setStatus('Your document is ready.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const move = (i: number, d: number) => {
    setPages((p) => {
      const a = [...p];
      if (i + d < 0 || i + d >= a.length) return a;
      [a[i], a[i + d]] = [a[i + d], a[i]];
      return a;
    });
  };
  return (
    <div
      className="modal-shade"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section className="tool-panel" role="dialog" aria-modal="true" aria-labelledby="tool-title">
        <header className="panel-header">
          <div className="panel-title">
            <span className={`tool-icon ${tool.color}`}>
              <Icon name={tool.icon} />
            </span>
            <div>
              <h2 id="tool-title">{tool.title}</h2>
              <p>{tool.description}</p>
            </div>
          </div>
          <button className="icon-button" disabled={busy} aria-label="Close tool" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {results.length ? (
          <div className="result-view">
            <div className="success-orbit">
              <Check size={34} />
            </div>
            <span className="eyebrow">ALL SET</span>
            <h2>A little more organized.</h2>
            <p className="muted">
              {results.length === 1 ? 'Your new file is ready.' : 'Your new files are ready.'} Your
              original files stay unchanged.
            </p>
            <div className="result-list">
              {results.map((o, i) => (
                <div key={i} className="result-file">
                  <span className="file-icon">
                    <FileText />
                  </span>
                  <div>
                    <strong>{o.name}</strong>
                    <span>{bytes(o.data.length)} · Ready to export</span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Download ${o.name}`}
                    onClick={() => download(o)}
                  >
                    <Download size={20} />
                  </button>
                </div>
              ))}
            </div>
            <div className="result-actions">
              {results.length === 1 && results[0].type === 'application/pdf' && onRead && (
                <button className="button secondary" onClick={() => onRead(results[0])}>
                  <BookOpen size={18} /> Read or edit PDF
                </button>
              )}
              <button
                className="button primary"
                onClick={() => (results.length > 1 ? downloadAll(results) : download(results[0]))}
              >
                <Download size={18} />
                {results.length > 1 ? 'Download ZIP' : 'Download file'}
              </button>
              <button
                className="button secondary"
                disabled={saved}
                onClick={async () => {
                  try {
                    await onSave(results);
                    setSaved(true);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {saved ? <Check size={17} /> : <FolderPlus size={17} />}{' '}
                {saved ? 'Saved on this device' : 'Save to workspace'}
              </button>
              {results.length === 1 && onCloud && (
                <button className="button secondary" onClick={() => onCloud(results[0])}>
                  <Cloud size={17} />
                  Save to cloud
                </button>
              )}
              {results.length === 1 && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    const f = new File([results[0].data as BlobPart], results[0].name, {
                      type: results[0].type,
                    });
                    if (navigator.canShare?.({ files: [f] })) {
                      try {
                        await navigator.share({ files: [f], title: f.name });
                      } catch {}
                    } else download(results[0]);
                  }}
                >
                  <Share2 size={17} />
                  Share / Files
                </button>
              )}
            </div>
            <button className="text-button" onClick={() => setResults([])}>
              Back to this tool
            </button>
          </div>
        ) : (
          <div className="tool-body">
            <div className="tool-main">
              <input
                ref={input}
                type="file"
                accept={tool.accept}
                multiple={[
                  'merge',
                  'scan',
                  'enhance',
                  'image-pdf',
                  'image-convert',
                  'office-pdf',
                  'html-pdf',
                  'ocr',
                  'compare',
                ].includes(tool.id)}
                hidden
                onChange={(e) => {
                  add(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              {!files.length ? (
                <div
                  className={`drop-zone large ${dragging ? 'dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    add(Array.from(e.dataTransfer.files));
                  }}
                >
                  <span className={`upload-orbit ${tool.color}`}>
                    <Upload size={28} />
                  </span>
                  <h3>Your document starts here</h3>
                  <p>Drop files here, or choose them from your device.</p>
                  <button className="button primary" onClick={() => input.current?.click()}>
                    <Plus size={18} />
                    Choose files
                  </button>
                  {images && (
                    <button className="text-button camera-link" onClick={() => setCamera(true)}>
                      <Camera size={16} />
                      Or use your camera
                    </button>
                  )}
                  <span className="drop-caption">
                    {tool.accept
                      .replace(/application\/pdf,?/g, '')
                      .replace(/image\/\*,?/g, 'Images ')
                      .replace(/,/g, ' · ')}{' '}
                    · up to 100 MB per file
                  </span>
                </div>
              ) : (
                <>
                  <div className="files-toolbar">
                    <span>
                      <strong>{files.length}</strong> {files.length === 1 ? 'file' : 'files'}
                      {pageCount !== undefined
                        ? ` · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`
                        : ''}
                    </span>
                    <div>
                      {images && (
                        <button className="text-button" onClick={() => setCamera(true)}>
                          <Camera size={16} />
                          Camera
                        </button>
                      )}
                      <button className="text-button" onClick={() => input.current?.click()}>
                        <Plus size={16} />
                        Add files
                      </button>
                    </div>
                  </div>
                  {tool.id === 'merge' ||
                  tool.id === 'compare' ||
                  tool.id === 'office-pdf' ||
                  tool.id === 'html-pdf' ? (
                    <div className="input-file-list">
                      {files.map((f, i) => (
                        <div className="input-file" key={i}>
                          <GripVertical size={18} className="muted" />
                          <span className={`file-icon ${tool.color}`}>
                            <FileText />
                          </span>
                          <div>
                            <strong>{f.name}</strong>
                            <span>{bytes(f.size)}</span>
                          </div>
                          {tool.id === 'merge' && (
                            <>
                              <button
                                className="icon-button small"
                                disabled={i === 0}
                                title="Move up"
                                onClick={() =>
                                  setFiles((p) => {
                                    const a = [...p];
                                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                                    return a;
                                  })
                                }
                              >
                                <ArrowLeft size={16} />
                              </button>
                              <button
                                className="icon-button small"
                                disabled={i === files.length - 1}
                                title="Move down"
                                onClick={() =>
                                  setFiles((p) => {
                                    const a = [...p];
                                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                                    return a;
                                  })
                                }
                              >
                                <ArrowRight size={16} />
                              </button>
                            </>
                          )}
                          <button
                            className="icon-button small"
                            aria-label={`Remove ${f.name}`}
                            onClick={() => setFiles((p) => p.filter((_, j) => i !== j))}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : placement && fullPage ? (
                    <div className="placement-space">
                      <p className="small muted">
                        {tool.id === 'redact'
                          ? 'Drag a rectangle over the content to remove.'
                          : 'Tap the page to position your text or signature.'}
                      </p>
                      <div
                        className="placement-page"
                        onPointerDown={(e) => {
                          const r = e.currentTarget.getBoundingClientRect(),
                            x = Math.max(0, Math.min(0.95, (e.clientX - r.left) / r.width)),
                            y = Math.max(0, Math.min(0.95, (e.clientY - r.top) / r.height));
                          if (tool.id === 'redact') {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            rectStart.current = { x, y };
                            set('rect', { x, y, w: 0.01, h: 0.01 });
                          } else
                            set('rect', {
                              ...options.rect,
                              x: Math.min(x, 1 - options.rect.w),
                              y: Math.min(y, 1 - options.rect.h),
                            });
                        }}
                        onPointerMove={(e) => {
                          const s = rectStart.current;
                          if (!s) return;
                          const r = e.currentTarget.getBoundingClientRect(),
                            x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                            y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                          set('rect', {
                            x: Math.min(s.x, x),
                            y: Math.min(s.y, y),
                            w: Math.max(0.005, Math.abs(x - s.x)),
                            h: Math.max(0.005, Math.abs(y - s.y)),
                          });
                        }}
                        onPointerUp={() => (rectStart.current = null)}
                        onPointerCancel={() => (rectStart.current = null)}
                      >
                        <img src={fullPage} alt={`Document page ${options.page}`} />
                        <div
                          className={`placement-box ${tool.id}`}
                          style={{
                            left: `${options.rect.x * 100}%`,
                            top: `${options.rect.y * 100}%`,
                            width: `${options.rect.w * 100}%`,
                            height: tool.id === 'annotate' ? 'auto' : `${options.rect.h * 100}%`,
                          }}
                        >
                          {tool.id === 'sign' && options.signature ? (
                            <img src={options.signature} alt="Signature placement" />
                          ) : tool.id === 'annotate' ? (
                            <span>{options.text || 'Your text here'}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="pages-grid">
                        {pages.map((p, i) => (
                          <div
                            className={`page-card ${activePage === p.id ? 'selected' : ''}`}
                            key={p.id}
                            draggable={tool.id === 'organize'}
                            onDragStart={() => (dragPage.current = p.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const from = pages.findIndex((q) => q.id === dragPage.current);
                              if (from < 0) return;
                              setPages((old) => {
                                const a = [...old],
                                  v = a.splice(from, 1)[0];
                                a.splice(i, 0, v);
                                return a;
                              });
                            }}
                            onClick={() => setActivePage(p.id)}
                          >
                            <div className="page-image">
                              <img
                                src={p.url}
                                alt={`Page ${p.index + 1}`}
                                style={{ transform: `rotate(${p.rotation}deg)` }}
                              />
                              {images && (
                                <button
                                  className="page-edit"
                                  onClick={() => setEditImage(p.source)}
                                >
                                  Adjust scan
                                </button>
                              )}
                            </div>
                            <div className="page-bottom">
                              <span>
                                {images ? `Photo ${p.source + 1}` : `Page ${p.index + 1}`}
                              </span>
                              {tool.id === 'organize' && (
                                <div>
                                  <button
                                    title="Move left"
                                    disabled={i === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      move(i, -1);
                                    }}
                                  >
                                    <ArrowLeft size={13} />
                                  </button>
                                  <button
                                    title="Move right"
                                    disabled={i === pages.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      move(i, 1);
                                    }}
                                  >
                                    <ArrowRight size={13} />
                                  </button>
                                  <button
                                    title="Rotate page"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPages((old) =>
                                        old.map((q) =>
                                          q.id === p.id
                                            ? { ...q, rotation: (q.rotation + 90) % 360 }
                                            : q,
                                        ),
                                      );
                                    }}
                                  >
                                    <RotateCw size={13} />
                                  </button>
                                  <button
                                    title="Duplicate page"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPages((old) => [
                                        ...old.slice(0, i + 1),
                                        { ...p, id: crypto.randomUUID() },
                                        ...old.slice(i + 1),
                                      ]);
                                    }}
                                  >
                                    <Copy size={13} />
                                  </button>
                                  <button
                                    title="Remove page"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPages((old) => old.filter((q) => q.id !== p.id));
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                              {images && (
                                <button
                                  className="icon-button small"
                                  aria-label="Remove photo"
                                  onClick={() =>
                                    setFiles((old) => old.filter((_, j) => j !== p.source))
                                  }
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {preview && preview.count > 60 && (
                        <p className="info-note">
                          Preview shows the first 60 pages. For larger documents use Extract, Split,
                          or Rotate with page ranges.
                        </p>
                      )}
                    </>
                  )}
                  {loading && <LoadingProgress label={status || "Preparing page previews…"} value={progressValue} />}
                  <button
                    className="text-button small"
                    onClick={() => {
                      setFiles([]);
                      setPages([]);
                      setResults([]);
                    }}
                  >
                    Clear files
                  </button>
                </>
              )}
            </div>
            <aside className="tool-options">
              <h3>Make it yours</h3>
              {tool.note && <p className="tool-note">{tool.note}</p>}
              {['split', 'extract', 'remove', 'rotate', 'watermark', 'numbers', 'crop'].includes(
                tool.id,
              ) && (
                <>
                  {tool.id === 'split' && (
                    <label>
                      Split by
                      <select
                        value={options.splitMode}
                        onChange={(e) => set('splitMode', e.target.value)}
                      >
                        <option value="every">Every page separately</option>
                        <option value="ranges">Custom page ranges</option>
                      </select>
                    </label>
                  )}
                  {(tool.id !== 'split' || options.splitMode === 'ranges') && (
                    <label>
                      {tool.id === 'remove' ? 'Pages to remove' : 'Page ranges'}
                      <input
                        placeholder="All pages, or 1-3, 5, 7-9"
                        value={options.range}
                        onChange={(e) => set('range', e.target.value)}
                      />
                      <small>
                        {tool.id === 'split'
                          ? 'Each comma-separated range becomes a file.'
                          : 'Leave blank to use all pages.'}
                      </small>
                    </label>
                  )}
                </>
              )}
              {tool.id === 'rotate' && (
                <label>
                  Rotate by
                  <select
                    value={options.rotation}
                    onChange={(e) => set('rotation', +e.target.value)}
                  >
                    <option value="90">90° clockwise</option>
                    <option value="180">180°</option>
                    <option value="270">90° counterclockwise</option>
                  </select>
                </label>
              )}
              {images && tool.id !== 'image-convert' && (
                <>
                  <label>
                    Page layout
                    <select value={options.layout} onChange={(e) => set('layout', e.target.value)}>
                      <option value="a4">A4 document</option>
                      <option value="letter">US Letter</option>
                      <option value="original">Original image size</option>
                      <option value="id">ID copy — front & back</option>
                      <option value="passport">Passport copy</option>
                    </select>
                  </label>
                  {options.layout === 'id' || options.layout === 'passport' ? (
                    <p className="info-note">
                      Uses {options.layout === 'id' ? 'the first two photos' : 'the first photo'}. A
                      copy layout for your own document; not a government-issued form.
                    </p>
                  ) : (
                    <label>
                      Margins (points)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={options.margin}
                        onChange={(e) => set('margin', +e.target.value)}
                      />
                    </label>
                  )}
                  <p className="small muted">
                    Tap Adjust scan on a photo for crop corners, filters, and shadow reduction.
                  </p>
                </>
              )}
              {tool.id === 'image-convert' && (
                <label>
                  Output format
                  <select value={options.format} onChange={(e) => set('format', e.target.value)}>
                    <option value="jpg">JPG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP</option>
                  </select>
                </label>
              )}
              {tool.id === 'pdf-image' && (
                <>
                  <label>
                    Output format
                    <select value={options.format} onChange={(e) => set('format', e.target.value)}>
                      <option value="jpg">JPG</option>
                      <option value="png">PNG</option>
                    </select>
                  </label>
                  <label>
                    Page width
                    <select
                      value={options.resolution}
                      onChange={(e) => set('resolution', +e.target.value)}
                    >
                      <option value="1000">1000 px · smaller</option>
                      <option value="1500">1500 px · balanced</option>
                      <option value="2200">2200 px · sharper</option>
                    </select>
                  </label>
                </>
              )}
              {tool.id === 'compress' && (
                <label>
                  Compression
                  <select
                    value={options.compression}
                    onChange={(e) => set('compression', e.target.value)}
                  >
                    <option value="lossless">Lossless · preserve text and forms</option>
                    <option value="raster">Image copy · smaller, flattened</option>
                  </select>
                </label>
              )}
              {tool.id === 'sign' && <SignaturePad onChange={(s) => set('signature', s)} />}
              {placement && (
                <label>
                  Page
                  <input
                    type="number"
                    min="1"
                    max={preview?.count ?? 1}
                    value={options.page}
                    onChange={(e) =>
                      set('page', Math.max(1, Math.min(preview?.count ?? 1, +e.target.value)))
                    }
                  />
                </label>
              )}
              {['watermark', 'annotate'].includes(tool.id) && (
                <label>
                  {tool.id === 'watermark' ? 'Watermark text' : 'Text to add'}
                  <textarea
                    value={options.text}
                    onChange={(e) => set('text', e.target.value)}
                    placeholder="Type your text…"
                    rows={3}
                  />
                </label>
              )}
              {tool.id === 'annotate' && (
                <label>
                  Font size
                  <input
                    type="number"
                    min="6"
                    max="72"
                    value={options.fontSize}
                    onChange={(e) => set('fontSize', +e.target.value)}
                  />
                </label>
              )}
              {tool.id === 'sign' && (
                <label>
                  Signature width
                  <input
                    type="range"
                    min=".1"
                    max=".6"
                    step=".02"
                    value={options.rect.w}
                    onChange={(e) =>
                      set('rect', {
                        ...options.rect,
                        w: +e.target.value,
                        x: Math.min(options.rect.x, 1 - +e.target.value),
                      })
                    }
                  />
                </label>
              )}
              {tool.id === 'watermark' && (
                <label>
                  Opacity
                  <input
                    type="range"
                    min=".05"
                    max=".8"
                    step=".05"
                    value={options.opacity}
                    onChange={(e) => set('opacity', +e.target.value)}
                  />
                </label>
              )}
              {tool.id === 'numbers' && (
                <label>
                  Start at
                  <input
                    type="number"
                    min="1"
                    value={options.start ?? 1}
                    onChange={(e) => set('start', +e.target.value)}
                  />
                </label>
              )}
              {tool.id === 'crop' && (
                <label>
                  Trim from every edge (points)
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={options.margin}
                    onChange={(e) => set('margin', +e.target.value)}
                  />
                </label>
              )}
              {tool.id === 'protect' && (
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={options.password ?? ''}
                    onChange={(e) => set('password', e.target.value)}
                  />
                </label>
              )}
              {tool.id === 'ocr' && (
                <>
                  <label>
                    Language
                    <select
                      value={options.language}
                      onChange={(e) => set('language', e.target.value)}
                    >
                      <option value="eng">English</option>
                      <option value="fas">Persian / فارسی</option>
                      <option value="ara">Arabic / العربية</option>
                    </select>
                  </label>
                  <label>
                    Result
                    <select
                      value={options.ocrOutput}
                      onChange={(e) => set('ocrOutput', e.target.value)}
                    >
                      <option value="text">Editable text file</option>
                      <option value="searchable">Searchable PDF copy</option>
                    </select>
                  </label>
                </>
              )}
              {tool.id === 'forms' &&
                (preview?.fields?.length ? (
                  preview.fields.map((f) => (
                    <label key={f.name}>
                      {f.name}
                      {f.readOnly || f.type.toLowerCase().includes('signature') ? (
                        <span className="small muted">Read-only or certificate field</span>
                      ) : f.options?.length ? (
                        <select
                          value={options.fields[f.name] ?? f.value}
                          onChange={(e) =>
                            set('fields', { ...options.fields, [f.name]: e.target.value })
                          }
                        >
                          {f.type.toLowerCase().includes('check') ? (
                            <option value="Off">Unchecked</option>
                          ) : f.value === 'Off' ? (
                            <option value="Off" disabled>
                              Choose an option
                            </option>
                          ) : null}
                          {f.options.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={options.fields[f.name] ?? ''}
                          onChange={(e) =>
                            set('fields', { ...options.fields, [f.name]: e.target.value })
                          }
                        />
                      )}
                    </label>
                  ))
                ) : (
                  <p className="small muted">
                    {files.length && !loading
                      ? 'No interactive fields were found. Try Add text for a flat PDF.'
                      : 'Upload a PDF to find its fields.'}
                  </p>
                ))}
              {tool.id === 'metadata' && (
                <>
                  {['title', 'author', 'subject'].map((k) => (
                    <label key={k} className="capitalize">
                      {k}
                      <input value={options[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
                    </label>
                  ))}
                </>
              )}
              {tool.id === 'summary' && (
                <label>
                  Key sentences
                  <select
                    value={options.sentences ?? 6}
                    onChange={(e) => set('sentences', +e.target.value)}
                  >
                    <option value="3">3 sentences</option>
                    <option value="6">6 sentences</option>
                    <option value="10">10 sentences</option>
                  </select>
                </label>
              )}
              {!images && tool.id !== 'office-pdf' && tool.id !== 'html-pdf' && (
                <details
                  className="password-details"
                  open={tool.id === 'unlock' || error.includes('password')}
                >
                  <summary>Source PDF has a password?</summary>
                  <label>
                    Current password
                    <input
                      type="password"
                      autoComplete="off"
                      value={options.currentPassword ?? ''}
                      onChange={(e) => set('currentPassword', e.target.value)}
                    />
                  </label>
                </details>
              )}
              <div className="local-promise">
                <ShieldCheck size={20} />
                <div>
                  <strong>Just you and your document.</strong>
                  <p>Files are processed on this device. Cloud saving is optional.</p>
                </div>
              </div>
            </aside>
          </div>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {results.length > 0 && <SponsorPlacement />}
        {!results.length && (
          <footer className="panel-footer">
            <div className="small muted">
              {busy ? (
                <LoadingProgress label={status || 'Processing your document…'} value={progressValue} />
              ) : (
                <>
                  <ShieldCheck size={15} />
                  Private by design
                </>
              )}
            </div>
            <button
              className="button primary"
              disabled={
                !files.length ||
                busy ||
                loading ||
                (tool.id === 'organize' && (preview?.count ?? 0) > 60)
              }
              onClick={process}
            >
              {busy ? <span className="spinner" /> : null}
              {busy ? 'Working…' : tool.action}
              {!busy && <ArrowRight size={17} />}
            </button>
          </footer>
        )}
      </section>
      {camera && (
        <Suspense>
          <CameraView onClose={() => setCamera(false)} onCapture={(f) => add([f])} />
        </Suspense>
      )}
      {editImage !== null && files[editImage] && (
        <Suspense>
          <ScanEditor
            file={files[editImage]}
            onClose={() => setEditImage(null)}
            onSave={(f) => setFiles((old) => old.map((v, i) => (i === editImage ? f : v)))}
          />
        </Suspense>
      )}
    </div>
  );
}
