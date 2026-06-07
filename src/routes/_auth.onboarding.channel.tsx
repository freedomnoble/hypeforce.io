import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import { completeOnboarding, createFirstChannel } from "@/lib/onboarding.functions";
import { useOnboardingState } from "@/lib/onboarding-query";
import { Hash, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/onboarding/channel")({
  component: ChannelStep,
});

function ChannelStep() {
  const navigate = useNavigate();
  const createChannel = useServerFn(createFirstChannel);
  const complete = useServerFn(completeOnboarding);
  const { data } = useOnboardingState();

  const existing = (data?.channels ?? []).slice(0, 3);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      if (name.trim()) {
        await createChannel({ data: { name: name.trim() } });
      }
      const { workspaceId, channelId } = await complete();
      if (channelId) {
        navigate({
          to: "/w/$workspaceId/c/$channelId",
          params: { workspaceId, channelId },
          replace: true,
        });
      } else {
        navigate({ to: "/w/$workspaceId", params: { workspaceId }, replace: true });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't finish setup");
      setBusy(false);
    }
  };

  return (
    <OnboardingLayout step={7}>
      <StepTitle subtitle="We've set up a few to get you started. Add your own if you like.">
        Create your first channel
      </StepTitle>

      <ul className="space-y-2 mb-4">
        {existing.map((c: any) => (
          <li
            key={c.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.04] border border-border"
          >
            <Hash className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.name}</div>
              {c.topic && (
                <div className="text-xs text-muted-foreground truncate">{c.topic}</div>
              )}
            </div>
            <Check className="w-4 h-4 text-electric" />
          </li>
        ))}
        <li className="flex items-center gap-3 p-3 rounded-xl bg-electric/5 border border-dashed border-electric/40">
          <Hash className="w-4 h-4 text-electric" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\s+/g, "-").toLowerCase())}
            placeholder="add-your-own"
            className="h-8 border-0 bg-transparent focus-visible:ring-0 px-0"
          />
        </li>
      </ul>

      <Button onClick={finish} disabled={busy} className="w-full h-12">
        {busy ? "…" : name.trim() ? "Create channel" : "I'll start with these"}
      </Button>
    </OnboardingLayout>
  );
}
