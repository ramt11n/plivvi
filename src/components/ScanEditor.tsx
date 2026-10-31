import { useEffect, useRef, useState } from 'react';
import { Check, X, ScanLine, RotateCw, WandSparkles } from 'lucide-react';
import { loadImage, detectCorners, canvasBlob, type Point, type Filter } from '../lib/image';
import { rpc } from '../lib/client';
export default function ScanEditor({
  file,
  onSave,
  onClose,
}: {
  file: File;
  onSave: (f: File) => void;
  onClose: () => void;
}) {
  const original = useRef<HTMLCanvasElement | null>(null),
    display = useRef<HTMLCanvasElement>(null),
    [points, setPoints] = useState<Point[]>([]),
    [filter, setFilter] = useState<Filter>('clean'),
    [mode, setMode] = useState<'crop' | 'enhance'>('crop'),
    [strength, setStrength] = useState(0.8),
    [brightness, setBrightness] = useState(0),
    [contrast, setContrast] = useState(1.08),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [before, setBefore] = useState(false),
    drag = useRef(-1),
    generation = useRef(0);
  useEffect(() => {
    loadImage(file, 1800)
      .then((c) => {
        original.current = c;
        setPoints([
          { x: 0, y: 0 },
          { x: c.width - 1, y: 0 },
          { x: c.width - 1, y: c.height - 1 },
          { x: 0, y: c.height - 1 },
        ]);
        draw(c);
      })
      .catch(() =>
        setError(
          'This image could not be opened. Try JPG, PNG, or a photo supported by your browser.',
        ),
      );
  }, [file]);
  function draw(c: HTMLCanvasElement) {
    const target = display.current;
    if (!target) return;
    target.width = c.width;
    target.height = c.height;
    target.getContext('2d')!.drawImage(c, 0, 0);
  }
  useEffect(() => {
    const c = original.current;
    if (!c || !points.length) return;
    const gen = ++generation.current;
    if (mode === 'crop' || before) {
      draw(c);
      return;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const raw = c.getContext('2d')!.getImageData(0, 0, c.width, c.height),
          r = await rpc('enhance', {
            data: raw.data,
            width: c.width,
            height: c.height,
            points,
            filter,
            strength,
            brightness,
            contrast,
          });
        if (gen !== generation.current) return;
        const d = display.current!;
        d.width = r.width;
        d.height = r.height;
        d.getContext('2d')!.putImageData(
          new ImageData(new Uint8ClampedArray(r.data), r.width, r.height),
          0,
          0,
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (gen === generation.current) setBusy(false);
      }
    }, 130);
    return () => clearTimeout(timer);
  }, [points, filter, mode, strength, brightness, contrast, before]);
  const c = original.current;
  return (
    <div className="modal-shade scan-shade">
      <section
        className="scan-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Crop and enhance scan"
      >
        <header className="panel-header">
          <div className="panel-title">
            <span className="tool-icon violet">
              <WandSparkles />
            </span>
            <div>
              <h2>A clearer page.</h2>
              <p>Adjust the edges, then find your finish.</p>
            </div>
          </div>
          <button aria-label="Close scan editor" className="icon-button" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="scan-body">
          <div className="scan-canvas-space">
            <div className="scan-canvas-wrap">
              <canvas ref={display} />
              {mode === 'crop' && c && (
                <svg
                  viewBox={`0 0 ${c.width} ${c.height}`}
                  className="crop-overlay"
                  onPointerMove={(e) => {
                    if (drag.current < 0) return;
                    const r = e.currentTarget.getBoundingClientRect(),
                      x = Math.max(
                        0,
                        Math.min(c.width - 1, ((e.clientX - r.left) / r.width) * c.width),
                      ),
                      y = Math.max(
                        0,
                        Math.min(c.height - 1, ((e.clientY - r.top) / r.height) * c.height),
                      );
                    setPoints((p) => p.map((q, i) => (i === drag.current ? { x, y } : q)));
                  }}
                  onPointerUp={() => (drag.current = -1)}
                  onPointerCancel={() => (drag.current = -1)}
                >
                  <polygon
                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="#7576ed22"
                    stroke="#7777f3"
                    strokeWidth={c.width / 250}
                  />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={c.width / 45}
                      fill="white"
                      stroke="#7272ec"
                      strokeWidth={c.width / 230}
                      onPointerDown={(e) => {
                        e.currentTarget.parentElement!.setPointerCapture(e.pointerId);
                        drag.current = i;
                      }}
                    />
                  ))}
                </svg>
              )}
            </div>
            {busy && (
              <span className="scan-processing">
                <span className="spinner" />
                Enhancing…
              </span>
            )}
          </div>
          <aside className="scan-options">
            <div className="segmented">
              <button className={mode === 'crop' ? 'active' : ''} onClick={() => setMode('crop')}>
                1. Crop
              </button>
              <button
                className={mode === 'enhance' ? 'active' : ''}
                onClick={() => setMode('enhance')}
              >
                2. Enhance
              </button>
            </div>
            {mode === 'crop' ? (
              <>
                <h3>Follow the paper</h3>
                <p className="muted small">
                  Drag the four corners to match your document. Perspective is corrected when you
                  save.
                </p>
                <button
                  className="button secondary full"
                  onClick={() => {
                    if (c)
                      setPoints(
                        detectCorners(c.getContext('2d')!.getImageData(0, 0, c.width, c.height)),
                      );
                  }}
                >
                  <ScanLine size={17} /> Find edges
                </button>
                <button
                  className="button secondary full"
                  onClick={() => {
                    if (!c) return;
                    const rotated = document.createElement('canvas');
                    rotated.width = c.height;
                    rotated.height = c.width;
                    const ctx = rotated.getContext('2d')!;
                    ctx.translate(rotated.width, 0);
                    ctx.rotate(Math.PI / 2);
                    ctx.drawImage(c, 0, 0);
                    original.current = rotated;
                    setPoints([
                      { x: 0, y: 0 },
                      { x: rotated.width - 1, y: 0 },
                      { x: rotated.width - 1, y: rotated.height - 1 },
                      { x: 0, y: rotated.height - 1 },
                    ]);
                    draw(rotated);
                  }}
                >
                  <RotateCw size={17} /> Rotate photo
                </button>
                <button className="button primary full" onClick={() => setMode('enhance')}>
                  Continue to filters
                </button>
              </>
            ) : (
              <>
                <h3>Choose your finish</h3>
                <div className="filter-grid">
                  {(['original', 'clean', 'gray', 'bw', 'vivid'] as Filter[]).map((f) => (
                    <button
                      key={f}
                      className={`filter-tile ${filter === f ? 'active' : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      <span className={`filter-swatch ${f}`}>
                        Aa
                        <span>
                          ────
                          <br />
                          ────
                        </span>
                      </span>
                      {
                        {
                          original: 'Original',
                          clean: 'Clean paper',
                          gray: 'Grayscale',
                          bw: 'Black & white',
                          vivid: 'Vivid color',
                        }[f]
                      }
                    </button>
                  ))}
                </div>
                <label>
                  Shadow reduction <strong>{Math.round(strength * 100)}%</strong>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={strength}
                    onChange={(e) => setStrength(+e.target.value)}
                  />
                </label>
                <label>
                  Brightness
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    value={brightness}
                    onChange={(e) => setBrightness(+e.target.value)}
                  />
                </label>
                <label>
                  Contrast
                  <input
                    type="range"
                    min=".5"
                    max="1.8"
                    step=".05"
                    value={contrast}
                    onChange={(e) => setContrast(+e.target.value)}
                  />
                </label>
                <button
                  className="button secondary full"
                  onPointerDown={() => setBefore(true)}
                  onPointerUp={() => setBefore(false)}
                  onPointerLeave={() => setBefore(false)}
                >
                  Hold to see original
                </button>
                <p className="small muted">
                  Shadow reduction balances uneven lighting. It cannot restore text hidden by
                  fingers or strong glare.
                </p>
              </>
            )}
          </aside>
        </div>
        {error && (
          <div role="alert" className="error-message">
            {error}
          </div>
        )}
        <footer className="panel-footer">
          <span className="small muted">Your original stays unchanged.</span>
          <button
            className="button primary"
            disabled={busy || !c}
            onClick={async () => {
              setBusy(true);
              try {
                const raw = c!.getContext('2d')!.getImageData(0, 0, c!.width, c!.height),
                  r = await rpc('enhance', {
                    data: raw.data,
                    width: c!.width,
                    height: c!.height,
                    points,
                    filter,
                    strength,
                    brightness,
                    contrast,
                  }),
                  out = document.createElement('canvas');
                out.width = r.width;
                out.height = r.height;
                out
                  .getContext('2d')!
                  .putImageData(
                    new ImageData(new Uint8ClampedArray(r.data), r.width, r.height),
                    0,
                    0,
                  );
                const b = await canvasBlob(out);
                onSave(
                  new File([b], file.name.replace(/\.[^.]+$/, '') + '-enhanced.jpg', {
                    type: 'image/jpeg',
                  }),
                );
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Check size={17} /> Save enhanced page
          </button>
        </footer>
      </section>
    </div>
  );
}
