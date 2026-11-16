export const outputFormats = [
  { id: 'pdf', label: 'PDF', mime: 'application/pdf', group: 'Document' },
  { id: 'jpg', label: 'JPG / JPEG', mime: 'image/jpeg', group: 'Image' },
  { id: 'png', label: 'PNG', mime: 'image/png', group: 'Image' },
  { id: 'webp', label: 'WebP', mime: 'image/webp', group: 'Image' },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', group: 'Image' },
  { id: 'heic', label: 'HEIC', mime: 'image/heic', group: 'Image' },
  { id: 'tiff', label: 'TIFF', mime: 'image/tiff', group: 'Image' },
  { id: 'bmp', label: 'BMP', mime: 'image/bmp', group: 'Image' },
  { id: 'gif', label: 'GIF', mime: 'image/gif', group: 'Image' },
  { id: 'ico', label: 'ICO', mime: 'image/x-icon', group: 'Image' },
  { id: 'svg', label: 'SVG vector', mime: 'image/svg+xml', group: 'Vector' },
  { id: 'txt', label: 'Plain text', mime: 'text/plain', group: 'Text' },
  { id: 'md', label: 'Markdown', mime: 'text/markdown', group: 'Text' },
  { id: 'html', label: 'HTML', mime: 'text/html', group: 'Text' },
  {
    id: 'docx',
    label: 'Word · DOCX',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    group: 'Office',
  },
  {
    id: 'xlsx',
    label: 'Excel · XLSX',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    group: 'Office',
  },
  {
    id: 'pptx',
    label: 'PowerPoint · PPTX',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    group: 'Office',
  },
  { id: 'cbz', label: 'Comic book · CBZ', mime: 'application/vnd.comicbook+zip', group: 'Archive' },
  { id: 'epub', label: 'EPUB', mime: 'application/epub+zip', group: 'Archive' },
] as const;
export type OutputFormat = (typeof outputFormats)[number]['id'];
export const extension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
export const imageExtensions = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'avif',
  'tif',
  'tiff',
  'bmp',
  'gif',
  'ico',
  'psd',
  'qoi',
];
export const officeExtensions = ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'];
export const textExtensions = ['txt', 'md', 'html', 'htm', 'csv', 'tsv', 'json', 'xml'];
export const documentExtensions = ['pdf', 'svg', 'cbz', 'cbr', 'rar', 'epub', 'xps', 'oxps', 'fb2'];
export const acceptedExtensions = [
  ...imageExtensions,
  ...officeExtensions,
  ...textExtensions,
  ...documentExtensions,
];
export const converterAccept = acceptedExtensions.map((ext) => '.' + ext).join(',');
export const isConvertible = (name: string) => acceptedExtensions.includes(extension(name));
export const isRaster = (name: string) => imageExtensions.includes(extension(name));
export function conversionNote(name: string, target: OutputFormat) {
  if (officeExtensions.includes(extension(name)))
    return 'Office inputs become a text and data reading copy. Complex original layouts, charts and slide designs are not reproduced.';
  if (['docx', 'xlsx'].includes(target))
    return 'Editable text is extracted; Word layout and spreadsheet columns need review. Image-only scans need OCR first.';
  if (target === 'pptx')
    return 'Each page becomes a slide image. Original PDF text is not editable on the slide.';
  if (target === 'svg' && isRaster(name))
    return 'Photos are traced into colored vector shapes. This changes fine photographic detail; choose PNG for a pixel-exact copy.';
  if (target === 'heic')
    return 'HEIC export uses a separate local conversion window. Keep that window open until conversion finishes.';
  return '';
}
export type ConvertOptions = {
  target: OutputFormat;
  range?: string;
  resolution?: number;
  quality?: number;
  arrangement?: 'separate' | 'vertical' | 'horizontal';
  rotation?: number;
  crop?: number;
  currentPassword?: string;
  paper?: 'original' | 'a4' | 'letter';
  merge?: boolean;
  streamArchive?: boolean;
  reverse?: boolean;
  vectorColors?: number;
};
export type Inspection = {
  name: string;
  pages: number;
  width: number;
  height: number;
  bytes: number;
  thumbnails: { index: number; data: Uint8Array }[];
  note: string;
};
