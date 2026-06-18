import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  /** The user's explicit pick (or null if none) — what the picker should show as selected. */
  theme: ThemeId;
  /** What's actually rendered on screen — used by the picker so it can never desync. */
  appliedTheme: ThemeId;
  setTheme: (t: ThemeId) => void;
  customThemes: CustomTheme[];
  refreshCustomThemes: () => Promise<void>;
  previewTokens: (tokens: ThemeTokens | null) => void;
  saveCustomTheme: (name: string, prompt: string, tokens: ThemeTokens) => Promise<CustomTheme | null>;
  deleteCustomTheme: (id: string) => Promise<void>;
  /** Apply a built-in theme override on the public landing route only. Pass null to clear. */
  setLandingThemeOverride: (t: ThemeId | null) => void;
  themesEnabled: boolean;
  customThemesEnabled: boolean;
};

const ThemeCtx = createContext<Ctx>({
  theme: "default",
  appliedTheme: "default",
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
const USER_THEME_KEY = "hf-theme";
const LANDING_THEME_COOKIE = "hf-landing-theme";

const KNOWN_THEME_IDS = new Set(THEMES.map((t) => t.id));

function isKnownTheme(t: string | null | undefined): t is ThemeId {
  if (!t) return false;
  if (t.startsWith("custom:")) return true;
  return KNOWN_THEME_IDS.has(t);
}

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

/**
 * Read the user's *explicit* theme pick. Returns null if the user has never
 * picked one — in that case the CMS landing theme should cascade through.
 */
function readUserTheme(): ThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(USER_THEME_KEY);
    if (stored === "default") {
      localStorage.removeItem(USER_THEME_KEY);
      return null;
    }
    if (stored && isKnownTheme(stored)) return stored;
  } catch {}
  return null;
}

function readLandingCookieTheme(): ThemeId | null {
  const v = readCookie(LANDING_THEME_COOKIE);
  return v && isKnownTheme(v) ? v : null;
}

/**
 * Single resolver — mirrored by the boot script in __root.tsx. Precedence:
 *   1. preview tokens (live custom-theme preview)            → "custom"
 *   2. on landing route                                       → CMS landing theme
 *   3. user's explicit pick (localStorage["hf-theme"])
 *   4. CMS landing theme cookie (hf-landing-theme)
 *   5. "default"
 */
function resolveAppliedTheme(args: {
  isLandingRoute: boolean;
  landingOverride: ThemeId | null;
  userTheme: ThemeId | null;
  cookieLandingTheme: ThemeId | null;
  hasPreview: boolean;
}): ThemeId {
  const { isLandingRoute, landingOverride, userTheme, cookieLandingTheme, hasPreview } = args;
  if (hasPreview) return "custom";
  if (isLandingRoute) {
    return landingOverride ?? cookieLandingTheme ?? "default";
  }
  return userTheme ?? cookieLandingTheme ?? "default";
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
  // `theme` = the user's explicit pick (what the picker shows as "their" theme).
  // null/"default" means "no explicit pick yet — let the CMS theme cascade."
  const [theme, setThemeState] = useState<ThemeId>(() => readUserTheme() ?? "default");

  // `cookieLandingTheme` is read once at mount and kept in state so SPA
  // navigations re-render with the latest value. The SSR Set-Cookie + the
  // landing page's setLandingThemeOverride keep this in sync.
  const [cookieLandingTheme, setCookieLandingTheme] = useState<ThemeId | null>(() =>
    readLandingCookieTheme(),
  );

  const [landingOverride, setLandingOverride] = useState<ThemeId | null>(() => {
    if (typeof document === "undefined") return null;
    if (typeof window !== "undefined" && window.location.pathname !== "/") return null;
    const ssrTheme = document.documentElement.dataset.theme;
    if (ssrTheme && isKnownTheme(ssrTheme) && ssrTheme !== "default") {
      return ssrTheme;
    }
    return null;
  });

  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [preview, setPreview] = useState<ThemeTokens | null>(null);
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
  const isLandingRoute = pathname === "/";

  // The user's explicit pick (what the picker should highlight). When they
  // haven't picked yet but a CMS landing theme exists, the picker still shows
  // "default" — but `appliedTheme` (below) reflects what's actually rendered.
  const userTheme: ThemeId | null = theme && theme !== "default" ? theme : readUserTheme();

  const appliedTheme = useMemo<ThemeId>(() => {
    if (!themesEnabled) return "default";
    return resolveAppliedTheme({
      isLandingRoute,
      landingOverride,
      userTheme,
      cookieLandingTheme,
      hasPreview: !!preview,
    });
  }, [themesEnabled, isLandingRoute, landingOverride, userTheme, cookieLandingTheme, preview]);

  // Apply the resolved theme to <html>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (preview) {
      root.dataset.theme = "custom";
      root.classList.remove("dark");
      applyCustomTokens(preview);
      return;
    }

    const effective = appliedTheme;

    if (effective.startsWith("custom:")) {
      if (!customThemesEnabled) {
        applyCustomTokens(null);
        root.dataset.theme = "default";
        root.classList.remove("dark");
        return;
      }
      const id = effective.slice("custom:".length);
      const found = customThemes.find((c) => c.id === id);
      if (found) {
        root.dataset.theme = "custom";
        root.classList.remove("dark");
        applyCustomTokens(found.tokens);
        return;
      }
      // Custom theme not loaded yet — leave the boot-script state in place.
      return;
    }

    applyCustomTokens(null);
    root.dataset.theme = effective;
    if (themeHasModes(effective)) {
      const defaultMode = effective === "newsprint" ? "light" : "dark";
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("hf-arachna-mode");
      } catch {}
      const mode = stored ?? defaultMode;
      root.classList.toggle("dark", mode === "dark");
    } else {
      root.classList.remove("dark");
    }
  }, [appliedTheme, preview, customThemes, customThemesEnabled]);

  const setTheme = useCallback((t: ThemeId) => {
    setPreview(null);
    setThemeState(t);
    try {
      // "default" means "no explicit pick" — remove the key so the CMS theme
      // can cascade again later if the user wants to clear their preference.
      if (t === "default") {
        localStorage.removeItem(USER_THEME_KEY);
      } else {
        localStorage.setItem(USER_THEME_KEY, t);
      }
    } catch {}
  }, []);

  // Called by the landing page when the CMS theme resolves. Updates the
  // landing-only override AND persists the CMS theme into a cookie so every
  // non-landing route inherits it via the resolver above. Never touches
  // localStorage — that key belongs to the user's explicit pick only.
  const setLandingThemeOverride = useCallback((t: ThemeId | null) => {
    setLandingOverride(t);
    if (t && isKnownTheme(t)) {
      writeCookie(LANDING_THEME_COOKIE, t);
      setCookieLandingTheme(t);
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
        appliedTheme,
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
