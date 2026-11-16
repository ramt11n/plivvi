import { heic, png } from 'icodec';
import encoderURL from 'icodec/heic-enc.wasm?url';
import decoderURL from 'icodec/png-dec.wasm?url';
await Promise.all([heic.loadEncoder(encoderURL), png.loadDecoder(decoderURL)]);
self.postMessage({ ready: true });
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(() => {
    try {
      const image = png.decode(new Uint8Array(data.bytes));
      const bytes = heic.encode(image, {
        quality: data.quality,
        preset: 'ultrafast',
        complexity: 10,
      });
      self.postMessage(
        { id: data.id, name: data.name, bytes },
        { transfer: [bytes.buffer as ArrayBuffer] },
      );
    } catch (error) {
      self.postMessage({ id: data.id, error: (error as Error).message });
    }
  });
};
