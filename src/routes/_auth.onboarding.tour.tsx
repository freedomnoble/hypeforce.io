import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { advanceStep } from "@/lib/onboarding.functions";
import { Hash, MessageSquare, Pin } from "lucide-react";

export const Route = createFileRoute("/_auth/onboarding/tour")({
  component: TourStep,
});

function TourStep() {
  const navigate = useNavigate();
  const advance = useServerFn(advanceStep);
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    setBusy(true);
    await advance({ data: { to: 6 } });
    navigate({ to: "/onboarding/channel" });
  };

  return (
    <OnboardingLayout step={6}>
      <StepTitle subtitle="Here's how your workspace is laid out.">Your workspace & channels</StepTitle>

      <div
        className={`relative rounded-2xl border border-border bg-background/40 overflow-hidden mb-4 ${
          isMobile ? "aspect-[9/16]" : "aspect-[16/10]"
        }`}
      >
        <FakePreview mobile={isMobile} />
      </div>

      <ul className="space-y-2.5 mb-6 text-sm">
        <li className="flex gap-3">
          <Hash className="w-4 h-4 text-electric mt-0.5 shrink-0" />
          <span>
            <b>Channels</b> are rooms with you + agents. Send a brief, everyone sees it.
          </span>
        </li>
        <li className="flex gap-3">
          <Pin className="w-4 h-4 text-electric mt-0.5 shrink-0" />
          <span>
            <b>Pin context</b> at the top so every reply stays aligned with your brief.
          </span>
        </li>
        <li className="flex gap-3">
          <MessageSquare className="w-4 h-4 text-electric mt-0.5 shrink-0" />
          <span>
            <b>DMs</b> are private threads with one agent or teammate.
          </span>
        </li>
      </ul>

      <Button onClick={onContinue} disabled={busy} className="w-full h-12">
        Continue
      </Button>
    </OnboardingLayout>
  );
}

function FakePreview({ mobile }: { mobile: boolean }) {
  if (mobile) {
    return (
      <div className="absolute inset-0 flex flex-col text-[10px] p-2 gap-2">
        <div className="rounded-lg bg-foreground/5 px-3 py-2 flex items-center justify-between">
          <span className="font-display font-semibold">launch-plan</span>
          <span className="text-electric">3 agents</span>
        </div>
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {["@manus what's our angle?", "@chatgpt draft three hooks", "@claude tighten the copy"].map(
            (m, i) => (
              <div key={i} className="rounded-md bg-foreground/[0.04] px-2 py-1.5">
                <div className="text-muted-foreground font-mono">you</div>
                <div>{m}</div>
              </div>
            ),
          )}
        </div>
        <div className="rounded-lg bg-foreground/5 px-3 py-2 text-muted-foreground">
          Type a message…
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 grid grid-cols-[140px_1fr] text-[10px]">
      <div className="bg-foreground/[0.04] p-2 space-y-1 border-r border-border">
        <div className="text-muted-foreground font-mono uppercase">channels</div>
        {["launch-plan", "market-research", "brand-voice"].map((c) => (
          <div key={c} className="px-2 py-1 rounded bg-foreground/5">
            # {c}
          </div>
        ))}
        <div className="text-muted-foreground font-mono uppercase mt-2">dms</div>
        {["@manus", "@chatgpt", "@claude"].map((d) => (
          <div key={d} className="px-2 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        <div className="font-display font-semibold"># launch-plan</div>
        {["@manus what's our angle?", "@chatgpt draft three hooks", "@claude tighten the copy"].map(
          (m, i) => (
            <div key={i} className="rounded bg-foreground/[0.04] px-2 py-1">
              <span className="text-muted-foreground font-mono">you · </span>
              {m}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
