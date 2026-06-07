import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { getOnboardingState } from "@/lib/onboarding.functions";

export type OnboardingState = Awaited<ReturnType<typeof getOnboardingState>>;

export const ONBOARDING_QUERY_KEY = ["onboarding-state"] as const;

export function onboardingQueryOptions(fetcher: () => Promise<OnboardingState>) {
  return queryOptions({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: fetcher,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Shared onboarding state across all onboarding steps. Cached for 60s so
 * navigating between steps doesn't show a loading flash. Returns `data`
 * (possibly undefined on the very first fetch), and helpers to invalidate
 * or optimistically patch after mutations.
 */
export function useOnboardingState() {
  const fetchState = useServerFn(getOnboardingState);
  const qc = useQueryClient();
  const query = useQuery(onboardingQueryOptions(() => fetchState()));

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
    [qc],
  );

  const patch = useCallback(
    (patch: Partial<OnboardingState>) => {
      qc.setQueryData<OnboardingState>(ONBOARDING_QUERY_KEY, (prev) =>
        prev ? { ...prev, ...patch } : prev,
      );
    },
    [qc],
  );

  return { data: query.data, isLoading: query.isLoading, invalidate, patch };
}
