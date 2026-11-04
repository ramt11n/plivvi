import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { tools, type Tool } from '../lib/catalog';
import Icon from './Icon';
const devices: Record<string, string> = {
  reader: 'mini tablet',
  scan: 'camera phone',
  enhance: 'camera phone',
  sign: 'pen tablet',
  organize: 'foldable',
  merge: 'foldable',
  split: 'foldable',
  'image-pdf': 'camera phone',
  'image-convert': 'camera phone',
  ocr: 'mini tablet',
  compare: 'desktop',
  watermark: 'pen tablet',
  numbers: 'desktop',
};
const colors: Record<string, [string, string]> = {
  Organize: ['#e8ebff', '#3659e3'],
  Convert: ['#fff0da', '#b47b21'],
  Edit: ['#e4f5eb', '#258160'],
  Protect: ['#f3eaff', '#8c5fbd'],
  Scan: ['#e0f2ff', '#3282b7'],
};
export function ToolVisual({ tool }: { tool: Tool }) {
  const id = useId().replace(/:/g, ''),
    device = devices[tool.id] ?? 'ultrabook',
    [tint, accent] = colors[tool.group] ?? ['#e9edff', '#3659e3'];
  const phone = device === 'camera phone',
    tablet = device.includes('tablet'),
    fold = device === 'foldable';
  const x = phone ? 247 : tablet ? 185 : fold ? 130 : 105,
    y = phone ? 28 : tablet ? 25 : 45,
    w = phone ? 146 : tablet ? 270 : fold ? 380 : 430,
    h = phone ? 295 : tablet ? 310 : 255;
  return (
    <svg viewBox="0 0 640 380" className="tool-spotlight-art" aria-hidden="true">
      <defs>
        <linearGradient id={id + 'body'} x2="1" y2="1">
          <stop stopColor="#36445f" />
          <stop offset=".48" stopColor="#111c32" />
          <stop offset="1" stopColor="#52637d" />
        </linearGradient>
        <linearGradient id={id + 'pen'}>
          <stop stopColor="#c2ccdc" />
          <stop offset=".45" stopColor="white" />
          <stop offset="1" stopColor="#a8b8cb" />
        </linearGradient>
        <filter id={id + 'shadow'} x="-50%" y="-50%" width="200%" height="220%">
          <feDropShadow dx="0" dy="18" stdDeviation="15" floodColor="#243b6c" floodOpacity=".18" />
        </filter>
      </defs>
      <ellipse cx="323" cy="330" rx="228" ry="21" fill={accent} opacity=".09" />
      <circle cx="320" cy="180" r="160" fill={tint} />
      <g
        filter={'url(#' + id + 'shadow)'}
        transform={tablet ? 'rotate(-7 320 190)' : 'rotate(2 320 190)'}
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={phone ? 25 : tablet ? 24 : 16}
          fill={'url(#' + id + 'body)'}
          stroke="#8a9ab3"
          strokeWidth="2"
        />
        <rect
          x={x + 9}
          y={y + 11}
          width={w - 18}
          height={h - 22}
          rx={phone ? 19 : 12}
          fill="#f8faff"
        />
        {phone ? (
          <rect x={x + w / 2 - 21} y={y + 16} width="42" height="9" rx="5" fill="#17253d" />
        ) : (
          <circle cx={x + w / 2} cy={y + 6} r="2" fill="#b7c7df" />
        )}
        <g
          transform={`translate(${x + 19} ${y + (phone ? 38 : 24)}) scale(${(w - 38) / 360} ${(h - (phone ? 60 : 45)) / 230})`}
        >
          <rect width="360" height="26" rx="7" fill={tint} />
          <circle cx="15" cy="13" r="4" fill={accent} />
          <text x="27" y="17" fontSize="10" fill="#253450" fontFamily="sans-serif">
            plivvi. / {tool.title}
          </text>
          <rect x="14" y="42" width="111" height="170" rx="11" fill="#fff" stroke="#dce4ef" />
          <rect x="144" y="42" width="200" height="170" rx="11" fill="white" stroke="#dce4ef" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x="26" y={57 + i * 35} width="22" height="27" rx="3" fill={tint} />
              <path
                d={`M57 ${65 + i * 35}h51 M57 ${74 + i * 35}h33`}
                stroke="#aab8cf"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          ))}
          <rect x="176" y="64" width="135" height="118" rx="6" fill="#fafbfe" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M190 ${83 + i * 16}h${i % 2 ? 80 : 106}`}
              stroke="#b8c5d9"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}
          {tool.group === 'Edit' || tool.id === 'reader' ? (
            <>
              <path d="M187 112 Q228 101 292 110" stroke="#fbe577" strokeWidth="15" opacity=".65" />
              <path
                d="M190 158q18-38 22-2t28-4t22 5t25-5"
                fill="none"
                stroke={accent}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </>
          ) : tool.group === 'Organize' ? (
            <>
              <path d="M163 131h151" stroke={accent} strokeWidth="2" strokeDasharray="6 5" />
              <rect x="270" y="151" width="57" height="24" rx="12" fill={accent} />
              <text x="283" y="167" fontSize="11" fill="white">
                1 → 2
              </text>
            </>
          ) : (
            <g transform="translate(227 120)">
              <circle r="29" fill={tint} />
              <svg x="-17" y="-17" width="34" height="34" viewBox="0 0 24 24" color={accent}>
                <Icon name={tool.icon} size={24} />
              </svg>
            </g>
          )}
          <rect x="255" y="190" width="72" height="11" rx="5" fill={accent} opacity=".65" />
        </g>
        {fold && (
          <rect x="317" y={y + 8} width="6" height={h - 16} rx="3" fill="#25334d" opacity=".4" />
        )}
      </g>
      {!tablet && !phone && !fold && (
        <>
          <path d="M80 307h480l-34 26H113z" fill="#cbd4e2" stroke="#a8b6c9" />
          <path d="M270 308h100l-11 7h-78z" fill="#a9b7ca" />
        </>
      )}
      {tablet && (
        <g transform="rotate(35 420 200)" filter={'url(#' + id + 'shadow)'}>
          <rect x="438" y="60" width="13" height="258" rx="6" fill={'url(#' + id + 'pen)'} />
          <path d="m438 312 6.5 23 6.5-23" fill="#d9e1ed" />
          <path d="m442 327 2.5 8 2.5-8" fill="#647896" />
        </g>
      )}
      <g transform="translate(64 60) rotate(-7)">
        <rect width="118" height="37" rx="13" fill="white" stroke="#dde5ef" />
        <circle cx="18" cy="18" r="5" fill="#4bbd87" />
        <text x="32" y="22" fontSize="11" fontFamily="sans-serif" fill="#273650">
          Free to create
        </text>
      </g>
      <g transform="translate(442 300) rotate(6)">
        <rect width="143" height="38" rx="14" fill="white" stroke="#dce4ef" />
        <text x="15" y="24" fill="#425371" fontSize="11" fontFamily="sans-serif">
          Your files. Your device.
        </text>
      </g>
    </svg>
  );
}
export default function ToolSpotlight({ onAction }: { onAction: (id: string) => void }) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [hover, setHover] = useState(false),
    start = useRef<{ x: number; y: number } | undefined>(undefined),
    tool = tools[index];
  useEffect(() => {
    if (!playing || hover || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % tools.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [playing, hover]);
  function change(next: number) {
    setPlaying(false);
    setIndex((next + tools.length) % tools.length);
  }
  return (
    <section
      className="tool-spotlight"
      aria-label="Explore every free document tool"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="tool-spotlight-copy">
        <span className="eyebrow">ONE WORKSPACE. {tools.length} FREE TOOLS.</span>
        <h2>
          {tool.title}.<br />
          <em>A little easier.</em>
        </h2>
        <p>{tool.description}</p>
        <p className="tool-spotlight-note">
          {tool.note ?? 'Make a new copy, right on your device. No feature subscription.'}
        </p>
        <button className="button primary" onClick={() => onAction(tool.id)}>
          Try {tool.title.toLowerCase()}
          <ArrowRight size={17} />
        </button>
        <div className="tool-spotlight-controls">
          <button
            className="icon-button"
            aria-label="Previous featured tool"
            onClick={() => change(index - 1)}
          >
            <ChevronLeft />
          </button>
          <label>
            <span className="sr-only">Choose a featured tool</span>
            <select
              aria-label="Choose a featured tool"
              value={index}
              onChange={(e) => change(+e.target.value)}
            >
              {tools.map((t, i) => (
                <option key={t.id} value={i}>
                  {String(i + 1).padStart(2, '0')} / {tools.length} · {t.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            aria-label="Next featured tool"
            onClick={() => change(index + 1)}
          >
            <ChevronRight />
          </button>
          <button
            className="icon-button"
            aria-label={playing ? 'Pause tool tour' : 'Play tool tour'}
            aria-pressed={playing}
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      </div>
      <div
        className="tool-spotlight-visual"
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (start.current) {
            const x = e.clientX - start.current.x,
              y = e.clientY - start.current.y;
            if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.5)
              change(index + (x < 0 ? 1 : -1));
            start.current = undefined;
          }
        }}
        onPointerCancel={() => {
          start.current = undefined;
        }}
      >
        <ToolVisual tool={tool} />
        <span className="tool-device-caption">
          Made for your {devices[tool.id] ?? 'laptop'} · responsive on every screen
        </span>
      </div>
    </section>
  );
}
