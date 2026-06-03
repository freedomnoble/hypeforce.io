import { useEffect, useRef } from "react";
import { useTheme } from "./theme-provider";

/**
 * Random screen-glitch overlay for the Arachna-Verse theme.
 * Also pulses random visible elements (buttons, avatars, panels) with a
 * brief chromatic-aberration jitter via the `.av-glitching` class.
 * Pointer-events:none on the overlay; element pulses don't block interaction.
 * Only fires when the active theme is "arachna-verse".
 */
const ELEMENT_GLITCH_SELECTOR = [
  "button",
  "[role='button']",
  "a[href]",
  ".liquid-glass",
  ".glass",
  ".glass-strong",
  ".paper-panel",
  "[data-glitch]",
  "[data-radix-avatar-root]",
  // Radix Avatar root has no data attribute by default — match via class hook
  ".rounded-full",
].join(",");

function isVisible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;
  if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
  if (rect.right < 0 || rect.left > window.innerWidth) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
  return true;
}

export function SpiderverseGlitch() {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme !== "arachna-verse") return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let overlayTimer: ReturnType<typeof setTimeout>;
    let elementTimer: ReturnType<typeof setTimeout>;

    const runOverlay = () => {
      el.style.setProperty("--gx", `${Math.random() * 100}%`);
      el.style.setProperty("--gy", `${Math.random() * 100}%`);
      el.classList.remove("is-active");
      void el.offsetWidth;
      el.classList.add("is-active");
      overlayTimer = setTimeout(runOverlay, 4000 + Math.random() * 7000);
    };

    const glitchOneElement = () => {
      const candidates = Array.from(document.querySelectorAll(ELEMENT_GLITCH_SELECTOR))
        .filter(isVisible);
      if (candidates.length) {
        // Pulse 1–3 random elements per tick
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          if (!target || target.classList.contains("av-glitching")) continue;
          target.classList.add("av-glitching");
          setTimeout(() => target.classList.remove("av-glitching"), 450);
        }
      }
      elementTimer = setTimeout(glitchOneElement, 1200 + Math.random() * 2600);
    };

    overlayTimer = setTimeout(runOverlay, 2500);
    elementTimer = setTimeout(glitchOneElement, 1500);
    return () => {
      clearTimeout(overlayTimer);
      clearTimeout(elementTimer);
      document.querySelectorAll(".av-glitching").forEach((n) => n.classList.remove("av-glitching"));
    };
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
