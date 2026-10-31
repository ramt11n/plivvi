import { useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/client';
export default function PageThumbnail({ session, index }: { session: string; index: number }) {
  const ref = useRef<HTMLSpanElement>(null),
    [visible, setVisible] = useState(false),
    [url, setUrl] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), {
      root: ref.current?.closest('.reader-sidebar'),
      rootMargin: '100px',
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let alive = true,
      objectURL = '';
    rpc<{ data: Uint8Array }>('reader-render', { session, index, width: 140 })
      .then((r) => {
        if (!alive) return;
        objectURL = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'image/png' }));
        setUrl(objectURL);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
      setUrl('');
    };
  }, [session, index, visible]);
  return (
    <span className="page-number-paper" ref={ref}>
      {url ? <img src={url} alt={`Thumbnail of page ${index + 1}`} /> : index + 1}
    </span>
  );
}
