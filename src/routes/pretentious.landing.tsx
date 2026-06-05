import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getLandingContentAdmin,
  updateLandingContent,
  getPricingConfigAdmin,
  updatePricingConfig,
  createLandingUploadUrl,
} from "@/lib/admin.functions";
import { GlassPanel } from "@/components/admin/admin-shell";
import { toast } from "sonner";

export const Route = createFileRoute("/pretentious/landing")({
  component: LandingCMS,
});

// Mirror the keys actually used by landing-page.tsx. Editing these in
// /pretentious updates the live homepage immediately.
const FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "hero_eyebrow", label: "Hero eyebrow / badge" },
  { key: "hero_headline", label: "Hero headline", multiline: true },
  { key: "hero_subhead", label: "Hero sub-headline", multiline: true },
  { key: "hero_cta_primary", label: "Hero primary CTA label" },
  { key: "hero_cta_secondary", label: "Hero secondary CTA label" },
  { key: "hero_footnote", label: "Hero footnote" },
  { key: "plays_with_label", label: "Plays well with — label" },
  { key: "use_cases_eyebrow", label: "Use cases — eyebrow" },
  { key: "use_cases_headline", label: "Use cases — headline" },
  { key: "use_cases_subhead", label: "Use cases — subhead", multiline: true },
  { key: "features_eyebrow", label: "Features — eyebrow" },
  { key: "features_headline", label: "Features — headline" },
  { key: "features_subhead", label: "Features — subhead", multiline: true },
  { key: "demo_eyebrow", label: "Demo — eyebrow" },
  { key: "demo_headline", label: "Demo — headline" },
  { key: "how_eyebrow", label: "How it works — eyebrow" },
  { key: "how_headline", label: "How it works — headline" },
  { key: "pricing_headline", label: "Pricing — headline" },
  { key: "pricing_subhead", label: "Pricing — subhead", multiline: true },
  { key: "faq_headline", label: "FAQ — headline" },
  { key: "footer_cta_headline", label: "Footer CTA — headline" },
  { key: "footer_cta_subhead", label: "Footer CTA — subhead", multiline: true },
];

const LIST_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "features", label: "Features (JSON array)", hint: '[{"icon":"MessageSquare","title":"...","desc":"..."}]' },
  { key: "use_cases", label: "Use cases (JSON array)", hint: '[{"icon":"Rocket","title":"...","desc":"..."}]' },
  { key: "faqs", label: "FAQ (JSON array)", hint: '[{"q":"...","a":"..."}]' },
  { key: "plays_with", label: "Plays well with (JSON array)", hint: '[{"label":"ChatGPT","logo_url":"..."}]' },
  { key: "footer_links", label: "Footer links (JSON array)", hint: '[{"label":"Features","href":"#features"}]' },
];

const THEMES = ["default", "spider-noir", "hail-mary", "miles-morales", "gwen-stacy", "cyberpunk"];

