import { open, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// A real valid 1 GiB+ PDF with two usable pages and an unreferenced large stream.
// This isolates random-access input handling; it does not simulate a billion complex drawing commands.
export async function largePDF() {
  const folder = path.join(os.tmpdir(), 'plivvi-test-fixtures');
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, 'large-file-backed.pdf');
  if (
    await stat(file)
      .then((s) => s.size > 1073741824)
      .catch(() => false)
  )
    return file;
  const handle = await open(file, 'w');
  let position = 0;
  const offsets = [0];
  async function write(value: string) {
    const data = Buffer.from(value, 'latin1');
    await handle.write(data, 0, data.length, position);
    position += data.length;
  }
  async function object(id: number, value: string) {
    offsets[id] = position;
    await write(`${id} 0 obj\n${value}\nendobj\n`);
  }
  try {
    await write('%PDF-1.7\n');
    await object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    await object(2, '<< /Type /Pages /Count 2 /Kids [3 0 R 6 0 R] >>');
    await object(
      3,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    );
    const text1 =
      '0.1 0.3 0.8 rg 0 0 300 400 re f 1 1 1 rg BT /F1 20 Tf 25 200 Td (LARGE PDF PAGE ONE) Tj ET';
    await object(4, `<< /Length ${text1.length} >>\nstream\n${text1}\nendstream`);
    await object(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    await object(
      6,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    );
    const text2 =
      '0.8 0.2 0.1 rg 0 0 300 400 re f 1 1 1 rg BT /F1 20 Tf 25 200 Td (LARGE PDF PAGE TWO) Tj ET';
    await object(7, `<< /Length ${text2.length} >>\nstream\n${text2}\nendstream`);
    offsets[8] = position;
    await write('8 0 obj\n<< /Length 1073741824 >>\nstream\n');
    position += 1073741824;
    await write('\nendstream\nendobj\n');
    const xref = position;
    await write(
      'xref\n0 9\n0000000000 65535 f \n' +
        offsets
          .slice(1)
          .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
          .join('') +
        `trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    );
  } finally {
    await handle.close();
  }
  return file;
}
