import { useEffect, useRef } from "react";
import { motion, useMotionValue, useMotionTemplate, useAnimationFrame } from "framer-motion";

const SIZE = 40;

function GridPattern({ offsetX, offsetY }: { offsetX: any; offsetY: any }) {
  return (
    <svg className="w-full h-full">
      <defs>
        <motion.pattern
          id="hf-grid-pattern"
          width={SIZE}
          height={SIZE}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d={`M ${SIZE} 0 L 0 0 0 ${SIZE}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-foreground"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hf-grid-pattern)" />
    </svg>
  );
}

export function InfiniteGridBg() {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const offX = useMotionValue(0);
  const offY = useMotionValue(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [mouseX, mouseY]);

  useAnimationFrame(() => {
    offX.set((offX.get() + 0.5) % SIZE);
    offY.set((offY.get() + 0.5) % SIZE);
  });

  const maskImage = useMotionTemplate`radial-gradient(300px circle at ${mouseX}px ${mouseY}px, black, transparent)`;

  return (
    <div ref={ref} className="fixed inset-0 z-0 pointer-events-none">
      <div className="absolute inset-0 opacity-[0.12]">
        <GridPattern offsetX={offX} offsetY={offY} />
      </div>
      <motion.div
        className="absolute inset-0 opacity-50"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridPattern offsetX={offX} offsetY={offY} />
      </motion.div>
    </div>
  );
}
