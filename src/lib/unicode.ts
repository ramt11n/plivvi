import type * as MuPDF from 'mupdf';

// Font loading is local and script-based. No user text is sent to a font service.
const scripts = [
  ['Arabic', /\p{Script=Arabic}/u],
  ['Devanagari', /\p{Script=Devanagari}/u],
  ['Bengali', /\p{Script=Bengali}/u],
  ['Tamil', /\p{Script=Tamil}/u],
  ['Telugu', /\p{Script=Telugu}/u],
  ['Gujarati', /\p{Script=Gujarati}/u],
  ['Gurmukhi', /\p{Script=Gurmukhi}/u],
  ['Kannada', /\p{Script=Kannada}/u],
  ['Malayalam', /\p{Script=Malayalam}/u],
  ['Hebrew', /\p{Script=Hebrew}/u],
  ['Thai', /\p{Script=Thai}/u],
] as const;
const fonts = new Map<string, Promise<MuPDF.Font>>();
const loaded = new Map<string, MuPDF.Font>();
export const escapeHTML = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function textDirection(text: string): 'rtl' | 'ltr' {
  for (const c of text) {
    if (/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(c)) return 'rtl';
    if (/\p{Letter}/u.test(c)) return 'ltr';
  }
  return 'ltr';
}
export async function unicodeFonts(m: typeof MuPDF, text: string) {
  await Promise.all(
    scripts
      .filter(([, pattern]) => pattern.test(text))
      .map(async ([script]) => {
        let pending = fonts.get(script);
        if (!pending) {
          pending = fetch(`/fonts/NotoSans${script}.ttf`)
            .then(async (r) => {
              if (!r.ok)
                throw Error(
                  `The ${script} font could not load. Connect once to prepare this language for offline use.`,
                );
              const font = new m.Font(`NotoSans${script}`, await r.arrayBuffer());
              loaded.set(script, font);
              return font;
            })
            .catch((error) => {
              fonts.delete(script);
              throw error;
            });
          fonts.set(script, pending);
        }
        await pending;
      }),
  );
  m.installLoadFontFunction((_name, script) => loaded.get(script) ?? null);
}
export async function textDocument(
  m: typeof MuPDF,
  text: string,
  width = 595.28,
  height = 841.89,
  size = 11,
  margin = 48,
  color = '#1f2633',
  direction?: 'ltr' | 'rtl',
) {
  await unicodeFonts(m, text);
  const paragraphs = text
    .split('\n')
    .map((line) =>
      line === '\f'
        ? '<div style="page-break-before:always"></div>'
        : `<p dir="${direction ?? textDirection(line)}"${direction === 'rtl' ? ' style="text-align:right"' : ''}>${escapeHTML(line.replace(/\t/g, '    ')) || '&#160;'}</p>`,
    )
    .join('');
  const html = `<html><head><meta charset="UTF-8"><style>@page{margin:${margin}pt}body{margin:0;font-family:sans-serif;font-size:${size}pt;color:${color};line-height:1.4}p{margin:0 0 ${size * 0.3}pt;white-space:pre-wrap;overflow-wrap:break-word}</style></head><body>${paragraphs}</body></html>`;
  const doc = m.Document.openDocument(new TextEncoder().encode(html), 'text/html');
  doc.layout(width, height, size);
  return doc;
}
export async function unicodePDF(m: typeof MuPDF, text: string, title: string) {
  const buffer = new m.Buffer();
  let writer: MuPDF.DocumentWriter | undefined;
  try {
    writer = new m.DocumentWriter(buffer, 'pdf', 'compress=yes');
    let count = 0;
    for (const section of text.split('\f')) {
      const doc = await textDocument(m, section.replace(/^\n|\n$/g, ''));
      try {
        count += doc.countPages();
        if (count > 300) throw Error('The converted document exceeds the 300-page browser limit.');
        for (let i = 0; i < doc.countPages(); i++) {
          const page = doc.loadPage(i),
            device = writer.beginPage(page.getBounds());
          try {
            page.run(device, m.Matrix.identity);
            device.close();
          } finally {
            device.destroy();
            page.destroy();
          }
          writer.endPage();
        }
      } finally {
        doc.destroy();
      }
    }
    writer.close();
    const pdf = new m.PDFDocument(buffer);
    try {
      pdf.setMetaData('info:Title', title);
      const out = pdf.saveToBuffer('garbage=compact,compress=yes');
      try {
        return new Uint8Array(out.asUint8Array());
      } finally {
        out.destroy();
      }
    } finally {
      pdf.destroy();
    }
  } finally {
    writer?.destroy();
    buffer.destroy();
  }
}
