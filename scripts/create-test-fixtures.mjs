// Synthetic documents only. Never include private user files in test fixtures.
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph } from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import * as mupdf from 'mupdf';
await mkdir('test-output', { recursive: true });
const pdf = await PDFDocument.create(),
  font = await pdf.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 2; i++) {
  const page = pdf.addPage([500, 700]);
  page.drawText('PLIVVI WORKFLOW TEST', {
    x: 45,
    y: 620,
    size: 25,
    font,
    color: rgb(0.1, 0.16, 0.3),
  });
  page.drawText(`Synthetic document / Page ${i + 1}`, { x: 45, y: 570, size: 16, font });
  page.drawText('The quick brown fox jumps over the lazy dog.', { x: 45, y: 510, size: 15, font });
  page.drawText('Invoice total: 123.45', { x: 45, y: 470, size: 15, font });
}
const data = await pdf.save();
await writeFile('test-output/workflow.pdf', data);
const m = new mupdf.PDFDocument(data),
  page = m.loadPage(0),
  pix = page.toPixmap(mupdf.Matrix.scale(1.5, 1.5), mupdf.ColorSpace.DeviceRGB, false);
await writeFile('test-output/workflow-scan.png', pix.asPNG());
pix.destroy();
page.destroy();
m.destroy();
const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph('DOCX WORKFLOW TEST'),
        new Paragraph('A readable document becomes a PDF copy.'),
      ],
    },
  ],
});
await writeFile('test-output/workflow.docx', new Uint8Array(await Packer.toArrayBuffer(doc)));
const wb = new ExcelJS.Workbook(),
  sheet = wb.addWorksheet('Workflow');
sheet.addRow(['XLSX WORKFLOW TEST', 'Amount']);
sheet.addRow(['Invoice total', 123.45]);
await writeFile('test-output/workflow.xlsx', new Uint8Array(await wb.xlsx.writeBuffer()));
const ppt = new PptxGenJS();
ppt.addSlide().addText('PPTX WORKFLOW TEST', { x: 1, y: 1, w: 6, h: 1, fontSize: 28 });
await writeFile(
  'test-output/workflow.pptx',
  new Uint8Array(await ppt.write({ outputType: 'arraybuffer' })),
);
await writeFile(
  'test-output/workflow.html',
  '<h1>HTML WORKFLOW TEST</h1><p>A useful reading copy.</p><script>HIDDEN_SCRIPT</script>',
);
console.log('Created synthetic PDF, scan, Office, and HTML workflow fixtures in test-output.');
