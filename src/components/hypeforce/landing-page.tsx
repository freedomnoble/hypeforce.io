import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Sparkles,
  MessageSquare,
  Users,
  Workflow,
  Lock,
  Zap,
  Bot,
  Play,
  Star,
  Crown,
  Rocket,
  Database,
  TrendingUp,
  Megaphone,

} from "lucide-react";
import heroAsset from "@/assets/hero-we-are-ready.png.asset.json";
import wordmarkAsset from "@/assets/hypeforce-wordmark-white.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useTheme } from "@/components/hypeforce/theme-provider";
import { toast } from "sonner";

const InfiniteGridBg = lazy(() =>
  import("@/components/hypeforce/infinite-grid-bg").then((m) => ({ default: m.InfiniteGridBg })),
);

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare />,
  Bot: <Bot />,
  Users: <Users />,
  Workflow: <Workflow />,
  Zap: <Zap />,
  Lock: <Lock />,
  Rocket: <Rocket />,
  Database: <Database />,
  TrendingUp: <TrendingUp />,
  Megaphone: <Megaphone />,
  Sparkles: <Sparkles />,
  Crown: <Crown />,
};

type FeatureItem = { icon?: string; title: string; desc: string };
type UseCaseItem = { icon?: string; title: string; desc: string };
type FaqItem = { q: string; a: string };
type PlaysWithItem = { label: string; logo_url?: string };
type FooterLink = { label: string; href: string };

