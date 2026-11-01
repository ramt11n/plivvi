import { beforeAll, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { mu, open, operate, extractText, render } from '../src/lib/engine';
import { textDirection, textDocument, unicodePDF } from '../src/lib/unicode';
import { exportAnnotations, readerReorder, readerAppendPage } from '../src/reader/engine';
import { notebookPDF } from '../src/notebooks/model';
import { strokePressure, type Mark } from '../src/reader/types';
beforeAll(() =>
  vi.stubGlobal('fetch', async (url: string) => {
    if (!/^\/fonts\/[a-zA-Z]+\.ttf$/.test(url)) throw Error('Unexpected remote request: ' + url);
    return {
      ok: true,
      arrayBuffer: async () => new Uint8Array(readFileSync('public' + url)).buffer,
    };
  }),
);
const languages = [
  'Français : été, cœur, Noël. Türkçe: şğİı ç. Deutsch: Grüße, Straße.',
  'سلام دنیا؛ فارسی و العربية مرحباً',
  '中文世界。日本語のノート。한국어 메모.',
  'हिन्दी नमस्ते। বাংলা নমস্কার। தமிழ் வணக்கம்.',
  'తెలుగు నమస్కారం. ગુજરાતી નમસ્તે. ਪੰਜਾਬੀ ਸਤ ਸ੍ਰੀ ਅਕਾਲ.',
  'ಕನ್ನಡ ನಮಸ್ಕಾರ. മലയാളം നമസ്കാരം. שלום עולם. ภาษาไทย',
];
it('renders each script as visible shaped glyphs, retaining extractable Unicode', async () => {
  const m = await mu();
  for (const text of languages) {
    const source = await textDocument(m, text, 595, 842, 16, 40),
      page = source.loadPage(0),
      pix = page.toPixmap(m.Matrix.identity, m.ColorSpace.DeviceRGB, false);
    try {
      const data = pix.getPixels();
      let dark = 0;
      for (let i = 0; i < data.length; i += 3)
        if (data[i] < 150 && data[i + 1] < 150 && data[i + 2] < 150) dark++;
      expect(dark).toBeGreaterThan(200);
      const structured = page.toStructuredText({});
      try {
        expect(structured.asText().replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
      } finally {
        structured.destroy();
      }
    } finally {
      pix.destroy();
      page.destroy();
      source.destroy();
    }
  }
  const data = await unicodePDF(m, languages.join('\n\n'), 'Multilingual verification');
  const input = {
    name: 'languages.pdf',
    type: 'application/pdf',
    data: new Uint8Array(data).buffer,
  };
  const doc = await open(input);
  try {
    expect(doc.countPages()).toBe(1);
  } finally {
    doc.destroy();
  }
  mkdirSync('test-output', { recursive: true });
  writeFileSync('test-output/multilingual.pdf', data);
  const finalDoc = await open(input);
  try {
    writeFileSync('test-output/multilingual.png', (await render(finalDoc, 0, 1190)).data);
  } finally {
    finalDoc.destroy();
  }
});
it('uses first strong character for direction, handles page breaks and hostile HTML as text', async () => {
  expect(textDirection('123 سلام hello')).toBe('rtl');
  expect(textDirection('123 Hello سلام')).toBe('ltr');
  const text = '<script>alert("x")</script>\n\f\nسلام';
  const [out] = await operate('html-pdf', [
    { name: 'unicode.txt', data: new TextEncoder().encode(text).buffer, type: 'text/plain' },
  ]);
  const input = { name: out.name, data: new Uint8Array(out.data).buffer, type: out.type },
    doc = await open(input);
  try {
    expect(doc.countPages()).toBe(2);
  } finally {
    doc.destroy();
  }
  expect((await extractText(input)).join('')).toContain('<script>');
});
it('exports visible Persian annotation appearances and keeps the original Unicode contents', async () => {
  const input = {
    name: 'notebook.pdf',
    type: 'application/pdf',
    data: new Uint8Array(await notebookPDF('blank')).buffer,
  };
  const marks: Mark[] = [
    {
      id: 'rtl',
      page: 0,
      kind: 'text',
      text: 'سلام دنیا و العربية',
      size: 20,
      color: '#25344f',
      opacity: 1,
      points: [],
      rect: { x: 0.1, y: 0.1, w: 0.75, h: 0.15 },
    },
  ];
  const out = await exportAnnotations(input, '', marks),
    doc = await open({ name: out.name, type: out.type, data: new Uint8Array(out.data).buffer });
  try {
    const page = doc.loadPage(0),
      annotations = page.getAnnotations();
    try {
      expect(annotations[0].getContents()).toBe(marks[0].text);
      const pix = page.toPixmap(
        (await mu()).Matrix.identity,
        (await mu()).ColorSpace.DeviceRGB,
        false,
      );
      try {
        writeFileSync('test-output/rtl-annotation.png', pix.asPNG());
        const data = pix.getPixels();
        expect(data.filter((v) => v < 100).length).toBeGreaterThan(200);
      } finally {
        pix.destroy();
      }
    } finally {
      annotations.forEach((a) => a.destroy());
      page.destroy();
    }
  } finally {
    doc.destroy();
  }
});
it('creates paper styles, adds patterned pages, and reorders without losing page count', async () => {
  for (const paper of ['blank', 'ruled', 'dots', 'grid', 'cornell'] as const) {
    const data = await notebookPDF(paper, 2),
      input = { name: 'book.pdf', type: 'application/pdf', data: new Uint8Array(data).buffer };
    const appended = await readerAppendPage(input, '', paper);
    const out = await readerReorder(
      { name: input.name, type: input.type, data: new Uint8Array(appended.data).buffer },
      '',
      [2, 0, 0, 1],
    );
    const doc = await open({
      name: out.name,
      type: out.type,
      data: new Uint8Array(out.data).buffer,
    });
    try {
      expect(doc.countPages()).toBe(4);
    } finally {
      doc.destroy();
    }
  }
  await expect(notebookPDF('grid', 0)).rejects.toThrow();
});
it('responds to pencil tilt while ballpoint retains an even width', () => {
  const a = { x: 0, y: 0, pressure: 0.5, tiltX: 0, tiltY: 0 },
    b = { ...a, tiltX: 70 };
  expect(strokePressure(b, b, 'pencil')).toBeGreaterThan(strokePressure(a, a, 'pencil'));
  expect(strokePressure(b, b, 'ballpoint')).toBe(strokePressure(a, a, 'ballpoint'));
});
