import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  createWorkspaceWithOwner,
  createChannelWithMembership,
  createDmWithParticipants,
} from "@/lib/collab.functions";
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
  MessageSquare,
  X,
  HelpCircle,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import appIcon from "@/assets/app-icon.png";
import { ClientOnly } from "@tanstack/react-router";
import { lazy } from "react";
import { WorkspaceSettingsSheet } from "./workspace-settings-sheet";
import { AnimatedThemeToggler } from "./animated-theme-toggler";
import { SupportFlyout } from "./support-flyout";
import { AdminInboxFlyout } from "./admin-inbox-flyout";
import { useQuery } from "@tanstack/react-query";
import { getUnreadCount } from "@/lib/inbox.functions";
import { useTheme, themeHasModes } from "./theme-provider";
const InfiniteGridBg = lazy(() =>
  import("./infinite-grid-bg").then((m) => ({ default: m.InfiniteGridBg })),
);

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
export interface DirectMessage {
  id: string;
  title: string | null;
  participants: { user?: Profile | null; agent?: Agent | null }[];
}

type DmFilter = "all" | "agents" | "people" | "unread";

interface LastMessage {
  content: string;
  created_at: string;
  author_is_me: boolean;
}

const readKey = (dmId: string) => `hf:dm-read:${dmId}`;
const getReadAt = (dmId: string): string => {
  if (typeof window === "undefined") return "1970-01-01T00:00:00Z";
  return localStorage.getItem(readKey(dmId)) ?? "1970-01-01T00:00:00Z";
};
const markRead = (dmId: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(readKey(dmId), new Date().toISOString());
};

