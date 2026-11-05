import { useEffect, useRef, type RefObject } from 'react';

export const SLIDE_DURATION = 5000;

// Paint only the progress transform; do not rerender the whole carousel every frame.
export function useShowcasePlayback(
  enabled: boolean,
  resetKey: string,
  progress: RefObject<HTMLElement | null>,
  advance: () => void,
) {
  const elapsed = useRef(0);
  const callback = useRef(advance);
  callback.current = advance;
  useEffect(() => {
    elapsed.current = 0;
    if (progress.current) progress.current.style.transform = 'scaleX(0)';
  }, [resetKey, progress]);
  useEffect(() => {
    if (!enabled) return;
    const started = performance.now();
    const previous = elapsed.current;
    let frame = 0;
    let completed = false;
    const tick = (now: number) => {
      const value = Math.min(1, (previous + now - started) / SLIDE_DURATION);
      if (progress.current) progress.current.style.transform = `scaleX(${value})`;
      if (value >= 1) {
        completed = true;
        callback.current();
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (!completed) elapsed.current = previous + performance.now() - started;
    };
  }, [enabled, resetKey, progress]);
}
