import { useReducedMotion } from "framer-motion";
import { useLayoutEffect, useRef } from "react";
import { getSpatialFrame, subscribeSpatialFrame } from "../spatial/spatialFrame";

/**
 * XR / spatial HUD — parallax layers updated imperatively (no React re-render per frame).
 */
export default function QuadLensOverlay() {
  const reduce = useReducedMotion();
  const stereoRef = useRef<HTMLDivElement>(null);
  const fogRef = useRef<HTMLDivElement>(null);
  const holoFloorRef = useRef<HTMLDivElement>(null);
  const loomRef = useRef<HTMLDivElement>(null);
  const auroraWrapRef = useRef<HTMLDivElement>(null);
  const cornersRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reduce) return;
    const apply = () => {
      const { rx, ry } = getSpatialFrame();
      const dx = rx;
      const dyy = ry;
      const pFar = `translate3d(${dx * 6}px, ${dyy * 4}px, 0) scale(1.02)`;
      const pMid = `translate3d(${dx * 10}px, ${dyy * 7}px, 0) scale(1.04)`;
      const pNear = `translate3d(${dx * 3}px, ${dyy * 2}px, 0)`;
      if (stereoRef.current) stereoRef.current.style.transform = pNear;
      if (fogRef.current) fogRef.current.style.transform = pFar;
      if (holoFloorRef.current) holoFloorRef.current.style.transform = pMid;
      if (loomRef.current) loomRef.current.style.transform = pNear;
      if (auroraWrapRef.current) auroraWrapRef.current.style.transform = pFar;
      if (cornersRef.current) cornersRef.current.style.transform = pNear;
    };
    const unsub = subscribeSpatialFrame(apply);
    apply();
    return unsub;
  }, [reduce]);

  if (reduce) {
    return <div className="quad-lens quad-lens--reduced" aria-hidden />;
  }

  return (
    <div className="quad-lens" aria-hidden>
      <div ref={stereoRef} className="quad-lens-stereo" />
      <div ref={fogRef} className="quad-lens-fog" />
      <div ref={holoFloorRef} className="quad-lens-holo-floor">
        <div className="quad-lens-holo-grid" />
        <div className="quad-lens-holo-horizon" />
      </div>
      <div ref={loomRef} className="quad-lens-holo-loom" />
      <div className="quad-lens-vignette" />
      <div ref={auroraWrapRef} className="quad-lens-aurora-wrap">
        <div className="quad-lens-aurora" />
      </div>
      <div ref={cornersRef} className="quad-lens-corners">
        <span className="quad-lens-bracket quad-lens-bracket--tl" />
        <span className="quad-lens-bracket quad-lens-bracket--tr" />
        <span className="quad-lens-bracket quad-lens-bracket--bl" />
        <span className="quad-lens-bracket quad-lens-bracket--br" />
      </div>
      <div className="quad-lens-hairline" />
    </div>
  );
}