export function WorkspaceShell({
  workspaceId,
  activeChannelId,
  activeDmId,
  children,
}: {
  workspaceId: string;
  activeChannelId?: string;
  activeDmId?: string;
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const createWorkspaceFn = useServerFn(createWorkspaceWithOwner);
  const createChannelFn = useServerFn(createChannelWithMembership);
  const createDmFn = useServerFn(createDmWithParticipants);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const fetchUnread = useServerFn(getUnreadCount);
  const { data: unread } = useQuery({
    queryKey: ["admin-inbox-unread"],
    queryFn: () => fetchUnread(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = unread?.count ?? 0;
  const [lastByDm, setLastByDm] = useState<Record<string, LastMessage>>({});
  const [readVersion, setReadVersion] = useState(0); // bump to recompute unread counts
  const [dmQuery, setDmQuery] = useState("");
  const [dmFilter, setDmFilter] = useState<DmFilter>("all");
  const [pendingAgent, setPendingAgent] = useState<Agent | null>(null);
  const meIdRef = useRef<string | null>(null);

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
        meIdRef.current = u.user.id;
        const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        setProfile(p);
      }

      const { data: dmRows } = await supabase
        .from("direct_messages")
        .select("id,title,dm_participants(user_id,agent_id,member_type)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      const agentMap = new Map((ag ?? []).map((a) => [a.id, a]));
      const userIds = Array.from(
        new Set(
          (dmRows ?? []).flatMap((d: any) =>
            (d.dm_participants ?? [])
              .filter((p: any) => p.member_type === "user" && p.user_id)
              .map((p: any) => p.user_id),
          ),
        ),
      );
      const profilesMap = new Map<string, Profile>();
      if (userIds.length) {
        const { data: ps } = await supabase.from("profiles").select("*").in("id", userIds);
        (ps ?? []).forEach((p: any) => profilesMap.set(p.id, p));
      }
      const loadedDms = (dmRows ?? []).map((d: any) => ({
        id: d.id,
        title: d.title,
        participants: (d.dm_participants ?? []).map((p: any) => ({
          user: p.user_id ? profilesMap.get(p.user_id) ?? null : null,
          agent: p.agent_id ? agentMap.get(p.agent_id) ?? null : null,
        })),
      }));
      setDms(loadedDms);

      // Load last message per DM
      const dmIds = loadedDms.map((d) => d.id);
      if (dmIds.length) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("dm_id,content,created_at,author_user_id,author_type")
          .in("dm_id", dmIds)
          .order("created_at", { ascending: false })
          .limit(500);
        const byDm: Record<string, LastMessage> = {};
        const me = meIdRef.current;
        (msgs ?? []).forEach((m: any) => {
          if (!m.dm_id || byDm[m.dm_id]) return;
          byDm[m.dm_id] = {
            content: m.content ?? "",
            created_at: m.created_at,
            author_is_me: m.author_type === "user" && m.author_user_id === me,
          };
        });
        setLastByDm(byDm);
      }
    })();
  }, [workspaceId]);

  // Mark active DM as read when opened or when a new message lands in it.
  useEffect(() => {
    if (!activeDmId) return;
    markRead(activeDmId);
    setReadVersion((v) => v + 1);
  }, [activeDmId, lastByDm]);

  const dmByAgentId = useMemo(() => {
    const map = new Map<string, DirectMessage>();
    for (const d of dms) {
      if (
        d.participants.length === 2 &&
        d.participants.some((p) => p.user) &&
        d.participants.some((p) => p.agent)
      ) {
        const agent = d.participants.find((p) => p.agent)?.agent;
        if (agent && !map.has(agent.id)) map.set(agent.id, d);
      }
    }
    return map;
  }, [dms]);

  const unreadFor = (dmId: string | undefined): number => {
    void readVersion;
    if (!dmId) return 0;
    const last = lastByDm[dmId];
    if (!last || last.author_is_me) return 0;
    return last.created_at > getReadAt(dmId) ? 1 : 0;
  };

  const previewFor = (dmId: string | undefined): string => {
    if (!dmId) return "";
    const last = lastByDm[dmId];
    if (!last) return "";
    const prefix = last.author_is_me ? "You: " : "";
    return prefix + (last.content ?? "").replace(/\s+/g, " ").trim();
  };

  const groupDms = useMemo(
    () =>
      dms.filter((d) => {
        if (d.participants.length !== 2) return true;
        const hasAgent = d.participants.some((p) => p.agent);
        const hasUser = d.participants.some((p) => p.user);
        return !(hasAgent && hasUser);
      }),
    [dms],
  );

  const q = dmQuery.trim().toLowerCase();
  const matchesQuery = (hay: string) => !q || hay.toLowerCase().includes(q);

  const filteredAgents = agents.filter((a) => {
    if (dmFilter === "people") return false;
    const dmId = dmByAgentId.get(a.id)?.id;
    if (dmFilter === "unread" && unreadFor(dmId) === 0) return false;
    return matchesQuery(`${a.name} @${a.handle} ${previewFor(dmId)}`);
  });

  const filteredGroups = groupDms.filter((d) => {
    if (dmFilter === "agents") return false;
    if (dmFilter === "people") {
      const onlyPeople = d.participants.every((p) => p.user);
      if (!onlyPeople) return false;
    }
    if (dmFilter === "unread" && unreadFor(d.id) === 0) return false;
    const label =
      d.title ??
      d.participants
        .map((p) => (p.agent ? `@${p.agent.handle}` : p.user?.display_name ?? p.user?.email ?? ""))
        .join(", ");
    return matchesQuery(`${label} ${previewFor(d.id)}`);
  });

  const totalUnread =
    agents.reduce((n, a) => n + unreadFor(dmByAgentId.get(a.id)?.id), 0) +
    groupDms.reduce((n, d) => n + unreadFor(d.id), 0);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const startDmWithAgent = async (a: Agent) => {
    try {
      const { dm } = await createDmFn({
        data: {
          workspaceId,
          title: `@${a.handle}`,
          participants: [{ kind: "agent", agentId: a.id }],
        },
      });
      setDms((prev) => [
        {
          id: dm.id,
          title: dm.title,
          participants: [{ user: profile }, { agent: a }],
        },
        ...prev,
      ]);
      toast.success(`Started a conversation with @${a.handle}`);
      navigate({ to: "/w/$workspaceId/d/$dmId", params: { workspaceId, dmId: dm.id } });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create DM");
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden p-0 sm:p-2 gap-0 sm:gap-2 relative">
      <ClientOnly fallback={null}><InfiniteGridBg /></ClientOnly>
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
            try {
              const { workspaceId: newId } = await createWorkspaceFn({ data: { name } });
              navigate({ to: "/w/$workspaceId", params: { workspaceId: newId } });
            } catch (err: any) {
              toast.error(err?.message ?? "Couldn't create workspace");
            }
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60 text-muted-foreground hover:bg-secondary"
          title="New workspace"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        {themeHasModes(useTheme().theme) && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60 hover:bg-secondary"
            title="Toggle light/dark"
          >
            <AnimatedThemeToggler />
          </div>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60 hover:bg-secondary"
          title="Workspace settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={() => setInboxOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60 hover:bg-secondary relative"
          title="Inbox"
        >
          <Inbox className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-electric text-[10px] font-semibold text-background grid place-items-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSupportOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60 hover:bg-secondary"
          title="Get help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <button onClick={signOut} className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" />
        </button>
      </aside>

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col paper-panel rounded-2xl overflow-hidden">

        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">workspace</div>
              <div className="font-display font-semibold text-lg truncate">
                {workspace?.name ?? "…"}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </div>


        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4 space-y-5 pt-3">
          <Section title="Channels" actionLabel="+ New" onAction={async () => {
            const name = prompt("Channel name (no spaces)");
            if (!name) return;
            try {
              const { channel } = await createChannelFn({
                data: { workspaceId, name },
              });
              setChannels((cs) => [...cs, channel]);
              navigate({ to: "/w/$workspaceId/c/$channelId", params: { workspaceId, channelId: channel.id } });
            } catch (err: any) {
              toast.error(err?.message ?? "Couldn't create channel");
            }
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

          <Section
            title="Direct Messages"
            titleBadge={totalUnread > 0 ? totalUnread : undefined}
            actionLabel="+ Group"
            onAction={async () => {
              const handles = prompt(
                "Start a group DM. Enter agent @handles separated by commas (e.g. claude, gemini):",
              );
              if (!handles) return;
              const cleaned = handles
                .split(",")
                .map((h) => h.trim().replace(/^@/, "").toLowerCase())
                .filter(Boolean);
              const picked = agents.filter((a) => cleaned.includes(a.handle.toLowerCase()));
              if (picked.length === 0) return toast.error("No matching agents in this workspace.");
              try {
                const { dm } = await createDmFn({
                  data: {
                    workspaceId,
                    title: picked.map((a) => `@${a.handle}`).join(", "),
                    participants: picked.map((a) => ({ kind: "agent" as const, agentId: a.id })),
                  },
                });
                navigate({ to: "/w/$workspaceId/d/$dmId", params: { workspaceId, dmId: dm.id } });
              } catch (err: any) {
                toast.error(err?.message ?? "Failed to create DM");
              }
            }}
          >
            {/* Search + filters */}
            <div className="px-1 pb-2 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" />
                <Input
                  value={dmQuery}
                  onChange={(e) => setDmQuery(e.target.value)}
                  placeholder="Search agents & DMs"
                  className="pl-7 pr-7 h-8 text-xs bg-background/40"
                />
                {dmQuery && (
                  <button
                    onClick={() => setDmQuery("")}
                    className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {(
                  [
                    ["all", "All"],
                    ["unread", "Unread"],
                    ["agents", "Agents"],
                    ["people", "People"],
                  ] as [DmFilter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDmFilter(key)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider transition-colors ${
                      dmFilter === key
                        ? "bg-primary/20 text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Agents — clicking opens (or prompts to create) a 1:1 DM */}
            {filteredAgents.map((a) => {
              const existing = dmByAgentId.get(a.id);
              const dmId = existing?.id;
              const activeForAgent = dmId === activeDmId;
              const unread = unreadFor(dmId);
              const preview = previewFor(dmId);
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    if (existing) {
                      navigate({
                        to: "/w/$workspaceId/d/$dmId",
                        params: { workspaceId, dmId: existing.id },
                      });
                      return;
                    }
                    setPendingAgent(a);
                  }}
                  className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
                    activeForAgent
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <Avatar className="w-6 h-6 mt-0.5">
                    <AvatarImage src={a.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      <Bot className="w-3 h-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate ${unread ? "font-semibold text-foreground" : ""}`}>
                        @{a.handle}
                      </span>
                      {!existing && (
                        <span className="text-[9px] font-mono uppercase text-muted-foreground/60 ml-auto">
                          new
                        </span>
                      )}
                      {unread > 0 && (
                        <Badge className="ml-auto h-4 min-w-4 px-1 text-[10px] leading-none">
                          {unread}
                        </Badge>
                      )}
                    </div>
                    {preview && (
                      <div className="text-[11px] text-muted-foreground/80 truncate">
                        {preview}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Group / multi-participant DMs */}
            {filteredGroups.map((d) => {
              const label =
                d.title ??
                d.participants
                  .map((p) =>
                    p.agent
                      ? `@${p.agent.handle}`
                      : p.user?.display_name ?? p.user?.email ?? "?",
                  )
                  .join(", ");
              const unread = unreadFor(d.id);
              const preview = previewFor(d.id);
              return (
                <Link
                  key={d.id}
                  to="/w/$workspaceId/d/$dmId"
                  params={{ workspaceId, dmId: d.id }}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    d.id === activeDmId
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate ${unread ? "font-semibold text-foreground" : ""}`}>
                        {label}
                      </span>
                      {unread > 0 && (
                        <Badge className="ml-auto h-4 min-w-4 px-1 text-[10px] leading-none">
                          {unread}
                        </Badge>
                      )}
                    </div>
                    {preview && (
                      <div className="text-[11px] text-muted-foreground/80 truncate">
                        {preview}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}

            {filteredAgents.length === 0 && filteredGroups.length === 0 && (
              <div className="px-2 py-2 text-[11px] text-muted-foreground font-mono">
                {q || dmFilter !== "all"
                  ? "No matches — try a different search or filter."
                  : "No agents in this workspace yet."}
              </div>
            )}
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Workspace settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden glass rounded-2xl">{children}</main>

      <WorkspaceSettingsSheet
        workspaceId={workspaceId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onWorkspaceUpdated={(updated) => {
          setWorkspace((w) => (w ? { ...w, name: updated.name } : w));
          setWorkspaces((list) =>
            list.map((w) => (w.id === updated.id ? { ...w, name: updated.name } : w)),
          );
        }}
      />

      <AdminInboxFlyout open={inboxOpen} onOpenChange={setInboxOpen} />

      <SupportFlyout
        open={supportOpen}
        onOpenChange={setSupportOpen}
        defaultName={profile?.display_name ?? undefined}
        defaultEmail={profile?.email ?? undefined}
        userId={profile?.id ?? null}
      />

      <AlertDialog open={!!pendingAgent} onOpenChange={(o) => !o && setPendingAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Avatar className="w-7 h-7">
                <AvatarImage src={pendingAgent?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  <Bot className="w-3 h-3" />
                </AvatarFallback>
              </Avatar>
              Start a conversation with @{pendingAgent?.handle}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAgent?.description ||
                `This will open a new direct message with ${pendingAgent?.name}. You can pick up the thread any time from your Direct Messages.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const a = pendingAgent;
                setPendingAgent(null);
                if (a) await startDmWithAgent(a);
              }}
            >
              Start conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({
  title,
  titleBadge,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  titleBadge?: number;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1">
        <div className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1.5">
          {title}
          {titleBadge ? (
            <Badge className="h-4 min-w-4 px-1 text-[10px] leading-none">{titleBadge}</Badge>
          ) : null}
        </div>
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
