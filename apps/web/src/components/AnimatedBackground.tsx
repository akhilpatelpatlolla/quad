import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

const NET_NODES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 12, y: 22 },
  { x: 32, y: 12 },
  { x: 56, y: 26 },
  { x: 80, y: 16 },
  { x: 86, y: 48 },
  { x: 64, y: 68 },
  { x: 38, y: 78 },
  { x: 14, y: 58 }
];

const NET_LINKS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [2, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 0],
  [0, 2],
  [1, 5],
  [3, 4],
  [5, 7],
  [2, 6]
];

type Intensity = "vivid" | "soft";

type Props = {
  /**
   * Campus + networking look is shared; `vivid` is tuned for the app shell, `soft` for
   * long public pages and auth (quieter, less motion saturation).
   */
  intensity?: Intensity;
};

export default function AnimatedBackground({ intensity = "vivid" }: Props) {
  const reduce = useReducedMotion();
  const gradId = `quad-net-grad-${useId().replace(/:/g, "")}`;

  return (
    <div
      className={`quad-ambient${intensity === "soft" ? " quad-ambient--soft" : ""}`}
      aria-hidden
    >
      <div className="quad-ambient-mesh" />
      <div className="quad-ambient-grid" />
      <div className="quad-ambient-aurora" />

      <svg
        className="quad-ambient-network"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="quad-net-stop-a" />
            <stop offset="100%" className="quad-net-stop-b" />
          </linearGradient>
        </defs>
        {NET_LINKS.map(([a, b], i) => {
          const p = NET_NODES[a]!;
          const q = NET_NODES[b]!;
          return (
            <line
              key={`${a}-${b}-${i}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke={`url(#${gradId})`}
              className="quad-ambient-edge"
              style={{ animationDelay: `${(i * 0.4) % 4}s` }}
            />
          );
        })}
        {NET_NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={intensity === "soft" ? 1.1 : 1.35}
            className="quad-ambient-node-halo"
            style={{ animationDelay: `${(i * 0.5) % 2.5}s` }}
          />
        ))}
        {NET_NODES.map((n, i) => (
          <circle key={`c-${i}`} cx={n.x} cy={n.y} r={0.55} className="quad-ambient-node" />
        ))}
      </svg>

      <motion.div
        className="quad-ambient-blob quad-ambient-blob-1"
        animate={
          reduce
            ? { scale: 1, x: 0, y: 0, rotate: 0 }
            : {
                scale: [1, 1.08, 1],
                x: [0, 36, 0],
                y: [0, -24, 0],
                rotate: [0, 6, 0]
              }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="quad-ambient-blob quad-ambient-blob-2"
        animate={
          reduce
            ? { scale: 1, x: 0, y: 0, rotate: 0 }
            : {
                scale: [1, 1.1, 1],
                x: [0, -50, 0],
                y: [0, 40, 0],
                rotate: [0, -8, 0]
              }
        }
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="quad-ambient-blob quad-ambient-blob-3"
        animate={
          reduce
            ? { scale: 1, x: 0, y: 0, rotate: 0 }
            : {
                scale: [1, 1.05, 1],
                x: [0, 28, 0],
                y: [0, 22, 0],
                rotate: [0, 5, 0]
              }
        }
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
