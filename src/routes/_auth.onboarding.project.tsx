import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import { advanceStep, setBrandDoc, setProject } from "@/lib/onboarding.functions";
import { useOnboardingState } from "@/lib/onboarding-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_auth/onboarding/project")({
  component: ProjectStep,
});

function ProjectStep() {
  const navigate = useNavigate();
  const saveProject = useServerFn(setProject);
  const saveBrand = useServerFn(setBrandDoc);
  const advance = useServerFn(advanceStep);
  const { data, patch } = useOnboardingState();

  const [project, setProjectName] = useState("");
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current || !data) return;
    if (data.project_name) setProjectName(data.project_name);
    if (data.brand_doc_url) setDocUrl(data.brand_doc_url);
    prefilled.current = true;
  }, [data]);

  const onUpload = async (file: File) => {
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    const ALLOWED = [".pdf", ".doc", ".docx", ".txt", ".md"];
    const lower = file.name.toLowerCase();
    if (!ALLOWED.some((ext) => lower.endsWith(ext))) {
      toast.error(`Unsupported file type. Allowed: ${ALLOWED.join(", ")}`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File is too large. Max 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = `${uid}/brand/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("knowledge").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("knowledge")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;
      const url = signed?.signedUrl ?? "";
      if (!url) throw new Error("Could not generate a link for your file.");
      await saveBrand({
        data: {
          url,
          path,
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type || undefined,
        },
      });
      setDocUrl(url);
      patch({ brand_doc_url: url });
      toast.success("Brand doc uploaded — pinned to #brand-voice");
    } catch (e: any) {
      console.error("[onboarding/project] upload failed", e);
      toast.error(e?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onContinue = async () => {
    if (!project.trim()) return;
    setSubmitting(true);
    const name = project.trim();
    const run = async () => {
      await saveProject({ data: { name } });
      await advance({ data: { to: 3 } });
    };
    try {
      try {
        await run();
      } catch (firstErr) {
        // Transient SSR / network blip — retry once before surfacing.
        console.warn("[onboarding/project] continue failed, retrying", firstErr);
        await new Promise((r) => setTimeout(r, 600));
        await run();
      }
      patch({ project_name: name, step: 3 });
      navigate({ to: "/onboarding/features" });
    } catch (e) {
      console.error("[onboarding/project] continue failed", e);
      toast.error(friendlyError(e, "Couldn't save. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout step={3}>
      <StepTitle subtitle="Give your space a name. You can change it later.">
        What are we working on?
      </StepTitle>

      <div className="space-y-5">
        <Input
          value={project}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Project or business name"
          className="h-12 text-base"
          autoFocus
        />

        <div className="pt-2">
          <div className="text-sm font-medium mb-1">
            Do you have any brand voice or guideline documents?
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            It's ok if not — we can help with this later.
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />

          {docUrl ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-electric/10 border border-electric/30 text-sm">
              <Check className="w-4 h-4 text-electric" />
              <span>Brand doc uploaded</span>
              <button
                onClick={() => inputRef.current?.click()}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Replace
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full h-11"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading…" : "Upload document"}
            </Button>
          )}
        </div>

        <Button
          onClick={onContinue}
          disabled={!project.trim() || submitting}
          className="w-full h-12"
        >
          {submitting ? "…" : "Continue"}
        </Button>
      </div>
    </OnboardingLayout>
  );
}
