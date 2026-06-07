import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getOnboardingState } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_auth/onboarding/")({
  component: OnboardingIndex,
});

const STEP_PATH = [
  "/onboarding/team", // step 1 fallback (welcome is public)
  "/onboarding/team", // step 2
  "/onboarding/project", // step 3
  "/onboarding/features", // step 4
  "/onboarding/invites", // step 5
  "/onboarding/tour", // step 6
  "/onboarding/channel", // step 7
] as const;

function OnboardingIndex() {
  const navigate = useNavigate();
  const fn = useServerFn(getOnboardingState);

  useEffect(() => {
    (async () => {
      const state = await fn();
      if (state.step >= 8) {
        navigate({ to: "/app", replace: true });
        return;
      }
      const idx = Math.max(0, Math.min(state.step, STEP_PATH.length - 1));
      navigate({ to: STEP_PATH[idx], replace: true });
    })();
  }, [fn, navigate]);

  return (
    <div className="min-h-[100dvh] grid place-items-center text-sm text-muted-foreground font-mono">
      preparing your workspace…
    </div>
  );
}
