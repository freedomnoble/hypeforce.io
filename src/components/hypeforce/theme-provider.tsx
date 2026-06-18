import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TOKEN_KEYS, type ThemeTokens } from "@/lib/custom-theme.functions";

export type ThemeId = string;

export type CustomTheme = {
  id: string;
  name: string;
  prompt: string | null;
  tokens: ThemeTokens;
};

export const THEMES: { id: string; name: string; description: string; swatch: string[] }[] = [
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
  {
    id: "newsprint",
    name: "Newsprint",
    description: "Paper-textured monochrome — premium black ink on white, charcoal at night.",
    swatch: ["#f5f1e8", "#1a1a1a", "#2a2a2a", "#e8e2d4"],
  },
];

export const THEMES_WITH_MODES: string[] = ["arachna-verse", "newsprint"];

export function themeHasModes(t: string) {
  return THEMES_WITH_MODES.includes(t);
}

export function tokensToCss(tokens: ThemeTokens): string {
  const lines = TOKEN_KEYS.map((k) => `  --${k}: ${tokens[k]};`);
  let body = `:root[data-theme="custom"] {\n${lines.join("\n")}\n}`;
  if (tokens.bodyGradient) {
    body += `\n:root[data-theme="custom"] body { background-image: ${tokens.bodyGradient}; }`;
  }
  return body;
}

type Ctx = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  customThemes: CustomTheme[];
  refreshCustomThemes: () => Promise<void>;
  previewTokens: (tokens: ThemeTokens | null) => void;
  saveCustomTheme: (name: string, prompt: string, tokens: ThemeTokens) => Promise<CustomTheme | null>;
  deleteCustomTheme: (id: string) => Promise<void>;
  /** Apply a built-in theme override on the public landing route only. Pass null to clear. Not persisted. */
  setLandingThemeOverride: (t: ThemeId | null) => void;
  themesEnabled: boolean;
  customThemesEnabled: boolean;
};

const ThemeCtx = createContext<Ctx>({
  theme: "default",
  setTheme: () => {},
  customThemes: [],
  refreshCustomThemes: async () => {},
  previewTokens: () => {},
  saveCustomTheme: async () => null,
  deleteCustomTheme: async () => {},
  setLandingThemeOverride: () => {},
  themesEnabled: true,
  customThemesEnabled: true,
});

const STYLE_TAG_ID = "hf-custom-theme-style";
const THEME_COOKIE = "hf-theme";
const LANDING_THEME_COOKIE = "hf-landing-theme";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&");
  const m = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string | null) {
  if (typeof document === "undefined") return;
  if (value === null) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }
}

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") return "default";
  try {
    const stored = localStorage.getItem("hf-theme");
    if (stored) return stored;
  } catch {}
  const landing = readCookie(LANDING_THEME_COOKIE);
  if (landing && THEMES.some((t) => t.id === landing)) return landing;
  return "default";
}