function LandingCMS() {
  const getFn = useServerFn(getLandingContentAdmin);
  const saveFn = useServerFn(updateLandingContent);
  const getPrice = useServerFn(getPricingConfigAdmin);
  const savePrice = useServerFn(updatePricingConfig);
  const uploadUrl = useServerFn(createLandingUploadUrl);

  const { data: landing, refetch } = useQuery({ queryKey: ["admin-landing"], queryFn: () => getFn() });
  const { data: pricing, refetch: refetchPrice } = useQuery({ queryKey: ["admin-pricing"], queryFn: () => getPrice() });

  const [content, setContent] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<string>("default");
  const [hero, setHero] = useState<string>("");
  const [video, setVideo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (landing) {
      setContent({ ...((landing.content as Record<string, string>) ?? {}) });
      setTheme(landing.theme_key ?? "default");
      setHero(landing.hero_image_url ?? "");
      setVideo(landing.demo_video_url ?? "");
    }
  }, [landing]);

  const [price, setPrice] = useState<any>(null);
  useEffect(() => {
    if (pricing) setPrice({ ...pricing });
  }, [pricing]);

  const handleUpload = async (file: File, kind: "hero" | "video") => {
    setBusy(true);
    try {
      const { signedUrl, publicUrl } = await uploadUrl({ data: { filename: file.name, kind } });
      const res = await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!res.ok) throw new Error("Upload failed");
      if (kind === "hero") setHero(publicUrl);
      else setVideo(publicUrl);
      toast.success(`${kind} uploaded`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      // Parse JSON list fields; reject save on invalid JSON.
      const parsed: Record<string, any> = { ...content };
      for (const f of LIST_FIELDS) {
        const v = parsed[f.key];
        if (typeof v === "string") {
          const s = v.trim();
          if (!s) {
            delete parsed[f.key];
          } else {
            try {
              const j = JSON.parse(s);
              if (!Array.isArray(j)) throw new Error("must be an array");
              parsed[f.key] = j;
            } catch (err: any) {
              throw new Error(`${f.label}: ${err.message}`);
            }
          }
        }
      }
      await saveFn({
        data: {
          content: parsed,
          theme_key: theme === "default" ? null : theme,
          hero_image_url: hero || null,
          demo_video_url: video || null,
        },
      });
      toast.success("Landing saved");
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const savePricing = async () => {
    if (!price) return;
    setBusy(true);
    try {
      await savePrice({ data: price });
      toast.success("Pricing saved");
      await refetchPrice();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-tight">Landing CMS</h1>
        <button onClick={save} disabled={busy} className="px-4 py-2 rounded-xl bg-purple-500/30 hover:bg-purple-500/40 border border-purple-300/20 text-sm">Save copy & assets</button>
      </div>

      <GlassPanel className="p-5 space-y-4">
        <h3 className="font-display text-lg">Theme</h3>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={`px-3 py-1.5 rounded-lg text-sm capitalize ${theme === t ? "bg-white/15 border border-white/20" : "bg-white/5 border border-white/10 text-white/60"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5 space-y-4">
        <h3 className="font-display text-lg">Hero image & demo video</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-white/60 mb-2">Hero image</div>
            {hero && <img src={hero} alt="" className="w-full max-h-48 object-cover rounded-lg mb-2" />}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "hero")} className="text-xs" />
            <input value={hero} onChange={(e) => setHero(e.target.value)} placeholder="…or paste a URL" className="mt-2 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-xs" />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-2">Demo video (mp4/webm)</div>
            {video && <video src={video} className="w-full max-h-48 rounded-lg mb-2" controls />}
            <input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "video")} className="text-xs" />
            <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="…or paste a URL" className="mt-2 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-xs" />
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5 space-y-3">
        <h3 className="font-display text-lg">Copy</h3>
        <p className="text-xs text-white/50">Any field left blank falls back to the original homepage copy.</p>
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">{f.label}</span>
            {f.multiline ? (
              <textarea
                value={content[f.key] ?? ""}
                onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                rows={2}
                className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm"
              />
            ) : (
              <input
                value={content[f.key] ?? ""}
                onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm"
              />
            )}
          </label>
        ))}
      </GlassPanel>

      <GlassPanel className="p-5 space-y-3">
        <h3 className="font-display text-lg">Repeating sections</h3>
        <p className="text-xs text-white/50">Paste a JSON array. Leave blank to use the defaults baked into the page. Invalid JSON blocks save.</p>
        {LIST_FIELDS.map((f) => {
          const current = content[f.key];
          const text = typeof current === "string" ? current : current ? JSON.stringify(current, null, 2) : "";
          return (
            <label key={f.key} className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">{f.label}</span>
              <textarea
                value={text}
                onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                rows={5}
                placeholder={f.hint}
                className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-xs font-mono"
              />
            </label>
          );
        })}
      </GlassPanel>

      <GlassPanel className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Pricing & monetization</h3>
          <button onClick={savePricing} disabled={busy || !price} className="px-3 py-1.5 rounded-lg bg-purple-500/30 hover:bg-purple-500/40 text-sm">Save pricing</button>
        </div>
        {price && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <NumField label="Founder $/mo (cents)" v={price.founder_price_monthly} on={(v) => setPrice({ ...price, founder_price_monthly: v })} />
            <NumField label="Founder seats remaining" v={price.founder_seats_remaining} on={(v) => setPrice({ ...price, founder_seats_remaining: v })} />
            <BoolField label="Founder active" v={price.founder_active} on={(v) => setPrice({ ...price, founder_active: v })} />
            <NumField label="Pro $/mo (cents)" v={price.pro_price_monthly} on={(v) => setPrice({ ...price, pro_price_monthly: v })} />
            <NumField label="Pro $/yr (cents)" v={price.pro_price_annual} on={(v) => setPrice({ ...price, pro_price_annual: v })} />
            <NumField label="Team $/mo (cents)" v={price.team_price_monthly} on={(v) => setPrice({ ...price, team_price_monthly: v })} />
            <NumField label="Team $/yr (cents)" v={price.team_price_annual} on={(v) => setPrice({ ...price, team_price_annual: v })} />
            <NumField label="Discount %" v={price.discount_percent} on={(v) => setPrice({ ...price, discount_percent: v })} />
            <BoolField label="Standard seat active" v={price.standard_seat_active} on={(v) => setPrice({ ...price, standard_seat_active: v })} />
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function NumField({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-white/45 font-mono">{label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => on(Number(e.target.value))}
        className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm"
      />
    </label>
  );
}
function BoolField({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
      <span className="text-[10px] uppercase tracking-wide text-white/45 font-mono">{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} />
    </label>
  );
}
