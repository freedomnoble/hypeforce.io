import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  onWorkspaceUpdated,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialSection?: Section;
  onWorkspaceUpdated?: (workspace: { id: string; name: string }) => void;
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
      onWorkspaceUpdated?.({ id: workspace.id, name });
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

type ProviderId = "openai" | "anthropic" | "google" | "manus";
type RouteId = "lovable" | `byok:${ProviderId}`;

type ModelOption = {
  id: string;
  label: string;
  hint: string;
  image?: boolean;
};

const LOVABLE_MODELS: ModelOption[] = [
  { id: "openai/gpt-5-mini", label: "GPT-5 mini", hint: "Fast & cheap generalist. Good default." },
  { id: "openai/gpt-5", label: "GPT-5", hint: "Best OpenAI reasoning. Slower / more credits." },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano", hint: "Cheapest OpenAI. High-volume / simple tasks." },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)", hint: "Newest Gemini. Fast multimodal." },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Balanced speed + quality." },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Best Gemini for complex reasoning." },
  { id: "google/gemini-2.5-flash-image", label: "Nano Banana (image)", hint: "Replies with a generated image.", image: true },
];

const BYOK_MODELS: Record<ProviderId, ModelOption[]> = {
  openai: [
    { id: "gpt-5-mini", label: "GPT-5 mini", hint: "Fast & cheap." },
    { id: "gpt-5", label: "GPT-5", hint: "Best reasoning." },
    { id: "gpt-4o-mini", label: "GPT-4o mini", hint: "Older, very cheap." },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", hint: "Long-form reasoning." },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", hint: "Faster, cheaper Claude." },
  ],
  google: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Balanced." },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Best Gemini reasoning." },
    { id: "gemini-2.5-flash-image", label: "Nano Banana (image)", hint: "Image replies.", image: true },
  ],
  manus: [],
};

const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  manus: "Manus",
};

function isImageModel(modelId: string): boolean {
  return modelId.endsWith("-image") || modelId.includes("image-preview");
}

function providerFromModel(modelId: string, route: RouteId): ProviderId {
  if (route !== "lovable") return route.slice("byok:".length) as ProviderId;
  if (modelId.startsWith("openai/")) return "openai";
  if (modelId.startsWith("google/")) return "google";
  return "openai";
}

