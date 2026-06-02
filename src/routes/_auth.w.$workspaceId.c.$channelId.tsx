import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, Fragment, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceShell, type Agent, type Profile } from "@/components/hypeforce/workspace-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Hash,
  Send,
  Paperclip,
  AtSign,
  Bot,
  Loader2,
  PanelRight,
  Pin,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File as FileIcon,
  X,
  User as UserIcon,
  MoreHorizontal,
  Smile,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { invokeAgentRouter } from "@/lib/agent-router.functions";

export const Route = createFileRoute("/_auth/w/$workspaceId/c/$channelId")({
  component: ChannelPage,
});

interface Message {
  id: string;
  content: string;
  created_at: string;
  author_type: "user" | "agent" | "system";
  author_user_id: string | null;
  author_agent_id: string | null;
  mentions: string[];
}

interface PinnedFile {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
}

function ChannelPage() {
  const { workspaceId, channelId } = Route.useParams();
  const [channel, setChannel] = useState<{ name: string; topic: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channelAgentIds, setChannelAgentIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [me, setMe] = useState<Profile | null>(null);
  const [pinnedFiles, setPinnedFiles] = useState<PinnedFile[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [thinkingAgentIds, setThinkingAgentIds] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const thinkingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("channels").select("name,topic").eq("id", channelId).maybeSingle();
      setChannel(c);
      const { data: ag } = await supabase.from("agents").select("*").eq("workspace_id", workspaceId);
      setAgents(ag ?? []);
      const { data: cm } = await supabase
        .from("channel_members")
        .select("agent_id")
        .eq("channel_id", channelId)
        .eq("member_type", "agent");
      setChannelAgentIds((cm ?? []).map((r: any) => r.agent_id).filter(Boolean));
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
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
      const { data: pf } = await supabase
        .from("files")
        .select("id,filename,mime_type,size_bytes")
        .eq("channel_id", channelId)
        .eq("is_pinned", true)
        .order("created_at", { ascending: false })
        .limit(20);
      setPinnedFiles((pf ?? []) as PinnedFile[]);
    })();
  }, [channelId, workspaceId]);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((m) => {
            if (m.some((x) => x.id === newMsg.id)) return m;
            return [...m, newMsg];
          });
          if (newMsg.author_type === "agent" && newMsg.author_agent_id) {
            setThinkingAgentIds((s) => s.filter((id) => id !== newMsg.author_agent_id));
            const t = thinkingTimeouts.current[newMsg.author_agent_id];
            if (t) {
              clearTimeout(t);
              delete thinkingTimeouts.current[newMsg.author_agent_id];
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinkingAgentIds.length]);

  const agentByHandle = useMemo(() => {
    const map: Record<string, Agent> = {};
    agents.forEach((a) => (map[a.handle.toLowerCase()] = a));
    return map;
  }, [agents]);

  const roomAgents = useMemo(
    () => agents.filter((a) => channelAgentIds.includes(a.id)),
    [agents, channelAgentIds],
  );

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

  const insertMention = (handle: string) => {
    setInput((v) => {
      const sep = v.length === 0 || v.endsWith(" ") ? "" : " ";
      return `${v}${sep}@${handle} `;
    });
    textareaRef.current?.focus();
  };

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
          channel_id: channelId,
          author_type: "user",
          author_user_id: u.user.id,
          content: text,
          mentions,
        })
        .select()
        .single();
      if (error) throw error;
      setInput("");

      const targetAgentIds = mentions.length > 0 ? mentions : channelAgentIds;
      if (targetAgentIds.length > 0) {
        setThinkingAgentIds((s) => Array.from(new Set([...s, ...targetAgentIds])));
        targetAgentIds.forEach((id) => {
          if (thinkingTimeouts.current[id]) clearTimeout(thinkingTimeouts.current[id]);
          thinkingTimeouts.current[id] = setTimeout(() => {
            setThinkingAgentIds((s) => s.filter((x) => x !== id));
            delete thinkingTimeouts.current[id];
          }, 60_000);
        });
      }

      invokeAgentRouter({
        data: {
          workspace_id: workspaceId,
          channel_id: channelId,
          message_id: msg.id,
          mention_agent_ids: mentions,
        },
      }).catch((e: unknown) => {
        console.error(e);
        setThinkingAgentIds((s) => s.filter((id) => !targetAgentIds.includes(id)));
      });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // Group messages by date for TODAY/dividers.
  const messageGroups = useMemo(() => groupByDate(messages), [messages]);

  return (
    <WorkspaceShell workspaceId={workspaceId} activeChannelId={channelId}>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-14 border-b border-border glass-strong flex items-center px-4 gap-3 flex-shrink-0">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <div className="font-display font-semibold">{channel?.name ?? "…"}</div>
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground border border-border">
              channel
            </span>
            {channel?.topic && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                <div className="text-sm text-muted-foreground truncate">{channel.topic}</div>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center -space-x-2 mr-1">
                {roomAgents.slice(0, 4).map((a) => (
                  <Avatar key={a.id} className="w-7 h-7 ring-2 ring-background">
                    <AvatarImage src={a.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      <Bot className="w-3 h-3" />
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Pinned items">
                <Pin className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={detailsOpen ? "Hide details" : "Show details"}
                onClick={() => setDetailsOpen((s) => !s)}
              >
                <PanelRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="More">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 md:px-8 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground font-mono py-12">
                Start the conversation. Try @manus, @chatgpt, @claude, or @gemini.
              </div>
            )}
            {messageGroups.map(({ label, items }) => (
              <Fragment key={label}>
                <DateDivider label={label} />
                {items.map((m) => (
                  <MessageRow key={m.id} message={m} agents={agents} profiles={profiles} />
                ))}
              </Fragment>
            ))}
            {thinkingAgentIds.map((id) => {
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

          {/* Composer */}
          <div className="border-t border-border p-3 md:p-4 glass-strong flex-shrink-0">
            <div className="rounded-2xl border border-border bg-background/40 focus-within:ring-2 focus-within:ring-ring transition-shadow">
              {/* Quick mention chips */}
              {roomAgents.length > 0 && (
                <div className="flex items-center gap-2 px-3 pt-2.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                    Room
                  </span>
                  {roomAgents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => insertMention(a.handle)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-secondary/60 hover:bg-primary/20 text-foreground/80 hover:text-foreground font-mono transition-colors"
                    >
                      <Avatar className="w-3.5 h-3.5">
                        <AvatarImage src={a.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[8px]">
                          <Bot className="w-2 h-2" />
                        </AvatarFallback>
                      </Avatar>
                      @{a.handle}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder={`Message #${channel?.name ?? ""} — @-mention an agent for a direct task, or omit to brief everyone.`}
                className="w-full bg-transparent resize-none outline-none px-4 py-3 text-sm placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" type="button" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" type="button" title="Attach image">
                  <ImageIcon className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" type="button" title="Emoji">
                  <Smile className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  type="button"
                  title="Mention agent"
                  onClick={() => {
                    setInput((v) => v + (v.endsWith(" ") || v === "" ? "@" : " @"));
                    textareaRef.current?.focus();
                  }}
                >
                  <AtSign className="w-4 h-4" />
                </Button>
                <div className="flex-1 flex flex-wrap items-center gap-1 pl-1">
                  {parseMentions(input).map((id) => {
                    const a = agents.find((x) => x.id === id);
                    if (!a) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-primary/20 text-foreground font-mono"
                      >
                        <Bot className="w-3 h-3" />@{a.handle}
                      </span>
                    );
                  })}
                </div>
                <Button onClick={send} disabled={sending || !input.trim()} size="sm" className="h-8 gap-1.5">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send
                </Button>
              </div>
            </div>
            <div className="mt-2 text-center text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              ↵ to send · ⇧↵ for new line · @mention to target a specific agent
            </div>
          </div>
        </div>

        {/* Right Details panel */}
        {detailsOpen && (
          <aside className="hidden lg:flex w-72 flex-col border-l border-border glass-strong overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Details</div>
                <div className="font-display font-semibold text-sm">#{channel?.name ?? ""}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* In this room */}
            <div className="px-4 py-4 border-b border-border">
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-3">
                In this room
              </div>
              <div className="space-y-2.5">
                <MemberRow
                  name={me?.display_name ?? me?.email ?? "You"}
                  subtitle="You"
                  avatar={me?.avatar_url ?? undefined}
                  fallback={<UserIcon className="w-3.5 h-3.5" />}
                  online
                />
                {roomAgents.map((a) => (
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

            {/* Pinned files */}
            <div className="px-4 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                  Pinned files
                </div>
                <Pin className="w-3 h-3 text-muted-foreground" />
              </div>
              {pinnedFiles.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Pin files to give every agent in this channel persistent context.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pinnedFiles.map((f) => (
                    <PinnedFileRow key={f.id} file={f} />
                  ))}
                </div>
              )}
            </div>

            {/* Channel context */}
            <div className="px-4 py-4">
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                Channel context
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Knowledge base, brand voice, and pinned files from your Admin Console are automatically attached to
                every agent reply in this channel.
              </p>
            </div>
          </aside>
        )}
      </div>
    </WorkspaceShell>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border border-border bg-background/60 text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
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

function PinnedFileRow({ file }: { file: PinnedFile }) {
  const ext = file.filename.split(".").pop()?.toUpperCase() ?? "FILE";
  const sizeKb = file.size_bytes ? (file.size_bytes / 1024).toFixed(0) : null;
  const sizeMb = file.size_bytes && file.size_bytes > 1024 * 1024 ? (file.size_bytes / (1024 * 1024)).toFixed(1) : null;
  const size = sizeMb ? `${sizeMb} MB` : sizeKb ? `${sizeKb} KB` : "";
  const isImage = file.mime_type?.startsWith("image/");
  const isSheet = /xlsx|xls|csv|sheet/i.test(file.filename) || /sheet|excel/i.test(file.mime_type ?? "");
  const isDoc = /pdf|doc|md|txt/i.test(file.filename) || /pdf|word|markdown|text/i.test(file.mime_type ?? "");
  const Icon = isImage ? ImageIcon : isSheet ? FileSpreadsheet : isDoc ? FileText : FileIcon;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer">
      <div className="w-8 h-8 rounded-md bg-secondary/60 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{file.filename}</div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {ext}
          {size ? ` · ${size}` : ""}
        </div>
      </div>
    </div>
  );
}

function groupByDate(messages: Message[]): { label: string; items: Message[] }[] {
  const groups: { label: string; items: Message[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  for (const m of messages) {
    const d = new Date(m.created_at);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    let label: string;
    if (day.getTime() === today.getTime()) label = "Today";
    else if (day.getTime() === yesterday.getTime()) label = "Yesterday";
    else label = day.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  }
  return groups;
}

function MessageRow({
  message,
  agents,
  profiles,
}: {
  message: Message;
  agents: Agent[];
  profiles: Record<string, Profile>;
}) {
  const isAgent = message.author_type === "agent";
  const agent = isAgent ? agents.find((a) => a.id === message.author_agent_id) : null;
  const profile = !isAgent && message.author_user_id ? profiles[message.author_user_id] : null;
  const name = agent?.name ?? profile?.display_name ?? profile?.email ?? "Unknown";
  const avatar = agent?.avatar_url ?? profile?.avatar_url ?? undefined;
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
          ) : (
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-border">
              you
            </span>
          )}
          <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
        </div>
        <div className="prose prose-invert prose-sm max-w-none mt-0.5 text-foreground/90 [&_p]:my-1 [&_code]:font-mono [&_code]:text-electric [&_pre]:bg-popover [&_pre]:rounded-lg [&_pre]:p-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mentionMarkdownComponents(agents)}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function highlightMentions(text: string, handles: Set<string>): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(@[a-zA-Z0-9_-]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const handle = m[1].slice(1).toLowerCase();
    if (handles.has(handle)) {
      parts.push(
        <span
          key={`mention-${key++}`}
          className="inline-block px-1 rounded bg-primary/20 text-primary font-mono font-semibold"
        >
          {m[1]}
        </span>,
      );
    } else {
      parts.push(m[1]);
    }
    last = m.index + m[1].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function walkChildren(children: ReactNode, handles: Set<string>): ReactNode {
  if (typeof children === "string") return <>{highlightMentions(children, handles)}</>;
  if (Array.isArray(children))
    return children.map((c, i) => <Fragment key={i}>{walkChildren(c, handles)}</Fragment>);
  return children;
}

function mentionMarkdownComponents(agents: Agent[]) {
  const handles = new Set(agents.map((a) => a.handle.toLowerCase()));
  const wrap =
    (Tag: string) =>
    ({ children, ...rest }: any) => {
      const T = Tag as any;
      return <T {...rest}>{walkChildren(children, handles)}</T>;
    };
  return {
    p: wrap("p"),
    li: wrap("li"),
    strong: wrap("strong"),
    em: wrap("em"),
    td: wrap("td"),
    th: wrap("th"),
    blockquote: wrap("blockquote"),
  } as any;
}
