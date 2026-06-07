import { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
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
  Home,
  Bell,
  MoreHorizontal,
  PanelRight,
  ChevronLeft,
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
import { UpsellBanner } from "./upsell-banner";
import { CoffeeUpsellButton } from "./coffee-upsell-button";
const InfiniteGridBg = lazy(() =>
  import("./infinite-grid-bg").then((m) => ({ default: m.InfiniteGridBg })),
);

// Mobile context: lets chat pages open the workspaces / profile sheets that
// live inside WorkspaceShell, without prop-drilling. Used on phones (<sm).
export interface MobileShellApi {
  openWorkspaces: () => void;
  openProfile: () => void;
  workspace: { id: string; name: string; slug: string } | null;
  profile: { id: string; display_name: string | null; avatar_url: string | null; email: string | null } | null;
}
const MobileShellCtx = createContext<MobileShellApi | null>(null);
export const useMobileShell = () => useContext(MobileShellCtx);

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
  // Mobile-only sheets (off-canvas drawers)
  const [workspacesSheetOpen, setWorkspacesSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const meIdRef = useRef<string | null>(null);

  const hasActive = !!(activeChannelId || activeDmId);

  useEffect(() => {
    (async () => {
      // Run the four independent top-level queries in parallel instead of
      // waterfalling them. This cuts the shell's blank-state on mount from
      // ~4 sequential RTTs to 1.
      const [wsRes, chRes, agRes, userRes] = await Promise.all([
        supabase.from("workspaces").select("*").order("created_at"),
        supabase
          .from("channels")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("is_pinned", { ascending: false })
          .order("name"),
        supabase
          .from("agents")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("name"),
        supabase.auth.getUser(),
      ]);
      const ws = wsRes.data;
      const ch = chRes.data;
      const ag = agRes.data;
      const u = userRes.data;
      setWorkspaces(ws ?? []);
      setWorkspace((ws ?? []).find((w) => w.id === workspaceId) ?? null);
      setChannels(ch ?? []);
      setAgents(ag ?? []);

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
    <MobileShellCtx.Provider
      value={{
        openWorkspaces: () => setWorkspacesSheetOpen(true),
        openProfile: () => setProfileSheetOpen(true),
        workspace,
        profile,
      }}
    >
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
    <UpsellBanner />
    <CoffeeUpsellButton />
    <div className="flex flex-1 w-full overflow-hidden p-0 sm:p-2 gap-0 sm:gap-2 relative pb-14 sm:pb-2">
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
      <aside className={`${hasActive ? "hidden" : "flex sm:hidden"} md:flex w-full md:w-64 flex-col paper-panel rounded-2xl overflow-hidden`}>

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

      <main className={`${hasActive ? "flex" : "hidden sm:flex"} flex-1 flex-col overflow-hidden glass rounded-2xl`}>{children}</main>

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

      {/* === Mobile-only navigation (phones, < sm) === */}

      {/* Workspaces drawer (mirrors the desktop far-left rail) */}
      <Sheet open={workspacesSheetOpen} onOpenChange={setWorkspacesSheetOpen}>
        <SheetContent side="left" className="p-0 w-72 sm:hidden flex flex-col">
          <div className="px-5 pt-6 pb-4 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Workspaces</div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-1">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setWorkspacesSheetOpen(false);
                  navigate({ to: "/w/$workspaceId", params: { workspaceId: w.id } });
                }}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors ${
                  w.id === workspaceId ? "bg-primary/15" : "hover:bg-secondary/50"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-display font-semibold ${
                  w.id === workspaceId ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80"
                }`}>
                  {w.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold text-sm truncate">{w.name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate">{w.slug}</div>
                </div>
              </button>
            ))}
            <button
              onClick={async () => {
                const name = prompt("New workspace name");
                if (!name) return;
                try {
                  const { workspaceId: newId } = await createWorkspaceFn({ data: { name } });
                  setWorkspacesSheetOpen(false);
                  navigate({ to: "/w/$workspaceId", params: { workspaceId: newId } });
                } catch (err: any) {
                  toast.error(err?.message ?? "Couldn't create workspace");
                }
              }}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left text-muted-foreground hover:bg-secondary/50"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/60">
                <Plus className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium">Add a workspace</div>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Profile sheet (mirrors desktop rail bottom: theme, settings, inbox, help, sign-out) */}
      <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
        <SheetContent side="right" className="p-0 w-80 sm:hidden flex flex-col">
          <div className="px-5 pt-6 pb-5 border-b border-border flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback><UserIcon className="w-5 h-5" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-display font-semibold text-base truncate">
                {profile?.display_name ?? profile?.email ?? "You"}
              </div>
              <div className="text-[10px] font-mono text-mint">● online</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
            {themeHasModes(useTheme().theme) && (
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/60">
                  <AnimatedThemeToggler />
                </div>
                <div className="text-sm">Toggle light / dark</div>
              </div>
            )}
            <ProfileSheetRow
              icon={<Settings className="w-4 h-4" />}
              label="Workspace settings"
              onClick={() => { setProfileSheetOpen(false); setSettingsOpen(true); }}
            />
            <ProfileSheetRow
              icon={<Inbox className="w-4 h-4" />}
              label="Inbox"
              badge={unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : undefined}
              onClick={() => { setProfileSheetOpen(false); setInboxOpen(true); }}
            />
            <ProfileSheetRow
              icon={<HelpCircle className="w-4 h-4" />}
              label="Get help"
              onClick={() => { setProfileSheetOpen(false); setSupportOpen(true); }}
            />
            <div className="h-px bg-border my-2 mx-5" />
            <ProfileSheetRow
              icon={<LogOut className="w-4 h-4" />}
              label="Sign out"
              onClick={() => { setProfileSheetOpen(false); signOut(); }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom tab bar (phones only) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 h-14 z-30 border-t border-border bg-background/95 backdrop-blur flex items-stretch">
        <MobileTabButton
          icon={<Home className="w-5 h-5" />}
          label="Home"
          active={!hasActive}
          onClick={() => navigate({ to: "/w/$workspaceId", params: { workspaceId } })}
        />
        <MobileTabButton
          icon={<MessageSquare className="w-5 h-5" />}
          label="DMs"
          onClick={() => navigate({ to: "/w/$workspaceId", params: { workspaceId } })}
        />
        <MobileTabButton
          icon={<Bell className="w-5 h-5" />}
          label="Activity"
          badge={unreadCount > 0}
          onClick={() => setInboxOpen(true)}
        />
        <MobileTabButton
          icon={<MoreHorizontal className="w-5 h-5" />}
          label="More"
          onClick={() => setProfileSheetOpen(true)}
        />
      </nav>
    </div>
    </div>
    </MobileShellCtx.Provider>
  );
}

function MobileTabButton({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <div className="relative">
        {icon}
        {badge && (
          <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-electric" />
        )}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
    </button>
  );
}

function ProfileSheetRow({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/60 text-foreground">
        {icon}
      </div>
      <div className="flex-1 text-sm font-medium">{label}</div>
      {badge && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-electric text-[10px] font-semibold text-background grid place-items-center">
          {badge}
        </span>
      )}
    </button>
  );
}

export function MobileChatTopBar({
  title,
  prefix,
  onOpenDetails,
}: {
  title: string;
  prefix?: "#" | "@";
  onOpenDetails?: () => void;
}) {
  const ctx = useMobileShell();
  const navigate = useNavigate();
  const ws = ctx?.workspace;
  const profile = ctx?.profile;
  return (
    <header className="sm:hidden h-14 flex items-center px-2 gap-1 flex-shrink-0 glass-strong border-b border-border">
      <button
        onClick={() => ctx?.openWorkspaces()}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-display font-semibold bg-primary text-primary-foreground"
        title="Workspaces"
      >
        {ws ? ws.name.slice(0, 2).toUpperCase() : "··"}
      </button>
      <button
        onClick={() => {
          if (ws) navigate({ to: "/w/$workspaceId", params: { workspaceId: ws.id } });
        }}
        className="flex-1 min-w-0 flex items-center gap-1 px-1 py-1 text-left"
        title="Back to channels"
      >
        <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="font-display font-semibold text-base truncate">
          {prefix ? <span className="text-muted-foreground mr-0.5">{prefix}</span> : null}
          {title || "…"}
        </span>
      </button>
      {onOpenDetails && (
        <button
          onClick={onOpenDetails}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground"
          title="Details"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => ctx?.openProfile()}
        className="ml-0.5"
        title="Your profile"
      >
        <Avatar className="w-9 h-9">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback><UserIcon className="w-4 h-4" /></AvatarFallback>
        </Avatar>
      </button>
    </header>
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
