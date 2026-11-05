import { useEffect, useId, useRef, useState } from 'react';
import { useShowcasePlayback } from './useShowcasePlayback';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Layers3,
  Images,
  BookOpen,
  Pause,
  Play,
} from 'lucide-react';

export const showcaseSlides = [
  {
    key: 'notebook',
    label: 'Notebooks',
    icon: BookOpen,
    eyebrow: 'PDF READER + DIGITAL INK',
    title: 'Think it.',
    accent: 'Ink it.',
    description:
      'Make a notebook that feels like yours. Write with Apple Pencil or a compatible digital pen, sketch, type, and add more pages.',
    features: ['Pressure-aware ink', 'Five paper styles', 'PDF or image export'],
    action: 'Start a free notebook',
    tool: 'notebooks',
    asset: 'notebooks',
    device: 'stylus tablet',
    note: 'Apple Pencil requires a compatible iPad. Finger and mouse drawing work too.',
  },
  {
    key: 'ink',
    label: 'Read',
    icon: BookOpen,
    eyebrow: 'THE READER, REIMAGINED',
    title: 'Open it.',
    accent: 'Get lost in it.',
    description:
      'Read PDFs or a colorful comic in the actual Plivvi reader. Turn pages, zoom in, and pick up where you left off.',
    features: ['Comfortable page reading', 'Zoom + page navigation', 'Bookmarks and notes'],
    action: 'Open the PDF reader',
    tool: 'reader',
    asset: 'reader',
    device: 'book-style foldable phone',
    note: 'A reading space that adapts to phones, foldables, tablets, and larger screens.',
  },
  {
    key: 'scan',
    label: 'Scan',
    icon: ScanLine,
    eyebrow: 'PAPER, WITH A FRESH START',
    title: 'Less shadow.',
    accent: 'More clarity.',
    description:
      'Turn a page on your desk into a document you can use. Straighten the edges and give your scan a cleaner finish.',
    features: ['On-device edge guide', 'Adjustable crop corners', 'Filters + shadow reduction'],
    action: 'Make a cleaner scan',
    tool: 'scan',
    asset: 'scan',
    device: 'camera phone',
    note: 'Choose a camera, or start with a photo already on your device.',
  },
  {
    key: 'flow',
    label: 'Organize',
    icon: Layers3,
    eyebrow: 'A LITTLE ORDER GOES A LONG WAY',
    title: 'Every page.',
    accent: 'In its place.',
    description:
      'Reorder, rotate, or remove pages until the document feels right. Make a new copy and keep your original.',
    features: ['Reorder + rotate', 'Duplicate or remove pages', 'Local processing'],
    action: 'Arrange your pages',
    tool: 'organize',
    asset: 'organize',
    device: 'silver laptop',
    note: 'Free to use. No upload to a document-processing server.',
  },
  {
    key: 'convert',
    label: 'Convert',
    icon: Images,
    eyebrow: 'THE FORMAT THAT FITS YOUR DAY',
    title: 'New format.',
    accent: 'Same possibilities.',
    description:
      'Bring photos together in a PDF, or take PDF pages out as JPG or PNG. Make the copy you need, right here.',
    features: ['Images to PDF', 'PDF to JPG or PNG', 'No feature subscription'],
    action: 'Make a PDF from images',
    tool: 'image-pdf',
    asset: 'convert',
    device: 'all-in-one desktop',
    note: 'More conversion tools live on your tool shelf.',
  },
] as const;