function slugifyHandle(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

type AgentDraft = {
  name: string;
  handle: string;
  description: string;
  system_prompt: string;
  route: RouteId;
  model: string;
};

const EMPTY_DRAFT: AgentDraft = {
  name: "",
  handle: "",
  description: "",
  system_prompt: "",
  route: "lovable",
  model: "openai/gpt-5-mini",
};

function AgentDialog({
  open,
  onOpenChange,
  initial,
  connectedProviders,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: AgentDraft;
  connectedProviders: ProviderId[];
  onSave: (draft: AgentDraft) => Promise<void>;
  saving: boolean;
}) {
  const isEdit = !!initial.handle && initial.handle === initial.handle;
  const [draft, setDraft] = useState<AgentDraft>(initial);
  const [handleEdited, setHandleEdited] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setHandleEdited(!!initial.handle);
    }
  }, [open, initial]);

  const editing = !!initial.name && open && initial === initial && initial.handle !== "";

  const setRoute = (r: RouteId) => {
    const models = r === "lovable" ? LOVABLE_MODELS : BYOK_MODELS[r.slice(5) as ProviderId];
    const first = models[0]?.id ?? "";
    setDraft((d) => ({ ...d, route: r, model: first }));
  };

  const models = draft.route === "lovable"
    ? LOVABLE_MODELS
    : BYOK_MODELS[draft.route.slice(5) as ProviderId] ?? [];

  const submit = async () => {
    if (!draft.name.trim()) return toast.error("Name required");
    const handle = draft.handle || slugifyHandle(draft.name);
    if (!/^[a-z0-9_-]+$/.test(handle)) {
      return toast.error("Handle must be lowercase letters, numbers, _ or -");
    }
    if (!draft.model) return toast.error("Pick a model");
    await onSave({ ...draft, handle });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit teammate" : "New teammate"}</DialogTitle>
          <DialogDescription>
            Give them a name, a role, and the model they think with. Spin up two agents on the same
            model with different prompts to make specialists (e.g. Strategist + Copywriter).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    name,
                    handle: handleEdited ? d.handle : slugifyHandle(name),
                  }));
                }}
                placeholder="Strategist"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-handle">Handle</Label>
              <Input
                id="agent-handle"
                value={draft.handle}
                onChange={(e) => {
                  setHandleEdited(true);
                  setDraft((d) => ({ ...d, handle: e.target.value.toLowerCase() }));
                }}
                placeholder="strategist"
                disabled={editing}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-role">Role</Label>
            <Input
              id="agent-role"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value.slice(0, 120) }))}
              placeholder="Brand strategist & positioning"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-prompt">System prompt</Label>
            <Textarea
              id="agent-prompt"
              rows={4}
              value={draft.system_prompt}
              onChange={(e) => setDraft((d) => ({ ...d, system_prompt: e.target.value }))}
              placeholder="You are a sharp brand strategist. Cut through fluff. Ask the one question that reframes the problem."
            />
          </div>

          <div className="space-y-2">
            <Label>Route</Label>
            <RadioGroup
              value={draft.route}
              onValueChange={(v) => setRoute(v as RouteId)}
              className="space-y-1.5"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="lovable" id="route-lovable" />
                <span>Lovable AI Gateway <span className="text-muted-foreground">— no key needed</span></span>
              </label>
              {(Object.keys(BYOK_MODELS) as ProviderId[]).map((p) => {
                const connected = connectedProviders.includes(p);
                const noModels = BYOK_MODELS[p].length === 0;
                const disabled = !connected || noModels;
                return (
                  <label
                    key={p}
                    className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <RadioGroupItem value={`byok:${p}`} id={`route-${p}`} disabled={disabled} />
                    <span>
                      My {PROVIDER_LABEL[p]} key
                      {!connected && (
                        <span className="text-muted-foreground"> — connect in Profile → AI Connections</span>
                      )}
                      {noModels && connected && (
                        <span className="text-muted-foreground"> — direct API not wired yet</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-model">Model</Label>
            <Select value={draft.model} onValueChange={(v) => setDraft((d) => ({ ...d, model: v }))}>
              <SelectTrigger id="agent-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex flex-col">
                      <span>{m.label}{m.image ? " · 🎨" : ""}</span>
                      <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isImageModel(draft.model) && (
              <p className="text-[11px] text-muted-foreground">
                Image model — this agent will reply with a generated picture instead of text.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {editing ? "Save" : "Add teammate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentsPanel({ workspaceId }: { workspaceId: string }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [myConns, setMyConns] = useState<ProviderId[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const listConns = useServerFn(listMyConnections);
  const setRouteFn = useServerFn(setAgentRoute);

  const load = async () => {
    const { data } = await supabase
      .from("agents")
      .select("id,name,handle,provider,model,preferred_route,avatar_url,description,system_prompt")
      .eq("workspace_id", workspaceId)
      .order("name");
    setAgents(data ?? []);
  };
  useEffect(() => {
    load();
    listConns()
      .then((d: any) =>
        setMyConns(
          (d ?? [])
            .filter((c: any) => c.status === "active")
            .map((c: any) => c.provider as ProviderId),
        ),
      )
      .catch(() => {});
  }, [workspaceId]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setDialogOpen(true);
  };

  const initial: AgentDraft = editing
    ? {
        name: editing.name ?? "",
        handle: editing.handle ?? "",
        description: editing.description ?? "",
        system_prompt: editing.system_prompt ?? "",
        route: (editing.preferred_route ?? "lovable") as RouteId,
        model: editing.model || "openai/gpt-5-mini",
      }
    : EMPTY_DRAFT;

  const save = async (draft: AgentDraft) => {
    setSaving(true);
    try {
      const provider = providerFromModel(draft.model, draft.route);
      if (editing) {
        const { error } = await supabase
          .from("agents")
          .update({
            name: draft.name,
            description: draft.description || null,
            system_prompt: draft.system_prompt || `You are ${draft.name}.`,
            model: draft.model,
            provider,
          })
          .eq("id", editing.id);
        if (error) throw new Error(error.message);
        if ((editing.preferred_route ?? "lovable") !== draft.route) {
          await setRouteFn({ data: { agent_id: editing.id, route: draft.route } });
        }
        toast.success("Teammate updated");
      } else {
        const { data: inserted, error } = await supabase
          .from("agents")
          .insert({
            workspace_id: workspaceId,
            name: draft.name,
            handle: draft.handle,
            provider,
            model: draft.model,
            description: draft.description || null,
            system_prompt: draft.system_prompt || `You are ${draft.name}.`,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        if (draft.route !== "lovable" && inserted?.id) {
          await setRouteFn({ data: { agent_id: inserted.id, route: draft.route } });
        }
        toast.success("Teammate added");
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
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
          <h2 className="font-display text-xl font-semibold">Workspace teammates</h2>
          <p className="text-sm text-muted-foreground">
            Each teammate is an AI persona with its own role, model, and route. Use the Lovable
            gateway out of the box, or bring your own key in Profile → AI Connections.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" /> New teammate
        </Button>
      </header>

      <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
        {agents.length === 0 && (
          <li className="p-6 text-sm text-muted-foreground text-center">No teammates yet.</li>
        )}
        {agents.map((a) => {
          const route: RouteId = (a.preferred_route ?? "lovable") as RouteId;
          const routeLabel =
            route === "lovable"
              ? "Lovable Gateway"
              : `My ${PROVIDER_LABEL[route.slice(5) as ProviderId] ?? route.slice(5)} key`;
          return (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <Avatar className="w-9 h-9">
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
                <div className="text-[11px] text-muted-foreground truncate">
                  {a.description || a.system_prompt?.slice(0, 80) || "—"}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                  {a.model || a.provider} · {routeLabel}
                  {a.model && isImageModel(a.model) ? " · 🎨" : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => openEdit(a)}
                aria-label="Edit teammate"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeAgent(a.id)}
                aria-label="Remove teammate"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <AgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={initial}
        connectedProviders={myConns}
        onSave={save}
        saving={saving}
      />
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
  const { theme, appliedTheme, setTheme, customThemes, deleteCustomTheme, themesEnabled, customThemesEnabled } = useTheme();
  // Highlight whatever is *actually rendered* so the picker can never desync
  // from the page (e.g. when the user is on a route that inherits the CMS
  // landing theme and hasn't picked their own yet).
  const selectedThemeId = appliedTheme;

  const [dialogOpen, setDialogOpen] = useState(false);

  const share = async (id: string, name: string, tokens: any) => {
    try {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ n: name, t: tokens }))));
      const url = `${window.location.origin}/theme/import?d=${payload}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  if (!themesEnabled) {
    return (
      <div className="space-y-5">
        <header>
          <h2 className="font-display text-xl font-semibold">Themes</h2>
          <p className="text-sm text-muted-foreground">
            Only colors change — every feature and layout stays the same.
          </p>
        </header>
        <div className="rounded-2xl border border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
          Theming is currently disabled. The default Blueprint theme is the only option available.
        </div>
      </div>
    );
  }

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
          const active = t.id === selectedThemeId;
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

        {customThemesEnabled && customThemes.map((c) => {
          const id = `custom:${c.id}`;
          const active = id === selectedThemeId;
          const swatchKeys = ["background", "panel", "primary", "accent"] as const;
          return (
            <div
              key={c.id}
              className={`relative rounded-2xl border p-4 transition-all ${
                active
                  ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/30"
              }`}
            >
              <button onClick={() => setTheme(id)} className="text-left w-full">
                <div className="flex items-center justify-between mb-3 pr-14">
                  <div className="font-display font-semibold truncate">{c.name}</div>
                  {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                </div>
                <div className="flex gap-1.5 mb-3">
                  {swatchKeys.map((k) => (
                    <span
                      key={k}
                      className="w-7 h-7 rounded-md border border-border"
                      style={{ background: (c.tokens as any)[k] }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {c.prompt || "AI-generated theme"}
                </p>
              </button>
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    share(c.id, c.name, c.tokens);
                  }}
                  className="p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition"
                  title="Copy share link"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${c.name}"?`)) deleteCustomTheme(c.id);
                  }}
                  className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                  title="Delete theme"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {customThemesEnabled && (
          <button
            onClick={() => setDialogOpen(true)}
            className="text-left rounded-2xl border border-dashed border-border hover:border-primary/60 hover:bg-primary/5 p-4 transition-all min-h-[140px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Wand2 className="w-6 h-6" />
            <div className="font-display font-semibold">Custom Generated</div>
            <p className="text-xs text-center">Describe a vibe — AI builds the palette.</p>
          </button>
        )}
      </div>

      <CustomThemeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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
