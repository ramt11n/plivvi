import { unzipSync } from 'fflate';
import { mu } from '../lib/engine';
import { textDocument } from '../lib/unicode';
const decode = (text: string) =>
  text
    .replace(
      /&(?:amp|lt|gt|quot|apos);/g,
      (entity) =>
        ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[entity]!,
    )
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, value) =>
      String.fromCodePoint(
        value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value),
      ),
    );
const attr = (xml: string, name: string) => xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
function rectangle(xml: string, width: number, height: number) {
  const off = xml.match(/<a:off\b[^>]*>/)?.[0] || '',
    ext = xml.match(/<a:ext\b[^>]*>/)?.[0] || '';
  return {
    x: Number(attr(off, 'x') || 0) / 12700,
    y: Number(attr(off, 'y') || 0) / 12700,
    w: Number(attr(ext, 'cx') || width * 12700) / 12700,
    h: Number(attr(ext, 'cy') || height * 12700) / 12700,
  };
}
/** Local reading copy: positioned text and embedded images, without Office theme/animation fidelity. */
export async function pptxReadingCopy(data: ArrayBuffer) {
  const zip = unzipSync(new Uint8Array(data)),
    decoder = new TextDecoder(),
    m = await mu();
  const xml = (path: string) => (zip[path] ? decoder.decode(zip[path]) : '');
  const slides = Object.keys(zip)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
  if (!slides.length) throw Error('No slides were found in this presentation.');
  if (slides.length > 1000)
    throw Error('Convert presentations in batches of at most 1,000 slides.');
  const dimensions = xml('ppt/presentation.xml').match(/<p:sldSz\b[^>]*>/)?.[0] || '';
  const width = Math.max(72, Math.min(16384, Number(attr(dimensions, 'cx') || 9144000) / 12700));
  const height = Math.max(72, Math.min(16384, Number(attr(dimensions, 'cy') || 6858000) / 12700));
  const buffer = new m.Buffer(),
    writer = new m.DocumentWriter(buffer, 'pdf', 'compress=yes');
  try {
    for (const path of slides) {
      const slide = xml(path),
        rels = xml(path.replace('slides/', 'slides/_rels/') + '.rels');
      const relationships = new Map<string, string>();
      for (const rel of rels.match(/<Relationship\b[^>]*>/g) || []) {
        const id = attr(rel, 'Id'),
          target = attr(rel, 'Target');
        if (id && target && !/TargetMode="External"/.test(rel)) {
          const parts = ('ppt/slides/' + decode(target)).split('/'),
            normalized: string[] = [];
          for (const part of parts) {
            if (part === '..') normalized.pop();
            else if (part !== '.') normalized.push(part);
          }
          relationships.set(id, normalized.join('/'));
        }
      }
      const device = writer.beginPage([0, 0, width, height]);
      try {
        for (const shape of slide.match(/<p:(?:pic|sp)\b[\s\S]*?<\/p:(?:pic|sp)>/g) || []) {
          const bounds = rectangle(shape, width, height);
          if (!(bounds.w > 0 && bounds.h > 0)) continue;
          if (shape.startsWith('<p:pic')) {
            const id = attr(shape.match(/<a:blip\b[^>]*>/)?.[0] || '', 'r:embed');
            const target = relationships.get(id || '');
            let bytes: Uint8Array | undefined = target ? zip[target] : undefined;
            if (!bytes) continue;
            if (!/\.(png|jpe?g)$/i.test(target!))
              bytes = (await (await import('./codecs')).rasterFrames(bytes))[0];
            const image = new m.Image(bytes!);
            try {
              device.fillImage(image, [bounds.w, 0, 0, bounds.h, bounds.x, bounds.y], 1);
            } finally {
              image.destroy();
            }
          } else {
            const paragraphs = (shape.match(/<a:p\b[\s\S]*?<\/a:p>/g) || []).map((p) =>
              (p.match(/<a:t\b[^>]*>[\s\S]*?<\/a:t>/g) || [])
                .map((t) => decode(t.replace(/<[^>]*>/g, '')))
                .join(''),
            );
            const text = paragraphs.join('\n');
            if (!text.trim()) continue;
            let size = Math.min(
              72,
              Math.max(
                8,
                Number(shape.match(/<(?:a:rPr|a:defRPr)\b[^>]*\bsz="(\d+)"/)?.[1] || 1600) / 100,
              ),
            );
            let doc = await textDocument(m, text, bounds.w, bounds.h, size, 0);
            while (doc.countPages() > 1 && size > 5) {
              doc.destroy();
              size = Math.max(5, size * 0.8);
              doc = await textDocument(m, text, bounds.w, bounds.h, size, 0);
            }
            try {
              if (doc.countPages() > 1)
                throw Error(
                  'A slide text box is too full to create a complete reading copy. Enlarge the text box in PowerPoint first.',
                );
              const page = doc.loadPage(0);
              try {
                page.run(device, m.Matrix.translate(bounds.x, bounds.y));
              } finally {
                page.destroy();
              }
            } finally {
              doc.destroy();
            }
          }
        }
        device.close();
      } finally {
        device.destroy();
      }
      writer.endPage();
    }
    writer.close();
    return new Uint8Array(buffer.asUint8Array());
  } finally {
    writer.destroy();
    buffer.destroy();
  }
}