function applyCustomTokens(tokens: ThemeTokens | null) {
  if (typeof document === "undefined") return;
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!tokens) {
    if (tag) tag.textContent = "";
    return;
  }
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = tokensToCss(tokens);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy-init from localStorage (or landing-theme cookie) so the very first
  // render of any non-landing route already uses the user's saved theme.
  // Matches what the pre-hydration boot script in __root.tsx applied to
  // <html data-theme>, so React hydration doesn't flicker back to default.
  const [theme, setThemeState] = useState<ThemeId>(() => readInitialTheme());
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [preview, setPreview] = useState<ThemeTokens | null>(null);
  const [landingOverride, setLandingOverride] = useState<ThemeId | null>(() => {
    if (typeof document === "undefined") return null;
    if (typeof window !== "undefined" && window.location.pathname !== "/") return null;
    const ssrTheme = document.documentElement.dataset.theme;
    if (ssrTheme && ssrTheme !== "default" && THEMES.some((t) => t.id === ssrTheme)) {
      return ssrTheme;
    }
    return null;
  });
  const [themesEnabled, setThemesEnabled] = useState(true);
  const [customThemesEnabled, setCustomThemesEnabled] = useState(true);

  const refreshCustomThemes = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id;
    if (!userId) {
      setCustomThemes([]);
      return;
    }
    const { data } = await supabase
      .from("custom_themes")
      .select("id, name, prompt, tokens")
      .order("created_at", { ascending: false });
    setCustomThemes((data ?? []) as CustomTheme[]);
  }, []);

  useEffect(() => {
    refreshCustomThemes();
    const loadFlags = async () => {
      const { data } = await supabase
        .from("feature_flags")
        .select("key, enabled")
        .in("key", ["themes_enabled", "custom_themes_enabled"]);
      if (data) {
        const map = new Map(data.map((r: any) => [r.key, r.enabled]));
        setThemesEnabled(map.get("themes_enabled") ?? true);
        setCustomThemesEnabled(map.get("custom_themes_enabled") ?? true);
      }
    };
    loadFlags();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        refreshCustomThemes();
        loadFlags();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshCustomThemes]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The landing route ("/") is the only place where the CMS-configured
  // landing theme wins. Everywhere else (login, onboarding, app, admin,
  // 404, etc) the user's saved theme is applied — and persists across
  // sign-out because it lives in localStorage + cookie, not in their
  // session.
  const isLandingRoute = pathname === "/";
  const activeLandingOverride =
    themesEnabled && isLandingRoute && landingOverride && THEMES.some((t) => t.id === landingOverride)
      ? landingOverride
      : null;

  // Decide which tokens are active and apply
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    // Themes feature flag off → force default everywhere.
    if (!themesEnabled) {
      applyCustomTokens(null);
      root.dataset.theme = "default";
      root.classList.remove("dark");
      return;
    }

    if (preview) {
      root.dataset.theme = "custom";
      root.classList.remove("dark");
      applyCustomTokens(preview);
      return;
    }

    // On landing, the CMS theme wins regardless of the user's saved theme.
    const effectiveTheme = activeLandingOverride ?? theme;

    if (effectiveTheme.startsWith("custom:")) {
      if (!customThemesEnabled) {
        applyCustomTokens(null);
        root.dataset.theme = "default";
        root.classList.remove("dark");
        return;
      }
      const id = effectiveTheme.slice("custom:".length);
      const found = customThemes.find((c) => c.id === id);
      if (found) {
        root.dataset.theme = "custom";
        root.classList.remove("dark");
        applyCustomTokens(found.tokens);
        return;
      }
      // Custom theme not loaded yet — leave whatever was applied (boot script
      // or previous render) in place; refresh will re-run this effect.
      return;
    }

    applyCustomTokens(null);
    root.dataset.theme = effectiveTheme;
    if (themeHasModes(effectiveTheme)) {
      const defaultMode = effectiveTheme === "newsprint" ? "light" : "dark";
      const stored =
        (localStorage.getItem("hf-arachna-mode") as "dark" | "light" | null) ?? defaultMode;
      root.classList.toggle("dark", stored === "dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, preview, customThemes, activeLandingOverride, themesEnabled, customThemesEnabled]);

  const setTheme = (t: ThemeId) => {
    setPreview(null);
    setThemeState(t);
    try {
      localStorage.setItem("hf-theme", t);
    } catch {}
    // Mirror to a cookie so the SSR shell + pre-hydration boot script can
    // apply the same theme on the next hard load without a flash.
    writeCookie(THEME_COOKIE, t);
  };

  // Wrap setLandingOverride so we also persist the CMS landing theme into
  // a cookie. First-time visitors who land on "/" and then navigate to
  // /auth, /onboarding, or the app will get this theme as their default
  // until they pick their own.
  const setLandingThemeOverride = useCallback((t: ThemeId | null) => {
    setLandingOverride(t);
    if (t && THEMES.some((x) => x.id === t)) {
      writeCookie(LANDING_THEME_COOKIE, t);
    }
  }, []);


  const previewTokens = (tokens: ThemeTokens | null) => {
    setPreview(tokens);
  };

  const saveCustomTheme = async (name: string, prompt: string, tokens: ThemeTokens) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("custom_themes")
      .insert({ user_id: u.user.id, name, prompt, tokens })
      .select("id, name, prompt, tokens")
      .single();
    if (error || !data) return null;
    const row = data as CustomTheme;
    setCustomThemes((prev) => [row, ...prev]);
    return row;
  };

  const deleteCustomTheme = async (id: string) => {
    await supabase.from("custom_themes").delete().eq("id", id);
    setCustomThemes((prev) => prev.filter((c) => c.id !== id));
    if (theme === `custom:${id}`) setTheme("default");
  };

  return (
    <ThemeCtx.Provider
      value={{
        theme,
        setTheme,
        customThemes,
        refreshCustomThemes,
        previewTokens,
        saveCustomTheme,
        deleteCustomTheme,
        setLandingThemeOverride,
        themesEnabled,
        customThemesEnabled,
      }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
