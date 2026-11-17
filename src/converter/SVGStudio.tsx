import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { X, Download, Undo2, Redo2, Upload, ArrowRight, Copy, PenTool } from 'lucide-react';
import { downloadBlob } from './downloads';
import './converter.css';

const blank =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"></svg>';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
  );
export function cleanSVG(source: string) {
  if (source.length > 500000)
    throw Error(
      'Keep editable SVG code below 500 KB. Use the file converter for larger vector documents.',
    );
  const safe = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      'script',
      'foreignObject',
      'image',
      'use',
      'style',
      'a',
      'animate',
      'animateTransform',
      'animateMotion',
      'set',
    ],
    FORBID_ATTR: ['style'],
  });
  const doc = new DOMParser().parseFromString(safe, 'image/svg+xml'),
    root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror'))
    throw Error('Enter a complete, valid <svg> document.');
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attr of Array.from(element.attributes)) {
      if (
        (/href$/i.test(attr.name) && !attr.value.startsWith('#')) ||
        /url\(\s*['"]?(?!#)/i.test(attr.value)
      )
        element.removeAttribute(attr.name);
    }
  }
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!root.hasAttribute('viewBox'))
    root.setAttribute(
      'viewBox',
      `0 0 ${parseFloat(root.getAttribute('width') || '800') || 800} ${parseFloat(root.getAttribute('height') || '600') || 600}`,
    );
  return new XMLSerializer().serializeToString(root);
}
type Point = { x: number; y: number; pressure?: number };
export default function SVGStudio({
  onClose,
  onConvert,
}: {
  onClose: () => void;
  onConvert: (file: File) => void;
}) {
  const [history, setHistory] = useState(() => {
      try {
        return [cleanSVG(localStorage.getItem('plivvi-svg-draft') || blank)];
      } catch {
        return [blank];
      }
    }),
    [index, setIndex] = useState(0),
    [code, setCode] = useState(history[0]);
  const [selectedObject, setSelectedObject] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [finger, setFinger] = useState(false),
    [pressure, setPressure] = useState(true),
    [transparent, setTransparent] = useState(false),
    [showCode, setShowCode] = useState(true);
  const gesture = useRef<{ x: number; y: number; ox: number; oy: number; id: number } | null>(null);
  const [mode, setMode] = useState('pen'),
    [fill, setFill] = useState('#b7d7f4'),
    [stroke, setStroke] = useState('#244cc9'),
    [weight, setWeight] = useState(4);
  const [text, setText] = useState('Your idea'),
    [draft, setDraft] = useState(''),
    [message, setMessage] = useState('');
  const [size, setSize] = useState({ width: 800, height: 600 });
  const board = useRef<SVGSVGElement>(null),
    upload = useRef<HTMLInputElement>(null),
    points = useRef<Point[]>([]);
  const source = history[index];
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('plivvi-svg-draft', source);
      } catch {
        setMessage('Draft storage is full. Download a backup.');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [source]);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const moving = useRef<{ index: number; x: number; y: number; transform: string } | null>(null);
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml'),
    root = parsed.documentElement;
  const viewBox = root.getAttribute('viewBox') || '0 0 800 600';
  const inner = Array.from(root.childNodes)
    .map((node) => new XMLSerializer().serializeToString(node))
    .join('');
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  function commit(value: string) {
    const safe = cleanSVG(value);
    setHistory((current) => [...current.slice(0, index + 1), safe].slice(-100));
    setIndex(Math.min(index + 1, 99));
    setCode(safe);
    setDraft('');
    setMessage('');
  }
  function append(shape: string) {
    const fragment = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${shape}</svg>`,
      'image/svg+xml',
    );
    for (const node of Array.from(fragment.documentElement.childNodes))
      root.appendChild(parsed.importNode(node, true));
    commit(new XMLSerializer().serializeToString(root));
  }
  function point(event: React.PointerEvent): Point {
    const p = board.current!.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const result = p.matrixTransform(board.current!.getScreenCTM()!.inverse());
    return {
      x: Math.round(result.x),
      y: Math.round(result.y),
      pressure: event.pointerType === 'pen' && pressure ? Math.max(0.1, event.pressure) : 0.5,
    };
  }
  function shape(list: Point[]) {
    const first = list[0],
      last = list[list.length - 1];
    const attrs = `stroke="${stroke}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"`;
    if (mode === 'pen' && pressure && list.length > 1) {
      const sides = list.map((p, i) => {
        const a = list[Math.max(0, i - 1)],
          b = list[Math.min(list.length - 1, i + 1)],
          dx = b.x - a.x,
          dy = b.y - a.y,
          n = Math.hypot(dx, dy) || 1,
          r = weight * (0.2 + (p.pressure ?? 0.5) * 0.8);
        return [
          { x: p.x - (dy / n) * r, y: p.y + (dx / n) * r },
          { x: p.x + (dy / n) * r, y: p.y - (dx / n) * r },
        ];
      });
      return `<path d="${[...sides.map((s) => s[0]), ...sides.map((s) => s[1]).reverse()].map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} Z" fill="${stroke}"/>`;
    }
    if (mode === 'text')
      return `<text x="${first.x}" y="${first.y}" fill="${stroke}" font-family="sans-serif" font-size="32" direction="${/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text) ? 'rtl' : 'ltr'}" unicode-bidi="plaintext">${escape(text)}</text>`;
    if (mode === 'pen')
      return `<path d="${list.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}" fill="none" ${attrs}/>`;
    if (mode === 'line')
      return `<line x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}" ${attrs}/>`;
    if (mode === 'rect')
      return `<rect x="${Math.min(first.x, last.x)}" y="${Math.min(first.y, last.y)}" width="${Math.abs(last.x - first.x)}" height="${Math.abs(last.y - first.y)}" fill="${transparent ? 'none' : fill}" ${attrs}/>`;
    if (mode === 'ellipse')
      return `<ellipse cx="${(first.x + last.x) / 2}" cy="${(first.y + last.y) / 2}" rx="${Math.abs(last.x - first.x) / 2}" ry="${Math.abs(last.y - first.y) / 2}" fill="${transparent ? 'none' : fill}" ${attrs}/>`;
    return '';
  }
  function finish(event: React.PointerEvent) {
    if (!points.current.length) return;
    const end = point(event);
    if (mode !== 'pen') points.current.push(end);
    append(shape(points.current));
    points.current = [];
  }
  const exportFile = () => new File([source], 'plivvi-drawing.svg', { type: 'image/svg+xml' });
  return (
    <div className="modal-shade converter-shade">
      <section
        className="converter-panel svg-studio"
        role="dialog"
        aria-modal="true"
        aria-label="SVG studio"
      >
        <header className="converter-header">
          <span className="converter-mark">
            <PenTool aria-hidden="true" />
          </span>
          <div>
            <span className="converter-eyebrow">PLIVVI / CREATE</span>
            <h2>SVG studio</h2>
            <p>Draw paths and shapes, or work directly with vector code.</p>
          </div>
          <button className="icon-button" aria-label="Close SVG studio" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="svg-toolbar">
          <div className="svg-modes" role="group" aria-label="Drawing tool">
            {[
              ['select', 'Select'],
              ['pan', 'Pan'],
              ['pen', 'Pen'],
              ['line', 'Line'],
              ['rect', 'Rectangle'],
              ['ellipse', 'Ellipse'],
              ['text', 'Text'],
            ].map(([id, title]) => (
              <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>
                {title}
              </button>
            ))}
          </div>
          <label>
            Stroke
            <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} />
          </label>
          <label>
            Fill
            <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} />
          </label>
          <label>
            Width
            <input
              type="number"
              min="1"
              max="80"
              value={weight}
              onChange={(e) => setWeight(Math.max(1, Math.min(80, +e.target.value)))}
            />
          </label>
          <button
            className="icon-button"
            aria-label="Undo"
            disabled={!index}
            onClick={() => {
              setIndex(index - 1);
              setCode(history[index - 1]);
            }}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            disabled={index === history.length - 1}
            onClick={() => {
              setIndex(index + 1);
              setCode(history[index + 1]);
            }}
          >
            <Redo2 size={17} />
          </button>
        </div>
        {mode === 'text' && (
          <label className="svg-text-entry">
            Text to place
            <input value={text} onChange={(e) => setText(e.target.value)} />
            <small>Click the drawing where the text should appear.</small>
          </label>
        )}
        <div className="svg-toolbar">
          <label>
            <input type="checkbox" checked={finger} onChange={(e) => setFinger(e.target.checked)} />
            Draw with finger
          </label>
          <label>
            <input
              type="checkbox"
              checked={pressure}
              onChange={(e) => setPressure(e.target.checked)}
            />
            Pressure
          </label>
          <label>
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            Transparent fill
          </label>
          <label>
            Canvas zoom
            <input
              aria-label="Canvas zoom"
              type="range"
              min="25"
              max="400"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
            />
          </label>
          <span>{zoom}%</span>
          <button
            onClick={() => {
              setZoom(100);
              setOffset({ x: 0, y: 0 });
            }}
          >
            Fit canvas
          </button>
          <button onClick={() => setShowCode(!showCode)} aria-pressed={showCode}>
            Vector source
          </button>
        </div>
        <div className={`svg-workspace ${showCode ? '' : 'svg-art-only'}`}>
          <div className="svg-board">
            <svg
              ref={board}
              viewBox={viewBox}
              style={{
                transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom / 100})`,
                transformOrigin: 'center',
              }}
              aria-label="Vector drawing canvas"
              onPointerDown={(event) => {
                event.preventDefault();
                if (event.pointerType === 'touch') {
                  touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                  if (touches.current.size === 2) {
                    const [a, b] = [...touches.current.values()];
                    pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
                    gesture.current = null;
                    points.current = [];
                    setDraft('');
                    board.current!.setPointerCapture(event.pointerId);
                    return;
                  }
                }
                if (!event.isPrimary) {
                  points.current = [];
                  setDraft('');
                  return;
                }
                board.current!.setPointerCapture(event.pointerId);
                if (mode === 'pan' || (event.pointerType === 'touch' && !finger)) {
                  gesture.current = {
                    x: event.clientX,
                    y: event.clientY,
                    ox: offset.x,
                    oy: offset.y,
                    id: event.pointerId,
                  };
                  return;
                }
                if (mode === 'select') {
                  const holder = board.current!.querySelector('g')!;
                  let target = event.target as Element;
                  while (target.parentElement && target.parentNode !== holder)
                    target = target.parentElement;
                  const at = Array.from(holder.children).indexOf(target);
                  setSelectedObject(at < 0 ? null : at);
                  if (at >= 0) {
                    const start = point(event);
                    moving.current = {
                      index: at,
                      x: start.x,
                      y: start.y,
                      transform: root.children[at]?.getAttribute('transform') || '',
                    };
                  }
                  return;
                }
                points.current = [point(event)];
                setDraft(shape(points.current));
              }}
              onPointerMove={(event) => {
                if (touches.current.has(event.pointerId))
                  touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                if (pinch.current && touches.current.size === 2) {
                  const [a, b] = [...touches.current.values()];
                  setZoom(
                    Math.max(
                      25,
                      Math.min(
                        400,
                        (pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
                          (pinch.current.distance || 1),
                      ),
                    ),
                  );
                  return;
                }
                if (moving.current) {
                  const m = moving.current,
                    end = point(event);
                  const node = board.current!.querySelector('g')?.children[m.index];
                  node?.setAttribute(
                    'transform',
                    `translate(${end.x - m.x} ${end.y - m.y}) ${m.transform}`,
                  );
                  return;
                }
                if (gesture.current) {
                  const g = gesture.current;
                  if (g.id === event.pointerId)
                    setOffset({ x: g.ox + event.clientX - g.x, y: g.oy + event.clientY - g.y });
                  return;
                }
                if (!points.current.length) return;
                if (mode === 'pen') points.current.push(point(event));
                else points.current = [points.current[0], point(event)];
                setDraft(shape(points.current));
              }}
              onPointerUp={(event) => {
                touches.current.delete(event.pointerId);
                if (pinch.current) {
                  pinch.current = null;
                  gesture.current = null;
                  return;
                }
                if (moving.current) {
                  const m = moving.current,
                    node = board.current!.querySelector('g')?.children[m.index];
                  if (node && root.children[m.index]) {
                    root.children[m.index].setAttribute(
                      'transform',
                      node.getAttribute('transform') || '',
                    );
                    commit(new XMLSerializer().serializeToString(root));
                  }
                  moving.current = null;
                  return;
                }
                if (gesture.current) {
                  gesture.current = null;
                  return;
                }
                finish(event);
              }}
              onPointerCancel={() => {
                points.current = [];
                gesture.current = null;
                touches.current.clear();
                pinch.current = null;
                moving.current = null;
                setDraft('');
              }}
            >
              <g dangerouslySetInnerHTML={{ __html: inner }} />
              <g dangerouslySetInnerHTML={{ __html: draft }} />
            </svg>
            <p>
              Draw with a stylus or mouse. Touch pans by default. Select objects in Layers to
              arrange them; edit any attribute in the source.
            </p>
          </div>
          <aside className="svg-code-pane" hidden={!showCode}>
            <strong>Layers · objects</strong>
            <div className="svg-layers" role="list" aria-label="Drawing layers">
              {Array.from(root.children).map((child, i) => (
                <button
                  key={i}
                  aria-pressed={selectedObject === i}
                  onClick={() => {
                    setSelectedObject(i);
                    setMode('select');
                  }}
                >
                  {i + 1}. {child.localName}
                </button>
              ))}
            </div>
            {selectedObject !== null && root.children[selectedObject] && (
              <div className="svg-object-actions">
                {[
                  'Move left',
                  'Move right',
                  'Move up',
                  'Move down',
                  'Duplicate object',
                  'Delete object',
                  'Bring to front',
                  'Send to back',
                ].map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      const node = root.children[selectedObject];
                      if (!node) return;
                      if (action.startsWith('Move')) {
                        const dx = action === 'Move left' ? -10 : action === 'Move right' ? 10 : 0,
                          dy = action === 'Move up' ? -10 : action === 'Move down' ? 10 : 0;
                        node.setAttribute(
                          'transform',
                          `translate(${dx} ${dy}) ${node.getAttribute('transform') || ''}`,
                        );
                      } else if (action === 'Duplicate object')
                        root.appendChild(node.cloneNode(true));
                      else if (action === 'Delete object') {
                        node.remove();
                        setSelectedObject(null);
                      } else if (action === 'Bring to front') root.appendChild(node);
                      else root.insertBefore(node, root.firstChild);
                      commit(new XMLSerializer().serializeToString(root));
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
            <div className="converter-toolbar">
              <strong>Vector source</strong>
              <button
                className="text-button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(source)
                    .then(() => setMessage('SVG code copied.'))
                    .catch(() => setMessage('Select the code and copy it.'))
                }
              >
                <Copy size={14} /> Copy
              </button>
            </div>
            <textarea
              spellCheck={false}
              aria-label="SVG code editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              className="button secondary"
              onClick={() => {
                try {
                  commit(code);
                  setMessage(
                    'SVG code applied. External resources and interactive content are removed.',
                  );
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Apply SVG code
            </button>
            <p>
              Editable local vectors. Scripts, embedded images, external resources and animation are
              removed on import.
            </p>
            <div className="svg-size">
              <label>
                Width
                <input
                  type="number"
                  value={size.width}
                  onChange={(e) => setSize((s) => ({ ...s, width: +e.target.value }))}
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  value={size.height}
                  onChange={(e) => setSize((s) => ({ ...s, height: +e.target.value }))}
                />
              </label>
              <button
                className="text-button"
                onClick={() => {
                  const w = Math.max(16, Math.min(10000, size.width)),
                    h = Math.max(16, Math.min(10000, size.height));
                  root.setAttribute('width', String(w));
                  root.setAttribute('height', String(h));
                  root.setAttribute('viewBox', `0 0 ${w} ${h}`);
                  commit(new XMLSerializer().serializeToString(root));
                }}
              >
                Resize canvas
              </button>
            </div>
          </aside>
        </div>
        <div className="svg-import">
          <input
            type="file"
            accept=".svg,image/svg+xml"
            hidden
            ref={upload}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 500000) throw Error('Use an SVG below 500 KB in the code editor.');
                commit(await file.text());
              } catch (e) {
                setMessage((e as Error).message);
              }
              event.target.value = '';
            }}
          />
          <button className="button secondary" onClick={() => upload.current?.click()}>
            <Upload size={15} /> Import SVG
          </button>
          <button className="text-button" onClick={() => commit(blank)}>
            New blank drawing
          </button>
          <span role="status">{message}</span>
        </div>
        <footer className="converter-footer">
          <button className="button secondary" onClick={() => onConvert(exportFile())}>
            Convert SVG to PNG, JPG or PDF <ArrowRight size={15} />
          </button>
          <button
            className="button primary"
            onClick={() =>
              downloadBlob({
                name: 'plivvi-drawing.svg',
                type: 'image/svg+xml',
                blob: exportFile(),
              })
            }
          >
            <Download size={16} /> Download SVG
          </button>
        </footer>
      </section>
    </div>
  );
}
