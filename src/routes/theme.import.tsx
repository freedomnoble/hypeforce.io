import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Wand2, Check } from "lucide-react";
import { useTheme } from "@/components/hypeforce/theme-provider";
import type { ThemeTokens } from "@/lib/custom-theme.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/theme/import")({
  component: ImportThemePage,
  head: () => ({
    meta: [
      { title: "Import shared theme — Hypeforce" },
      { name: "description", content: "Preview and save a shared Hypeforce theme." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    d: typeof s.d === "string" ? s.d : "",
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-destructive">Couldn't load shared theme: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div>Theme not found.</div>,
});

function ImportThemePage() {
  const { d } = Route.useSearch();
  const navigate = useNavigate();
  const { previewTokens, saveCustomTheme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [authed, setAuthed] = useState(false);

  const decoded = useMemo(() => {
    try {
      const json = decodeURIComponent(escape(atob(d)));
      const obj = JSON.parse(json) as { n?: string; t?: ThemeTokens };
      if (!obj.t || typeof obj.t !== "object") return null;
      return { name: obj.n ?? "Shared Theme", tokens: obj.t };
    } catch {
      return null;
    }
  }, [d]);

  useEffect(() => {
    if (decoded) {
      previewTokens(decoded.tokens);
      setName(decoded.name);
    }
    return () => previewTokens(null);
  }, [decoded, previewTokens]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  if (!decoded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-display font-semibold">Invalid theme link</h1>
          <p className="text-muted-foreground">This share link couldn't be decoded.</p>
          <Button onClick={() => navigate({ to: "/" })}>Go home</Button>
        </div>
      </div>
    );
  }

  const swatchKeys: { key: keyof ThemeTokens; label: string }[] = [
    { key: "background", label: "Background" },
    { key: "panel", label: "Panel" },
    { key: "primary", label: "Primary" },
    { key: "accent", label: "Accent" },
    { key: "foreground", label: "Ink" },
    { key: "muted-foreground", label: "Muted" },
  ];

  const save = async () => {
    if (!authed) {
      toast.error("Sign in to save this theme to your account");
      navigate({ to: "/login" });
      return;
    }
    const saved = await saveCustomTheme(name.trim() || "Shared Theme", "Imported from share link", decoded.tokens);
    if (!saved) {
      toast.error("Couldn't save theme");
      return;
    }
    previewTokens(null);
    setTheme(`custom:${saved.id}`);
    toast.success(`"${saved.name}" saved & applied`);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card/80 backdrop-blur p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Someone shared a theme</h1>
            <p className="text-sm text-muted-foreground">Live preview is active behind this card.</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Theme name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-6 gap-2">
          {swatchKeys.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <div
                className="w-full aspect-square rounded-md border border-border"
                style={{ background: decoded.tokens[key] as string }}
              />
              <span className="text-[10px] text-muted-foreground truncate">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => { previewTokens(null); navigate({ to: "/" }); }}>
            Cancel
          </Button>
          <Button onClick={save}>
            <Check className="w-4 h-4 mr-1" /> {authed ? "Save to my themes" : "Sign in to save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
