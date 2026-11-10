import { crc32, deflateSync } from 'node:zlib';

function png(width: number, height: number) {
  const chunk = (kind: string, data: Buffer) => {
    const type = Buffer.from(kind);
    const header = Buffer.alloc(4);
    const crc = Buffer.alloc(4);
    header.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([header, type, data, crc]);
  };
  const info = Buffer.alloc(13);
  info.writeUInt32BE(width);
  info.writeUInt32BE(height, 4);
  info[8] = 8;
  info[9] = 2;
  const pixels = Buffer.alloc((1 + width * 3) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 3) + 1 + x * 3;
      pixels[offset] = x < width / 2 ? 57 : 169;
      pixels[offset + 1] = y < height / 2 ? 68 : 117;
      pixels[offset + 2] = 218;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', info),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A RAR4 archive of generated, uncompressed image entries, deliberately out of order. */
export function sampleComic() {
  function header(type: number, flags: number, body: Buffer) {
    const data = Buffer.alloc(7 + body.length);
    data[2] = type;
    data.writeUInt16LE(flags, 3);
    data.writeUInt16LE(data.length, 5);
    body.copy(data, 7);
    data.writeUInt16LE(crc32(data.subarray(2)) & 0xffff);
    return data;
  }
  function entry(name: string, data: Buffer) {
    const filename = Buffer.from(name);
    const fields = Buffer.alloc(25 + filename.length);
    fields.writeUInt32LE(data.length, 0);
    fields.writeUInt32LE(data.length, 4);
    fields[8] = 3;
    fields.writeUInt32LE(crc32(data), 9);
    fields[17] = 20;
    fields[18] = 0x30;
    fields.writeUInt16LE(filename.length, 19);
    fields.writeUInt32LE(0o100644, 21);
    filename.copy(fields, 25);
    return [header(0x74, 0x8000, fields), data];
  }
  return Buffer.concat([
    Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0]),
    header(0x73, 0, Buffer.alloc(6)),
    ...entry('pages/10.png', png(320, 640)),
    ...entry('pages/1.png', png(480, 640)),
    ...entry('__MACOSX/._1.png', Buffer.from('not a page')),
    ...entry('pages/2.png', png(640, 320)),
    header(0x7b, 0, Buffer.alloc(0)),
  ]);
}
