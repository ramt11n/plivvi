import { inputs, type Input } from '../lib/client';
export async function conversionInputs(files: File[]): Promise<Input[]> {
  const result: Input[] = [];
  for (const file of files) {
    if (/\.svg$/i.test(file.name)) result.push(await (await import('./svgInput')).svgInput(file));
    else result.push((await inputs([file]))[0]);
  }
  return result;
}
