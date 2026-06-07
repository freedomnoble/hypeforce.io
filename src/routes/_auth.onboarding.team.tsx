import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import { advanceStep, setDisplayName } from "@/lib/onboarding.functions";
import { useOnboardingState } from "@/lib/onboarding-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/onboarding/team")({
  component: TeamStep,
});

function TeamStep() {
  const navigate = useNavigate();
  const saveName = useServerFn(setDisplayName);
  const advance = useServerFn(advanceStep);
  const { data, patch } = useOnboardingState();

  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const agents = (data?.agents ?? []).slice(0, 3);

  useEffect(() => {
    if (data?.display_name) {
      setName((prev) => prev || (data.display_name as string));
      setSavedName(data.display_name as string);
    }
  }, [data?.display_name]);

  const onContinue = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await saveName({ data: { name: name.trim() } });
      await advance({ data: { to: 2 } });
      setSavedName(name.trim());
      patch({ display_name: name.trim(), step: 2 });
      navigate({ to: "/onboarding/project" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save your name");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout step={2}>
      <StepTitle subtitle="These three agents are already set up inside your workspace.">
        Join your team
      </StepTitle>

      <ul className="space-y-3 mb-5">
        {agents.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.04] border border-border"
              >
                <div className="w-10 h-10 rounded-full bg-foreground/[0.06]" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-foreground/[0.06]" />
                  <div className="h-2.5 w-16 rounded bg-foreground/[0.04]" />
                </div>
              </li>
            ))
          : agents.map((a: any) => (
              <li
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.04] border border-border"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={a.avatar_url ?? undefined} alt={a.name} />
                  <AvatarFallback>{a.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">@{a.handle}</div>
                </div>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-electric font-mono">
                  ready
                </span>
              </li>
            ))}

        <li className="flex items-center gap-3 p-3 rounded-xl bg-electric/5 border border-electric/30">
          <Avatar className="w-10 h-10">
            <AvatarFallback>
              {savedName ? savedName.slice(0, 2).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {savedName ? (
              <>
                <div className="text-sm font-medium">{savedName}</div>
                <div className="text-xs text-muted-foreground font-mono">you</div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="sr-only">
                  Your name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  className="h-9"
                />
              </div>
            )}
          </div>
        </li>
      </ul>

      <Button
        onClick={onContinue}
        disabled={!name.trim() || submitting}
        className="w-full h-12"
      >
        {submitting ? "…" : "Continue"}
      </Button>
    </OnboardingLayout>
  );
}
