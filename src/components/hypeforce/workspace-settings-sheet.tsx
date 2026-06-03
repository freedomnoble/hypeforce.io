import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Bot,
  BookOpen,
  Sparkles,
  Palette,
  User as UserIcon,
  Loader2,
  Upload,
  Trash2,
  Plus,
  Mail,
  Check,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { THEMES, useTheme, type ThemeId } from "./theme-provider";
import { CustomThemeDialog } from "./custom-theme-dialog";
import { Share2, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyConnections,
  setAgentRoute,
} from "@/lib/ai-connections.functions";
import { renameWorkspace } from "@/lib/collab.functions";

type Section = "members" | "agents" | "knowledge" | "brand" | "themes" | "profile";

const SECTIONS: { id: Section; label: string; icon: any }[] = [
  { id: "members", label: "Members", icon: Users },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "brand", label: "Brand & Voice", icon: Sparkles },
  { id: "themes", label: "Themes", icon: Palette },
  { id: "profile", label: "My Profile", icon: UserIcon },
];

export function WorkspaceSettingsSheet({
  workspaceId,
  open,
  onOpenChange,
  initialSection = "members",
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [workspace, setWorkspace] = useState<any>(null);
  const renameWorkspaceFn = useServerFn(renameWorkspace);

  useEffect(() => {
    if (!open) return;
    setSection(initialSection);
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .maybeSingle();
      setWorkspace(data);
    })();
  }, [open, workspaceId, initialSection]);

  const handleRename = async () => {
    if (!workspace) return;
    const next = prompt("Rename workspace", workspace.name);
    const trimmed = next?.trim();
    if (!trimmed || trimmed === workspace.name) return;
    try {
      const { name } = await renameWorkspaceFn({
        data: { workspaceId: workspace.id, name: trimmed },
      });
      setWorkspace((w: any) => (w ? { ...w, name } : w));
      toast.success("Workspace renamed");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't rename workspace");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl p-0 overflow-hidden flex flex-col paper-panel"
      >
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-electric" />
            <SheetTitle className="font-display text-xl">
              {workspace?.name ?? "Workspace"} — Settings
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Rename workspace"
              onClick={handleRename}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>
          <SheetDescription className="text-xs font-mono uppercase tracking-wider">
            Admin Console
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex min-h-0">
          <nav className="w-56 border-r border-border p-3 space-y-1 flex-shrink-0">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  section === s.id
                    ? "bg-primary/15 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {section === "members" && <MembersPanel workspaceId={workspaceId} />}
            {section === "agents" && <AgentsPanel workspaceId={workspaceId} />}
            {section === "knowledge" && <KnowledgePanel workspaceId={workspaceId} />}
            {section === "brand" && (
              <BrandPanel workspaceId={workspaceId} initial={workspace?.brand_voice ?? ""} />
            )}
            {section === "themes" && <ThemesPanel />}
            {section === "profile" && <ProfilePanel />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ============== MEMBERS ============== */
function MembersPanel({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("workspace_members")
      .select("user_id,role,created_at")
      .eq("workspace_id", workspaceId);
    const userIds = (data ?? []).map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("*").in("id", userIds)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setMembers(
      (data ?? []).map((m: any) => ({ ...m, profile: map.get(m.user_id) })),
    );
  };

  useEffect(() => {
    load();
  }, [workspaceId]);

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!existing) {
      toast.error(`No user with ${email} found. They must sign up first.`);
      return;
    }
    const { error } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: workspaceId, user_id: existing.id, role: "member" });
    if (error) return toast.error(error.message);
    toast.success(`Added ${email}`);
    setInviteEmail("");
    load();
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-xl font-semibold">Workspace members</h2>
        <p className="text-sm text-muted-foreground">
          Control who is allowed in this workspace and their permission level.
        </p>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="email@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            className="pl-8"
          />
        </div>
        <Button onClick={invite} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add member
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 p-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={m.profile?.avatar_url ?? undefined} />
              <AvatarFallback>
                <UserIcon className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {m.profile?.display_name ?? m.profile?.email ?? m.user_id}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground truncate">
                {m.profile?.email}
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border border-border bg-primary/10">
              {m.role}
            </span>
            {m.role !== "owner" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeMember(m.user_id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============== AGENTS ============== */
function AgentsPanel({ workspaceId }: { workspaceId: string }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [myConns, setMyConns] = useState<string[]>([]);
  const listConns = useServerFn(listMyConnections);
  const setRouteFn = useServerFn(setAgentRoute);

  const load = async () => {
    const { data } = await supabase
      .from("agents")
      .select("id,name,handle,provider,preferred_route,avatar_url,description")
      .eq("workspace_id", workspaceId)
      .order("name");
    setAgents(data ?? []);
  };
  useEffect(() => {
    load();
    listConns()
      .then((d: any) =>
        setMyConns((d ?? []).filter((c: any) => c.status === "active").map((c: any) => c.provider)),
      )
      .catch(() => {});
  }, [workspaceId]);

  const addAgent = async () => {
    const name = prompt("Agent name (e.g. Manus)");
    if (!name) return;
    const handle = prompt("Handle (e.g. manus)")?.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!handle) return;
    const provider = prompt("Provider: openai | anthropic | google | manus", "openai");
    if (!provider) return;
    const allowed = ["openai", "anthropic", "google", "manus"] as const;
    if (!(allowed as readonly string[]).includes(provider)) {
      return toast.error("Invalid provider");
    }
    const { error } = await supabase.from("agents").insert({
      workspace_id: workspaceId,
      name,
      handle,
      provider: provider as (typeof allowed)[number],
      model: "",
      system_prompt: `You are ${name}.`,
    });
    if (error) return toast.error(error.message);
    toast.success("Agent added");
    load();
  };

  const removeAgent = async (id: string) => {
    if (!confirm("Remove this agent from workspace?")) return;
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Workspace agents</h2>
          <p className="text-sm text-muted-foreground">
            Add personal or shared agents and choose how each one reaches its model.
          </p>
        </div>
        <Button onClick={addAgent} className="gap-1.5">
          <Plus className="w-4 h-4" /> New agent
        </Button>
      </header>

      <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
        {agents.length === 0 && (
          <li className="p-6 text-sm text-muted-foreground text-center">No agents yet.</li>
        )}
        {agents.map((a) => {
          const current = a.preferred_route ?? "lovable";
          return (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={a.avatar_url ?? undefined} />
                <AvatarFallback>
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {a.name}{" "}
                  <span className="font-mono text-[11px] text-muted-foreground">@{a.handle}</span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">
                  {a.provider}
                </div>
              </div>
              <Select
                value={current}
                onValueChange={async (v) => {
                  try {
                    await setRouteFn({ data: { agent_id: a.id, route: v } });
                    toast.success("Route updated");
                    load();
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed");
                  }
                }}
              >
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable AI Gateway</SelectItem>
                  {(["openai", "anthropic", "google", "manus"] as const).map((p) => (
                    <SelectItem key={p} value={`byok:${p}`} disabled={!myConns.includes(p)}>
                      My {p} key{!myConns.includes(p) ? " (not connected)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeAgent(a.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============== KNOWLEDGE ============== */
function KnowledgePanel({ workspaceId }: { workspaceId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("knowledge_base")
      .select("id,title,body,kind,file_id,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
  };
  useEffect(() => {
    load();
  }, [workspaceId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setUploading(false);
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} too large (20MB max)`);
        continue;
      }
      const path = `${u.user.id}/${workspaceId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("knowledge")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        toast.error(upErr.message);
        continue;
      }
      let content_text: string | null = null;
      if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) {
        content_text = (await file.text()).slice(0, 100_000);
      }
      const { data: fileRow } = await supabase
        .from("files")
        .insert({
          workspace_id: workspaceId,
          uploader_id: u.user.id,
          bucket: "knowledge",
          path,
          filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          scope: "knowledge",
          content_text,
        })
        .select()
        .single();
      await supabase.from("knowledge_base").insert({
        workspace_id: workspaceId,
        title: file.name,
        kind: "brief",
        body: content_text,
        file_id: fileRow?.id,
        created_by: u.user.id,
      });
    }
    setUploading(false);
    toast.success("Knowledge updated");
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this knowledge entry?")) return;
    await supabase.from("knowledge_base").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-xl font-semibold">Knowledge base</h2>
        <p className="text-sm text-muted-foreground">
          Briefs, voice samples, and reference docs injected into every agent reply.
        </p>
      </header>
      <label
        className={`block border-2 border-dashed border-border rounded-2xl p-6 text-center cursor-pointer hover:border-primary/50 transition ${
          uploading ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => upload(e.target.files)}
        />
        <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
        <div className="text-sm">{uploading ? "Uploading…" : "Click or drop files"}</div>
        <div className="text-[11px] font-mono text-muted-foreground mt-1">Max 20MB</div>
      </label>
      <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
        {entries.length === 0 && (
          <li className="p-6 text-sm text-muted-foreground text-center">No documents yet.</li>
        )}
        {entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 p-3">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{e.title}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {e.body ? "text extracted" : "stored"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(e.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============== BRAND ============== */
function BrandPanel({ workspaceId, initial }: { workspaceId: string; initial: string }) {
  const [name, setName] = useState("");
  const [voice, setVoice] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVoice(initial);
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", workspaceId)
        .maybeSingle();
      setName(data?.name ?? "");
    })();
  }, [workspaceId, initial]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name, brand_voice: voice })
      .eq("id", workspaceId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Workspace updated");
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-xl font-semibold">Brand & voice</h2>
        <p className="text-sm text-muted-foreground">
          Workspace name and guidelines prepended to every agent reply.
        </p>
      </header>
      <div className="space-y-2">
        <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Workspace name
        </label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Brand voice & guidelines
        </label>
        <Textarea
          rows={12}
          value={voice}
          onChange={(e) => setVoice(e.target.value.slice(0, 8000))}
          className="font-mono text-sm"
          placeholder="Voice: confident, warm, plain English. Avoid jargon…"
        />
        <div className="text-[11px] font-mono text-muted-foreground text-right">
          {voice.length}/8000
        </div>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
        Save changes
      </Button>
    </div>
  );
}

/* ============== THEMES ============== */
function ThemesPanel() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-xl font-semibold">Themes</h2>
        <p className="text-sm text-muted-foreground">
          Only colors change — every feature and layout stays the same.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as ThemeId)}
              className={`text-left rounded-2xl border p-4 transition-all ${
                active
                  ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-display font-semibold">{t.name}</div>
                {active && <Check className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex gap-1.5 mb-3">
                {t.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="w-7 h-7 rounded-md border border-border"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============== PROFILE ============== */
function ProfilePanel() {
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      setProfile(data);
      setDisplayName(data?.display_name ?? "");
    })();
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-xl font-semibold">My profile</h2>
        <p className="text-sm text-muted-foreground">How you appear to teammates and agents.</p>
      </header>
      <div className="flex items-center gap-3">
        <Avatar className="w-14 h-14">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback>
            <UserIcon className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="text-sm font-medium">{profile?.email}</div>
          <div className="text-[11px] font-mono text-muted-foreground">Signed in</div>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Display name
        </label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
        Save profile
      </Button>
    </div>
  );
}
