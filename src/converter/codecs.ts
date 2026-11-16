import wasmURL from '@imagemagick/magick-wasm/magick.wasm?url';
import type { ConvertOptions } from './formats';
let ready: Promise<typeof import('@imagemagick/magick-wasm')> | undefined;
export function codecs() {
  return (ready ??= (async () => {
    const library = await import('@imagemagick/magick-wasm');
    const response = await fetch(wasmURL, { signal: AbortSignal.timeout(90000) });
    if (!response.ok)
      throw Error('The image codec could not download. Check your connection and retry.');
    await library.initializeImageMagick(new Uint8Array(await response.arrayBuffer()));
    library.ResourceLimits.memory = 768n * 1024n * 1024n;
    library.ResourceLimits.maxMemoryRequest = 512n * 1024n * 1024n;
    library.ResourceLimits.width = 32768n;
    library.ResourceLimits.height = 32768n;
    library.ResourceLimits.listLength = 1000n;
    return library;
  })().catch((error) => {
    ready = undefined;
    throw error;
  }));
}
export async function rasterFrames(data: Uint8Array): Promise<Uint8Array[]> {
  const m = await codecs();
  // ImageMagick's WASM auto detector does not recognize ICO's short signature.
  const settings =
    data[0] === 0 && data[1] === 0 && data[2] === 1 && data[3] === 0
      ? new m.MagickReadSettings({ format: m.MagickFormat.Ico })
      : new m.MagickReadSettings();
  if (data[0] === 56 && data[1] === 66 && data[2] === 80 && data[3] === 83) settings.frameCount = 1;
  const info = m.MagickImageInfo.create(data, settings);
  if (info.width * info.height > 40_000_000)
    throw Error(
      'This image expands beyond 40 million pixels. Resize the original image before importing it. Large PDFs can still be read page by page.',
    );
  return m.ImageMagick.readCollection(data, settings, (frames) => {
    if (frames.length > 1) frames.coalesce();
    return frames.map((image) => {
      image.autoOrient();
      return image.write(m.MagickFormat.Png, (bytes) => new Uint8Array(bytes));
    });
  });
}
export async function encodeRaster(data: Uint8Array, options: ConvertOptions): Promise<Uint8Array> {
  const m = await codecs();
  return m.ImageMagick.read(data, (image) => {
    image.autoOrient();
    const crop = Math.max(0, Math.min(40, Number(options.crop ?? 0))) / 100;
    if (crop) {
      image.crop(
        Math.max(1, Math.round(image.width * (1 - crop * 2))),
        Math.max(1, Math.round(image.height * (1 - crop * 2))),
        m.Gravity.Center,
      );
      image.resetPage();
    }
    if (options.rotation) image.rotate(Number(options.rotation));
    const width = Number(options.resolution ?? 1500);
    if (width > 0 && image.width > width) image.resize(width, 0);
    image.quality = Math.max(1, Math.min(100, Number(options.quality ?? 90)));
    image.strip();
    if (options.target === 'svg') {
      return image.getPixels((pixels) => {
        const rgba = pixels.toByteArray(0, 0, image.width, image.height, 'RGBA');
        if (!rgba) throw Error('Image pixels could not be read.');
        return import('imagetracerjs').then(({ default: tracer }) =>
          new TextEncoder().encode(
            tracer.imagedataToSVG(
              { width: image.width, height: image.height, data: new Uint8ClampedArray(rgba) },
              {
                numberofcolors: options.vectorColors ?? 16,
                ltres: 1,
                qtres: 1,
                pathomit: 8,
                scale: 1,
                viewbox: true,
              },
            ),
          ),
        );
      });
    }
    if (options.target === 'ico' && Math.max(image.width, image.height) > 256)
      image.resize(256, 256);
    const format = {
      jpg: m.MagickFormat.Jpeg,
      png: m.MagickFormat.Png,
      webp: m.MagickFormat.WebP,
      avif: m.MagickFormat.Avif,
      tiff: m.MagickFormat.Tiff,
      bmp: m.MagickFormat.Bmp,
      gif: m.MagickFormat.Gif,
      ico: m.MagickFormat.Ico,
    }[options.target as string];
    if (!format) throw Error('Choose an available image output format.');
    if (options.target === 'jpg') {
      image.backgroundColor = m.MagickColors.White;
      image.alpha(m.AlphaAction.Remove);
    }
    return image.write(format, (bytes) => new Uint8Array(bytes));
  });
}
export async function joinRaster(images: Uint8Array[], direction: 'vertical' | 'horizontal') {
  const m = await codecs();
  const infos = images.map((bytes) => m.MagickImageInfo.create(bytes));
  const width =
    direction === 'vertical'
      ? Math.max(...infos.map((i) => i.width))
      : infos.reduce((n, i) => n + i.width, 0);
  const height =
    direction === 'horizontal'
      ? Math.max(...infos.map((i) => i.height))
      : infos.reduce((n, i) => n + i.height, 0);
  if (width * height > 32_000_000 || width > 32768 || height > 32768)
    throw Error(
      'The combined image would be too large. Choose fewer pages or a lower resolution, or export separate images.',
    );
  const collection = m.MagickImageCollection.create();
  try {
    for (const data of images) collection.push(m.MagickImage.create(data));
    const finish = (image: import('@imagemagick/magick-wasm').IMagickImage) =>
      image.write(m.MagickFormat.Png, (bytes) => new Uint8Array(bytes));
    return direction === 'vertical'
      ? collection.appendVertically(finish)
      : collection.appendHorizontally(finish);
  } finally {
    collection.dispose();
  }
}
