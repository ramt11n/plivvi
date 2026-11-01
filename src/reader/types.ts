export type PenStyle = 'fountain' | 'ballpoint' | 'pencil';
export type PenActivity = { pointer: number | null; until: number };
export type InkPoint = { x: number; y: number; pressure: number; tiltX?: number; tiltY?: number };
export type MarkKind = 'ink' | 'highlight' | 'text' | 'rectangle' | 'note' | 'image';
export type Mark = {
  id: string;
  page: number;
  kind: MarkKind;
  color: string;
  size: number;
  opacity: number;
  points: InkPoint[];
  rect: { x: number; y: number; w: number; h: number };
  text?: string;
  lines?: string[];
  layoutKey?: string;
  penStyle?: PenStyle;
  image?: string;
};
export type ReaderTool =
  'select' | 'pen' | 'highlighter' | 'text' | 'rectangle' | 'note' | 'eraser';
export type PageInfo = { width: number; height: number };
export type OutlineEntry = { title: string; page: number; level: number };
export type ReaderInfo = {
  session: string;
  count: number;
  pages: PageInfo[];
  outline: OutlineEntry[];
  title: string;
  author: string;
};
export type TextChar = { text: string; x: number; y: number; w: number; h: number; size: number };
export function pressureWidth(size: number, pressure: number, style?: PenStyle) {
  return (
    size *
    (style === 'pencil' ? 2 : 1) *
    (0.35 + (Math.round(Math.max(0, Math.min(1, pressure)) * 7) / 7) * 0.85)
  );
}
export function strokePressure(a: InkPoint, b: InkPoint, style?: PenStyle) {
  if (style === 'ballpoint') return 0.6;
  const pressure = (a.pressure + b.pressure) / 2;
  const tilt = Math.min(
    1,
    Math.hypot((a.tiltX ?? 0) + (b.tiltX ?? 0), (a.tiltY ?? 0) + (b.tiltY ?? 0)) / 160,
  );
  return style === 'pencil' ? pressure * 0.5 + tilt * 0.5 : pressure;
}
export function hexColor(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return [0.16, 0.19, 0.28];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}
