import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { X, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function UpsellBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;

      // Manual admin override: profile.show_upsell forces it on.
      // Otherwise auto-show when user has no active subscription and isn't comped.
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_comped, show_upsell")
        .eq("id", user.id)
        .maybeSingle();
      if (!active || !profile) return;
      if (profile.is_comped) return;

      const dismissedAt = Number(
        localStorage.getItem(`hf.upsell_dismissed.${user.id}`) ?? 0,
      );
      if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;

      if (profile.show_upsell) {
        setShow(true);
        return;
      }

      const env = getPaddleEnvironment();
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1);
      const sub = subs?.[0];
      const active2 =
        sub &&
        ["active", "trialing", "past_due"].includes(sub.status) &&
        (!sub.current_period_end ||
          new Date(sub.current_period_end as string) > new Date());
      if (!active2) setShow(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!show) return null;

  const dismiss = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      localStorage.setItem(`hf.upsell_dismissed.${u.user.id}`, String(Date.now()));
    }
    setShow(false);
  };

  return (
    <div className="relative z-20 px-4 py-2 bg-gradient-to-r from-electric/20 via-primary/20 to-purple-500/20 border-b border-white/10 flex items-center justify-center gap-3 text-sm">
      <Sparkles className="w-4 h-4 text-electric shrink-0" />
      <span className="text-foreground/90">
        Unlock the full Hypeforce — claim a founder seat for $9/mo.
      </span>
      <Link
        to="/profile/billing"
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
