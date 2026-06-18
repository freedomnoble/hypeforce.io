import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AVAILABLE_MODELS,
  AVAILABLE_TOOLS,
  createOpenclawAgent,
  type OpenclawSkill,
  type OpenclawPersona,
} from "@/lib/openclaw.functions";

const TONES = ["Friendly", "Concise", "Playful", "Formal", "Technical"];

type Form = {
  displayName: string;
  persona: OpenclawPersona;
  modelId: string;
  skills: OpenclawSkill[];
  tools: string[];
};

const EMPTY: Form = {
  displayName: "",
  persona: { description: "", systemPrompt: "", tone: "Friendly" },
  modelId: AVAILABLE_MODELS[0].id,
  skills: [],
  tools: ["web_search"],
};

export function AgentWizard({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createOpenclawAgent);

  const reset = () => {
    setStep(0);
    setForm(EMPTY);
  };

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          workspaceId,
          displayName: form.displayName,
          persona: form.persona,
          modelId: form.modelId,
          skills: form.skills,
          tools: form.tools,
        },
      }),
    onSuccess: (res) => {
      toast.success("Agent created");
      qc.invalidateQueries({ queryKey: ["openclaw-agents", workspaceId] });
      onOpenChange(false);
      reset();
      navigate({
        to: "/w/$workspaceId/openclaw/$agentId",
        params: { workspaceId, agentId: res.agent.id },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAdvance = () => {
    if (step === 0) return form.displayName.trim().length > 0;
    if (step === 2) return !!form.modelId;
    return true;
  };

  const steps = ["Identity", "Persona", "Model", "Skills", "Tools & review"];

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">New OpenClaw agent</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
          Step {step + 1} of {steps.length} — {steps[step]}
        </div>

        <div className="mt-6 space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Atlas, Scout, Mango…"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Short description</Label>
                <Textarea
                  value={form.persona.description ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      persona: { ...form.persona, description: e.target.value },
                    })
                  }
                  placeholder="What does this agent do?"
                  rows={3}
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, persona: { ...form.persona, tone: t } })
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-mono border ${
                        form.persona.tone === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>System prompt</Label>
                <Textarea
                  value={form.persona.systemPrompt ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      persona: { ...form.persona, systemPrompt: e.target.value },
                    })
                  }
                  placeholder="You are a helpful research assistant. Always cite sources…"
                  rows={8}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label>Model</Label>
              <div className="space-y-2">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setForm({ ...form, modelId: m.id })}
                    className={`w-full text-left p-3 rounded-xl border ${
                      form.modelId === m.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="font-medium text-sm">{m.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{m.id}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {form.skills.map((s, idx) => (
                <div key={s.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.name}
                      onChange={(e) => {
                        const next = [...form.skills];
                        next[idx] = { ...s, name: e.target.value };
                        setForm({ ...form, skills: next });
                      }}
                      placeholder="Skill name"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setForm({
                          ...form,
                          skills: form.skills.filter((x) => x.id !== s.id),
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={s.instructions}
                    onChange={(e) => {
                      const next = [...form.skills];
                      next[idx] = { ...s, instructions: e.target.value };
                      setForm({ ...form, skills: next });
                    }}
                    placeholder="When and how the agent should use this skill"
                    rows={3}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setForm({
                    ...form,
                    skills: [
                      ...form.skills,
                      { id: crypto.randomUUID(), name: "", instructions: "" },
                    ],
                  })
                }
                className="gap-2 w-full"
              >
                <Plus className="w-4 h-4" /> Add skill
              </Button>
              {form.skills.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Optional — skills give your agent specialized playbooks.
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Tools</Label>
                <div className="space-y-2">
                  {AVAILABLE_TOOLS.map((t) => {
                    const checked = form.tools.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:border-foreground/30"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setForm({
                              ...form,
                              tools: v
                                ? [...form.tools, t.id]
                                : form.tools.filter((x) => x !== t.id),
                            })
                          }
                        />
                        <span className="text-sm">{t.label}</span>
                        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                          {t.id}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-border p-4 text-sm space-y-1">
                <div className="font-medium">{form.displayName || "Untitled agent"}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {form.modelId} · {form.persona.tone}
                </div>
                <div className="text-xs text-muted-foreground">
                  {form.skills.length} skills · {form.tools.length} tools
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || create.isPending}
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="gap-1"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.displayName.trim()}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {create.isPending ? "Provisioning…" : "Create agent"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