export default function FeatureShowcase({
  onAction,
  onNotebook,
  onComic,
  onExplore,
  toolCount,
  compact = false,
}: {
  onAction: (tool: string) => void;
  onNotebook?: () => void;
  onComic?: () => void;
  onExplore: () => void;
  toolCount: number;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0),
    [revision, setRevision] = useState(0),
    [paused, setPaused] = useState(false),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [visible, setVisible] = useState(false),
    [pageVisible, setPageVisible] = useState(true),
    [reducedMotion, setReducedMotion] = useState(false),
    [artReady, setArtReady] = useState(false),
    section = useRef<HTMLElement>(null),
    progress = useRef<HTMLElement>(null),
    id = useId(),
    start = useRef<{ x: number; y: number } | null>(null);
  const item = showcaseSlides[index];
  function change(next: number) {
    const nextIndex = (next + showcaseSlides.length) % showcaseSlides.length;
    if (nextIndex !== index) setArtReady(false);
    setIndex(nextIndex);
    setRevision((n) => n + 1);
  }
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    if (section.current) observer.observe(section.current);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    motion();
    visibility();
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    const next = showcaseSlides[(index + 1) % showcaseSlides.length];
    const image = new Image();
    image.src = `/visuals/showcase/${next.asset}-device.${next.asset === 'reader' ? 'svg' : 'webp'}`;
  }, [index]);
  const playing =
    !paused && !hovered && !focused && visible && pageVisible && !reducedMotion && artReady;
  useShowcasePlayback(playing, `${index}:${revision}`, progress, () => change(index + 1));
  return (
    <section
      ref={section}
      className={`feature-showcase curated-showcase ${item.key} ${compact ? 'compact' : ''}`}
      aria-label="Discover five free document workflows"
      aria-roledescription="carousel"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="showcase-topline">
        <button onClick={onExplore}>
          Explore all {toolCount} tools <ArrowRight size={15} />
        </button>
      </div>
      <div className="feature-tabs" role="tablist" aria-label="Featured workflows">
        {showcaseSlides.map((slide, i) => (
          <button
            key={slide.key}
            id={`${id}-tab-${i}`}
            role="tab"
            aria-selected={index === i}
            aria-controls={`${id}-panel`}
            tabIndex={index === i ? 0 : -1}
            onClick={() => change(i)}
            onKeyDown={(e) => {
              let next: number;
              if (e.key === 'ArrowRight') next = (i + 1) % showcaseSlides.length;
              else if (e.key === 'ArrowLeft')
                next = (i - 1 + showcaseSlides.length) % showcaseSlides.length;
              else if (e.key === 'Home') next = 0;
              else if (e.key === 'End') next = showcaseSlides.length - 1;
              else return;
              e.preventDefault();
              change(next);
              (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
            }}
          >
            <slide.icon size={18} />
            <span>{slide.label}</span>
          </button>
        ))}
      </div>
      <div className="showcase-timeline" aria-hidden="true">
        {showcaseSlides.map((slide, i) => (
          <span key={slide.key}>
            <i
              ref={index === i ? progress : undefined}
              style={{ transform: `scaleX(${i < index ? 1 : 0})` }}
            />
          </span>
        ))}
      </div>
      <div
        className="feature-panel"
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${index}`}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('button,a'))
            start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const dx = e.clientX - start.current.x,
            dy = e.clientY - start.current.y;
          if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5)
            change(index + (dx < 0 ? 1 : -1));
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
      >
        <div className="feature-copy" key={`copy-${item.key}`}>
          <span className="feature-eyebrow">{item.eyebrow}</span>
          <h2>
            {item.title}
            <br />
            <em>{item.accent}</em>
          </h2>
          <p>{item.description}</p>
          <ul>
            {item.features.map((feature) => (
              <li key={feature}>
                <Check size={16} />
                {feature}
              </li>
            ))}
          </ul>
          <div className="feature-actions">
            <button
              className="feature-cta"
              onClick={() =>
                item.tool === 'notebooks' && onNotebook ? onNotebook() : onAction(item.tool)
              }
            >
              {item.action}
              <ArrowRight size={19} />
            </button>
            {item.key === 'ink' && onComic && (
              <button className="feature-notebook-link" onClick={onComic}>
                Read Pli's free comic <ArrowRight size={17} />
              </button>
            )}
          </div>
          <small className="feature-device-note">{item.note}</small>
        </div>
        <figure className={`showcase-product ${item.asset}`} key={`art-${item.key}`}>
          <img
            src={`/visuals/showcase/${item.asset}-device.${item.asset === 'reader' ? 'svg' : 'webp'}`}
            width={item.asset === 'reader' ? 1433 : item.asset === 'notebooks' ? 1448 : 1536}
            height={item.asset === 'reader' ? 1098 : item.asset === 'notebooks' ? 1086 : 1024}
            decoding="async"
            onLoad={() => setArtReady(true)}
            onError={() => setArtReady(true)}
            alt={`Plivvi ${item.label.toLowerCase()} interface on an illustrated ${item.device}`}
          />
        </figure>
      </div>
      <div className="showcase-bottom">
        <span className="showcase-free">Free to create. Yours to keep.</span>
        <div className="showcase-controls">
          <span>
            <b>{String(index + 1).padStart(2, '0')}</b> / 05
          </span>
          <button
            className="showcase-playback"
            aria-label={
              paused || reducedMotion ? 'Play automatic slides' : 'Pause automatic slides'
            }
            onClick={() => {
              setPaused(!(paused || reducedMotion));
              setReducedMotion(false);
              setFocused(false);
            }}
          >
            {paused || reducedMotion ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <button
            className="icon-button"
            aria-label="Previous feature"
            onClick={() => change(index - 1)}
          >
            <ChevronLeft size={21} />
          </button>
          <button
            className="icon-button"
            aria-label="Next feature"
            onClick={() => change(index + 1)}
          >
            <ChevronRight size={21} />
          </button>
        </div>
      </div>
    </section>
  );
}
