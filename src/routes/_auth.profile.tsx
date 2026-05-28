import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Upload, Mic } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/profile")({
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
    await supabase.from("profiles").update({ [field]: publicUrl }).eq("id", userId);
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
    <div className="min-h-screen p-6 md:p-10 max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to workspace
      </Link>

      <div className="glass-strong rounded-3xl p-6 md:p-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Your profile</h1>
          <p className="text-sm text-muted-foreground">How you appear to teammates and agents.</p>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20 ring-2 ring-border">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-xl font-display">{displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background/30 hover:bg-background/60 text-sm">
            <Upload className="w-4 h-4" /> Upload photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "avatars", "avatar_url")}
            />
          </label>
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

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
