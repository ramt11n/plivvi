export type NavigationPoint = { x: number; y: number };
type Options = {
  penActive: () => boolean;
  start: (origin: NavigationPoint) => void;
  change: (scale: number, center: NavigationPoint) => void;
  end: () => void;
};
const geometry = (points: NavigationPoint[]) => ({
  center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
  distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
});
// The viewport receives one absolute transform per frame. Translation and scale
// share the same document anchor; neither competes with a separate scrollBy.
export function bindNavigation(surface: HTMLElement, options: Options) {
  const points = new Map<number, NavigationPoint>();
  let frame = 0;
  let gesture: { initial: ReturnType<typeof geometry>; scaling: boolean } | undefined;
  function clear() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (gesture) options.end();
    gesture = undefined;
  }
  function reset() {
    clear();
    if (points.size === 2) {
      const initial = geometry([...points.values()]);
      gesture = { initial, scaling: false };
      options.start(initial.center);
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
    const initial = gesture.initial;
    const ratio = initial.distance > 1 ? current.distance / initial.distance : 1;
    // Ignore small separation jitter during translation, but allow pan to become
    // a pinch (and vice versa) without lifting either finger.
    if (Math.abs(ratio - 1) >= 0.025) gesture.scaling = true;
    const travel = Math.hypot(
      current.center.x - initial.center.x,
      current.center.y - initial.center.y,
    );
    if (!gesture.scaling && travel < 3) return;
    options.change(gesture.scaling ? ratio : 1, current.center);
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
    if (!frame) frame = requestAnimationFrame(update);
  }
  function end(event: PointerEvent) {
    if (!points.has(event.pointerId)) return;
    if (event.type === 'pointerup' && points.size === 2) {
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      update();
    }
    points.delete(event.pointerId);
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
