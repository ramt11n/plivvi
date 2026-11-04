import { useId, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Layers3,
  Images,
  BookOpen,
} from 'lucide-react';

export const showcaseSlides = [
  {
    key: 'ink',
    label: 'Read',
    icon: BookOpen,
    eyebrow: 'THE READER, REIMAGINED',
    title: 'Open it.',
    accent: 'Get lost in it.',
    description:
      'Bring a PDF or a graphic story into focus. Turn pages, zoom in, and pick up right where you left off.',
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
    features: ['Camera or photo import', 'Perspective correction', 'Filters + shadow reduction'],
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
  {
    key: 'notebook',
    label: 'Notebooks',
    icon: BookOpen,
    eyebrow: 'DIGITAL INK + FRESH PAGES',
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
] as const;

export default function FeatureShowcase({
  onAction,
  onNotebook,
  compact = false,
}: {
  onAction: (tool: string) => void;
  onNotebook?: () => void;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0),
    id = useId(),
    start = useRef<{ x: number; y: number } | null>(null);
  const item = showcaseSlides[index];
  function change(next: number) {
    setIndex((next + showcaseSlides.length) % showcaseSlides.length);
  }
  return (
    <section
      className={`feature-showcase curated-showcase ${item.key} ${compact ? 'compact' : ''}`}
      aria-label="Discover five free document workflows"
      aria-roledescription="carousel"
    >
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
        <div className="feature-copy">
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
            {item.key === 'notebook' && (
              <button className="feature-notebook-link" onClick={() => onAction('reader')}>
                Open the PDF reader
                <ArrowRight size={19} />
              </button>
            )}
          </div>
          <small className="feature-device-note">{item.note}</small>
        </div>
        <figure className={`showcase-product ${item.asset}`}>
          <img
            key={item.asset}
            src={`/visuals/showcase/${item.asset}.webp`}
            srcSet={`/visuals/showcase/${item.asset}-640.webp 640w, /visuals/showcase/${item.asset}.webp 1280w`}
            sizes="(max-width: 600px) calc(100vw - 60px), (max-width: 1100px) 42vw, 560px"
            width="1280"
            height="960"
            loading="lazy"
            decoding="async"
            alt={`${item.device} showing ${item.label.toLowerCase()} in a document workspace — product illustration`}
          />
        </figure>
      </div>
      <div className="showcase-bottom">
        <span className="showcase-free">Free to create. Yours to keep.</span>
        <div className="showcase-controls">
          <span aria-live="polite" aria-atomic="true">
            <b>{String(index + 1).padStart(2, '0')}</b> / 05
          </span>
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
