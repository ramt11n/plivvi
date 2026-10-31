import { useEffect, useRef, useState } from 'react';
export default function SignaturePad({ onChange }: { onChange: (s: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    [hasInk, setHasInk] = useState(false);
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#243259';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);
  return (
    <div className="signature">
      <canvas
        ref={ref}
        width={600}
        height={190}
        aria-label="Draw your signature"
        onPointerDown={(e) => {
          const c = ref.current!,
            r = c.getBoundingClientRect(),
            ctx = c.getContext('2d')!;
          c.setPointerCapture(e.pointerId);
          ctx.beginPath();
          ctx.moveTo(
            ((e.clientX - r.left) * c.width) / r.width,
            ((e.clientY - r.top) * c.height) / r.height,
          );
          drawing.current = true;
          setHasInk(true);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const c = ref.current!,
            r = c.getBoundingClientRect(),
            ctx = c.getContext('2d')!;
          ctx.lineTo(
            ((e.clientX - r.left) * c.width) / r.width,
            ((e.clientY - r.top) * c.height) / r.height,
          );
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          onChange(ref.current!.toDataURL('image/png'));
        }}
        onPointerCancel={() => (drawing.current = false)}
      />
      <div>
        <span>
          {hasInk
            ? 'Looking good. You can draw over it or start again.'
            : 'Draw your signature here with your finger or mouse.'}
        </span>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const c = ref.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            setHasInk(false);
            onChange('');
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
