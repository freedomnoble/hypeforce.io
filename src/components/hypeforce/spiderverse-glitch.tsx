import { useEffect, useRef } from "react";
import { useTheme } from "./theme-provider";

/**
 * Random screen-glitch overlay for the Arachna-Verse theme.
 * Pointer-events:none so it never blocks interaction with the app.
 * Only fires when the active theme is "arachna-verse".
 */
export function SpiderverseGlitch() {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme !== "arachna-verse") return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const tick = () => {
      // Random spotlight origin for the halftone dot reveal
      el.style.setProperty("--gx", `${Math.random() * 100}%`);
      el.style.setProperty("--gy", `${Math.random() * 100}%`);
      el.classList.remove("is-active");
      // Reflow so the animation restarts
      void el.offsetWidth;
      el.classList.add("is-active");
      // Next glitch in 4–11s, fun but unobtrusive
      timeoutId = setTimeout(tick, 4000 + Math.random() * 7000);
    };
    timeoutId = setTimeout(tick, 2500);
    return () => clearTimeout(timeoutId);
  }, [theme]);

  if (theme !== "arachna-verse") return null;

  return (
    <div ref={ref} className="spiderverse-glitch" aria-hidden="true">
      <div className="dots" />
      <div className="band b1" />
      <div className="band b2" />
    </div>
  );
}
