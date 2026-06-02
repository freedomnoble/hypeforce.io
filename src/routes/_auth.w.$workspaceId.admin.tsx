import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceShell } from "@/components/hypeforce/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyConnections,
  setAgentRoute,
} from "@/lib/ai-connections.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import {
  Settings2,
  Upload,
  FileText,
  Trash2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Plug,
} from "lucide-react";

export const Route = createFileRoute("/_auth/w/$workspaceId/admin")({
  component: AdminPage,
});

interface KBEntry {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  file_id: string | null;
  created_at: string;
}

interface FileRow {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  bucket: string;
  path: string;
}

const ACCEPTED =
  ".pdf,.csv,.md,.markdown,.txt,.xlsx,.xls,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

// Text-like MIME / extensions we can extract on the client.
function isTextLike(file: File) {
  const n = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    n.endsWith(".txt") ||
    n.endsWith(".md") ||
    n.endsWith(".markdown") ||
    n.endsWith(".csv")
  );
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

interface AgentRow {
  id: string;
  name: string;
  provider: string;
  preferred_route: string | null;
}

type ConnectedProvider = "openai" | "anthropic" | "google" | "manus";

function AdminPage() {
  const { workspaceId } = Route.useParams();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [brandVoice, setBrandVoice] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [files, setFiles] = useState<Record<string, FileRow>>({});
  const [uploading, setUploading] = useState(false);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [myConns, setMyConns] = useState<ConnectedProvider[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listConns = useServerFn(listMyConnections);
  const setRouteFn = useServerFn(setAgentRoute);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: member } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", u.user.id)
        .maybeSingle();
      const admin = member?.role === "owner" || member?.role === "admin";
      setIsAdmin(admin);
      if (!admin) return;

      const { data: ws } = await supabase
        .from("workspaces")
        .select("brand_voice")
        .eq("id", workspaceId)
        .maybeSingle();
      setBrandVoice((ws as any)?.brand_voice ?? "");

      await loadKB();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const loadKB = async () => {
    const { data: kb } = await supabase
      .from("knowledge_base")
      .select("id,title,body,kind,file_id,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setEntries((kb ?? []) as KBEntry[]);
    const fileIds = (kb ?? []).map((k: any) => k.file_id).filter(Boolean);
    if (fileIds.length) {
      const { data: fs } = await supabase
        .from("files")
        .select("id,filename,mime_type,size_bytes,bucket,path")
        .in("id", fileIds);
      const m: Record<string, FileRow> = {};
      (fs ?? []).forEach((f: any) => (m[f.id] = f));
      setFiles(m);
    } else {
      setFiles({});
    }
  };

  const saveBrandVoice = async () => {
    setSavingBrand(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ brand_voice: brandVoice })
      .eq("id", workspaceId);
    setSavingBrand(false);
    if (error) toast.error(error.message);
    else toast.success("Brand voice saved — agents will use it on every reply");
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      for (const file of Array.from(fileList)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 20MB`);
          continue;
        }
        const path = `${u.user.id}/${workspaceId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("knowledge")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }

        // Best-effort text extraction for plain-text formats.
        let content_text: string | null = null;
        if (isTextLike(file)) {
          try {
            content_text = (await readAsText(file)).slice(0, 100_000);
          } catch {
            content_text = null;
          }
        }

        const { data: fileRow, error: fErr } = await supabase
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
        if (fErr) {
          toast.error(`${file.name}: ${fErr.message}`);
          continue;
        }

        const { error: kbErr } = await supabase.from("knowledge_base").insert({
          workspace_id: workspaceId,
          title: file.name,
          kind: "brief",
          body: content_text,
          file_id: fileRow.id,
          created_by: u.user.id,
        });
        if (kbErr) toast.error(`${file.name}: ${kbErr.message}`);
      }
      toast.success("Knowledge base updated");
      await loadKB();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  };

  const deleteEntry = async (entry: KBEntry) => {
    if (!confirm(`Delete "${entry.title}" from the knowledge base?`)) return;
    if (entry.file_id) {
      const f = files[entry.file_id];
      if (f) {
        await supabase.storage.from(f.bucket).remove([f.path]);
        await supabase.from("files").delete().eq("id", f.id);
      }
    }
    await supabase.from("knowledge_base").delete().eq("id", entry.id);
    await loadKB();
  };

  if (isAdmin === null) {
    return (
      <WorkspaceShell workspaceId={workspaceId}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </WorkspaceShell>
    );
  }

  if (!isAdmin) {
    return (
      <WorkspaceShell workspaceId={workspaceId}>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
          <ShieldAlert className="w-10 h-10 text-muted-foreground" />
          <div className="font-display text-lg">Admins only</div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Workspace settings are restricted to owners and admins.
          </p>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspaceId={workspaceId}>
      <header className="h-14 border-b border-border glass-strong flex items-center px-4 gap-3 flex-shrink-0">
        <Settings2 className="w-4 h-4 text-muted-foreground" />
        <div className="font-display font-semibold">Workspace Settings</div>
        <span className="text-[11px] font-mono text-muted-foreground">/ admin</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 md:p-10 space-y-10 max-w-3xl w-full mx-auto">
        {/* Brand voice */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-electric" />
            <h2 className="font-display text-lg font-semibold">Brand Voice & Guidelines</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Prepended silently to every agent's system prompt in this workspace. Use it to define tone,
            forbidden phrases, brand values, target audience — anything an on-brand reply should know.
          </p>
          <Textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value.slice(0, 8000))}
            rows={10}
            placeholder={`Example:\n• Voice: confident, warm, plain English. Never use jargon.\n• Always reference our values: craft, candor, momentum.\n• Avoid: "synergy", "leverage", em-dashes.`}
            className="font-mono text-sm bg-background/40"
          />
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-mono text-muted-foreground">{brandVoice.length}/8000</div>
            <Button onClick={saveBrandVoice} disabled={savingBrand} size="sm">
              {savingBrand ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Save brand voice
            </Button>
          </div>
        </section>

        {/* Knowledge base */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-electric" />
            <h2 className="font-display text-lg font-semibold">Knowledge Base</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload PDFs, CSVs, Excel, Markdown, or text files. Plain-text formats (txt, md, csv) are
            extracted automatically and injected into agent context alongside the brand voice. Binary
            formats (PDF, Excel) are stored for download — extraction will be added later.
          </p>

          <label
            className={`block border-2 border-dashed border-border rounded-2xl p-6 text-center cursor-pointer transition-colors hover:border-primary/50 ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="sr-only"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm">
              {uploading ? "Uploading…" : "Click or drop files (PDF, CSV, XLSX, MD, TXT)"}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1">Max 20MB per file</div>
          </label>

          <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
            {entries.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground text-center">
                No knowledge yet. Upload your first brand brief above.
              </li>
            )}
            {entries.map((e) => {
              const f = e.file_id ? files[e.file_id] : null;
              return (
                <li key={e.id} className="flex items-center gap-3 p-3 hover:bg-secondary/30">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate">
                      {f?.mime_type ?? e.kind}
                      {e.body ? " · text extracted" : f ? " · stored only" : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteEntry(e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </WorkspaceShell>
  );
}
