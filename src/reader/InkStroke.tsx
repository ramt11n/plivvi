import { memo } from 'react';
import { pressureWidth, strokePressure, type Mark } from './types';

// Saved ink is independent of the live pen preview. Typing, dragging, or drawing
// a new stroke must not rebuild the paths of every existing stroke.
export default memo(function InkStroke({
  mark: m,
  width,
  height,
}: {
  mark: Mark;
  width: number;
  height: number;
}) {
  if (m.kind === 'highlight-ink') {
    const d = m.points.map((q, i) => `${i ? 'L' : 'M'}${q.x * width} ${q.y * height}`).join(' ');
    return m.points.length === 1 ? (
      <circle
        cx={m.points[0].x * width}
        cy={m.points[0].y * height}
        r={m.size / 2}
        fill={m.color}
      />
    ) : (
      <path
        d={d}
        fill="none"
        stroke={m.color}
        strokeWidth={m.size}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (m.points.length === 1)
    return (
      <circle
        cx={m.points[0].x * width}
        cy={m.points[0].y * height}
        r={pressureWidth(m.size, m.points[0].pressure, m.penStyle) / 2}
        fill={m.color}
      />
    );
  const buckets = new Map<number, string[]>();
  for (let i = 1; i < m.points.length; i++) {
    const a = m.points[i - 1],
      b = m.points[i],
      q = Math.round(strokePressure(a, b, m.penStyle) * 7);
    const paths = buckets.get(q) ?? [];
    paths.push(`M${a.x * width} ${a.y * height}L${b.x * width} ${b.y * height}`);
    buckets.set(q, paths);
  }
  return (
    <>
      {[...buckets].map(([pressure, parts]) => (
        <path
          key={pressure}
          d={parts.join('')}
          fill="none"
          stroke={m.color}
          strokeWidth={pressureWidth(m.size, pressure / 7, m.penStyle)}
          strokeLinecap="round"
        />
      ))}
    </>
  );
});
