import { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon, RefreshCw } from 'lucide-react';
export default function Camera({
  onCapture,
  onClose,
}: {
  onCapture: (f: File) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [selected, setSelected] = useState('rear'),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setError('');
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open a camera. Upload a photo through Files instead.');
      return;
    }
    const refresh = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (alive) setDevices(all.filter((d) => d.kind === 'videoinput'));
      } catch {}
    };
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          ...(selected === 'rear' || selected === 'front'
            ? { facingMode: { ideal: selected === 'rear' ? 'environment' : 'user' } }
            : { deviceId: { exact: selected } }),
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      })
      .then(async (s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        await refresh();
      })
      .catch(() => {
        if (alive)
          setError(
            'This camera could not open. Try another camera, allow camera access, or upload a photo.',
          );
      });
    navigator.mediaDevices.addEventListener?.('devicechange', refresh);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [selected, retry]);
  return (
    <div className="modal-shade camera-shade">
      <section
        className="camera-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Scan with camera"
      >
        <div className="camera-top">
          <span>
            <CameraIcon size={20} />
            Scan a page
          </span>
          <button className="icon-button" aria-label="Close camera" onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="camera-selector">
          Camera input
          <select
            aria-label="Camera input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="rear">Back camera · automatic</option>
            <option value="front">Front camera</option>
            {devices.map((d, i) => (
              <option value={d.deviceId} key={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        {error ? (
          <div className="camera-error">
            <p role="alert">{error}</p>
            <button className="button secondary" onClick={() => setRetry((n) => n + 1)}>
              <RefreshCw size={16} />
              Try camera again
            </button>
          </div>
        ) : (
          <div className="camera-view">
            <video
              ref={(node) => {
                video.current = node;
                if (node && stream.current) node.srcObject = stream.current;
              }}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setReady(true)}
            />
            <div className="camera-guides" />
            <p>Place your document on a contrasting surface</p>
          </div>
        )}
        <div className="camera-bottom">
          <span>Crop and enhance after capture</span>
          <button
            disabled={!ready}
            className="shutter"
            aria-label="Capture page"
            onClick={() => {
              const v = video.current!,
                c = document.createElement('canvas');
              c.width = v.videoWidth;
              c.height = v.videoHeight;
              c.getContext('2d')!.drawImage(v, 0, 0);
              c.toBlob(
                (b) => {
                  if (b) {
                    onCapture(new File([b], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' }));
                    onClose();
                  }
                },
                'image/jpeg',
                0.94,
              );
            }}
          />
          <span>Your camera stays on this device</span>
        </div>
      </section>
    </div>
  );
}
