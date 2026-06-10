import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, Loader2, Plus, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { extractFileText } from "@/lib/file-extraction.functions";
import { createChannelMemo, deleteChannelMemo } from "@/lib/channel-memos.functions";

type Memo = {
  id: string;
  title: string | null;
  body: string;
  tags: string[];
  created_at: string;
  author_type: "user" | "agent";
  author_user_id: string | null;
  author_agent_id: string | null;
};

export function ChannelLogPanel({
  workspaceId,
  channelId,
  agents,
  profiles,
  onFilesChanged,
}: {
  workspaceId: string;
  channelId: string;
  agents: { id: string; handle: string; name: string; avatar_url: string | null }[];
  profiles: Record<string, { display_name: string | null; avatar_url: string | null }>;
  onFilesChanged?: () => void;
}) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createMemoFn = useServerFn(createChannelMemo);
  const deleteMemoFn = useServerFn(deleteChannelMemo);
  const extractFn = useServerFn(extractFileText);

  const load = async () => {
    const { data } = await supabase
      .from("channel_memos")
      .select("id,title,body,tags,created_at,author_type,author_user_id,author_agent_id")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(50);
    setMemos((data ?? []) as any);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`memos:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_memos", filter: `channel_id=eq.${channelId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const submitMemo = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await createMemoFn({ data: { channelId, title: title.trim() || undefined, body, tags: [] } });
      setTitle("");
      setBody("");
      setComposing(false);
      toast.success("Memo logged");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save memo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this memo?")) return;
    try {
      await deleteMemoFn({ data: { memoId: id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete");
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 20MB`);
          continue;
        }
        const path = `${u.user.id}/${workspaceId}/${channelId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("attachments")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data: fileRow, error: fErr } = await supabase
          .from("files")
          .insert({
            workspace_id: workspaceId,
            uploader_id: u.user.id,
            bucket: "attachments",
            path,
            filename: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
            scope: "channel",
            channel_id: channelId,
            is_pinned: true,
            extraction_status: "pending",
          } as any)
          .select("id")
          .single();
        if (fErr || !fileRow) {
          toast.error(`${file.name}: ${fErr?.message ?? "insert failed"}`);
          continue;
        }
        try {
          const res = await extractFn({ data: { fileId: (fileRow as any).id } });
          if (res.status === "ok") {
            toast.success(`${file.name} pinned (${res.chars.toLocaleString()} chars indexed)`);
          } else {
            toast.warning(`${file.name} pinned, but ${res.error ?? "couldn't extract text"}`);
          }
        } catch (e: any) {
          toast.warning(`${file.name} pinned, but extraction failed: ${e?.message ?? ""}`);
        }
      }
      onFilesChanged?.();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const visible = expanded ? memos : memos.slice(0, 3);

  const authorFor = (m: Memo) => {
    if (m.author_type === "agent" && m.author_agent_id) {
      const a = agents.find((x) => x.id === m.author_agent_id);
      return { name: a?.name ?? "Agent", handle: a ? `@${a.handle}` : "", avatar: a?.avatar_url ?? null, isAgent: true };
    }
    const p = m.author_user_id ? profiles[m.author_user_id] : null;
    return { name: p?.display_name ?? "Teammate", handle: "", avatar: p?.avatar_url ?? null, isAgent: false };
  };

  return (
    <>
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Pin a file
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-start gap-2 text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Uploading & indexing…" : "Upload PDF, DOCX, XLSX, CSV, MD…"}
        </Button>
        <div className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
          Pinned files are converted to markdown and injected into every agent reply in this channel.
        </div>
      </div>

      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Project log · {memos.length}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="New memo"
            onClick={() => setComposing((s) => !s)}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {composing && (
          <div className="mb-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              className="w-full text-xs bg-background/40 border border-border rounded px-2 py-1.5 outline-none focus:border-primary"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What should the team remember? Markdown is supported."
              rows={4}
              className="w-full text-xs bg-background/40 border border-border rounded px-2 py-1.5 outline-none focus:border-primary resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={submitMemo} disabled={saving || !body.trim()}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Log memo"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setComposing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {memos.length === 0 && !composing ? (
          <div className="text-xs text-muted-foreground leading-relaxed">
            No memos yet. Agents will add decisions and key facts here as you work, or you can add one yourself.
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((m) => {
              const a = authorFor(m);
              return (
                <div key={m.id} className="group flex gap-2 text-xs">
                  <Avatar className="w-6 h-6 mt-0.5 flex-shrink-0">
                    <AvatarImage src={a.avatar ?? undefined} />
                    <AvatarFallback className="text-[9px]">
                      {a.isAgent ? <Bot className="w-3 h-3" /> : a.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-medium truncate">{m.title || a.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {a.handle || a.name} · {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words mt-0.5">
                      {m.body}
                    </div>
                    {m.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {m.tags.map((t) => (
                          <span key={t} className="text-[9px] uppercase tracking-wider font-mono px-1 py-px rounded bg-accent/30 border border-border">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete memo"
                    onClick={() => handleDelete(m.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
            {memos.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs w-full"
                onClick={() => setExpanded((s) => !s)}
              >
                {expanded ? "Show less" : `Show all ${memos.length}`}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
