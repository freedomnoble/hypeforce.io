import { createContext, useContext, useEffect, useState } from "react";

export type ThemeId = "default" | "tool-time" | "hail-mary" | "coffee" | "arachna-verse";

export const THEMES: { id: ThemeId; name: string; description: string; swatch: string[] }[] = [
  {
    id: "default",
    name: "Blueprint",
    description: "Deep cobalt blueprint — the original.",
    swatch: ["#0f1b3d", "#1e3a5f", "#3b6fa0", "#4f46e5"],
  },
  {
    id: "tool-time",
    name: "Tool Time",
    description: "Lighter sky-blue blueprint with crisp ink.",
    swatch: ["#dceaff", "#8ab6e8", "#1d4f91", "#0d2340"],
  },
  {
    id: "hail-mary",
    name: "Hail Mary",
    description: "Space-grey blueprint with auroral glow around every panel.",
    swatch: ["#1a1a1f", "#ff7a3a", "#a87bff", "#3ad6a0"],
  },
  {
    id: "coffee",
    name: "Coffee",
    description: "Warm ivory with softly glowing white panels.",
    swatch: ["#f5ecdc", "#d9bfa0", "#7a5a3a", "#fff4dc"],
  },
  {
    id: "arachna-verse",
    name: "Arachna-Verse",
    description: "Living comic book — halftone dots, neon ink, and chromatic glitches.",
    swatch: ["#fff8d6", "#ff2a6d", "#05d9e8", "#0a0a0a"],
  },
];

/** Themes that ship with both a light and a dark variant. */
export const THEMES_WITH_MODES: ThemeId[] = ["arachna-verse"];

export function themeHasModes(t: ThemeId) {
  return THEMES_WITH_MODES.includes(t);
}

const ThemeCtx = createContext<{ theme: ThemeId; setTheme: (t: ThemeId) => void }>({
  theme: "default",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("default");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem("hf-theme") as ThemeId)) || "default";
    setThemeState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (themeHasModes(theme)) {
      const stored = (localStorage.getItem("hf-arachna-mode") as "dark" | "light" | null) ?? "dark";
      root.classList.toggle("dark", stored === "dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    try {
      localStorage.setItem("hf-theme", t);
    } catch {}
  };

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
