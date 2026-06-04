import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitSupportTicket, createSupportUploadUrl } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";

const VIDEO_CAP = 25 * 1024 * 1024; // 25MB

type Attachment = { file: File; kind: "image" | "video" | "other" };

export function SupportFlyout({
  open,
  onOpenChange,
  defaultName,
  defaultEmail,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultName?: string;
  defaultEmail?: string;
  userId?: string | null;
}) {
  const submit = useServerFn(submitSupportTicket);
  const uploadUrl = useServerFn(createSupportUploadUrl);

  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      const kind: Attachment["kind"] = f.type.startsWith("image/")
        ? "image"
        : f.type.startsWith("video/")
        ? "video"
        : "other";
      if (kind === "video" && f.size > VIDEO_CAP) {
        toast.error(`${f.name} is over 25MB — please share a link instead.`);
        continue;
      }
      next.push({ file: f, kind });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 10));
  };

  const send = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in name, email and a message.");
      return;
    }
    setBusy(true);
    try {
      // Upload attachments first
      const uploaded: { path: string; mime: string; size_bytes: number; kind: Attachment["kind"] }[] = [];
      for (const a of attachments) {
        const { signedUrl, token, path } = await uploadUrl({
          data: { filename: a.file.name, kind: a.kind },
        });
        // Use supabase-js for reliable signed upload
        const { error } = await supabase.storage
          .from("support-attachments")
          .uploadToSignedUrl(path, token, a.file, { contentType: a.file.type });
        if (error) throw new Error(error.message);
        void signedUrl;
        uploaded.push({ path, mime: a.file.type, size_bytes: a.file.size, kind: a.kind });
      }

      await submit({
        data: {
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          page_url: typeof window !== "undefined" ? window.location.href : undefined,
          user_id: userId ?? null,
          attachments: uploaded.length ? uploaded : undefined,
        },
      });

      toast.success("Thanks — we'll be in touch.");
      setMessage("");
      setAttachments([]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>Get help</SheetTitle>
          <SheetDescription>
            Tell us what's going on. Attach screenshots or a short clip if it helps.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 flex-1 overflow-y-auto">
          <label className="block">
            <span className="text-xs text-muted-foreground">Your name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Message</span>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="What's broken, what you'd love, or what's confusing…"
              className="mt-1"
            />
          </label>

          <div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <Paperclip className="w-4 h-4" />
              <span>Attach screenshots or a clip (≤25MB video)</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-xs bg-secondary/50 rounded-md px-2 py-1"
                  >
                    <span className="truncate">{a.file.name}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button onClick={send} disabled={busy} className="w-full">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
