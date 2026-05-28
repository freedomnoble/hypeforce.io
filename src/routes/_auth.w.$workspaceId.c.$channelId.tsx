import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, Fragment, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceShell, type Agent, type Profile } from "@/components/hypeforce/workspace-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Hash, Send, Paperclip, AtSign, Bot, Loader2 } from "lucide-react";
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

function ChannelPage() {
  const { workspaceId, channelId } = Route.useParams();
  const [channel, setChannel] = useState<{ name: string; topic: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("channels").select("name,topic").eq("id", channelId).maybeSingle();
      setChannel(c);
      const { data: ag } = await supabase.from("agents").select("*").eq("workspace_id", workspaceId);
      setAgents(ag ?? []);
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
    })();
  }, [channelId, workspaceId]);

  // realtime
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages((m) => {
            if (m.some((x) => x.id === (payload.new as any).id)) return m;
            return [...m, payload.new as Message];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

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
      // dispatch to agent router (fire and forget)
      invokeAgentRouter({
        data: {
          workspace_id: workspaceId,
          channel_id: channelId,
          message_id: msg.id,
          mention_agent_ids: mentions,
        },
      }).catch((e: unknown) => console.error(e));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <WorkspaceShell workspaceId={workspaceId} activeChannelId={channelId}>
      {/* Header */}
      <header className="h-14 border-b border-border glass-strong flex items-center px-4 gap-3 flex-shrink-0">
        <Hash className="w-4 h-4 text-muted-foreground" />
        <div className="font-display font-semibold">{channel?.name ?? "…"}</div>
        {channel?.topic && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <div className="text-sm text-muted-foreground truncate">{channel.topic}</div>
          </>
        )}
        <div className="ml-auto flex items-center -space-x-2">
          {agents.slice(0, 4).map((a) => (
            <Avatar key={a.id} className="w-7 h-7 ring-2 ring-background">
              <AvatarImage src={a.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px]"><Bot className="w-3 h-3" /></AvatarFallback>
            </Avatar>
          ))}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 md:px-8 py-6 space-y-5">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground font-mono py-12">
            Start the conversation. Try @manus, @chatgpt, @claude, or @gemini.
          </div>
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} agents={agents} profiles={profiles} />
        ))}
      </div>

      {/* Composer */}
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
            placeholder={`Message #${channel?.name ?? ""} — @-mention an agent to target it`}
            className="w-full bg-transparent resize-none outline-none px-4 py-3 text-sm placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" type="button">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              type="button"
              onClick={() => {
                setInput((v) => v + (v.endsWith(" ") || v === "" ? "@" : " @"));
              }}
            >
              <AtSign className="w-4 h-4" />
            </Button>
            <div className="flex-1 flex flex-wrap items-center gap-1">
              {parseMentions(input).map((id) => {
                const a = agents.find((x) => x.id === id);
                if (!a) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-primary/20 text-foreground font-mono">
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
      </div>
    </WorkspaceShell>
  );
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
          {isAgent && (
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground border border-border">
              agent · {agent?.provider}
            </span>
          )}
          <span className="text-[11px] font-mono text-muted-foreground">{time}</span>
        </div>
        <div className="prose prose-invert prose-sm max-w-none mt-0.5 text-foreground/90 [&_p]:my-1 [&_code]:font-mono [&_code]:text-electric [&_pre]:bg-popover [&_pre]:rounded-lg [&_pre]:p-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
