import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { createAuthInvalidationHandler } from "@/lib/auth-invalidation";
import { ThemeProvider } from "@/components/hypeforce/theme-provider";
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
      { name: "description", content: "Get work done with all your favorite models & Humans" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Hypeforce" },
      { property: "og:description", content: "Get work done with all your favorite models & Humans" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Hypeforce" },
      { name: "twitter:description", content: "Get work done with all your favorite models & Humans" },
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
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
