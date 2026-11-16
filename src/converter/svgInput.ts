import DOMPurify from 'dompurify';
import type { Input } from '../lib/client';

const cached = new WeakMap<File, Promise<Input>>();
const localURL = (value: string) =>
  value.startsWith('#') || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value);
const cleanCSS = (value: string) =>
  value
    .replace(/@import[^;]*(?:;|$)/gi, '')
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_match, _quote, url) =>
      url.startsWith('#') ? `url(${url})` : 'none',
    );
function length(value: string | null, fallback: number) {
  if (!value || value.endsWith('%')) return fallback;
  const match = value.trim().match(/^([\d.+-]+)(px|pt|pc|mm|cm|in)?$/i);
  const scale: Record<string, number> = {
    px: 1,
    pt: 96 / 72,
    pc: 16,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    in: 96,
  };
  return match ? Number(match[1]) * (scale[match[2]?.toLowerCase() || 'px'] || 1) : fallback;
}
async function convert(file: File): Promise<Input> {
  if (file.size > 32 * 1048576)
    throw Error('Split SVG documents larger than 32 MB before local vector conversion.');
  const safe = DOMPurify.sanitize(await file.text(), {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      'script',
      'foreignObject',
      'iframe',
      'object',
      'embed',
      'animate',
      'animateTransform',
      'animateMotion',
      'set',
    ],
  });
  const parsed = new DOMParser().parseFromString(safe, 'image/svg+xml');
  if (parsed.documentElement.localName !== 'svg' || parsed.querySelector('parsererror'))
    throw Error('This file is not a valid SVG document.');
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of Array.from(element.attributes)) {
      if (/href$/i.test(attribute.name) && !localURL(attribute.value))
        element.removeAttribute(attribute.name);
      else if (/url\(/i.test(attribute.value))
        element.setAttribute(attribute.name, cleanCSS(attribute.value));
    }
    if (element.localName === 'style') element.textContent = cleanCSS(element.textContent || '');
  }
  const view = svg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = length(svg.getAttribute('width'), view?.[2] || 300),
    height = length(svg.getAttribute('height'), view?.[3] || 150);
  if (![width, height].every((n) => Number.isFinite(n) && n > 0 && n <= 32768))
    throw Error('Use an SVG with finite dimensions between 1 and 32768 pixels.');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;opacity:0';
  host.setAttribute('aria-hidden', 'true');
  host.append(svg);
  document.body.append(host);
  try {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
    const pdf = new jsPDF({
      unit: 'pt',
      format: [width, height],
      orientation: width > height ? 'landscape' : 'portrait',
      compress: true,
    });
    await svg2pdf(svg, pdf, {
      width,
      height,
      loadExternalStyleSheets: false,
      loadImages: /^data:image\/(png|jpe?g|webp|gif);base64,/i,
    });
    // Preserve the source name while declaring the normalized vector PDF accurately.
    return { name: file.name, type: 'application/pdf', data: pdf.output('arraybuffer') };
  } finally {
    host.remove();
  }
}
export function svgInput(file: File) {
  let value = cached.get(file);
  if (!value) {
    value = convert(file).catch((error) => {
      cached.delete(file);
      throw error;
    });
    cached.set(file, value);
  }
  return value;
}
