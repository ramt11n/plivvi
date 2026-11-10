export const penStyles = [
  { id: 'fountain', name: 'Fountain', detail: 'Soft pressure taper', opacity: 1 },
  { id: 'ballpoint', name: 'Ballpoint', detail: 'Even, precise lines', opacity: 1 },
  { id: 'pencil', name: 'Graphite', detail: 'Shades as you tilt', opacity: 0.72 },
  { id: 'brush', name: 'Brush', detail: 'Wide pressure range', opacity: 1 },
  { id: 'calligraphy', name: 'Calligraphy', detail: 'Thick and thin by angle', opacity: 1 },
  { id: 'felt', name: 'Felt tip', detail: 'Bold, soft ink', opacity: 0.88 },
] as const;
export type PenStyle = (typeof penStyles)[number]['id'];
export type PenActivity = { pointer: number | null; until: number };
export type InkPoint = { x: number; y: number; pressure: number; tiltX?: number; tiltY?: number };
export type MarkKind =
  'ink' | 'highlight-ink' | 'highlight' | 'text' | 'rectangle' | 'note' | 'image';
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
  direction?: 'rtl' | 'ltr';
};
export type ReaderTool =
  'select' | 'pen' | 'highlighter' | 'text' | 'rectangle' | 'note' | 'eraser' | 'line' | 'shape';
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
  const q = Math.round(Math.max(0, Math.min(1, pressure)) * 7) / 7;
  if (style === 'brush') return size * (0.2 + q * q * 2.8);
  if (style === 'calligraphy') return size * (0.32 + q * 1.65);
  if (style === 'felt') return size * (1.3 + q * 0.55);
  return size * (style === 'pencil' ? 2 : 1) * (0.35 + q * 0.85);
}
export function strokePressure(a: InkPoint, b: InkPoint, style?: PenStyle) {
  if (style === 'ballpoint') return 0.6;
  if (style === 'calligraphy' && (a.x !== b.x || a.y !== b.y)) {
    const angle = Math.atan2((b.y - a.y) * 1.4, b.x - a.x);
    return Math.abs(Math.sin(angle - Math.PI / 6));
  }
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

export const isStroke = (mark: Mark) => mark.kind === 'ink' || mark.kind === 'highlight-ink';
