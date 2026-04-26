import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getSpatialFrame, subscribeSpatialFrame } from "../spatial/spatialFrame";

/**
 * Route outlet with a subtle 3D "viewport" that tracks the pointer — transform is applied imperatively (no 60fps React re-renders).
 */
export default function QuadRoutedOutlet() {
  const location = useLocation();
  const path = location.pathname;
  const reduce = useReducedMotion();
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reduce) return;
    const el = innerRef.current;
    if (!el) return;
    const apply = () => {
      const { rx, ry } = getSpatialFrame();
      el.style.transform = `perspective(4200px) translate3d(${rx * 2.2}px, ${ry * 1.4}px, 0) rotateX(${ry * -0.14}deg) rotateY(${rx * 0.16}deg) translateZ(0)`;
      el.style.transformStyle = "preserve-3d";
      el.style.transformOrigin = "50% 48%";
      el.style.willChange = "transform";
    };
    const unsub = subscribeSpatialFrame(apply);
    apply();
    return unsub;
  }, [reduce]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={path}
        className="quad-outlet-spring"
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: -12, scale: 0.985 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 240, damping: 34, mass: 0.88, restDelta: 0.002, restSpeed: 0.002 }
        }
      >
        <div ref={innerRef} className="quad-outlet-inner">
          <Outlet />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
