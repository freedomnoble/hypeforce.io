import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Hash,
  Plus,
  Settings,
  LogOut,
  Search,
  Bot,
  User as UserIcon,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import appIcon from "@/assets/app-icon.png";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}
export interface Channel {
  id: string;
  name: string;
  topic: string | null;
  is_pinned: boolean;
}
export interface Agent {
  id: string;
  name: string;
  handle: string;
  provider: string;
  avatar_url: string | null;
  description: string | null;
}
export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export function WorkspaceShell({
  workspaceId,
  activeChannelId,
  children,
}: {
  workspaceId: string;
  activeChannelId?: string;
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ws } = await supabase.from("workspaces").select("*").order("created_at");
      setWorkspaces(ws ?? []);
      setWorkspace((ws ?? []).find((w) => w.id === workspaceId) ?? null);

      const { data: ch } = await supabase
        .from("channels")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("is_pinned", { ascending: false })
        .order("name");
      setChannels(ch ?? []);

      const { data: ag } = await supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name");
      setAgents(ag ?? []);

      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        setProfile(p);
      }
    })();
  }, [workspaceId]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden p-0 sm:p-2 gap-0 sm:gap-2">
      {/* Far-left rail */}
      <aside className="hidden sm:flex w-16 flex-col items-center gap-3 py-4 glass rounded-2xl">

        <Link to="/" className="flex flex-col items-center">
          <img src={appIcon} alt="Hypeforce" className="w-10 h-10 rounded-xl ring-1 ring-border" />
        </Link>
        <div className="h-px w-8 bg-border my-1" />
        {workspaces.map((w) => (
          <Link
            key={w.id}
            to="/w/$workspaceId"
            params={{ workspaceId: w.id }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-display font-semibold transition-all ${
              w.id === workspaceId
                ? "bg-primary text-primary-foreground ring-glow"
                : "bg-secondary text-foreground/80 hover:bg-secondary/80"
            }`}
            title={w.name}
          >
            {w.name.slice(0, 2).toUpperCase()}
          </Link>
        ))}
        <button
          onClick={async () => {
            const name = prompt("New workspace name");
            if (!name) return;
            const { data: u } = await supabase.auth.getUser();
            if (!u.user) return;
            const slug = name.toLowerCase().replace(/\s+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
            const { data, error } = await supabase
              .from("workspaces")
              .insert({ name, slug, owner_id: u.user.id })
              .select()
              .single();
            if (error) return toast.error(error.message);
            await supabase.from("workspace_members").insert({ workspace_id: data.id, user_id: u.user.id, role: "owner" });
            navigate({ to: "/w/$workspaceId", params: { workspaceId: data.id } });
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60 text-muted-foreground hover:bg-secondary"
          title="New workspace"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <Link to="/profile" className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60 hover:bg-secondary">
          <Settings className="w-4 h-4" />
        </Link>
        <button onClick={signOut} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" />
        </button>
      </aside>

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col glass rounded-2xl overflow-hidden">

        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">workspace</div>
              <div className="font-display font-semibold text-lg">{workspace?.name ?? "…"}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input placeholder="Search" className="pl-8 h-9 bg-background/40" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4 space-y-5">
          <Section title="Channels" actionLabel="+ New" onAction={async () => {
            const name = prompt("Channel name (no spaces)");
            if (!name) return;
            const { data: u } = await supabase.auth.getUser();
            if (!u.user) return;
            const { data, error } = await supabase
              .from("channels")
              .insert({ workspace_id: workspaceId, name: name.toLowerCase().replace(/\s+/g, "-"), created_by: u.user.id })
              .select()
              .single();
            if (error) return toast.error(error.message);
            await supabase.from("channel_members").insert({ channel_id: data.id, member_type: "user", user_id: u.user.id });
            setChannels((cs) => [...cs, data]);
            navigate({ to: "/w/$workspaceId/c/$channelId", params: { workspaceId, channelId: data.id } });
          }}>
            {channels.map((c) => (
              <Link
                key={c.id}
                to="/w/$workspaceId/c/$channelId"
                params={{ workspaceId, channelId: c.id }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  c.id === activeChannelId ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span className="truncate">{c.name}</span>
                {c.is_pinned && <Sparkles className="w-3 h-3 text-electric ml-auto" />}
              </Link>
            ))}
          </Section>

          <Section title="Agents">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={a.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]"><Bot className="w-3 h-3" /></AvatarFallback>
                </Avatar>
                <span className="truncate">{a.name}</span>
                <span className="ml-auto text-[10px] font-mono text-mint">●</span>
              </div>
            ))}
          </Section>
        </div>

        <div className="border-t border-border p-3 flex items-center gap-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback><UserIcon className="w-4 h-4" /></AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{profile?.display_name ?? profile?.email ?? "You"}</div>
            <div className="text-[10px] font-mono text-mint">● online</div>
          </div>
          <Link to="/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="w-4 h-4" /></Button>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1">
        <div className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground">{title}</div>
        {actionLabel && (
          <button onClick={onAction} className="text-[11px] text-electric hover:underline font-mono">
            {actionLabel}
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
