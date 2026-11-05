import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = fileURLToPath(new URL('..', import.meta.url));
const pdf = await PDFDocument.create();
pdf.setTitle('Pli vs. the Page Taxman');
pdf.setAuthor('Plivvi');
pdf.setSubject('A free, original six-panel comic about pages, privacy, and an absurd paywall.');
const left = await pdf.embedJpg(await readFile(join(root, 'assets/comic/page-taxman-left.jpg')));
const right = await pdf.embedJpg(await readFile(join(root, 'assets/comic/page-taxman-right.jpg')));
const panel = 500;
const artHeight = Math.round((left.height / left.width) * panel * 3);
const captionHeight = 138;
const font = await pdf.embedFont(StandardFonts.HelveticaBold);
const dialogue = [
  ['PAGE TAXMAN:', 'Your grocery list has a monthly fee.'],
  ['PLI:', 'Is that vacuum reading my shopping habits?'],
  ['PLI:', 'You paywalled MY grocery list?'],
  ['PLI:', 'My pecs are open source.'],
  ['TAXMAN:', 'Why am I reading my OWN privacy policy?'],
  ['PLI:', 'Free. Local. Disgustingly handsome.'],
];
[left, right].forEach((image, half) => {
  const page = pdf.addPage([panel * 3, artHeight + captionHeight]);
  page.drawRectangle({ x: 0, y: 0, width: panel * 3, height: captionHeight, color: rgb(1, .966, .86) });
  page.drawImage(image, { x: 0, y: captionHeight, width: panel * 3, height: artHeight });
  dialogue.slice(half * 3, half * 3 + 3).forEach(([who, line], i) => {
    const x = i * panel + 22;
    page.drawText(who, { x, y: 85, size: 29, font, color: rgb(.09, .13, .24) });
    page.drawText(line, { x, y: 38, size: 23, font, color: rgb(.09, .13, .24), maxWidth: panel - 44 });
    if (i) page.drawLine({ start: { x: i * panel, y: 8 }, end: { x: i * panel, y: captionHeight - 8 }, thickness: 2, color: rgb(.14, .18, .28) });
  });
});
await writeFile(join(root, 'public/samples/pli-free-pages.pdf'), await pdf.save());
