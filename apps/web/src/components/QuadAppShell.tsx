import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AnimatedBackground from "./AnimatedBackground";
import QuadLensOverlay from "./QuadLensOverlay";
import QuadRoutedOutlet from "./QuadRoutedOutlet";
import { SpatialProvider } from "../context/SpatialContext";

const QuadWebGLRoot = lazy(() => import("../canvas/QuadWebGLRoot"));

/**
 * Single static viewport for the whole SPA: document does not scroll; each route
 * fills the frame and scrolls inside `.quad-outlet--page` or panel scrollers (dashboard / owner).
 */
export default function QuadAppShell() {
  const location = useLocation();
  const path = location.pathname;
  const isDashboard = path === "/app" || path.startsWith("/app/");
  const isOwner = path === "/owner" || path.startsWith("/owner/");
  const isPublic = path === "/" || path === "/login" || path === "/register";
  const appMode = isDashboard || isOwner;
  const bgIntensity = isDashboard || isOwner ? "vivid" : "soft";
  const nexusMode = isPublic ? "cinematic" : "hud";

  useEffect(() => {
    document.body.classList.add("quad-app-route");
    return () => document.body.classList.remove("quad-app-route");
  }, []);

  return (
    <div className="quad-app-root">
      <SpatialProvider>
        <div className="quad-xr-ambient quad-xr-ambient--webgl" aria-hidden>
          <Suspense fallback={null}>
            <QuadWebGLRoot mode={nexusMode} />
          </Suspense>
          <AnimatedBackground intensity={bgIntensity} />
          <QuadLensOverlay />
        </div>
        <div
          className={appMode ? "quad-outlet quad-outlet--app quad-xr-surface" : "quad-outlet quad-outlet--page quad-xr-surface"}
        >
          <QuadRoutedOutlet />
        </div>
      </SpatialProvider>
    </div>
  );
}
