import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getOnboardingState } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_auth/onboarding/")({
  component: OnboardingIndex,
});

const STEP_PATH = [
  "/onboarding/team", // step 0 fallback (welcome is public)
  "/onboarding/team", // step 1
  "/onboarding/project", // step 2
  "/onboarding/features", // step 3
  "/onboarding/invites", // step 4
  "/onboarding/tour", // step 5
  "/onboarding/channel", // step 6
] as const;

function OnboardingIndex() {
  const navigate = useNavigate();
  const fn = useServerFn(getOnboardingState);
  const resolved = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (resolved.current) return;
    let active = true;
    (async () => {
      try {
        const state = await fn();
        if (!active) return;
        resolved.current = true;
        if (state.step >= 8) {
          navigate({ to: "/app", replace: true });
          return;
        }
        const idx = Math.max(0, Math.min(state.step, STEP_PATH.length - 1));
        navigate({ to: STEP_PATH[idx], replace: true });
      } catch (e: any) {
        if (!active) return;
        console.error("[onboarding] getOnboardingState failed", e);
        setError(e?.message ?? "Couldn't load your onboarding state.");
      }
    })();
    return () => {
      active = false;
    };
  }, [fn, navigate, attempt]);

  if (error) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6">
        <div className="glass rounded-2xl px-6 py-5 max-w-md w-full text-center space-y-3">
          <div className="font-display text-base">Couldn't load your onboarding</div>
          <div className="text-xs text-muted-foreground break-words">{error}</div>
          <button
            onClick={() => {
              resolved.current = false;
              setError(null);
              setAttempt((a) => a + 1);
            }}
            className="text-electric hover:underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center text-sm text-muted-foreground font-mono">
      preparing your workspace…
    </div>
  );
}
