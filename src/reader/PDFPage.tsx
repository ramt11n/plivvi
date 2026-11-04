import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { rpc } from '../lib/client';
import InkStroke from './InkStroke';
import { renderPage } from './renderQueue';
import {
  pressureWidth,
  isStroke,
  strokePressure,
  type PenStyle,
  type Mark,
  type ReaderTool,
  type InkPoint,
  type TextChar,
  type PenActivity,
} from './types';
type Props = {
  session: string;
  index: number;
  width: number;
  height: number;
  displayWidth: number;
  marks: Mark[];
  tool: ReaderTool;
  color: string;
  size: number;
  touchInk: boolean;
  penStyle: PenStyle;
  penActivity?: PenActivity;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMark: (m: Mark) => void;
  onErase: (id: string) => void;
  onUpdate: (mark: Mark) => void;
  onVisible: (page: number) => void;
  searchQuads?: number[][];
};
export default function PDFPage(p: Props) {
  const root = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null),
    inkCanvas = useRef<HTMLCanvasElement>(null),
    [near, setNear] = useState(false),
    [url, setUrl] = useState(''),
    [chars, setChars] = useState<TextChar[]>([]),
    [plainText, setPlainText] = useState(''),
    [error, setError] = useState(''),
    [draft, setDraft] = useState<Mark | null>(null),
    [moved, setMoved] = useState<Mark | null>(null),
    [renderWidth, setRenderWidth] = useState(p.displayWidth),
    bitmap = useRef(''),
    renderGeneration = useRef(0),
    active = useRef<{
      pointer: number;
      type: string;
      mark: Mark;
      bounds: DOMRect;
      painted: number;
    } | null>(null),
    moveStart = useRef<{ pointer: number; start: InkPoint; original: Mark } | null>(null),
    localPen = useRef<PenActivity>({ pointer: null, until: 0 });
  const penActivity = p.penActivity ?? localPen.current;
  useEffect(() => {
    const surface = root.current;
    if (!surface || p.tool === 'select') return;
    const stopNativeScroll = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    // React's delegated touch listeners can be passive. Safari needs a native,
    // non-passive listener on an HTML surface as well as touch-action.
    surface.addEventListener('touchmove', stopNativeScroll, { passive: false });
    return () => surface.removeEventListener('touchmove', stopNativeScroll);
  }, [p.tool]);

  const draftFrame = useRef<number | null>(null),
    nextDraft = useRef<Mark | null>(null);
  function scheduleDraft(mark: Mark) {
    nextDraft.current = mark;
    if (draftFrame.current !== null) return;
    draftFrame.current = requestAnimationFrame(() => {
      draftFrame.current = null;
      setDraft(nextDraft.current);
    });
  }
  function clearPreview() {
    if (draftFrame.current !== null) cancelAnimationFrame(draftFrame.current);
    draftFrame.current = null;
    nextDraft.current = null;
    const canvas = inkCanvas.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setDraft(null);
  }
  function paintInk() {
    const stroke = active.current,
      canvas = inkCanvas.current;
    if (!stroke || !canvas || !isStroke(stroke.mark)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const m = stroke.mark;
    ctx.save();
    ctx.scale(canvas.width / p.width, canvas.height / p.height);
    ctx.strokeStyle = m.color;
    ctx.fillStyle = m.color;
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (!stroke.painted) {
      const q = m.points[0];
      ctx.beginPath();
      ctx.arc(
        q.x * p.width,
        q.y * p.height,
        (m.kind === 'highlight-ink' ? m.size : pressureWidth(m.size, q.pressure, m.penStyle)) / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      stroke.painted = 1;
    }
    for (let i = stroke.painted; i < m.points.length; i++) {
      const a = m.points[i - 1],
        b = m.points[i];
      ctx.lineWidth =
        m.kind === 'highlight-ink'
          ? m.size
          : pressureWidth(m.size, strokePressure(a, b, m.penStyle), m.penStyle);
      ctx.beginPath();
      ctx.moveTo(a.x * p.width, a.y * p.height);
      ctx.lineTo(b.x * p.width, b.y * p.height);
      ctx.stroke();
    }
    stroke.painted = m.points.length;
    ctx.restore();
  }
  useEffect(
    () => () => {
      if (draftFrame.current !== null) cancelAnimationFrame(draftFrame.current);
      if (active.current?.type === 'pen' && penActivity.pointer === active.current.pointer) {
        penActivity.pointer = null;
        penActivity.until = 0;
      }
    },
    [],
  );
  useEffect(() => {
    const scroll = root.current?.closest('.reader-scroll'),
      nearObserver = new IntersectionObserver((entries) => setNear(entries[0].isIntersecting), {
        root: scroll,
        rootMargin: '500px 0px',
      }),
      pageObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) p.onVisible(p.index);
        },
        { root: scroll, rootMargin: '-10% 0px -65% 0px' },
      );
    if (root.current) {
      nearObserver.observe(root.current);
      pageObserver.observe(root.current);
    }
    return () => {
      nearObserver.disconnect();
      pageObserver.disconnect();
    };
  }, [p.session, p.index]);
  useEffect(() => {
    const t = setTimeout(() => setRenderWidth(Math.ceil(p.displayWidth / 96) * 96), 220);
    return () => clearTimeout(t);
  }, [p.displayWidth]);
  useEffect(
    () => () => {
      if (bitmap.current) URL.revokeObjectURL(bitmap.current);
    },
    [],
  );
  useEffect(() => {
    if (!near) {
      if (bitmap.current) URL.revokeObjectURL(bitmap.current);
      bitmap.current = '';
      setUrl('');
      return;
    }
    const controller = new AbortController(),
      gen = ++renderGeneration.current;
    setError('');
    const width = Math.min(
      2400,
      Math.round(renderWidth * Math.min(2, devicePixelRatio || 1)),
      Math.floor(Math.sqrt((5000000 * p.width) / p.height)),
    );
    renderPage(p.session, p.index, width, controller.signal)
      .then(async (r) => {
        if (controller.signal.aborted || gen !== renderGeneration.current) return;
        const next = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'image/png' }));
        try {
          const image = new Image();
          image.src = next;
          await image.decode();
        } catch {}
        if (controller.signal.aborted || gen !== renderGeneration.current) {
          URL.revokeObjectURL(next);
          return;
        }
        const old = bitmap.current;
        bitmap.current = next;
        setUrl(next);
        // Keep the current bitmap visible until its replacement has decoded.
        if (old) requestAnimationFrame(() => URL.revokeObjectURL(old));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [p.session, p.index, near, renderWidth]);
  useEffect(() => {
    if (!near || p.tool !== 'select') {
      setChars([]);
      return;
    }
    let alive = true;
    rpc<{ chars: TextChar[]; text: string }>('reader-text', { session: p.session, index: p.index })
      .then((r) => {
        if (alive) {
          setChars(r.chars);
          setPlainText(r.text);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [p.session, p.index, p.tool, near]);
  function point(
    e: {
      clientX: number;
      clientY: number;
      pressure?: number;
      pointerType?: string;
      tiltX?: number;
      tiltY?: number;
    },
    bounds?: DOMRect,
  ): InkPoint {
    const r = bounds ?? svg.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      pressure: e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 0.5,
      tiltX: e.tiltX ?? 0,
      tiltY: e.tiltY ?? 0,
    };
  }
  function erase(q: InkPoint) {
    for (const m of [...p.marks].reverse()) {
      const hit = isStroke(m)
        ? m.points.some(
            (z) =>
              Math.hypot((z.x - q.x) * p.width, (z.y - q.y) * p.height) < Math.max(12, m.size * 2),
          )
        : q.x >= m.rect.x &&
          q.x <= m.rect.x + m.rect.w &&
          q.y >= m.rect.y &&
          q.y <= m.rect.y + m.rect.h;
      if (hit) {
        p.onErase(m.id);
        break;
      }
    }
  }
  function down(e: ReactPointerEvent<SVGSVGElement>) {
    if (p.tool === 'select') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Finger navigation belongs to the viewport controller.
    if (e.pointerType === 'touch' && !p.touchInk) return;
    if (
      e.pointerType === 'touch' &&
      (penActivity.pointer !== null || performance.now() < penActivity.until)
    )
      return;
    if (active.current) {
      if (e.pointerType !== 'pen') return;
      // Recover from a missing pointerup/lost capture before accepting the next pen stroke.
      if (active.current.type === 'pen' && isStroke(active.current.mark))
        p.onMark(active.current.mark);
      active.current = null;
      clearPreview();
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.pointerType === 'pen') {
      penActivity.pointer = e.pointerId;
      penActivity.until = performance.now() + 600;
    }
    const bounds = svg.current!.getBoundingClientRect(),
      q = point(e, bounds);
    if (p.tool === 'eraser' || e.buttons & 32) {
      erase(q);
      active.current = {
        pointer: e.pointerId,
        type: e.pointerType,
        mark: { id: 'eraser' } as Mark,
        bounds,
        painted: 0,
      };
      return;
    }
    const kind =
      p.tool === 'pen'
        ? 'ink'
        : p.tool === 'highlighter'
          ? 'highlight-ink'
          : (p.tool as 'text' | 'rectangle' | 'note');
    const mark: Mark = {
      id: crypto.randomUUID(),
      page: p.index,
      kind,
      color: p.color,
      size: p.size,
      opacity:
        kind === 'highlight-ink' ? 0.32 : kind === 'ink' && p.penStyle === 'pencil' ? 0.72 : 1,
      penStyle: p.penStyle,
      points: [q],
      rect: {
        x: q.x,
        y: q.y,
        w: kind === 'text' ? Math.min(0.4, 1 - q.x) : kind === 'note' ? 0.035 : 0,
        h: kind === 'text' ? 0.08 : kind === 'note' ? 0.035 : 0,
      },
      text: kind === 'text' ? 'Your text' : kind === 'note' ? 'Your note' : '',
    };
    if (kind === 'text' || kind === 'note') {
      p.onMark(mark);
      p.onSelect(mark.id);
      return;
    }
    active.current = { pointer: e.pointerId, type: e.pointerType, mark, bounds, painted: 0 };
    if (isStroke(mark)) {
      const canvas = inkCanvas.current!;
      const ratio = Math.min(
        2,
        devicePixelRatio || 1,
        2400 / Math.max(bounds.width, bounds.height),
      );
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      canvas.style.opacity = String(mark.opacity);
      canvas.style.mixBlendMode = mark.kind === 'highlight-ink' ? 'multiply' : 'normal';
      paintInk();
    } else setDraft(mark);
    p.onSelect(null);
  }
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const drag = moveStart.current;
    if (drag?.pointer === e.pointerId) {
      e.preventDefault();
      const q = point(e),
        m = drag.original,
        xs = isStroke(m) ? m.points.map((z) => z.x) : [m.rect.x, m.rect.x + m.rect.w],
        ys = isStroke(m) ? m.points.map((z) => z.y) : [m.rect.y, m.rect.y + m.rect.h],
        dx = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), q.x - drag.start.x)),
        dy = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), q.y - drag.start.y));
      setMoved({
        ...m,
        points: m.points.map((z) => ({ ...z, x: z.x + dx, y: z.y + dy })),
        rect: { ...m.rect, x: m.rect.x + dx, y: m.rect.y + dy },
      });
      return;
    }

    const current = active.current;
    if (!current || current.pointer !== e.pointerId) return;
    e.preventDefault();
    if (e.pointerType === 'pen') penActivity.until = performance.now() + 600;
    if (current.mark.id === 'eraser') {
      erase(point(e));
      return;
    }
    if (isStroke(current.mark)) {
      const batch = e.nativeEvent.getCoalescedEvents?.(),
        events = batch?.length ? batch : [e.nativeEvent];
      for (const event of events) {
        const q = point(
            {
              clientX: event.clientX,
              clientY: event.clientY,
              pressure: event.pressure,
              tiltX: event.tiltX,
              tiltY: event.tiltY,
              pointerType: e.pointerType,
            },
            current.bounds,
          ),
          last = current.mark.points.at(-1)!;
        if (
          Math.hypot((q.x - last.x) * p.width, (q.y - last.y) * p.height) > 0.5 &&
          current.mark.points.length < 12000
        )
          current.mark.points.push(q);
      }
      paintInk();
    } else {
      const q = point(e),
        s = current.mark.points[0];
      current.mark.rect = {
        x: Math.min(s.x, q.x),
        y: Math.min(s.y, q.y),
        w: Math.abs(q.x - s.x),
        h: Math.abs(q.y - s.y),
      };
      scheduleDraft({ ...current.mark });
    }
  }
  function end(e: ReactPointerEvent<SVGSVGElement>, cancel = false) {
    if (penActivity.pointer === e.pointerId) {
      penActivity.pointer = null;
      penActivity.until = performance.now() + 350;
    }
    if (moveStart.current?.pointer === e.pointerId) {
      if (!cancel && moved) p.onUpdate(moved);
      moveStart.current = null;
      setMoved(null);
      return;
    }
    const current = active.current;
    if (current?.pointer !== e.pointerId) return;
    if (!cancel && isStroke(current.mark)) {
      const q = point(e, current.bounds),
        last = current.mark.points.at(-1)!;
      if (Math.hypot((q.x - last.x) * p.width, (q.y - last.y) * p.height) > 0.25)
        current.mark.points.push({ ...q, pressure: last.pressure });
    }
    active.current = null;
    clearPreview();
    if (
      current.mark.id !== 'eraser' &&
      (isStroke(current.mark) ||
        (!cancel && current.mark.rect.w > 0.003 && current.mark.rect.h > 0.003))
    )
      p.onMark(current.mark);
  }
  const draw = (source: Mark) => {
    const m = moved?.id === source.id ? moved : source,
      r = m.rect,
      selected = p.selected === m.id;
    return (
      <g
        key={m.id}
        opacity={m.opacity}
        style={{
          mixBlendMode:
            m.kind === 'highlight-ink' || m.kind === 'highlight' ? 'multiply' : 'normal',
          pointerEvents: p.tool === 'select' ? 'visiblePainted' : 'none',
          cursor: p.tool === 'select' ? 'move' : 'inherit',
          touchAction: 'none',
        }}
        className={selected ? 'mark-selected' : ''}
        onPointerDown={(e) => {
          if (p.tool !== 'select') return;
          e.preventDefault();
          e.stopPropagation();
          svg.current!.setPointerCapture(e.pointerId);
          moveStart.current = { pointer: e.pointerId, start: point(e), original: m };
          p.onSelect(m.id);
        }}
        onClick={(e) => {
          if (p.tool === 'select') {
            e.stopPropagation();
            p.onSelect(m.id);
          }
        }}
      >
        {isStroke(m) ? (
          <InkStroke mark={m} width={p.width} height={p.height} />
        ) : m.kind === 'image' ? (
          <image
            href={m.image}
            x={r.x * p.width}
            y={r.y * p.height}
            width={r.w * p.width}
            height={r.h * p.height}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : m.kind === 'text' ? (
          <foreignObject
            x={r.x * p.width}
            y={r.y * p.height}
            width={r.w * p.width}
            height={Math.max(r.h * p.height, (m.lines?.length ?? 1) * m.size * 1.7)}
            overflow="visible"
          >
            <div
              dir="auto"
              style={{
                color: m.color,
                fontSize: m.size,
                fontFamily: 'PlivviDocument, Arial, sans-serif',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                unicodeBidi: 'plaintext',
                textAlign: 'start',
              }}
            >
              {m.text}
            </div>
          </foreignObject>
        ) : m.kind === 'note' ? (
          <g>
            <rect
              x={r.x * p.width}
              y={r.y * p.height}
              width={22}
              height={24}
              rx={3}
              fill={m.color}
            />
            <text x={r.x * p.width + 8} y={r.y * p.height + 17} fill="white" fontSize={14}>
              ≡
            </text>
          </g>
        ) : (
          <rect
            x={r.x * p.width}
            y={r.y * p.height}
            width={r.w * p.width}
            height={r.h * p.height}
            fill={m.kind === 'highlight' ? m.color : 'none'}
            stroke={m.kind === 'rectangle' ? m.color : 'none'}
            strokeWidth={m.size}
          />
        )}
      </g>
    );
  };
  return (
    <div
      ref={root}
      id={`reader-page-${p.index}`}
      className={`reader-page ${p.tool === 'select' ? 'selecting' : 'drawing'}`}
      style={{ width: p.displayWidth, aspectRatio: `${p.width}/${p.height}` }}
      aria-label={`Page ${p.index + 1}`}
    >
      {url ? (
        <img
          className="reader-page-image"
          src={url}
          alt={`PDF page ${p.index + 1}`}
          draggable={false}
        />
      ) : (
        <div className="reader-page-placeholder">
          <span className="spinner" />
          {error || `Page ${p.index + 1}`}
        </div>
      )}
      {p.tool === 'select' && (
        <div className="reader-text-layer" aria-hidden="true">
          {chars.map((c, i) =>
            c.text === '\n' ? (
              <br key={i} />
            ) : (
              <span
                key={i}
                style={{
                  left: `${c.x * 100}%`,
                  top: `${c.y * 100}%`,
                  width: `${c.w * 100}%`,
                  height: `${c.h * 100}%`,
                  fontSize: (c.size * p.displayWidth) / p.width,
                }}
              >
                {c.text}
              </span>
            ),
          )}
        </div>
      )}
      <div
        className="reader-accessible-text"
        role="document"
        aria-label={`Text of page ${p.index + 1}`}
      >
        {plainText}
      </div>
      <svg
        viewBox={`0 0 ${p.width} ${p.height}`}
        className="reader-highlight-layer"
        aria-hidden="true"
      >
        {near &&
          p.marks.filter((m) => m.kind === 'highlight-ink' || m.kind === 'highlight').map(draw)}
      </svg>
      <svg
        ref={svg}
        viewBox={`0 0 ${p.width} ${p.height}`}
        className="reader-annotation-layer"
        style={{
          touchAction: p.tool === 'select' ? 'auto' : 'none',
          pointerEvents: p.tool === 'select' ? 'none' : 'auto',
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => end(e)}
        onPointerCancel={(e) => end(e, true)}
        onLostPointerCapture={(e) => end(e, true)}
        onContextMenu={(e) => {
          if (p.tool !== 'select') e.preventDefault();
        }}
        onClick={() => p.tool === 'select' && p.onSelect(null)}
        aria-label={`Annotation canvas, page ${p.index + 1}`}
      >
        {p.searchQuads?.map((q, i) => {
          const xs = [q[0], q[2], q[4], q[6]],
            ys = [q[1], q[3], q[5], q[7]];
          return (
            <rect
              key={'s' + i}
              x={Math.min(...xs) * p.width}
              y={Math.min(...ys) * p.height}
              width={(Math.max(...xs) - Math.min(...xs)) * p.width}
              height={(Math.max(...ys) - Math.min(...ys)) * p.height}
              fill="#ffd85d"
              opacity=".45"
              style={{ pointerEvents: 'none' }}
            />
          );
        })}
        {near &&
          p.marks.filter((m) => m.kind !== 'highlight-ink' && m.kind !== 'highlight').map(draw)}
        {draft && draw(draft)}
      </svg>
      <canvas
        ref={inkCanvas}
        width={1}
        height={1}
        className="reader-ink-preview"
        aria-hidden="true"
      />
      <span className="reader-page-label">{p.index + 1}</span>
    </div>
  );
}
