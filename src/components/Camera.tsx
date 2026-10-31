import { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon } from 'lucide-react';
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
    [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        video.current!.srcObject = s;
      })
      .catch(() =>
        setError(
          'Camera access is unavailable. You can still upload photos or documents from your device.',
        ),
      );
    if (!navigator.mediaDevices)
      setError('This browser cannot open a camera. Use Upload files instead.');
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
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
            <CameraIcon size={20} /> Scan a page
          </span>
          <button className="icon-button" aria-label="Close camera" onClick={onClose}>
            <X />
          </button>
        </div>
        {error ? (
          <p className="camera-error">{error}</p>
        ) : (
          <div className="camera-view">
            <video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} />
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
