import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useMatches,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { createAuthInvalidationHandler } from "@/lib/auth-invalidation";
import { ThemeProvider, THEMES, themeHasModes, readBrowserAppliedTheme } from "@/components/hypeforce/theme-provider";
import { SpiderverseGlitch } from "@/components/hypeforce/spiderverse-glitch";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hypeforce" },
      { name: "description", content: "Hype up your AI workforce in one place. Full alignment with all your favorite models & Humans." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Hypeforce" },
      { property: "og:description", content: "Hype up your AI workforce in one place. Full alignment with all your favorite models & Humans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Hypeforce" },
      { name: "twitter:description", content: "Hype up your AI workforce in one place. Full alignment with all your favorite models & Humans." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/r1sK4IJsokTrWn8LXHUhwgxKgWW2/social-images/social-1780757780179-IMG_2174.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/r1sK4IJsokTrWn8LXHUhwgxKgWW2/social-images/social-1780757780179-IMG_2174.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/app-icon.png" },
      { rel: "shortcut icon", type: "image/png", href: "/app-icon.png" },
      { rel: "apple-touch-icon", href: "/app-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bangers&family=Archivo+Black&family=Bowlby+One&family=Pacifico&display=swap",
      },
    ],
    scripts: [
      {
        // Pre-hydration theme boot. Mirrors the resolver in theme-provider:
        //   landing route ("/")        → SSR data-theme wins
        //   any other route            → user's explicit pick (localStorage)
        //                                   ?? CMS landing theme cookie
        //                                   ?? "default"
        children: `(function(){try{
var KNOWN=["default","tool-time","hail-mary","coffee","arachna-verse","newsprint"];
var WITH_MODES={"arachna-verse":"dark","newsprint":"light"};
function known(t){return t && (t.indexOf("custom:")===0 || KNOWN.indexOf(t)>=0);}
var root=document.documentElement;
var path=location.pathname;
function ck(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
var saved=null;try{saved=localStorage.getItem('hf-theme');}catch(e){}
if(saved==='default'){try{localStorage.removeItem('hf-theme');}catch(e){} saved=null;}
if(!known(saved)) saved=null;
var landing=ck('hf-landing-theme');
if(!known(landing)) landing=null;
try{if(!landing){landing=sessionStorage.getItem('hf-landing-theme');if(!known(landing)) landing=null;}}catch(e){}
var theme;
if(path==='/'){
  theme=root.dataset.theme||landing||'default';
} else {
  theme=saved||landing||'default';
}
if(theme.indexOf('custom:')===0){root.dataset.theme='custom';root.classList.remove('dark');}
else if(KNOWN.indexOf(theme)>=0){
  root.dataset.theme=theme;
  if(WITH_MODES[theme]){
    var modeDefault=WITH_MODES[theme];
    var stored=null;try{stored=localStorage.getItem('hf-arachna-mode');}catch(e){}
    var mode=stored||modeDefault;
    root.classList.toggle('dark',mode==='dark');
  } else { root.classList.remove('dark'); }
}
}catch(e){}})();`,
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const matches = useMatches();
  const landingMatch = matches.find((m) => m.routeId === "/");
  const routeThemeMatch = matches.find((m) => {
    const data = m.loaderData as { themeKey?: string | null } | undefined;
    return !!data?.themeKey;
  });
  const themeKey =
    (landingMatch?.loaderData as { themeKey?: string | null } | undefined)?.themeKey ??
    (routeThemeMatch?.loaderData as { themeKey?: string | null } | undefined)?.themeKey ??
    null;
  const isKnownTheme = !!themeKey && THEMES.some((t) => t.id === themeKey);
  const dataTheme = isKnownTheme ? (themeKey as string) : readBrowserAppliedTheme();
  const isDark = isKnownTheme && themeHasModes(dataTheme) && dataTheme !== "newsprint";
  return (
    <html lang="en" data-theme={dataTheme} className={isDark ? "dark" : ""} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  React.useEffect(() => {
    // Keep exactly one root auth listener. The pure handler filters noisy
    // Supabase events so router/query invalidation only happens on identity transitions.
    const handler = createAuthInvalidationHandler(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handler);
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PaymentTestModeBanner />
        <Outlet />
        <SpiderverseGlitch />
        <Toaster richColors position="top-right" theme="dark" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
