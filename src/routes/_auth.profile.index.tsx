import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useEffect, useState, lazy } from "react";
const InfiniteGridBg = lazy(() =>
  import("@/components/hypeforce/infinite-grid-bg").then((m) => ({ default: m.InfiniteGridBg })),
);
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateMascotAvatar } from "@/lib/avatar.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Mic, Loader2, Sparkles, Plug, CreditCard, Coins } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_AVATAR_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/_auth/profile/")({
  head: () => ({ meta: [{ title: "Profile — Hypeforce" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const generateAvatar = useServerFn(generateMascotAvatar);

  const handleAvatarFile = async (file: File) => {
    if (!userId || generating) return;
    if (!ALLOWED_AVATAR_MIME.includes(file.type)) {
      return toast.error("Please upload a PNG, JPEG, or WebP image.");
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return toast.error("Image is too large (max 8MB).");
    }
    setGenerating(true);
    const toastId = toast.loading("Creating your mascot avatar…");
    try {
      const sourceDataUrl = await fileToDataUrl(file);
      const { avatarUrl: newUrl } = await generateAvatar({
        data: { sourceDataUrl, mimeType: file.type as "image/png", byteLength: file.size },
      });
      setAvatarUrl(newUrl);
      toast.success("Mascot avatar ready!", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (p) {
        setDisplayName(p.display_name ?? "");
        setBio(p.bio ?? "");
        setAvatarUrl(p.avatar_url);
        setVoiceUrl(p.voice_sample_url);
      }
      setLoading(false);
    })();
  }, []);

  const uploadFile = async (
    file: File,
    bucket: "avatars" | "voice-samples",
    field: "avatar_url" | "voice_sample_url"
  ) => {
    if (!userId) return;
    const ext = file.name.split(".").pop();
    const path = `${userId}/${field}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    let publicUrl = path;
    if (bucket === "avatars") {
      publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } else {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
      publicUrl = data?.signedUrl ?? path;
    }
    if (field === "avatar_url") setAvatarUrl(publicUrl);
    else setVoiceUrl(publicUrl);
    await supabase.from("profiles").update({ [field]: publicUrl } as any).eq("id", userId);
    toast.success("Uploaded");
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, bio, email }).eq("id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-mono">loading…</div>;

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-2xl mx-auto relative">
      <ClientOnly fallback={null}><InfiniteGridBg interactive /></ClientOnly>
      <Link to="/" className="relative z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to workspace
      </Link>

      <div className="glass-strong rounded-3xl p-6 md:p-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Your profile</h1>
          <p className="text-sm text-muted-foreground">How you appear to teammates and agents.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20 ring-2 ring-border">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="text-xl font-display">{displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
            </Avatar>
            {generating && (
              <div className="absolute inset-0 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background/30 hover:bg-background/60 text-sm ${generating ? "opacity-50 pointer-events-none" : ""}`}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Creating mascot…" : "Upload photo → mascot"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={generating}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">We turn your photo into a retro mascot avatar.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="One line about you" />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <Label>Voice sample</Label>
          <p className="text-xs text-muted-foreground">Agents will use this to mimic your tone in future replies.</p>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background/30 hover:bg-background/60 text-sm">
              <Mic className="w-4 h-4" /> Upload voice
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "voice-samples", "voice_sample_url")}
              />
            </label>
            {voiceUrl && <span className="text-xs font-mono text-mint">● uploaded</span>}
          </div>
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          <Link
            to="/profile/billing"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/40 transition-colors"
          >
            <CreditCard className="w-4 h-4 text-electric" />
            <div className="flex-1">
              <div className="text-sm font-medium">Subscription &amp; billing</div>
              <div className="text-xs text-muted-foreground">
                Manage your plan, cancel, or update your payment method.
              </div>
            </div>
            <span className="text-muted-foreground">→</span>
          </Link>
          <Link
            to="/profile/credits"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/40 transition-colors"
          >
            <Coins className="w-4 h-4 text-electric" />
            <div className="flex-1">
              <div className="text-sm font-medium">Credits</div>
              <div className="text-xs text-muted-foreground">
                Check your balance, history, or buy a top-up.
              </div>
            </div>
            <span className="text-muted-foreground">→</span>
          </Link>
          <Link
            to="/profile/connections"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/40 transition-colors"
          >
            <Plug className="w-4 h-4 text-electric" />
            <div className="flex-1">
              <div className="text-sm font-medium">AI Connections</div>
              <div className="text-xs text-muted-foreground">
                Bring your own OpenAI, Anthropic, Google, or Manus key.
              </div>
            </div>
            <span className="text-muted-foreground">→</span>
          </Link>
        </div>


        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
