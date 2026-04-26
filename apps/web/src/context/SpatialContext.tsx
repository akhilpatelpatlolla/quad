import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { type SpatialFrame, startSpatialFrameEngine } from "../spatial/spatialFrame";

export type { SpatialFrame };

const defaultFrame: SpatialFrame = {
  pointerX: 0.5,
  pointerY: 0.5,
  rx: 0,
  ry: 0
};

const SpatialContext = createContext<SpatialFrame>(defaultFrame);

function useMediaFinePointer() {
  const [fine, setFine] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

/**
 * Runs one spatial lAF loop. Does **not** re-render the tree on pointer move (frame reads use `getSpatialFrame` or subscribers).
 */
export function SpatialProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const finePointer = useMediaFinePointer();

  useEffect(() => {
    return startSpatialFrameEngine({ reduce: Boolean(reduce), finePointer });
  }, [reduce, finePointer]);

  return <SpatialContext.Provider value={defaultFrame}>{children}</SpatialContext.Provider>;
}

/**
 * @deprecated Prefer `getSpatialFrame()` in `useFrame` / `subscribeSpatialFrame` for DOM — this no longer updates on pointer move.
 */
export function useSpatialFrame(): SpatialFrame {
  return useContext(SpatialContext);
}
