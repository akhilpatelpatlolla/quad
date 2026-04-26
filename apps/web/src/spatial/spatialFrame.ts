export type SpatialFrame = {
  pointerX: number;
  pointerY: number;
  rx: number;
  ry: number;
};

/** Mutable smoothed state — no React. Read in Three.js `useFrame` or DOM subscribers. */
const target: SpatialFrame = { pointerX: 0.5, pointerY: 0.5, rx: 0, ry: 0 };
const current: SpatialFrame = { pointerX: 0.5, pointerY: 0.5, rx: 0, ry: 0 };

const subscribers = new Set<() => void>();
let rafId = 0;
let reduceMode = false;
let lerpFactor = 0.07;

/**
 * After each spatial tick, DOM layers can update without React re-renders.
 * Keep callbacks cheap (style writes only).
 */
export function subscribeSpatialFrame(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function getSpatialFrame(): Readonly<SpatialFrame> {
  return current;
}

function notify() {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore observer errors
    }
  });
}

/**
 * One global loop: lerp + notify. Started from `SpatialProvider`.
 */
export function startSpatialFrameEngine(options: { reduce: boolean; finePointer: boolean }): () => void {
  reduceMode = options.reduce;
  lerpFactor = options.reduce ? 0.5 : 0.07 * (options.finePointer ? 1 : 0.55);

  const onMove = (e: PointerEvent) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const pointerX = e.clientX / w;
    const pointerY = e.clientY / h;
    target.pointerX = pointerX;
    target.pointerY = pointerY;
    target.rx = (pointerX - 0.5) * 2;
    target.ry = (pointerY - 0.5) * 2;
    if (reduceMode) {
      current.pointerX = target.pointerX;
      current.pointerY = target.pointerY;
      current.rx = target.rx;
      current.ry = target.ry;
      notify();
    }
  };

  document.addEventListener("pointermove", onMove, { passive: true });

  if (reduceMode) {
    return () => {
      document.removeEventListener("pointermove", onMove);
    };
  }

  const tick = () => {
    current.rx += (target.rx - current.rx) * lerpFactor;
    current.ry += (target.ry - current.ry) * lerpFactor;
    current.pointerX += (target.pointerX - current.pointerX) * lerpFactor;
    current.pointerY += (target.pointerY - current.pointerY) * lerpFactor;
    notify();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return () => {
    document.removeEventListener("pointermove", onMove);
    cancelAnimationFrame(rafId);
  };
}
