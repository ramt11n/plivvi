import { beforeAll, describe, expect, it } from 'vitest';
import { detectCorners, enhance, perspective, solve } from '../src/lib/image';
beforeAll(() => {
  if (typeof ImageData === 'undefined')
    Object.assign(globalThis, {
      ImageData: class {
        width: number;
        height: number;
        data: Uint8ClampedArray;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
          this.data = new Uint8ClampedArray(width * height * 4);
        }
      },
    });
});
describe('scan processing', () => {
  it('finds warm paper on a similarly bright gray desk', () => {
    const source = new ImageData(240, 180);
    for (let y = 0; y < 180; y++)
      for (let x = 0; x < 240; x++) {
        const paper = x >= 40 && x <= 200 && y >= 20 && y <= 160;
        source.data.set(paper ? [220, 211, 194, 255] : [202, 203, 202, 255], (y * 240 + x) * 4);
      }
    const corners = detectCorners(source);
    expect(corners[0].x).toBeCloseTo(40, 0);
    expect(corners[0].y).toBeCloseTo(20, 0);
    expect(corners[2].x).toBeCloseTo(200, 0);
    expect(corners[2].y).toBeCloseTo(160, 0);
  });
  it('keeps the shaded side when finding a page on a darker surface', () => {
    const source = new ImageData(200, 250);
    for (let y = 0; y < 250; y++)
      for (let x = 0; x < 200; x++) {
        const value = x >= 20 && x <= 180 && y >= 25 && y <= 225 ? 110 + x * 0.6 : 55;
        source.data.set([value, value, value, 255], (y * 200 + x) * 4);
      }
    const corners = detectCorners(source);
    expect(corners[0].x).toBeCloseTo(20, 0);
    expect(corners[0].y).toBeCloseTo(25, 0);
    expect(corners[2].x).toBeCloseTo(180, 0);
    expect(corners[2].y).toBeCloseTo(225, 0);
  });
  it('rejects crossed or collapsed crop corners', () => {
    const source = new ImageData(100, 100);
    expect(() =>
      perspective(source, [
        { x: 0, y: 0 },
        { x: 99, y: 99 },
        { x: 99, y: 0 },
        { x: 0, y: 99 },
      ]),
    ).toThrow(/corners/);
    expect(() =>
      solve(
        [
          [1, 1],
          [1, 1],
        ],
        [2, 2],
      ),
    ).toThrow(/corners/);
  });
  it('warps a page while preserving corner colors', () => {
    const source = new ImageData(40, 40);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        const i = (y * 40 + x) * 4;
        source.data.set([x * 6, y * 6, 80, 255], i);
      }
    const out = perspective(source, [
      { x: 0, y: 0 },
      { x: 39, y: 0 },
      { x: 39, y: 39 },
      { x: 0, y: 39 },
    ]);
    expect(out.width).toBe(39);
    expect(out.height).toBe(39);
    expect([...out.data.slice(0, 4)]).toEqual([0, 0, 80, 255]);
    expect([...out.data.slice(-4)]).toEqual([234, 234, 80, 255]);
  });
  it('reduces uneven illumination without losing dark lettering', () => {
    const source = new ImageData(100, 100);
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 100; x++) {
        const value = x < 50 ? 110 : 240;
        source.data.set([value, value, value, 255], (y * 100 + x) * 4);
      }
    source.data.set([10, 10, 10, 255], (50 * 100 + 20) * 4);
    const out = enhance(source, 'clean', 1);
    expect(out.data[(20 * 100 + 20) * 4]).toBeGreaterThan(245);
    expect(out.data[(50 * 100 + 20) * 4]).toBeLessThan(30);
    const gray = enhance(source, 'gray');
    expect(gray.data[0]).toBe(gray.data[1]);
  });
});
