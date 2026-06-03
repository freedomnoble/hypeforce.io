import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Wand2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateCustomTheme, type ThemeTokens } from "@/lib/custom-theme.functions";
import { useTheme } from "./theme-provider";

type Step = "prompt" | "preview";

export function CustomThemeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const generate = useServerFn(generateCustomTheme);
  const { previewTokens, saveCustomTheme, setTheme } = useTheme();
  const [step, setStep] = useState<Step>("prompt");
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<ThemeTokens | null>(null);

  // Reset on close, clear preview
  useEffect(() => {
    if (!open) {
      previewTokens(null);
      setStep("prompt");
      setTokens(null);
      setLoading(false);
    }
  }, [open, previewTokens]);

  const runGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the vibe first");
      return;
    }
    setLoading(true);
    try {
      const result = await generate({ data: { prompt: prompt.trim() } });
      setTokens(result.tokens);
      if (!name) setName(result.name);
      previewTokens(result.tokens);
      setStep("preview");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate theme");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!tokens) return;
    const finalName = name.trim() || "Custom Theme";
    const saved = await saveCustomTheme(finalName, prompt.trim(), tokens);
    if (!saved) {
      toast.error("Couldn't save theme — are you signed in?");
      return;
    }
    previewTokens(null);
    setTheme(`custom:${saved.id}`);
    toast.success(`"${saved.name}" applied & saved`);
    onOpenChange(false);
  };

  const swatchKeys: { key: keyof ThemeTokens; label: string }[] = [
    { key: "background", label: "Bg" },
    { key: "panel", label: "Panel" },
    { key: "primary", label: "Primary" },
    { key: "accent", label: "Accent" },
    { key: "foreground", label: "Ink" },
    { key: "muted-foreground", label: "Muted" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            {step === "prompt" ? "Describe your theme" : "Preview your theme"}
          </DialogTitle>
          <DialogDescription>
            {step === "prompt"
              ? "Tell the AI the colors, mood, or inspiration you want."
              : "Tweak the name, then apply & save — or regenerate."}
          </DialogDescription>
        </DialogHeader>

        {step === "prompt" ? (
          <div className="space-y-4">
            <Textarea
              autoFocus
              rows={4}
              placeholder="e.g. moody synthwave purple with neon pink accents, like a Miami sunset at midnight"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={runGenerate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Theme name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-6 gap-2">
              {tokens &&
                swatchKeys.map(({ key, label }) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <div
                      className="w-full aspect-square rounded-md border border-border"
                      style={{ background: tokens[key] as string }}
                    />
                    <span className="text-[10px] text-muted-foreground truncate">{label}</span>
                  </div>
                ))}
            </div>

            <p className="text-xs text-muted-foreground italic">
              Live preview is active behind this dialog.
            </p>

            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  previewTokens(null);
                  setStep("prompt");
                }}
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Tweak prompt
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={runGenerate} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" /> Regenerate
                    </>
                  )}
                </Button>
                <Button onClick={apply} disabled={loading || !tokens}>
                  Apply & save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
