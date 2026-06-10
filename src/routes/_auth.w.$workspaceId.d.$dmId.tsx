import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceShell, MobileChatTopBar, type Agent, type Profile } from "@/components/hypeforce/workspace-shell";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Send, AtSign, User as UserIcon, MessageSquare, Forward } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { invokeAgentRouter } from "@/lib/agent-router.functions";
import { CreditBadge } from "@/components/hypeforce/credit-badge";
import { ShareMessageDialog, type ShareableMessage } from "@/components/hypeforce/share-message-dialog";

export const Route = createFileRoute("/_auth/w/$workspaceId/d/$dmId")({
  component: DmPage,
});

interface Message {
  id: string;
  content: string;
  created_at: string;
  author_type: "user" | "agent" | "system";
  author_user_id: string | null;
  author_agent_id: string | null;
}

function DmPage() {
  const { workspaceId, dmId } = Route.useParams();
  const [dm, setDm] = useState<{ title: string | null } | null>(null);
  const [participantAgents, setParticipantAgents] = useState<Agent[]>([]);
  const [participantUsers, setParticipantUsers] = useState<Profile[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [me, setMe] = useState<Profile | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState<string[]>([]);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<ShareableMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thinkingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase
        .from("direct_messages")
        .select("title")
        .eq("id", dmId)
        .maybeSingle();
      setDm(d);

      const { data: ag } = await supabase.from("agents").select("*").eq("workspace_id", workspaceId);
      setAgents(ag ?? []);

      const { data: parts } = await supabase
        .from("dm_participants")
        .select("user_id,agent_id,member_type")
        .eq("dm_id", dmId);
      const aIds = (parts ?? []).filter((p: any) => p.agent_id).map((p: any) => p.agent_id);
      const uIds = (parts ?? []).filter((p: any) => p.user_id).map((p: any) => p.user_id);
      setParticipantAgents((ag ?? []).filter((a: any) => aIds.includes(a.id)));
      if (uIds.length) {
        const { data: ps } = await supabase.from("profiles").select("*").in("id", uIds);
        setParticipantUsers((ps ?? []) as Profile[]);
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("dm_id", dmId)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((msgs ?? []) as Message[]);
      const userIds = Array.from(new Set((msgs ?? []).map((m: any) => m.author_user_id).filter(Boolean)));
      if (userIds.length) {
        const { data: ps } = await supabase.from("profiles").select("*").in("id", userIds);
        const map: Record<string, Profile> = {};
        (ps ?? []).forEach((p: any) => (map[p.id] = p));
        setProfiles(map);
      }

      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        setMe(p);
      }
    })();
  }, [dmId, workspaceId]);

  useEffect(() => {
    const ch = supabase
      .channel(`messages:dm:${dmId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `dm_id=eq.${dmId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((m) => (m.some((x) => x.id === newMsg.id) ? m : [...m, newMsg]));
          if (newMsg.author_type === "agent" && newMsg.author_agent_id) {
            setThinking((s) => s.filter((id) => id !== newMsg.author_agent_id));
            const t = thinkingTimeouts.current[newMsg.author_agent_id];
            if (t) {
              clearTimeout(t);
              delete thinkingTimeouts.current[newMsg.author_agent_id];
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `dm_id=eq.${dmId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((m) => m.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [dmId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking.length]);

  const agentByHandle = useMemo(() => {
    const map: Record<string, Agent> = {};
    agents.forEach((a) => (map[a.handle.toLowerCase()] = a));
    return map;
  }, [agents]);

  const parseMentions = (text: string): string[] => {
    const ids: string[] = [];
    const re = /@([a-z0-9_-]+)/gi;
    let m;
    while ((m = re.exec(text))) {
      const a = agentByHandle[m[1].toLowerCase()];
      if (a) ids.push(a.id);
    }
    return Array.from(new Set(ids));
  };

  const participantAgentIds = useMemo(() => participantAgents.map((a) => a.id), [participantAgents]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const mentions = parseMentions(text);
      const { data: msg, error } = await supabase
        .from("messages")
        .insert({
          workspace_id: workspaceId,
          dm_id: dmId,
          author_type: "user",
          author_user_id: u.user.id,
          content: text,
          mentions,
        })
        .select()
        .single();
      if (error) throw error;
      setInput("");

      const targets = mentions.length > 0 ? mentions : participantAgentIds;
      if (targets.length > 0) {
        setThinking((s) => Array.from(new Set([...s, ...targets])));
        targets.forEach((id) => {
          if (thinkingTimeouts.current[id]) clearTimeout(thinkingTimeouts.current[id]);
          thinkingTimeouts.current[id] = setTimeout(() => {
            setThinking((s) => s.filter((x) => x !== id));
            delete thinkingTimeouts.current[id];
          }, 60_000);
        });
      }

      invokeAgentRouter({
        data: {
          workspace_id: workspaceId,
          dm_id: dmId,
          message_id: msg.id,
          mention_agent_ids: targets,
        },
      }).catch((e: unknown) => {
        console.error(e);
        setThinking((s) => s.filter((id) => !targets.includes(id)));
      });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const otherAgent = participantAgents[0];
  const headerTitle =
    dm?.title ??
    (otherAgent ? `@${otherAgent.handle}` : participantUsers[0]?.display_name ?? "Direct Message");

  return (
    <WorkspaceShell workspaceId={workspaceId} activeDmId={dmId}>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileChatTopBar
            title={headerTitle}
            prefix={otherAgent ? "@" : undefined}
            onOpenDetails={() => setMobileDetailsOpen(true)}
          />
          <header className="h-14 border-b border-border glass-strong hidden sm:flex items-center px-4 gap-3 flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <div className="font-display font-semibold">{headerTitle}</div>
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground border border-border">
              direct message
            </span>
            <div className="ml-auto flex items-center -space-x-2">
              {participantAgents.slice(0, 4).map((a) => (
                <Avatar key={a.id} className="w-7 h-7 ring-2 ring-background">
                  <AvatarImage src={a.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    <Bot className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <CreditBadge />
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 md:px-8 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground font-mono py-12">
                {otherAgent
                  ? `Say hi to ${otherAgent.name} — this is a private 1-on-1.`
                  : "Start the conversation."}
              </div>
            )}
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                agents={agents}
                profiles={profiles}
                me={me}
                onShare={(payload) => setShareMsg(payload)}
              />
            ))}
            {thinking.map((id) => {
              const a = agents.find((x) => x.id === id);
              if (!a) return null;
              return (
                <div key={`thinking-${id}`} className="flex gap-3 items-center opacity-80">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={a.avatar_url ?? undefined} />
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                    <span className="font-display font-semibold not-italic text-foreground/80">{a.name}</span>
                    <span>is thinking</span>
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-3 md:p-4 glass-strong flex-shrink-0">
            <div className="rounded-2xl border border-border bg-background/40 focus-within:ring-2 focus-within:ring-ring transition-shadow">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder={
                  otherAgent
                    ? `Message ${otherAgent.name} privately…`
                    : "Type a message…"
                }
                className="w-full bg-transparent resize-none outline-none px-4 py-3 text-sm placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" type="button" title="Mention">
                  <AtSign className="w-4 h-4" />
                </Button>
                <div className="flex-1" />
                <Button onClick={send} disabled={sending || !input.trim()} size="sm" className="h-8 gap-1.5">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send
                </Button>
              </div>
            </div>
            <div className="mt-2 text-center text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              ↵ to send · ⇧↵ for new line
            </div>
          </div>
        </div>

        <aside className="hidden lg:flex w-72 flex-col border-l border-border glass-strong overflow-y-auto scrollbar-thin">
          <div className="px-4 h-14 border-b border-border flex items-center flex-shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Details</div>
              <div className="font-display font-semibold text-sm">{headerTitle}</div>
            </div>
          </div>
          <DmDetailsBody me={me} participantAgents={participantAgents} />
        </aside>

        <Sheet open={mobileDetailsOpen} onOpenChange={setMobileDetailsOpen}>
          <SheetContent side="right" className="p-0 w-80 lg:hidden flex flex-col">
            <div className="px-4 h-14 border-b border-border flex items-center flex-shrink-0">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Details</div>
                <div className="font-display font-semibold text-sm">{headerTitle}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <DmDetailsBody me={me} participantAgents={participantAgents} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </WorkspaceShell>
  );
}

function DmDetailsBody({
  me,
  participantAgents,
}: {
  me: Profile | null;
  participantAgents: Agent[];
}) {
  return (
    <div className="px-4 py-4">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-3">
        Participants
      </div>
      <div className="space-y-2.5">
        {me && (
          <MemberRow
            name={me.display_name ?? me.email ?? "You"}
            subtitle="You"
            avatar={me.avatar_url ?? undefined}
            fallback={<UserIcon className="w-3.5 h-3.5" />}
            online
          />
        )}
        {participantAgents.map((a) => (
          <MemberRow
            key={a.id}
            name={a.name}
            subtitle={a.description ?? a.provider}
            avatar={a.avatar_url ?? undefined}
            badge={a.provider}
            fallback={<Bot className="w-3.5 h-3.5" />}
            online
          />
        ))}
      </div>
    </div>
  );
}

function MemberRow({
  name,
  subtitle,
  avatar,
  badge,
  fallback,
  online,
}: {
  name: string;
  subtitle?: string;
  avatar?: string;
  badge?: string;
  fallback: ReactNode;
  online?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <Avatar className="w-7 h-7">
          <AvatarImage src={avatar} />
          <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
        </Avatar>
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-mint ring-2 ring-background" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{name}</span>
          {badge && (
            <span className="text-[9px] uppercase tracking-wider font-mono px-1 py-px rounded bg-accent/30 text-accent-foreground border border-border">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  agents,
  profiles,
  me,
}: {
  message: Message;
  agents: Agent[];
  profiles: Record<string, Profile>;
  me: Profile | null;
}) {
  const isAgent = message.author_type === "agent";
  const agent = isAgent ? agents.find((a) => a.id === message.author_agent_id) : null;
  const profile =
    !isAgent && message.author_user_id
      ? profiles[message.author_user_id] ?? (me?.id === message.author_user_id ? me : null)
      : null;
  const name = agent?.name ?? profile?.display_name ?? profile?.email ?? "Unknown";
  const avatar = agent?.avatar_url ?? profile?.avatar_url ?? undefined;
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isMe = !isAgent && me?.id === message.author_user_id;

  return (
    <div className="flex gap-3 group">
      <Avatar className="w-9 h-9 mt-0.5">
        <AvatarImage src={avatar} />
        <AvatarFallback>{isAgent ? <Bot className="w-4 h-4" /> : name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-semibold text-sm">{name}</span>
          {isAgent ? (
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground border border-border">
              {agent?.provider}
            </span>
          ) : isMe ? (
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-border">
              you
            </span>
          ) : null}
          <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
        </div>
        <div className="prose prose-invert prose-sm max-w-none mt-0.5 text-foreground/90 [&_p]:my-1 [&_code]:font-mono [&_code]:text-electric [&_pre]:bg-popover [&_pre]:rounded-lg [&_pre]:p-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
