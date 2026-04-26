import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import NexusScene, { type NexusMode } from "./NexusScene";

const dpr = typeof window !== "undefined" ? Math.min(1.5, window.devicePixelRatio || 1) : 1;

/**
 * Real-time 3D field: volumetric post, distortion mesh, parallax from SpatialProvider.
 * Fixed fullscreen; pointer-events none so UI stays usable.
 */
export default function QuadWebGLRoot({ mode }: { mode: NexusMode }) {
  const [isDark, setIsDark] = useState(
    () => (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") === "dark" : false)
  );

  useEffect(() => {
    const el = document.documentElement;
    const apply = () => setIsDark(el.getAttribute("data-theme") === "dark");
    const o = new MutationObserver(apply);
    o.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    apply();
    return () => o.disconnect();
  }, []);

  return (
    <div className="quad-webgl-root" aria-hidden>
      <Canvas
        shadows
        gl={{ alpha: false, antialias: true, powerPreference: "high-performance", stencil: false, depth: true }}
        dpr={[1, dpr]}
        performance={{ min: 0.5 }}
        camera={{ position: [0, 0.35, 9.1], fov: 40, near: 0.1, far: 200 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none"
        }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <NexusScene mode={mode} isDark={isDark} />
        </Suspense>
      </Canvas>
    </div>
  );
}
