type Point = { x: number; y: number };
type Options = { penActive: () => boolean; zoom: (ratio: number, anchor: Point) => void };
const geometry = (points: Point[]) => ({
  center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
  distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
});
// One controller for the entire viewport, including fingers on different pages.
export function bindNavigation(surface: HTMLElement, options: Options) {
  const points = new Map<number, Point>();
  let frame = 0;
  let gesture:
    | {
        start: ReturnType<typeof geometry>;
        previous: ReturnType<typeof geometry>;
        mode?: 'pan' | 'pinch';
      }
    | undefined;
  function clear() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    gesture = undefined;
  }
  function reset() {
    clear();
    if (points.size === 2) {
      const start = geometry([...points.values()]);
      gesture = { start, previous: start };
    }
  }
  function cancel() {
    clear();
    const ids = [...points.keys()];
    points.clear();
    for (const id of ids) if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
  }
  function update() {
    frame = 0;
    if (options.penActive()) {
      cancel();
      return;
    }
    if (!gesture || points.size !== 2) return;
    const current = geometry([...points.values()]);
    const translation = Math.hypot(
      current.center.x - gesture.start.center.x,
      current.center.y - gesture.start.center.y,
    );
    const separation = Math.abs(current.distance - gesture.start.distance);
    if (!gesture.mode) {
      if (separation >= 10 && separation > translation * 1.4) gesture.mode = 'pinch';
      else if (translation >= 8 && translation > separation * 0.7) gesture.mode = 'pan';
      else return;
    }
    // Lock the intent until a finger lifts. Never scroll and zoom in one update.
    if (gesture.mode === 'pan') {
      surface.scrollBy(
        gesture.previous.center.x - current.center.x,
        gesture.previous.center.y - current.center.y,
      );
    } else if (gesture.previous.distance > 1 && current.distance > 1) {
      options.zoom(current.distance / gesture.previous.distance, gesture.start.center);
    }
    gesture.previous = current;
  }
  function down(event: PointerEvent) {
    if (event.pointerType === 'pen') {
      cancel();
      return;
    }
    if (event.pointerType !== 'touch') return;
    event.preventDefault();
    event.stopPropagation();
    if (options.penActive()) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    surface.setPointerCapture(event.pointerId);
    reset();
  }
  function move(event: PointerEvent) {
    if (event.pointerType !== 'touch' || !points.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Both fingers' events are sampled together, avoiding alternating half-gestures.
    if (!frame) frame = requestAnimationFrame(update);
  }
  function end(event: PointerEvent) {
    if (!points.delete(event.pointerId)) return;
    event.stopPropagation();
    reset();
  }
  const stopScroll = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
  };
  surface.addEventListener('pointerdown', down, true);
  surface.addEventListener('pointermove', move, true);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    surface.addEventListener(type, end as EventListener, true);
  surface.addEventListener('touchmove', stopScroll, { passive: false });
  return () => {
    cancel();
    surface.removeEventListener('pointerdown', down, true);
    surface.removeEventListener('pointermove', move, true);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      surface.removeEventListener(type, end as EventListener, true);
    surface.removeEventListener('touchmove', stopScroll);
  };
}
