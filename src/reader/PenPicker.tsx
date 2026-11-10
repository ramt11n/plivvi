import { useState } from 'react';
import { ChevronDown, PenLine } from 'lucide-react';
import InkStroke from './InkStroke';
import { penStyles, type InkPoint, type PenStyle } from './types';

const sample: InkPoint[] = Array.from({ length: 32 }, (_, i) => {
  const t = i / 31;
  return {
    x: 0.045 + 0.91 * t,
    y: 0.5 + 0.27 * Math.sin(t * Math.PI * 4),
    pressure: 0.16 + 0.76 * Math.sin(t * Math.PI),
    tiltX: 65 * t,
  };
});

export default function PenPicker({
  value,
  onChange,
}: {
  value: PenStyle;
  onChange: (value: PenStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="pen-picker"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          event.currentTarget.querySelector('button')?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="pen-picker-trigger"
        aria-label="Pen style"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <PenLine size={15} /> {penStyles.find((style) => style.id === value)?.name}{' '}
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="pen-picker-list" role="group" aria-label="Pen styles">
          {penStyles.map((style) => (
            <button
              key={style.id}
              type="button"
              aria-pressed={value === style.id}
              onClick={(event) => {
                onChange(style.id);
                event.currentTarget.closest('.pen-picker')?.querySelector('button')?.focus();
                setOpen(false);
              }}
            >
              <span>
                <strong>{style.name}</strong>
                <small>{style.detail}</small>
              </span>
              <svg aria-hidden="true" viewBox="0 0 104 27">
                <g opacity={style.opacity}>
                  <InkStroke
                    width={104}
                    height={27}
                    mark={{
                      id: style.id,
                      kind: 'ink',
                      page: 0,
                      points: sample,
                      color: 'currentColor',
                      opacity: style.opacity,
                      size: 4,
                      penStyle: style.id,
                      rect: { x: 0, y: 0, w: 0, h: 0 },
                    }}
                  />
                </g>
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