export function LandingPage({
  heroUrl,
  videoUrl,
  themeKey,
  content,
  pricing,
}: {
  heroUrl?: string | null;
  videoUrl?: string | null;
  themeKey?: string | null;
  content?: Record<string, any> | null;
  pricing?: Record<string, any> | null;
} = {}) {
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const { setLandingThemeOverride } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setUserEmail(data.session?.user.email);
      setUserId(data.session?.user.id);
    });
  }, []);

  // Apply CMS theme override on the public landing page only. Cleanup restores
  // the default behavior (user's own theme) on unmount or when themeKey changes.
  useEffect(() => {
    if (themeKey && themeKey !== "default") {
      setLandingThemeOverride(themeKey);
    } else {
      setLandingThemeOverride(null);
    }
    return () => setLandingThemeOverride(null);
  }, [themeKey, setLandingThemeOverride]);

  const t = (key: string, fallback: string): string => {
    const v = content?.[key];
    return typeof v === "string" && v.trim() ? v : fallback;
  };

  const arr = <T,>(key: string, fallback: T[]): T[] => {
    const v = content?.[key];
    return Array.isArray(v) && v.length ? (v as T[]) : fallback;
  };

  // Pricing from CMS, with sensible defaults
  const founderActive = pricing?.founder_active ?? true;
  const monthlyCents = (pricing?.founder_price_monthly as number | undefined) ?? 900;
  const monthly = +(monthlyCents / 100).toFixed(2);
  const discountPct = (pricing?.discount_percent as number | undefined) ?? 10;
  const annualFactor = (100 - discountPct) / 100;
  const annualPerMonth = +(monthly * annualFactor).toFixed(2);
  const annualTotal = +(monthly * 12 * annualFactor).toFixed(0);
  const standardCents = (pricing?.pro_price_monthly as number | undefined) ?? 1900;
  const standardMonthly = +(standardCents / 100).toFixed(2);
  const seatsRemaining = pricing?.founder_seats_remaining as number | undefined;

  const handleCheckout = async () => {
    if (!signedIn) {
      window.location.href = `/login?redirect=${encodeURIComponent("/#pricing")}`;
      return;
    }
    try {
      await openCheckout({
        priceId: billing === "annual" ? "founder_annual" : "founder_monthly",
        customerEmail: userEmail,
        customData: userId ? { userId } : undefined,
      });
    } catch (e) {
      console.error(e);
      toast.error("Checkout failed to open. Please try again.");
    }
  };

  const featureItems = arr<FeatureItem>("features", [
    { icon: "MessageSquare", title: "Slack-style channels", desc: "Pin briefs, thread replies, search everything. The familiar workspace your team already lives in." },
    { icon: "Bot", title: "A roster of agents", desc: "ChatGPT, Claude, Gemini, Manus and custom agents — each with their own avatar, prompt and tools." },
    { icon: "Users", title: "@-mention to target", desc: "@claude for the long thinking, @gemini for the fast pass, or just send a message and let the whole crew weigh in." },
    { icon: "Workflow", title: "Shared context", desc: "Channel memory, pinned briefs, uploaded docs — every agent reads the room before it replies." },
    { icon: "Zap", title: "Built for speed", desc: "Simple to navigate and set context, brand voice, and more.  Switch channels, brief agents and ship in seconds." },
    { icon: "Lock", title: "Your data, your keys", desc: "Bring your own provider keys. Export anything, delete anything. Founders own their workspace." },
  ]);

  const useCaseItems = arr<UseCaseItem>("use_cases", [
    { icon: "Rocket", title: "Solo Founder Launchpad", desc: "Launch campaigns and ship features together. One agent researches market demand, another scopes the build, another writes the marketing copy, another runs the repo tests — all in parallel, all aligned to your brand, vision and voice." },
    { icon: "Database", title: "Data, SOPs & Marketing in One Room", desc: "Cast each agent in a role and brief the outcome. They model the data, write SOPs from the findings, and turn the results into marketing copy your team and agents can run with — together, in one channel." },
    { icon: "TrendingUp", title: "Trend-to-Brand Marketing Engine", desc: "A research agent scans trending content on your target channels. A strategy agent maps trends to your brand (or proposes a new course). Copy and image/video agents ship on-brand assets using your colors, logos and voice." },
    { icon: "Megaphone", title: "Brand Voice Command Center", desc: "Pin the brief once. Every agent — ChatGPT, Claude, Gemini, Manus — reads the room before replying, so your tone, positioning and product facts stay consistent across every message, doc and campaign." },
  ]);

  const faqItems = arr<FaqItem>("faqs", [
    { q: "What happens after the first 1,000 founder spots are gone?", a: "The price goes up to $19/mo for everyone after. Founders keep $9/mo for life — even if you cancel and come back later, your seat is yours." },
    { q: "Can I bring my own API keys?", a: "Yes. Add your own ChatGPT, Claude, Gemini or Manus keys in workspace settings. We never store your keys in plaintext." },
    { q: "What does \u201cown your data\u201d mean?", a: "You can export every channel, message and pinned brief at any time. Delete your workspace and it's gone — no shadow copies." },
    { q: "Is there a free trial?", a: "You can preview the product without a card. When you're ready to ship work, claim a founder seat — cancel anytime." },
    { q: "When does annual billing start?", a: "Right when you subscribe. Annual saves 10% off twelve months at the founder price." },
  ]);

  const playsWithItems = arr<PlaysWithItem>("plays_with", [
    { label: "ChatGPT" },
    { label: "Claude" },
    { label: "Gemini" },
    { label: "Manus" },
    { label: "+ your own keys" },
  ]);

  const footerLinks = arr<FooterLink>("footer_links", [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Sign in", href: "/login" },
  ]);


  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Suspense fallback={null}>
        <InfiniteGridBg interactive />
      </Suspense>

      {/* Sticky nav */}
      <header className="relative z-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 pt-5">
          <nav className="liquid-glass rounded-2xl relative flex items-center justify-between px-4 sm:px-5 py-2.5">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src={wordmarkAsset.url}
                alt="Hypeforce"
                className="h-16 sm:h-[4.5rem] w-auto select-none"
                draggable={false}
              />
            </Link>
            <div className="hidden md:flex items-center gap-7 text-sm text-foreground/85 absolute left-1/2 -translate-x-1/2">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </div>
            <div className="flex items-center gap-2">
              {signedIn ? (
                <Button asChild size="sm" variant="liquid">
                  <Link to="/app">Open app</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm" variant="liquid">
                    <a href="#pricing">Claim founder spot</a>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 pt-14 sm:pt-20 pb-10">
        <div className="text-center">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 liquid-glass rounded-full px-3.5 py-1.5 text-xs uppercase tracking-[0.18em] text-foreground/85 mb-7 hover:text-foreground transition-colors"
          >
            <Crown className="w-3.5 h-3.5 text-electric" />
            {t("hero_eyebrow", "Beta is open — first 1,000 users only")}
          </a>

          <div className="relative mx-auto w-full max-w-[1100px]">
            <img
              src={heroUrl || heroAsset.url}
              alt="Hypeforce — we are ready"
              className="w-full h-auto rounded-3xl select-none pointer-events-none drop-shadow-[0_30px_60px_oklch(0_0_0/0.55)]"
              draggable={false}
            />
          </div>

          <div className="relative mt-10 sm:mt-14 max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl text-foreground/90 font-display tracking-tight">
              {t("hero_headline", "Work with your AI team — like Slack, but built for human & robot shared goals.")}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              {t("hero_subhead", "Brief ChatGPT, Claude, Gemini and Manus in one room. @-mention to target, broadcast to brief the whole crew. Share context and ship faster.")}
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" variant="liquid" className="text-base h-12 px-6">
                <a href="#pricing">
                  {t("hero_cta_primary", `Get founder access — $${monthly}/mo`)}
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-base h-12 px-6">
                <a href="#demo">
                  <Play className="w-4 h-4" /> {t("hero_cta_secondary", "Watch the 90-second tour")}
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/80">
              {t("hero_footnote", "Cancel anytime · Own your work and data")}
            </p>
          </div>
        </div>
      </section>

      {/* Logo row / social proof strip */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 lg:px-8 pb-10">
        <div className="liquid-glass rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-center gap-x-10 gap-y-3 text-sm">
          <span className="text-muted-foreground uppercase tracking-[0.18em] text-[11px] text-left">
            {t("plays_with_label", "PLAYS WELL WITH")}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {playsWithItems.map((p, i) =>
              p.logo_url ? (
                <img key={i} src={p.logo_url} alt={p.label} className="h-6 w-auto opacity-90" />
              ) : (
                <span key={i} className="font-display text-foreground/90">{p.label}</span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="use-cases" className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="hf-eyebrow">{t("use_cases_eyebrow", "Use cases")}</p>
          <h2 className="hf-h2">{t("use_cases_headline", "25X yourself or your team")}</h2>
          <p className="mt-3 text-muted-foreground text-lg">
            {t("use_cases_subhead", "Hype up your work with 5 agents that work together. That's 5x5 the productivity and work shipped.")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {useCaseItems.map((u, i) => (
            <UseCaseCard
              key={i}
              n={String(i + 1).padStart(2, "0")}
              icon={FEATURE_ICONS[u.icon ?? ""] ?? <Rocket />}
              title={u.title}
              desc={u.desc}
            />
          ))}
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="hf-eyebrow">{t("features_eyebrow", "The platform")}</p>
          <h2 className="hf-h2">{t("features_headline", "An intentional space for alignment across chatbots and humans.")}</h2>
          <p className="mt-3 text-muted-foreground text-lg">
            {t("features_subhead", "Hypeforce is a chat-first workspace where humans and agents collaborate in shared channels with shared context, shared memory and shared goals.")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featureItems.map((f, i) => (
            <FeatureCard
              key={i}
              icon={FEATURE_ICONS[f.icon ?? ""] ?? <Sparkles />}
              title={f.title}
              desc={f.desc}
            />
          ))}
        </div>
      </section>


      {/* DEMO VIDEO */}
      <section id="demo" className="relative z-10 mx-auto max-w-6xl px-5 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="hf-eyebrow">{t("demo_eyebrow", "See it move")}</p>
          <h2 className="hf-h2">{t("demo_headline", "90 seconds inside a Hypeforce channel.")}</h2>
        </div>
        <div className="glass-strong rounded-3xl p-2 sm:p-3">
          <div className="aspect-video rounded-2xl overflow-hidden relative bg-[oklch(0.15_0.08_262)] grid-blueprint">
            {videoUrl ? (
              <video
                className="absolute inset-0 w-full h-full object-cover"
                controls
                playsInline
                preload="metadata"
                src={videoUrl}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                <div className="liquid-glass rounded-full w-20 h-20 grid place-items-center mb-4">
                  <Play className="w-8 h-8" />
                </div>
                <p className="text-foreground/90 font-display text-lg">Demo video coming up</p>
                <p className="text-sm text-muted-foreground mt-1">Upload your clip in /pretentious → Landing CMS.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="hf-eyebrow">{t("how_eyebrow", "How it works")}</p>
          <h2 className="hf-h2">{t("how_headline", "Three steps from idea to shipped.")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StepCard n="01" title="Make a channel" desc="Spin up #launch-plan, #brand-voice, #build-log — any project you'd open a channel for." />
          <StepCard n="02" title="Invite your team" desc="Drop in the agents you want — ChatGPT, Claude, Gemini, Manus — and add teammate or two!" />
          <StepCard n="03" title="Brief and ship" desc="Pin the brief, @-mention the agents, and let the work happen in one placewith one context." />
        </div>
      </section>


      {/* PRICING */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-5 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 liquid-glass rounded-full px-3.5 py-1.5 text-xs uppercase tracking-[0.18em] text-foreground/85 mb-5">
            <Star className="w-3.5 h-3.5 text-electric" />
            Founding 1,000 — locked-in pricing
          </div>
          <h2 className="hf-h2">$9/mo. Forever. For founders only.</h2>
          <p className="mt-3 text-muted-foreground text-lg">
            Regular price will be <span className="line-through opacity-70">$19/mo</span>.
            The first 1,000 beta users keep <span className="text-foreground font-semibold">$9/mo for life</span>{" "}
            and get the <span className="text-electric">Founding Member</span> badge.
          </p>

          <div className="inline-flex liquid-glass rounded-full p-1 mt-7" role="tablist" aria-label="Billing period">
            <button
              role="tab"
              aria-selected={billing === "monthly"}
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${billing === "monthly" ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              role="tab"
              aria-selected={billing === "annual"}
              onClick={() => setBilling("annual")}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${billing === "annual" ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annual <span className="text-electric ml-1">−10%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Anchor — regular pricing */}
          <div className="glass rounded-3xl p-7 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 liquid-glass rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] text-center whitespace-nowrap">
              After first 1000 users
            </div>
            <p className="hf-eyebrow opacity-80">Regular</p>
            <h3 className="font-display text-2xl mt-1">Standard seat</h3>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="text-5xl font-display line-through opacity-60">$19</span>
              <span className="text-muted-foreground">/mo</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">After the 1,000 founder spots are claimed.</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              <Bullet>Unlimited channels and agents</Bullet>
              <Bullet>ChatGPT, Claude, Gemini, Manus</Bullet>
              <Bullet>Bring your own keys</Bullet>
              <Bullet>Export anything, delete anything</Bullet>
            </ul>
          </div>

          {/* Founder — primary */}
          <div className="glass-strong rounded-3xl p-7 relative ring-glow">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 liquid-glass rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] text-center whitespace-nowrap">
              <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1 text-electric" />
              Founder
            </div>
            <p className="hf-eyebrow">Beta · First 1,000</p>
            <h3 className="font-display text-2xl mt-1">Founding Member</h3>
            <div className="mt-5 flex items-baseline gap-1.5">
              {billing === "monthly" ? (
                <>
                  <span className="text-6xl font-display text-foreground">${monthly}</span>
                  <span className="text-muted-foreground">/mo</span>
                </>
              ) : (
                <>
                  <span className="text-6xl font-display text-foreground">${annualPerMonth}</span>
                  <span className="text-muted-foreground">/mo · billed ${annualTotal}/yr</span>
                </>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {billing === "monthly"
                ? "Locked in forever. Cancel anytime."
                : "10% off · locked in forever · cancel anytime."}
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              <Bullet><span className="text-electric font-semibold">Founding Member</span> badge on your profile</Bullet>
              <Bullet>$9/mo price locked for life</Bullet>
              <Bullet>Everything in Standard</Bullet>
              <Bullet>Early access to new agents and features</Bullet>
              <Bullet>Direct line to the team in #founders</Bullet>
            </ul>
            <Button
              size="lg"
              variant="liquid"
              className="mt-7 w-full h-12 text-base"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Opening checkout…" : "Claim my founder spot"}{" "}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Cancel anytime · Own your work and data
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="hf-eyebrow">FAQ</p>
          <h2 className="hf-h2">Questions, answered.</h2>
        </div>
        <div className="space-y-3">
          <Faq q="What happens after the first 1,000 founder spots are gone?">
            The price goes up to $19/mo for everyone after. Founders keep $9/mo for life — even if you
            cancel and come back later, your seat is yours.
          </Faq>
          <Faq q="Can I bring my own API keys?">
            Yes. Add your own ChatGPT, Claude, Gemini or Manus keys in workspace settings.
            We never store your keys in plaintext.
          </Faq>
          <Faq q="What does “own your data” mean?">
            You can export every channel, message and pinned brief at any time. Delete your workspace
            and it's gone — no shadow copies.
          </Faq>
          <Faq q="Is there a free trial?">
            You can preview the product without a card. When you're ready to ship work, claim a
            founder seat — cancel anytime.
          </Faq>
          <Faq q="When does annual billing start?">
            Right when you subscribe. Annual saves 10% off twelve months at the founder price.
          </Faq>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 pb-16">
        <div className="glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display text-3xl sm:text-5xl tracking-tight">
            Your Hypeforce is waiting in <span className="text-electric">#launch-plan</span>.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Claim one of the 1,000 founder seats and lock in $9/mo for life.
          </p>
          <Button asChild size="lg" variant="liquid" className="mt-6 h-12 px-7 text-base">
            <Link to="/login">
              Get founder access <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8 pb-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="hf-wordmark text-base">Hypeforce</span>
            <span>· © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="glass rounded-2xl p-6 group transition-transform hover:-translate-y-0.5">
      <div className="liquid-glass rounded-xl w-11 h-11 grid place-items-center mb-4 text-electric">
        {icon}
      </div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function UseCaseCard({ n, icon, title, desc }: { n: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="glass rounded-2xl p-6 group transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-4">
        <div className="liquid-glass rounded-xl w-11 h-11 grid place-items-center text-electric">
          {icon}
        </div>
        <span className="font-display text-2xl text-electric/70 leading-none">{n}</span>
      </div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="glass rounded-2xl p-6 relative">
      <div className="font-display text-5xl text-electric/70 leading-none">{n}</div>
      <h3 className="font-display text-xl mt-3">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="w-4 h-4 mt-0.5 text-electric shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="glass rounded-2xl px-5 py-4 group">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
        <span className="font-display text-base sm:text-lg">{q}</span>
        <span className="text-electric text-xl leading-none group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{children}</p>
    </details>
  );
}
