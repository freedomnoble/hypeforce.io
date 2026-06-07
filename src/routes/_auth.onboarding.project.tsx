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
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = `${uid}/brand/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("knowledge").upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("knowledge")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? "";
      if (url) {
        await saveBrand({ data: { url } });
        setDocUrl(url);
        patch({ brand_doc_url: url });
        toast.success("Brand doc uploaded");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onContinue = async () => {
    if (!project.trim()) return;
    setSubmitting(true);
    try {
      await saveProject({ data: { name: project.trim() } });
      await advance({ data: { to: 3 } });
      patch({ project_name: project.trim(), step: 3 });
      navigate({ to: "/onboarding/features" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save");
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
