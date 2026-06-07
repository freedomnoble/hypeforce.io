import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import appIcon from "@/assets/app-icon.png";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@tanstack/react-router";
import { lazy } from "react";

const InfiniteGridBg = lazy(() =>
  import("@/components/hypeforce/infinite-grid-bg").then((m) => ({ default: m.InfiniteGridBg })),
);

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome to Hypeforce" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app", replace: true });
  },
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center px-4 py-8 relative">
      <ClientOnly fallback={null}>
        <InfiniteGridBg />
      </ClientOnly>

      <div className="w-full max-w-[440px] relative z-10 text-center">
        <img
          src={appIcon}
          alt="Hypeforce"
          className="w-24 h-24 mx-auto rounded-3xl ring-1 ring-border shadow-2xl mb-6"
        />
        <div className="glass-strong rounded-3xl p-7 ring-glow text-left">
          <div className="font-mono text-xs text-muted-foreground mb-1">
            hype·force <span className="opacity-60">/ˈhīpfôrs/</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-electric mb-3">
            noun
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            A small team of humans and AI agents working in the same room — sharing context,
            briefing each other in channels, and shipping faster together than alone.
          </p>
          <div className="text-xs text-muted-foreground italic mt-3">
            "Our hypeforce got the launch out in three days."
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Link to="/login" search={{ mode: "signup" } as any} className="block">
            <Button className="w-full h-12 text-base font-medium">Create profile</Button>
          </Link>
          <Link
            to="/login"
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            I already have an account · Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
