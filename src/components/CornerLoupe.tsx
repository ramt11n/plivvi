import { useEffect, useRef } from 'react';
import type { Point } from '../lib/image';

export default function CornerLoupe({
  source,
  point,
  span,
  side,
}: {
  source: HTMLCanvasElement;
  point: Point;
  span: number;
  side: 'left' | 'right';
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const ratio = Math.min(2, devicePixelRatio || 1);
    target.width = target.height = 96 * ratio;
    const ctx = target.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#f4f6fc';
    ctx.fillRect(0, 0, 96, 96);
    ctx.drawImage(source, point.x - span / 2, point.y - span / 2, span, span, 0, 0, 96, 96);
    ctx.strokeStyle = '#3659e3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of [
      [34, 48, 43, 48],
      [53, 48, 62, 48],
      [48, 34, 48, 43],
      [48, 53, 48, 62],
    ]) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }, [source, point, span]);
  return (
    <div className={`corner-loupe ${side}`} role="img" aria-label="3 times magnified crop corner">
      <canvas ref={canvas} />
      <span>Corner detail · 3×</span>
    </div>
  );
}
