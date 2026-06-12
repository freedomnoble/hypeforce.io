import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { X, Sparkles, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";

const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type Mode = "hidden" | "trial-warn" | "trial-expired" | "subscribe";

export function UpsellBanner() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [hoursLeft, setHoursLeft] = useState<number>(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_comped, show_upsell, trial_started_at, trial_ends_at, trial_cancel_requested_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!active || !profile) return;
      if (profile.is_comped) return;

      const dismissedAt = Number(
        localStorage.getItem(`hf.upsell_dismissed.${user.id}`) ?? 0,
      );
      const dismissedRecently = Date.now() - dismissedAt < DISMISS_TTL_MS;

      // Active sub? — never show, unless admin forced show_upsell.
      const env = getPaddleEnvironment();
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1);
      const sub = subs?.[0];
      const hasActive =
        sub &&
        ["active", "trialing", "past_due"].includes(sub.status) &&
        (!sub.current_period_end ||
          new Date(sub.current_period_end as string) > new Date());

      if (hasActive && !profile.show_upsell) return;

      // Trial state takes priority over generic upsell.
      if (profile.trial_ends_at) {
        const endsMs = new Date(profile.trial_ends_at as string).getTime();
        const msLeft = endsMs - Date.now();
        const hrs = Math.max(0, Math.ceil(msLeft / (60 * 60 * 1000)));
        if (msLeft <= 0 && !hasActive) {
          setHoursLeft(0);
          setMode("trial-expired");
          return;
        }
        // Days 1–3: silent. Day 4+ (≤48h): warn.
        if (msLeft > 0 && msLeft <= 48 * 60 * 60 * 1000) {
          if (dismissedRecently) return;
          setHoursLeft(hrs);
          setMode("trial-warn");
          return;
        }
        // Trial active, still days 1–3 → no banner.
        if (msLeft > 0) return;
      }

      if (dismissedRecently) return;
      if (profile.show_upsell || !hasActive) setMode("subscribe");
    })();
    return () => {
      active = false;
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      localStorage.setItem(`hf.upsell_dismissed.${u.user.id}`, String(Date.now()));
    }
    setMode("hidden");
  };

  const trialBg =
    mode === "trial-expired"
      ? "bg-gradient-to-r from-red-500/25 via-orange-500/20 to-amber-500/20"
      : "bg-gradient-to-r from-amber-500/20 via-electric/20 to-primary/20";
  const subscribeBg =
    "bg-gradient-to-r from-electric/20 via-primary/20 to-purple-500/20";

  return (
    <div
      className={`relative z-20 px-4 py-2 border-b border-white/10 flex items-center justify-center gap-3 text-sm ${
        mode === "subscribe" ? subscribeBg : trialBg
      }`}
    >
      {mode === "subscribe" ? (
        <Sparkles className="w-4 h-4 text-electric shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-amber-300 shrink-0" />
      )}
      <span className="text-foreground/90">
        {mode === "trial-warn" &&
          (hoursLeft <= 24
            ? `Last day of your free trial — claim your founder seat for $9/mo.`
            : `Your free trial ends in ~${Math.ceil(hoursLeft / 24)} days — claim your founder seat for $9/mo.`)}
        {mode === "trial-expired" &&
          `Your free trial has ended. Subscribe for $9/mo to keep sending messages.`}
        {mode === "subscribe" &&
          `Unlock the full Hypeforce — claim a founder seat for $9/mo.`}
      </span>
      <Link
        to="/profile/billing"
        className="px-3 py-1 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90"
      >
        Subscribe
      </Link>
      {mode !== "trial-expired" && (
        <button
          onClick={dismiss}
          className="ml-1 p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
