import { useEffect, useRef } from "react";

export function InfiniteGridBg({ interactive = false }: { interactive?: boolean }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interactive) return;
    const el = wrapperRef.current;
    if (!el) return;

    let rafId = 0;
    let nextX = 0;
    let nextY = 0;
    let pending = false;

    const onMove = (e: PointerEvent) => {
      nextX = e.clientX;
      nextY = e.clientY;
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(() => {
        pending = false;
        el.style.setProperty("--mx", `${nextX}px`);
        el.style.setProperty("--my", `${nextY}px`);
        el.style.setProperty("--spot-opacity", "1");
      });
    };
    const onLeave = () => {
      el.style.setProperty("--spot-opacity", "0");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  return (
    <div
      ref={wrapperRef}
      className="infinite-grid-wrapper fixed inset-0 z-0 pointer-events-none"
    >
      <div className="infinite-grid-layer" />
      {interactive && <div className="infinite-grid-spotlight" />}
    </div>
  );
}
