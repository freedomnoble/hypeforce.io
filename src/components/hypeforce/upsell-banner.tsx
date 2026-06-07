import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

type ProfileFlags = {
  show_upsell: boolean;
  upsell_updated_at: string | null;
};

export function UpsellBanner() {
  const [flags, setFlags] = useState<ProfileFlags | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("show_upsell, upsell_updated_at")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!active || !data) return;
      setFlags(data as ProfileFlags);
      const key = `hypeforce.upsell_dismissed.${u.user.id}.${data.upsell_updated_at ?? "0"}`;
      if (localStorage.getItem(key) === "1") setDismissed(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!flags?.show_upsell || dismissed) return null;

  const dismiss = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const key = `hypeforce.upsell_dismissed.${u.user.id}.${flags.upsell_updated_at ?? "0"}`;
      localStorage.setItem(key, "1");
    }
    setDismissed(true);
  };

  return (
    <div className="relative z-20 px-4 py-2 bg-gradient-to-r from-electric/20 via-primary/20 to-purple-500/20 border-b border-white/10 flex items-center justify-center gap-3 text-sm">
      <Sparkles className="w-4 h-4 text-electric shrink-0" />
      <span className="text-foreground/90">
        Enjoying Hypeforce? Consider supporting the project with a subscription.
      </span>
      <Link
        to="/profile"
        className="px-3 py-1 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90"
      >
        Subscribe
      </Link>
      <button
        onClick={dismiss}
        className="ml-1 p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
